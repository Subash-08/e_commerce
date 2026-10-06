# orders

Future immutable order snapshots and transitions. Stage 3 contains no implementation.

May depend on approved contracts and its own layers; routes compose modules, services own rules and repositories own persistence. Must not bypass service authorization or own another module's data. Follow the [module dependency rules](../../../docs/architecture/MODULE-BOUNDARIES.md) and [canonical states](../../../docs/commerce/STATE-MACHINES.md). Implementation requires separate Stage 4 authorization.
