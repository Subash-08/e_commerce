"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CheckoutOptions = {
  keyId: string;
  providerOrderId: string;
  orderNumber: string;
  amountPaise: number;
  currency: "INR";
  expiresAt: string;
};
type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type RazorpayInstance = {
  open(): void;
  on(name: "payment.failed", listener: () => void): void;
};
type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loader: Promise<void> | undefined;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!loader)
    loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => (window.Razorpay ? resolve() : reject(new Error()));
      script.onerror = () => reject(new Error());
      document.head.append(script);
    });
  return loader;
}

export function TestPaymentButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "opening" | "verifying">("idle");
  const [message, setMessage] = useState("");
  async function json(url: string, body: object) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        typeof data.message === "string"
          ? data.message
          : "Payment is still being confirmed.",
      );
    return data;
  }
  async function open() {
    setState("opening");
    setMessage("");
    try {
      const result = await json("/api/payments/verify", {
        action: "start",
        orderNumber,
      });
      const checkout = result.checkout as CheckoutOptions;
      await loadRazorpay();
      if (!window.Razorpay) throw new Error();
      const popup = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: "Commerce test checkout",
        description: checkout.orderNumber,
        order_id: checkout.providerOrderId,
        modal: {
          ondismiss: () => {
            setState("idle");
            setMessage(
              "Payment window closed. Your order remains pending until a verified capture arrives.",
            );
          },
        },
        handler: async (response) => {
          setState("verifying");
          try {
            await json("/api/payments/verify", {
              action: "verify",
              orderNumber,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            setMessage(
              "Payment evidence received. Refreshing verified order status…",
            );
            router.refresh();
          } catch {
            setMessage(
              "Payment is still being confirmed. Refresh this order shortly; do not retry a completed payment.",
            );
          } finally {
            setState("idle");
          }
        },
      });
      popup.on("payment.failed", () => {
        setState("idle");
        setMessage("Payment was not completed. No order status was changed.");
      });
      popup.open();
    } catch {
      setState("idle");
      setMessage(
        "Payment checkout is not ready. Refresh the order before trying again.",
      );
    }
  }
  return (
    <section className="order-card payment-test" aria-live="polite">
      <h2>Test payment</h2>
      <p>
        Razorpay Test Mode only. The server verifies every result before the
        order changes.
      </p>
      <button type="button" onClick={open} disabled={state !== "idle"}>
        {state === "opening"
          ? "Opening secure payment…"
          : state === "verifying"
            ? "Verifying payment…"
            : "Pay with Razorpay test mode"}
      </button>
      {message && <p className="order-payment-message">{message}</p>}
    </section>
  );
}
