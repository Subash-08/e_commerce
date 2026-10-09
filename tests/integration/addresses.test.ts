import { afterAll, beforeAll, expect, it } from "vitest";
import {
  createTestDatabaseContext,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import type { DatabaseHandle } from "../../src/server/db/connection";
import {
  persistSavedAddress,
  removeSavedAddress,
} from "../../src/modules/addresses/service";

let context: TestDatabaseContext;
let database: DatabaseHandle;
const actor = { authUserId: "address-owner-fixture", authVersion: 1 };
const input = {
  revision: 0,
  label: "Home",
  name: "Address Owner",
  mobile: "9876543210",
  line1: "12 Market Road",
  line2: "",
  landmark: "",
  city: "Chennai",
  district: "Chennai",
  stateCode: "TN",
  postalCode: "600001",
  countryCode: "IN",
  defaultShipping: false,
  defaultBilling: false,
};

beforeAll(async () => {
  context = await createTestDatabaseContext("addresses");
  for (const name of ["profiles", "auditLogs"])
    await context.createCollection(name);
  database = await context.createOwner().get();
  await database.db.collection("profiles").insertOne({
    ...actor,
    role: "CUSTOMER",
    status: "ACTIVE",
    revision: 0,
    schemaVersion: 1,
    addresses: [],
  });
});
afterAll(async () => {
  await context?.teardown();
});

it("keeps Atlas address writes owned, revised, bounded and atomic", async () => {
  const first = await persistSavedAddress(database, actor, input);
  expect(first).toHaveLength(1);
  expect(first[0]).toMatchObject({
    revision: 0,
    defaultShipping: true,
    defaultBilling: true,
  });
  const id = first[0]!.id;
  await expect(
    persistSavedAddress(
      database,
      { authUserId: "another-owner", authVersion: 1 },
      { ...input, label: "Attack" },
    ),
  ).rejects.toThrow("FORBIDDEN");

  const competing = await Promise.allSettled([
    persistSavedAddress(database, actor, {
      ...input,
      id,
      revision: 0,
      label: "Home A",
    }),
    persistSavedAddress(database, actor, {
      ...input,
      id,
      revision: 0,
      label: "Home B",
    }),
  ]);
  expect(
    competing.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const winner = competing.find(
    (
      result,
    ): result is PromiseFulfilledResult<
      Awaited<ReturnType<typeof persistSavedAddress>>
    > => result.status === "fulfilled",
  )!.value;
  expect(winner[0]!.revision).toBe(1);

  let addresses = winner;
  for (let number = 2; number <= 10; number++)
    addresses = await persistSavedAddress(database, actor, {
      ...input,
      label: "Address " + number,
      line1: number + " Market Road",
    });
  expect(addresses).toHaveLength(10);
  await expect(
    persistSavedAddress(database, actor, {
      ...input,
      label: "Overflow",
    }),
  ).rejects.toThrow("ADDRESS_LIMIT");

  const removed = await removeSavedAddress(database, actor, {
    id,
    revision: 1,
  });
  expect(removed).toHaveLength(9);
  expect(removed.filter((address) => address.defaultShipping)).toHaveLength(1);
  expect(removed.filter((address) => address.defaultBilling)).toHaveLength(1);
  expect(
    await database.db.collection("auditLogs").countDocuments({
      actorId: actor.authUserId,
      entityType: "profileAddress",
    }),
  ).toBe(12);
});
