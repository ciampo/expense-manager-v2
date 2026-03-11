# Best Practices

Guidelines and conventions for contributing to the Expense Manager codebase.

---

## UI Components

### Use existing ShadCN UI components instead of raw HTML elements

The project uses [ShadCN UI](https://ui.shadcn.com) components (`src/components/ui/`). Always prefer these over raw HTML elements with manual Tailwind styling.

**Why:** ShadCN components encapsulate consistent styling, accessibility attributes, focus management, and variant logic. Duplicating this with inline classes leads to drift, inconsistencies, and harder maintenance.

| Instead of                                          | Use                    |
| --------------------------------------------------- | ---------------------- |
| `<button className="inline-flex items-center ...">` | `<Button>`             |
| `<input className="...">`                           | `<Input>`              |
| Raw `<dialog>` or portal `<div>`                    | `<Dialog>` / `<Sheet>` |

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

### Explicit ref forwarding in wrapper components

UI wrapper components that render a single DOM element or primitive should **explicitly destructure and pass `ref`** rather than relying on implicit `{...props}` spread. This makes the ref contract visible at a glance and prevents subtle bugs when the component is refactored.

```tsx
// Prefer: ref is explicit — intent is clear, reviewable, testable
function Input({ className, type, ref, ...props }: React.ComponentProps<'input'>) {
  return <InputPrimitive ref={ref} type={type} className={cn(...)} {...props} />
}

// Avoid: ref is hidden in ...props — easy to accidentally break
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <InputPrimitive type={type} className={cn(...)} {...props} />
}
```

When a component needs a local ref (e.g., for internal focus management), always attach it to the rendered element. A common bug is creating a `useRef` but forgetting to pass it to the JSX:

```tsx
// Bug: localRef is never attached — localRef.current is always null
function CalendarDayButton({ modifiers, ...props }) {
  const localRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (modifiers.focused) localRef.current?.focus()
  }, [modifiers.focused])
  return <Button {...props} /> // ref not passed!
}

// Fix: pass the local ref explicitly
function CalendarDayButton({ modifiers, ...props }) {
  const localRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (modifiers.focused) localRef.current?.focus()
  }, [modifiers.focused])
  return <Button ref={localRef} {...props} />
}
```

When a component needs both a local ref and a typed incoming ref, merge them via a callback ref:

```tsx
function MyInput({ ref: forwardedRef, ...props }: React.ComponentProps<'input'>) {
  const localRef = useRef<HTMLInputElement>(null)
  return (
    <input
      ref={(node: HTMLInputElement | null) => {
        localRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef && 'current' in forwardedRef) {
          ;(forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node
        }
      }}
      {...props}
    />
  )
}
```

The `ref-forwarding.test.tsx` test suite verifies that `Input`, `Textarea`, and `Button` correctly forward refs to their underlying DOM elements.

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

## Validation & Shared Constants

### Use shared constants for validation limits

Validation limits (max lengths, file sizes) are defined once in the Convex backend and shared across client forms, server mutations, UI display text, and tests.

| Constant                   | Source                | Value  |
| -------------------------- | --------------------- | ------ |
| `MAX_FILE_SIZE`            | `convex/uploadLimits` | 10 MB  |
| `ALLOWED_CONTENT_TYPES`    | `convex/uploadLimits` | MIME[] |
| `MERCHANT_MAX_LENGTH`      | `convex/zodSchemas`   | 200    |
| `COMMENT_MAX_LENGTH`       | `convex/zodSchemas`   | 1000   |
| `CATEGORY_NAME_MAX_LENGTH` | `convex/zodSchemas`   | 100    |

**Why:** Hardcoding values like `"10MB"` or `.max(100)` in multiple places causes silent drift when limits change. A single constant ensures consistency across validation schemas, UI helper text, toast messages, error messages, tests, and documentation.

**Client code** imports via `@/lib/schemas` (re-exported from `convex/zodSchemas`) or `convex/uploadLimits`. **Tests** import directly from `convex/zodSchemas` / `convex/uploadLimits`.

```tsx
// Avoid: hardcoded magic numbers
toast.error('File too large. Maximum 10MB.')
z.string().max(1000, { message: 'Comment must be 1000 characters or less.' })

// Prefer: derived from shared constants
toast.error(`File too large. Maximum ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`)
z.string().max(COMMENT_MAX_LENGTH, {
  message: `Comment must be ${COMMENT_MAX_LENGTH} characters or less.`,
})
```

### Keep documentation in sync with constants

The `docs-validation.test.ts` suite verifies that README references to file-size limits and validation limits stay in sync with the source-of-truth constants. When changing a limit, the test will fail if documentation is not updated.

---

## Forms & Loading States

### Disable all interactive elements during form submission

When a form is submitting (or performing mutations), disable:

1. **All form fields** — via `disabled={form.state.isSubmitting}` or a combined `isLoading` flag
2. **The submit button** — same flag
3. **Cancel/navigation buttons** — prevents mid-request navigation that could leave orphaned state
4. **Navigation links** — TanStack Router's `<Link>` supports `disabled` prop; pair with `aria-disabled:pointer-events-none aria-disabled:opacity-50` for visual feedback

```tsx
// Link with disabled state
<Link
  to="/sign-in"
  disabled={form.state.isSubmitting}
  className="text-primary hover:text-primary/80 text-sm underline aria-disabled:pointer-events-none aria-disabled:opacity-50"
>
  Back to sign in
</Link>

// Button with disabled state
<button type="button" onClick={onBack} disabled={form.state.isSubmitting}>
  Use a different email
</button>
```

### Close confirmation dialogs before firing mutations

When an `AlertDialog` action triggers a mutation, close the dialog **before** calling the mutation to prevent accidental double-clicks from firing duplicate requests. The mutation's `isPending` state (reflected via `isLoading`) provides visual feedback that the operation is in progress.

```tsx
// Correct: close-first pattern
<AlertDialogAction
  onClick={() => {
    setShowDialog(false)
    deleteThing.mutate({ id })
  }}
>
  Delete
</AlertDialogAction>

// Wrong: mutation fires while the dialog (and its action button) remain open
<AlertDialogAction
  onClick={() => {
    deleteThing.mutate({ id })
    setShowDialog(false)
  }}
>
  Delete
</AlertDialogAction>
```

This pattern is applied consistently in `expense-form.tsx`, `attachment-field.tsx`, and `dashboard.tsx`.

### Include all mutation `isPending` states in `isLoading`

When a form orchestrates multiple mutations (create, update, delete, upload), combine all their `isPending` flags into a single `isLoading` boolean used for disabling UI.

```tsx
const isLoading =
  form.state.isSubmitting ||
  createExpense.isPending ||
  updateExpense.isPending ||
  deleteExpense.isPending ||
  removeAttachment.isPending ||
  isUploading
```

---

## Accessibility

### Landmark and focus management

- Full-page status screens (error, 404, etc.) should use a `<main>` landmark with `id="main-content"` and `tabIndex={-1}` so the skip-to-content link in the root layout works correctly.
- Interactive elements must have visible focus indicators. The `Button` component handles this automatically; avoid overriding its focus styles.
- Use semantic HTML (`<h1>`, `<nav>`, `<main>`) before reaching for ARIA attributes.

### Labels and conditional inputs

A `<label htmlFor="...">` must always point to an existing input. When a field is conditionally rendered (e.g., a file input hidden after a file is attached), switch to a non-label heading to avoid a dangling `htmlFor`:

```tsx
{
  showInput ? (
    <FieldLabel htmlFor="attachment-input">Attachment (optional)</FieldLabel>
  ) : (
    <FieldTitle>Attachment (optional)</FieldTitle>
  )
}
```
