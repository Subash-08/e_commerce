import Link from "next/link";
import { CancelOrderButton } from "./cancel-button";
import { TestPaymentButton } from "../payments/payment-button";
import "./orders.css";

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100,
  );

type Detail = {
  orderNumber: string;
  state: string;
  financialState: string;
  paymentMethod: "COD" | "ONLINE";
  totalPaise: number;
  createdAt: string;
  revision: number;
  snapshots: {
    shippingAddress: {
      name: string;
      mobile: string;
      line1: string;
      line2: string;
      city: string;
      stateCode: string;
      postalCode: string;
    };
    items: Array<{
      variantId: string;
      name: string;
      title: string;
      quantity: number;
      payablePaise: number;
    }>;
  };
};

export function OrderDetail({
  order,
  admin = false,
}: {
  order: Detail;
  admin?: boolean;
}) {
  const address = order.snapshots.shippingAddress;
  const cancellable = ["PLACED", "CONFIRMED", "PROCESSING"].includes(
    order.state,
  );
  return (
    <main className="order-page">
      <header className="order-hero">
        <div>
          <span>{admin ? "ADMIN ORDER" : "ORDER DETAILS"}</span>
          <h1>{order.orderNumber}</h1>
          <p>
            Placed {order.createdAt.replace("T", " ").slice(0, 19)} UTC · Cash
            on delivery
          </p>
        </div>
        <strong className={`order-state state-${order.state.toLowerCase()}`}>
          {order.state.replaceAll("_", " ")}
        </strong>
      </header>
      <div className="order-layout">
        <section className="order-card">
          <h2>Items</h2>
          {order.snapshots.items.map((item) => (
            <div className="order-line" key={item.variantId}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.title} · Qty {item.quantity}
                </span>
              </div>
              <strong>{money(item.payablePaise)}</strong>
            </div>
          ))}
          <div className="order-total">
            <span>Total</span>
            <strong>{money(order.totalPaise)}</strong>
          </div>
        </section>
        <aside className="order-side">
          <section className="order-card">
            <h2>Delivery</h2>
            <strong>{address.name}</strong>
            <p>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {address.city}, {address.stateCode} {address.postalCode}
              <br />
              {address.mobile}
            </p>
          </section>
          <section className="order-card">
            <h2>Payment</h2>
            <p>
              {order.paymentMethod === "COD"
                ? "Cash on delivery"
                : "Online payment"}
            </p>
            <p>Financial status: {order.financialState}</p>
          </section>
          {order.paymentMethod === "ONLINE" &&
            order.financialState === "PENDING" && (
              <TestPaymentButton orderNumber={order.orderNumber} />
            )}
          {cancellable && (
            <section className="order-card danger">
              <h2>Need to cancel?</h2>
              <p>
                Cancellation releases tracked stock and any claimed coupon in
                one transaction.
              </p>
              <CancelOrderButton
                orderNumber={order.orderNumber}
                revision={order.revision}
                admin={admin}
              />
            </section>
          )}
        </aside>
      </div>
      <Link className="order-back" href={admin ? "/admin/orders" : "/products"}>
        {admin ? "Back to orders" : "Continue shopping"}
      </Link>
    </main>
  );
}
