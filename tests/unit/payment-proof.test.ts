import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyCheckoutSignature,
  verifyPaymentHmac,
} from "../../src/modules/payments/proof";

const fixtureSigningKey = "test-only-webhook-secret-that-is-long-enough";
const sign = (value: string) =>
  createHmac("sha256", fixtureSigningKey).update(value).digest("hex");

describe("payment proof boundary", () => {
  it("accepts a callback only when it is signed for the server-stored provider order", () => {
    const order = "order_fixture123";
    const payment = "pay_fixture123";
    expect(() =>
      verifyCheckoutSignature(
        order,
        payment,
        sign(order + "|" + payment),
        fixtureSigningKey,
      ),
    ).not.toThrow();
    expect(() =>
      verifyCheckoutSignature(
        "order_other",
        payment,
        sign(order + "|" + payment),
        fixtureSigningKey,
      ),
    ).toThrow("PAYMENT_SIGNATURE_INVALID");
  });
  it("rejects modified webhook bytes", () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    expect(() =>
      verifyPaymentHmac(body, sign(body.toString("utf8")), fixtureSigningKey),
    ).not.toThrow();
    expect(() =>
      verifyPaymentHmac(
        Buffer.from('{"event":"payment.failed"}'),
        sign(body.toString("utf8")),
        fixtureSigningKey,
      ),
    ).toThrow("PAYMENT_SIGNATURE_INVALID");
  });
});
