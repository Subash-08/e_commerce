"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { stateCodes } from "../shipping/contracts";
import type { CartLine } from "../cart/contracts";
import { useCart } from "../cart/client";
import type { CheckoutQuoteDto } from "./contracts";
import "./checkout.css";
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    v / 100,
  );
function guestLines(): CartLine[] {
  try {
    const raw = localStorage.getItem("commerce.guest-cart.v1");
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : (v.lines ?? []);
  } catch {
    return [];
  }
}
export function CheckoutClient({
  account,
}: {
  account: { name: string; email: string } | null;
}) {
  const { view: cart } = useCart();
  const [billingSame, setBillingSame] = useState(true),
    [quote, setQuote] = useState<CheckoutQuoteDto | null>(null),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  async function submit(form: HTMLFormElement) {
    const f = new FormData(form),
      text = (k: string) => String(f.get(k) ?? "").trim();
    const address = (prefix: string) => ({
      name: text(prefix + "name"),
      mobile: text(prefix + "mobile"),
      line1: text(prefix + "line1"),
      line2: text(prefix + "line2"),
      landmark: text(prefix + "landmark"),
      city: text(prefix + "city"),
      district: text(prefix + "district"),
      stateCode: text(prefix + "stateCode"),
      postalCode: text(prefix + "postalCode"),
      countryCode: "IN",
    });
    const body = {
      contact: {
        name: text("contact.name"),
        email: text("contact.email"),
        mobile: text("contact.mobile"),
      },
      shippingAddress: address("shipping."),
      billingSameAsShipping: billingSame,
      billingAddress: billingSame ? null : address("billing."),
      business: {
        legalName: text("business.legalName"),
        gstin: text("business.gstin"),
      },
      deliveryNote: text("deliveryNote"),
      payment: text("payment"),
      coupon: text("coupon"),
      termsAccepted: f.has("termsAccepted"),
      marketingConsent: f.has("marketingConsent"),
      guestLines: account
        ? []
        : (cart?.items.map(({ productId, variantId, quantity }) => ({
            productId,
            variantId,
            quantity,
          })) ?? guestLines()),
      cartRevision: cart?.revision ?? 0,
    };
    const response = await fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    setQuote(data.quote);
  }
  return (
    <form
      className="checkout"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          try {
            await submit(e.currentTarget);
          } catch (err) {
            setQuote(null);
            setError(
              err instanceof Error
                ? err.message
                : "Quote could not be created.",
            );
          }
        });
      }}
    >
      <header>
        <span>SECURE CHECKOUT</span>
        <h1>Delivery and payment</h1>
        <p>
          Review a live server-calculated quote. No stock or coupon is reserved
          yet.
        </p>
      </header>
      <div className="checkout-layout">
        <div className="checkout-fields">
          <section>
            <h2>Contact</h2>
            <div className="checkout-grid">
              <label>
                Full name
                <input
                  name="contact.name"
                  defaultValue={account?.name ?? ""}
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Email
                <input
                  name="contact.email"
                  type="email"
                  defaultValue={account?.email ?? ""}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Mobile
                <input
                  name="contact.mobile"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  pattern="[6-9][0-9]{9}"
                />
              </label>
            </div>
          </section>
          <Address prefix="shipping." title="Shipping address" />
          <section>
            <label className="checkout-check">
              <input
                type="checkbox"
                checked={billingSame}
                onChange={(e) => setBillingSame(e.target.checked)}
              />{" "}
              Billing address is the same
            </label>
          </section>
          {!billingSame && (
            <Address prefix="billing." title="Billing address" />
          )}
          <section>
            <h2>
              Business details <small>Optional</small>
            </h2>
            <div className="checkout-grid">
              <label>
                Legal name
                <input name="business.legalName" maxLength={150} />
              </label>
              <label>
                GSTIN
                <input
                  name="business.gstin"
                  maxLength={15}
                  autoCapitalize="characters"
                />
              </label>
            </div>
            <p className="checkout-hint">
              Format is checked locally; government registration is not verified
              here.
            </p>
          </section>
          <section>
            <h2>Offer and delivery</h2>
            <div className="checkout-grid">
              <label>
                Coupon
                <input name="coupon" maxLength={20} />
              </label>
              <label>
                Delivery note
                <textarea name="deliveryNote" maxLength={300} />
              </label>
            </div>
          </section>
          <section>
            <h2>Payment preference</h2>
            <label className="checkout-check">
              <input
                type="radio"
                name="payment"
                value="ONLINE"
                defaultChecked
              />{" "}
              Online payment
            </label>
            <label className="checkout-check">
              <input type="radio" name="payment" value="COD" /> Cash on
              delivery, when eligible
            </label>
          </section>
          <section>
            <label className="checkout-check">
              <input type="checkbox" name="termsAccepted" required /> I accept
              the <Link href="/terms">terms</Link> and{" "}
              <Link href="/privacy-policy">privacy policy</Link>.
            </label>
            <label className="checkout-check">
              <input type="checkbox" name="marketingConsent" /> Send optional
              product and offer updates.
            </label>
          </section>
          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <aside className="checkout-summary">
          <h2>Order summary</h2>
          {quote ? (
            <>
              <p className="checkout-success" role="status">
                Quote ready until{" "}
                {quote.expiresAt.replace("T", " ").slice(0, 19)} UTC
              </p>
              {quote.items.map((i) => (
                <div className="checkout-line" key={i.variantId}>
                  <span>
                    {i.name} · {i.title} × {i.quantity}
                  </span>
                  <strong>{money(i.payablePaise)}</strong>
                </div>
              ))}
              <div className="checkout-line">
                <span>Items</span>
                <strong>{money(quote.totals.goodsPaise)}</strong>
              </div>
              {quote.totals.discountPaise > 0 && (
                <div className="checkout-line">
                  <span>Coupon saving</span>
                  <strong>−{money(quote.totals.discountPaise)}</strong>
                </div>
              )}
              <div className="checkout-line">
                <span>Delivery and COD</span>
                <strong>{money(quote.totals.deliveryPaise)}</strong>
              </div>
              <div className="checkout-total">
                <span>Total</span>
                <strong>{money(quote.totals.grandTotalPaise)}</strong>
              </div>
              <p>{quote.notices[0]}</p>
            </>
          ) : (
            <p>
              Enter your delivery details to calculate final shipping, tax,
              coupon eligibility and payment methods.
            </p>
          )}
          <button disabled={pending} type="submit">
            {pending ? "Checking live prices…" : "Review live quote"}
          </button>
          <Link href="/cart">Return to cart</Link>
        </aside>
      </div>
    </form>
  );
}
function Address({ prefix, title }: { prefix: string; title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="checkout-grid">
        <label>
          Recipient name
          <input name={prefix + "name"} autoComplete="name" required />
        </label>
        <label>
          Mobile
          <input
            name={prefix + "mobile"}
            inputMode="numeric"
            autoComplete="tel"
            required
            pattern="[6-9][0-9]{9}"
          />
        </label>
        <label className="wide">
          Address line 1
          <input
            name={prefix + "line1"}
            autoComplete="address-line1"
            required
          />
        </label>
        <label className="wide">
          Address line 2
          <input name={prefix + "line2"} autoComplete="address-line2" />
        </label>
        <label>
          Landmark
          <input name={prefix + "landmark"} />
        </label>
        <label>
          City
          <input
            name={prefix + "city"}
            autoComplete="address-level2"
            required
          />
        </label>
        <label>
          District
          <input name={prefix + "district"} />
        </label>
        <label>
          State / UT
          <select
            name={prefix + "stateCode"}
            autoComplete="address-level1"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select state
            </option>
            {stateCodes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          PIN code
          <input
            name={prefix + "postalCode"}
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[1-9][0-9]{5}"
            required
          />
        </label>
      </div>
    </section>
  );
}
