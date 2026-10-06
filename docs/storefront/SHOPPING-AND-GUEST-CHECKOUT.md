# Cart, wishlist and guest checkout

Guest cart/wishlist stores productId + stable variantId + quantity where needed + addedAt. No customer PII, copied prices or credentials in local storage. Signed opaque checkout session scopes idempotency, not trusted totals. Account shopping state lives in MongoDB; server services enforce ownership.

Resolve current product/variant name/media/price/status in one bounded batch. Archived/missing/disabled variants produce an explainable unavailable line, excluded from totals and blocked from checkout until removed/reselected. Never silently swap a variant. Revalidate on focus/relevant mutations and always at checkout.

On login, merge cart by variant ID, sum once per merge token, bound quantity, report availability changes; wishlist unions identities. Stored operation receipt makes retry safe. Clear local items only after server confirmation. Coupon selection revalidates; do not promise coupon survival.

Checkout fields: name/email/mobile; shipping address lines/landmark/city/district/state/PIN/country; billing same/separate; optional business/GST details. Validate and normalize on server. Offer guest prominently, no password. Logged-in user can select addresses, but order stores copies.

Flow: resolve -> address/shipping eligibility -> coupon -> fresh quote -> user review -> idempotent order preparation -> payment -> server-verified status. A changed quote needs explicit review; browser sent price is ignored. Outages show pending/error honestly. Never automatically attach guest order to an account with matching email.

Guest tracking starts with order number and email/mobile challenge request returning a neutral response. Send a short-lived verified link or OTP to the order's verified destination. Token hash/purpose/expiry/rate-limit/replay checks gate detailed order and invoice access. Order number alone or number plus guessable PII is not sufficient. Mobile delivery adapter is optional; verified email is the initial path.

Account route screens: dashboard, profile, addresses, orders, order detail and wishlist; account sessions do not grant another user's order access. Payment result pages fetch current owned/granted order state and do not reveal PII from URL parameters.

Accessibility: label address fields, announce price/errors, keyboard-operable variant/media controls, focus-managed drawer/dialog, preserved form state; no forced registration dark pattern.
