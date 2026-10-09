import { z } from "zod";
import { stateCode } from "../shipping/contracts";

const short = z.string().trim().min(1).max(100);
export const addressFields = z
  .object({
    name: short,
    mobile: z
      .string()
      .trim()
      .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit Indian mobile number"),
    line1: z.string().trim().min(3).max(150),
    line2: z.string().trim().max(150).default(""),
    landmark: z.string().trim().max(100).default(""),
    city: short,
    district: z.string().trim().max(100).default(""),
    stateCode,
    postalCode: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{5}$/, "Enter a valid six-digit PIN"),
    countryCode: z.literal("IN"),
  })
  .strict();

export const savedAddressInput = addressFields
  .extend({
    id: z.uuid().optional(),
    revision: z.number().int().min(0).default(0),
    label: z.string().trim().min(1).max(40),
    defaultShipping: z.boolean().default(false),
    defaultBilling: z.boolean().default(false),
  })
  .strict();

export type AddressFields = z.infer<typeof addressFields>;
export type SavedAddressInput = z.infer<typeof savedAddressInput>;
export type SavedAddressDto = SavedAddressInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
