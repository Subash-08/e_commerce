import "server-only";
import type { CollectionIndexes } from "../../server/db/indexes";

// Exact reviewed minimal core indexes; changes require the runtime command regression.
export const identityIndexes: readonly CollectionIndexes[] = [
  {
    collection: "auth_user",
    indexes: [
      { name: "auth_user_email_uidx", key: { email: 1 }, unique: true },
    ],
  },
  {
    collection: "auth_session",
    indexes: [
      { name: "auth_session_token_uidx", key: { token: 1 }, unique: true },
      { name: "auth_session_userId_idx", key: { userId: 1 } },
    ],
  },
  {
    collection: "auth_account",
    indexes: [{ name: "auth_account_userId_idx", key: { userId: 1 } }],
  },
  {
    collection: "auth_verification",
    indexes: [
      { name: "auth_verification_identifier_idx", key: { identifier: 1 } },
    ],
  },
  {
    collection: "profiles",
    indexes: [
      {
        name: "profiles_authUserId_unique",
        key: { authUserId: 1 },
        unique: true,
      },
    ],
  },
  {
    collection: "securityGuards",
    indexes: [
      { name: "securityGuards_key_unique", key: { key: 1 }, unique: true },
    ],
  },
  {
    collection: "auth_rateLimit",
    indexes: [
      { name: "auth_rateLimit_key_unique", key: { key: 1 }, unique: true },
      { name: "auth_rateLimit_lastRequest_idx", key: { lastRequest: 1 } },
    ],
  },
];
