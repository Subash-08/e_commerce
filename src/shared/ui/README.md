# Reusable UI foundations

Explicitly authorized by the user after the database checkpoint. Presentation only; no auth, commerce behavior or homepage design. No added packages.

Import Button, Badge, Alert, Card, EmptyState and Skeleton from ./primitives. Import InputField, TextareaField, SelectField and Checkbox from ./fields. Fields form a client boundary for stable generated IDs; presentation primitives can render on the server. Native input props and React 19 ref props are forwarded.

```tsx
import { Button, Card } from "@/shared/ui/primitives";
import { InputField } from "@/shared/ui/fields";

<Card>
  <InputField
    name="email"
    type="email"
    label="Email"
    autoComplete="email"
    hint="Used for order updates."
    required
  />
  <Button type="submit">Continue</Button>
</Card>;
```

Use a real form with server validation when integrating. Button defaults to type button; explicitly choose submit. Set loading and a meaningful loadingLabel while pending; loading disables duplicate clicks but does not replace server idempotency. Use links for navigation, not buttons.

Field errors and hints are linked through aria-describedby. Existing descriptions are preserved. Use explicit unique IDs when other controls reference fields. Provide an error summary/focus management at the form level; inline errors do not all announce independently. Native required, disabled and input attributes remain available.

Alert is static by default; announce enables status or alert semantics for dynamic feedback. Badge tone never supplies meaning alone: include readable status text. Skeleton is decorative: the containing region should provide one readable loading status. EmptyState accepts an action element; Card deliberately imposes no heading level.

Scoped CSS includes 44px control targets, visible focus and reduced-motion support. Override --ui-accent, --ui-accent-hover and --ui-focus in approved client branding; check contrast after changes. These neutral defaults are not homepage design approval. No dialogs, menus or complex focus management are implemented in this first set.

Focused tests cover server-rendered accessibility attributes. Browser interaction and visual review remain integration work before adopting the components in real routes.

Validation on 2026-10-06: five focused UI tests, scoped ESLint, tsc --noEmit, production build and documentation link check (70 files) passed. No browser visual/interaction check was performed.
