import "server-only";
import { Schema, type Connection } from "mongoose";
import { stateValues } from "../../shared/domain/states.generated";

const option = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    colour: String,
    active: Boolean,
  },
  { _id: false },
);
const schema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: stateValues.AttributeType, required: true },
    unit: String,
    visible: Boolean,
    filterable: Boolean,
    variantAxisAllowed: Boolean,
    active: Boolean,
    displayOrder: Number,
    options: [option],
    revision: { type: Number, default: 0 },
    createdBy: String,
    updatedBy: String,
    schemaVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
    autoIndex: false,
    autoCreate: false,
    bufferCommands: false,
  },
);
export function attributeModel(connection: Connection) {
  return (
    connection.models.CatalogAttribute ??
    connection.model("CatalogAttribute", schema, "attributes")
  );
}
