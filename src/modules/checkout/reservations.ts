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
export interface Reservation {
  readonly id: string;
  readonly orderId: string;
  readonly generation: number;
  readonly quantity: number;
  readonly expiresAt: number;
  readonly autoExpire: boolean;
  readonly state: StateValue<"ReservationState">;
}
export interface TrackedStock extends Versioned {
  readonly variantId: string;
  readonly trackQuantity: true;
  readonly onHand: number;
  readonly reserved: number;
  readonly reservations: readonly Reservation[];
}
export interface StatusStock extends Versioned {
  readonly variantId: string;
  readonly trackQuantity: false;
  readonly stockStatus: StateValue<"StockStatus">;
}
export type StockSnapshot = TrackedStock | StatusStock;
export type ReservationRequest = Omit<Reservation, "state">;
export function availableQuantity(stock: TrackedStock): number {
  validateStock(stock);
  return stock.onHand - stock.reserved;
}
function validateStock(stock: StockSnapshot) {
  identifier(stock.variantId);
  integer(stock.revision);
  if (!stock.trackQuantity) {
    requireFact(
      stateValues.StockStatus.includes(stock.stockStatus),
      "INVALID_STOCK_STATUS",
    );
    return;
  }
  integer(stock.onHand);
  integer(stock.reserved);
  requireFact(stock.reserved <= stock.onHand, "INVALID_STOCK_BALANCE");
  requireFact(
    new Set(stock.reservations.map((r) => r.id)).size ===
      stock.reservations.length,
    "DUPLICATE_RESERVATION",
  );
  let active = BigInt(0);
  const identities = new Set<string>();
  const activeOrders = new Set<string>();
  for (const r of stock.reservations) {
    identifier(r.id);
    identifier(r.orderId);
    integer(r.quantity, 1, 99);
    integer(r.generation);
    integer(r.expiresAt);
    requireFact(
      typeof r.autoExpire === "boolean" &&
        stateValues.ReservationState.includes(r.state),
      "INVALID_RESERVATION",
    );
    const identity = JSON.stringify([r.orderId, r.generation]);
    requireFact(!identities.has(identity), "DUPLICATE_GENERATION");
    identities.add(identity);
    if (r.state === "ACTIVE") {
      requireFact(!activeOrders.has(r.orderId), "ACTIVE_RESERVATION_EXISTS");
      activeOrders.add(r.orderId);
      active += BigInt(r.quantity);
    }
  }
  requireFact(
    active === BigInt(stock.reserved),
    "RESERVATION_BALANCE_MISMATCH",
  );
}
export function reserveStock(
  stock: StockSnapshot,
  request: ReservationRequest,
  context: TransitionContext,
) {
  validateStock(stock);
  identifier(request.id);
  identifier(request.orderId);
  integer(request.quantity, 1, 99);
  integer(request.generation);
  integer(request.expiresAt);
  requireFact(typeof request.autoExpire === "boolean", "INVALID_RESERVATION");
  const entry = auditTransition(stock, context, { action: "reserve", request });
  if (!stock.trackQuantity) {
    requireFact(stock.stockStatus === "IN_STOCK", "OUT_OF_STOCK");
    return { stock, reservation: null, replayed: false };
  }
  if (!entry)
    return {
      stock,
      reservation: stock.reservations.find((r) => r.id === request.id)!,
      replayed: true,
    };
  const existing = stock.reservations.find((r) => r.id === request.id);
  if (existing) {
    requireFact(
      existing.orderId === request.orderId &&
        existing.quantity === request.quantity &&
        existing.generation === request.generation &&
        existing.expiresAt === request.expiresAt &&
        existing.autoExpire === request.autoExpire,
      "IDEMPOTENCY_CONFLICT",
    );
    return { stock, reservation: existing, replayed: true };
  }
  requireFact(
    !request.autoExpire || context.at < request.expiresAt,
    "RESERVATION_EXPIRED",
  );
  const previous = stock.reservations.filter(
    (r) => r.orderId === request.orderId,
  );
  requireFact(
    previous.every((r) => r.state !== "ACTIVE"),
    "ACTIVE_RESERVATION_EXISTS",
  );
  const generation = previous.length
    ? Math.max(...previous.map((r) => r.generation)) + 1
    : 0;
  requireFact(
    request.generation === generation,
    "INVALID_RESERVATION_GENERATION",
  );
  requireFact(
    stock.onHand - stock.reserved >= request.quantity,
    "INSUFFICIENT_STOCK",
  );
  const reservation: Reservation = { ...request, state: "ACTIVE" };
  const next: TrackedStock = {
    ...stock,
    ...advance(stock, entry),
    reserved: stock.reserved + request.quantity,
    reservations: [...stock.reservations, reservation],
  };
  validateStock(next);
  return { stock: next, reservation, replayed: false };
}
export function resolveReservation(
  stock: TrackedStock,
  id: string,
  nextState: StateValue<"ReservationState">,
  facts: {
    readonly cause: "capture" | "shipment" | "expiry" | "cancellation";
    readonly verified: boolean;
    readonly capturePresent: boolean;
  },
  context: TransitionContext,
) {
  validateStock(stock);
  identifier(id);
  requireFact(
    stock.trackQuantity === true &&
      (nextState === "CONSUMED" || nextState === "RELEASED") &&
      facts.verified === true,
    "INVALID_RESERVATION_TRANSITION",
  );
  const entry = auditTransition(stock, context, {
    action: "resolve",
    id,
    nextState,
    facts,
  });
  const reservation = stock.reservations.find((r) => r.id === id);
  requireFact(reservation, "RESERVATION_NOT_FOUND");
  if (!entry || reservation.state === nextState)
    return { stock, reservation, replayed: true };
  requireFact(reservation.state === "ACTIVE", "RESERVATION_ALREADY_RESOLVED");
  if (nextState === "CONSUMED") {
    requireFact(
      reservation.autoExpire
        ? facts.cause === "capture" &&
            facts.capturePresent === true &&
            context.at < reservation.expiresAt
        : facts.cause === "shipment",
      "RESERVATION_NOT_CONSUMABLE",
    );
  } else {
    requireFact(
      facts.cause === "cancellation" ||
        (facts.cause === "expiry" &&
          reservation.autoExpire &&
          context.at >= reservation.expiresAt &&
          facts.capturePresent === false),
      "RESERVATION_NOT_RELEASABLE",
    );
  }
  const nextReservation = { ...reservation, state: nextState };
  const next: TrackedStock = {
    ...stock,
    ...advance(stock, entry, [{ from: reservation.state, to: nextState }]),
    reserved: stock.reserved - reservation.quantity,
    onHand:
      nextState === "CONSUMED"
        ? stock.onHand - reservation.quantity
        : stock.onHand,
    reservations: stock.reservations.map((r) =>
      r.id === id ? nextReservation : r,
    ),
  };
  validateStock(next);
  return { stock: next, reservation: nextReservation, replayed: false };
}
