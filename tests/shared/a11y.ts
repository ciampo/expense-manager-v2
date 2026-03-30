import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

export async function runAxeAudit(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
}
