import { describe, it, expect } from 'vitest'
import { stripHtml } from '@/lib/claude'

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
