import Link from "next/link";
import { headers } from "next/headers";
import { listAdminTestPayments } from "@/modules/payments/admin";
import "@/modules/orders/orders.css";

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100,
  );

export const dynamic = "force-dynamic";
export default async function Page() {
  const rows = await listAdminTestPayments(await headers());
  return (
    <main className="order-page">
      <header className="order-hero">
        <div>
          <span>PAYMENTS</span>
          <h1>Test payment queue</h1>
          <p>
            Verified Razorpay Test Mode evidence only. Review exceptions before
            fulfillment.
          </p>
        </div>
      </header>
      {rows.length ? (
        <div className="order-list">
          {rows.map((row) => (
            <Link
              className="order-list-row"
              key={row.orderNumber}
              href={`/admin/orders/${row.orderNumber}`}
            >
              <div>
                <strong>{row.orderNumber}</strong>
                <small>
                  {row.createdAt.slice(0, 19).replace("T", " ")} UTC
                </small>
              </div>
              <span>
                {row.bindingState} · {row.paymentState}
              </span>
              <span>{row.financialState}</span>
              <strong>{money(row.totalPaise)}</strong>
              <small>
                {row.exception === "NONE"
                  ? "No exception"
                  : row.exception.replaceAll("_", " ")}
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <div className="order-empty">
          <h2>No online test payments</h2>
          <p>Accepted Razorpay Test Mode orders will appear here.</p>
        </div>
      )}
    </main>
  );
}
