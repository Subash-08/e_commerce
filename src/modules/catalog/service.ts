import "server-only";
import { ObjectId } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { requireFact } from "../../shared/domain/errors";
import { productInput, combinationKey, normalizeSku } from "./validation";
import {
  catalogRepository,
  type VariantRecord,
  type ProductRecord,
} from "./repository";
import type { AttributeRecord } from "../attributes/repository";
import { priceBreakdown } from "./pricing";
import { assignVariantKeys } from "./urls";

export function listingSummary(variants: VariantRecord[], revision: number) {
  const active = variants.filter((v) => v.active && !v.archived);
  const prices = active.map(
    (v) => priceBreakdown(v.salePaise, v.priceMode, v.gstRateBps).payablePaise,
  );
  return {
    minPricePaise: prices.length ? Math.min(...prices) : null,
    maxPricePaise: prices.length ? Math.max(...prices) : null,
    activeVariantCount: active.length,
    inStock: active.some((v) =>
      v.trackQuantity
        ? (v.onHand ?? 0) > (v.reserved ?? 0)
        : v.stockStatus === "IN_STOCK",
    ),
    sourceRevision: revision,
  };
}
export function catalogService(
  database: DatabaseHandle,
  access: (headers: Headers) => Promise<{ authUserId: string }>,
) {
  const repo = catalogRepository(database);
  return {
    async editor(headers: Headers, id?: string) {
      await access(headers);
      requireFact(!id || /^[a-f0-9]{24}$/.test(id), "PRODUCT_NOT_FOUND");
      const product = id
        ? await repo.products.findOne({ _id: new ObjectId(id) })
        : null;
      requireFact(!id || product, "PRODUCT_NOT_FOUND");
      const [brands, categories, attributes, variants] = await Promise.all([
        database.db
          .collection("brands")
          .find({ active: true, archivedAt: null }, { projection: { name: 1 } })
          .sort({ nameNormalized: 1 })
          .limit(1000)
          .toArray(),
        database.db
          .collection("categories")
          .find(
            { active: true, archivedAt: null },
            { projection: { name: 1, parentId: 1 } },
          )
          .sort({ nameNormalized: 1 })
          .limit(1000)
          .toArray(),
        database.db
          .collection<AttributeRecord>("attributes")
          .find({})
          .sort({ displayOrder: 1, _id: 1 })
          .limit(1000)
          .toArray(),
        product
          ? repo.variants
              .find({ productId: product._id })
              .sort({ _id: 1 })
              .limit(1000)
              .toArray()
          : [],
      ]);
      const value = product
        ? productInput.parse({
            id: product._id.toString(),
            revision: product.revision,
            name: product.name,
            slug: product.slug,
            brandId: product.brandId.toString(),
            categoryIds: product.categoryIds.map(String),
            primaryCategoryId: product.primaryCategoryId.toString(),
            status: product.status,
            summary: product.summary,
            description: product.description,
            modelNumber: product.modelNumber,
            hsn: product.hsn,
            tags: product.tags,
            warranty: product.warranty,
            notes: product.notes,
            thumbnail: product.thumbnail ?? product.media[0] ?? null,
            hoverImage: product.hoverImage ?? null,
            manufacturerContent: product.manufacturerContent ?? [],
            media: product.media,
            videos: product.videos,
            attributes: product.attributes,
            specifications: product.specifications,
            features: product.features,
            linkedProductIds: product.linkedProductIds.map(String),
            defaultVariantId: product.defaultVariantId.toString(),
            seo: product.seo,
            variants: variants
              .filter((v) => !v.archived)
              .map((v) => ({
                id: v._id.toString(),
                sku: v.sku,
                barcode: v.barcode ?? "",
                title: v.title,
                options: v.options,
                active: v.active,
                archived: v.archived,
                mrpPaise: v.mrpPaise,
                salePaise: v.salePaise,
                costPaise: v.costPaise,
                priceMode: v.priceMode,
                gstRateBps: v.gstRateBps,
                trackQuantity: v.trackQuantity,
                stockStatus: v.stockStatus,
                onHand: v.onHand ?? null,
                media: v.media,
                weightGrams: v.weightGrams,
                lengthMm: v.lengthMm,
                widthMm: v.widthMm,
                heightMm: v.heightMm,
                specifications: v.specifications,
              })),
          })
        : null;
      const mediaIds = [
        ...(product?.media ?? []),
        ...(product?.thumbnail ? [product.thumbnail] : []),
        ...(product?.hoverImage ? [product.hoverImage] : []),
        ...(product?.manufacturerContent ?? []).flatMap((s) => s.images),
        ...variants.flatMap((v) => v.media),
      ].flatMap((m) => (m.assetId ? [new ObjectId(m.assetId)] : []));
      const assets = mediaIds.length
        ? await database.db
            .collection("mediaAssets")
            .find(
              { _id: { $in: mediaIds } },
              { projection: { secureUrl: 1, alt: 1 } },
            )
            .toArray()
        : [];
      const linked = product?.linkedProductIds.length
        ? await repo.products
            .find(
              { _id: { $in: product.linkedProductIds } },
              { projection: { name: 1 } },
            )
            .limit(20)
            .toArray()
        : [];
      return {
        linked: linked.map((p) => ({ id: p._id.toString(), name: p.name })),
        value,
        brands: brands.map((b) => ({
          id: b._id.toString(),
          name: String(b.name),
        })),
        categories: categories.map((c) => ({
          id: c._id.toString(),
          name: String(c.name),
          parentId: c.parentId?.toString() ?? null,
        })),
        attributes: attributes.map(
          ({
            _id,
            code,
            name,
            type,
            unit,
            visible,
            filterable,
            variantAxisAllowed,
            active,
            displayOrder,
            options,
            revision,
          }) => ({
            id: _id.toString(),
            code,
            name,
            type,
            unit,
            visible,
            filterable,
            variantAxisAllowed,
            active,
            displayOrder,
            options,
            revision,
          }),
        ),
        assets: assets.map((a) => ({
          id: a._id.toString(),
          url: String(a.secureUrl),
        })),
        reserved: Object.fromEntries(
          variants.map((v) => [v._id.toString(), v.reserved ?? 0]),
        ),
      };
    },
    async findRelated(headers: Headers, search: string, exclude?: string) {
      await access(headers);
      const prefix = search
        .trim()
        .slice(0, 100)
        .normalize("NFKC")
        .toLowerCase();
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rows = await repo.products
        .find(
          {
            status: { $ne: "ARCHIVED" },
            ...(exclude && /^[a-f0-9]{24}$/.test(exclude)
              ? { _id: { $ne: new ObjectId(exclude) } }
              : {}),
            ...(prefix ? { nameNormalized: { $regex: "^" + escaped } } : {}),
          },
          { projection: { name: 1 } },
        )
        .sort({ nameNormalized: 1, _id: 1 })
        .limit(20)
        .toArray();
      return rows.map((p) => ({ id: p._id.toString(), name: p.name }));
    },
    async save(headers: Headers, raw: unknown) {
      const actor = await access(headers);
      const value = productInput.parse(raw);
      const id = value.id ? new ObjectId(value.id) : new ObjectId();
      for (const key of ["categories", "attributes"])
        await database.db
          .collection("taxonomyGuards")
          .updateOne(
            { key },
            { $setOnInsert: { revision: 0 } },
            { upsert: true },
          );
      await transaction(async (session) => {
        for (const key of ["categories", "attributes"])
          await database.db
            .collection("taxonomyGuards")
            .updateOne({ key }, { $inc: { revision: 1 } }, { session });
        requireFact(
          await database.db.collection("profiles").findOne(
            {
              authUserId: actor.authUserId,
              status: "ACTIVE",
              role: { $in: ["ADMIN", "STAFF"] },
            },
            { session },
          ),
          "FORBIDDEN",
        );
        const prior = await repo.products.findOne({ _id: id }, { session });
        requireFact(
          !value.id || (prior && prior.revision === value.revision),
          "REVISION_CONFLICT",
        );
        requireFact(!prior || prior.status !== "ARCHIVED", "PRODUCT_ARCHIVED");
        const brandId = new ObjectId(value.brandId);
        requireFact(
          (
            await database.db
              .collection("brands")
              .updateOne(
                { _id: brandId, active: true, archivedAt: null },
                { $inc: { catalogReferenceRevision: 1 } },
                { session },
              )
          ).matchedCount === 1,
          "BRAND_UNAVAILABLE",
        );
        const categories = await database.db
          .collection("categories")
          .find(
            {
              _id: { $in: value.categoryIds.map((x) => new ObjectId(x)) },
              active: true,
              archivedAt: null,
            },
            { session },
          )
          .toArray();
        requireFact(
          categories.length === value.categoryIds.length,
          "CATEGORY_UNAVAILABLE",
        );
        const existing = await repo.variants
          .find({ productId: id }, { session })
          .limit(1001)
          .toArray();
        requireFact(existing.length <= 1000, "VARIANT_HISTORY_LIMIT");
        const attributes = await database.db
          .collection<AttributeRecord>("attributes")
          .find(
            {
              _id: {
                $in: [
                  ...new Set([
                    ...value.attributes.map((a) => a.attributeId),
                    ...value.variants.flatMap((v) =>
                      v.options.map((o) => o.attributeId),
                    ),
                  ]),
                ].map((x) => new ObjectId(x)),
              },
            },
            { session },
          )
          .toArray();
        const definitions = new Map(
          attributes.map((a) => [a._id.toString(), a]),
        );
        const urlKeys = assignVariantKeys(
          [
            ...existing.map((v) => ({ ...v, id: v._id.toString() })),
            ...value.variants.filter(
              (v) => !existing.some((old) => old._id.toString() === v.id),
            ),
          ],
          attributes.map((a) => ({ id: a._id.toString(), options: a.options })),
        );
        const combinations = new Set<string>();
        const skus = new Set<string>();
        const barcodes = new Set<string>();
        let axisSet: string | undefined;
        const next: VariantRecord[] = [];
        for (const variant of value.variants) {
          const old = existing.find((v) => v._id.toString() === variant.id);
          const key = combinationKey(variant.options);
          requireFact(
            !old || old.combinationKey === key,
            "VARIANT_IDENTITY_IMMUTABLE",
          );
          requireFact(!old?.archived, "VARIANT_ARCHIVED");
          requireFact(
            !existing.some(
              (v) =>
                v._id.toString() !== variant.id && v.combinationKey === key,
            ),
            "COMBINATION_RESERVED",
          );
          const sku = normalizeSku(variant.sku);
          requireFact(
            !combinations.has(key) && !skus.has(sku),
            "DUPLICATE_VARIANT",
          );
          combinations.add(key);
          skus.add(sku);
          if (variant.barcode) {
            requireFact(!barcodes.has(variant.barcode), "DUPLICATE_BARCODE");
            barcodes.add(variant.barcode);
          }
          if (!variant.archived) {
            const axes = variant.options
              .map((o) => o.attributeId)
              .sort()
              .join("|");
            requireFact(
              axisSet === undefined || axisSet === axes,
              "INCONSISTENT_VARIANT_AXES",
            );
            axisSet = axes;
          }
          for (const option of variant.options) {
            const attribute = definitions.get(option.attributeId);
            const selected = attribute?.options.find(
              (o) => o.id === option.optionId,
            );
            requireFact(
              attribute && selected && attribute.variantAxisAllowed,
              "INVALID_VARIANT_OPTION",
            );
            requireFact(
              Boolean(old) || (attribute.active && selected.active),
              "RETIRED_OPTION",
            );
          }
          const reserved = old?.reserved ?? 0;
          requireFact(
            !reserved ||
              (variant.trackQuantity && !variant.archived && variant.active),
            "RESERVATIONS_EXIST",
          );
          requireFact(
            !variant.trackQuantity || (variant.onHand ?? -1) >= reserved,
            "STOCK_BELOW_RESERVED",
          );
          const { id: ignored, barcode, onHand, ...fields } = variant;
          void ignored;
          next.push({
            ...fields,
            _id: new ObjectId(variant.id),
            productId: id,
            urlKey: urlKeys.get(variant.id)!,
            normalizedSku: sku,
            combinationKey: key,
            ...(barcode ? { barcode } : {}),
            ...(variant.trackQuantity ? { onHand: onHand!, reserved } : {}),
            taxPolicyKey:
              "gst-v1-" +
              variant.priceMode.toLowerCase() +
              "-" +
              variant.gstRateBps,
            revision: (old?.revision ?? -1) + 1,
            schemaVersion: 1,
            createdAt: old?.createdAt ?? new Date(),
            updatedAt: new Date(),
          });
        }
        for (const assignment of value.attributes) {
          const definition = definitions.get(assignment.attributeId);
          const oldValue = prior?.attributes.find(
            (a) => a.attributeId === assignment.attributeId,
          );
          requireFact(
            definition && (definition.active || oldValue),
            "ATTRIBUTE_UNAVAILABLE",
          );
          const v = assignment.value;
          if (definition.type === "TEXT")
            requireFact(typeof v === "string", "ATTRIBUTE_VALUE_INVALID");
          else if (definition.type === "NUMBER")
            requireFact(typeof v === "number", "ATTRIBUTE_VALUE_INVALID");
          else if (definition.type === "BOOLEAN")
            requireFact(typeof v === "boolean", "ATTRIBUTE_VALUE_INVALID");
          else {
            const ids = definition.type === "MULTI_SELECT" ? v : [v];
            requireFact(
              Array.isArray(ids) && new Set(ids).size === ids.length,
              "ATTRIBUTE_VALUE_INVALID",
            );
            for (const optionId of ids)
              requireFact(
                definition.options.some(
                  (o) =>
                    o.id === optionId &&
                    (o.active ||
                      (Array.isArray(oldValue?.value)
                        ? oldValue.value
                        : [oldValue?.value]
                      ).includes(String(optionId))),
                ),
                "RETIRED_OPTION",
              );
          }
        }
        for (const old of existing)
          if (!next.some((v) => v._id.equals(old._id))) {
            requireFact(!old.reserved, "RESERVATIONS_EXIST");
            next.push({
              ...old,
              urlKey: urlKeys.get(old._id.toString())!,
              archived: true,
              active: false,
              revision: old.revision + 1,
              updatedAt: new Date(),
            });
          }
        if (value.status === "ARCHIVED")
          requireFact(
            next.every((v) => !v.reserved),
            "RESERVATIONS_EXIST",
          );
        const media = [
          ...value.media,
          ...(value.thumbnail ? [value.thumbnail] : []),
          ...(value.hoverImage ? [value.hoverImage] : []),
          ...value.manufacturerContent.flatMap((s) => s.images),
          ...value.variants.flatMap((v) => v.media),
        ];
        const mediaIds = [
          ...new Set(media.flatMap((m) => (m.assetId ? [m.assetId] : []))),
        ];
        if (mediaIds.length)
          requireFact(
            (await database.db.collection("mediaAssets").countDocuments(
              {
                _id: { $in: mediaIds.map((x) => new ObjectId(x)) },
                resourceType: "image",
              },
              { session },
            )) === mediaIds.length,
            "MEDIA_NOT_FOUND",
          );
        const videoIds = [
          ...new Set(
            value.videos.flatMap((v) =>
              v.source === "CLOUDINARY" ? [v.assetId] : [],
            ),
          ),
        ];
        if (videoIds.length)
          requireFact(
            (await database.db.collection("mediaAssets").countDocuments(
              {
                _id: { $in: videoIds.map((x) => new ObjectId(x)) },
                resourceType: "video",
              },
              { session },
            )) === videoIds.length,
            "MEDIA_NOT_FOUND",
          );
        requireFact(
          !value.linkedProductIds.includes(id.toString()) &&
            new Set(value.linkedProductIds).size ===
              value.linkedProductIds.length,
          "INVALID_RELATED_PRODUCTS",
        );
        if (value.linkedProductIds.length)
          requireFact(
            (await repo.products.countDocuments(
              {
                _id: {
                  $in: value.linkedProductIds.map((x) => new ObjectId(x)),
                },
                status: { $ne: "ARCHIVED" },
              },
              { session },
            )) === value.linkedProductIds.length,
            "INVALID_RELATED_PRODUCTS",
          );
        const newPath = "/product/" + value.slug;
        const reservedUrl = await database.db
          .collection("redirects")
          .findOne({ fromPath: newPath }, { session });
        requireFact(
          !reservedUrl || reservedUrl.entityId?.toString() === id.toString(),
          "SLUG_RESERVED",
        );
        if (reservedUrl)
          await database.db
            .collection("redirects")
            .deleteOne({ _id: reservedUrl._id }, { session });
        if (prior && prior.slug !== value.slug) {
          await database.db
            .collection("redirects")
            .updateMany(
              { entityId: id },
              { $set: { toPath: newPath } },
              { session },
            );
          await database.db.collection("redirects").insertOne(
            {
              fromPath: "/product/" + prior.slug,
              toPath: newPath,
              entityId: id,
              entityType: "product",
              statusCode: 301,
              createdAt: new Date(),
              schemaVersion: 1,
            },
            { session },
          );
        }
        const {
          id: ignoredId,
          revision: ignoredRevision,
          variants: ignoredVariants,
          ...fields
        } = value;
        void ignoredId;
        void ignoredRevision;
        void ignoredVariants;
        const revision = (prior?.revision ?? -1) + 1;
        const record: ProductRecord = {
          ...fields,
          _id: id,
          brandId,
          categoryIds: value.categoryIds.map((x) => new ObjectId(x)),
          primaryCategoryId: new ObjectId(value.primaryCategoryId),
          linkedProductIds: value.linkedProductIds.map((x) => new ObjectId(x)),
          defaultVariantId: new ObjectId(value.defaultVariantId),
          nameNormalized: value.name.normalize("NFKC").toLowerCase(),
          revision,
          listing: listingSummary(next, revision),
          schemaVersion: 1,
          createdBy: prior?.createdBy ?? actor.authUserId,
          updatedBy: actor.authUserId,
          createdAt: prior?.createdAt ?? new Date(),
          updatedAt: new Date(),
        };
        if (prior)
          requireFact(
            (
              await repo.products.replaceOne(
                { _id: id, revision: value.revision },
                record,
                { session },
              )
            ).matchedCount === 1,
            "REVISION_CONFLICT",
          );
        else await repo.products.insertOne(record, { session });
        await repo.replaceVariants(next, session);
        await database.db.collection("auditLogs").insertOne(
          {
            actorType: "ACCOUNT",
            actorId: actor.authUserId,
            action: prior ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
            entityType: "product",
            entityId: id.toString(),
            before: prior
              ? { revision: prior.revision, status: prior.status }
              : null,
            after: { revision, status: value.status, variants: next.length },
            occurredAt: new Date(),
            schemaVersion: 1,
          },
          { session },
        );
        await database.db.collection("jobs").insertOne(
          {
            kind: "INVALIDATE_PUBLIC_CACHE",
            businessKey: "product:" + id + ":" + revision,
            payload: {
              tags: ["catalog", "navigation", "sitemap", "home"],
              paths: [newPath, ...(prior ? ["/product/" + prior.slug] : [])],
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
