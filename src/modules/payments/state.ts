import { identifier, requireFact } from "../../shared/domain/errors";
import {
  stateValues,
  type StateValue,
} from "../../shared/domain/states.generated";
import {
  advance,
  auditTransition,
  type TransitionContext,
  type Versioned,
} from "../../shared/domain/transition";
import { paise, subtractPaise, sumPaise } from "../pricing/money";
export interface PaymentAttempt extends Versioned {
  readonly provider: string;
  readonly providerPaymentId: string;
  readonly amountPaise: number;
  readonly currency: "INR";
  readonly state: StateValue<"PaymentState">;
}
export function transitionPayment(
  attempt: PaymentAttempt,
  observation: {
    readonly provider: string;
    readonly providerPaymentId: string;
    readonly amountPaise: number;
    readonly currency: string;
    readonly state: StateValue<"PaymentState">;
    readonly verified: boolean;
  },
  context: TransitionContext,
) {
  identifier(attempt.provider);
  identifier(attempt.providerPaymentId);
  paise(attempt.amountPaise);
  paise(observation.amountPaise);
  requireFact(
    stateValues.PaymentState.includes(attempt.state) &&
      stateValues.PaymentState.includes(observation.state),
    "INVALID_PAYMENT_STATE",
  );
  requireFact(
    observation.verified === true &&
      observation.provider === attempt.provider &&
      observation.providerPaymentId === attempt.providerPaymentId &&
      observation.amountPaise === attempt.amountPaise &&
      observation.currency === attempt.currency &&
      attempt.currency === "INR",
    "PAYMENT_PROOF_MISMATCH",
  );
  const entry = auditTransition(attempt, context, observation);
  if (!entry || attempt.state === observation.state)
    return { attempt, capturedDeltaPaise: paise(0), replayed: true };
  const permitted =
    (attempt.state === "PENDING" &&
      ["AUTHORIZED", "CAPTURED", "FAILED"].includes(observation.state)) ||
    (attempt.state === "AUTHORIZED" &&
      ["CAPTURED", "FAILED"].includes(observation.state)) ||
    (attempt.state === "FAILED" && observation.state === "CAPTURED");
  requireFact(permitted, "INVALID_PAYMENT_TRANSITION");
  return {
    attempt: {
      ...attempt,
      ...advance(attempt, entry, [{ from: attempt.state, to: observation.state }]),
      state: observation.state,
    },
    capturedDeltaPaise: paise(
      observation.state === "CAPTURED" ? attempt.amountPaise : 0,
    ),
    replayed: false,
  };
}
export function financialSummary(
  requiredPaise: number,
  capturedPaise: number,
  refundedPaise: number,
  pendingRefundPaise = 0,
) {
  paise(requiredPaise);
  paise(capturedPaise);
  paise(refundedPaise);
  paise(pendingRefundPaise);
  requireFact(
    sumPaise([refundedPaise, pendingRefundPaise]) <= capturedPaise,
    "REFUND_EXCEEDS_CAPTURE",
  );
  const state: StateValue<"FinancialState"> =
    capturedPaise > 0 && refundedPaise === capturedPaise
      ? "REFUNDED"
      : refundedPaise > 0
        ? "PARTIALLY_REFUNDED"
        : capturedPaise >= requiredPaise && capturedPaise > 0
          ? "PAID"
          : "PENDING";
  const exception: StateValue<"FulfillmentException"> =
    capturedPaise !== 0 && capturedPaise !== requiredPaise
      ? "REVIEW_REQUIRED"
      : "NONE";
  return {
    state,
    exception,
    netPaise: subtractPaise(capturedPaise, refundedPaise),
    fulfillmentEligible:
      capturedPaise === requiredPaise &&
      refundedPaise === 0 &&
      pendingRefundPaise === 0 &&
      exception === "NONE",
  };
}
export interface RefundClaim {
  readonly id: string;
  readonly amountPaise: number;
  readonly state: StateValue<"RefundState">;
}
export interface RefundLedger extends Versioned {
  readonly capturedPaise: number;
  readonly claims: readonly RefundClaim[];
}
function validateLedger(ledger: RefundLedger) {
  paise(ledger.capturedPaise);
  requireFact(
    new Set(ledger.claims.map((c) => c.id)).size === ledger.claims.length,
    "DUPLICATE_REFUND",
  );
  for (const claim of ledger.claims) {
    identifier(claim.id);
    requireFact(
      paise(claim.amountPaise) > 0 &&
        stateValues.RefundState.includes(claim.state),
      "INVALID_REFUND",
    );
  }
  requireFact(
    sumPaise(
      ledger.claims
        .filter((c) => c.state !== "FAILED")
        .map((c) => c.amountPaise),
    ) <= ledger.capturedPaise,
    "REFUND_EXCEEDS_CAPTURE",
  );
}
export function claimRefund(
  ledger: RefundLedger,
  id: string,
  amountPaise: number,
  context: TransitionContext,
): RefundLedger {
  validateLedger(ledger);
  identifier(id);
  requireFact(paise(amountPaise) > 0, "INVALID_REFUND");
  const entry = auditTransition(ledger, context, {
    action: "claim",
    id,
    amountPaise,
  });
  if (!entry) return ledger;
  const existing = ledger.claims.find((c) => c.id === id);
  if (existing) {
    requireFact(existing.amountPaise === amountPaise, "IDEMPOTENCY_CONFLICT");
    return ledger;
  }
  const next: RefundLedger = {
    ...ledger,
    ...advance(ledger, entry),
    claims: [...ledger.claims, { id, amountPaise, state: "PENDING" }],
  };
  validateLedger(next);
  return next;
}
export function transitionRefund(
  ledger: RefundLedger,
  id: string,
  nextState: StateValue<"RefundState">,
  evidence: { readonly verified: boolean; readonly providerResolved: boolean },
  context: TransitionContext,
): RefundLedger {
  validateLedger(ledger);
  identifier(id);
  requireFact(
    stateValues.RefundState.includes(nextState) &&
      evidence.verified === true &&
      evidence.providerResolved === true,
    "REFUND_PROOF_REQUIRED",
  );
  const entry = auditTransition(ledger, context, {
    action: "transition",
    id,
    nextState,
    evidence,
  });
  if (!entry) return ledger;
  const claim = ledger.claims.find((c) => c.id === id);
  requireFact(claim, "REFUND_NOT_FOUND");
  if (claim.state === nextState) return ledger;
  requireFact(
    (claim.state === "PENDING" &&
      (nextState === "SUCCEEDED" || nextState === "FAILED")) ||
      (claim.state === "FAILED" &&
        (nextState === "PENDING" || nextState === "SUCCEEDED")),
    "INVALID_REFUND_TRANSITION",
  );
  const next = {
    ...ledger,
    ...advance(ledger, entry, [{ from: claim.state, to: nextState }]),
    claims: ledger.claims.map((c) =>
      c.id === id ? { ...c, state: nextState } : c,
    ),
  };
  validateLedger(next);
  return next;
}

