import "server-only";
import { ObjectId } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { DomainError } from "../../shared/domain/errors";
import { categoryInput } from "./validation";
import { categoryRepository, type CategoryListQuery } from "./repository";

export function categoryService(
  database: DatabaseHandle,
  access: (headers: Headers) => Promise<{ authUserId: string }>,
) {
  const repo = categoryRepository(database);
  return {
    async list(headers: Headers, query: CategoryListQuery = {}) {
      await access(headers);
      const result = await repo.adminPage(query);
      if (result.options.length > 1000) throw new DomainError("CATEGORY_LIMIT");
      const mediaIds = result.rows
        .flatMap((row) => [row.thumbnailId, row.bannerId])
        .filter((id): id is NonNullable<typeof id> => !!id);
      const assets = mediaIds.length
        ? await database.db
            .collection("mediaAssets")
            .find(
              {
                _id: { $in: mediaIds.map((id) => new ObjectId(id.toString())) },
              },
              { projection: { secureUrl: 1, alt: 1 } },
            )
            .toArray()
        : [];
      const media = new Map(
        assets.map((asset) => [
          asset._id.toString(),
          {
            id: asset._id.toString(),
            secureUrl: String(asset.secureUrl),
            alt: String(asset.alt ?? ""),
          },
        ]),
      );
      const rows = result.rows.map((row) => ({
        id: row._id.toString(),
        name: row.name,
        slug: row.slug,
        parentId: row.parentId?.toString() ?? null,
        description: row.description,
        active: row.active,
        featured: row.featured,
        archived: !!row.archivedAt,
        deactivationReason: row.deactivationReason,
        displayOrder: row.displayOrder,
        revision: row.revision,
        thumbnailId: row.thumbnailId?.toString() ?? null,
        bannerId: row.bannerId?.toString() ?? null,
        thumbnail: media.get(row.thumbnailId?.toString() ?? "") ?? null,
        banner: media.get(row.bannerId?.toString() ?? "") ?? null,
        seo: {
          title: row.seo?.title ?? "",
          description: row.seo?.description ?? "",
          canonicalPath: row.seo?.canonicalPath ?? "",
          robotsIndex: row.seo?.robotsIndex ?? true,
          robotsFollow: row.seo?.robotsFollow ?? true,
        },
        updatedAt: row.updatedAt.toISOString(),
      }));
      return {
        rows,
        total: result.total,
        page: result.page,
        pages: result.pages,
        options: result.options.map((option) => ({
          id: option._id.toString(),
          name: option.name,
          active: option.active,
          parentId: option.parentId?.toString() ?? null,
        })),
      };
    },
    async editorData(headers: Headers, id?: string) {
      await access(headers);
      if (id && !/^[a-f0-9]{24}$/.test(id))
        throw new DomainError("CATEGORY_NOT_FOUND");
      const result = await repo.editorData(id);
      if (result.options.length > 1000) throw new DomainError("CATEGORY_LIMIT");
      if (id && !result.row) throw new DomainError("CATEGORY_NOT_FOUND");
      const row = result.row;
      const mediaIds = row
        ? [row.thumbnailId, row.bannerId].filter(
            (mediaId): mediaId is NonNullable<typeof mediaId> => !!mediaId,
          )
        : [];
      const assets = mediaIds.length
        ? await database.db
            .collection("mediaAssets")
            .find(
              {
                _id: {
                  $in: mediaIds.map(
                    (mediaId) => new ObjectId(mediaId.toString()),
                  ),
                },
              },
              { projection: { secureUrl: 1, alt: 1 } },
            )
            .toArray()
        : [];
      const media = new Map(
        assets.map((asset) => [
          asset._id.toString(),
          {
            id: asset._id.toString(),
            secureUrl: String(asset.secureUrl),
            alt: String(asset.alt ?? ""),
          },
        ]),
      );
      return {
        affectedProducts: row
          ? (
              await database.db
                .collection("products")
                .find(
                  { primaryCategoryId: row._id, status: "ACTIVE" },
                  { projection: { name: 1 } },
                )
                .sort({ _id: 1 })
                .limit(21)
                .toArray()
            ).map((p) => ({ id: p._id.toString(), name: String(p.name) }))
          : [],
        value: row
          ? {
              id: row._id.toString(),
              revision: row.revision,
              name: row.name,
              slug: row.slug,
              parentId: row.parentId?.toString() ?? null,
              description: row.description,
              active: row.active,
              featured: row.featured,
              archived: !!row.archivedAt,
              deactivationReason: row.deactivationReason,
              displayOrder: row.displayOrder,
              thumbnailId: row.thumbnailId?.toString() ?? null,
              bannerId: row.bannerId?.toString() ?? null,
              seo: {
                title: row.seo?.title ?? "",
                description: row.seo?.description ?? "",
                canonicalPath: row.seo?.canonicalPath ?? "",
                robotsIndex: row.seo?.robotsIndex ?? true,
                robotsFollow: row.seo?.robotsFollow ?? true,
              },
            }
          : null,
        media: {
          thumbnail: row
            ? (media.get(row.thumbnailId?.toString() ?? "") ?? null)
            : null,
          banner: row
            ? (media.get(row.bannerId?.toString() ?? "") ?? null)
            : null,
        },
        options: result.options.map((option) => ({
          id: option._id.toString(),
          name: option.name,
          active: option.active,
          parentId: option.parentId?.toString() ?? null,
        })),
      };
    },
    async save(headers: Headers, input: unknown) {
      const actor = await access(headers);
      const value = categoryInput.parse(input);
      // Unique guard serializes all hierarchy mutations, including concurrent A→B/B→A moves.
      await database.db
        .collection("taxonomyGuards")
        .updateOne(
          { key: "categories" },
          { $setOnInsert: { revision: 0 } },
          { upsert: true },
        );
      const id = value.id ? new ObjectId(value.id) : new ObjectId();
      await transaction(async (session) => {
        await database.db
          .collection("taxonomyGuards")
          .updateOne(
            { key: "categories" },
            { $inc: { revision: 1 } },
            { session },
          );
        // Recheck fresh authority after acquiring the serialization point.
        const profile = await database.db
          .collection("profiles")
          .findOne({ authUserId: actor.authUserId }, { session });
        if (
          !profile ||
          profile.status !== "ACTIVE" ||
          !["ADMIN", "STAFF"].includes(String(profile.role))
        )
          throw new DomainError("FORBIDDEN");
        const rows = await repo.all(session);
        if (rows.length >= 1000 && !value.id)
          throw new DomainError("CATEGORY_LIMIT");
        const prior = rows.find((row) => row._id.toString() === id.toString());
        if (value.id && (!prior || prior.revision !== value.revision))
          throw new DomainError("REVISION_CONFLICT");
        if (prior?.archivedAt && !value.archived)
          throw new DomainError("CATEGORY_ARCHIVED");
        const graph = new Map(
          rows.map((row) => [
            row._id.toString(),
            {
              parentId: row.parentId?.toString() ?? null,
              active: row.active,
              archived: !!row.archivedAt,
            },
          ]),
        );
        graph.set(id.toString(), {
          parentId: value.parentId,
          active: value.active && !value.archived,
          archived: value.archived,
        });
        for (const [childId, child] of graph) {
          if (child.archived) continue;
          const seen = new Set([childId]);
          let parentId = child.parentId;
          let depth = 1;
          while (parentId) {
            if (seen.has(parentId)) throw new DomainError("CATEGORY_CYCLE");
            seen.add(parentId);
            if (++depth > 4) throw new DomainError("CATEGORY_DEPTH");
            const parent = graph.get(parentId);
            if (!parent || parent.archived || (child.active && !parent.active))
              throw new DomainError("CATEGORY_PARENT_UNAVAILABLE");
            parentId = parent.parentId;
          }
        }
        if (
          (!value.active || value.archived) &&
          (await database.db.collection("products").countDocuments(
            {
              primaryCategoryId: id,
              status: "ACTIVE",
            },
            { session },
          ))
        )
          throw new DomainError("CATEGORY_IN_USE");
        for (const mediaId of [value.thumbnailId, value.bannerId])
          if (
            mediaId &&
            !(await database.db
              .collection("mediaAssets")
              .findOne(
                { _id: new ObjectId(mediaId), resourceType: "image" },
                { session, projection: { _id: 1 } },
              ))
          )
            throw new DomainError("MEDIA_NOT_FOUND");
        const newPath = "/category/" + value.slug;
        const reserved = await database.db
          .collection("redirects")
          .findOne({ fromPath: newPath }, { session });
        if (reserved && reserved.entityId?.toString() !== id.toString())
          throw new DomainError("SLUG_RESERVED");
        if (reserved)
          await database.db
            .collection("redirects")
            .deleteOne({ _id: reserved._id }, { session });
        if (prior && prior.slug !== value.slug) {
          await database.db
            .collection("redirects")
            .updateMany(
              { entityId: id },
              { $set: { toPath: newPath, updatedAt: new Date() } },
              { session },
            );
          await database.db.collection("redirects").insertOne(
            {
              fromPath: "/category/" + prior.slug,
              toPath: newPath,
              statusCode: 301,
              entityId: id,
              createdAt: new Date(),
              updatedAt: new Date(),
              schemaVersion: 1,
            },
            { session },
          );
        }
        const fields = {
          name: value.name,
          nameNormalized: value.name
            .normalize("NFKC")
            .toLocaleLowerCase("en-US"),
          slug: value.slug,
          parentId: value.parentId ? new ObjectId(value.parentId) : null,
          description: value.description,
          active: value.active && !value.archived,
          featured: value.featured,
          archivedAt: value.archived ? (prior?.archivedAt ?? new Date()) : null,
          deactivationReason:
            value.active && !value.archived ? "" : value.deactivationReason,
          displayOrder: value.displayOrder,
          thumbnailId: value.thumbnailId
            ? new ObjectId(value.thumbnailId)
            : null,
          bannerId: value.bannerId ? new ObjectId(value.bannerId) : null,
          seo: value.seo,
          updatedBy: actor.authUserId,
        };
        if (prior) {
          const updated = await repo.model.updateOne(
            { _id: id, revision: value.revision },
            { $set: fields, $inc: { revision: 1 } },
            { session, runValidators: true },
          );
          if (updated.modifiedCount !== 1)
            throw new DomainError("REVISION_CONFLICT");
        } else
          await repo.model.create(
            [
              {
                _id: id,
                ...fields,
                createdBy: actor.authUserId,
                schemaVersion: 1,
              },
            ],
            { session },
          );
        await database.db.collection("auditLogs").insertOne(
          {
            actorType: "ACCOUNT",
            actorId: actor.authUserId,
            action: prior ? "CATEGORY_UPDATED" : "CATEGORY_CREATED",
            entityType: "category",
            entityId: id.toString(),
            before: prior
              ? {
                  slug: prior.slug,
                  parentId: prior.parentId?.toString(),
                  active: prior.active,
                }
              : null,
            after: {
              slug: value.slug,
              parentId: value.parentId,
              active: fields.active,
              archived: value.archived,
            },
            occurredAt: new Date(),
            createdAt: new Date(),
            schemaVersion: 1,
          },
          { session },
        );
        await database.db.collection("jobs").insertOne(
          {
            kind: "INVALIDATE_PUBLIC_CACHE",
            businessKey:
              "category:" + id + ":" + (prior ? prior.revision + 1 : 0),
            payload: {
              tags: [
                "category:" + id,
                "catalog",
                "navigation",
                "home",
                "sitemap",
              ],
              paths: [newPath, ...(prior ? ["/category/" + prior.slug] : [])],
            },
            state: "PENDING",
            dueAt: new Date(),
            attempts: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            schemaVersion: 1,
            revision: 0,
          },
          { session },
        );
      }, database);
      return { id: id.toString() };
    },
  };
}
