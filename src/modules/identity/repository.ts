import "server-only";
import type { ClientSession, Connection } from "mongoose";
import { identityModels } from "./models";

export function identityRepository(connection: Connection) {
  const { Profile } = identityModels(connection);
  return {
    async findProfile(authUserId: string, session?: ClientSession) {
      const query = Profile.findOne({ authUserId });
      if (session) query.session(session);
      return query.lean().exec();
    },
    /** Idempotent provisioning only: never changes authority on an existing profile. */
    async provisionCustomer(authUserId: string, name: string) {
      await Profile.updateOne(
        { authUserId },
        {
          $setOnInsert: {
            authUserId,
            name,
            role: "CUSTOMER",
            status: "ACTIVE",
            authVersion: 1,
            schemaVersion: 1,
            revision: 0,
          },
        },
        { upsert: true, runValidators: true },
      ).exec();
    },
  };
}
