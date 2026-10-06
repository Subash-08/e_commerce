# Development order

Current authorization ends after Stage 2 documentation. Stage 3 is scaffold-only after explicit acceptance. The sequence below is future implementation, not current permission.

| Phase | Deliverable | Dependency / exit evidence |
| --- | --- | --- |
| 0 | Stage 3 scaffold, config, isolated roots, checks | Approved docs; exact dependency/runtime plan; no commerce logic |
| 1 | DB/shared client, auth/users/roles/settings, error/log boundary | Auth conditional checks, revocation/last-admin tests, no default admin password |
| 2 | Pure pricing + lifecycle functions | Unit conservation/rounding/transitions before checkout UI |
| 3 | Minimal purchase slice with one explicit test fixture product/default variant | Test-only seed, fresh cart/quote, guest order, optional tracked stock, Razorpay test binding/webhook/recovery; PAY-03/04 pass |
| 4 | Categories/brands/attributes/products/variants/media + admin creation | Stable IDs, constraints and editor revision tests |
| 5 | Public catalog/search/filters | Authoritative projection, metadata/SEO/cache from day one |
| 6 | Shopping hardening, login merge, coupons | Fresh resolution, claim race and unavailable UX |
| 7 | Orders/invoices/labels/admin payments/customers | Immutable ledger, COD policy, minimal refunds, operational transitions |
| 8 | CSV preview/import/export | Catalog services stable; private files, resumable jobs, conflict tests |
| 9 | Reports/users/settings/content administration | Snapshot-based metrics; homepage implementation only after design |
| 10 | Email/n8n/analytics/monitoring completion; optional Work last | Recovery email/critical alerts already added when needed earlier |
| 11 | Production E2E/security/accessibility/performance/restore audit | Both deployment profiles, client legal/CA approval, operational runbooks |

The reviews contain two different development orders. This plan retains the pure-rules-first and thin-payment-slice sequence because pricing/state/recovery cannot safely wait until after full checkout. The thin slice is explicitly test-fixture driven, not a polished storefront before the catalog model exists. Broad public catalog follows complete catalog admin. CSV follows stable services and job behavior rather than delaying early payment validation.

Tests run throughout, not only Phase 11. Secrets/provider accounts become prerequisites only when a phase needs them; they do not block documentation or placeholder builds.
