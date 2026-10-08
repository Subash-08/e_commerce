# Antigravity storefront handoff

Run these prompts sequentially and return each report for Codex review before starting the next:

1. [Storefront shell](01-storefront-shell.md)
2. [Existing catalog UI polish](02-existing-catalog-ui-polish.md)
3. [Manual storefront review](03-storefront-manual-review.md)

Before every task, record `git rev-parse HEAD` and `git status --short`. Do not begin with an unexplained dirty tree. Commit only files authorized by that prompt.

Demo catalog commands:

```text
npm run seed:demo:check
npm run seed:demo -- --approve
```

The seeder uses only the configured Atlas database, refuses production, never drops collections and performs no broad cleanup. It creates or resets records marked `demo-catalog-v1`; the five demo products are `noindex`.

The next complex Codex-owned feature after these presentation tasks is catalog discovery: real product grids, indexed filters, search, sorting and pagination.
