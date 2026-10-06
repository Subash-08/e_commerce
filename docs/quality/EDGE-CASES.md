# Edge-case acceptance catalogue

Each row is a future required test, not a passing test result. Logs are redacted and include operation/correlation/entity IDs only.

| ID / scenario | User-visible expected result | Server behavior / log | Required verification |
| --- | --- | --- | --- |
| CAT-01 option rename/regenerate | Same selected option, updated label | Preserve variant IDs/SKUs, audit diff | Integration generator retains identities; order snapshot unchanged |
| CAT-02 remove selected variant | Unavailable line with remove/reselect | Archive ref, block new checkout, retain history | Cart/wishlist/checkout E2E |
| CAT-03 slug/reparent/cycle | Correct new URL/breadcrumb | Redirect old slug, reject cycles, invalidate old/new taxonomy | Integration + metadata crawl |
| STOCK-01 two buyers last unit | One succeeds, other stock conflict | Conditional reserve transaction, no negative balances | Real replica-set concurrent checkout |
| STOCK-02 untracked + mixed cart | Status-only item works without quantity | No reservation for untracked; tracked lines reserve atomically | Assert zero untracked reservation records |
| STOCK-03 toggle tracking while held | Explain why change cannot proceed | Reject until no ACTIVE reservations, audited opening stock | Integration race against checkout |
| MONEY-01 inclusive/exclusive/odd paise | Exact reviewed total | Pure engine, deterministic allocations/version | Unit golden cases + property conservation |
| MONEY-02 last coupon use/expiry | One claim or changed quote | Atomic claim cap, expiry/release, no double increment | Concurrent claim + rounding tests |
| CHECK-01 double click/changed price | Same order or review new quote | Owner/key/fingerprint and revisions, 409 conflict | E2E two tabs; compare stored snapshot |
| SHOP-01 price/name/media changed | Current cart/wishlist facts | Fresh bounded resolution, no public cost data | Integration + UI focus refresh |
| SHOP-02 repeated login merge | Quantities merged once | Consumed merge token/fingerprint | Retry/reload test |
| SHOP-03 profile edit after purchase | New address future only | Historical order/invoice unchanged | Snapshot comparison |
| PAY-01 webhook before/after callback | Single final payment result | Shared idempotent transition, unique IDs | Permute ordering + duplicate/different event IDs |
| PAY-02 capture succeeds, DB unavailable | Pending then correct paid order | Durable retry/reconciliation; no lost capture | Failure injection between provider/DB steps |
| PAY-03 late capture after expiry, stock available | Recovered paid order | Expire releases once; verified capture reacquires all tracked stock atomically, consumes once; audit recovery | Replica-set race test with injected clock and delayed UPI-style capture; duplicate callback/webhook |
| PAY-04 late capture after expiry, stock unavailable | Paid-but-refund-required explanation | Record real capture, block shipment, create refund work; no negative stock | Sell released unit to second buyer, deliver late event, assert ledger/stock/exception/job |
| PAY-05 duplicate/ambiguous partial refund | Pending or confirmed refund, never double | Claims include pending refunds; provider lookup before retry | Concurrency + timeout + stale webhook tests |
| PAY-06 provider-order timeout after creation | Pending, no second charge attempt | UNKNOWN binding, reconcile receipt/evidence | Simulate remote success/no response |
| ORD-01 invalid fulfillment transition | Conflict/action unavailable | Guard role/revision/payment/exception, history | Ship unpaid online order denied; stale admin save denied |
| DOC-01 concurrent invoice/render failure | One number, PDF retry | Counter+issue atomic, immutable snapshot | Parallel issue + PDF golden multipage + FY boundary |
| SEC-01 role/deactivation with session | Next protected action denied | DB role/authVersion check; revoke retry logged | Old cookie/API/Server Action and direct auth endpoint tests |
| SEC-02 concurrent last-admin demotion | At least one active admin | Shared guard transaction serialization | Two concurrent requests on replica set |
| SEC-03 guest/other-user invoice attack | Neutral/denied response | Owner/scoped one-use grant/rate limit | Enumeration, expired/replay token, IDOR tests |
| MED-01 bad upload/replace referenced asset | Validation or safe media fallback | MIME/size/folder/SSRF checks, deferred reference cleanup | Upload/URL injection + historic image retention |
| IMP-01 duplicate rows/retry chunk | Accurate created/skipped/error counts | Stable row operation IDs, unique SKU | Crash mid-chunk then replay |
| IMP-02 edit after CSV preview | Conflict row, no overwrite | Recheck expected revision/input hash | Concurrent admin edit before confirmation |
| JOB-01 worker crashes/lease expires | Work eventually resolves or alerted | Fenced completion; retry/DEAD alert | Two-worker lease race, missed scheduler alarm |
| SEO-01 product update/filter query | Consistent visible/meta offer | Public projection/tag invalidation; filter noindex | Render HTML/JSON-LD and cache integration |
| SET-01 tax/shipping change mid-checkout | Updated quote requires review | Version guard; old orders fixed | Quote mismatch integration |
| CMS-01 policy/nav publish | Current content, old accepted version retained | Versioned publish, no executable HTML | Content XSS + acceptance history |
| REP-01 refund/product rename | Historical sales consistent | Payment/refund/timezone definitions from snapshots | Ledger/report reconciliation fixtures |
| MIG-01 interrupted backfill | Old/new app remains readable | Checkpoint/revision retry, no invoice rewrite | Mixed schema integration + restore drill |

Additional required combinations: late capture against CANCELLED order (never auto-revive); tracking-mode switch during expiry; invalid signature before any webhook persistence; malformed/oversized CSV; duplicate event hash mismatch; unsupported tax country; COD reservation consumes at shipment and remains unpaid until receipt.
