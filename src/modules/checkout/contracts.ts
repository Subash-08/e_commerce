import { z } from "zod";
import { cartLines } from "../cart/contracts";
import { stateCode } from "../shipping/contracts";

const short = z.string().trim().min(1).max(100);
export const checkoutAddress = z
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

export const checkoutQuoteInput = z
  .object({
    contact: z
      .object({
        name: short,
        email: z.string().trim().toLowerCase().email().max(254),
        mobile: z
          .string()
          .trim()
          .regex(/^[6-9][0-9]{9}$/),
      })
      .strict(),
    shippingAddress: checkoutAddress,
    billingSameAsShipping: z.boolean(),
    billingAddress: checkoutAddress.nullable(),
    business: z
      .object({
        legalName: z.string().trim().max(150).default(""),
        gstin: z
          .string()
          .trim()
          .toUpperCase()
          .regex(
            /^(?:[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])?$/,
            "Check the GSTIN format",
          ),
      })
      .strict(),
    deliveryNote: z.string().trim().max(300).default(""),
    payment: z.enum(["ONLINE", "COD"]),
    coupon: z
      .string()
      .trim()
      .toUpperCase()
      .max(20)
      .regex(/^[A-Z0-9_-]*$/),
    termsAccepted: z.literal(true),
    marketingConsent: z.boolean(),
    guestLines: cartLines,
    cartRevision: z.number().int().min(0),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.billingSameAsShipping && !value.billingAddress)
      ctx.addIssue({
        code: "custom",
        path: ["billingAddress"],
        message: "Enter a billing address",
      });
    if (value.billingSameAsShipping && value.billingAddress)
      ctx.addIssue({
        code: "custom",
        path: ["billingAddress"],
        message: "Do not send a second address when billing matches shipping",
      });
  });
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteInput>;

export type CheckoutQuoteDto = {
  quoteId: string;
  expiresAt: string;
  currency: "INR";
  cartRevision: number | null;
  items: Array<{
    variantId: string;
    name: string;
    title: string;
    quantity: number;
    unitPaise: number;
    payablePaise: number;
    url: string | null;
    image: { url: string; alt: string } | null;
  }>;
  coupon: { code: string; discountPaise: number; message: string | null };
  shipping: {
    chargePaise: number;
    taxPaise: number;
    waiverPaise: number;
    automaticFree: boolean;
    remainingPaise: number | null;
  };
  cod: { eligible: boolean; chargePaise: number; taxPaise: number };
  totals: {
    goodsPaise: number;
    discountPaise: number;
    goodsTaxPaise: number;
    deliveryPaise: number;
    grandTotalPaise: number;
  };
  paymentMethods: Array<"ONLINE" | "COD">;
  notices: string[];
};
