/**
 * Case-insensitive exact match check for combobox items.
 * Returns true when `query` matches any item in the list, ignoring case.
 */
export function hasExactMatch(items: string[], query: string): boolean {
  const normalised = query.toLowerCase()
  return items.some((item) => item.toLowerCase() === normalised)
}

/**
 * Whether the combobox should show a "create new" / "use custom" action.
 * True when the user has typed something that doesn't match any existing item.
 */
export function shouldShowCreateOption(items: string[], query: string): boolean {
  return !!query.trim() && !hasExactMatch(items, query)
}
