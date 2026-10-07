import "server-only";
import { type Filter, type Sort } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import { brandModel, type BrandRecord } from "./model";

export interface BrandListQuery {
  search?: string;
  status?: "current" | "active" | "inactive" | "archived" | "all";
  featured?: "featured" | "standard";
  sort?: "order" | "name" | "updated";
  page?: number;
}

function escapeRegex(value: string) {
  const special = ".*+?^$" + "{}()|[]\\";
  return Array.from(value, (character) =>
    special.includes(character) ? "\\" + character : character,
  ).join("");
}

export function brandRepository(database: DatabaseHandle) {
  const model = brandModel(database.mongoose);
  return {
    model,
    bySlug: (slug: string) =>
      model.findOne({ slug, active: true, archivedAt: null }).lean().exec(),
    async editorData(id?: string) {
      const row = id ? await model.findById(id).lean().exec() : null;
      return { row };
    },
    async adminPage(input: BrandListQuery) {
      const page = Math.max(1, Math.min(10000, Math.floor(input.page ?? 1)));
      const filter: Filter<BrandRecord> = {};
      const status = input.status ?? "current";
      if (status === "current") filter.archivedAt = null;
      if (status === "active") {
        filter.archivedAt = null;
        filter.active = true;
      }
      if (status === "inactive") {
        filter.archivedAt = null;
        filter.active = false;
      }
      if (status === "archived") filter.archivedAt = { $ne: null };
      if (input.featured === "featured") filter.featured = true;
      if (input.featured === "standard") filter.featured = false;
      const search = input.search
        ?.trim()
        .normalize("NFKC")
        .toLocaleLowerCase("en-US")
        .slice(0, 100);
      if (search) {
        const escaped = escapeRegex(search);
        filter.$or = [
          { nameNormalized: { $regex: "^" + escaped } },
          { slug: { $regex: "^" + escapeRegex(search.replace(/\s+/g, "-")) } },
        ];
      }
      const sort: Sort =
        input.sort === "name"
          ? { nameNormalized: 1, _id: 1 }
          : input.sort === "updated"
            ? { updatedAt: -1, _id: -1 }
            : { displayOrder: 1, _id: 1 };
      const [rows, total] = await Promise.all([
        model
          .find(filter)
          .sort(sort)
          .skip((page - 1) * 20)
          .limit(20)
          .lean()
          .exec(),
        model.countDocuments(filter).exec(),
      ]);
      return { rows, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
    },
  };
}
