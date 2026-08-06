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
    throw new Error('This site blocked the request. Try opening the recipe in your browser, copying the text, and pasting it manually.')
  }

  if (res.status === 401 || res.status === 402) {
    throw new Error('This page requires a subscription. Try copying and pasting the recipe text manually.')
  }

  if (!res.ok) {
    throw new Error('Could not read that page. Try copying and pasting the recipe text manually.')
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
  if (raw.includes('malformed JSON') || raw.includes('incomplete recipe data')) {
    return "We couldn't extract the recipe from that link. Try opening it in your browser, copying the recipe text, and pasting it here."
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
    throw new Error('Claude returned malformed JSON: cannot parse recipe')
  }

  if (!isValidParsedRecipe(parsed)) {
    throw new Error('Claude returned incomplete recipe data: please try manual entry')
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

// Prep modifiers that appear after a comma in ingredient names (longest first to match greedily)
const PREP_MODIFIERS: Record<string, string> = {
  'drained and finely diced': 'Drain and finely dice',
  'drained and diced':        'Drain and dice',
  'finely diced':             'Finely dice',
  'finely chopped':           'Finely chop',
  'roughly chopped':          'Roughly chop',
  'thinly sliced':            'Thinly slice',
  'minced':                   'Mince',
  'diced':                    'Dice',
  'chopped':                  'Chop',
  'sliced':                   'Slice',
  'grated':                   'Grate',
  'shredded':                 'Shred',
  'peeled':                   'Peel',
  'drained':                  'Drain',
  'crushed':                  'Crush',
  'zested':                   'Zest',
  'julienned':                'Julienne',
}

const HEAT_KEYWORDS = ['heat', 'preheat', 'warm the', 'bring to a boil', 'bring to boil']

// Parses "onion, finely diced" → { baseName: "onion", verb: "Finely dice" }
function extractPrepModifier(name: string): { baseName: string; verb: string } | null {
  const commaIdx = name.indexOf(',')
  if (commaIdx === -1) return null
  const baseName = name.slice(0, commaIdx).trim()
  const modifierPart = name.slice(commaIdx + 1).trim().toLowerCase()
  for (const [modifier, verb] of Object.entries(PREP_MODIFIERS)) {
    if (modifierPart.includes(modifier)) return { baseName, verb }
  }
  return null
}

// Returns the index of the first step that heats a cooking vessel, or -1
function findFirstHeatStepIndex(steps: Array<{ instruction: string }>): number {
  return steps.findIndex((s) =>
    HEAT_KEYWORDS.some((kw) => s.instruction.toLowerCase().includes(kw))
  )
}

// Inserts deterministic prep steps (from ingredient names) before the first heating step
function insertPrepSteps(
  steps: Array<{ instruction: string; order_index: number }>,
  ingredients: Array<{ name: string; amount: number | null; unit: string | null }>
): Array<{ instruction: string; order_index: number }> {
  const heatIdx = findFirstHeatStepIndex(steps)
  if (heatIdx === -1) return steps

  const existingText = steps.map((s) => s.instruction.toLowerCase()).join(' ')

  const prepInstructions: string[] = []
  for (const ing of ingredients) {
    const prep = extractPrepModifier(ing.name)
    if (!prep) continue
    const lowerBase = prep.baseName.toLowerCase()
    const lowerVerb = prep.verb.toLowerCase()
    // Skip if any existing step already covers this prep.
    // Use word-boundary regex so "minced" in "add the minced garlic" doesn't
    // suppress the "Mince the garlic" prep step — only an imperative match counts.
    const verbRegex = new RegExp(`\\b${lowerVerb}\\b`)
    if (verbRegex.test(existingText) && existingText.includes(lowerBase)) continue
    prepInstructions.push(`${prep.verb} the ${prep.baseName}.`)
  }

  if (prepInstructions.length === 0) return steps

  const prepSteps = prepInstructions.map((instruction, i) => ({
    instruction,
    order_index: -(prepInstructions.length - i),
  }))

  return [
    ...steps.slice(0, heatIdx),
    ...prepSteps,
    ...steps.slice(heatIdx),
  ]
}

export async function generateMicrosteps(
  steps: Array<{ instruction: string; order_index: number }>,
  ingredients: Array<{ name: string; amount: number | null; unit: string | null }>,
  baseServings: number,
  targetServings: number
): Promise<string[]> {
  const scaleFactor = targetServings / baseServings

  const augmentedSteps = insertPrepSteps(steps, ingredients)

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
      content: `You are breaking recipe steps into atomic microsteps for hands-free voice cooking.

Scale factor: ${scaleFactor} (base servings: ${baseServings}, target: ${targetServings})

Scaled ingredients (at ${targetServings} servings):
${scaledIngredientList}

Recipe steps:
${augmentedSteps.map((s, i) => `${i + 1}. ${s.instruction}`).join('\n')}

Output the full ordered microstep sequence in the "steps" field. Each microstep is one physical action (5–30 seconds). Rules:
- One action per microstep — never combine two actions
- Always include the scaled amount when adding an ingredient
- For ingredients marked "(to taste)", do not invent a quantity
- When a step references a group ("sauce ingredients", "dry ingredients"), expand to individual ingredients with amounts
- Use natural spoken language — these will be read aloud
- Do not split continuous processes ("stir constantly for 3 minutes" stays as one step)
- When applying multiple ingredients to the same surface, complete all applications to that surface before flipping or turning — never alternate back and forth between surfaces

Return ONLY valid JSON in this exact shape, with no markdown or code fences:
{"steps": ["microstep 1", "microstep 2", ...]}`,
    }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

  let parsed: unknown
  try {
    parsed = stripFencesAndParse(rawText)
  } catch {
    throw new Error('Claude returned malformed JSON for microsteps')
  }

  const steps_out = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>).steps
    : null

  if (!Array.isArray(steps_out) || steps_out.length === 0 || !steps_out.every((s) => typeof s === 'string')) {
    throw new Error('Claude returned invalid microstep format')
  }

  return steps_out as string[]
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
