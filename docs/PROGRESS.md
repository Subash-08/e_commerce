# Foundation progress

Updated 2026-10-06. Workspace: D:\AI\e-commerce. Branch: codex/stage-4a-domain.

## Current gate

Part 4A implementation checkpoint; **final verification pending Antigravity**. The user authorized Part 4A through the Stage 4 attachments, then assigned routine work and testing to Antigravity. Do not start 4B, auth installation, catalog models or UI.

Stage 3 is complete at 6421b7d. Current branch: codex/stage-4a-domain. This checkpoint is not a completed Stage 4A acceptance claim.

## Part 4A implementation and handoff

- Pure integer-paise helpers and pricing engine: explicit coupon allocation, inclusive/exclusive/exempt tax, tax components, shipping thresholds, safe bounds and copied input/version snapshots.
- Generated canonical state values/types from STATE-MACHINES.md with exact-regeneration validation.
- Pure order/payment/refund/reservation proposals with actor/reason/operation/revision guards. Captured attempts remain authoritative; pending refunds reserve capacity and block fulfillment.
- Tracked inventory only; status-only products create no reservation. Expiry releases once, capture consumes once, late recovery uses new generations.
- Final complex review added late capture on an overdue pending order before the expiry worker runs, plus explicit audit transition paths. These final changes are **not yet tested**.
- [ADR 0008](adr/0008-pure-domain-foundation.md) records implementation decisions. [Gated sequence](development/DEVELOPMENT-ORDER.md) records 4B/4C/4D and the user's corrections.
- [Detailed Antigravity prompt](development/ANTIGRAVITY-4A-VERIFICATION.md) contains exact scope, files, regression expectations, commands, permitted routine fixes and stop/report rules.

### Evidence actually obtained before delegation

