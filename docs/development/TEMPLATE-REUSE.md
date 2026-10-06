# Client reuse and configuration

Base template is version-tagged. Client repositories use it as an upstream and apply reviewed fixes/migrations, never blindly pull and deploy. No repository is pushed/tagged by this stage.

| Location | Owns | Examples | Must not contain |
| --- | --- | --- | --- |
| env | Secrets/infrastructure/deployment identity | DB/provider credentials, origins, scheduler secret | Editable COD/tax/shipping business values |
| DB settings | Mutable typed business policy | COD, flat/free shipping, GST policy refs, invoice series, support contacts | API secrets or arbitrary executable code |
| src/config | Validated defaults/contracts | Currency/country capability, SEO defaults, navigation fallback | Per-client conditions scattered in services |
| src/client | Static branding/design and supported policy selection | Logo/theme/home presentation, approved shipping adapter | Pricing/stock/state-machine/numbering invariant replacement |

Precedence: validated client static defaults initialize settings; explicit persisted setting wins for mutable business data. Secrets never flow into public config DTO. A versioned settings snapshot enters each quote/order where relevant; editing settings affects new orders only.

Business settings can enable optional modules; guest checkout remains first-class and enabled for base V1. Work/COD/newsletter default off. Feature flags are capabilities/config checks, not a complex flag platform. Media namespaces and credentials isolate each client/environment; choose separate accounts for stronger operational boundaries when practical.

Future init-client script is planned, not implemented: validate capability/config/env names without printing values -> connect intended non-production target -> idempotently seed store settings -> explicitly bootstrap admin through auth service -> report readiness. No example products in production. No default passwords, production reset or automatic purchases.

Client onboarding needs brand/assets/contact/legal seller/tax/invoice/returns policy, managed DB/media/payment/email configuration, private artifacts, scheduler, backups/alerts and staging sign-off. These facts cannot be guessed from .env.

Any change to transactional invariants requires an ADR and implementation/test/migration in the base template. Client forks may add fields/services through compatible contracts but cannot bypass shared correctness. Extensions such as courier, special product builders or international taxes get scoped ADRs before work.

Template upgrade: diff approved release -> migration/advisory review -> staging restore/upgrade + commerce replay tests -> deploy compatible readers/writers -> monitor -> rollback or forward repair. Preserve client secrets and immutable ledgers.
