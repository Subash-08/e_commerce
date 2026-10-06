# Feature implementation and orchestration plan

Updated 2026-10-06. This is the execution detail for [development order](DEVELOPMENT-ORDER.md), not authorization to implement every listed feature. Current implementation authorization ends at 4B. Later packages require their named gate and user authorization. Existing contracts remain authoritative; do not duplicate status definitions here.

## Current board

| Work | State | Owner / next action |
| --- | --- | --- |
| 4A pricing and state functions | Verified | Preserve 161-test baseline; add evidence for later changes |
| 4B database foundation | Verification running, acceptance pending | Antigravity supplies final commit/report; Codex reconciles findings and fixes complex defects |
| 4B static review | Open | Resolve/disprove database selection, BSON index comparison and cleanup findings against the final revision |
| Auth compatibility | Blocked | Codex resolves ADR 0003 before an auth install |
| Remaining features below | Planned, not started | Activate one bounded package at a time after dependencies pass |

No Docker. No second verification run against the same active checkout. Passing a test count alone does not close [the static review](../database/STAGE-4B-CODE-REVIEW.md).

## Work sequence and acceptance

Each row is a bounded work package, not a promise to implement the entire module at once. Read [collection contracts](../database/COLLECTIONS.md), [change effects](../architecture/CHANGE-IMPACT-MATRIX.md), [route contracts](../storefront/ROUTES.md) and the relevant ADR before coding.

