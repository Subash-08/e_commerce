import { MongoClient } from "mongodb";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
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
import { handleIdentityRequest } from "../../src/modules/identity/http";
import { identityIndexes } from "../../src/modules/identity/indexes";
import { identityModels } from "../../src/modules/identity/models";

describe("account core with real replica set", () => {
  let context: TestDatabaseContext;
  let database: DatabaseHandle;
  let identity: Awaited<ReturnType<typeof createIdentity>>;
  let second: typeof identity;
  const deliveries: { email: string; url: string }[] = [];
  let deliveryFails = false;
  let failedDeliveries = 0;
  let indexCommands = 0;
  const origin = "http://localhost:3302";
  beforeAll(async () => {
    context = await createTestDatabaseContext("identity_core");
    for (const item of identityIndexes)
      await context.createCollection(item.collection);
    const connect = MongoClient.prototype.connect;
    const hook = vi
      .spyOn(MongoClient.prototype, "connect")
      .mockImplementation(function (this: MongoClient) {
        this.options.monitorCommands = true;
        return connect.call(this);
      });
    try {
      database = await context.createOwner().get();
    } finally {
      hook.mockRestore();
    }
    await applyIndexes(database.db, identityIndexes, { dryRun: false });
    database.client.options.monitorCommands = true;
    database.client.on("commandStarted", (event) => {
      if (event.commandName === "createIndexes") indexCommands++;
    });
    // Positive control before the measured application operations.
    await database.db
      .collection("profiles")
      .createIndex(
        { authUserId: 1 },
        { unique: true, name: "profiles_authUserId_unique" },
      );
    expect(indexCommands).toBe(1);
    indexCommands = 0;
    const options = {
      baseURL: origin,
      secret: randomBytes(48).toString("hex"),
      sendRecovery: async (message: { email: string; url: string }) => {
        if (deliveryFails) throw new Error("Delivery unavailable");
        deliveries.push(message);
      },
      onDeliveryFailure: () => {
        failedDeliveries++;
      },
    };
    identity = await createIdentity(database, options);
    second = await createIdentity(database, options);
  });
  afterAll(async () => {
    await cleanupAll([
      () => context?.teardown(),
      () => stopSharedTestReplicaSet(),
    ]);
  });
  const post = (path: string, body: object, cookie = "", instance = identity) =>
    handleIdentityRequest(
      new Request(origin + "/api/auth" + path, {
        method: "POST",
        headers: { "content-type": "application/json", origin, cookie },
        body: JSON.stringify(body),
      }),
      async () => instance,
    );
  async function account() {
    const user = identityUserFixture();
    const result = await identity.auth.api.signUpEmail({ body: user });
    const response = await identity.auth.api.signInEmail({
      body: { email: user.email, password: user.password },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    return {
      ...user,
      id: result.user.id,
      cookie,
      headers: new Headers({ cookie }),
    };
  }
  it("registers a private default customer profile and denies role injection and admin endpoints", async () => {
    const user = identityUserFixture();
    const response = await post("/sign-up/email", user);
    expect(response.status).toBe(200);
    const repeat = await post("/sign-up/email", user);
    expect(await repeat.json()).toEqual(await response.json());
    const profiles = await identityModels(database.mongoose)
      .Profile.find({ name: user.name })
      .lean();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      role: "CUSTOMER",
      status: "ACTIVE",
      authVersion: 1,
    });
    expect("password" in profiles[0]).toBe(false);
    expect(
      (
        await post("/sign-up/email", {
          ...identityUserFixture(),
          role: "ADMIN",
        })
      ).status,
    ).toBe(400);
    expect((await post("/admin/set-role", {})).status).toBe(404);
    const login = await post("/sign-in/email", {
      email: user.email,
      password: user.password,
    });
    expect(login.status).toBe(200);
    expect(login.headers.getSetCookie().length).toBeGreaterThan(0);
    expect(await login.json()).toEqual({ ok: true });
    const crossOrigin = await handleIdentityRequest(
      new Request(origin + "/api/auth/sign-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://other.example.test",
        },
        body: "{}",
      }),
      async () => identity,
    );
    expect(crossOrigin.status).toBe(403);
  });
  it("uses real cookies and denies cross-owner, stale and inactive authority", async () => {
    const user = await account();
    await expect(
      identity.requireAccess(user.headers, "profile.own", user.id),
    ).resolves.toMatchObject({ role: "CUSTOMER" });
    await expect(
      identity.requireAccess(user.headers, "order.own", "someone-else"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await database.db
      .collection("profiles")
      .updateOne({ authUserId: user.id }, { $inc: { authVersion: 1 } });
    await expect(
      identity.requireAccess(user.headers, "profile.own", user.id),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await database.db
      .collection("profiles")
      .updateOne({ authUserId: user.id }, { $set: { status: "DISABLED" } });
    const login = await post("/sign-in/email", {
      email: user.email,
      password: user.password,
    });
    expect(login.status).toBeGreaterThanOrEqual(400);
  });
  it("delivers the library reset link and revokes the old cookie after reset", async () => {
    const user = await account();
    expect(
      (await post("/request-password-reset", { email: user.email })).status,
    ).toBe(200);
    const sent = deliveries.find((message) => message.email === user.email);
    expect(Boolean(sent)).toBe(true);
    const token = new URL(sent!.url).pathname.split("/").at(-1)!;
    const response = await post("/reset-password", {
      token,
      newPassword: randomBytes(24).toString("hex"),
    });
    expect(response.status).toBe(200);
    expect(
      await identity.auth.api.getSession({ headers: user.headers }),
    ).toBeNull();
    expect(
      (
        await post("/reset-password", {
          token,
          newPassword: randomBytes(24).toString("hex"),
        })
      ).status,
    ).toBe(400);
  });
  it("keeps recovery responses neutral when delivery fails and signs out through the library", async () => {
    const user = await account();
    await database.db.collection("auth_rateLimit").deleteMany({});
    deliveryFails = true;
    const existing = await post("/request-password-reset", {
      email: user.email,
    });
    const absent = await post("/request-password-reset", {
      email: identityUserFixture().email,
    });
    deliveryFails = false;
    expect(existing.status).toBe(200);
    expect(await existing.json()).toEqual(await absent.json());
    expect(failedDeliveries).toBe(1);
    expect((await post("/sign-out", {}, user.cookie)).status).toBe(200);
    expect(
      await identity.auth.api.getSession({ headers: user.headers }),
    ).toBeNull();
  });
  it("shares the recovery limit across instances and performs no runtime index creation", async () => {
    await database.db.collection("auth_rateLimit").deleteMany({});
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        post(
          "/request-password-reset",
          { email: identityUserFixture().email },
          "",
          index % 2 ? second : identity,
        ),
      ),
    );
    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(3);
    expect(
      responses.filter((response) => response.status === 429),
    ).toHaveLength(5);
    expect(indexCommands).toBe(0);
  });
});
