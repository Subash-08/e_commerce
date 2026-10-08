# Antigravity task 01 — storefront shell and navigation

Repository: `D:\AI\e-commerce`

Work only on this task. Do not implement product queries, search suggestions, cart state, wishlist state, checkout, homepage merchandising or admin changes.

## Read first

- `AGENTS.md`
- `docs/PROGRESS.md`
- `docs/adr/0007-rendering-content-and-documents.md`
- `docs/storefront/ROUTES.md`
- `src/app/(store)/layout.tsx`
- current store styles and shared UI components

The websites `https://itechcomputers.shop/` and `https://aval-b2b.netlify.app/` are visual references only. Do not copy code, content, brand identity or domain-specific PC-builder behavior. Preserve the reusable-template design.

## Goal

Replace the basic storefront chrome with a polished, responsive shell around existing pages. It should look intentionally designed, compact and trustworthy rather than like a generated landing-page template.

## Implement

1. Add a reusable storefront header containing:
   - a text/logo area that can later be configured;
   - desktop navigation links to Products and existing customer-support routes;
   - a real GET search form targeting `/search` with query parameter `q`;
   - account, wishlist and cart links;
   - no fake item counts and no fake logged-in user;
   - an accessible mobile menu with a minimum 40 px touch target and correct expanded state.
2. Add a reusable footer containing grouped navigation to existing routes, policy links and neutral reusable-template text. Do not invent company addresses, phone numbers, certifications, social profiles or payment claims.
3. Establish storefront-only design tokens for typography, colour, spacing, borders, radius and shadow. Do not alter the existing admin theme.
4. Use a professional system/local font stack already available in the project. Do not add a package or remote font request.
5. Ensure the shell works from 360 px through wide desktop, with no horizontal page overflow.
6. Preserve server components by default. Use a small client component only for the mobile menu.
7. Preserve authentication guards, metadata and all existing route behavior.

## UX and accessibility requirements

- One clear header hierarchy; avoid multiple oversized announcement bars.
- Search must be easy to reach on desktop and mobile.
- Current-page indication must not depend only on colour.
- Mobile navigation must close with Escape and after a link is selected; return focus to its trigger.
- Use semantic `header`, `nav`, `main` and `footer` landmarks.
- Do not display controls that pretend unfinished features work. Wishlist/cart links may navigate to their clearly marked existing routes, but show no counts or success behavior.
- Do not redesign existing page bodies in this task.

## Allowed files

- `src/app/(store)/layout.tsx`
- new components under `src/shared/ui/storefront/`
- storefront style files under `src/shared/styles/`
- directly related store loading/error/not-found presentation only if necessary

Do not edit catalog services, repositories, schemas, auth, admin files, database code, environment files or package dependencies.

## Verification

- Run lint and typecheck.
- Run the production build only if both pass.
- Manually inspect `/`, `/products`, `/category/demo-laptops`, `/brand/demo-northstar`, `/product/demo-northstar-air-14`, `/login`, `/account`, `/cart` and `/wishlist` at approximately 360, 768 and 1440 px.
- Check keyboard navigation, Escape behavior, focus return and visible focus.
- Check that admin pages retain their current styling.
- Do not add snapshot tests or low-value rendering tests.

## Git and completion report

1. Before editing, record `git rev-parse HEAD` and `git status --short`. Stop if the tree is dirty with unexplained files.
2. Commit only this task with a clear commit message.
3. Stop after this task. Do not start catalog listing, task 02, cart or checkout.
4. Report:
   - starting and ending commit IDs;
   - every changed file from `git diff --name-status <starting-commit>..HEAD`;
   - behavior implemented;
   - routes manually checked and viewport sizes;
   - commands run with pass/fail result;
   - browser console errors;
   - remaining limitations;
   - desktop/mobile screenshots if the environment supports them.