| ID | Implement in this order | Depends on / entry gate | Required exit evidence |
| --- | --- | --- | --- |
| B-CLOSE | Reconcile 4B report; fix database identity, BSON comparison and resource cleanup where still present | Final Antigravity revision/report | Real replica-set regressions, no skipped tests, all 4B checks; updated progress and acceptance commit |
| AUTH-DECIDE | Resolve supported index policy and credential ownership; select email transport for recovery | 4B compatibility report; no package install for this decision | Revised ADR with explicit selection and justified remaining runtime proofs; no silent index-policy relaxation |
| AUTH-CORE | Shared-client auth integration, signup/signin/signout, library recovery, session lifecycle and profile link | B-CLOSE, AUTH-DECIDE, separate auth authorization and dependency plan | Real recovery/revocation tests; no credential duplication, no guest-email ownership merge |
| AUTH-GUARDS | Service authorization, ownership, active-profile checks, authVersion, guarded last-admin changes and audit | AUTH-CORE | Demotion/deactivation with old cookies, concurrent last-admin protection, direct endpoint bypass tests |
| C-IDENTITY | Category hierarchy/primary-category rules, Brand, Attribute/Option stable identity, Product/default Variant/Variant schemas | B-CLOSE, completed auth slice under current sequence, 4C authorization | Stable IDs under edits, SKU uniqueness race, archive policies, schemaVersion and explicit index manifest |
| C-READ | Public DTO projection, variant summaries and repair service, category/slug policy, SKU search path, facet queries, cache tags and media contract | C-IDENTITY | Private fields excluded; same-variant Black/8GB vs Silver/16GB regression; summary repair; no N+1 |
| C-PERF | Fixture generator and hot-query verification | C-READ; synthetic fixtures only | 5,000 products / 20,000 variants; explain plans, examined/returned ratios, machine-recorded p95; no unjustified COLLSCAN/blocking sort; close 4C |
| D-RECORDS | Order/payment/refund snapshots, reservation records, coupon/shipping/tax settings needed by purchase, counters and redirects | Accepted 4C, 4D authorization | Correct snapshots, scoped partial unique indexes, optimistic concurrency, index justification and slug-redirect integration |
| D-DURABILITY | Webhook event inbox, bounded required jobs, leases/retries, expiry and reconciliation queries | D-RECORDS; host and scheduler decision before runner | Durable deduplication, lease/restart recovery, missed-tick handling; external calls outside transactions; close 4D |
| BUY-CART | One real fixture product/default Variant, cart, address input and server quote | Accepted 4D; purchase authorization | Fresh public data, stale/archive/stock handling, deterministic paise totals, browser price tampering rejected |
| BUY-ORDER | Guest checkout, idempotent order creation, snapshots, quantity-only reservations, protected guest access | BUY-CART | Mixed tracked/untracked cart atomicity, concurrent last unit, coupon limits and replay-safe checkout |
| BUY-PAY | Razorpay test order/capture integration, verified webhook persistence and unified transitions | BUY-ORDER; test credentials and provider dependency decision | Duplicate/reordered events, amount/currency mismatch, ambiguous provider response, timeout/reconciliation; no paid state from browser callback |
| BUY-RECOVER | Expiry/release, late captures, retries and recovery through the same transition service | BUY-PAY and D-DURABILITY | PAY-03/04 with and without available stock; crash between external call and persistence; no duplicate release/refund; complete thin purchase journey |
| ADMIN-CATALOG | Minimal category/brand/attribute forms, inline product editor, stable variant generation, media mutations | Accepted purchase slice, AUTH-GUARDS, C-READ; admin authorization | CRUD uses existing services; edit races, safe archive, stable IDs, media ownership, retryable cache invalidation |
| ADMIN-BULK | CSV preview/import, validation report, bounded bulk actions and compatible exports | ADMIN-CATALOG; CSV package gate | Explicit limits, duplicate/conflict handling, partial failure semantics, formula-safe exports; no service bypass |
| SHOP-BROWSE | Listing/search/filter/product pages using public DTOs; cart/wishlist interactions | C-READ, accepted purchase services; storefront authorization | Pagination/filter correctness, private-data exclusion, metadata/structured data, cache behavior; filtered pages noindex without robots blocking |
| SHOP-ACCOUNT | Account profile/address book, own orders and details; guest tracking through purpose-scoped grants | AUTH-GUARDS, purchase slice | Cross-user access denied, guest grants scoped/expiring, no automatic attachment by email |
| OPS-ORDERS | Admin order management, supported fulfillment/COD/cancellation flows, refund orchestration and reconciliation views | Purchase services, AUTH-GUARDS; operations authorization | Legal transitions, concurrent cancel/capture/refund races, refund capacity, provider idempotency and audit |
| OPS-DOCS | Invoice issuance/number scope and immutable invoice data, PDFs/labels and authorized downloads | Order snapshots and counters; client CA/legal-approved rules before production issuance, PDF/storage gates | Concurrent numbering, immutable issued snapshot, retries, access control and exact totals; no local-disk financial source of truth |
| OPS-COMMS | Transactional notifications and operational reports/settings screens | Durable jobs, relevant completed services; selected email transport | Retries/deduplication; mail or analytics failure cannot change transaction truth; privacy-safe report access |
| DESIGN-CONTENT | Approved homepage section schema/design, static blog and reusable client branding | Explicit homepage design approval; public read services | Mobile/keyboard/loading/error states, real content, correct SEO; no invented reviews |
| RELEASE | Staging, security/accessibility/performance, backup/restore, scheduler alerts, rollout/rollback and client setup | Required V1 packages accepted; actual hosting and client sign-offs | Real restore drill, provider recovery, launch journey, secrets/config separation, documented residual risks and release tag |
| OPTIONAL-WORK | Optional Work Management | V1 complete, separate scope approval | Disabled by default; isolated from commerce invariants |

A minimal end-to-end purchase comes before the full catalog editor, bulk tooling or homepage. Test fixtures are for local verification only; normal runtime must never silently seed or substitute products on failure. Purchase success does not imply launch readiness.

## Ownership and handoff protocol

Codex owns complex pricing/state changes, transaction and race fixes, auth authority, stable variant regeneration, snapshot/index design, payment recovery and review of reported failures. Antigravity owns routine forms once contracts exist, test execution, fixtures, browser checks, formatting and repetitive verification. Codex may do a small fix and focused test locally when cheaper than handing it off.

