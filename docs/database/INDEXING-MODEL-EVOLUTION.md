# Indexes and model evolution

Index definitions are deployed through reviewed migrations, not automatic production index sync. Prove explain plans with expected data and reject indexes that duplicate useful prefixes without benefit.

| Collection | Unique constraint | Query indexes |
| --- | --- | --- |
| products | slug | status/categoryId/publishedAt/_id; status/brandId/_id; chosen facet predicates |
| variants | normalizedSku; productId/combinationKey | productId/active; productId/trackQuantity |
| attributes/categories/brands | code / slug / slug | category parentId/displayOrder |
| profiles/carts/wishlists | authUserId / userId / userId | role/status for profiles |
| securityGuards | key | none needed |
| checkoutAttempts | ownerKeyHash/idempotencyKey | orderId; providerOrderId partial unique when bound |
| orders | orderNumber | userId/createdAt/_id; orderStatus/expiresAt; createdAt/_id |
| payments | provider/providerPaymentId partial when present | orderId/createdAt; provider/providerOrderId |
| refunds | operationKey; providerRefundId partial scoped by provider | paymentId/state; orderId |
| reservations | orderId/variantId/generation; partial ACTIVE orderId/variantId | state/expiresAt/_id |
| coupons/claims | normalizedCode; couponId/orderId/generation; partial HELD couponId/orderId | active/expiresAt; claim state/expiry |
| invoices/counters | issueKey; seller/FY/series/sequence; counter key | orderId |
| webhookEvents/jobs | provider/eventId; kind/businessKey | event state; jobs state/dueAt/leaseUntil |
| importJobs/audit | import operation keys enforced per batch | owner/createdAt; entityId/occurredAt |
| redirects/settings/pages/navigation | fromPath / key / slug / key | only query-driven additional indexes |
| transient grants/merge receipts | tokenHash / userId+tokenHash | expiresAt TTL where deletion is safe |

Missing provider IDs need partial indexes, not a unique index accepting only one null. Stable sort always includes _id as tie-breaker. Facet predicates must bind values within the same variant. Avoid compound indexes with unsupported parallel arrays; inspect plans on real MongoDB. Search implementation uses normalized fields and bounded patterns; dedicated search engine is deferred.

## Evolution procedure

1. Add an optional field with explicit missing-value reader behavior and schemaVersion support; do not change meaning of old stored numbers.
2. Deploy readers compatible with old/new forms.
3. Dry-run migration: count affected IDs, validate destination constraints and record backup/restore reference.
4. Backfill bounded batches with checkpoint and compare-and-swap revision, deterministic transform and retry-safe operation ID.
5. Verify counts, constraints, projection source revisions and explain plans; canary client first.
6. Enable writers and eventually remove legacy handling only after all supported client versions migrate.

Derived fields are rebuildable from source records. Historical invoices/order snapshots are not recalculated by catalog/tax migration. For required historical corrections, add a linked correction document. Enum changes require explicit mappings and transition tests.

Each migration records ID/checksum/start/completion/counts/failure details in a small migration ledger when migrations begin. No migrations or ledger created at this stage. Rollback is either compatible code rollback or tested restore/forward repair; do not assume reversing a script restores external payments. See [operations](../operations/ENVIRONMENTS-BACKUPS.md).
