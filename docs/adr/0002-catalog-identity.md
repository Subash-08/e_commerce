# ADR 0002: Separate sellable variants and typed attributes

Status: APPROVED, 2026-10-06.

Context: unique SKUs, stable cart references, conditional stock and CSV mapping need durable sellable identities.

Decision: products own merchandising; variants own sale price/SKU/availability, with one default variant for simple products. Unique normalized SKU and product/combination indexes. Shared typed attributes/options have immutable IDs; regeneration computes a diff and archives removals. Product editor manages them inline. Listing projections/facets are derived and rebuildable; same-variant filter semantics are mandatory.

Alternatives: embedded arrays simplify a detail read but need additional duplicate-within-document and stock safeguards; a separate SKU registry adds another consistency surface.

Consequences: batch queries/transactional projections add moderate complexity. No warehouse or supplier inventory is introduced. trackQuantity=false has status-only availability and no reservation fields/effects.

Change cost: high after carts/orders/imports depend on IDs. Add fields through versioned readers/backfills; never use label renames as identity changes.