Use these steps for every activated package:

1. Record ID, authorization, predecessor acceptance commit, scope and allowed files. Read current progress and inspect uncommitted work.
2. Select one writer for each path. In a shared checkout, implementation and verification run sequentially. Independent work needs isolated checkouts and disjoint responsibilities; merge before final acceptance.
3. Codex implements the complex contract and a reviewable checkpoint. Record required scenarios and any approved dependency additions.
4. Give Antigravity the exact checkpoint, bounded file list and checks. Routine corrections are allowed; changes to financial, identity or transaction behavior come back with a reproduction for Codex review.
5. Codex reviews the actual diff and evidence, not just a pass summary. Run focused regression after a fix; broad reruns only when changed behavior or outstanding failures justify them.
6. Update docs/PROGRESS.md with version/commit, commands, counts, unresolved findings and next gate. Commit acceptance only when required work is complete; stop at the authorized boundary.

Keep one active implementation package and one verification handoff at most. No new tasks/messages or background automation are dispatched by this plan. The user provides the Antigravity report in this conversation.

## Safe parallel preparation

While current tests run, Codex can inspect contracts and prepare decisions without touching tested code. Host/scheduler research may accompany catalog verification; content/brand input collection may accompany purchase verification. Do not install dependencies, modify a shared package lock, run competing builds, or start downstream services against unaccepted contracts.

Auth authority and its index policy must not be worked around to expose admin CRUD. Backend catalog work before auth would require an explicit resequencing decision; it is not implied by this plan.

## Information and credentials, requested just in time

| Needed before | Information / secret |
| --- | --- |
| Current 4B | None; ephemeral local replica set |
| Auth decision | Email transport choice and local recovery-test approach |
| External recovery email test | Sender domain and selected provider test credentials; generate auth secret locally, never paste it into chat |
| D-DURABILITY | Chosen VPS/Vercel profile, scheduler cadence, region, connection budget and recovery targets; no purchase inferred |
| BUY-PAY | Razorpay test key ID/secret and separate webhook secret through local secret configuration; never production keys |
| Real media exercise | Selected Cloudinary credentials and asset ownership settings |
| Invoice production acceptance | Client legal entity/GST configuration, CA/legal-approved rules and private artifact storage choice |
| RELEASE | Managed Atlas/staging/deployment secrets, verified domains, production provider activation and backup permissions |

Use secure local configuration; never ask the user to paste secrets into the conversation, read .env files, log secret values, or commit credentials. Missing optional provider keys blocks only the corresponding integration proof, not unrelated pure work. Do not claim mocked provider behavior is live integration evidence.

## Reusable bounded Antigravity prompt

Fill the brackets with a selected, authorized package before sending:

> Work in D:\AI\e-commerce on [branch/checkpoint]. Read AGENTS.md, docs/PROGRESS.md and [package contract]. Complete only [ID and deliverable]. Approved files: [explicit paths]. Dependencies already installed: [list]; no new installs without the package plan. Do not edit files owned by another active worker. Preserve commerce invariants and use existing services. Run [focused commands/scenarios], then required acceptance checks once on the final revision. Record exact command results, skipped/failed cases, versions and limitations. If a complex invariant defect appears, provide the failing case and return it for Codex repair; do not weaken the check. Update progress, commit scoped work, and stop. No later features, Docker, real environment-file reads, secret logging or production provider calls.

The existing [4B verification handoff](ANTIGRAVITY-4B-VERIFICATION.md) remains the active prompt. This template is for later packages only.

## Definition of acceptance

Use [Definition of Done](DEFINITION-OF-DONE.md). Each package needs its behavior evidence, relevant authorization/privacy/concurrency checks and current lint/typecheck/build gates. Documentation changes need link checks; changes to diagrams need real rendering. Avoid repeating all suites for a documentation-only plan update. Critical payment/race evidence must exercise real database behavior. Record production and tooling audit findings separately. No planned feature is marked implemented by this table.

