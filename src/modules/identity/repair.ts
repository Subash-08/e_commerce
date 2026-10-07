import "server-only";
import { ObjectId } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection.ts";
import { transaction } from "../../server/db/transaction.ts";
import { checkIndexes } from "../../server/db/indexes.ts";
import { DomainError } from "../../shared/domain/errors.ts";
import { identityIndexes } from "./indexes.ts";
import { adminRepository } from "./admin-repository.ts";

/** Operator-only recovery. Never modifies credentials or an existing profile. */
export async function repairMissingProfile(
  database: DatabaseHandle,
  authUserId: string,
) {
  if (!ObjectId.isValid(authUserId)) throw new DomainError("INVALID_USER_ID");
  if ((await checkIndexes(database.db, identityIndexes)).length)
    throw new DomainError("AUTH_INDEX_DRIFT");
  const repo = adminRepository(database);
  return transaction(async (session) => {
    const user = await database.db
      .collection("auth_user")
      .findOne(
        { _id: new ObjectId(authUserId) },
        { session, projection: { name: 1 } },
      );
    if (!user) throw new DomainError("USER_NOT_FOUND");
    if (await repo.profile(authUserId, session)) return { created: false };
    const previousSession = await database.db
      .collection("auth_session")
      .findOne(
        { userId: { $in: [authUserId, new ObjectId(authUserId)] } },
        { session, projection: { authVersion: 1 }, sort: { authVersion: -1 } },
      );
    const authVersion = previousSession
      ? Number(previousSession.authVersion ?? 0) + 1
      : 1;
    if (!Number.isSafeInteger(authVersion) || authVersion < 1)
      throw new DomainError("AUTH_VERSION_INVALID");
    const now = new Date();
    await repo.profiles.insertOne(
      {
        authUserId,
        name: typeof user.name === "string" ? user.name.slice(0, 200) : "",
        role: "CUSTOMER",
        status: "ACTIVE",
        authVersion,
        revision: 0,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
      { session },
    );
    await repo.audit(
      "PROFILE_RECOVERED",
      "operator-repair",
      authUserId,
      null,
      { role: "CUSTOMER", status: "ACTIVE" },
      session,
    );
    return { created: true };
  }, database);
}
