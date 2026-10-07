// Throwaway AUTH-DECIDE fixture. Never import from application routes.
import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth/minimal";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { type DatabaseHandle } from "../../../src/server/db/connection";
import {
  applyIndexes,
  checkIndexes,
  type CollectionIndexes,
} from "../../../src/server/db/indexes";
import reviewed from "./reviewed-indexes.json";

export const authManifest: readonly CollectionIndexes[] = [
  ...new Set(reviewed.indexes.map((i) => i.collection)),
].map((collection) => ({
  collection,
  indexes: reviewed.indexes
    .filter((i) => i.collection === collection)
    .map((i) => ({
      name: i.name,
      key: Object.fromEntries(
        Object.keys(i.key).map((key) => [key, 1 as const]),
      ),
      unique: i.unique,
    })),
}));
export async function prepareAuthIndexes(database: DatabaseHandle) {
  // Same implementation used by db:indexes:apply; the application manifest stays empty.
  await applyIndexes(database.db, authManifest, { dryRun: false });
}
export async function preflight(database: DatabaseHandle) {
  if ((await checkIndexes(database.db, authManifest)).length)
    throw new Error("AUTH_INDEX_DRIFT");
}
export function createSpike(database: DatabaseHandle) {
  const profiles = database.db.collection<{
    authUserId: string;
    role: string;
    active: boolean;
    authVersion: number;
  }>("spike_profiles");
  const deliveries: { email: string; token: string }[] = [];
  async function requireAdmin(headers: Headers) {
    const data = await auth.api.getSession({ headers });
    if (!data) throw new APIError("FORBIDDEN", { message: "Forbidden" });
    const profile = await profiles.findOne({ authUserId: data.user.id });
    const version = (data.session as unknown as { authVersion?: number })
      .authVersion;
    if (
      !profile ||
      !profile.active ||
      profile.role !== "ADMIN" ||
      !Number.isSafeInteger(version) ||
      version !== profile.authVersion
    )
      throw new APIError("FORBIDDEN", { message: "Forbidden" });
    return profile;
  }
  const auth = betterAuth({
    appName: "Compatibility exercise",
    baseURL: "http://localhost:3301",
    secret: randomBytes(48).toString("base64url"),
    database: mongodbAdapter(database.db, {
      client: database.client,
      transaction: true,
    }),
    logger: { disabled: true },
    rateLimit: { enabled: false }, // Abuse-control acceptance belongs to AUTH-CORE, not this fixture.
    user: {
      modelName: "auth_user",
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    session: {
      modelName: "auth_session",
      cookieCache: { enabled: false },
      additionalFields: {
        authVersion: { type: "number", required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        deliveries.push({ email: user.email, token });
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const profile = await profiles.findOne({
              authUserId: session.userId,
            });
            if (
              !profile ||
              !profile.active ||
              !Number.isSafeInteger(profile.authVersion)
            )
              return false;
            return { data: { ...session, authVersion: profile.authVersion } };
          },
        },
      },
    },
    plugins: [
      {
        id: "spike-service-boundary",
        endpoints: {
          spikeAdminAction: createAuthEndpoint(
            "/spike/admin-action",
            { method: "POST" },
            async (ctx) => {
              await requireAdmin(new Headers(ctx.headers));
              return { ok: true };
            },
          ),
        },
      },
    ],
  });
  return { auth, profiles, deliveries, requireAdmin };
}
