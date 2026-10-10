import { afterEach, describe, expect, it, vi } from "vitest";
import { razorpayOrders } from "../../src/modules/payments/provider";
import { paymentTestConfig } from "../../src/modules/payments/access";
const key = "unit-test-secret-do-not-expose";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function configure() {
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("RAZORPAY_MODE", "test");
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_fixture");
  vi.stubEnv("RAZORPAY_KEY_SECRET", key);
}
describe("Payment provider boundary", () => {
  it("blocks production and live credentials", () => {
    configure();
    vi.stubEnv("APP_ENV", "production");
    expect(() => paymentTestConfig()).toThrow("PAYMENT_TEST_ONLY");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_fixture");
    expect(() => paymentTestConfig()).toThrow("PAYMENT_CONFIG_INVALID");
  });
  it("drops provider errors and secret-bearing causes without logging them", async () => {
    configure();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(key)));
    await expect(
      razorpayOrders().create({
        receipt: "ORD-2026-000001",
        amountPaise: 100,
        operationId: "fixture",
        orderId: "fixture",
      }),
    ).rejects.toThrow(/^PAYMENT_PROVIDER_UNAVAILABLE$/);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("does not mistake a full lookup page for a complete unique result", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ items: Array.from({ length: 100 }, () => ({})) }),
          ),
        ),
    );
    await expect(razorpayOrders().lookup("ORD-2026-000001")).rejects.toThrow(
      "PAYMENT_LOOKUP_INCONCLUSIVE",
    );
  });
});