- Installed only Vitest 5.0.3 as a new direct dev dependency; resolved Vite peer 8.3.3. Registry engine/peer ranges support pinned Node 24.21.0. [Vitest requirements](https://vitest.dev/guide/).
- npm install --save-dev --save-exact vitest@5.0.3 --no-fund succeeded.
- 146 unit tests passed in the last pre-handoff run (3 files), including 200 deterministic pricing-conservation cases inside one test.
- An earlier typecheck passed before the final aggregate/deadline/audit changes.
- The generated enum/duplicate-definition gate passed before the final deadline/doc edits.
- Installation audit still reported nine dev-tool findings (five high/four low); no new full production-audit claim has been made.
- No final clean install, formatting, lint, typecheck, build, docs/secret/diagram/browser verification has run against the final checkpoint. These are delegated, not waived.

### Limits

The passing tests precede the newest logic and cannot establish final acceptance. Antigravity must add/run the handoff regressions and record current results. If a financial/state invariant fails, return the failing case to Codex instead of changing expected results or weakening guards.

Reservation snapshots and in-memory compare-and-swap tests are pure models, not MongoDB transaction proof or a persistence schema. Effect descriptions execute no work. No database/provider/auth integration, real last-unit transaction, refund transaction, query/index performance or production tax/legal verification exists in this part. Browser/API routes remain the Stage 3 placeholders.

## Stage 3 historical record

The following versions and acceptance results describe Stage 3, not verification of the new Part 4A code. Earlier checkpoints: Stage 1 5572b1f; Stage 2 7dc596c.


## Delivered in Stage 3

- Minimal Next.js App Router/TypeScript/Tailwind scaffold, separate store/admin root layouts, loading/error/not-found boundaries.
- All 57 approved page routes visibly say "Placeholder — not implemented." All 15 API paths (16 methods) return 501 with no-store. No forms, CRUD, live data, authentication or provider calls.
- Typed configuration defaults, foundation-only Zod environment validator, narrow client branding layer, ten module and four infrastructure boundary READMEs.
- Runtime pins, npm lockfile, lint/format configuration and repeatable docs, enum, secret, Mermaid and browser route checks.
- Two sequence-diagram labels corrected after the real Mermaid parser rejected semicolons. No commerce behavior/transition changed.
- README contains working setup commands. Generated runtime/browser/build/validation files are ignored. No new planning document.

## Exact versions and compatibility evidence

Public npm registry metadata and official Node distribution metadata were checked on 2026-10-06 immediately before installation.

| Package/runtime | Installed version |
| --- | --- |
| Node / npm | 24.21.0 / 11.19.0 |
| next / eslint-config-next | 16.3.8 / 16.3.8 |
| react / react-dom | 19.3.0 / 19.3.0 |
| typescript | 5.9.3 |
| @types/node | 24.19.1 |
| @types/react / @types/react-dom | 19.3.0 / 19.3.0 |
| tailwindcss / @tailwindcss/postcss | 4.3.3 / 4.3.3 |
| postcss | 8.5.29 |
| eslint / prettier | 9.39.4 / 3.9.9 |
| zod / server-only | 4.6.5 / 0.0.1 |
| @mermaid-js/mermaid-cli | 12.0.0 |
| Mermaid / Puppeteer (transitive dev tooling) | 12.1.0 / 25.12.0 |

Next 16.3.8 was the actual latest stable registry tag; React peer ranges accept 19.3.0. Node 24 satisfies Next's >=20.9.0 and Mermaid CLI's >=22.13.0 requirements. Node's official Windows archive SHA-256 was verified before extraction into ignored .tools. Global Node 20 was not modified.

TypeScript 7 and ESLint 10 were not selected: installed lint peers require TypeScript <6.1 and eslint-plugin-react supports ESLint only through 9. ESLint 9.39.4 installs with an end-of-support warning; upgrade the compatible lint stack when its peers permit it. No peer overrides were used.

[Node release policy](https://nodejs.org/en/about/previous-releases), [Next installation requirements](https://nextjs.org/docs/app/getting-started/installation), [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli), [Vercel Node support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Vercel supports Node 24 but manages patch versions; exact local/VPS pins do not prove the eventual Vercel runtime patch. Actual hosting and deployment verification remain deferred.

## Acceptance evidence

Executed under Node 24.21.0 / npm 11.19.0 on Windows:

| Gate | Result |
| --- | --- |
| npm ci --no-fund | PASS; 548 packages installed from lockfile |
| npm run lint | PASS |
| npm run typecheck | PASS; Next route type generation and tsc --noEmit |
| npm run build | PASS; production compilation and page generation |
| npm run check:docs | PASS; 61 Markdown files checked |
| npm run check:secrets | PASS; repository text, including .env.example and lockfile |
| npm run check:enums | PASS; 23 canonical domains, references allowed |
| npm run check:diagrams | PASS; all 11 parsed and rendered to SVG |
| npm run check:routes | PASS; 57 pages visibly rendered in Chromium; 16 API methods, root separation, documented route coverage and 404 checked |
| npm run format:check | PASS |
| npm ls --depth=0 | PASS; exact direct versions match pins |
| npm ls deferred packages --all | Empty; no auth, MongoDB/Mongoose, Razorpay, Cloudinary, Vitest, Playwright test, PDF or CSV libraries installed |
| npm audit --omit=dev | PASS; zero vulnerabilities |
| git diff --check | PASS |

The complete acceptance sequence is npm run verify. Browser/diagram outputs are in ignored .validation. Puppeteer is Mermaid's required peer, reused for the browser gate; no test framework was installed. Page checks assert HTTP 200, visible placeholder text, correct store/admin shell and no browser page errors. Dynamic IDs use a harmless placeholder string.

The first npm ci attempt encountered a native-file lock from an existing project dev server running global Node 20. That server was stopped; the clean install succeeded. The preview was restored with the pinned Node 24 runtime after verification.

## Audit findings and verification limits

Full npm audit reports **9 development-tool findings: 5 high and 4 low**. These are dependency-chain counts rooted in two advisories:
- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): braces 3.0.3 via Next ESLint tooling; no patched version listed.
- [KaTeX inherited trust settings](https://github.com/advisories/GHSA-238p-pmpm-9mq7): KaTeX 0.16.47 via Mermaid; fixed in 0.18.2, outside the renderer's declared dependency range.

No forced downgrade or unverified dependency override was applied. These remain open tooling risks; lint and diagram tooling use repository-controlled inputs and are not application request handlers. Do not describe the full dependency audit as clean.

Secret and enum checks are static pattern gates, not a proof against every possible encoding or definition style. No credential values were printed; no environment files other than .env.example were read. No database, auth, payment, tax/legal, race or business-rule tests ran because implementation is not authorized. Current placeholder prerendering is not the future authenticated caching/access policy. No hosting deployment or CI runner was exercised.

## Next authorized-work boundary

Complete the delegated Part 4A verification, report, then stop. Part 4B needs separate authorization and includes an auth compatibility report only; auth installation has its own gate. See the gated development order above.
