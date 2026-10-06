# Reusable e-commerce base

Single-tenant Next.js foundation for India/INR physical goods. Stage 3 routes remain visible placeholders. Part 4A adds pure pricing and lifecycle code; its final verification is delegated to Antigravity and pending.

Use Node **24.21.0** and npm **11.19.0**:

```sh
npm ci
npm run dev
npm run test
npm run verify
```

Open http://localhost:3000. APIs return 501; admin pages remain unprotected empty placeholders. No credentials are needed. No database, authentication, provider integration or production deployment is implemented.

`verify` runs domain tests, lint, typecheck, production build, Markdown links, secret patterns, canonical enum regeneration/definitions, eleven Mermaid renders and Chromium route checks. The browser check uses a temporary production server on port 3217. Generated artifacts are ignored under .validation and .cache/puppeteer.

Use `npm run generate:states` after approved registry membership edits; never hand-edit the generated TypeScript file.

Start with [progress](docs/PROGRESS.md), [Part 4A ADR](docs/adr/0008-pure-domain-foundation.md), [pricing rules](docs/commerce/PRICING-RULES.md) and [canonical states](docs/commerce/STATE-MACHINES.md). The [Antigravity prompt](docs/development/ANTIGRAVITY-4A-VERIFICATION.md) delegates remaining testing and routine verification. [Development order](docs/development/DEVELOPMENT-ORDER.md) defines later gates.

Client design/configuration belongs in src/client. Transactional invariants stay in the base template; see [reuse strategy](docs/development/TEMPLATE-REUSE.md).
