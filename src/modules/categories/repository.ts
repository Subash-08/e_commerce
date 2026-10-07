import "server-only";
import { ObjectId, type ClientSession, type Filter, type Sort } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import { categoryModel, type CategoryRecord } from "./model";

export interface CategoryListQuery {
  search?: string;
  status?: "current" | "active" | "inactive" | "archived" | "all";
  parentId?: string | "root";
  sort?: "order" | "name" | "updated";
  page?: number;
}

export function categoryRepository(database: DatabaseHandle) {
  const model = categoryModel(database.mongoose);
  return {
    model,
    all: (session?: ClientSession) =>
      model
        .find({})
        .sort({ displayOrder: 1, _id: 1 })
        .limit(1001)
        .session(session ?? null)
        .lean()
        .exec(),
    byId: (id: string, session: ClientSession) =>
      model.findById(id).session(session).lean().exec(),
    bySlug: (slug: string) =>
      model.findOne({ slug, active: true, archivedAt: null }).lean().exec(),
    async editorData(id?: string) {
      const [row, options] = await Promise.all([
        id ? model.findById(id).lean().exec() : Promise.resolve(null),
        model
          .find({ archivedAt: null })
          .select("name active parentId")
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(1001)
          .lean()
          .exec(),
      ]);
      return { row, options };
    },
    async adminPage(input: CategoryListQuery) {
      const page = Math.max(1, Math.min(10_000, Math.floor(input.page ?? 1)));
      const filter: Filter<CategoryRecord> = {};
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
      if (input.parentId === "root") filter.parentId = null;
      else if (input.parentId) filter.parentId = new ObjectId(input.parentId);
      const search = input.search
        ?.trim()
        .normalize("NFKC")
        .toLocaleLowerCase("en-US")
        .slice(0, 100);
      if (search) {
        const escaped = search.replace(/[.*+?^()|[\]\\]/g, "\\$&");
        filter.$or = [
          { nameNormalized: { $regex: "^" + escaped } },
          { slug: { $regex: "^" + escaped.replace(/\s+/g, "-") } },
        ];
      }
      const sort: Sort =
        input.sort === "name"
          ? { nameNormalized: 1, _id: 1 }
          : input.sort === "updated"
            ? { updatedAt: -1, _id: -1 }
            : { displayOrder: 1, _id: 1 };
      const [rows, total, options] = await Promise.all([
        model
          .find(filter)
          .sort(sort)
          .skip((page - 1) * 20)
          .limit(20)
          .lean()
          .exec(),
        model.countDocuments(filter).exec(),
        model
          .find({ archivedAt: null })
          .select("name active parentId")
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(1001)
          .lean()
          .exec(),
      ]);
      return {
        rows,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / 20)),
        options,
      };
    },
  };
}
