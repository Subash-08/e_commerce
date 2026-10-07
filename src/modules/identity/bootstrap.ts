import { checkIndexes } from "../../server/db/indexes.ts";
import { identityIndexes } from "./indexes.ts";
import { ObjectId } from "mongodb";
import "server-only";
import { transaction } from "../../server/db/transaction.ts";
import type { DatabaseHandle } from "../../server/db/connection.ts";
import { DomainError } from "../../shared/domain/errors.ts";
import { adminRepository } from "./admin-repository.ts";
/** Operator-only command: promotes an explicitly selected, already registered auth ID. Never exposed as HTTP. */
export async function bootstrapAdministrator(
  database: DatabaseHandle,
  authUserId: string,
) {
  if (!authUserId || authUserId.length > 200)
    throw new DomainError("INVALID_USER_ID");
  if ((await checkIndexes(database.db, identityIndexes)).length)
    throw new DomainError("AUTH_INDEX_DRIFT");
  const repo = adminRepository(database);
  await transaction(async (session) => {
    if (
      (await repo.guards.findOne({ key: "last-admin" }, { session })) ||
      (await repo.profiles.countDocuments({ role: "ADMIN" }, { session }))
    )
      throw new DomainError("ADMIN_ALREADY_EXISTS");
    if (
      !ObjectId.isValid(authUserId) ||
      !(await database.db
        .collection("auth_user")
        .findOne(
          { _id: new ObjectId(authUserId) },
          { session, projection: { _id: 1 } },
        ))
    )
      throw new DomainError("ACTIVE_REGISTERED_USER_REQUIRED");
    const target = await repo.profile(authUserId, session);
    if (!target || target.status !== "ACTIVE")
      throw new DomainError("ACTIVE_REGISTERED_USER_REQUIRED");
    const now = new Date();
    await repo.guards.insertOne(
      {
        key: "last-admin",
        activeAdminCount: 1,
        revision: 0,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
      { session },
    );
    await repo.profiles.updateOne(
      { authUserId, revision: target.revision },
      {
        $set: { role: "ADMIN", updatedAt: now },
        $inc: { revision: 1, authVersion: 1 },
      },
      { session },
    );
    await repo.audit(
      "FIRST_ADMIN_BOOTSTRAPPED",
      "operator-bootstrap",
      authUserId,
      { role: target.role },
      { role: "ADMIN" },
      session,
    );
    await repo.enqueue(authUserId, target.authVersion + 1, session);
  }, database);
}
