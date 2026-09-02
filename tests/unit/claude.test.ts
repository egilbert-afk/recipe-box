import { describe, it, expect } from 'vitest'
import { stripHtml, parseRawRecipeJson, extractOpenGraphContext } from '@/lib/claude'

// ── stripHtml ─────────────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('removes script tags and their content', () => {
    const html = '<html><script>alert("xss")</script><p>Hello</p></html>'
    const result = stripHtml(html)
    expect(result).not.toContain('alert')
    expect(result).toContain('Hello')
  })

  it('removes style tags and their content', () => {
    const html = '<html><style>body { color: red; }</style><p>Hello</p></html>'
    const result = stripHtml(html)
    expect(result).not.toContain('color')
    expect(result).toContain('Hello')
  })

  it('strips all remaining HTML tags', () => {
    const html = '<div><h1>Title</h1><p>Paragraph</p></div>'
    const result = stripHtml(html)
    expect(result).not.toContain('<')
    expect(result).toContain('Title')
    expect(result).toContain('Paragraph')
  })

  it('decodes common HTML entities', () => {
    const html = 'Tomatoes &amp; basil &lt;fresh&gt; &quot;good&quot;'
    const result = stripHtml(html)
    expect(result).toContain('Tomatoes & basil')
    expect(result).toContain('<fresh>')
    expect(result).toContain('"good"')
  })

  it('replaces &nbsp; with a regular space', () => {
    const result = stripHtml('one&nbsp;two')
    expect(result).toBe('one two')
  })

  it('collapses multiple whitespace characters into a single space', () => {
    const html = '<p>Too   many    spaces\n\nand newlines</p>'
    expect(stripHtml(html)).toBe('Too many spaces and newlines')
  })

  it('caps output at 20000 characters', () => {
    const html = 'a'.repeat(30000)
    expect(stripHtml(html).length).toBe(20000)
  })

  it('returns an empty string for an empty input', () => {
    expect(stripHtml('')).toBe('')
  })
})

// ── extractOpenGraphContext ──────────────────────────────────────────────────
// Meta tag content lives in an attribute, not in text between tags, so stripHtml alone
// discards it. This matters most for pages like Instagram posts, whose caption — the
// entire recipe — is only ever in og:description; the rest of the initial HTML is an
// empty JS shell with nothing for stripHtml to find.

describe('extractOpenGraphContext', () => {
  it('extracts og:title and og:description in property-then-content order', () => {
    const html = '<meta property="og:title" content="Garlic Pasta"><meta property="og:description" content="A quick weeknight pasta.">'
    const result = extractOpenGraphContext(html)
    expect(result).toBe('Page title: Garlic Pasta\nPage description: A quick weeknight pasta.')
  })

  it('extracts og tags in content-then-property order', () => {
    const html = '<meta content="A quick weeknight pasta." property="og:description">'
    const result = extractOpenGraphContext(html)
    expect(result).toBe('Page description: A quick weeknight pasta.')
  })

  it('decodes HTML entities in the extracted content', () => {
    const html = '<meta property="og:description" content="Salt &amp; pepper to taste">'
    expect(extractOpenGraphContext(html)).toBe('Page description: Salt & pepper to taste')
  })

  it('returns an empty string when neither tag is present (e.g. a login-wall shell page)', () => {
    expect(extractOpenGraphContext('<html><head><title>Instagram</title></head></html>')).toBe('')
  })

  it('extracts only the tag that is present', () => {
    const html = '<meta property="og:title" content="Garlic Pasta">'
    expect(extractOpenGraphContext(html)).toBe('Page title: Garlic Pasta')
  })
})

// ── parseRawRecipeJson ────────────────────────────────────────────────────────

const BASE_RECIPE = {
  title: 'Garlic Pasta',
  cuisine_id: 'italian',
  meal_type_id: 'entree',
  servings: 2,
  ingredients: [{ name: 'garlic, minced', amount: 3, unit: 'cloves', order_index: 0 }],
  steps: [{ instruction: 'Cook pasta until al dente.', order_index: 0 }],
}

function makeJson(overrides: object = {}) {
  return JSON.stringify({ ...BASE_RECIPE, implied_prep_steps: [], ...overrides })
}

describe('parseRawRecipeJson', () => {
  it('throws on malformed JSON', () => {
    expect(() => parseRawRecipeJson('not json')).toThrow('malformed JSON')
  })

  it('throws when title is missing', () => {
    expect(() => parseRawRecipeJson(makeJson({ title: '' }))).toThrow('incomplete recipe data')
  })

  it('throws when steps are empty', () => {
    expect(() => parseRawRecipeJson(makeJson({ steps: [] }))).toThrow('incomplete recipe data')
  })

  it('throws when ingredients are empty', () => {
    expect(() => parseRawRecipeJson(makeJson({ ingredients: [] }))).toThrow('incomplete recipe data')
  })

  it('strips markdown fences before parsing', () => {
    const fenced = '```json\n' + makeJson() + '\n```'
    const result = parseRawRecipeJson(fenced)
    expect(result.title).toBe('Garlic Pasta')
  })

  it('returns steps unchanged when implied_prep_steps is empty', () => {
    const result = parseRawRecipeJson(makeJson({ implied_prep_steps: [] }))
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].instruction).toBe('Cook pasta until al dente.')
    expect(result.steps[0].order_index).toBe(0)
  })

  it('prepends implied prep steps before recipe steps', () => {
    const result = parseRawRecipeJson(makeJson({
      implied_prep_steps: ['Mince the garlic.'],
    }))
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].instruction).toBe('Mince the garlic.')
    expect(result.steps[0].order_index).toBe(0)
    expect(result.steps[1].instruction).toBe('Cook pasta until al dente.')
    expect(result.steps[1].order_index).toBe(1)
  })

  it('prepends multiple implied prep steps and re-indexes correctly', () => {
    const result = parseRawRecipeJson(makeJson({
      steps: [
        { instruction: 'Step A', order_index: 0 },
        { instruction: 'Step B', order_index: 1 },
      ],
      implied_prep_steps: ['Mince the garlic.', 'Dice the onion.'],
    }))
    expect(result.steps).toHaveLength(4)
    expect(result.steps[0]).toMatchObject({ instruction: 'Mince the garlic.', order_index: 0 })
    expect(result.steps[1]).toMatchObject({ instruction: 'Dice the onion.', order_index: 1 })
    expect(result.steps[2]).toMatchObject({ instruction: 'Step A', order_index: 2 })
    expect(result.steps[3]).toMatchObject({ instruction: 'Step B', order_index: 3 })
  })

  it('ignores blank strings in implied_prep_steps', () => {
    const result = parseRawRecipeJson(makeJson({
      implied_prep_steps: ['Mince the garlic.', '  ', ''],
    }))
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].instruction).toBe('Mince the garlic.')
  })

  it('handles missing implied_prep_steps field gracefully', () => {
    const json = JSON.stringify({
      ...BASE_RECIPE,
      // implied_prep_steps intentionally absent
    })
    const result = parseRawRecipeJson(json)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].instruction).toBe('Cook pasta until al dente.')
  })

  it('returns all core recipe fields correctly', () => {
    const result = parseRawRecipeJson(makeJson())
    expect(result.title).toBe('Garlic Pasta')
    expect(result.cuisine_id).toBe('italian')
    expect(result.meal_type_id).toBe('entree')
    expect(result.servings).toBe(2)
    expect(result.ingredients).toHaveLength(1)
    expect(result.ingredients[0].name).toBe('garlic, minced')
  })
})
