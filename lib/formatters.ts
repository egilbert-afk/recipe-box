// Capitalizes the first letter of a string
export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
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
