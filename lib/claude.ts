import Anthropic from '@anthropic-ai/sdk'
import type { CuisineId, MealTypeId, CreateRecipeInput } from '@/lib/types'
import { formatAmount } from '@/lib/scaler'
import { formatIngredient } from '@/lib/formatters'

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
  implied_prep_steps?: string[]
}

export type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

const SYSTEM_PROMPT = `You are a recipe parser. Extract recipe data from the provided content and return ONLY a JSON object with no markdown, no explanation, no code fences.

The JSON must have exactly these fields:
{
  "title": string,
  "cuisine_id": one of: "american" | "italian" | "mexican" | "mediterranean" | "asian" | "french" | "indian" | "other",
  "meal_type_id": one of: "breakfast" | "entree" | "side" | "salad" | "dessert" | "cocktail",
  "servings": number (integer, pick the larger if a range),
  "ingredients": [
    {
      "name": string (ingredient name plus any preparation notes, e.g. "onion, finely diced" or "butter, softened" — exclude amounts and units which go in the fields below),
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
  ],
  "implied_prep_steps": [
    string (a concise, imperative prep instruction inferred from an ingredient's preparation modifier — only include if that prep work is NOT already covered anywhere in the steps; e.g. if an ingredient is "2 cloves garlic, minced" and no step mentions mincing the garlic, add "Mince the garlic." — return [] if all prep is already described in the steps or no ingredients require active preparation)
  ]
}

Rules:
- Each ingredient must be its own object — never combine multiple ingredients into one
- Each step must be its own object — never combine multiple steps into one
- Strip all prose, backstory, tips, and commentary — only the recipe
- If you cannot determine cuisine, use "other"
- If you cannot determine meal type, use "entree"
- implied_prep_steps must always be present, even if empty ([])
- Only add an implied prep step when the prep modifier on an ingredient (minced, diced, chopped, sliced, grated, peeled, crushed, crumbled, shredded, zested, julienned, thinly sliced, finely chopped, roughly chopped) is genuinely absent from the steps — do not duplicate prep that is already described
- Keep each implied prep step concise and imperative: "Dice the onion." not "You will need to dice the onion first."
- You may group closely related quick tasks into one step: "Mince the garlic and finely chop the parsley." is better than two separate steps
- Implied prep steps will be prepended before the recipe steps, so write them as if they come first`

// Fetches a URL and returns the page HTML, server-side to avoid CORS issues
export async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (res.status === 403) {
    throw new Error('This site blocked the request — paste the recipe URL directly into your browser, copy the text, and use manual entry instead.')
  }

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

// Translates Anthropic API errors to messages safe to surface to the user.
export function friendlyClaudeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : ''
  if (raw.includes('credit balance') || raw.includes('billing')) {
    return 'Recipe import is temporarily unavailable. Please try again later or add the recipe manually.'
  }
  if (raw.includes('overloaded') || raw.includes('529')) {
    return 'The AI service is busy right now. Please try again in a moment.'
  }
  return raw || 'Failed to read recipe'
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

  // implied_prep_steps is optional — if present must be an array of strings
  if (d.implied_prep_steps !== undefined) {
    if (!Array.isArray(d.implied_prep_steps)) return false
    for (const s of d.implied_prep_steps) {
      if (typeof s !== 'string') return false
    }
  }

  return true
}

