import "server-only";
import { ObjectId, type ClientSession } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import type { AttributeInput } from "./validation";

export type AttributeRecord = Omit<AttributeInput, "id" | "revision"> & {
  _id: ObjectId;
  revision: number;
  updatedAt: Date;
  createdAt: Date;
  createdBy: string;
  updatedBy: string;
  schemaVersion: number;
};
export function attributeRepository(database: DatabaseHandle) {
  const collection = database.db.collection<AttributeRecord>("attributes");
  return {
    list: () =>
      collection
        .find({})
        .sort({ displayOrder: 1, _id: 1 })
        .limit(1001)
        .toArray(),
    get: (id: ObjectId, session: ClientSession) =>
      collection.findOne({ _id: id }, { session }),
    async used(id: ObjectId, session: ClientSession) {
      return Boolean(
        (await database.db
          .collection("variants")
          .findOne(
            { "options.attributeId": id.toString() },
            { session, projection: { _id: 1 } },
          )) ||
        (await database.db
          .collection("products")
          .findOne(
            { "attributes.attributeId": id.toString() },
            { session, projection: { _id: 1 } },
          )),
      );
    },
    async persist(
      record: AttributeRecord,
      expected: number | undefined,
      session: ClientSession,
    ) {
      if (expected === undefined) {
        await collection.insertOne(record, { session });
        return true;
      }
      return (
        (
          await collection.replaceOne(
            { _id: record._id, revision: expected },
            record,
            { session },
          )
        ).matchedCount === 1
      );
    },
  };
}
