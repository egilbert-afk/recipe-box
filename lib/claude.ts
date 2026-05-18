import Anthropic from '@anthropic-ai/sdk'
import type { CuisineId, MealTypeId, CreateRecipeInput } from '@/lib/types'

const client = new Anthropic()

// Shape Claude must return — validated before we trust it
interface ParsedRecipe {
  title: string
  cuisine_id: CuisineId
  meal_type_id: MealTypeId
  servings: number
  ingredients: Array<{
    name: string
    amount: number | null
    unit: string | null
    order_index: number
  }>
  steps: Array<{
    instruction: string
    order_index: number
  }>
}

const SYSTEM_PROMPT = `You are a recipe parser. Extract recipe data from the provided HTML and return ONLY a JSON object with no markdown, no explanation, no code fences.

The JSON must have exactly these fields:
{
  "title": string,
  "cuisine_id": one of: "american" | "italian" | "mexican" | "mediterranean" | "asian" | "french" | "indian" | "other",
  "meal_type_id": one of: "breakfast" | "entree" | "side" | "dessert" | "cocktail",
  "servings": number (integer, pick the larger if a range),
  "ingredients": [
    {
      "name": string (ingredient name only, no amounts),
      "amount": number or null (null if no quantity, e.g. "salt to taste"),
      "unit": string or null (null if measured by count, e.g. "2 eggs"),
      "order_index": number (0-based)
    }
  ],
  "steps": [
    {
      "instruction": string (one clear step),
      "order_index": number (0-based)
    }
  ]
}

Rules:
- Each ingredient must be its own object — never combine multiple ingredients into one
- Each step must be its own object — never combine multiple steps into one
- Strip all prose, backstory, tips, and commentary — only the recipe
- If you cannot determine cuisine, use "other"
- If you cannot determine meal type, use "entree"`

// Fetches a URL and returns the page HTML, server-side to avoid CORS issues
export async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // Identify as a browser to avoid bot-blocking by recipe sites
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`)
  }

  return res.text()
}

// Strips HTML tags and collapses whitespace to reduce token count before
// sending to Claude. Recipe sites have a lot of nav, ads, and boilerplate
// that we don't need Claude to read.
export function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20000) // Cap at 20k chars — enough for any recipe
}

function isValidParsedRecipe(data: unknown): data is ParsedRecipe {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  if (typeof d.title !== 'string' || !d.title.trim()) return false
  if (typeof d.cuisine_id !== 'string') return false
  if (typeof d.meal_type_id !== 'string') return false
  if (typeof d.servings !== 'number' || d.servings < 1) return false
  if (!Array.isArray(d.ingredients) || d.ingredients.length === 0) return false
  if (!Array.isArray(d.steps) || d.steps.length === 0) return false

  for (const ing of d.ingredients) {
    if (typeof ing.name !== 'string' || !ing.name.trim()) return false
    if (ing.amount !== null && typeof ing.amount !== 'number') return false
    if (ing.unit !== null && typeof ing.unit !== 'string') return false
  }

  for (const step of d.steps) {
    if (typeof step.instruction !== 'string' || !step.instruction.trim()) return false
  }

  return true
}

export async function parseRecipeFromUrl(url: string): Promise<CreateRecipeInput> {
  const html = await fetchUrl(url)
  const text = stripHtml(html)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Parse this recipe page into JSON:\n\n${text}`,
      },
    ],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip markdown fences if Claude included them despite instructions
  const cleaned = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Claude returned malformed JSON — cannot parse recipe')
  }

  if (!isValidParsedRecipe(parsed)) {
    throw new Error('Claude returned incomplete recipe data — please try manual entry')
  }

  return {
    title: parsed.title,
    cuisine_id: parsed.cuisine_id,
    meal_type_id: parsed.meal_type_id,
    servings: parsed.servings,
    source_url: url,
    ingredients: parsed.ingredients,
    steps: parsed.steps,
  }
}
