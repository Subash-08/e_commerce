import { afterAll, beforeAll, expect, it } from "vitest";
import {
  createTestDatabaseContext,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import type { DatabaseHandle } from "../../src/server/db/connection";
import { readOwnedCheckoutQuote } from "../../src/modules/checkout/service";

let context: TestDatabaseContext;
let database: DatabaseHandle;
const activeId = "11111111-1111-4111-8111-111111111111";
const expiredId = "22222222-2222-4222-8222-222222222222";
const owner = "owner-hash-fixture-1234567890";

beforeAll(async () => {
  context = await createTestDatabaseContext("checkout-quotes");
  await context.createCollection("checkoutQuotes");
  database = await context.createOwner().get();
  await database.db.collection("checkoutQuotes").insertMany([
    {
      quoteId: activeId,
      ownerKeyHash: owner,
      expiresAt: new Date("2026-10-09T01:00:00.000Z"),
      schemaVersion: 1,
    },
    {
      quoteId: expiredId,
      ownerKeyHash: owner,
      expiresAt: new Date("2026-10-08T23:00:00.000Z"),
      schemaVersion: 1,
    },
  ]);
});
afterAll(async () => {
  await context?.teardown();
});

it("binds quote reads to one owner and enforces expiry independent of TTL cleanup", async () => {
  await expect(
    readOwnedCheckoutQuote(
      database.db,
      activeId,
      owner,
      new Date("2026-10-09T00:30:00.000Z"),
    ),
  ).resolves.toMatchObject({ quoteId: activeId, ownerKeyHash: owner });
  await expect(
    readOwnedCheckoutQuote(
      database.db,
      activeId,
      "different-owner-hash-1234567890",
      new Date("2026-10-09T00:30:00.000Z"),
    ),
  ).rejects.toThrow("QUOTE_NOT_FOUND");
  await expect(
    readOwnedCheckoutQuote(
      database.db,
      expiredId,
      owner,
      new Date("2026-10-09T00:30:00.000Z"),
    ),
  ).rejects.toThrow("QUOTE_EXPIRED");
});
