# Product scope and acceptance boundaries

Approved scope: reusable owned commerce foundation, not the fastest possible hosted-store launch. Custom build is a deliberate choice; no build-versus-adopt blocker remains.

| Area | V1 outcome | Deferred/excluded |
| --- | --- | --- |
| Catalog | Categories, brands, typed attributes, separate variants/default variant, media roles, SEO, rich detail blocks | Industry-specific weight pricing, regulated goods logic |
| Discovery | Server-rendered catalog, search, same-variant filters, sorting, pagination, wishlist | Search cluster, AI recommendations |
| Purchase | Guest/account cart and checkout, coupons, domestic India INR, Razorpay, optional COD | Subscriptions, wallet, marketplace, multi-currency |
| Availability | Status-only or optional quantity/reservation per variant | Suppliers, purchase orders, warehouses, ERP |
| Operations | Orders, invoices/credit-note path, labels, payment/refund records, reports, CSV preview/import/export | Advanced RMA/accounting/courier integration |
| Content | Policies/contact/FAQ, static blog; homepage CMS capability | Dynamic blog CMS, drag-and-drop homepage builder |
| Accounts | Profile/addresses/orders, simple roles, verified guest lookup | Complex RBAC, silent guest account linking |
| Optional | Newsletter, Work Management last/off by default, n8n hooks | Loyalty/reviews/comments/customer Q&A |

Guest purchase must never require registration. The product editor owns inline attribute creation and variant generation. Exact homepage sections await design approval.

Normal correctness additions are webhookEvents, durable jobs, coupon claims, quantity reservations, redirects, audit records, schema migrations and private invoice access. They are not licenses to build general ERP/job frameworks.

User journeys: discover -> inspect/select variant -> current cart -> guest/account address -> server quote/review -> create order -> payment -> verified result -> tracking/invoice. Admin: create catalog -> preview/publish -> fulfill confirmed orders -> reconcile exceptions -> report immutable sales.

Release gates: no real payment until recovery/race tests pass; no launch before legal/CA, backups/restore, scheduler and access checks. Feature presence in this document is planned, not implemented.
