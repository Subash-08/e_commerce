import "server-only";
import { Schema, Types, type Connection, type Model } from "mongoose";

export interface BrandRecord {
  _id: Types.ObjectId;
  name: string;
  nameNormalized: string;
  slug: string;
  description: string;
  active: boolean;
  featured: boolean;
  archivedAt: Date | null;
  deactivationReason: string;
  displayOrder: number;
  logoId: Types.ObjectId | null;
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
    robotsIndex: boolean;
    robotsFollow: boolean;
  };
  createdBy: string;
  updatedBy: string;
  schemaVersion: number;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<BrandRecord>(
  {
    name: { type: String, required: true },
    nameNormalized: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    deactivationReason: { type: String, default: "" },
    displayOrder: { type: Number, default: 0 },
    logoId: { type: Schema.Types.ObjectId, default: null },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      canonicalPath: { type: String, default: "" },
      robotsIndex: { type: Boolean, default: true },
      robotsFollow: { type: Boolean, default: true },
    },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    schemaVersion: { type: Number, required: true, default: 1 },
  },
  {
    timestamps: true,
    versionKey: "revision",
    optimisticConcurrency: true,
    autoIndex: false,
    autoCreate: false,
    strict: "throw",
    bufferCommands: false,
  },
);

export function brandModel(connection: Connection): Model<BrandRecord> {
  return (
    (connection.models.Brand as Model<BrandRecord> | undefined) ??
    connection.model<BrandRecord>("Brand", brandSchema, "brands")
  );
}
