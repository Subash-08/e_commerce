import "server-only";
import { randomUUID } from "node:crypto";
import type { DatabaseHandle } from "../../server/db/connection";
import {
  transaction,
  assertOutsideTransaction,
} from "../../server/db/transaction";
import { DomainError } from "../../shared/domain/errors";
import { authorize, type SessionAuthority } from "./authorization";
import { adminRepository } from "./admin-repository";
import { authorityInput, userQuery } from "./admin-validation";

export function adminService(
  database: DatabaseHandle,
  sessions: {
    read: (headers: Headers) => Promise<SessionAuthority | null>;
    revoke: (authUserId: string, beforeVersion: number) => Promise<void>;
  },
) {
  const repo = adminRepository(database);
  async function adminSession(headers: Headers) {
    const authority = await sessions.read(headers);
    const profile = authority
      ? await repo.profiles.findOne({ authUserId: authority.authUserId })
      : null;
    authorize(authority, profile, "users.manage", { now: Date.now() });
    return authority!;
  }
  async function retryRevocations(limit = 5) {
    assertOutsideTransaction();
    let processed = 0;
    for (let index = 0; index < Math.min(limit, 20); index++) {
      const lease = randomUUID();
      const job = await repo.claim(lease);
      if (!job) break;
      let success = false;
      try {
        await sessions.revoke(job.payload.authUserId, job.payload.authVersion);
        await repo.audit(
          "SESSIONS_REVOKED",
          "session-maintenance",
          job.payload.authUserId,
          null,
          { beforeVersion: job.payload.authVersion },
        );
        success = true;
      } catch {
        /* Retain a safe retry code, never the exception. */
      }
      await repo.finish(job._id, lease, job.attempts, success);
      processed++;
    }
    return processed;
  }
  return {
    retryRevocations,
    async auditTrail(headers: Headers) {
      await adminSession(headers);
      const entries = await database.db
        .collection("auditLogs")
        .find(
          {},
          {
            projection: {
              _id: 1,
              action: 1,
              actorId: 1,
              entityId: 1,
              before: 1,
              after: 1,
              occurredAt: 1,
            },
          },
        )
        .sort({ occurredAt: -1 })
        .limit(50)
        .toArray();
      return entries.map((entry) => ({
        id: entry._id.toString(),
        action: String(entry.action),
        actorId: String(entry.actorId),
        entityId: String(entry.entityId),
        occurredAt: new Date(entry.occurredAt).toISOString(),
      }));
    },
    async list(headers: Headers, input: unknown) {
      await adminSession(headers);
      const query = userQuery.parse(input);
      const list = await repo.list(
        query.search,
        query.page,
        query.role,
        query.status,
      );
      const pendingRevocations = await repo.jobs.countDocuments({
        kind: "REVOKE_SESSIONS",
        state: { $in: ["PENDING", "RETRY", "RUNNING", "DEAD"] },
      });
      return { ...list, pendingRevocations };
    },
    async changeAuthority(headers: Headers, input: unknown) {
      const authority = await adminSession(headers);
      const update = authorityInput.parse(input);
      await transaction(async (session) => {
        const guard = await repo.guards.findOneAndUpdate(
          { key: "last-admin" },
          { $inc: { revision: 1 }, $set: { updatedAt: new Date() } },
          { session, returnDocument: "after" },
        );
        if (!guard) throw new DomainError("ADMIN_BOOTSTRAP_REQUIRED");
        const actor = await repo.profile(authority.authUserId, session);
        authorize(authority, actor, "authority.manage", { now: Date.now() });
        const target = await repo.profile(update.authUserId, session);
        if (!target) throw new DomainError("USER_NOT_FOUND");
        if (target.revision !== update.revision)
          throw new DomainError("REVISION_CONFLICT");
        if (target.role === update.role && target.status === update.status)
          return;
        const delta =
          Number(update.role === "ADMIN" && update.status === "ACTIVE") -
          Number(target.role === "ADMIN" && target.status === "ACTIVE");
        if (guard.activeAdminCount + delta < 1)
          throw new DomainError("LAST_ADMIN_REQUIRED");
        if (!Number.isSafeInteger(target.authVersion + 1))
          throw new DomainError("AUTH_VERSION_INVALID");
        const changed = await repo.profiles.updateOne(
          { authUserId: target.authUserId, revision: target.revision },
          {
            $set: {
              role: update.role,
              status: update.status,
              updatedAt: new Date(),
            },
            $inc: { authVersion: 1, revision: 1 },
          },
          { session },
        );
        if (changed.modifiedCount !== 1)
          throw new DomainError("REVISION_CONFLICT");
        await repo.guards.updateOne(
          { key: "last-admin" },
          { $inc: { activeAdminCount: delta } },
          { session },
        );
        const before = { role: target.role, status: target.status };
        const after = { role: update.role, status: update.status };
        if (target.role !== update.role)
          await repo.audit(
            "USER_ROLE_CHANGED",
            authority.authUserId,
            target.authUserId,
            before,
            after,
            session,
          );
        if (target.status !== update.status)
          await repo.audit(
            update.status === "ACTIVE" ? "USER_ACTIVATED" : "USER_DEACTIVATED",
            authority.authUserId,
            target.authUserId,
            before,
            after,
            session,
          );
        await repo.enqueue(target.authUserId, target.authVersion + 1, session);
      }, database);
      // Durable commit precedes the supported auth API call. Failure remains retryable.
      try {
        await retryRevocations();
      } catch {
        /* Immediate authVersion denial is already durable. */
      }
      return { ok: true };
    },
    async retryFromAdmin(headers: Headers) {
      const actor = await adminSession(headers);
      await transaction(async (session) => {
        await repo.jobs.updateMany(
          { kind: "REVOKE_SESSIONS", state: "DEAD" },
          {
            $set: {
              state: "RETRY",
              attempts: 0,
              dueAt: new Date(),
              updatedAt: new Date(),
            },
            $inc: { revision: 1 },
          },
          { session },
        );
        await repo.audit(
          "SESSION_REVOCATION_RETRY",
          actor.authUserId,
          "revocation-jobs",
          null,
          {},
          session,
        );
      }, database);
      await retryRevocations();
      return { ok: true };
    },
  };
}
