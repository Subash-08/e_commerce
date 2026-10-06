# Reusable e-commerce base

Single-tenant Next.js foundation for India/INR physical goods. UI routes remain visible placeholders. Part 4A pure pricing and lifecycle code is verified. Part 4B database infrastructure is implemented with verification delegated to Antigravity and pending.

Use Node **24.21.0** and npm **11.19.0**:

```sh
npm ci
npm run dev
npm run test
npm run verify
```

Open http://localhost:3000. Health/readiness APIs return minimal status responses; other APIs return 501. Admin pages remain unprotected empty placeholders. No credentials are needed for the local ephemeral database. Authentication, provider integration and production deployment are not implemented.

`verify` runs domain tests, lint, typecheck, production build, Markdown links, secret patterns, canonical enum regeneration/definitions, eleven Mermaid renders and Chromium route checks. The browser check uses a temporary production server on port 3217. Generated artifacts are ignored under .validation and .cache/puppeteer.

Use `npm run generate:states` after approved registry membership edits; never hand-edit the generated TypeScript file.

Start with [progress](docs/PROGRESS.md), [Part 4A ADR](docs/adr/0008-pure-domain-foundation.md), [pricing rules](docs/commerce/PRICING-RULES.md) and [canonical states](docs/commerce/STATE-MACHINES.md). The [4A Antigravity prompt](docs/development/ANTIGRAVITY-4A-VERIFICATION.md) is historical; use the 4B prompt below for current verification. [Development order](docs/development/DEVELOPMENT-ORDER.md) defines later gates.

Client design/configuration belongs in src/client. Transactional invariants stay in the base template; see [reuse strategy](docs/development/TEMPLATE-REUSE.md).

Stage 4B database implementation is awaiting verification. Use the [4B Antigravity prompt](docs/development/ANTIGRAVITY-4B-VERIFICATION.md) and [local no-Docker setup](src/server/db/README.md). No credentials are needed for the ephemeral replica set. [Auth compatibility](docs/database/AUTH-COMPATIBILITY-REPORT.md) is not approved.
