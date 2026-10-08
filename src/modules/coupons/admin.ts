import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { getIdentity } from "../identity/runtime";
import { getDatabase } from "../../server/db/connection";
import type { CouponRecord } from "./service";
import type { CouponInput } from "./contracts";
export type CouponChoices = Record<
  "PRODUCT" | "VARIANT" | "CATEGORY" | "BRAND",
  { id: string; name: string }[]
>;
export async function listCoupons(
  headers: Headers,
  search: string,
  archived: boolean,
  page: number,
) {
  await (await getIdentity()).requireAccess(headers, "coupon.manage");
  const { db } = await getDatabase();
  const filter: Filter<CouponRecord> = { archived };
  if (search)
    filter.code = {
      $regex:
        "^" +
        search
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, "")
          .slice(0, 20),
    };
  const collection = db.collection<CouponRecord>("coupons");
  const total = await collection.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / 20));
  const current = Math.min(pages, page);
  const rows = await collection
    .find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((current - 1) * 20)
    .limit(20)
    .toArray();
  return {
    rows: rows.map((row) => ({
      id: String(row._id),
      code: row.code,
      name: row.name,
      kind: row.kind,
      value: row.value,
      scope: row.scope,
      status: row.archived
        ? "Archived"
        : !row.active
          ? "Inactive"
          : Date.parse(row.expiresAt) <= Date.now()
            ? "Expired"
            : Date.parse(row.startsAt) > Date.now()
              ? "Scheduled"
              : "Active",
    })),
    page: current,
    pages,
    total,
  };
}
export async function couponEditor(headers: Headers, id?: string) {
  await (await getIdentity()).requireAccess(headers, "coupon.manage");
  const { db } = await getDatabase();
  if (id && !/^[a-f0-9]{24}$/.test(id)) throw new Error("COUPON_NOT_FOUND");
  const row = id
    ? await db
        .collection<CouponRecord>("coupons")
        .findOne({ _id: new ObjectId(id) })
    : null;
  if (id && !row) throw new Error("COUPON_NOT_FOUND");
  const choices: CouponChoices = {
    PRODUCT: [],
    VARIANT: [],
    CATEGORY: [],
    BRAND: [],
  };
  for (const [scope, collection] of Object.entries({
    PRODUCT: "products",
    VARIANT: "variants",
    CATEGORY: "categories",
    BRAND: "brands",
  })) {
    const rows = await db
      .collection(collection)
      .find({}, { projection: { name: 1, title: 1, sku: 1 } })
      .sort({ name: 1, title: 1, _id: 1 })
      .limit(1001)
      .toArray();
    if (rows.length > 1000) throw new Error("COUPON_CATALOG_LIMIT");
    choices[scope as keyof CouponChoices] = rows.map((r) => ({
      id: String(r._id),
      name: String(r.name ?? `${r.title} · ${r.sku}`),
    }));
  }
  let value: CouponInput | null = null;
  if (row) {
    value = {
      id: String(row._id),
      revision: row.revision,
      code: row.code,
      name: row.name,
      description: row.description,
      kind: row.kind,
      value: row.value,
      maxDiscountPaise: row.maxDiscountPaise,
      minEligiblePaise: row.minEligiblePaise,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
      active: row.active,
      archived: row.archived,
      scope: row.scope,
      targetIds: row.targetIds,
      excludedProductIds: row.excludedProductIds,
      includeDescendants: row.includeDescendants,
      excludeSaleItems: row.excludeSaleItems,
      audience: row.audience,
      allowedUserIds: row.allowedUserIds,
      usageLimit: row.usageLimit,
      perAccountLimit: row.perAccountLimit,
    };
  }
  return { value, choices };
}
