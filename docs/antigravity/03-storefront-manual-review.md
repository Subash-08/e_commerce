# Antigravity task 03 — manual storefront review and repair

Run only after tasks 01 and 02 have been reviewed and accepted. This is bounded manual QA plus small presentation repairs.

## Scope

Review the storefront shell and existing category, brand and product-detail pages with the seeded catalog. Fix only responsive, keyboard, accessibility and visual defects found during the review. Do not add features or alter backend behavior.

## Required matrix

- Widths: 360, 768 and 1440 px.
- Routes: `/`, `/products`, `/category/demo-laptops`, `/brand/demo-northstar`, `/product/demo-northstar-air-14`, `/product/demo-northstar-air-14?variant=675000000000000000000002`, `/login`, `/account`, `/cart`, `/wishlist`.
- States: normal, keyboard-only, mobile menu open/closed, invalid product variant query and sold-out Forge variant.

## Check

- landmarks, heading order, labels and descriptive control names;
- focus visibility, Escape handling and focus return;
- minimum 40 px touch targets;
- no horizontal overflow or clipped sticky elements;
- readable contrast and text size;
- no fake counts, reviews, delivery promises, ratings or cart behavior;
- no browser console errors or hydration warnings;
- product metadata and structured data remain present;
- admin layout remains unchanged.

Do not install accessibility/browser-test packages or create a large test suite. If a fix requires backend data or architectural changes, report it instead of implementing it.

## Completion report

Provide starting/ending commits, `git diff --name-status`, every defect found and its resolution, routes/viewports checked, command results, screenshots if supported and unresolved findings. Stop after the report.
