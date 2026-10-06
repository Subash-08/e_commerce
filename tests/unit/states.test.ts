import { describe, expect, it } from "vitest";
import {
  transitionPayment,
  summarizePayments,
  financialSummary,
  claimRefund,
  transitionRefund,
  type PaymentAttempt,
  type RefundLedger,
} from "../../src/modules/payments/state";
import { transitionOrder, lateCapture } from "../../src/modules/orders/state";
import { stateValues } from "../../src/shared/domain/states.generated";
import { context, facts, order } from "../fixtures/domain";
const attempt = (
  state: PaymentAttempt["state"] = "PENDING",
): PaymentAttempt => ({
  provider: "test-provider",
  providerPaymentId: "payment-1",
  amountPaise: 10000,
  currency: "INR",
  state,
  revision: 0,
  history: [],
});
const observation = (state: PaymentAttempt["state"]) => ({
  provider: "test-provider",
  providerPaymentId: "payment-1",
  amountPaise: 10000,
  currency: "INR" as const,
  state,
  verified: true,
});
describe("canonical payment transitions", () => {
  for (const from of stateValues.PaymentState)
    for (const to of stateValues.PaymentState) {
      it(from + " -> " + to, () => {
        const allowed =
          from === to ||
          [
            "PENDING>AUTHORIZED",
            "PENDING>CAPTURED",
            "PENDING>FAILED",
            "AUTHORIZED>CAPTURED",
            "AUTHORIZED>FAILED",
            "FAILED>CAPTURED",
          ].includes(from + ">" + to);
        const run = () =>
          transitionPayment(attempt(from), observation(to), context());
        if (allowed) expect(run().attempt.state).toBe(to);
        else expect(run).toThrow("INVALID_PAYMENT_TRANSITION");
      });
    }
  it("duplicate capture across callback and webhook identities has one monetary effect", () => {
    const first = transitionPayment(
      attempt(),
      observation("CAPTURED"),
      context(),
    );
    expect(first.capturedDeltaPaise).toBe(10000);
    const exact = transitionPayment(
      first.attempt,
      observation("CAPTURED"),
      context(),
    );
    const webhook = transitionPayment(
      first.attempt,
      observation("CAPTURED"),
      context({ operationId: "webhook-2", expectedRevision: 1 }),
    );
    expect(exact.capturedDeltaPaise + webhook.capturedDeltaPaise).toBe(0);
    expect(webhook.attempt).toBe(first.attempt);
    expect(() =>
      transitionPayment(
        first.attempt,
        observation("FAILED"),
        context({ operationId: "failure", expectedRevision: 1 }),
      ),
    ).toThrow("INVALID_PAYMENT_TRANSITION");
  });
  it.each([
    { providerPaymentId: "other" },
    { amountPaise: 1 },
    { currency: "USD" },
    { verified: false },
    { provider: "other" },
  ])("rejects mismatched provider proof %j", (patch) => {
    expect(() =>
      transitionPayment(
        attempt(),
        { ...observation("CAPTURED"), ...patch },
        context(),
      ),
    ).toThrow("PAYMENT_PROOF_MISMATCH");
  });
  it("rejects missing actor/reason, denied authorization and stale revision", () => {
    for (const patch of [
      { actorId: "" },
      { reason: "" },
      { authorized: false },
      { expectedRevision: 1 },
    ])
      expect(() =>
        transitionPayment(attempt(), observation("CAPTURED"), context(patch)),
      ).toThrow();
  });
  it("rejects reuse of an operation ID for different content", () => {
    const first = transitionPayment(
      attempt(),
      observation("AUTHORIZED"),
      context(),
    );
    expect(() =>
      transitionPayment(first.attempt, observation("CAPTURED"), context()),
    ).toThrow("IDEMPOTENCY_CONFLICT");
  });
});
describe("financial and refund authority", () => {
  it.each([
    [100, 0, 0, "PENDING", "NONE"],
    [100, 100, 0, "PAID", "NONE"],
    [100, 100, 1, "PARTIALLY_REFUNDED", "NONE"],
    [100, 100, 100, "REFUNDED", "NONE"],
    [100, 50, 0, "PENDING", "REVIEW_REQUIRED"],
    [100, 101, 0, "PAID", "REVIEW_REQUIRED"],
  ])(
    "derives financial state from %s / %s / %s",
    (required, captured, refunded, state, exception) => {
      expect(
        financialSummary(Number(required), Number(captured), Number(refunded)),
      ).toMatchObject({ state, exception });
    },
  );
  it("blocks fulfillment after partial/extra capture or refunds", () => {
    for (const [c, r] of [
      [50, 0],
      [101, 0],
      [100, 1],
      [100, 100],
    ])
      expect(financialSummary(100, c, r).fulfillmentEligible).toBe(false);
    expect(() => financialSummary(100, 100, 101)).toThrow(
      "REFUND_EXCEEDS_CAPTURE",
    );
  });
  it("pending claims occupy refund capacity and successful refunds do not change captured money", () => {
    const initial: RefundLedger = {
      capturedPaise: 10000,
      claims: [],
      revision: 0,
      history: [],
    };
    const pending = claimRefund(initial, "refund-1", 7000, context());
    expect(() =>
      claimRefund(
        pending,
        "refund-2",
        3001,
        context({ operationId: "op-2", expectedRevision: 1 }),
      ),
    ).toThrow("REFUND_EXCEEDS_CAPTURE");
    const success = transitionRefund(
      pending,
      "refund-1",
      "SUCCEEDED",
      { verified: true, providerResolved: true },
      context({ operationId: "op-2", expectedRevision: 1 }),
    );
    expect(success.capturedPaise).toBe(10000);
    expect(
      transitionRefund(
        success,
        "refund-1",
        "SUCCEEDED",
        { verified: true, providerResolved: true },
        context({ operationId: "op-3", expectedRevision: 2 }),
      ),
    ).toBe(success);
    expect(() =>
      transitionRefund(
        success,
        "refund-1",
        "FAILED",
        { verified: true, providerResolved: true },
        context({ operationId: "op-3", expectedRevision: 2 }),
      ),
    ).toThrow("INVALID_REFUND_TRANSITION");
  });
  it("ambiguous refund failures cannot release the claim; retry requires provider resolution", () => {
    const pending = claimRefund(
      { capturedPaise: 100, claims: [], revision: 0, history: [] },
      "r",
      100,
      context(),
    );
    expect(() =>
      transitionRefund(
        pending,
        "r",
        "FAILED",
        { verified: true, providerResolved: false },
        context({ expectedRevision: 1, operationId: "f" }),
      ),
    ).toThrow("REFUND_PROOF_REQUIRED");
    const failed = transitionRefund(
      pending,
      "r",
      "FAILED",
      { verified: true, providerResolved: true },
      context({ expectedRevision: 1, operationId: "f" }),
    );
    const retried = transitionRefund(
      failed,
      "r",
      "PENDING",
      { verified: true, providerResolved: true },
      context({ expectedRevision: 2, operationId: "retry" }),
    );
    expect(retried.claims).toEqual([
      { id: "r", amountPaise: 100, state: "PENDING" },
    ]);
    expect(claimRefund(retried, "r", 100, context())).toBe(retried);
    expect(() => claimRefund(retried, "r", 99, context())).toThrow(
      "IDEMPOTENCY_CONFLICT",
    );
  });
});
describe("canonical order transitions", () => {
  for (const from of stateValues.OrderState)
    for (const to of stateValues.OrderState) {
      it(from + " -> " + to, () => {
        const allowed = [
          "PENDING_PAYMENT>PLACED",
          "PENDING_PAYMENT>EXPIRED",
          "PENDING_PAYMENT>CANCELLED",
          "PLACED>CONFIRMED",
          "PLACED>CANCELLED",
          "CONFIRMED>PROCESSING",
          "CONFIRMED>CANCELLED",
          "PROCESSING>SHIPPED",
          "PROCESSING>CANCELLED",
          "SHIPPED>DELIVERED",
          "EXPIRED>PLACED",
        ].includes(from + ">" + to);
        const expiring = to === "EXPIRED";
        const run = () =>
          transitionOrder(
            order({ state: from }),
            to,
            facts(expiring ? { capturedPaise: 0 } : {}),
            context({ at: expiring ? 200 : 100 }),
          );
        if (allowed) expect(run().order.state).toBe(to);
        else expect(run).toThrow("INVALID_ORDER_TRANSITION");
      });
    }
  it("does not ship unpaid online orders or fulfillment exceptions", () => {
    expect(() =>
      transitionOrder(
        order({ state: "PROCESSING" }),
        "SHIPPED",
        facts({ capturedPaise: 0 }),
        context(),
      ),
    ).toThrow();
    expect(() =>
      transitionOrder(
        order({ state: "PROCESSING", fulfillmentException: "REFUND_REQUIRED" }),
        "SHIPPED",
        facts(),
        context(),
      ),
    ).toThrow();
    expect(() =>
      transitionOrder(
        order({ state: "PROCESSING" }),
        "SHIPPED",
        facts({ trackingRecorded: false }),
        context(),
      ),
    ).toThrow();
  });
  it("COD stays unpaid; stock consumption happens on shipment, not online expiry", () => {
    const result = transitionOrder(
      order({ state: "PROCESSING", paymentMode: "COD" }),
      "SHIPPED",
      facts({ capturedPaise: 0, codEligible: true }),
      context(),
    );
    expect(result.effects).toContain("consume-tracked-reservations");
    expect(financialSummary(10000, 0, 0).state).toBe("PENDING");
    expect(() =>
      transitionOrder(
        order({ paymentMode: "COD" }),
        "EXPIRED",
        facts({ capturedPaise: 0 }),
        context({ at: 201 }),
      ),
    ).toThrow();
  });
  it("expiry requires deadline and fresh proof that no capture exists", () => {
    expect(() =>
      transitionOrder(
        order(),
        "EXPIRED",
        facts({ capturedPaise: 0 }),
        context({ at: 199 }),
      ),
    ).toThrow();
    expect(() =>
      transitionOrder(order(), "EXPIRED", facts(), context({ at: 200 })),
    ).toThrow();
    expect(() =>
      transitionOrder(
        order(),
        "EXPIRED",
        facts({ capturedPaise: 0, verifiedPayment: false }),
        context({ at: 200 }),
      ),
    ).toThrow();
    expect(() =>
      transitionOrder(order(), "PLACED", facts(), context({ at: 200 })),
    ).toThrow();
  });
  it("cancellation requests refund review and never restores consumed stock", () => {
    const result = transitionOrder(
      order({ state: "PLACED" }),
      "CANCELLED",
      facts(),
      context(),
    );
    expect(result.order.fulfillmentException).toBe("REFUND_REQUIRED");
    expect(result.effects).toEqual([
      "release-active-tracked-reservations",
      "release-held-coupon-claim",
      "request-refund-review",
    ]);
    expect(
      transitionOrder(result.order, "CANCELLED", facts(), context()).effects,
    ).toEqual([]);
  });
  it("late capture recovers only with all stock and coupon capacity; cancelled never revives", () => {
    const recovered = lateCapture(
      order({ state: "EXPIRED" }),
      facts(),
      context({ at: 300 }),
    );
    expect(recovered.order.state).toBe("PLACED");
    expect(
      lateCapture(recovered.order, facts(), context({ at: 301 })).effects,
    ).toEqual([]);
    for (const patch of [
      { stockReacquired: false },
      { couponReacquired: false },
      { allLinesEligible: false },
      { capturedPaise: 9999 },
    ]) {
      const result = lateCapture(
        order({ state: "EXPIRED" }),
        facts(patch),
        context({ at: 300 }),
      );
      expect(result.order).toMatchObject({
        state: "EXPIRED",
        fulfillmentException: "REFUND_REQUIRED",
      });
      expect(result.effects).toEqual(["request-refund-review"]);
    }
    expect(
      lateCapture(order({ state: "CANCELLED" }), facts(), context({ at: 300 }))
        .order,
    ).toMatchObject({
      state: "CANCELLED",
      fulfillmentException: "REFUND_REQUIRED",
    });
  });
});

it("a failed old attempt cannot downgrade a captured newer payment", () => {
  const captured = attempt("CAPTURED");
  const failed = {
    ...attempt("FAILED"),
    providerPaymentId: "failed-old-attempt",
  };
  expect(summarizePayments(10000, [captured, failed])).toMatchObject({
    capturedPaise: 10000,
    state: "PAID",
    fulfillmentEligible: true,
  });
  expect(summarizePayments(10000, [failed, captured])).toEqual(
    summarizePayments(10000, [captured, failed]),
  );
  expect(() => summarizePayments(10000, [captured, captured])).toThrow(
    "DUPLICATE_PAYMENT_IDENTITY",
  );
  expect(
    summarizePayments(
      10000,
      [captured],
      [{ id: "refund", amountPaise: 1, state: "PENDING" }],
    ),
  ).toMatchObject({ state: "PAID", fulfillmentEligible: false });
  expect(() =>
    transitionOrder(
      order({ state: "PROCESSING" }),
      "SHIPPED",
      facts({ pendingRefundPaise: 1 }),
      context(),
    ),
  ).toThrow("INVALID_ORDER_TRANSITION");
});
