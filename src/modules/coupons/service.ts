import "server-only";
import { ObjectId, type Db, type ClientSession } from "mongodb";
import {
  couponInput,
  eligibleKeys,
  type CouponInput,
  type CouponItemFacts,
} from "./contracts";
import type { CouponFacts } from "../pricing/price";
import { getIdentity } from "../identity/runtime";
import { getDatabase } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { rateLimit } from "../cart/security";

export type CouponRecord = Omit<CouponInput, "id"> & {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
  createdBy: string;
  updatedBy: string;
};
export async function couponPreview(
  db: Db,
  code: string,
  owner: string | null,
  items: CouponItemFacts[],
  session?: ClientSession,
): Promise<CouponFacts> {
  const row = await db
    .collection<CouponRecord>("coupons")
    .findOne(
      { code: code.trim().toUpperCase(), active: true, archived: false },
      { session },
    );
  if (
    !row ||
    Date.parse(row.startsAt) > Date.now() ||
    Date.parse(row.expiresAt) <= Date.now() ||
    (row.audience !== "EVERYONE" && !owner) ||
    (row.audience === "SPECIFIC" && !row.allowedUserIds.includes(owner ?? ""))
  )
    throw new Error("COUPON_UNAVAILABLE");
  // Read existing claims without creating or consuming them. Expired holds still occupy
  // capacity until checkout recovery explicitly releases them.
  const claims = db.collection("couponClaims");
  const occupied = { couponId: row._id, state: { $in: ["HELD", "CONSUMED"] } };
  if (
    row.usageLimit !== null &&
    (await claims.countDocuments(occupied, {
      session,
      limit: row.usageLimit,
    })) >= row.usageLimit
  )
    throw new Error("COUPON_UNAVAILABLE");
  if (
    row.perAccountLimit !== null &&
    (!owner ||
      (await claims.countDocuments(
        { ...occupied, authUserId: owner },
        { session, limit: row.perAccountLimit },
      )) >= row.perAccountLimit)
  )
    throw new Error("COUPON_UNAVAILABLE");
  let targetIds = [...row.targetIds];
  if (row.scope === "CATEGORY" && row.includeDescendants) {
    const categories = await db
      .collection("categories")
      .find({}, { session, projection: { parentId: 1 } })
      .limit(1001)
      .toArray();
    if (categories.length > 1000) throw new Error("COUPON_CATEGORY_LIMIT");
    const selected = new Set(targetIds);
    for (let n = 0; n < categories.length; n++) {
      const before = selected.size;
      for (const c of categories)
        if (selected.has(String(c.parentId))) selected.add(String(c._id));
      if (before === selected.size) break;
    }
    targetIds = [...selected];
  }
  return {
    code: row.code,
    revision: String(row.revision),
    kind: row.kind,
    value: row.value,
    active: true,
    capacityAvailable: true,
    startsAt: Date.parse(row.startsAt),
    expiresAt: Date.parse(row.expiresAt),
    eligibleLineKeys: eligibleKeys({ ...row, targetIds }, items),
    minEligiblePaise: row.minEligiblePaise,
    ...(row.maxDiscountPaise !== null
      ? { maxDiscountPaise: row.maxDiscountPaise }
      : {}),
  };
}
export async function saveCoupon(headers: Headers, input: unknown) {
  const actor = await (
    await getIdentity()
  ).requireAccess(headers, "coupon.manage");
  const value = couponInput.parse(input);
  const database = await getDatabase();
  await rateLimit(database.db, "coupon-admin:" + actor.authUserId, 30);
  const id = value.id ? new ObjectId(value.id) : new ObjectId();
  await transaction(async (session) => {
    const profile = await database.db.collection("profiles").findOne(
      {
        authUserId: actor.authUserId,
        role: "ADMIN",
        status: "ACTIVE",
        authVersion: actor.authVersion,
      },
      { session },
    );
    if (!profile) throw new Error("FORBIDDEN");
    const collection = database.db.collection<CouponRecord>("coupons");
    const prior = await collection.findOne({ _id: id }, { session });
    if (value.id && (!prior || prior.revision !== value.revision))
      throw new Error("REVISION_CONFLICT");
    if (prior && prior.code !== value.code)
      throw new Error("COUPON_CODE_IMMUTABLE");
    if (prior?.archived) throw new Error("COUPON_ARCHIVED");
    const targetCollection = {
      PRODUCT: "products",
      VARIANT: "variants",
      CATEGORY: "categories",
      BRAND: "brands",
      ALL: "products",
    }[value.scope];
    if (
      value.targetIds.length &&
      (await database.db
        .collection(targetCollection)
        .countDocuments(
          { _id: { $in: value.targetIds.map((v) => new ObjectId(v)) } },
          { session },
        )) !== value.targetIds.length
    )
      throw new Error("COUPON_TARGET_INVALID");
    if (
      value.excludedProductIds.length &&
      (await database.db.collection("products").countDocuments(
        {
          _id: { $in: value.excludedProductIds.map((v) => new ObjectId(v)) },
        },
        { session },
      )) !== value.excludedProductIds.length
    )
      throw new Error("COUPON_TARGET_INVALID");
    if (
      value.allowedUserIds.length &&
      (await database.db
        .collection("profiles")
        .countDocuments(
          { authUserId: { $in: value.allowedUserIds }, status: "ACTIVE" },
          { session },
        )) !== new Set(value.allowedUserIds).size
    )
      throw new Error("COUPON_ACCOUNT_INVALID");
    const { id: ignored, ...fields } = value;
    void ignored;
    const record: CouponRecord = {
      ...fields,
      _id: id,
      revision: (prior?.revision ?? -1) + 1,
      schemaVersion: 1,
      createdAt: prior?.createdAt ?? new Date(),
      updatedAt: new Date(),
      createdBy: prior?.createdBy ?? actor.authUserId,
      updatedBy: actor.authUserId,
    };
    if (prior)
      await collection.replaceOne(
        { _id: id, revision: prior.revision },
        record,
        { session },
      );
    else await collection.insertOne(record, { session });
    await database.db.collection("auditLogs").insertOne(
      {
        actorType: "ACCOUNT",
        actorId: actor.authUserId,
        action: prior ? "COUPON_UPDATED" : "COUPON_CREATED",
        entityType: "coupon",
        entityId: String(id),
        before: prior
          ? { revision: prior.revision, active: prior.active }
          : null,
        after: {
          revision: record.revision,
          active: value.active,
          archived: value.archived,
        },
        occurredAt: new Date(),
        createdAt: new Date(),
        schemaVersion: 1,
      },
      { session },
    );
  }, database);
  return String(id);
}
