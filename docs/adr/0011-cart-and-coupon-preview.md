# ADR 0011: Live cart and targeted coupon previews

Status: implemented checkpoint, 2026-10-08. Authorized by the cart review and the user's explicit addition of coupon management. Checkout, payment, and Wishlist remain separate slices.

## Cart authority and persistence

One bounded Atlas cart per canonical Better Auth account ID, uniquely indexed. Items contain only validated product/variant references and quantity. Cart documents have a revision, schema version, and timestamps. The service enforces distinct variant lines, 50 lines and 99 units per line; current availability restricts additions further. Existing unavailable or excessive lines remain visible, excluded from the estimate, until the customer resolves them. No stock is reserved.

Guests keep a versioned browser selection, without personal details or authoritative prices. A capped, same-origin JSON resolve endpoint reads current product, variant, brand, primary-category and media facts in batches. Existing catalog publication rules remain controlling: inactive taxonomy is not a new purchase bypass. Responses are explicit public DTOs and private/no-store; private cost and unpublished data are never returned. Tax-inclusive displayed prices use the existing pricing engine, including exclusive-price conversion. Shipping is unknown until checkout, rather than an invented flat charge. Cart estimates do not become order snapshots.

Authenticated mutation authority comes from Better Auth and a fresh transaction-time profile/version check. Signed operation tickets are bound to that account, expire after 24 hours, and have receipt retention through the following day. Every committed mutation and its receipt are atomic. Matching replays return current cart state without another increment; altered payloads fail. The small transaction is intentional because a separate receipt must commit with its cart write. All transaction reads are sequential and explicitly carry the session; there are no provider calls. Revision conflicts require a fresh customer action rather than blind retry.

Login exposes an explicit guest-import action. Merge fills only current capacity and returns rejected quantities; it never silently drops overflow. Browser Web Locks serialize guest mutation/import, with storage events and BroadcastChannel refreshing other tabs. The guest acknowledgment marker is persisted in the same local-storage write as the remaining items, so an interrupted cleanup cannot subtract twice. Pending transfers retain their original ticket/payload across reloads. If an old transfer expires, the UI offers explicit guest-selection clearing after the customer reviews the account cart; it does not automatically submit a new token and risk duplication. Account carts never enter local storage. Server session changes reset in-memory identity-dependent request state. All server mutations recheck authority.

Rate limits cover resolve and mutations, with fixed-minute Atlas records and TTL cleanup. These are application abuse controls, not a replacement for deployment-level request limits. The request body, IDs, line count, quantity and coupon format are bounded before catalog resolution. Signed-in ownership is never accepted from a browser field.

## Coupon rules

The new admin feature implements fixed/percentage codes using existing CouponKind and the unchanged integer-paise engine. Percentage values use basis points, fixed values and thresholds use paise. One code per cart, no stacking. Fixed discounts apply once across eligible goods; exclusions override inclusion. Scope may be all goods, explicit products, variants, categories (optionally descendants), or brands. Sale items can be excluded. Category expansion is bounded to the store's 1,000-record scope.

Minimum spend uses eligible pre-coupon sale values on the existing configured price basis; it does not count unrelated items. Allocation and GST rounding stay in the approved engine. The UI displays savings as the difference between before/after tax-inclusive goods totals, which includes the tax reduction for exclusive-price lines. There is no independent React tax calculation.

Codes are normalized, unique and immutable, including after archive. Schedules are UTC, start-inclusive and end-exclusive. Expiry is derived, not a stale stored status. Only ADMIN may save, with revision checks and atomic audit. Customers may be everyone, signed-in accounts, or explicit registered accounts. Per-account limits require sign-in; matching an unverified email never grants identity. Existing held/consumed claims are read for preview limits, but preview creates no claim and increments no usage.

Checkout must implement atomic capacity acquisition, claim generations, release/recovery and accepted snapshots before this becomes a redemption system. Total/per-account limits are configured here and checked against current claims; that is not a guarantee against checkout races. Free-shipping codes wait for the real shipping quote. First-order/existing-order conditions wait for verified completed-order semantics. No fake order counts, guest identity, or shipping totals are introduced.

## Interaction and verification boundary

Product detail adds the selected variant. Listing cards add only their sole matching option, otherwise linking to option selection. Header count, native-dialog drawer and cart share one provider. Initial loading uses a cart-shaped skeleton; background revalidation keeps the existing cart visible. Focus checks are throttled, simultaneous reads share one request, requests have a client deadline, and failures show a recoverable error. Shared timed toasts report additions, removals, quantity updates and clearing. Skeleton animation honors reduced-motion preferences.

Focused verification covers manipulated payloads, limits/overflow, owner isolation, replay/payload mismatch, revision races, double merge, deactivation, archive exclusion, safe projection and coupon tax effects. Browser checks cover guest add/reload/update/remove, background refresh, failure recovery and mobile layout. Checkout/payment invariants are unchanged and are not claimed implemented.

Reference behavior was compared with [Shopify amount-off discounts](https://help.shopify.com/en/manual/discounts/discount-types/percentage-fixed-amount) and [WooCommerce coupon management](https://woocommerce.com/document/coupon-management/). These informed scope and exclusions; the existing application pricing contract remains authoritative.
