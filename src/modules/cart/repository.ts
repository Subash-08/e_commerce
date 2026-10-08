import "server-only";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import type { CartLine } from "./contracts";

export interface CartRecord {
  _id: ObjectId;
  authUserId: string;
  items: CartLine[];
  revision: number;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
export function cartRepository(db: Db) {
  const carts = db.collection<CartRecord>("carts");
  return {
    async read(authUserId: string, session?: ClientSession) {
      return carts.findOne({ authUserId }, { session });
    },
    async write(
      authUserId: string,
      current: CartRecord | null,
      items: CartLine[],
      session: ClientSession,
    ) {
      const now = new Date();
      if (!current) {
        await carts.insertOne(
          {
            _id: new ObjectId(),
            authUserId,
            items,
            revision: 1,
            schemaVersion: 1,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      } else {
        const result = await carts.updateOne(
          { _id: current._id, revision: current.revision },
          { $set: { items, updatedAt: now }, $inc: { revision: 1 } },
          { session },
        );
        if (!result.modifiedCount) throw new Error("REVISION_CONFLICT");
      }
    },
  };
}