/** Aggregate persisted attempt identities, never the most recent callback status. */
export function summarizePayments(
  requiredPaise: number,
  attempts: readonly PaymentAttempt[],
  claims: readonly RefundClaim[] = [],
) {
  const identities = new Set<string>();
  for (const attempt of attempts) {
    identifier(attempt.provider);
    identifier(attempt.providerPaymentId);
    paise(attempt.amountPaise);
    requireFact(
      attempt.currency === "INR" &&
        stateValues.PaymentState.includes(attempt.state),
      "INVALID_PAYMENT_STATE",
    );
    const identity = JSON.stringify([
      attempt.provider,
      attempt.providerPaymentId,
    ]);
    requireFact(!identities.has(identity), "DUPLICATE_PAYMENT_IDENTITY");
    identities.add(identity);
  }
  const capturedPaise = sumPaise(
    attempts.filter((a) => a.state === "CAPTURED").map((a) => a.amountPaise),
  );
  validateLedger({ capturedPaise, claims, revision: 0, history: [] });
  const refundedPaise = sumPaise(
    claims.filter((c) => c.state === "SUCCEEDED").map((c) => c.amountPaise),
  );
  const pendingRefundPaise = sumPaise(
    claims.filter((c) => c.state === "PENDING").map((c) => c.amountPaise),
  );
  return {
    capturedPaise,
    refundedPaise,
    pendingRefundPaise,
    ...financialSummary(
      requiredPaise,
      capturedPaise,
      refundedPaise,
      pendingRefundPaise,
    ),
  };
}
