// Returns a sort key for a recipe title, ignoring a leading "The "
export function sortTitle(title: string): string {
  return title.replace(/^the\s+/i, '').toLowerCase()
}

// Formats an ingredient for display: "2 cups flour", "1 egg", "salt to taste"
export function formatIngredient(
  name: string,
  amount: string,
  unit: string | null
): string {
  if (!amount) return name
  if (!unit) return `${amount} ${name}`
  return `${amount} ${unit} ${name}`
}