// Strips markdown fences Claude occasionally adds despite instructions, then JSON-parses.
// Using \w+ instead of json so ```javascript and similar variants are also handled.
function stripFencesAndParse(rawText: string): unknown {
  const cleaned = rawText.replace(/^```(?:\w+)?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(cleaned)
}

// Exported so it can be unit tested without mocking the Anthropic client.
// Takes the raw text Claude returned, validates it, and combines implied prep
// steps with the recipe steps (implied steps come first, re-indexed).
export function parseRawRecipeJson(rawText: string): CreateRecipeInput {

  let parsed: unknown
  try {
    parsed = stripFencesAndParse(rawText)
  } catch {
    throw new Error('Claude returned malformed JSON — cannot parse recipe')
  }

  if (!isValidParsedRecipe(parsed)) {
    throw new Error('Claude returned incomplete recipe data — please try manual entry')
  }

  // Collect non-empty implied prep steps
  const impliedInstructions: string[] = Array.isArray(parsed.implied_prep_steps)
    ? parsed.implied_prep_steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []

  // Prepend implied steps, then re-index the recipe steps to follow
  const allSteps = [
    ...impliedInstructions.map((instruction, i) => ({ instruction, order_index: i })),
    ...parsed.steps.map((step, i) => ({ instruction: step.instruction, order_index: impliedInstructions.length + i })),
  ]

  return {
    title: parsed.title,
    cuisine_id: parsed.cuisine_id,
    meal_type_id: parsed.meal_type_id,
    servings: parsed.servings,
    ingredients: parsed.ingredients,
    steps: allSteps,
  }
}

function extractRecipeFromMessage(message: Anthropic.Message): CreateRecipeInput {
  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  return parseRawRecipeJson(rawText)
}

export async function parseRecipeFromUrl(url: string): Promise<CreateRecipeInput> {
  const html = await fetchUrl(url)
  const text = stripHtml(html)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Parse this recipe page into JSON:\n\n${text}` }],
  })

  return { ...extractRecipeFromMessage(message), source_url: url }
}

export async function parseRecipeFromText(text: string): Promise<CreateRecipeInput> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Parse this recipe into JSON:\n\n${text}` }],
  })

  return extractRecipeFromMessage(message)
}

export async function generateMicrosteps(
  steps: Array<{ instruction: string; order_index: number }>,
  ingredients: Array<{ name: string; amount: number | null; unit: string | null }>,
  baseServings: number,
  targetServings: number
): Promise<string[]> {
  const scaleFactor = targetServings / baseServings

  const scaledIngredientList = ingredients.map((ing) => {
    if (ing.amount === null) return `${ing.name} (to taste)`
    const formatted = formatAmount(ing.amount, baseServings, targetServings)
    return formatIngredient(ing.name, formatted, ing.unit)
  }).join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Break these recipe steps into atomic microsteps for hands-free voice cooking. Each microstep is one physical action that takes 5–30 seconds.

Scale factor: ${scaleFactor} (base servings: ${baseServings}, target: ${targetServings})

Scaled ingredients (at ${targetServings} servings):
${scaledIngredientList}

Rules:
- One action per microstep — never combine two actions into one sentence
- Always include the scaled amount from the ingredient list when adding an ingredient ("Add 2 tablespoons of butter", not "Add butter")
- If a step references an ingredient without an amount, look it up in the ingredient list above
- When a step references a group of ingredients ("sauce ingredients", "dry ingredients", "marinade", etc.), infer from context which specific ingredients belong to that group and emit one microstep per ingredient with its scaled amount — never pass the group reference through unchanged
- For ingredients marked "(to taste)", use your judgment — do not invent a quantity
- Before decomposing, scan all steps to identify ingredients with preparation modifiers (diced, minced, chopped, sliced, grated, drained, peeled, etc.) that are not already covered by an explicit step. Insert the prep microstep immediately before the first heat or cooking action that depends on it — not at the very start of the recipe, and not after the pan is already hot
- Use natural spoken language — these will be read aloud
- One sentence per microstep
- Do not split steps that describe a continuous process (e.g. "stir constantly for 3 minutes" stays as one step)
- Return ONLY a JSON array of strings with no markdown, no explanation, no code fences

Steps to decompose:
${steps.map((s, i) => `${i + 1}. ${s.instruction}`).join('\n')}`,
    }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

  let parsed: unknown
  try {
    parsed = stripFencesAndParse(rawText)
  } catch {
    throw new Error('Claude returned malformed JSON for microsteps')
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((s) => typeof s === 'string')) {
    throw new Error('Claude returned invalid microstep format')
  }

  return parsed as string[]
}

export async function parseRecipeFromImage(
  images: Array<{ data: string; mimeType: SupportedImageMimeType }>
): Promise<CreateRecipeInput> {
  if (images.length === 0) throw new Error('At least one image is required')
  if (images.length > 10) throw new Error('Too many images — maximum 10 per request')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mimeType, data: img.data },
          })),
          { type: 'text' as const, text: 'Parse this recipe into JSON:' },
        ],
      },
    ],
  })

  return extractRecipeFromMessage(message)
}
