import Link from "next/link";
import { headers } from "next/headers";
import { listAdminOrders } from "@/modules/orders/service";
import "@/modules/orders/orders.css";
const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100,
  );
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const orders = await listAdminOrders(await headers(), state);
  return (
    <main className="order-page">
      <header className="order-hero">
        <div>
          <span>FULFILLMENT</span>
          <h1>Orders</h1>
          <p>
            Review COD orders, stock holds, customer delivery facts and overdue
            follow-up.
          </p>
        </div>
      </header>
      <nav className="order-filters">
        {[
          "ALL",
          "PLACED",
          "CONFIRMED",
          "PROCESSING",
          "SHIPPED",
          "DELIVERED",
          "CANCELLED",
        ].map((value) => (
          <Link
            key={value}
            href={
              value === "ALL" ? "/admin/orders" : `/admin/orders?state=${value}`
            }
          >
            {value}
          </Link>
        ))}
      </nav>
      {orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <Link
              className="order-list-row"
              key={order.orderNumber}
              href={`/admin/orders/${order.orderNumber}`}
            >
              <div>
                <strong>{order.orderNumber}</strong>
                <small>
                  {order.customerName}
                  <br />
                  {order.customerEmail}
                </small>
              </div>
              <span>{order.state}</span>
              <span>{order.itemCount} items</span>
              <strong>{money(order.totalPaise)}</strong>
              <small>{order.createdAt.slice(0, 10)}</small>
            </Link>
          ))}
        </div>
      ) : (
        <div className="order-empty">
          <h2>No matching orders</h2>
          <p>New accepted COD orders will appear here.</p>
        </div>
      )}
    </main>
  );
}
