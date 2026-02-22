# Best Practices

Guidelines and conventions for contributing to the Expense Manager codebase.

---

## UI Components

### Use existing ShadCN UI components instead of raw HTML elements

The project uses [ShadCN UI](https://ui.shadcn.com) components (`src/components/ui/`). Always prefer these over raw HTML elements with manual Tailwind styling.

**Why:** ShadCN components encapsulate consistent styling, accessibility attributes, focus management, and variant logic. Duplicating this with inline classes leads to drift, inconsistencies, and harder maintenance.

| Instead of | Use |
|---|---|
| `<button className="inline-flex items-center ...">` | `<Button>` |
| `<input className="...">` | `<Input>` |
| Raw `<dialog>` or portal `<div>` | `<Dialog>` / `<Sheet>` |

**Example — button:**

```tsx
// Avoid: manual styling that duplicates what Button already provides
<button
  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
>
  Save
</button>

// Prefer: Button component with variant props
<Button>Save</Button>
<Button variant="outline">Cancel</Button>
<Button variant="destructive">Delete</Button>
```

### Composing Button with TanStack Router Link

Use the `render` prop (from Base UI) to make a `Button` render as a TanStack Router `Link` while keeping all button styling and variants:

```tsx
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

<Button render={<Link to="/dashboard" />}>Go to Dashboard</Button>
<Button variant="outline" render={<Link to="/" />}>Go back home</Button>
```

This keeps routing behavior (client-side navigation, prefetch, active state) while applying consistent button styling. Avoid manually styling `<Link>` elements to look like buttons.

### Tailwind class ordering

Follow the convention of alphabetical ordering within each "group" of utility classes (layout, spacing, typography, color, state variants). When constraining width, pair `max-w-*` with `mx-auto` to center the element within its parent.

---

## TypeScript

### Use framework-provided types

Prefer importing types from frameworks rather than redefining them inline.

```tsx
// Avoid: inline type that may drift from the framework's actual contract
function ErrorComponent({ error, reset }: { error: Error; reset: () => void })

// Prefer: the canonical type exported by TanStack Router
import type { ErrorComponentProps } from '@tanstack/react-router'

function ErrorComponent({ error, reset }: ErrorComponentProps)
```

---

## Accessibility

### Landmark and focus management

- Full-page status screens (error, 404, etc.) should use a `<main>` landmark with `id="main-content"` and `tabIndex={-1}` so the skip-to-content link in the root layout works correctly.
- Interactive elements must have visible focus indicators. The `Button` component handles this automatically; avoid overriding its focus styles.
- Use semantic HTML (`<h1>`, `<nav>`, `<main>`) before reaching for ARIA attributes.
