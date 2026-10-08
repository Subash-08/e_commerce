import { beforeAll, afterAll, it, expect } from "vitest";
import {
  createTestDatabaseContext,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import type { DatabaseHandle } from "../../src/server/db/connection";
import { applyIndexes } from "../../src/server/db/indexes";
import { shippingIndexes } from "../../src/modules/shipping/indexes";
import {
  persistShipping,
  resolveShipping,
} from "../../src/modules/shipping/service";
import { readPolicy } from "../../src/modules/shipping/repository";
import { shippingFixture as policy, destination } from "../fixtures/shipping";
let context: TestDatabaseContext, database: DatabaseHandle;
const actor = { authUserId: "shipping-admin-fixture", authVersion: 1 };
beforeAll(async () => {
  context = await createTestDatabaseContext("shipping");
  for (const name of ["settings", "profiles", "taxPolicies", "auditLogs"])
    await context.createCollection(name);
  database = await context.createOwner().get();
  await applyIndexes(database.db, shippingIndexes, { dryRun: false });
  await database.db
    .collection("profiles")
    .insertOne({ ...actor, role: "ADMIN", status: "ACTIVE" });
  await database.db.collection("taxPolicies").insertOne({
    key: "fixture-shipping",
    mode: "INCLUSIVE",
    rateBps: 1800,
    version: 1,
    schemaVersion: 1,
  });
});
afterAll(async () => {
  await context?.teardown();
});
it("real Atlas commits settings and audit atomically, rejects races and unauthorized/invalid updates", async () => {
  expect(await resolveShipping(database, destination)).toMatchObject({
    ok: false,
    issue: "SHIPPING_CONFIGURATION_REQUIRED",
  });
  for (const role of ["STAFF", "CUSTOMER"]) {
    await database.db
      .collection("profiles")
      .updateOne({ authUserId: actor.authUserId }, { $set: { role } });
    await expect(persistShipping(database, actor, policy, -1)).rejects.toThrow(
      "FORBIDDEN",
    );
  }
  await database.db
    .collection("profiles")
    .updateOne({ authUserId: actor.authUserId }, { $set: { role: "ADMIN" } });
  await expect(
    persistShipping(database, { ...actor, authVersion: 0 }, policy, -1),
  ).rejects.toThrow("FORBIDDEN");
  expect(await persistShipping(database, actor, policy, -1)).toEqual({
    revision: 0,
    taxApproved: false,
  });
  expect(await resolveShipping(database, destination)).toMatchObject({
    ok: false,
    issue: "SHIPPING_TAX_REVIEW_REQUIRED",
  });
  await expect(
    persistShipping(
      database,
      actor,
      { ...policy, standardChargePaise: -100 },
      0,
    ),
  ).rejects.toThrow();
  const results = await Promise.allSettled([
    persistShipping(
      database,
      actor,
      { ...policy, standardChargePaise: 9000 },
      0,
    ),
    persistShipping(
      database,
      actor,
      { ...policy, standardChargePaise: 10000 },
      0,
    ),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const saved = await readPolicy(database.db);
  expect(saved?.revision).toBe(1);
  const audits = await database.db
    .collection("auditLogs")
    .find({ entityId: "shipping" })
    .sort({ occurredAt: 1 })
    .toArray();
  expect(audits).toHaveLength(2);
  expect(audits[1].before.standardChargePaise).toBe(8000);
  expect(audits[1].after.standardChargePaise).toBe(saved!.standardChargePaise);
  expect(audits[1].actorId).toBe(actor.authUserId);
  await database.db
    .collection("profiles")
    .updateOne(
      { authUserId: actor.authUserId },
      { $set: { status: "DISABLED" } },
    );
  await expect(persistShipping(database, actor, policy, 1)).rejects.toThrow(
    "FORBIDDEN",
  );
  await database.db
    .collection("settings")
    .updateOne({ key: "shipping" }, { $set: { schemaVersion: 2 } });
  await expect(readPolicy(database.db)).rejects.toThrow(
    "SHIPPING_CONFIGURATION_REQUIRED",
  );
});
