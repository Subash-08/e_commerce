import Link from "next/link";
import { headers } from "next/headers";
import { listAccountOrders } from "@/modules/orders/service";
import "@/modules/orders/orders.css";

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100,
  );
export const dynamic = "force-dynamic";
export default async function Page() {
  const orders = await listAccountOrders(await headers());
  return (
    <main className="order-page">
      <header className="order-hero">
        <div>
          <span>YOUR ACCOUNT</span>
          <h1>Orders</h1>
          <p>View current COD status and your immutable purchase summary.</p>
        </div>
      </header>
      {orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <Link
              className="order-list-row"
              key={order.orderNumber}
              href={`/account/orders/${order.orderNumber}`}
            >
              <strong>{order.orderNumber}</strong>
              <span>{order.state}</span>
              <span>
                {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
              </span>
              <strong>{money(order.totalPaise)}</strong>
              <small>{order.createdAt.slice(0, 10)}</small>
            </Link>
          ))}
        </div>
      ) : (
        <div className="order-empty">
          <h2>No orders yet</h2>
          <p>Your completed checkout orders will appear here.</p>
          <Link href="/products">Browse products</Link>
        </div>
      )}
    </main>
  );
}
