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
  it("enforces that pending and successful refund claims together cannot exceed capture and CAS race yields exactly one winner", async () => {
    const initialLedger: RefundLedger = {
      capturedPaise: 10000,
      claims: [],
      revision: 0,
      history: [],
    };
    const step1 = claimRefund(
      initialLedger,
      "succ-claim",
      4000,
      context({ operationId: "claim-s", expectedRevision: 0 }),
    );
    const step2 = transitionRefund(
      step1,
      "succ-claim",
      "SUCCEEDED",
      { verified: true, providerResolved: true },
      context({ operationId: "trans-s", expectedRevision: 1 }),
    );
    const step3 = claimRefund(
      step2,
      "pend-claim",
      3000,
      context({ operationId: "claim-p", expectedRevision: 2 }),
    );
    expect(() =>
      claimRefund(
        step3,
        "overflow-claim",
        3001,
        context({ operationId: "claim-over", expectedRevision: 3 }),
      ),
    ).toThrow("REFUND_EXCEEDS_CAPTURE");

    let current = step3;
    const initial = current;
    const results = await Promise.all(
      ["race-claim-a", "race-claim-b"].map(async (opId) => {
        const proposal = claimRefund(
          initial,
          opId,
          3000,
          context({
            operationId: opId,
            expectedRevision: initial.revision,
            at: 200,
          }),
        );
        await Promise.resolve();
        if (current.revision !== initial.revision) return "REVISION_CONFLICT";
        current = proposal;
        return "WON";
      }),
    );
    expect(results.sort()).toEqual(["REVISION_CONFLICT", "WON"]);
    expect(current.claims.filter((c) => c.state !== "FAILED")).toHaveLength(3);

    expect(() =>
      claimRefund(
        current,
        "subsequent-claim",
        1,
        context({
          operationId: "subsequent",
          expectedRevision: current.revision,
          at: 201,
        }),
      ),
    ).toThrow("REFUND_EXCEEDS_CAPTURE");
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
  it.each([200, 250])(
    "overdue PENDING_PAYMENT online order at timestamp %d receives verified full capture and composite audit path",
    (timestamp) => {
      const overdue = order({
        state: "PENDING_PAYMENT",
        paymentMode: "ONLINE",
        expiresAt: 200,
        revision: 0,
      });
      const result = lateCapture(
        overdue,
        facts({
          allLinesEligible: true,
          stockReacquired: true,
          couponReacquired: true,
          verifiedPayment: true,
          capturedPaise: 10000,
          requiredPaise: 10000,
        }),
        context({ at: timestamp, expectedRevision: 0 }),
      );
      expect(result.order.state).toBe("PLACED");
      expect(result.order.fulfillmentException).toBe("NONE");
      expect(result.order.revision).toBe(1);
      expect(result.order.history).toHaveLength(1);
      expect(result.order.history[0].transitions).toEqual([
        { from: "PENDING_PAYMENT", to: "EXPIRED" },
        { from: "EXPIRED", to: "PLACED" },
      ]);
      expect(result.effects).toEqual([
        "release-expired-tracked-reservations",
        "release-expired-coupon-claim",
        "consume-new-tracked-reservations",
        "consume-new-coupon-claim",
      ]);
      const oldReleaseIdx = result.effects.indexOf(
        "release-expired-tracked-reservations",
      );
      const newConsumeIdx = result.effects.indexOf(
        "consume-new-tracked-reservations",
      );
      expect(oldReleaseIdx).toBeLessThan(newConsumeIdx);
    },
  );
  it.each([
    ["no stock capacity", { stockReacquired: false }],
    ["no coupon capacity", { couponReacquired: false }],
    ["unavailable status-only line", { allLinesEligible: false }],
    ["partial capture", { capturedPaise: 5000 }],
    ["extra capture", { capturedPaise: 15000 }],
    ["pending refund", { pendingRefundPaise: 1000 }],
  ])(
    "overdue pending order under failure condition (%s) remains EXPIRED with REFUND_REQUIRED",
    (_, patch) => {
      const overdue = order({
        state: "PENDING_PAYMENT",
        paymentMode: "ONLINE",
        expiresAt: 200,
        revision: 0,
      });
      const orderFacts = facts({
        capturedPaise: 10000,
        ...patch,
      });
      const result = lateCapture(
        overdue,
        orderFacts,
        context({ at: 250, expectedRevision: 0 }),
      );
      expect(result.order.state).toBe("EXPIRED");
      expect(result.order.fulfillmentException).toBe("REFUND_REQUIRED");
      expect(result.order.history[0].transitions).toEqual([
        { from: "PENDING_PAYMENT", to: "EXPIRED" },
      ]);
      expect(orderFacts.capturedPaise).toBeGreaterThan(0);
      expect(result.effects).toContain("release-expired-tracked-reservations");
      expect(result.effects).toContain("release-expired-coupon-claim");
      expect(result.effects).toContain("request-refund-review");
      expect(result.effects).not.toContain("consume-new-tracked-reservations");
      expect(result.effects).not.toContain("consume-new-coupon-claim");
    },
  );
  it("rejects lateCapture for pending online order before deadline and for COD pending orders", () => {
    const beforeDeadline = order({
      state: "PENDING_PAYMENT",
      paymentMode: "ONLINE",
      expiresAt: 200,
    });
    expect(() =>
      lateCapture(beforeDeadline, facts(), context({ at: 199 })),
    ).toThrow("INVALID_LATE_CAPTURE");

    const ordinaryPlaced = transitionOrder(
      beforeDeadline,
      "PLACED",
      facts(),
      context({ at: 199 }),
    );
    expect(ordinaryPlaced.order.state).toBe("PLACED");
    expect(ordinaryPlaced.order.fulfillmentException).toBe("NONE");

    const codPending = order({
      state: "PENDING_PAYMENT",
      paymentMode: "COD",
      expiresAt: 200,
    });
    expect(() =>
      lateCapture(codPending, facts(), context({ at: 200 })),
    ).toThrow("INVALID_LATE_CAPTURE");
    expect(() =>
      lateCapture(codPending, facts(), context({ at: 250 })),
    ).toThrow("INVALID_LATE_CAPTURE");
  });
  it("replays exact late-capture operation idempotently and rejects conflicting changed facts", () => {
    const overdue = order({
      state: "PENDING_PAYMENT",
      paymentMode: "ONLINE",
      expiresAt: 200,
      revision: 0,
    });
    const opContext = context({
      operationId: "late-cap-replay-op",
      expectedRevision: 0,
      at: 250,
    });
    const recovered = lateCapture(overdue, facts(), opContext);
    expect(recovered.replayed).toBe(false);
    expect(recovered.order.revision).toBe(1);

    const replay1 = lateCapture(recovered.order, facts(), opContext);
    expect(replay1.replayed).toBe(true);
    expect(replay1.order).toBe(recovered.order);
    expect(replay1.effects).toEqual([]);
    expect(replay1.order.revision).toBe(1);
    expect(replay1.order.history).toHaveLength(1);

    const confirmed = transitionOrder(
      recovered.order,
      "CONFIRMED",
      facts(),
      context({
        operationId: "confirm-next-op",
        expectedRevision: 1,
        at: 260,
      }),
    );
    expect(confirmed.order.state).toBe("CONFIRMED");
    expect(confirmed.order.revision).toBe(2);

    const replayAfterConfirmed = lateCapture(
      confirmed.order,
      facts(),
      opContext,
    );
    expect(replayAfterConfirmed.replayed).toBe(true);
    expect(replayAfterConfirmed.order).toBe(confirmed.order);
    expect(replayAfterConfirmed.effects).toEqual([]);
    expect(replayAfterConfirmed.order.revision).toBe(2);
    expect(replayAfterConfirmed.order.history).toHaveLength(2);

    expect(() =>
      lateCapture(recovered.order, facts({ capturedPaise: 5000 }), opContext),
    ).toThrow("IDEMPOTENCY_CONFLICT");
    expect(() =>
      lateCapture(
        confirmed.order,
        facts({ stockReacquired: false }),
        opContext,
      ),
    ).toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("retains actor, reason, operation, time and from/to transition paths across order, payment and refund audits", () => {
    const orderRes = transitionOrder(
      order({ state: "PENDING_PAYMENT" }),
      "PLACED",
      facts(),
      context({
        actorId: "actor-order-1",
        reason: "verified payment placed order",
        operationId: "op-order-transition",
        at: 140,
        expectedRevision: 0,
      }),
    );
    expect(orderRes.order.history).toHaveLength(1);
    const orderAudit = orderRes.order.history[0];
    expect(orderAudit).toMatchObject({
      actorId: "actor-order-1",
      reason: "verified payment placed order",
      operationId: "op-order-transition",
      at: 140,
      transitions: [{ from: "PENDING_PAYMENT", to: "PLACED" }],
    });

    const payRes = transitionPayment(
      attempt("PENDING"),
      observation("CAPTURED"),
      context({
        actorId: "actor-payment-1",
        reason: "webhook full capture",
        operationId: "op-payment-transition",
        at: 145,
        expectedRevision: 0,
      }),
    );
    expect(payRes.attempt.history).toHaveLength(1);
    const payAudit = payRes.attempt.history[0];
    expect(payAudit).toMatchObject({
      actorId: "actor-payment-1",
      reason: "webhook full capture",
      operationId: "op-payment-transition",
      at: 145,
      transitions: [{ from: "PENDING", to: "CAPTURED" }],
    });

    const baseLedger: RefundLedger = {
      capturedPaise: 10000,
      claims: [],
      revision: 0,
      history: [],
    };
    const claimed = claimRefund(
      baseLedger,
      "refund-audit-1",
      5000,
      context({
        actorId: "actor-claim-1",
        reason: "customer requested refund",
        operationId: "op-claim-refund",
        at: 150,
        expectedRevision: 0,
      }),
    );
    const refunded = transitionRefund(
      claimed,
      "refund-audit-1",
      "SUCCEEDED",
      { verified: true, providerResolved: true },
      context({
        actorId: "actor-refund-trans",
        reason: "provider processed refund",
        operationId: "op-refund-transition",
        at: 155,
        expectedRevision: 1,
      }),
    );
    expect(refunded.history).toHaveLength(2);
    const refundAudit = refunded.history[1];
    expect(refundAudit).toMatchObject({
      actorId: "actor-refund-trans",
      reason: "provider processed refund",
      operationId: "op-refund-transition",
      at: 155,
      transitions: [{ from: "PENDING", to: "SUCCEEDED" }],
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
