import "server-only";
import { ObjectId, type Db } from "mongodb";
import type { StateValue } from "../../shared/domain/states.generated";
export type Binding = {
  _id: ObjectId;
  orderId: ObjectId;
  orderNumber: string;
  operationId: string;
  provider: string;
  mode: string;
  accountKeyHash: string;
  active: boolean;
  generation: number;
  receipt: string;
  amountPaise: number;
  currency: string;
  state: StateValue<"BindingState">;
  revision: number;
  attempts: number;
  recoveryAttempts: number;
  deadlineAt: Date;
  leaseToken?: string;
  leaseUntil?: Date;
  providerOrderId?: string;
  nextCheckAt?: Date;
  lastErrorCode?: string;
  createdAt: Date;
  updatedAt: Date;
};
export const BINDING_LEASE_MS = 30000;
export const MAX_RECOVERY_ATTEMPTS = 5;
export const RECOVERY_DELAY_MS = 60000;
export function bindingRepository(db: Db) {
  const rows = db.collection<Binding>("paymentBindings");
  return {
    rows,
    read: (orderId: ObjectId) => rows.findOne({ orderId, active: true }),
    async expireLease(id: ObjectId, now: Date) {
      await rows.updateOne(
        { _id: id, state: "REQUESTING", leaseUntil: { $lte: now } },
        {
          $set: {
            state: "UNKNOWN",
            lastErrorCode: "BINDING_LEASE_EXPIRED",
            nextCheckAt: now,
            updatedAt: now,
          },
          $unset: { leaseToken: "", leaseUntil: "" },
          $inc: { revision: 1 },
        },
      );
    },
    async claim(row: Binding, token: string, now: Date, recovery: boolean) {
      return rows.findOneAndUpdate(
        {
          _id: row._id,
          active: true,
          revision: row.revision,
          state: recovery ? "UNKNOWN" : "NOT_STARTED",
          ...(recovery
            ? {
                recoveryAttempts: { $lt: MAX_RECOVERY_ATTEMPTS },
                $or: [
                  { nextCheckAt: { $exists: false } },
                  { nextCheckAt: { $lte: now } },
                ],
              }
            : {
                attempts: 0,
                deadlineAt: { $gt: new Date(now.getTime() + 60000) },
              }),
        },
        {
          $set: {
            state: "REQUESTING",
            leaseToken: token,
            leaseUntil: new Date(now.getTime() + BINDING_LEASE_MS),
            updatedAt: now,
          },
          $inc: {
            revision: 1,
            ...(recovery ? { recoveryAttempts: 1 } : { attempts: 1 }),
          },
        },
        { returnDocument: "after" },
      );
    },
    async finish(
      row: Binding,
      token: string,
      state: "BOUND" | "UNKNOWN",
      values: Partial<Binding>,
    ) {
      const now = new Date();
      return rows.updateOne(
        {
          _id: row._id,
          active: true,
          state: "REQUESTING",
          revision: row.revision,
          leaseToken: token,
          leaseUntil: { $gt: now },
        },
        {
          $set: {
            ...values,
            state,
            updatedAt: now,
            nextCheckAt: new Date(now.getTime() + RECOVERY_DELAY_MS),
          },
          $unset: { leaseToken: "", leaseUntil: "" },
          $inc: { revision: 1 },
        },
      );
    },
  };
}
