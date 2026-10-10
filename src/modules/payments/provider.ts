import "server-only";
import { z } from "zod";
import { assertOutsideTransaction } from "../../server/db/transaction";
import { paymentTestConfig } from "./access";

const providerOrder = z.object({
  id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  receipt: z.string(),
  amount: z.number().int().positive(),
  currency: z.string(),
  amount_paid: z.number().int().nonnegative(),
  amount_due: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  status: z.enum(["created", "attempted", "paid"]),
  notes: z.object({ commerceOperation: z.string(), commerceOrder: z.string() }),
});
export type ProviderOrder = z.infer<typeof providerOrder>;
export interface OrderProvider {
  create(input: {
    receipt: string;
    amountPaise: number;
    operationId: string;
    orderId: string;
  }): Promise<ProviderOrder>;
  lookup(receipt: string): Promise<ProviderOrder[]>;
  fetch(id: string): Promise<ProviderOrder>;
}

export function razorpayOrders(): OrderProvider {
  const config = paymentTestConfig();
  async function request(path: string, body?: object): Promise<unknown> {
    assertOutsideTransaction();
    try {
      const response = await fetch("https://api.razorpay.com/v1/" + path, {
        method: body ? "POST" : "GET",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(config.keyId + ":" + config.keySecret).toString(
              "base64",
            ),
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new Error("PAYMENT_PROVIDER_UNAVAILABLE");
      return await response.json();
    } catch {
      // Do not retain provider error bodies, credentials, URL parameters or causes.
      throw new Error("PAYMENT_PROVIDER_UNAVAILABLE");
    }
  }
  function parse(raw: unknown) {
    const result = providerOrder.safeParse(raw);
    if (!result.success) throw new Error("PAYMENT_PROVIDER_INVALID_RESPONSE");
    return result.data;
  }
  return {
    async create(input) {
      return parse(
        await request("orders", {
          amount: input.amountPaise,
          currency: "INR",
          receipt: input.receipt,
          partial_payment: false,
          notes: {
            commerceOperation: input.operationId,
            commerceOrder: input.orderId,
          },
        }),
      );
    },
    async lookup(receipt) {
      // The provider documents a contains filter. Require exact equality locally.
      // A full result page is inconclusive, never evidence of uniqueness.
      const raw = await request(
        "orders?" + new URLSearchParams({ receipt, count: "100", skip: "0" }),
      );
      const page = z
        .object({ items: z.array(z.unknown()).max(100) })
        .safeParse(raw);
      if (!page.success || page.data.items.length === 100)
        throw new Error("PAYMENT_LOOKUP_INCONCLUSIVE");
      return page.data.items
        .filter(
          (v): v is Record<string, unknown> =>
            !!v &&
            typeof v === "object" &&
            "receipt" in v &&
            v.receipt === receipt,
        )
        .map(parse);
    },
    async fetch(id) {
      if (!/^order_[A-Za-z0-9]+$/.test(id))
        throw new Error("PAYMENT_BINDING_INVALID");
      return parse(await request("orders/" + id));
    },
  };
}
