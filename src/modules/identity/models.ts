import "server-only";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { stateValues } from "../../shared/domain/states.generated";

const integer = {
  type: Number,
  required: true,
  validate: Number.isSafeInteger,
};
const profileSchema = new Schema(
  {
    authUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 200,
    },
    role: {
      type: String,
      enum: stateValues.Role,
      required: true,
      default: "CUSTOMER",
    },
    status: {
      type: String,
      enum: stateValues.AccountState,
      required: true,
      default: "ACTIVE",
    },
    authVersion: { ...integer, min: 1, default: 1 },
    schemaVersion: { ...integer, min: 1, default: 1 },
    name: { type: String, trim: true, maxlength: 200 },
  },
  {
    timestamps: true,
    versionKey: "revision",
    optimisticConcurrency: true,
    autoIndex: false,
    autoCreate: false,
    bufferCommands: false,
    strict: "throw",
  },
);
// Deliberately no password/email/session-token fields. The auth library owns them.
profileSchema.index(
  { authUserId: 1 },
  { name: "profiles_authUserId_unique", unique: true },
);
const guardSchema = new Schema(
  {
    key: { type: String, required: true, immutable: true },
    activeAdminCount: { ...integer, min: 0 },
    schemaVersion: { ...integer, min: 1, default: 1 },
  },
  {
    timestamps: true,
    versionKey: "revision",
    optimisticConcurrency: true,
    autoIndex: false,
    autoCreate: false,
    bufferCommands: false,
    strict: "throw",
  },
);
guardSchema.index(
  { key: 1 },
  { name: "securityGuards_key_unique", unique: true },
);

export type IdentityProfile = InferSchemaType<typeof profileSchema>;
export type SecurityGuard = InferSchemaType<typeof guardSchema>;
/** Use only the application-owned connection. Compiling a model performs no index creation. */
export function identityModels(connection: Connection): {
  Profile: Model<IdentityProfile>;
  SecurityGuard: Model<SecurityGuard>;
} {
  return {
    Profile:
      (connection.models.IdentityProfile as
        Model<IdentityProfile> | undefined) ??
      connection.model<IdentityProfile>(
        "IdentityProfile",
        profileSchema,
        "profiles",
      ),
    SecurityGuard:
      (connection.models.IdentitySecurityGuard as
        Model<SecurityGuard> | undefined) ??
      connection.model<SecurityGuard>(
        "IdentitySecurityGuard",
        guardSchema,
        "securityGuards",
      ),
  };
}
