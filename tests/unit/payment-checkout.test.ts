import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  read: vi.fn(),
  bind: vi.fn(),
  fetch: vi.fn(),
  update: vi.fn(),
}));
vi.mock("../../src/server/db/connection", () => ({
  getDatabase: async () => ({
    db: {
      collection: () => ({
        findOne: async () => ({
          _id: "order-fixture",
          orderNumber: "ORD-2026-000003",
        }),
      }),
    },
  }),
}));
vi.mock("../../src/modules/payments/access", () => ({
  requirePaymentTestAdmin: async () => ({ authUserId: "admin-fixture" }),
  paymentTestConfig: () => ({
    accountKeyHash: "account-fixture",
    keyId: "rzp_test_fixture",
  }),
}));
vi.mock("../../src/modules/cart/security", () => ({
  rateLimit: async () => {},
}));
vi.mock("../../src/modules/payments/repository", () => ({
  bindingRepository: () => ({
    read: mock.read,
    rows: { updateOne: mock.update },
  }),
}));
vi.mock("../../src/modules/payments/binding", () => ({
  bindTestOrder: mock.bind,
}));
vi.mock("../../src/modules/payments/provider", () => ({
  razorpayOrders: () => ({ fetch: mock.fetch }),
}));
vi.mock("../../src/modules/payments/capture", () => ({
  observePayment: vi.fn(),
}));
import { prepareTestCheckout } from "../../src/modules/payments/checkout";
function binding(state = "BOUND") {
  return {
    _id: "binding-fixture",
    state,
    providerOrderId: "order_provider",
    mode: "test",
    accountKeyHash: "account-fixture",
    revision: 1,
    receipt: "ORD-2026-000003",
    operationId: "operation-fixture",
    amountPaise: 1149800,
    deadlineAt: new Date(Date.now() + 900000),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.update.mockResolvedValue({ modifiedCount: 1 });
  mock.fetch.mockResolvedValue({
    id: "order_provider",
    receipt: "ORD-2026-000003",
    currency: "INR",
    amount: 1149800,
    status: "created",
    notes: {
      commerceOperation: "operation-fixture",
      commerceOrder: "order-fixture",
    },
  });
});
it("binds a newly accepted order before returning checkout options", async () => {
  mock.read
    .mockResolvedValueOnce(binding("NOT_STARTED"))
    .mockResolvedValue(binding());
  const result = await prepareTestCheckout(new Headers(), "ORD-2026-000003");
  expect(mock.bind).toHaveBeenCalledOnce();
  expect(mock.fetch).toHaveBeenCalledWith("order_provider");
  expect(result.providerOrderId).toBe("order_provider");
});
it("reuses an already bound order without another create", async () => {
  mock.read.mockResolvedValue(binding());
  await prepareTestCheckout(new Headers(), "ORD-2026-000003");
  expect(mock.bind).not.toHaveBeenCalled();
});
it("does not expose checkout when binding remains uncertain", async () => {
  mock.read.mockResolvedValue(binding("UNKNOWN"));
  await expect(
    prepareTestCheckout(new Headers(), "ORD-2026-000003"),
  ).rejects.toThrow("PAYMENT_NOT_READY");
  expect(mock.fetch).not.toHaveBeenCalled();
  expect(mock.update).not.toHaveBeenCalled();
});
it("rejects an expired window before binding or provider access", async () => {
  mock.read.mockResolvedValue({
    ...binding("NOT_STARTED"),
    deadlineAt: new Date(0),
  });
  await expect(
    prepareTestCheckout(new Headers(), "ORD-2026-000003"),
  ).rejects.toThrow("PAYMENT_WINDOW_EXPIRED");
  expect(mock.bind).not.toHaveBeenCalled();
  expect(mock.fetch).not.toHaveBeenCalled();
});
