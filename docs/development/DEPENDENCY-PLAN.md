# Dependency plan and installation gates

Stage 2 proposed the groups below; Stage 3, 4A and the 4B checkpoint have since installed their approved subsets. package.json and package-lock.json now exist. See [progress](../PROGRESS.md) for observed versions and verification status. Historical proposed groups are not blanket permission to install later dependencies.

## Proposed package groups

| Dependency | Responsibility / necessary now? | Alternative / decision |
| --- | --- | --- |
| next, react, react-dom | Stage 3 route/layout runtime | Stable compatible versions, no canary starter pins |
| typescript, @types/node/react/react-dom | Stage 3 type/build checks | Required type tooling |
| tailwindcss, @tailwindcss/postcss, postcss | Stage 3 styling baseline | Follow selected compatible Tailwind setup |
| eslint, eslint-config-next | Stage 3 lint | Explicit ESLint command; do not assume next lint |
| prettier | Stage 3 consistent formatting/docs | Single formatter; minimal config |
| zod | Stage 3 env/public configuration validation | Handwritten validators rejected for growing contracts |
| server-only | Stage 3 server import boundary | Native boundary marker; verify package behavior |
| mongoose, mongodb | Later foundation implementation | Shared native driver identity/pool; no DB runtime in docs scaffold |
| better-auth + official Mongo adapter | Conditional, before auth implementation | Reopen ADR 0003 if compatibility fails; Auth.js credentials is not a drop-in password/recovery replacement (see auth report) |
| react-hook-form + @hookform/resolvers | Product/checkout forms later | No form library needed for heading placeholders |
| shadcn generated components + only used primitives | Later approved UI requirements | Not bulk component installation; inspect CLI/source and pin execution |
| cloudinary, next-cloudinary | Media module later | Server management SDK vs presentation helper; install only needed parts |
| Razorpay SDK | Payment module later | Official REST via typed adapter is alternative; one approach |
| resend OR nodemailer | Recovery/transactional email later | Pick one transport; no parallel unused SDKs |
| @react-pdf/renderer | Invoice module later | pdf-lib/pdfmake alternatives; no Chromium runtime |
| csv-parse | CSV module later | Streaming parser over ad-hoc split; verify limits |
| vitest | First business-code phase, pure/integration tests | No mirrored tests for placeholder pages |
| @playwright/test | Purchase/editor E2E phase | Test browser dependency isolated from application |
| @mermaid-js/mermaid-cli | Documentation validation in Stage 3 if approved | Not installed in Stage 2; required full diagram render gate |
| @sentry/nextjs | Monitoring phase | Structured logger initially; telemetry configured per client |

Built-in Intl.DateTimeFormat/NumberFormat covers display initially; no date library without demonstrated need. No global store/query library, Redis client, generic job framework, CMS, search cluster or secondary backend.

## Exact-version procedure before any installation

1. Check official release/registry latest stable, supported Node/Next/React and peer ranges; inspect package source/provenance/license and scripts. Record exact selections and rationale here.
2. Review vendor advisories + dependency audit. Better Auth has recent [published advisories](https://github.com/better-auth/better-auth/security/advisories); re-evaluate patched versions against enabled plugins. Do not infer safety from version numbering alone.
3. Prefer Node 24 supported LTS if every selected dependency and deployment target supports it; else supported Node 22 LTS. Local observed Node 20 is not the production target.
4. Pin Node/npm and direct dependencies; use one package-lock and npm ci. Do not use overrides to hide incompatible Mongo driver instances.
5. Auth-specific: validate official Mongo transaction mode, session revocation/hook/API support, password reset and Next integration from current source before installing. Runtime tests happen only when auth implementation is authorized. Reopen C if unsupported; do not force a weak substitute.
6. Run actual install/lint/typecheck/build; record versions, advisories, outputs and deferred integration checks. No library merely for an empty module README.

Installing scaffold packages does not authorize real credentials, hosted purchases or feature implementation.
