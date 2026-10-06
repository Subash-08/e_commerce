import { identifier, integer, requireFact } from "../../shared/domain/errors";
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
import { financialSummary } from "../payments/state";
export interface OrderLifecycle extends Versioned {
  readonly id: string;
  readonly state: StateValue<"OrderState">;
  readonly paymentMode: "ONLINE" | "COD";
  readonly expiresAt: number;
  readonly fulfillmentException: StateValue<"FulfillmentException">;
}
export interface OrderFacts {
  readonly requiredPaise: number;
  readonly capturedPaise: number;
  readonly refundedPaise: number;
  readonly pendingRefundPaise: number;
  readonly verifiedPayment: boolean;
  readonly codEligible: boolean;
  readonly cancellationAllowed: boolean;
  readonly trackingRecorded: boolean;
  readonly deliveryConfirmed: boolean;
  readonly allLinesEligible: boolean;
  readonly stockReacquired: boolean;
  readonly couponReacquired: boolean;
}
function validate(order: OrderLifecycle, facts: OrderFacts) {
  identifier(order.id);
  integer(order.expiresAt);
  requireFact(
    stateValues.OrderState.includes(order.state) &&
      stateValues.FulfillmentException.includes(order.fulfillmentException) &&
      ["ONLINE", "COD"].includes(order.paymentMode),
    "INVALID_ORDER_STATE",
  );
  return financialSummary(
    facts.requiredPaise,
    facts.capturedPaise,
    facts.refundedPaise,
    facts.pendingRefundPaise,
  );
}
export function transitionOrder(
  order: OrderLifecycle,
  nextState: StateValue<"OrderState">,
  facts: OrderFacts,
  context: TransitionContext,
) {
  const financial = validate(order, facts);
  requireFact(
    stateValues.OrderState.includes(nextState),
    "INVALID_ORDER_STATE",
  );
  const entry = auditTransition(order, context, { nextState, facts });
  if (!entry) return { order, effects: [] as string[], replayed: true };
  const fullCapture =
    facts.verifiedPayment === true && financial.fulfillmentEligible;
  const canFulfill =
    order.fulfillmentException === "NONE" &&
    financial.exception === "NONE" &&
    facts.refundedPaise === 0 &&
    facts.pendingRefundPaise === 0 &&
    (order.paymentMode === "COD" ? facts.codEligible === true : fullCapture);
  const edge = order.state + ">" + nextState;
  let allowed = false;
  let effects: string[] = [];
  switch (edge) {
    case "PENDING_PAYMENT>PLACED":
      allowed =
        order.paymentMode === "ONLINE" &&
        fullCapture &&
        order.fulfillmentException === "NONE" &&
        context.at < order.expiresAt;
      effects = ["consume-tracked-reservations", "consume-coupon-claim"];
      break;
    case "PLACED>CONFIRMED":
    case "CONFIRMED>PROCESSING":
      allowed = canFulfill;
      break;
    case "PROCESSING>SHIPPED":
      allowed = canFulfill && facts.trackingRecorded === true;
      effects =
        order.paymentMode === "COD"
          ? ["consume-tracked-reservations", "consume-coupon-claim"]
          : [];
      break;
    case "SHIPPED>DELIVERED":
      allowed = canFulfill && facts.deliveryConfirmed === true;
      break;
    case "PENDING_PAYMENT>EXPIRED":
      allowed =
        order.paymentMode === "ONLINE" &&
        context.at >= order.expiresAt &&
        facts.verifiedPayment === true &&
        facts.capturedPaise === 0;
      effects = [
        "release-active-tracked-reservations",
        "release-held-coupon-claim",
      ];
      break;
    case "EXPIRED>PLACED":
      allowed =
        order.paymentMode === "ONLINE" &&
        fullCapture &&
        facts.allLinesEligible === true &&
        facts.stockReacquired === true &&
        facts.couponReacquired === true;
      effects = [
        "consume-new-tracked-reservations",
        "consume-new-coupon-claim",
      ];
      break;
    default:
      if (
        nextState === "CANCELLED" &&
        ["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PROCESSING"].includes(
          order.state,
        )
      ) {
        allowed =
          facts.cancellationAllowed === true && facts.verifiedPayment === true;
        effects = [
          "release-active-tracked-reservations",
          "release-held-coupon-claim",
        ];
        if (financial.netPaise > 0) effects.push("request-refund-review");
      }
  }
  requireFact(allowed, "INVALID_ORDER_TRANSITION");
  return {
    order: {
      ...order,
      ...advance(order, entry, [{ from: order.state, to: nextState }]),
      state: nextState,
      fulfillmentException:
        nextState === "PLACED"
          ? ("NONE" as const)
          : nextState === "CANCELLED" && financial.netPaise > 0
            ? ("REFUND_REQUIRED" as const)
            : order.fulfillmentException,
    },
    effects,
    replayed: false,
  };
}
/** Provider proof and atomic stock/coupon acquisition are trusted service facts, not browser inputs. */
export function lateCapture(
  order: OrderLifecycle,
  facts: OrderFacts,
  context: TransitionContext,
) {
  const financial = validate(order, facts);
  const entry = auditTransition(order, context, { action: "late-capture", facts });
  if (!entry) return { order, effects: [] as string[], replayed: true };
  const overduePending = order.state === "PENDING_PAYMENT" &&
    order.paymentMode === "ONLINE" && context.at >= order.expiresAt;
  requireFact(
    (order.state === "EXPIRED" || order.state === "CANCELLED" || overduePending) &&
      facts.verifiedPayment === true && facts.capturedPaise > 0,
    "INVALID_LATE_CAPTURE",
  );
  const expiredState = overduePending ? "EXPIRED" as const : order.state;
  const canRecover = expiredState === "EXPIRED" && order.paymentMode === "ONLINE" &&
    financial.fulfillmentEligible && facts.allLinesEligible === true &&
    facts.stockReacquired === true && facts.couponReacquired === true;
  const nextState = canRecover ? "PLACED" as const : expiredState;
  const transitions: { from: StateValue<"OrderState">; to: StateValue<"OrderState"> }[] = overduePending
    ? [{ from: order.state, to: "EXPIRED" }]
    : [];
  if (canRecover) transitions.push({ from: "EXPIRED", to: "PLACED" });
  // One atomic proposal. The future service must release old generations before
  // reacquiring/consuming new ones, and persist the capture even when recovery fails.
  const effects = overduePending
    ? ["release-expired-tracked-reservations", "release-expired-coupon-claim"]
    : [];
  effects.push(...(canRecover
    ? ["consume-new-tracked-reservations", "consume-new-coupon-claim"]
    : ["request-refund-review"]));
  return {
    order: {
      ...order,
      ...advance(order, entry, transitions),
      state: nextState,
      fulfillmentException: canRecover ? "NONE" as const : "REFUND_REQUIRED" as const,
    },
    effects,
    replayed: false,
  };
}
