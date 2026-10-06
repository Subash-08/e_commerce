# Reusable e-commerce base

A reusable single-tenant Next.js + MongoDB commerce foundation for India/INR physical goods. One deployment and database per client. This repository currently contains **documentation only**.

Stage 1 was approved with amendments on 2026-10-06. Stage 2 specifies the system; Stage 3 scaffolding needs separate approval. No application, dependencies, credentials, schemas or commerce code have been installed/implemented.

Start with [documentation index](docs/README.md), [progress](docs/PROGRESS.md) and [approved architecture](docs/architecture/ARCHITECTURE-DECISIONS.md). Review pricing, lifecycles, collections, change impact and routes before approving scaffolding.

## Intended stack

Next.js App Router, TypeScript, Tailwind/shadcn, MongoDB/Mongoose, conditional Better Auth, Cloudinary, Razorpay. npm; supported Node LTS selected at installation. VPS and Vercel are both deployment targets. Exact versions are not pinned yet.

There are deliberately no npm run instructions yet. Stage 3 will add verified setup commands and a lockfile; see [scaffold contract](docs/development/STAGE-3-SCAFFOLD.md). Business implementation starts only after the foundation is separately accepted.

## Reuse

Client design/configuration belongs in a narrow client layer. Transactional invariants stay in the base template and require ADRs to change. See [reuse strategy](docs/development/TEMPLATE-REUSE.md).
