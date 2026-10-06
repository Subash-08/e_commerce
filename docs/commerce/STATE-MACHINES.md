# Canonical state and enum registry

This is the sole definition of enum membership and allowed lifecycle transitions. Other documents may reference values in scenarios/diagrams but must not define competing enums. Stage 3 does not generate business state-machine code.

| Domain | Allowed values / default |
| --- | --- |
| Role | CUSTOMER (default), STAFF, ADMIN |
| AccountState | ACTIVE (default), DISABLED |
| CatalogState | DRAFT (default), ACTIVE, ARCHIVED |
| StockStatus | IN_STOCK, OUT_OF_STOCK; default OUT_OF_STOCK |
| AttributeType | TEXT, NUMBER, BOOLEAN, SINGLE_SELECT, MULTI_SELECT, COLOUR |
| CustomerType | GUEST, ACCOUNT |
| OrderState | PENDING_PAYMENT, PLACED, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, EXPIRED |
| BindingState | NOT_STARTED, REQUESTING, BOUND, UNKNOWN, FAILED |
| PaymentState | PENDING, AUTHORIZED, CAPTURED, FAILED |
| FinancialState | PENDING, PAID, PARTIALLY_REFUNDED, REFUNDED |
| RefundState | PENDING, SUCCEEDED, FAILED |
| FulfillmentException | NONE, REVIEW_REQUIRED, REFUND_REQUIRED |
| ReservationState | ACTIVE, CONSUMED, RELEASED |
| CouponKind | FIXED, PERCENTAGE |
| ClaimState | HELD, CONSUMED, RELEASED |
| InvoiceState | ISSUED, VOID |
| JobState | PENDING, RUNNING, RETRY, SUCCEEDED, DEAD |
| JobKind | PROCESS_WEBHOOK, RECONCILE_PAYMENT, EXPIRE_ORDER, IMPORT_CHUNK, SEND_NOTIFICATION, INVALIDATE_PUBLIC_CACHE, REVOKE_SESSIONS |
| ImportState | UPLOADED, VALIDATING, PREVIEW_READY, QUEUED, RUNNING, COMPLETED, COMPLETED_WITH_ERRORS, FAILED, CANCELLED |
| ImportMode | CREATE_ONLY, UPDATE_ONLY, UPSERT, SKIP_EXISTING |
| TaskState | TODO, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED |
| TaskPriority | LOW, MEDIUM, HIGH, URGENT |

Defaults: online order starts PENDING_PAYMENT, COD starts PLACED; financial summary PENDING, fulfillment exception NONE; refund PENDING; job PENDING. No fake successful default.

## Order transition table

| From -> To | Guard / atomic effects |
| --- | --- |
| New -> PENDING_PAYMENT | Accepted server quote + checkout idempotency + tracked reservations/claims |
| New -> PLACED (COD) | COD eligibility accepted; reserve only tracked units; no paid financial status |
| PENDING_PAYMENT -> PLACED | Verified full capture; tracked reservation consumed once; coupon claim consumed |
| PLACED -> CONFIRMED -> PROCESSING | Current authorized action; financial eligibility or COD policy; no fulfillment exception |
| PROCESSING -> SHIPPED | Tracking facts; online capture eligible; COD tracked reservation consumed at shipment |
| SHIPPED -> DELIVERED | Authorized delivery evidence; COD collection separately recorded |
| PENDING_PAYMENT -> EXPIRED | Deadline reached; recheck local verified payment; release active reservations/claims once |
| PENDING_PAYMENT/PLACED/CONFIRMED/PROCESSING -> CANCELLED | Cancellation rules; release active reservations; paid/refundable balance creates refund work; consumed inventory not blindly restored |
| EXPIRED -> PLACED | Exceptional late capture recovery only: fresh eligibility, atomic reacquisition of all required tracked stock and coupon capacity, exactly-once capture effect; log recovery reason |
| CANCELLED/EXPIRED + late money | Preserve terminal status unless explicit expiry recovery above; record capture and REFUND_REQUIRED when fulfillment cannot safely resume |

No automatic SHIPPED/DELIVERED cancellation/rollback; returns need future workflow/manual reviewed correction. COD reservations use a fulfillment deadline configured by client, not the online 15-minute payment timeout. Overdue COD orders alert staff rather than silently expire after payment timeout.

## Payment/refund rules

Verified observations can advance PENDING -> AUTHORIZED -> CAPTURED or PENDING -> CAPTURED. A definitive failed attempt becomes FAILED. Later verified capture may correct FAILED -> CAPTURED (out-of-order observation), with audit reason. No CAPTURED -> FAILED. One provider payment ID identifies one attempt; a retry with a new ID is a new attempt.

Financial summary derives from verified captured receipts minus successful refunds, not the most recent callback. Full required capture => PAID; some successful refunds => PARTIALLY_REFUNDED; all captured amount refunded => REFUNDED. Extra/partial capture anomalies set REVIEW_REQUIRED and block fulfillment. COD receipt is an audited payment entry; until collected, summary is PENDING.

Refund PENDING -> SUCCEEDED/FAILED; failure may retry with same operation identity only after provider status disambiguation. New externally confirmed evidence can correct FAILED -> SUCCEEDED with audit. Refunds never mutate the captured payment state.

Reservations ACTIVE -> CONSUMED or RELEASED; terminal balances cannot apply twice. Late recovery creates a distinct audited reservation generation/reacquisition operation and does not revive a RELEASED record silently. Claim transitions mirror reservation use.

## Job/import/invoice guards

Jobs PENDING/RETRY -> RUNNING by atomic due claim; RUNNING -> SUCCEEDED/RETRY/DEAD by current lease token only. Expired lease is reclaimable; handlers must be idempotent. DEAD requires reviewed replay; never silently discard financial work.

Imports follow validation -> preview -> explicit confirmation -> queued chunks -> completed or completed-with-errors. Cancel stops uncommitted future chunks, never pretends to undo completed products. Invoices are created ISSUED once; VOID is an audited append to status metadata only where legally permitted. Corrections create credit notes; original legal fields remain immutable.

All transitions use operation IDs, expected revision/state and append actor/reason/time. Define transition functions and race tests in the first business-code phase.
