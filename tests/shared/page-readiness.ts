import type { Page } from '@playwright/test'

/**
 * Wait for React hydration to complete.
 *
 * TanStack Start renders pages via SSR, but React event handlers aren't
 * attached until hydration finishes. The root component (`__root.tsx`)
 * sets `data-hydrated="true"` on `<body>` inside a `useEffect`, which
 * fires only after React has mounted — a stable, framework-agnostic
 * signal that doesn't depend on React internals.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10_000 })
}
