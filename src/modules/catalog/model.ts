import "server-only";
import { Schema, type Connection } from "mongoose";
import { stateValues } from "../../shared/domain/states.generated";
const media = new Schema(
  { assetId: String, url: String, alt: String },
  { _id: false },
);
const entry = new Schema({ label: String, value: String }, { _id: false });
const common = {
  timestamps: true,
  versionKey: false as const,
  strict: "throw" as const,
  autoIndex: false,
  autoCreate: false,
  bufferCommands: false,
};
const productSchema = new Schema(
  {
    name: String,
    nameNormalized: String,
    slug: String,
    brandId: Schema.Types.ObjectId,
    categoryIds: [Schema.Types.ObjectId],
    primaryCategoryId: Schema.Types.ObjectId,
    status: { type: String, enum: stateValues.CatalogState },
    summary: String,
    description: String,
    modelNumber: String,
    hsn: String,
    tags: [String],
    warranty: String,
    notes: String,
    thumbnail: media,
    hoverImage: media,
    manufacturerContent: [
      new Schema(
        { heading: String, body: String, images: [media] },
        { _id: false },
      ),
    ],
    media: [media],
    videos: [
      new Schema(
        { source: String, videoId: String, assetId: String, title: String },
        { _id: false },
      ),
    ],
    attributes: [
      new Schema(
        { attributeId: String, value: Schema.Types.Mixed },
        { _id: false },
      ),
    ],
    specifications: [
      new Schema({ heading: String, entries: [entry] }, { _id: false }),
    ],
    features: [
      new Schema({ title: String, description: String }, { _id: false }),
    ],
    linkedProductIds: [Schema.Types.ObjectId],
    defaultVariantId: Schema.Types.ObjectId,
    seo: { title: String, description: String, robotsIndex: Boolean },
    listing: {
      minPricePaise: Number,
      maxPricePaise: Number,
      inStock: Boolean,
      activeVariantCount: Number,
      sourceRevision: Number,
    },
    revision: Number,
    schemaVersion: Number,
    createdBy: String,
    updatedBy: String,
  },
  common,
);
const variantSchema = new Schema(
  {
    productId: Schema.Types.ObjectId,
    sku: String,
    normalizedSku: String,
    barcode: String,
    title: String,
    combinationKey: String,
    options: [
      new Schema({ attributeId: String, optionId: String }, { _id: false }),
    ],
    active: Boolean,
    archived: Boolean,
    mrpPaise: Number,
    salePaise: Number,
    costPaise: Number,
    priceMode: String,
    gstRateBps: Number,
    taxPolicyKey: String,
    trackQuantity: Boolean,
    stockStatus: { type: String, enum: stateValues.StockStatus },
    onHand: Number,
    reserved: Number,
    media: [media],
    weightGrams: Number,
    lengthMm: Number,
    widthMm: Number,
    heightMm: Number,
    specifications: [entry],
    revision: Number,
    schemaVersion: Number,
  },
  common,
);
export function catalogModels(connection: Connection) {
  return {
    product:
      connection.models.CatalogProduct ??
      connection.model("CatalogProduct", productSchema, "products"),
    variant:
      connection.models.CatalogVariant ??
      connection.model("CatalogVariant", variantSchema, "variants"),
  };
}
