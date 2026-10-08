import "server-only";
import { ObjectId } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import { transaction } from "../../server/db/transaction";
import { requireFact } from "../../shared/domain/errors";
import { attributeInput, type AttributeInput } from "./validation";
import { attributeRepository } from "./repository";

export function attributeService(
  database: DatabaseHandle,
  access: (headers: Headers) => Promise<{ authUserId: string }>,
) {
  const repo = attributeRepository(database);
  return {
    async list(headers: Headers): Promise<AttributeInput[]> {
      await access(headers);
      const rows = await repo.list();
      requireFact(rows.length <= 1000, "ATTRIBUTE_LIMIT");
      return rows.map(
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
      );
    },
    async save(headers: Headers, input: unknown) {
      const actor = await access(headers);
      const value = attributeInput.parse(input);
      const id = value.id ? new ObjectId(value.id) : new ObjectId();
      await database.db
        .collection("taxonomyGuards")
        .updateOne(
          { key: "attributes" },
          { $setOnInsert: { revision: 0 } },
          { upsert: true },
        );
      await transaction(async (session) => {
        await database.db
          .collection("taxonomyGuards")
          .updateOne(
            { key: "attributes" },
            { $inc: { revision: 1 } },
            { session },
          );
        const profile = await database.db
          .collection("profiles")
          .findOne(
            {
              authUserId: actor.authUserId,
              status: "ACTIVE",
              role: { $in: ["ADMIN", "STAFF"] },
            },
            { session },
          );
        requireFact(profile, "FORBIDDEN");
        const prior = await repo.get(id, session);
        requireFact(
          !value.id || (prior && prior.revision === value.revision),
          "REVISION_CONFLICT",
        );
        if (prior) {
          requireFact(prior.code === value.code, "ATTRIBUTE_CODE_IMMUTABLE");
          requireFact(
            prior.options.every((o) =>
              value.options.some((n) => n.id === o.id),
            ),
            "RETIRE_OPTIONS_INSTEAD_OF_DELETING",
          );
          if (await repo.used(id, session)) {
            requireFact(
              prior.type === value.type && prior.unit === value.unit,
              "ATTRIBUTE_TYPE_IN_USE",
            );
            requireFact(
              !prior.variantAxisAllowed || value.variantAxisAllowed,
              "ATTRIBUTE_AXIS_IN_USE",
            );
          }
        }
        const { id: ignoredId, revision: ignoredRevision, ...fields } = value;
        void ignoredId;
        void ignoredRevision;
        requireFact(
          await repo.persist(
            {
              ...fields,
              _id: id,
              revision: (prior?.revision ?? -1) + 1,
              createdAt: prior?.createdAt ?? new Date(),
              updatedAt: new Date(),
              createdBy: prior?.createdBy ?? actor.authUserId,
              updatedBy: actor.authUserId,
              schemaVersion: 1,
            },
            prior?.revision,
            session,
          ),
          "REVISION_CONFLICT",
        );
        await database.db
          .collection("auditLogs")
          .insertOne(
            {
              actorType: "ACCOUNT",
              actorId: actor.authUserId,
              action: prior ? "ATTRIBUTE_UPDATED" : "ATTRIBUTE_CREATED",
              entityType: "attribute",
              entityId: id.toString(),
              occurredAt: new Date(),
              before: prior
                ? { active: prior.active, revision: prior.revision }
                : null,
              after: {
                active: value.active,
                revision: (prior?.revision ?? -1) + 1,
              },
              schemaVersion: 1,
            },
            { session },
          );
        await database.db
          .collection("jobs")
          .insertOne(
            {
              kind: "INVALIDATE_PUBLIC_CACHE",
              businessKey:
                "attribute:" + id + ":" + ((prior?.revision ?? -1) + 1),
              payload: { tags: ["catalog"], paths: [] },
              state: "PENDING",
              dueAt: new Date(),
              attempts: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              revision: 0,
              schemaVersion: 1,
            },
            { session },
          );
      }, database);
      return { id: id.toString() };
    },
  };
}
