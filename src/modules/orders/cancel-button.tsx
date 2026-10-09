"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CancelOrderButton({
  orderNumber,
  revision,
  admin = false,
}: {
  orderNumber: string;
  revision: number;
  admin?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  if (message === "cancelled")
    return (
      <p className="order-success">
        Order cancelled. Reserved stock and coupon capacity were released.
      </p>
    );
  return (
    <div className="order-cancel">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt(
            "Why is this order being cancelled?",
            admin ? "Cancelled by administrator" : "Cancelled by customer",
          );
          if (!reason) return;
          start(async () => {
            setMessage("");
            const endpoint = admin
              ? `/api/admin/orders/${orderNumber}/cancel`
              : `/api/orders/${orderNumber}`;
            const response = await fetch(endpoint, {
              method: admin ? "POST" : "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ expectedRevision: revision, reason }),
            });
            const data = await response.json();
            if (!response.ok)
              setMessage(data.message ?? "Cancellation failed.");
            else {
              setMessage("cancelled");
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Cancelling…" : "Cancel order"}
      </button>
      {message && (
        <p className="order-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
