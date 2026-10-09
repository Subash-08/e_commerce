import { z } from "zod";
import { checkoutQuoteInput } from "../checkout/contracts";

export const placeOrderInput = z
  .object({
    quoteId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
    checkout: checkoutQuoteInput,
  })
  .strict();

export const cancelOrderInput = z
  .object({
    orderNumber: z.string().regex(/^ORD-[0-9]{4}-[0-9]{6}$/),
    expectedRevision: z.number().int().min(0),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export type PlaceOrderInput = z.infer<typeof placeOrderInput>;

export type OrderSummaryDto = {
  orderNumber: string;
  state: string;
  financialState: string;
  paymentMethod: "COD";
  totalPaise: number;
  currency: "INR";
  itemCount: number;
  createdAt: string;
  revision: number;
};
