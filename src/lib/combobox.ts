/**
 * Case-insensitive exact match check for combobox items.
 * Trims and lowercases both sides so accidental whitespace doesn't
 * prevent a match (consistent with backend validation which trims names).
 */
export function hasExactMatch(items: string[], query: string): boolean {
  const normalised = query.trim().toLowerCase()
  if (!normalised) return false
  return items.some((item) => item.trim().toLowerCase() === normalised)
}

/**
 * Whether the combobox should show a "create new" / "use custom" action.
 * True when the user has typed something that doesn't match any existing item.
 */
export function shouldShowCreateOption(items: string[], query: string): boolean {
  return !!query.trim() && !hasExactMatch(items, query)
}
