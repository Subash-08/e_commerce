import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomBytes } from "node:crypto";
import {
  createTestDatabaseContext,
  cleanupAll,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import { identityUserFixture } from "../fixtures/identity";
import { applyIndexes } from "../../src/server/db/indexes";
import type { DatabaseHandle } from "../../src/server/db/connection";
import { createIdentity } from "../../src/modules/identity/service";
import { identityIndexes } from "../../src/modules/identity/indexes";
import { repairMissingProfile } from "../../src/modules/identity/repair";
import { bootstrapAdministrator } from "../../src/modules/identity/bootstrap";
import { adminService } from "../../src/modules/identity/admin-service";
import {
  changeUserAuthority,
  retryUserRevocations,
} from "../../src/modules/identity/admin-actions";
const boundary = vi.hoisted(() => ({
  headers: new Headers(),
  identity: undefined as Awaited<ReturnType<typeof createIdentity>> | undefined,
}));
vi.mock("next/headers", () => ({ headers: async () => boundary.headers }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../../src/modules/identity/runtime", () => ({
  getIdentity: async () => boundary.identity!,
}));

describe("administrator account management", () => {
  let context: TestDatabaseContext;
  let database: DatabaseHandle;
  let identity: Awaited<ReturnType<typeof createIdentity>>;
  beforeAll(async () => {
    context = await createTestDatabaseContext("admin_authority");
    for (const item of identityIndexes)
      await context.createCollection(item.collection);
    database = await context.createOwner().get();
    await applyIndexes(database.db, identityIndexes, { dryRun: false });
    identity = await createIdentity(database, {
      baseURL: "http://localhost:3302",
      secret: randomBytes(48).toString("hex"),
      sendRecovery: async () => {},
      onDeliveryFailure: () => {},
    });
    boundary.identity = identity;
  });
  beforeEach(async () => {
    for (const item of identityIndexes)
      await database.db.collection(item.collection).deleteMany({});
  });
  afterAll(async () => {
    await cleanupAll([
      () => context?.teardown(),
      () => stopSharedTestReplicaSet(),
    ]);
  });
  async function register() {
    const user = identityUserFixture();
    const result = await identity.auth.api.signUpEmail({ body: user });
    return { ...user, id: result.user.id };
  }
  async function login(user: { email: string; password: string }) {
    const response = await identity.auth.api.signInEmail({
      body: user,
      asResponse: true,
    });
    expect(response.status).toBe(200);
    return new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    });
  }
  async function owner() {
    const user = await register();
    await bootstrapAdministrator(database, user.id);
    return { ...user, headers: await login(user) };
  }
  it("bootstraps once, denies the old cookie, and keeps revocation off HTTP", async () => {
    const user = await register();
    const old = await login(user);
    await bootstrapAdministrator(database, user.id);
    await expect(
      bootstrapAdministrator(database, user.id),
    ).rejects.toMatchObject({ code: "ADMIN_ALREADY_EXISTS" });
    await expect(
      identity.requireAccess(old, "users.manage"),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await identity.administration.retryRevocations();
    expect(await identity.auth.api.getSession({ headers: old })).toBeNull();
    expect(
      (
        await identity.auth.handler(
          new Request(
            "http://localhost:3302/api/auth/revokeAuthoritySessions",
            { method: "POST" },
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      await database.db
        .collection("auditLogs")
        .countDocuments({ action: "FIRST_ADMIN_BOOTSTRAPPED" }),
    ).toBe(1);
  });
  it("rejects non-admins in both exported administrator server actions", async () => {
    const user = await register();
    boundary.headers = await login(user);
    expect(
      (
        await changeUserAuthority({
          authUserId: user.id,
          revision: 0,
          role: "ADMIN",
          status: "ACTIVE",
        })
      ).ok,
    ).toBe(false);
    expect((await retryUserRevocations()).ok).toBe(false);
    await expect(
      identity.administration.list(boundary.headers, {}),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await database.db.collection("auditLogs").countDocuments()).toBe(0);
  });
  it("changes access, audits safely, rejects stale edits and disables old sessions", async () => {
    const admin = await owner();
    const user = await register();
    const old = await login(user);
    boundary.headers = admin.headers;
    expect(
      (
        await changeUserAuthority({
          authUserId: user.id,
          revision: 0,
          role: "STAFF",
          status: "ACTIVE",
        })
      ).ok,
    ).toBe(true);
    expect(await identity.auth.api.getSession({ headers: old })).toBeNull();
    await expect(
      identity.administration.changeAuthority(admin.headers, {
        authUserId: user.id,
        revision: 0,
        role: "CUSTOMER",
        status: "ACTIVE",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await identity.administration.changeAuthority(admin.headers, {
      authUserId: user.id,
      revision: 1,
      role: "STAFF",
      status: "DISABLED",
    });
    const denied = await identity.auth.api.signInEmail({
      body: { email: user.email, password: user.password },
      asResponse: true,
    });
    expect(denied.status).toBeGreaterThanOrEqual(400);
    await identity.administration.changeAuthority(admin.headers, {
      authUserId: user.id,
      revision: 2,
      role: "STAFF",
      status: "ACTIVE",
    });
    await login(user);
    const audit = await database.db
      .collection("auditLogs")
      .find({
        entityId: user.id,
        action: {
          $in: ["USER_ROLE_CHANGED", "USER_DEACTIVATED", "USER_ACTIVATED"],
        },
      })
      .sort({ occurredAt: 1, _id: 1 })
      .toArray();
    expect(audit.map((entry) => entry.action)).toEqual([
      "USER_ROLE_CHANGED",
      "USER_DEACTIVATED",
      "USER_ACTIVATED",
    ]);
    expect(JSON.stringify(audit).includes(user.password)).toBe(false);
    expect(JSON.stringify(audit).includes(user.email)).toBe(false);
  });
  it("recovers missing profiles once without overwriting authority", async () => {
    const user = await register();
    const old = await login(user);
    await database.db.collection("profiles").deleteOne({ authUserId: user.id });
    expect(await repairMissingProfile(database, user.id)).toEqual({
      created: true,
    });
    await expect(
      identity.requireAccess(old, "profile.own", user.id),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await bootstrapAdministrator(database, user.id);
    expect(await repairMissingProfile(database, user.id)).toEqual({
      created: false,
    });
    expect(
      await database.db.collection("profiles").findOne({ authUserId: user.id }),
    ).toMatchObject({ role: "ADMIN", authVersion: 3 });
    expect(
      await database.db
        .collection("auditLogs")
        .countDocuments({ entityId: user.id, action: "PROFILE_RECOVERED" }),
    ).toBe(1);
  });
  it("serializes two simultaneous last-admin demotions", async () => {
    const a = await owner();
    const b = await register();
    await identity.administration.changeAuthority(a.headers, {
      authUserId: b.id,
      revision: 0,
      role: "ADMIN",
      status: "ACTIVE",
    });
    const bHeaders = await login(b);
    const results = await Promise.allSettled([
      identity.administration.changeAuthority(a.headers, {
        authUserId: a.id,
        revision: 1,
        role: "STAFF",
        status: "ACTIVE",
      }),
      identity.administration.changeAuthority(bHeaders, {
        authUserId: b.id,
        revision: 1,
        role: "STAFF",
        status: "ACTIVE",
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await database.db
        .collection("profiles")
        .countDocuments({ role: "ADMIN", status: "ACTIVE" }),
    ).toBe(1);
    expect(
      await database.db
        .collection("securityGuards")
        .findOne({ key: "last-admin" }),
    ).toMatchObject({ activeAdminCount: 1 });
  });
  it("persists failed revocation and recovers it without revoking a fresh session", async () => {
    const admin = await owner();
    const user = await register();
    const old = await login(user);
    const failing = adminService(database, {
      read: async (headers) => {
        const result = await identity.auth.api.getSession({ headers });
        return result
          ? {
              authUserId: result.user.id,
              authVersion: result.session.authVersion ?? 0,
              expiresAt: result.session.expiresAt.getTime(),
            }
          : null;
      },
      revoke: async () => {
        throw new Error("injected failure");
      },
    });
    await failing.changeAuthority(admin.headers, {
      authUserId: user.id,
      revision: 0,
      role: "STAFF",
      status: "ACTIVE",
    });
    await expect(
      identity.requireAccess(old, "catalog.manage"),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    const fresh = await login(user);
    expect(
      await database.db
        .collection("jobs")
        .findOne({ businessKey: user.id + ":2" }),
    ).toMatchObject({ state: "RETRY" });
    await database.db
      .collection("jobs")
      .updateMany({ state: "RETRY" }, { $set: { dueAt: new Date(0) } });
    await identity.administration.retryRevocations();
    expect(await identity.auth.api.getSession({ headers: old })).toBeNull();
    expect(
      await identity.auth.api.getSession({ headers: fresh }),
    ).not.toBeNull();
    expect(
      await database.db
        .collection("jobs")
        .findOne({ businessKey: user.id + ":2" }),
    ).toMatchObject({ state: "SUCCEEDED" });
  });
});
