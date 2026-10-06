# Reusable e-commerce base

Single-tenant Next.js foundation for India/INR physical goods. Stage 3 provides visible route placeholders, configuration and validation tooling. Commerce, authentication, database access and provider integrations are not implemented.

Use Node **24.21.0** and npm **11.19.0**, then:

```sh
npm ci
npm run dev
npm run verify
```

Open http://localhost:3000. All pages are marked as placeholders; API placeholders return 501. No environment file or credentials are needed for the scaffold. Admin pages are unprotected empty placeholders and are not ready for deployment.

`verify` runs lint, typecheck, production build, Markdown links, secret patterns, canonical enum definitions, eleven Mermaid renders and Chromium route checks. The route check starts its own local production server on port 3217. Mermaid installs its required Chromium browser into the ignored `.cache/puppeteer` directory; validation artifacts go into `.validation`.

Use `npm run format` / `npm run format:check` for formatting. Source-of-truth contracts: [progress](docs/PROGRESS.md), [architecture](docs/architecture/ARCHITECTURE-DECISIONS.md), [routes](docs/storefront/ROUTES.md), [module boundaries](docs/architecture/MODULE-BOUNDARIES.md). Earlier Stage 2 reports describe historical state; progress records the current gate.

Client design/configuration belongs in `src/client`. Transactional invariants stay in the base template; see [reuse strategy](docs/development/TEMPLATE-REUSE.md). Seed-settings, admin bootstrap and client initialization commands remain future work.

Stage 4 requires separate authorization. Its first work is Vitest plus the pure pricing engine and state-machine functions, with documentation updated alongside code.
