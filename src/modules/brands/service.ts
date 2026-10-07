import "server-only";
import { ObjectId } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { DomainError } from "../../shared/domain/errors";
import { brandInput } from "./validation";
import { brandRepository, type BrandListQuery } from "./repository";

export function brandService(
  database: DatabaseHandle,
  access: (headers: Headers) => Promise<{ authUserId: string }>,
) {
  const repo = brandRepository(database);

  async function assets(ids: Array<ObjectId | null | undefined>) {
    const present = ids.filter((id): id is ObjectId => Boolean(id));
    if (!present.length)
      return new Map<string, { id: string; secureUrl: string; alt: string }>();
    const rows = await database.db
      .collection("mediaAssets")
      .find({ _id: { $in: present } }, { projection: { secureUrl: 1, alt: 1 } })
      .toArray();
    return new Map(
      rows.map((row) => [
        row._id.toString(),
        {
          id: row._id.toString(),
          secureUrl: String(row.secureUrl),
          alt: String(row.alt ?? ""),
        },
      ]),
    );
  }

  return {
    async list(headers: Headers, query: BrandListQuery = {}) {
      await access(headers);
      const result = await repo.adminPage(query);
      const media = await assets(result.rows.map((row) => row.logoId));
      return {
        rows: result.rows.map((row) => ({
          id: row._id.toString(),
          name: row.name,
          slug: row.slug,
          description: row.description,
          active: row.active,
          featured: row.featured,
          archived: Boolean(row.archivedAt),
          deactivationReason: row.deactivationReason,
          displayOrder: row.displayOrder,
          revision: row.revision,
          logoId: row.logoId?.toString() ?? null,
          logo: media.get(row.logoId?.toString() ?? "") ?? null,
          seo: {
            title: row.seo?.title ?? "",
            description: row.seo?.description ?? "",
            canonicalPath: row.seo?.canonicalPath ?? "",
            robotsIndex: row.seo?.robotsIndex ?? true,
            robotsFollow: row.seo?.robotsFollow ?? true,
          },
          updatedAt: row.updatedAt.toISOString(),
        })),
        total: result.total,
        page: result.page,
        pages: result.pages,
      };
    },

    async editorData(headers: Headers, id?: string) {
      await access(headers);
      if (id && !/^[a-f0-9]{24}$/.test(id))
        throw new DomainError("BRAND_NOT_FOUND");
      const { row } = await repo.editorData(id);
      if (id && !row) throw new DomainError("BRAND_NOT_FOUND");
      const media = await assets([row?.logoId]);
      return {
        value: row
          ? {
              id: row._id.toString(),
              revision: row.revision,
              name: row.name,
              slug: row.slug,
              description: row.description,
              active: row.active,
              featured: row.featured,
              archived: Boolean(row.archivedAt),
              deactivationReason: row.deactivationReason,
              displayOrder: row.displayOrder,
              logoId: row.logoId?.toString() ?? null,
              seo: {
                title: row.seo?.title ?? "",
                description: row.seo?.description ?? "",
                canonicalPath: row.seo?.canonicalPath ?? "",
                robotsIndex: row.seo?.robotsIndex ?? true,
                robotsFollow: row.seo?.robotsFollow ?? true,
              },
            }
          : null,
        logo: row ? (media.get(row.logoId?.toString() ?? "") ?? null) : null,
      };
    },

    async save(headers: Headers, input: unknown) {
      const actor = await access(headers);
      const value = brandInput.parse(input);
      const id = value.id ? new ObjectId(value.id) : new ObjectId();

      await transaction(async (session) => {
        const profile = await database.db
          .collection("profiles")
          .findOne(
            { authUserId: actor.authUserId },
            { session, projection: { role: 1, status: 1 } },
          );
        if (
          !profile ||
          profile.status !== "ACTIVE" ||
          !["ADMIN", "STAFF"].includes(String(profile.role))
        )
          throw new DomainError("FORBIDDEN");

        const prior = await repo.model
          .findById(id)
          .session(session)
          .lean()
          .exec();
        if (value.id && (!prior || prior.revision !== value.revision))
          throw new DomainError("REVISION_CONFLICT");
        if (prior?.archivedAt && !value.archived)
          throw new DomainError("BRAND_ARCHIVED");
        if (
          (!value.active || value.archived) &&
          (await database.db
            .collection("products")
            .countDocuments(
              { brandId: id, status: { $ne: "ARCHIVED" } },
              { session },
            ))
        )
          throw new DomainError("BRAND_IN_USE");
        if (
          value.logoId &&
          !(await database.db
            .collection("mediaAssets")
            .findOne(
              { _id: new ObjectId(value.logoId), resourceType: "image" },
              { session, projection: { _id: 1 } },
            ))
        )
          throw new DomainError("MEDIA_NOT_FOUND");

        const newPath = "/brand/" + value.slug;
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
              { entityId: id, entityType: "brand" },
              { $set: { toPath: newPath, updatedAt: new Date() } },
              { session },
            );
          await database.db.collection("redirects").insertOne(
            {
              fromPath: "/brand/" + prior.slug,
              toPath: newPath,
              statusCode: 301,
              entityType: "brand",
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
          description: value.description,
          active: value.active && !value.archived,
          featured: value.featured,
          archivedAt: value.archived ? (prior?.archivedAt ?? new Date()) : null,
          deactivationReason:
            value.active && !value.archived ? "" : value.deactivationReason,
          displayOrder: value.displayOrder,
          logoId: value.logoId ? new ObjectId(value.logoId) : null,
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
        } else {
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
        }

        await database.db.collection("auditLogs").insertOne(
          {
            actorType: "ACCOUNT",
            actorId: actor.authUserId,
            action: prior ? "BRAND_UPDATED" : "BRAND_CREATED",
            entityType: "brand",
            entityId: id.toString(),
            before: prior
              ? {
                  slug: prior.slug,
                  active: prior.active,
                  featured: prior.featured,
                }
              : null,
            after: {
              slug: value.slug,
              active: fields.active,
              featured: fields.featured,
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
            businessKey: "brand:" + id + ":" + (prior ? prior.revision + 1 : 0),
            payload: {
              tags: ["brand:" + id, "catalog", "home", "sitemap"],
              paths: [newPath, ...(prior ? ["/brand/" + prior.slug] : [])],
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
