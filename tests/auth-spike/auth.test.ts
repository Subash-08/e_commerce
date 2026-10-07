import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { MongoClient, type CommandStartedEvent } from "mongodb";
import {
  createTestDatabaseContext,
  cleanupAll,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import {
  createSpike,
  prepareAuthIndexes,
  preflight,
  authManifest,
} from "../fixtures/auth-spike/auth";
import reviewed from "../fixtures/auth-spike/reviewed-indexes.json";
import type { DatabaseHandle } from "../../src/server/db/connection";

type Observed = {
  collection: string;
  name: string;
  key: Record<string, number>;
  unique: boolean;
};
describe("AUTH-DECIDE bounded spike", () => {
  let context: TestDatabaseContext;
  let database: DatabaseHandle;
  let spike: ReturnType<typeof createSpike>;
  const observed: Observed[] = [];
  let monitoringControlPassed = false;
  const listener = (event: CommandStartedEvent) => {
    if (event.commandName !== "createIndexes") return;
    for (const index of event.command.indexes)
      observed.push({ collection: event.command.createIndexes, ...index });
  };
  beforeAll(async () => {
    context = await createTestDatabaseContext("auth_spike");
    for (const collection of [
      ...authManifest.map((x) => x.collection),
      "spike_profiles",
    ])
      await context.createCollection(collection);
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
    await prepareAuthIndexes(database);
    await preflight(database);
    database.client.on("commandStarted", listener);
    await database.db
      .collection("auth_user")
      .createIndex(
        { email: 1 },
        { name: "auth_user_email_uidx", unique: true },
      );
    expect(observed.length).toBe(1); // Positive control: monitoring is active.
    monitoringControlPassed = true;
    observed.length = 0;
    spike = createSpike(database);
  });
  afterAll(async () => {
    await mkdir("docs/database", { recursive: true });
    await writeFile(
      "docs/database/AUTH-SPIKE-INDEX-COMMANDS.json",
      JSON.stringify(
        {
          versions: reviewed.versions,
          monitoringControlPassed,
          commands: observed,
        },
        null,
        2,
      ) + "\n",
    );
    database?.client.off("commandStarted", listener);
    await cleanupAll([
      () => context?.teardown(),
      () => stopSharedTestReplicaSet(),
    ]);
  });

  async function signup(app = spike, active = true) {
    const email = randomUUID() + "@example.test";
    const password = randomBytes(24).toString("base64url");
    const response = await app.auth.api.signUpEmail({
      body: { email, password, name: "Spike user" },
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    const id: string = result.user.id;
    await app.profiles.insertOne({
      authUserId: id,
      role: "ADMIN",
      active,
      authVersion: 1,
    });
    return { id, email, password };
  }
  async function signin(
    user: { email: string; password: string },
    app = spike,
  ) {
    const response = await app.auth.api.signInEmail({
      body: user,
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(Boolean(cookie)).toBe(true);
    return new Headers({ cookie, origin: "http://localhost:3301" });
  }

  it("pins exact installed auth/core/adapter versions", async () => {
    for (const [name, version] of Object.entries(reviewed.versions)) {
      const pkg = JSON.parse(
        await readFile("node_modules/" + name + "/package.json", "utf8"),
      );
      expect(pkg.version).toBe(version);
    }
  });
  it("shares one production driver with only the launcher's private dev copy", async () => {
    execFileSync(process.execPath, ["scripts/check-production-driver.mjs"]);
    const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
    const copies = Object.keys(lock.packages).filter((name) =>
      name.endsWith("/mongodb"),
    );
    expect(copies.sort()).toEqual(
      [
        "node_modules/mongodb",
        "node_modules/mongodb-memory-server-core/node_modules/mongodb",
      ].sort(),
    );
    expect(
      lock.packages[
        "node_modules/mongodb-memory-server-core/node_modules/mongodb"
      ].dev,
    ).toBe(true);
    expect(
      lock.packages["node_modules/mongodb-memory-server-core"].dependencies
        .mongodb,
    ).toBeDefined();
    expect(
      lock.packages[""].dependencies["mongodb-memory-server-core"],
    ).toBeUndefined();
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    expect(pkg.overrides).toBeUndefined();
    expect(
      Object.values({ ...pkg.dependencies, ...pkg.devDependencies }).some(
        (value) => String(value).startsWith("npm:"),
      ),
    ).toBe(false);
  });
  it("uses the shared application client and configured database", async () => {
    expect(database.mongoose.getClient()).toBe(database.client);
    expect(database.mongoose.name).toBe(database.db.databaseName);
    const user = await signup();
    await signin(user);
    expect(
      await database.db
        .collection("auth_user")
        .countDocuments({ email: user.email }),
    ).toBe(1);
  });
  it("precreated indexes remain identical with no runtime createIndexes commands", async () => {
    expect(observed).toEqual(reviewed.runtimeCommands);
    await preflight(database);
  });
  it("reset invalidates existing database sessions and uses captured delivery only", async () => {
    const user = await signup();
    const headers = await signin(user);
    expect(await spike.auth.api.getSession({ headers })).not.toBeNull();
    await spike.auth.api.requestPasswordReset({
      body: {
        email: user.email,
        redirectTo: "http://localhost:3301/reset-password",
      },
    });
    const delivery = spike.deliveries.find((x) => x.email === user.email);
    expect(Boolean(delivery)).toBe(true);
    await spike.auth.api.resetPassword({
      body: {
        token: delivery!.token,
        newPassword: randomBytes(24).toString("base64url"),
      },
    });
    expect(await spike.auth.api.getSession({ headers })).toBeNull();
  });
  it.each(["demotion", "deactivation", "version"])(
    "rejects an old cookie at the service boundary after %s",
    async (action) => {
      const user = await signup();
      const headers = await signin(user);
      await expect(spike.requireAdmin(headers)).resolves.toBeDefined();
      const update =
        action === "demotion"
          ? { role: "CUSTOMER", authVersion: 2 }
          : action === "deactivation"
            ? { active: false, authVersion: 2 }
            : { authVersion: 2 };
      await spike.profiles.updateOne({ authUserId: user.id }, { $set: update });
      await expect(spike.requireAdmin(headers)).rejects.toMatchObject({
        status: "FORBIDDEN",
      });
      await expect(
        spike.auth.api.spikeAdminAction({ headers }),
      ).rejects.toMatchObject({ status: "FORBIDDEN" });
      const response = await spike.auth.handler(
        new Request("http://localhost:3301/api/auth/spike/admin-action", {
          method: "POST",
          headers,
        }),
      );
      expect(response.status).toBe(403);
    },
  );
  it("fails closed at session creation when authority is missing or inactive", async () => {
    const user = await signup();
    await spike.profiles.deleteOne({ authUserId: user.id });
    const sessionCount = await database.db
      .collection("auth_session")
      .countDocuments();
    const response = await spike.auth.api.signInEmail({
      body: { email: user.email, password: user.password },
      asResponse: true,
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await database.db.collection("auth_session").countDocuments()).toBe(
      sessionCount,
    );
    const disabled = await signup(spike, false);
    const denied = await spike.auth.api.signInEmail({
      body: { email: disabled.email, password: disabled.password },
      asResponse: true,
    });
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(await database.db.collection("auth_session").countDocuments()).toBe(
      sessionCount,
    );
  });
  it("does not expose broad admin plugin endpoints", async () => {
    const user = await signup();
    const headers = await signin(user);
    const response = await spike.auth.handler(
      new Request("http://localhost:3301/api/auth/admin/set-role", {
        method: "POST",
        headers,
      }),
    );
    expect(response.status).toBe(404);
    expect("setRole" in spike.auth.api).toBe(false);
  });
  it("returns the same reset response for existing and absent emails", async () => {
    const user = await signup();
    const existing = await spike.auth.api.requestPasswordReset({
      body: { email: user.email },
    });
    const missing = await spike.auth.api.requestPasswordReset({
      body: { email: randomUUID() + "@example.test" },
    });
    expect(existing).toEqual(missing);
  });
  it("cold adapter instances emit only the same reviewed index definitions", async () => {
    const another = createSpike(database);
    const user = await signup(another);
    await signin(user, another);
    await another.auth.api.requestPasswordReset({
      body: { email: user.email },
    });
    const canonical = (entry: Observed) =>
      JSON.stringify({
        collection: entry.collection,
        name: entry.name,
        key: entry.key,
        unique: entry.unique ?? false,
      });
    const unique = [...new Set(observed.map(canonical))].sort();
    expect(unique).toEqual(reviewed.runtimeCommands.map(canonical).sort());
    expect(
      observed.every((entry) =>
        authManifest.some((x) => x.collection === entry.collection),
      ),
    ).toBe(true);
    expect(
      observed.every((entry) =>
        Object.keys(entry).every((key) =>
          ["collection", "name", "key", "unique"].includes(key),
        ),
      ),
    ).toBe(true);
  });
});
