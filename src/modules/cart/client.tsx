"use client";
import Link from "next/link";
import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { CartSkeleton } from "./skeleton";
import { Toast } from "../../shared/ui/storefront/Toast";
import { cartLines, type CartLine, type CartView } from "./contracts";

const storageKey = "commerce.guest-cart.v1";
const pendingKey = "commerce.guest-merge.v1";
type Reply = { view: CartView; ticket: string; remaining: CartLine[] };
type Operation = "add" | "set" | "remove" | "clear" | "merge";
type CartContextValue = {
  view: CartView | null;
  busy: boolean;
  refreshing: boolean;
  loadError: string;
  message: string;
  guestCount: number;
  refresh: () => Promise<void>;
  mutate: (action: Operation, line?: CartLine) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  open: () => void;
  resetGuest: () => Promise<void>;
};
const Context = createContext<CartContextValue | null>(null);
const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    amount / 100,
  );
function readGuest(): CartLine[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  if (raw.length > 18000)
    throw new Error(
      "Saved cart is invalid. Clear saved guest items to start again.",
    );
  const stored = JSON.parse(raw);
  const parsed = cartLines.safeParse(
    Array.isArray(stored) ? stored : stored.version === 1 ? stored.lines : null,
  );
  if (!parsed.success)
    throw new Error(
      "Saved cart is invalid. Clear saved guest items to start again.",
    );
  return parsed.data;
}
function saveGuest(lines: CartLine[], acknowledged?: string) {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ version: 1, lines: cartLines.parse(lines), acknowledged }),
  );
}
function acknowledgedMerge(ticket: unknown) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return false;
  return JSON.parse(raw).acknowledged === ticket;
}
async function call(body?: unknown): Promise<Reply> {
  const response = await fetch("/api/cart", {
    method: body ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.message ?? "Your request could not be completed."),
      { code: data.code },
    );
  return data;
}
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<CartView | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [loadError, setLoadError] = useState("");
  const readPending = useRef<Promise<Reply> | null>(null);
  const lastRefresh = useRef(0);
  const [message, setMessage] = useState("");
  const [guestCount, setGuestCount] = useState(0);
  const coupon = useRef("");
  const owner = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const pending = useRef<{
    body: Record<string, unknown>;
    owner: string;
  } | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const pathname = usePathname();
  const seenPrices = useRef(new Map<string, number>());
  const decorate = useCallback((next: CartView) => {
    if (!next.owner) {
      try {
        const raw = localStorage.getItem("commerce.guest-price-hints.v1");
        if (raw && raw.length < 12000) {
          const hints = JSON.parse(raw);
          for (const item of next.items)
            if (
              Number.isSafeInteger(hints[item.variantId]) &&
              hints[item.variantId] >= 0
            )
              seenPrices.current.set(item.variantId, hints[item.variantId]);
        }
      } catch {
        /* Price hints are optional and never authority. */
      }
    }
    const hints: Record<string, number> = {};
    const items = next.items.map((item) => {
      const previous = seenPrices.current.get(item.variantId);
      if (item.url && previous === undefined)
        seenPrices.current.set(item.variantId, item.unitPaise);
      if (item.url) hints[item.variantId] = previous ?? item.unitPaise;
      return {
        ...item,
        priceChanged: Boolean(
          item.url && previous !== undefined && previous !== item.unitPaise,
        ),
      };
    });
    if (!next.owner) {
      try {
        localStorage.setItem(
          "commerce.guest-price-hints.v1",
          JSON.stringify(hints),
        );
      } catch {
        /* Optional display hint. */
      }
    }
    return { ...next, items };
  }, []);
  const load = useCallback((): Promise<Reply> => {
    if (readPending.current) return readPending.current;
    readPending.current = (async () => {
      try {
        const guest = readGuest();
        const result = await call({
          action: "resolve",
          lines: guest,
          coupon: coupon.current,
        });
        if (owner.current !== result.view.owner) {
          coupon.current = "";
          pending.current = null;
          seenPrices.current.clear();
        }
        owner.current = result.view.owner;
        setView(decorate(result.view));
        setLoadError("");
        setGuestCount(guest.reduce((n, line) => n + line.quantity, 0));
        lastRefresh.current = Date.now();
        return result;
      } finally {
        readPending.current = null;
      }
    })();
    return readPending.current;
  }, [decorate]);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    setRefreshing(true);
    try {
      await load();
    } catch (error) {
      const text =
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "The cart took too long to respond. Your saved items are unchanged. Please retry.";
      setLoadError(text);
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "AUTH_REQUIRED"
      )
        setView(null);
    } finally {
      setRefreshing(false);
    }
  }, [load]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    const onFocus = () => {
      if (Date.now() - lastRefresh.current > 15000) void refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") onFocus();
    }, 60000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("commerce-cart");
      channel.current.onmessage = (event) => {
        if (event.data === "identity-changed") {
          window.location.reload();
          return;
        }
        void refresh();
      };
    }
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      channel.current?.close();
    };
  }, [refresh, pathname]);
  async function mutate(action: Operation, line?: CartLine) {
    const feedback: Record<Operation, string> = {
      add: "Product added to cart.",
      set: "Product quantity updated.",
      remove: "Product removed from cart.",
      clear: "Cart cleared.",
      merge: "Guest items added to your cart.",
    };
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (!navigator.locks)
        throw new Error(
          "Use a current browser to safely synchronize your cart between tabs.",
        );
      await navigator.locks.request("commerce-cart-write", async () => {
        const before = await load();
        let guest = readGuest();
        if (before.view.owner) {
          let body: Record<string, unknown> = {
            action,
            line,
            revision: before.view.revision,
            ticket: before.ticket,
            coupon: coupon.current,
            ...(action === "merge" ? { lines: guest } : {}),
          };
          if (action === "merge") {
            const saved = localStorage.getItem(pendingKey);
            if (saved) body = JSON.parse(saved);
            else localStorage.setItem(pendingKey, JSON.stringify(body));
          } else if (pending.current?.owner === before.view.owner) {
            // A lost response must be settled before accepting a different intent.
            body = pending.current.body;
          }
          pending.current = { body, owner: before.view.owner };
          const result = await call(body);
          pending.current = null;
          seenPrices.current.clear();
          if (body.action === "merge") {
            const transferred = cartLines.parse(body.lines);
            guest = acknowledgedMerge(body.ticket)
              ? readGuest()
              : readGuest().flatMap((item) => {
                  const original = transferred.find(
                    (v) => v.variantId === item.variantId,
                  );
                  const leftover =
                    result.remaining.find((v) => v.variantId === item.variantId)
                      ?.quantity ?? 0;
                  const quantity =
                    item.quantity -
                    (original ? original.quantity - leftover : 0);
                  return quantity > 0 ? [{ ...item, quantity }] : [];
                });
            saveGuest(guest, String(body.ticket));
            localStorage.removeItem(pendingKey);
          }
          setView(decorate(result.view));
          setMessage(
            result.remaining.length
              ? "Some guest quantities could not transfer because of availability or cart limits. They remain saved below."
              : body.action !== action
                ? "Your earlier request was recovered. You can now make the next change."
                : feedback[action],
          );
        } else {
          if (localStorage.getItem(pendingKey))
            throw new Error(
              "A guest transfer is awaiting confirmation. Sign back into the same account to finish it before changing these selections.",
            );
          if (action === "clear") guest = [];
          else if (line) {
            if (action === "remove")
              guest = guest.filter((item) => item.variantId !== line.variantId);
            else {
              const existing = guest.find(
                (item) => item.variantId === line.variantId,
              );
              const quantity =
                action === "add"
                  ? (existing?.quantity ?? 0) + line.quantity
                  : line.quantity;
              if (existing) existing.quantity = quantity;
              else guest.push({ ...line, quantity });
              const checked = await call({
                action: "resolve",
                lines: cartLines.parse(guest),
                coupon: coupon.current,
              });
              if (checked.view.owner)
                throw new Error(
                  "Your sign-in changed. Refresh your cart and try again.",
                );
              const resolved = checked.view.items.find(
                (item) => item.variantId === line.variantId,
              );
              if (!resolved || resolved.issue)
                throw new Error(resolved?.issue ?? "This item is unavailable.");
            }
          }
          saveGuest(guest);
          await load();
          setMessage(feedback[action]);
        }
        setGuestCount(guest.reduce((n, item) => n + item.quantity, 0));
        channel.current?.postMessage("changed");
        if (action === "add") dialog.current?.showModal();
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Cart update failed. Please retry.",
      );
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (
        [
          "REVISION_CONFLICT",
          "INVALID_INPUT",
          "ITEM_UNAVAILABLE",
          "CART_LIMIT",
        ].includes(code)
      ) {
        pending.current = null;
        localStorage.removeItem(pendingKey);
      }
      // Keep the same request key after transport failure; the server owns replay detection.
      try {
        await load();
      } catch {
        setLoadError(
          "Could not refresh your cart. Your saved selections are unchanged. Please retry.",
        );
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function applyCoupon(code: string) {
    coupon.current = code.trim().toUpperCase();
    setMessage("");
    await refresh();
  }
  return (
    <Context.Provider
      value={{
        view,
        busy,
        refreshing,
        loadError,
        message,
        guestCount,
        refresh,
        mutate,
        applyCoupon,
        open: () => dialog.current?.showModal(),
        resetGuest: async () => {
          if (
            !window.confirm(
              "Clear saved guest selections and any pending transfer? Items already in your signed-in cart will remain there.",
            )
          )
            return;
          if (!navigator.locks) return;
          await navigator.locks.request("commerce-cart-write", async () => {
            localStorage.removeItem(storageKey);
            localStorage.removeItem(pendingKey);
            pending.current = null;
            seenPrices.current.clear();
          });
          setMessage("Saved guest selections cleared.");
          channel.current?.postMessage("changed");
          await refresh();
        },
      }}
    >
      {children}
      <Toast message={message} onDismiss={() => setMessage("")} />
      <dialog
        ref={dialog}
        className="sf-cart-dialog"
        aria-labelledby="cart-drawer-title"
      >
        <div className="sf-cart-drawer-heading">
          <h2 id="cart-drawer-title">Your cart</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close cart"
          >
            ×
          </button>
        </div>
        <CartContents compact />
        <Link
          href="/cart"
          className="sf-product-card-action"
          onClick={() => dialog.current?.close()}
        >
          Review full cart
        </Link>
      </dialog>
    </Context.Provider>
  );
}
export function useCart() {
  const value = useContext(Context);
  if (!value) throw new Error("Cart provider is required");
  return value;
}
export function CartButton() {
  const { view, open } = useCart();
  return (
    <button
      type="button"
      className="sf-cart-trigger"
      onClick={open}
      aria-label={`Open cart, ${view?.count ?? 0} items`}
    >
      Cart <span>{view?.count ?? 0}</span>
    </button>
  );
}
export function AddToCart({
  productId,
  variantId,
  available,
  label = "Add to cart",
}: {
  productId: string;
  variantId: string;
  available: boolean;
  label?: string;
}) {
  const { mutate, busy } = useCart();
  return (
    <div>
      <button
        className="sf-product-card-action"
        type="button"
        disabled={!available || busy}
        onClick={() =>
          void mutate("add", { productId, variantId, quantity: 1 })
        }
      >
        {busy ? "Updating…" : available ? label : "Out of stock"}
      </button>
    </div>
  );
}
export function CartContents({ compact = false }: { compact?: boolean }) {
  const {
    view,
    busy,
    refreshing,
    loadError,
    message,
    guestCount,
    mutate,
    refresh,
    applyCoupon,
    resetGuest,
  } = useCart();
  const [code, setCode] = useState("");
  return (
    <div
      className={compact ? "sf-cart-content compact" : "sf-cart-content"}
      aria-busy={busy}
    >
      {compact && message && (
        <p role="status" className="sf-cart-notice">
          {message}
        </p>
      )}
      {loadError && (
        <div className="sf-cart-warning" role="alert">
          <p>{loadError}</p>
          <button disabled={refreshing} onClick={() => void refresh()}>
            Retry
          </button>
          {!view && (
            <button onClick={() => void resetGuest()}>
              Clear saved guest selections
            </button>
          )}
        </div>
      )}
      {view && refreshing && (
        <p className="sf-cart-refresh" role="status">
          Refreshing prices and availability…
        </p>
      )}
      {!view ? (
        loadError ? null : (
          <CartSkeleton compact={compact} />
        )
      ) : (
        <>
          {view.owner && guestCount > 0 && (
            <div className="sf-cart-notice">
              <p>
                You also have {guestCount} saved guest items. Items that cannot
                transfer will stay saved.
              </p>
              <button disabled={busy} onClick={() => void mutate("merge")}>
                Bring guest items into this cart
              </button>
              <button disabled={busy} onClick={() => void resetGuest()}>
                Clear saved guest selections
              </button>
            </div>
          )}
          {!compact && view.items.length > 0 && (
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm("Remove all items from this cart?"))
                  void mutate("clear");
              }}
            >
              Clear cart
            </button>
          )}
          {!view.items.length ? (
            <div className="sf-cart-empty">
              <h2>Your cart is empty</h2>
              <p>Choose a product and select the option you need.</p>
              <Link href="/products">Explore products</Link>
            </div>
          ) : (
            <div className="sf-cart-grid">
              <div className="sf-cart-lines">
                {view.items.map((item) => (
                  <article className="sf-cart-line" key={item.variantId}>
                    {item.image ? (
                      <Image
                        src={item.image.url}
                        alt={item.image.alt}
                        width={88}
                        height={88}
                        unoptimized
                      />
                    ) : (
                      <div className="sf-cart-image-empty" aria-hidden="true">
                        □
                      </div>
                    )}
                    <div className="sf-cart-line-details">
                      <h3>
                        {item.url ? (
                          <Link href={item.url}>{item.name}</Link>
                        ) : (
                          item.name
                        )}
                      </h3>
                      <p>{item.title}</p>
                      <strong>{money(item.unitPaise)}</strong>
                      <small>per unit, including GST</small>
                      {item.priceChanged && (
                        <p className="sf-cart-warning">
                          The price has changed since you last saved this item.
                          This estimate uses the current price.
                        </p>
                      )}
                      {item.issue && (
                        <p className="sf-cart-warning" role="status">
                          {item.issue} This line is excluded from the estimate.
                        </p>
                      )}
                      {item.quantity > item.maximumQuantity &&
                        item.maximumQuantity > 0 && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void mutate("set", {
                                productId: item.productId,
                                variantId: item.variantId,
                                quantity: item.maximumQuantity,
                              })
                            }
                          >
                            Set quantity to {item.maximumQuantity}
                          </button>
                        )}
                      <div className="sf-cart-quantity">
                        <button
                          aria-label={`Reduce ${item.name} quantity`}
                          disabled={busy || item.quantity <= 1}
                          onClick={() =>
                            void mutate("set", {
                              productId: item.productId,
                              variantId: item.variantId,
                              quantity: item.quantity - 1,
                            })
                          }
                        >
                          −
                        </button>
                        <span aria-label="Quantity">{item.quantity}</span>
                        <button
                          aria-label={`Increase ${item.name} quantity`}
                          disabled={
                            busy || item.quantity >= item.maximumQuantity
                          }
                          onClick={() =>
                            void mutate("set", {
                              productId: item.productId,
                              variantId: item.variantId,
                              quantity: item.quantity + 1,
                            })
                          }
                        >
                          +
                        </button>
                        <button
                          className="sf-cart-remove"
                          disabled={busy}
                          onClick={() =>
                            void mutate("remove", {
                              productId: item.productId,
                              variantId: item.variantId,
                              quantity: item.quantity,
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <strong>{money(item.payablePaise)}</strong>
                  </article>
                ))}
              </div>
              <aside className="sf-cart-summary">
                <h2>Cart estimate</h2>
                <div>
                  <span>Items before coupon</span>
                  <strong>{money(view.subtotalPaise)}</strong>
                </div>
                {view.discountPaise > 0 && (
                  <div>
                    <span>Coupon savings</span>
                    <strong>−{money(view.discountPaise)}</strong>
                  </div>
                )}
                <div>
                  <span>Included estimated GST</span>
                  <span>{money(view.taxPaise)}</span>
                </div>
                <div>
                  <span>Shipping</span>
                  <span>At checkout</span>
                </div>
                <div className="sf-cart-total">
                  <span>Items total</span>
                  <strong>{money(view.totalPaise)}</strong>
                </div>
                {!compact && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void applyCoupon(code);
                    }}
                  >
                    <label htmlFor="cart-coupon">Coupon code</label>
                    <div className="sf-cart-coupon">
                      <input
                        id="cart-coupon"
                        value={code}
                        maxLength={20}
                        onChange={(event) => setCode(event.target.value)}
                        placeholder="Enter code"
                      />
                      <button disabled={busy}>Apply</button>
                    </div>
                    {view.coupon && (
                      <button
                        type="button"
                        onClick={() => {
                          setCode("");
                          void applyCoupon("");
                        }}
                      >
                        Remove coupon
                      </button>
                    )}
                  </form>
                )}
                {view.couponMessage && (
                  <p role="status">{view.couponMessage}</p>
                )}
                <p>
                  {view.ready
                    ? "Your items are available now. Adding to cart does not reserve stock."
                    : "Resolve unavailable items before checkout."}
                </p>
                {view.ready && !compact ? (
                  <Link href="/checkout" className="sf-product-card-action">
                    Continue to checkout
                  </Link>
                ) : (
                  <p>
                    Shipping, final tax and coupon eligibility are confirmed at
                    checkout.
                  </p>
                )}
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
