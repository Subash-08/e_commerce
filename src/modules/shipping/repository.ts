import "server-only";
import type { Db, ClientSession, ObjectId } from "mongodb";
import { z } from "zod";
import {
  shippingInput,
  type ShippingPolicy,
  type ShippingInput,
} from "./contracts";
import type { TaxFacts } from "../pricing/price";
import { calculateTax } from "../pricing/price";

const storedPolicy = shippingInput.safeExtend({
  key: z.literal("shipping"),
  revision: z.number().int().nonnegative(),
  schemaVersion: z.literal(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  updatedBy: z.string().min(1).max(200),
  taxReview: z
    .object({
      approved: z.boolean(),
      reviewReference: z.string().nullable(),
      reviewedAt: z.date().nullable(),
    })
    .strict(),
});
export function policyFields(value: ShippingPolicy): ShippingInput {
  return shippingInput.parse(
    Object.fromEntries(
      Object.keys(shippingInput.shape).map((key) => [
        key,
        value[key as keyof ShippingPolicy],
      ]),
    ),
  );
}
export async function readPolicy(
  db: Db,
  session?: ClientSession,
): Promise<ShippingPolicy | null> {
  const row = await db
    .collection("settings")
    .findOne({ key: "shipping" }, { session });
  if (!row) return null;
  const { _id, ...value } = row;
  void _id;
  const result = storedPolicy.safeParse(value);
  if (!result.success) throw new Error("SHIPPING_CONFIGURATION_REQUIRED");
  return result.data;
}
export async function writePolicy(
  db: Db,
  value: ShippingPolicy,
  previous: ShippingPolicy | null,
  session: ClientSession,
) {
  if (previous) {
    const result = await db
      .collection<ShippingPolicy>("settings")
      .replaceOne({ key: "shipping", revision: previous.revision }, value, {
        session,
      });
    if (result.matchedCount !== 1) throw new Error("REVISION_CONFLICT");
  } else
    await db
      .collection<ShippingPolicy>("settings")
      .insertOne(value, { session });
  await db.collection("auditLogs").insertOne(
    {
      actorType: "ACCOUNT",
      actorId: value.updatedBy,
      action: "SHIPPING_POLICY_SAVED",
      entityType: "settings",
      entityId: "shipping",
      before: previous,
      after: value,
      occurredAt: value.updatedAt,
      createdAt: value.updatedAt,
      schemaVersion: 1,
    },
    { session },
  );
}
export type ShippingTax = {
  key: string;
  facts: TaxFacts;
  approved: boolean;
  reviewReference: string | null;
  reviewedAt: Date | null;
};
export function parseTax(
  row: Record<string, unknown> | null,
  purpose: "SHIPPING" | "COD",
): ShippingTax | null {
  if (!row) return null;
  const schema = z.object({
    key: z.string().min(1),
    version: z.literal(1),
    schemaVersion: z.literal(1),
    mode: z.enum(["INCLUSIVE", "EXCLUSIVE", "EXEMPT"]),
    rateBps: z.number().int().min(0).max(10000),
    exemptionReason: z.string().optional(),
    deliveryReview: z
      .object({
        reference: z.string().trim().min(1),
        reviewedAt: z.date(),
        purposes: z.array(z.enum(["SHIPPING", "COD"])),
      })
      .optional(),
  });
  const result = schema.safeParse(row);
  if (!result.success) return null;
  const v = result.data;
  // Aggregate GST here; jurisdictional invoice splitting belongs to checkout tax facts.
  const facts: TaxFacts = {
    mode: v.mode,
    rateBps: v.rateBps,
    components: v.mode === "EXEMPT" ? [] : [{ key: "GST", rateBps: v.rateBps }],
    ...(v.exemptionReason ? { exemptionReason: v.exemptionReason } : {}),
  };
  try {
    calculateTax(0, facts);
  } catch {
    return null;
  }
  const review = v.deliveryReview;
  return {
    key: v.key,
    facts,
    approved:
      !!review &&
      review.purposes.includes(purpose) &&
      review.reviewedAt.getTime() <= Date.now(),
    reviewReference: review?.reference ?? null,
    reviewedAt: review?.reviewedAt ?? null,
  };
}
export async function readTax(
  db: Db,
  key: string | null,
  purpose: "SHIPPING" | "COD",
  session?: ClientSession,
) {
  return key
    ? parseTax(
        await db.collection("taxPolicies").findOne({ key }, { session }),
        purpose,
      )
    : null;
}
export async function taxChoices(db: Db) {
  const rows = await db
    .collection("taxPolicies")
    .find(
      {},
      {
        projection: {
          key: 1,
          version: 1,
          schemaVersion: 1,
          mode: 1,
          rateBps: 1,
          exemptionReason: 1,
          deliveryReview: 1,
        },
      },
    )
    .sort({ key: 1 })
    .limit(101)
    .toArray();
  if (rows.length > 100) throw new Error("SHIPPING_TAX_POLICY_LIMIT");
  return rows.flatMap((row) => {
    const parsed = parseTax(row, "SHIPPING");
    return parsed
      ? [
          {
            key: parsed.key,
            label: `${parsed.facts.mode} · ${parsed.facts.rateBps / 100}% · ${parsed.key}`,
            approved: parsed.approved,
            codApproved: parseTax(row, "COD")?.approved ?? false,
          },
        ]
      : [];
  });
}
export async function history(db: Db) {
  return db
    .collection<{ _id: ObjectId; after: ShippingPolicy }>("auditLogs")
    .find(
      {
        entityType: "settings",
        entityId: "shipping",
        action: "SHIPPING_POLICY_SAVED",
      },
      { projection: { after: 1 } },
    )
    .sort({ occurredAt: -1, _id: -1 })
    .limit(5)
    .toArray();
}
