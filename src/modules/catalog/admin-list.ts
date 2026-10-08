import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { getDatabase } from "../../server/db/connection";
import { getIdentity } from "../identity/runtime";
import { catalogRepository, type ProductRecord } from "./repository";
export async function listAdminProducts(
  headers: Headers,
  input: {
    search: string;
    status: string;
    brand: string;
    category: string;
    page: number;
  },
) {
  await (await getIdentity()).requireAccess(headers, "catalog.manage");
  const database = await getDatabase();
  const repo = catalogRepository(database);
  const filter: Filter<ProductRecord> = {};
  if (["DRAFT", "ACTIVE", "ARCHIVED"].includes(input.status))
    filter.status = input.status as ProductRecord["status"];
  if (/^[a-f0-9]{24}$/.test(input.brand))
    filter.brandId = new ObjectId(input.brand);
  if (/^[a-f0-9]{24}$/.test(input.category))
    filter.categoryIds = new ObjectId(input.category);
  if (input.search.trim())
    filter.nameNormalized = {
      $regex:
        "^" +
        input.search
          .trim()
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    };
  const total = await repo.products.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(pages, Math.max(1, input.page));
  const [rows, brands, categories] = await Promise.all([
    repo.products
      .find(filter, {
        projection: {
          name: 1,
          slug: 1,
          brandId: 1,
          status: 1,
          listing: 1,
          updatedAt: 1,
        },
      })
      .sort(
        input.search.trim()
          ? { nameNormalized: 1, _id: 1 }
          : { updatedAt: -1, _id: -1 },
      )
      .skip((page - 1) * 20)
      .limit(20)
      .toArray(),
    database.db
      .collection("brands")
      .find({}, { projection: { name: 1 } })
      .sort({ nameNormalized: 1 })
      .limit(1000)
      .toArray(),
    database.db
      .collection("categories")
      .find({}, { projection: { name: 1 } })
      .sort({ nameNormalized: 1 })
      .limit(1000)
      .toArray(),
  ]);
  return { rows, brands, categories, total, pages, page };
}
