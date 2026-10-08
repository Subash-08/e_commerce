# Antigravity task 02 — polish existing public catalog pages

Run only after task 01 has been reviewed and accepted. Repository: `D:\AI\e-commerce`.

This is presentation work over existing data. Do not add catalog list queries, filters, cart actions, checkout actions, provider calls, schemas or indexes.

## Read first

- `AGENTS.md`
- `docs/PROGRESS.md`
- `docs/adr/0010-catalog-pricing-and-public-variants.md`
- the accepted task-01 storefront components and styles
- current category, brand and product public routes/components

## Goal

Make `/category/[slug]`, `/brand/[slug]` and `/product/[slug]` visually consistent with the storefront shell while preserving every backend, SEO, accessibility and variant-selection rule.

## Implement

1. Category page: compact hero with breadcrumb, title, description and optional image; clear child-category cards. Do not create a fake product grid because catalog listing queries are not implemented yet.
2. Brand page: clean logo/title/description presentation with no fake products.
3. Product detail page:
   - improve information hierarchy, spacing and mobile layout;
   - preserve the shared image/video gallery, hover image, manufacturer content and external-image fallback;
   - preserve `?variant=<immutable ID>`, browser history and invalid-variant fallback notice;
   - keep sold-out variants selectable and visibly unavailable;
   - keep product-level canonical and Open Graph behavior unchanged;
   - preserve the visible statement that ordering is unavailable until checkout exists;
   - do not add a fake Add to cart button.
4. Add polished loading/empty/error presentation only where the state already exists.
5. Keep cost, notes, stock counts, provider IDs and unpublished content private.

## Allowed files

- public category/brand/product route presentation files;
- `src/modules/catalog/detail.tsx` and `gallery.tsx` presentation only;
- storefront style files;
- small presentational components under `src/shared/ui/storefront/`.

Do not edit public projections, catalog validation, services, repositories, admin editor, auth, database code or environment files. If desired UI needs new server data, stop and list it as a Codex follow-up.

## Verification

- Use `/category/demo-laptops`, `/brand/demo-northstar`, `/product/demo-northstar-air-14`, the second notebook variant ID `675000000000000000000002`, and the sold-out Forge variant ID `675000000000000000000004`.
- Check default/non-default variant links, invalid variant fallback and browser Back/Forward.
- Check image/video thumbnails, external image failure behavior and manufacturer-content layout.
- Inspect at 360, 768 and 1440 px; confirm no horizontal overflow.
- Run lint, typecheck and build. Do not add tests unless existing behavior breaks.

## Git and completion report

Record the starting commit and clean status before editing. Commit only this task. Stop after it and report starting/ending commits, exact changed files, screenshots if available, routes/states/viewports checked, commands run, console errors and anything that needs backend changes. Do not start catalog discovery or cart work.
