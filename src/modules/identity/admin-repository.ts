import "server-only";
import { ObjectId, type ClientSession } from "mongodb";
import type { DatabaseHandle } from "../../server/db/connection";
import type { StateValue } from "../../shared/domain/states.generated";
export interface AuthorityProfile {
  authUserId: string;
  name?: string;
  role: StateValue<"Role">;
  status: StateValue<"AccountState">;
  authVersion: number;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
}
export interface RevocationJob {
  kind: "REVOKE_SESSIONS";
  businessKey: string;
  payload: { authUserId: string; authVersion: number };
  state: StateValue<"JobState">;
  dueAt: Date;
  attempts: number;
  leaseToken?: string;
  leaseUntil?: Date;
  lastErrorCode?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
  revision: number;
}
export function adminRepository(database: DatabaseHandle) {
  const profiles = database.db.collection<AuthorityProfile>("profiles");
  const guards = database.db.collection<{
    key: string;
    activeAdminCount: number;
    revision: number;
    schemaVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }>("securityGuards");
  const jobs = database.db.collection<RevocationJob>("jobs");
  const audits = database.db.collection("auditLogs");
  return {
    profiles,
    guards,
    jobs,
    profile: (id: string, session: ClientSession) =>
      profiles.findOne({ authUserId: id }, { session }),
    async list(
      search: string,
      page: number,
      role?: StateValue<"Role">,
      status?: StateValue<"AccountState">,
    ) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchingUsers = search
        ? await database.db
            .collection("auth_user")
            .find(
              { email: { $regex: escaped, $options: "i" } },
              { projection: { _id: 1 } },
            )
            .limit(100)
            .toArray()
        : [];
      const matchingIds = matchingUsers.map((user) => user._id.toString());
      const query = {
        ...(status ? { status } : {}),
        ...(role ? { role } : {}),
        ...(search
          ? {
              $or: [
                { name: { $regex: escaped, $options: "i" } },
                { authUserId: { $in: matchingIds } },
              ],
            }
          : {}),
      };
      const total = await profiles.countDocuments(query);
      const rows = await profiles
        .find(query, {
          projection: {
            _id: 0,
            authUserId: 1,
            name: 1,
            role: 1,
            status: 1,
            revision: 1,
            createdAt: 1,
          },
        })
        .sort({ createdAt: -1, authUserId: 1 })
        .skip((page - 1) * 20)
        .limit(20)
        .toArray();
      const authUsers = await database.db
        .collection("auth_user")
        .find(
          {
            _id: {
              $in: rows
                .filter((row) => ObjectId.isValid(row.authUserId))
                .map((row) => new ObjectId(row.authUserId)),
            },
          },
          { projection: { email: 1 } },
        )
        .toArray();
      const sessions = rows.length
        ? await database.db
            .collection("auth_session")
            .aggregate([
              {
                $match: { userId: { $in: rows.map((row) => row.authUserId) } },
              },
              { $sort: { createdAt: -1 } },
              {
                $group: {
                  _id: "$userId",
                  lastLoginAt: { $first: "$createdAt" },
                },
              },
            ])
            .toArray()
        : [];
      const lastLogin = new Map(
        sessions.map((item) => [
          String(item._id),
          item.lastLoginAt instanceof Date
            ? item.lastLoginAt.toISOString()
            : undefined,
        ]),
      );
      const emails = new Map(
        authUsers.map((user) => [
          user._id.toString(),
          typeof user.email === "string" ? user.email : "",
        ]),
      );
      return {
        rows: rows.map((row) => ({
          ...row,
          email: emails.get(row.authUserId),
          lastLoginAt: lastLogin.get(row.authUserId),
          createdAt: row.createdAt.toISOString(),
        })),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / 20)),
      };
    },
    async audit(
      action: string,
      actorId: string,
      targetId: string,
      before: object | null,
      after: object,
      session?: ClientSession,
    ) {
      // Only caller-built authority snapshots; never request bodies, credentials or tokens.
      await audits.insertOne(
        {
          actorType: "ACCOUNT",
          actorId,
          action,
          entityType: "profile",
          entityId: targetId,
          before,
          after,
          occurredAt: new Date(),
          createdAt: new Date(),
          schemaVersion: 1,
        },
        { session },
      );
    },
    async enqueue(
      authUserId: string,
      authVersion: number,
      session: ClientSession,
    ) {
      const now = new Date();
      await jobs.insertOne(
        {
          kind: "REVOKE_SESSIONS",
          businessKey: authUserId + ":" + authVersion,
          payload: { authUserId, authVersion },
          state: "PENDING",
          dueAt: now,
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
          revision: 0,
        },
        { session },
      );
    },
    async claim(leaseToken: string) {
      const now = new Date();
      await jobs.updateMany(
        {
          kind: "REVOKE_SESSIONS",
          state: "RUNNING",
          attempts: { $gte: 8 },
          leaseUntil: { $lte: now },
        },
        {
          $set: {
            state: "DEAD",
            lastErrorCode: "SESSION_REVOCATION_FAILED",
            updatedAt: now,
          },
          $unset: { leaseToken: "", leaseUntil: "" },
        },
      );
      return jobs.findOneAndUpdate(
        {
          kind: "REVOKE_SESSIONS",
          attempts: { $lt: 8 },
          $or: [
            { state: { $in: ["PENDING", "RETRY"] }, dueAt: { $lte: now } },
            { state: "RUNNING", leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            state: "RUNNING",
            leaseToken,
            leaseUntil: new Date(now.getTime() + 30000),
            updatedAt: now,
          },
          $inc: { attempts: 1, revision: 1 },
        },
        { sort: { dueAt: 1 }, returnDocument: "after" },
      );
    },
    async finish(
      id: ObjectId,
      leaseToken: string,
      attempts: number,
      success: boolean,
    ) {
      const now = new Date();
      await jobs.updateOne(
        { _id: id, state: "RUNNING", leaseToken },
        {
          $set: success
            ? { state: "SUCCEEDED", completedAt: now, updatedAt: now }
            : {
                state: attempts >= 8 ? "DEAD" : "RETRY",
                dueAt: new Date(
                  now.getTime() + Math.min(300000, 1000 * 2 ** attempts),
                ),
                lastErrorCode: "SESSION_REVOCATION_FAILED",
                updatedAt: now,
              },
          $unset: { leaseToken: "", leaseUntil: "" },
          $inc: { revision: 1 },
        },
      );
    },
  };
}
