# Contributing

Read [AGENTS.md](AGENTS.md) and [progress](docs/PROGRESS.md). Keep one change focused on an approved stage/module and branch. Explain the behavior changed, impacted reads/writes/cache tags, security boundary and validation in the PR.

A transaction invariant change requires an ADR in the base template and migration/test implications. Client overrides cannot weaken it. Use [Definition of Done](docs/development/DEFINITION-OF-DONE.md). Never commit secrets or real customer data. Do not modify generated/installed vendor code to hide a compatibility problem.

Stage 2 checks are documentation links, enum consistency, route coverage, diagram syntax and diff review. Stage 3 adds npm scripts and CI. Do not invent passing checks when their runtime is absent. Per-stage commits are local unless remote publication is explicitly requested.
