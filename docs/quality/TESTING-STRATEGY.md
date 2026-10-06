# Testing strategy

Business code is not implemented in Stage 2. These are acceptance requirements and fixtures to create in the relevant later phase.

| Layer | Tool proposal | Focus / gate |
| --- | --- | --- |
| Pure unit | Vitest | Pricing conservation/rounding, coupon allocation, allowed/forbidden transitions, variant combination identity |
| Integration | Vitest + real disposable Mongo replica set | Unique/partial indexes, transactions, retries, last-unit/admin/coupon races, snapshot immutability |
| Browser | Playwright | Guest/account purchase, current cart, invalid variant, auth/ownership, product editor, mobile keyboard flows |
| Provider contract | Test-mode Razorpay + signed fixture replay | Real order binding/capture/status; duplicates/out-of-order; no live money |
| Docs/build | Links + Mermaid CLI, lint/tsc/Next build when scaffolded | Route coverage, imports/server boundaries, no fake success handlers |
| Operations | Staging drills | Restore, scheduler failover/lag, revoke secret/session, rollback compatible deploy |

Use injected clocks and provider adapters for deterministic expiry/network tests. Do not require real payment completion for every unit test; do require a real test-mode integration before launch. Tests never assume provider transport delivers exactly once.

Mandatory PAY-03/PAY-04: create tracked order with short injected deadline -> reserve -> expire and release -> optionally sell unit to another order -> inject delayed verified capture -> assert recovered fulfillment only if all stock/coupon eligibility can be acquired; otherwise captured ledger + refund-required exception + blocked shipment + durable work. Replay callback and multiple webhook IDs, and race expiry with capture. Repeat mixed/untracked carts to prove no synthetic reservations.

Auth acceptance: shared MongoClient driver compatibility; adapter rollback behavior; password recovery revokes sessions; role/deactivation invalidates old session immediately despite revocation job failure; direct auth plugin role endpoint cannot bypass last-admin service. Test default cookie cache disabled. Exact library compatibility must be cleared before installing/activating auth.

Fixtures are synthetic under tests/fixtures. No real PII, credentials or production payment exports. Replica-set tests must assert transaction effects, not use standalone mocks as proof. Property tests: allocated discounts equal intended discount, gross=base+tax, refund sum <=capture, stock balances nonnegative, applying a verified event twice is equivalent to once.

Coverage is risk-based: critical invariants and every row in [edge cases](EDGE-CASES.md), not an arbitrary line percentage. PR evidence lists commands, actual result and skipped environment tests. No passing test claim until executed.

Both hosting profiles require production-build smoke tests with scheduler adapter, protected endpoint, private no-store and catalog invalidation. Multi-replica VPS requires additional cache consistency tests before enabling it.
