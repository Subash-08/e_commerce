import { createAuthEndpoint } from "better-auth/api";
import { adminService } from "./admin-service";
import { adminRepository } from "./admin-repository";
import {
  transaction,
  assertOutsideTransaction,
} from "../../server/db/transaction";
import "server-only";
import { betterAuth } from "better-auth/minimal";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { z } from "zod";
import type { DatabaseHandle } from "../../server/db/connection";
import { checkIndexes } from "../../server/db/indexes";
import { DomainError } from "../../shared/domain/errors";
import type { RecoverySender } from "../notifications/recovery-email";
import { authorize, type IdentityAction } from "./authorization";
import { identityIndexes } from "./indexes";
import { identityRepository } from "./repository";

const settingsSchema = z.object({
  baseURL: z.url(),
  secret: z.string().min(32),
});
export interface IdentityOptions {
  readonly baseURL: string;
  readonly secret: string;
  readonly sendRecovery: RecoverySender;
  readonly onDeliveryFailure: () => void;
}

/** Configured per process using the application-owned client. No runtime index creation. */
export async function createIdentity(
  database: DatabaseHandle,
  options: IdentityOptions,
) {
  const parsed = settingsSchema.safeParse(options);
  if (!parsed.success) throw new DomainError("AUTH_CONFIG_INVALID");
  const origin = new URL(parsed.data.baseURL);
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
      ))
  )
    throw new DomainError("AUTH_CONFIG_INVALID");
  if ((await checkIndexes(database.db, identityIndexes)).length)
    throw new DomainError("AUTH_INDEX_DRIFT");
  const repository = identityRepository(database.mongoose);
  const auth = betterAuth({
    appName: "Commerce",
    baseURL: origin.origin,
    secret: parsed.data.secret,
    trustedOrigins:
      process.env.APP_ENV === "development" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname)
        ? [
            "http://localhost:" + (origin.port || "80"),
            "http://127.0.0.1:" + (origin.port || "80"),
          ]
        : [origin.origin],
    database: mongodbAdapter(database.db, {
      client: database.client,
      transaction: true,
    }),
    logger: { disabled: true },
    plugins: [
      {
        id: "commerce-session-maintenance",
        endpoints: {
          revokeAuthoritySessions: createAuthEndpoint.serverOnly(
            {
              method: "POST",
              body: z.object({
                authUserId: z.string().min(1).max(200),
                beforeVersion: z.number().int().min(1),
              }),
            },
            async (ctx) => {
              assertOutsideTransaction();
              await ctx.context.adapter.deleteMany({
                model: "session",
                where: [
                  { field: "userId", value: ctx.body.authUserId },
                  {
                    field: "authVersion",
                    operator: "lt",
                    value: ctx.body.beforeVersion,
                  },
                ],
              });
              return { ok: true };
            },
          ),
        },
      },
    ],
    advanced: {
      // Until the host's trusted proxy policy is approved, use a shared per-path bucket.
      // Never trust arbitrary client-supplied forwarding headers.
      ipAddress: { ipAddressHeaders: [] },
      useSecureCookies: origin.protocol === "https:",
    },
    user: {
      modelName: "auth_user",
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    account: { modelName: "auth_account", accountLinking: { enabled: false } },
    verification: { modelName: "auth_verification" },
    session: {
      modelName: "auth_session",
      cookieCache: { enabled: false },
      additionalFields: {
        authVersion: { type: "number", required: false, input: false },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 900,
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => {
        // Revoke first: an audit failure must not leave a password-reset session usable.
        await revokeStoredSessions(user.id, Number.MAX_SAFE_INTEGER);
        const adminRepo = adminRepository(database);
        await transaction(async (session) => {
          const profile = await adminRepo.profile(user.id, session);
          if (!profile) throw new DomainError("AUTH_REQUIRED");
          await adminRepo.profiles.updateOne(
            { authUserId: user.id },
            {
              $inc: { authVersion: 1, revision: 1 },
              $set: { updatedAt: new Date() },
            },
            { session },
          );
          await adminRepo.audit(
            "PASSWORD_RESET",
            user.id,
            user.id,
            null,
            {},
            session,
          );
          await adminRepo.enqueue(user.id, profile.authVersion + 1, session);
        }, database);
      },
      sendResetPassword: async ({ user, url }) => {
        try {
          await options.sendRecovery({ email: user.email, url });
        } catch {
          // Keep the same recovery response for absent accounts and delivery failures.
          // Callback receives no email, URL, token or provider error.
          try {
            options.onDeliveryFailure();
          } catch {
            /* Observability cannot disclose account existence. */
          }
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await repository.provisionCustomer(user.id, user.name);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const profile = await repository.findProfile(session.userId);
            if (
              !profile ||
              profile.status !== "ACTIVE" ||
              !Number.isSafeInteger(profile.authVersion) ||
              profile.authVersion < 1
            )
              return false;
            return { data: { ...session, authVersion: profile.authVersion } };
          },
        },
      },
    },
  });
  async function requireAccess(
    headers: Headers,
    action: IdentityAction,
    resourceOwnerId?: string,
  ) {
    const result = await auth.api.getSession({ headers });
    const profile = result
      ? await repository.findProfile(result.user.id)
      : null;
    return authorize(
      result
        ? {
            authUserId: result.user.id,
            authVersion: result.session.authVersion ?? 0,
            expiresAt: result.session.expiresAt.getTime(),
          }
        : null,
      profile,
      action,
      { now: Date.now(), resourceOwnerId },
    );
  }
  async function revokeStoredSessions(
    authUserId: string,
    beforeVersion: number,
  ): Promise<void> {
    await auth.api.revokeAuthoritySessions({
      body: { authUserId, beforeVersion },
    });
  }
  const administration = adminService(database, {
    read: async (headers) => {
      const result = await auth.api.getSession({ headers });
      return result
        ? {
            authUserId: result.user.id,
            authVersion: result.session.authVersion ?? 0,
            expiresAt: result.session.expiresAt.getTime(),
          }
        : null;
    },
    revoke: revokeStoredSessions,
  });
  return { auth, requireAccess, administration, baseURL: origin.origin };
}
