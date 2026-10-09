import "server-only";
import { randomUUID } from "node:crypto";
import type { ClientSession, Db, ObjectId } from "mongodb";
import { z } from "zod";
import { getDatabase, type DatabaseHandle } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { getIdentity } from "../identity/runtime";
import { rateLimit } from "../cart/security";
import { savedAddressInput, type SavedAddressDto } from "./contracts";

const MAX_ADDRESSES = 10;
export type AddressActor = { authUserId: string; authVersion: number };
const storedAddress = savedAddressInput
  .extend({
    id: z.uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict();
type StoredAddress = z.infer<typeof storedAddress>;

function parseAddresses(value: unknown): StoredAddress[] {
  return z
    .array(storedAddress)
    .max(MAX_ADDRESSES)
    .parse(value ?? []);
}
function dto(value: StoredAddress): SavedAddressDto {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
async function actor(requestHeaders: Headers) {
  const identity = await getIdentity();
  const auth = await identity.auth.api.getSession({ headers: requestHeaders });
  if (!auth) throw new Error("AUTH_REQUIRED");
  const authority = await identity.requireAccess(
    requestHeaders,
    "profile.own",
    auth.user.id,
  );
  return { authority, database: await getDatabase() };
}
async function profile(
  database: DatabaseHandle,
  authUserId: string,
  authVersion: number,
  session?: ClientSession,
) {
  const row = await database.db.collection("profiles").findOne(
    {
      authUserId,
      authVersion,
      status: "ACTIVE",
    },
    { session, projection: { addresses: 1, revision: 1 } },
  );
  if (!row) throw new Error("FORBIDDEN");
  return row;
}
async function persist(
  db: Db,
  profileId: ObjectId,
  profileRevision: number,
  addresses: StoredAddress[],
  session: ClientSession,
) {
  const result = await db
    .collection("profiles")
    .updateOne(
      { _id: profileId, revision: profileRevision },
      { $set: { addresses, updatedAt: new Date() }, $inc: { revision: 1 } },
      { session },
    );
  if (result.matchedCount !== 1) throw new Error("REVISION_CONFLICT");
}
function normalizeDefaults(addresses: StoredAddress[]) {
  if (addresses.length && !addresses.some((item) => item.defaultShipping))
    addresses[0] = { ...addresses[0]!, defaultShipping: true };
  if (addresses.length && !addresses.some((item) => item.defaultBilling))
    addresses[0] = { ...addresses[0]!, defaultBilling: true };
  return addresses;
}
export async function loadSavedAddresses(requestHeaders: Headers) {
  const { authority, database } = await actor(requestHeaders);
  const row = await profile(
    database,
    authority.authUserId,
    authority.authVersion,
  );
  return parseAddresses(row.addresses).map(dto);
}
export async function saveSavedAddress(requestHeaders: Headers, raw: unknown) {
  const { authority, database } = await actor(requestHeaders);
  await rateLimit(database.db, "address-write:" + authority.authUserId, 30);
  return persistSavedAddress(database, authority, raw);
}
export async function persistSavedAddress(
  database: DatabaseHandle,
  authority: AddressActor,
  raw: unknown,
) {
  const input = savedAddressInput.parse(raw);
  return transaction(async (session) => {
    const row = await profile(
      database,
      authority.authUserId,
      authority.authVersion,
      session,
    );
    const addresses = parseAddresses(row.addresses);
    const index = input.id
      ? addresses.findIndex((item) => item.id === input.id)
      : -1;
    if (input.id && index < 0) throw new Error("ADDRESS_NOT_FOUND");
    if (index >= 0 && addresses[index]!.revision !== input.revision)
      throw new Error("ADDRESS_CHANGED");
    if (!input.id && addresses.length >= MAX_ADDRESSES)
      throw new Error("ADDRESS_LIMIT");
    const now = new Date();
    const prior = index >= 0 ? addresses[index]! : null;
    const record: StoredAddress = {
      ...input,
      id: input.id ?? randomUUID(),
      revision: (prior?.revision ?? -1) + 1,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    };
    if (!addresses.length) {
      record.defaultShipping = true;
      record.defaultBilling = true;
    }
    let next =
      index >= 0
        ? addresses.map((item, position) =>
            position === index ? record : item,
          )
        : [...addresses, record];
    if (record.defaultShipping)
      next = next.map((item) => ({
        ...item,
        defaultShipping: item.id === record.id,
      }));
    if (record.defaultBilling)
      next = next.map((item) => ({
        ...item,
        defaultBilling: item.id === record.id,
      }));
    normalizeDefaults(next);
    await persist(
      database.db,
      row._id,
      Number(row.revision ?? 0),
      next,
      session,
    );
    await database.db.collection("auditLogs").insertOne(
      {
        actorType: "ACCOUNT",
        actorId: authority.authUserId,
        action: prior ? "ADDRESS_UPDATED" : "ADDRESS_CREATED",
        entityType: "profileAddress",
        entityId: record.id,
        before: prior,
        after: record,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
      },
      { session },
    );
    return next.map(dto);
  }, database);
}
export async function deleteSavedAddress(
  requestHeaders: Headers,
  raw: unknown,
) {
  const { authority, database } = await actor(requestHeaders);
  await rateLimit(database.db, "address-write:" + authority.authUserId, 30);
  return removeSavedAddress(database, authority, raw);
}
export async function removeSavedAddress(
  database: DatabaseHandle,
  authority: AddressActor,
  raw: unknown,
) {
  const input = z
    .object({ id: z.uuid(), revision: z.number().int().min(0) })
    .strict()
    .parse(raw);
  return transaction(async (session) => {
    const row = await profile(
      database,
      authority.authUserId,
      authority.authVersion,
      session,
    );
    const addresses = parseAddresses(row.addresses);
    const prior = addresses.find((item) => item.id === input.id);
    if (!prior) throw new Error("ADDRESS_NOT_FOUND");
    if (prior.revision !== input.revision) throw new Error("ADDRESS_CHANGED");
    const next = normalizeDefaults(
      addresses.filter((item) => item.id !== input.id),
    );
    await persist(
      database.db,
      row._id,
      Number(row.revision ?? 0),
      next,
      session,
    );
    const now = new Date();
    await database.db.collection("auditLogs").insertOne(
      {
        actorType: "ACCOUNT",
        actorId: authority.authUserId,
        action: "ADDRESS_DELETED",
        entityType: "profileAddress",
        entityId: prior.id,
        before: prior,
        after: null,
        occurredAt: now,
        createdAt: now,
        schemaVersion: 1,
      },
      { session },
    );
    return next.map(dto);
  }, database);
}
