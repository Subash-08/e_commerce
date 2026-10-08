import "server-only";
import { z } from "zod";
import type { DatabaseHandle } from "../../server/db/connection";
import { getDatabase } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { getIdentity } from "../identity/runtime";
import { rateLimit } from "../cart/security";
import { shippingInput, previewInput } from "./contracts";
import { calculateShipping } from "./calculator";
import {
  readPolicy,
  writePolicy,
  readTax,
  taxChoices,
  history,
  policyFields,
} from "./repository";

export type ShippingActor = { authUserId: string; authVersion: number };
// Also checked inside the transaction, so old cookies cannot retain admin authority.
async function authority(
  database: DatabaseHandle,
  actor: ShippingActor,
  session?: import("mongodb").ClientSession,
) {
  const profile = await database.db.collection("profiles").findOne(
    {
      authUserId: actor.authUserId,
      authVersion: actor.authVersion,
      role: "ADMIN",
      status: "ACTIVE",
    },
    { session, projection: { _id: 1 } },
  );
  if (!profile) throw new Error("FORBIDDEN");
}
export async function persistShipping(
  database: DatabaseHandle,
  actor: ShippingActor,
  input: unknown,
  revision: unknown,
) {
  const value = shippingInput.parse(input);
  const expected = z
    .number()
    .int()
    .min(-1)
    .max(Number.MAX_SAFE_INTEGER - 1)
    .parse(revision);
  return transaction(async (session) => {
    await authority(database, actor, session);
    const prior = await readPolicy(database.db, session);
    if ((prior?.revision ?? -1) !== expected)
      throw new Error("REVISION_CONFLICT");
    const shippingTax = await readTax(
      database.db,
      value.shippingTaxPolicyKey,
      "SHIPPING",
      session,
    );
    const codTax = await readTax(
      database.db,
      value.cod.surchargeTaxPolicyKey,
      "COD",
      session,
    );
    if (
      (value.shippingTaxPolicyKey && !shippingTax) ||
      (value.cod.surchargeTaxPolicyKey && !codTax)
    )
      throw new Error("SHIPPING_TAX_CONFIGURATION_REQUIRED");
    const now = new Date();
    const next = {
      ...value,
      key: "shipping" as const,
      schemaVersion: 1 as const,
      revision: expected + 1,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
      updatedBy: actor.authUserId,
      taxReview: {
        approved:
          !!shippingTax?.approved &&
          (!value.cod.enabled ||
            value.cod.surchargePaise === 0 ||
            !!codTax?.approved),
        reviewReference: shippingTax?.reviewReference ?? null,
        reviewedAt: shippingTax?.reviewedAt ?? null,
      },
    };
    await writePolicy(database.db, next, prior, session);
    return { revision: next.revision, taxApproved: next.taxReview.approved };
  }, database);
}
async function admin(requestHeaders: Headers) {
  const actor = await (
    await getIdentity()
  ).requireAccess(requestHeaders, "settings.manage");
  const database = await getDatabase();
  await authority(database, actor);
  return { actor, database };
}
export async function loadShippingAdmin(requestHeaders: Headers) {
  const { database } = await admin(requestHeaders);
  const policy = await readPolicy(database.db);
  const choices = await taxChoices(database.db);
  const rows = await history(database.db);
  return {
    value: policy ? policyFields(policy) : null,
    revision: policy?.revision ?? -1,
    taxApproved: policy?.taxReview.approved ?? false,
    taxReviewReference: policy?.taxReview.reviewReference ?? null,
    taxReviewedAt: policy?.taxReview.reviewedAt?.toISOString() ?? null,
    choices,
    history: rows.map((r) => ({
      revision: r.after.revision,
      updatedAt: r.after.updatedAt.toISOString(),
      value: policyFields(r.after),
    })),
  };
}
export async function saveShipping(
  requestHeaders: Headers,
  input: unknown,
  revision: unknown,
) {
  const { actor, database } = await admin(requestHeaders);
  await rateLimit(database.db, "shipping-admin:" + actor.authUserId, 30);
  return persistShipping(database, actor, input, revision);
}
export async function previewShipping(
  requestHeaders: Headers,
  input: unknown,
  destination: unknown,
) {
  const { actor, database } = await admin(requestHeaders);
  await rateLimit(database.db, "shipping-preview:" + actor.authUserId, 60);
  const policy = shippingInput.parse(input);
  const facts = previewInput.parse(destination);
  const shipping = await readTax(
    database.db,
    policy.shippingTaxPolicyKey,
    "SHIPPING",
  );
  const cod = await readTax(
    database.db,
    policy.cod.surchargeTaxPolicyKey,
    "COD",
  );
  return calculateShipping(
    policy,
    facts,
    { shipping, cod },
    { estimate: true },
  );
}
// Internal server-only boundary: merchandise amount must come from the pricing engine.
// No browser endpoint accepts an amount as authoritative for orders or payments.
export async function resolveShipping(
  database: DatabaseHandle,
  destination: unknown,
) {
  const policy = await readPolicy(database.db);
  if (!policy)
    return { ok: false as const, issue: "SHIPPING_CONFIGURATION_REQUIRED" };
  const shipping = await readTax(
    database.db,
    policy.shippingTaxPolicyKey,
    "SHIPPING",
  );
  const cod = await readTax(
    database.db,
    policy.cod.surchargeTaxPolicyKey,
    "COD",
  );
  return {
    ...calculateShipping(
      policyFields(policy),
      previewInput.parse(destination),
      { shipping, cod },
    ),
    revision: policy.revision,
  };
}
