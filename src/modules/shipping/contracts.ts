import { z } from "zod";

// Canonical postal state/UT abbreviations. A format match is not courier verification.
export const stateCodes = [
  "AN",
  "AP",
  "AR",
  "AS",
  "BR",
  "CH",
  "CG",
  "DH",
  "DL",
  "GA",
  "GJ",
  "HR",
  "HP",
  "JK",
  "JH",
  "KA",
  "KL",
  "LA",
  "LD",
  "MP",
  "MH",
  "MN",
  "ML",
  "MZ",
  "NL",
  "OD",
  "PY",
  "PB",
  "RJ",
  "SK",
  "TN",
  "TS",
  "TR",
  "UP",
  "UK",
  "WB",
] as const;
export const stateCode = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(stateCodes));
const pins = z
  .array(
    z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{0,5}$/, "Use 1–6 digits, starting with 1–9"),
  )
  .max(100)
  .transform((v) => [...new Set(v)].sort());
const states = z
  .array(stateCode)
  .max(36)
  .transform((v) => [...new Set(v)].sort());
export const money = z.number().int().min(0).max(1_000_000_000);
const taxKey = z.string().trim().min(1).max(120).nullable();
export const shippingInput = z
  .object({
    enabled: z.boolean(),
    country: z.literal("IN"),
    currency: z.literal("INR"),
    standardChargePaise: money,
    automaticFreeShipping: z
      .object({ enabled: z.boolean(), thresholdPaise: money.nullable() })
      .strict(),
    coverage: z
      .object({
        mode: z.enum(["ALL_INDIA", "ALLOW_LIST", "BLOCK_LIST"]),
        stateCodes: states,
        pinPrefixes: pins,
      })
      .strict(),
    shippingTaxPolicyKey: taxKey,
    cod: z
      .object({
        enabled: z.boolean(),
        surchargePaise: money,
        surchargeTaxPolicyKey: taxKey,
        blockedStateCodes: states,
        blockedPinPrefixes: pins,
        reservationDeadlineHours: z.number().int().min(1).max(168),
      })
      .strict(),
    quoteTtlSeconds: z.number().int().min(600).max(900),
    onlinePaymentDeadlineSeconds: z.number().int().min(900).max(1800),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.automaticFreeShipping.enabled &&
      (!v.automaticFreeShipping.thresholdPaise ||
        v.automaticFreeShipping.thresholdPaise < 1)
    )
      ctx.addIssue({
        code: "custom",
        path: ["automaticFreeShipping", "thresholdPaise"],
        message: "Enter a positive free-delivery threshold",
      });
    if (
      !v.automaticFreeShipping.enabled &&
      v.automaticFreeShipping.thresholdPaise !== null
    )
      ctx.addIssue({
        code: "custom",
        path: ["automaticFreeShipping", "thresholdPaise"],
        message: "Disabled thresholds must be empty",
      });
    if (
      v.coverage.mode === "ALLOW_LIST" &&
      !v.coverage.stateCodes.length &&
      !v.coverage.pinPrefixes.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["coverage"],
        message: "Choose at least one allowed state or PIN prefix",
      });
    if (
      v.coverage.mode === "ALL_INDIA" &&
      (v.coverage.stateCodes.length || v.coverage.pinPrefixes.length)
    )
      ctx.addIssue({
        code: "custom",
        path: ["coverage"],
        message: "All India must not contain hidden location restrictions",
      });
  });
export type ShippingInput = z.infer<typeof shippingInput>;
export const previewInput = z
  .object({
    merchandisePaise: money,
    state: stateCode,
    pin: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{5}$/),
    payment: z.enum(["ONLINE", "COD"]),
  })
  .strict();
export type ShippingDestination = z.infer<typeof previewInput>;
export type ShippingPolicy = ShippingInput & {
  key: "shipping";
  revision: number;
  schemaVersion: 1;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
  taxReview: {
    approved: boolean;
    reviewReference: string | null;
    reviewedAt: Date | null;
  };
};
