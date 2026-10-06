import { describe, expect, it } from "vitest";
import {
  reserveStock,
  resolveReservation,
  availableQuantity,
  type TrackedStock,
} from "../../src/modules/checkout/reservations";
import { lateCapture, transitionOrder } from "../../src/modules/orders/state";
import { context, facts, order, reservation, stock } from "../fixtures/domain";
const expire = {
  cause: "expiry" as const,
  verified: true,
  capturePresent: false,
};
const capture = {
  cause: "capture" as const,
  verified: true,
  capturePresent: true,
};
const tracked = (
  value: ReturnType<typeof reserveStock>["stock"],
): TrackedStock => {
  if (!value.trackQuantity) throw new Error("expected tracked");
  return value;
};
describe("tracked reservation invariants", () => {
  it("STOCK-01 concurrent reservation of the last unit yields exactly one winner under in-memory CAS", async () => {
    let current = stock();
    const initial = current;
    const results = await Promise.all(
      ["a", "b"].map(async (id) => {
        const proposal = reserveStock(
          initial,
          reservation({ id, orderId: id }),
          context({ operationId: id }),
        );
        await Promise.resolve();
        if (current.revision !== initial.revision) return "REVISION_CONFLICT";
        current = tracked(proposal.stock);
        return "WON";
      }),
    );
    expect(results.sort()).toEqual(["REVISION_CONFLICT", "WON"]);
    expect(availableQuantity(current)).toBe(0);
    expect(() =>
      reserveStock(
        current,
        reservation({ id: "retry", orderId: "retry" }),
        context({ expectedRevision: 1, operationId: "retry" }),
      ),
    ).toThrow("INSUFFICIENT_STOCK");
  });
  it("expiry releases availability exactly once, including concurrent duplicate release proposals", async () => {
    const held = tracked(reserveStock(stock(), reservation(), context()).stock);
    let current = held;
    const proposals = await Promise.all(
      ["expire-a", "expire-b"].map(async (operationId) => {
        const next = resolveReservation(
          held,
          "hold-1",
          "RELEASED",
          expire,
          context({ operationId, expectedRevision: 1, at: 200 }),
        ).stock;
        await Promise.resolve();
        if (current.revision !== held.revision) return false;
        current = next;
        return true;
      }),
    );
    expect(proposals.filter(Boolean)).toHaveLength(1);
    expect(availableQuantity(current)).toBe(1);
    expect(
      resolveReservation(
        current,
        "hold-1",
        "RELEASED",
        expire,
        context({ operationId: "retry", expectedRevision: 2, at: 201 }),
      ).stock,
    ).toBe(current);
    expect(current.onHand).toBe(1);
    expect(current.reserved).toBe(0);
  });
  it("capture consumes once and terminal states cannot flip", () => {
    const held = tracked(reserveStock(stock(), reservation(), context()).stock);
    const consumed = resolveReservation(
      held,
      "hold-1",
      "CONSUMED",
      capture,
      context({ operationId: "capture", expectedRevision: 1, at: 150 }),
    ).stock;
    expect(consumed).toMatchObject({ onHand: 0, reserved: 0 });
    expect(
      resolveReservation(
        consumed,
        "hold-1",
        "CONSUMED",
        capture,
        context({ operationId: "duplicate", expectedRevision: 2, at: 151 }),
      ).stock,
    ).toBe(consumed);
    expect(() =>
      resolveReservation(
        consumed,
        "hold-1",
        "RELEASED",
        expire,
        context({ operationId: "expire", expectedRevision: 2, at: 200 }),
      ),
    ).toThrow("RESERVATION_ALREADY_RESOLVED");
  });
  it("untracked stock creates no reservation or synthetic quantity and rejects unavailable status", () => {
    const input = {
      variantId: "status-only",
      trackQuantity: false as const,
      stockStatus: "IN_STOCK" as const,
      revision: 0,
      history: [],
    };
    const result = reserveStock(input, reservation(), context());
    expect(result.stock).toBe(input);
    expect(result.reservation).toBeNull();
    expect("reserved" in result.stock).toBe(false);
    expect(() =>
      reserveStock(
        { ...input, stockStatus: "OUT_OF_STOCK" },
        reservation(),
        context(),
      ),
    ).toThrow("OUT_OF_STOCK");
  });
  it("requires nonnegative conserved balances and distinct active order identities", () => {
    expect(() =>
      reserveStock(stock({ reserved: 1 }), reservation(), context()),
    ).toThrow("RESERVATION_BALANCE_MISMATCH");
    expect(() =>
      reserveStock(stock({ onHand: -1 }), reservation(), context()),
    ).toThrow();
    const held = tracked(
      reserveStock(stock({ onHand: 2 }), reservation(), context()).stock,
    );
    expect(() =>
      reserveStock(
        held,
        reservation({ id: "hold-2", generation: 1 }),
        context({ expectedRevision: 1, operationId: "new" }),
      ),
    ).toThrow("ACTIVE_RESERVATION_EXISTS");
    expect(() =>
      reserveStock(held, reservation({ quantity: 2 }), context()),
    ).toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("expiry and capture are deadline-guarded and COD does not use online expiry", () => {
    const held = tracked(reserveStock(stock(), reservation(), context()).stock);
    expect(() =>
      resolveReservation(
        held,
        "hold-1",
        "RELEASED",
        expire,
        context({ operationId: "e", expectedRevision: 1, at: 199 }),
      ),
    ).toThrow("RESERVATION_NOT_RELEASABLE");
    expect(() =>
      resolveReservation(
        held,
        "hold-1",
        "CONSUMED",
        capture,
        context({ operationId: "c", expectedRevision: 1, at: 200 }),
      ),
    ).toThrow("RESERVATION_NOT_CONSUMABLE");
    expect(() =>
      resolveReservation(
        held,
        "hold-1",
        "RELEASED",
        { ...expire, capturePresent: true },
        context({ operationId: "e", expectedRevision: 1, at: 200 }),
      ),
    ).toThrow();
    const cod = tracked(
      reserveStock(stock(), reservation({ autoExpire: false }), context())
        .stock,
    );
    expect(() =>
      resolveReservation(
        cod,
        "hold-1",
        "RELEASED",
        expire,
        context({ operationId: "e", expectedRevision: 1, at: 200 }),
      ),
    ).toThrow();
    expect(
      resolveReservation(
        cod,
        "hold-1",
        "CONSUMED",
        { cause: "shipment", verified: true, capturePresent: false },
        context({ operationId: "ship", expectedRevision: 1, at: 300 }),
      ).stock.onHand,
    ).toBe(0);
  });
  it("resolved reservation audit entries retain actor, reason, operation, time and from/to paths", () => {
    const held = tracked(
      reserveStock(
        stock(),
        reservation(),
        context({
          actorId: "actor-hold",
          reason: "checkout hold",
          operationId: "op-hold",
          at: 100,
        }),
      ).stock,
    );
    const consumed = resolveReservation(
      held,
      "hold-1",
      "CONSUMED",
      capture,
      context({
        actorId: "actor-cap",
        reason: "order capture consumption",
        operationId: "op-cap",
        expectedRevision: 1,
        at: 150,
      }),
    );
    expect(consumed.stock.history).toHaveLength(2);
    expect(consumed.stock.history[1]).toMatchObject({
      actorId: "actor-cap",
      reason: "order capture consumption",
      operationId: "op-cap",
      at: 150,
      transitions: [{ from: "ACTIVE", to: "CONSUMED" }],
    });

    const released = resolveReservation(
      held,
      "hold-1",
      "RELEASED",
      expire,
      context({
        actorId: "actor-rel",
        reason: "order expiry release",
        operationId: "op-rel",
        expectedRevision: 1,
        at: 200,
      }),
    );
    expect(released.stock.history).toHaveLength(2);
    expect(released.stock.history[1]).toMatchObject({
      actorId: "actor-rel",
      reason: "order expiry release",
      operationId: "op-rel",
      at: 200,
      transitions: [{ from: "ACTIVE", to: "RELEASED" }],
    });
  });
  it("exercises both serializations of expiry versus capture proposals against the same held-stock revision", () => {
    // Serialization 1: Expiry commits first, capture proposal becomes stale
    {
      const held = tracked(
        reserveStock(
          stock(),
          reservation(),
          context({ operationId: "hold-s1", at: 100 }),
        ).stock,
      );
      const initial = held;
      const expiryProposal = resolveReservation(
        initial,
        "hold-1",
        "RELEASED",
        expire,
        context({
          operationId: "exp-prop-1",
          expectedRevision: initial.revision,
          at: 200,
        }),
      ).stock;
      const captureProposal = resolveReservation(
        initial,
        "hold-1",
        "CONSUMED",
        capture,
        context({
          operationId: "cap-prop-1",
          expectedRevision: initial.revision,
          at: 150,
        }),
      ).stock;

      let current = initial;
      current = expiryProposal;
      expect(current.onHand).toBe(1);
      expect(current.reserved).toBe(0);

      expect(captureProposal.revision).toBe(initial.revision + 1);
      expect(current.revision === initial.revision).toBe(false);

      expect(() =>
        resolveReservation(
          current,
          "hold-1",
          "CONSUMED",
          capture,
          context({
            operationId: "cap-retry-1",
            expectedRevision: current.revision,
            at: 200,
          }),
        ),
      ).toThrow("RESERVATION_ALREADY_RESOLVED");

      const dupRelease = resolveReservation(
        current,
        "hold-1",
        "RELEASED",
        expire,
        context({
          operationId: "exp-dup-1",
          expectedRevision: current.revision,
          at: 201,
        }),
      );
      expect(dupRelease.stock).toBe(current);
      expect(dupRelease.replayed).toBe(true);
    }

    // Serialization 2: Capture commits first, expiry proposal becomes stale
    {
      const held = tracked(
        reserveStock(
          stock(),
          reservation(),
          context({ operationId: "hold-s2", at: 100 }),
        ).stock,
      );
      const initial = held;
      const expiryProposal = resolveReservation(
        initial,
        "hold-1",
        "RELEASED",
        expire,
        context({
          operationId: "exp-prop-2",
          expectedRevision: initial.revision,
          at: 200,
        }),
      ).stock;
      const captureProposal = resolveReservation(
        initial,
        "hold-1",
        "CONSUMED",
        capture,
        context({
          operationId: "cap-prop-2",
          expectedRevision: initial.revision,
          at: 150,
        }),
      ).stock;

      let current = initial;
      current = captureProposal;
      expect(current.onHand).toBe(0);
      expect(current.reserved).toBe(0);

      expect(expiryProposal.revision).toBe(initial.revision + 1);
      expect(current.revision === initial.revision).toBe(false);

      expect(() =>
        resolveReservation(
          current,
          "hold-1",
          "RELEASED",
          expire,
          context({
            operationId: "exp-retry-2",
            expectedRevision: current.revision,
            at: 200,
          }),
        ),
      ).toThrow("RESERVATION_ALREADY_RESOLVED");

      const dupCapture = resolveReservation(
        current,
        "hold-1",
        "CONSUMED",
        capture,
        context({
          operationId: "cap-dup-2",
          expectedRevision: current.revision,
          at: 151,
        }),
      );
      expect(dupCapture.stock).toBe(current);
      expect(dupCapture.replayed).toBe(true);
    }
  });
  it("mixed and status-only inputs create no synthetic reservation", () => {
    const statusInStock = {
      variantId: "status-variant-in",
      trackQuantity: false as const,
      stockStatus: "IN_STOCK" as const,
      revision: 0,
      history: [],
    };
    const trackedItem = stock({ variantId: "tracked-variant-1", onHand: 5 });

    const trackedResult = reserveStock(
      trackedItem,
      reservation({ id: "hold-t1", orderId: "order-mix", quantity: 2 }),
      context({ operationId: "op-track" }),
    );
    expect(trackedResult.reservation).not.toBeNull();
    expect(tracked(trackedResult.stock).reserved).toBe(2);

    const statusResult = reserveStock(
      statusInStock,
      reservation({ id: "hold-s1", orderId: "order-mix", quantity: 2 }),
      context({ operationId: "op-status" }),
    );
    expect(statusResult.reservation).toBeNull();
    expect("reserved" in statusResult.stock).toBe(false);
    expect("reservations" in statusResult.stock).toBe(false);

    const statusOutStock = {
      ...statusInStock,
      stockStatus: "OUT_OF_STOCK" as const,
    };
    expect(() =>
      reserveStock(
        statusOutStock,
        reservation({ id: "hold-s2", orderId: "order-mix" }),
        context({ operationId: "op-status-out" }),
      ),
    ).toThrow("OUT_OF_STOCK");
  });
});
describe("pure late-capture scenarios; real Mongo transactions remain a later gate", () => {
  it.each([false, true])(
    "PAY-03/04 stock sold to another order: %s",
    (sold) => {
      const held = tracked(
        reserveStock(stock(), reservation(), context()).stock,
      );
      let inventory = resolveReservation(
        held,
        "hold-1",
        "RELEASED",
        expire,
        context({ operationId: "expire", expectedRevision: 1, at: 200 }),
      ).stock;
      const expired = transitionOrder(
        order(),
        "EXPIRED",
        facts({ capturedPaise: 0 }),
        context({ operationId: "expire-order", at: 200 }),
      ).order;
      if (sold) {
        const other = tracked(
          reserveStock(
            inventory,
            reservation({ id: "other", orderId: "other", expiresAt: 400 }),
            context({
              operationId: "other-reserve",
              expectedRevision: 2,
              at: 201,
            }),
          ).stock,
        );
        inventory = resolveReservation(
          other,
          "other",
          "CONSUMED",
          capture,
          context({
            operationId: "other-capture",
            expectedRevision: 3,
            at: 202,
          }),
        ).stock;
      }
      if (!sold) {
        inventory = tracked(
          reserveStock(
            inventory,
            reservation({ id: "reacquire", generation: 1, expiresAt: 400 }),
            context({ operationId: "reacquire", expectedRevision: 2, at: 300 }),
          ).stock,
        );
        inventory = resolveReservation(
          inventory,
          "reacquire",
          "CONSUMED",
          capture,
          context({
            operationId: "late-capture",
            expectedRevision: 3,
            at: 301,
          }),
        ).stock;
        expect(inventory.reservations[0].state).toBe("RELEASED");
        expect(inventory.reservations[1].generation).toBe(1);
      } else {
        expect(() =>
          reserveStock(
            inventory,
            reservation({ id: "reacquire", generation: 1, expiresAt: 400 }),
            context({ operationId: "reacquire", expectedRevision: 4, at: 300 }),
          ),
        ).toThrow("INSUFFICIENT_STOCK");
      }
      const result = lateCapture(
        expired,
        facts({ stockReacquired: !sold }),
        context({ operationId: "late-order", expectedRevision: 1, at: 301 }),
      );
      expect(result.order.state).toBe(sold ? "EXPIRED" : "PLACED");
      expect(result.order.fulfillmentException).toBe(
        sold ? "REFUND_REQUIRED" : "NONE",
      );
      expect(inventory.onHand).toBe(0);
      expect(inventory.reserved).toBe(0);
    },
  );
});
