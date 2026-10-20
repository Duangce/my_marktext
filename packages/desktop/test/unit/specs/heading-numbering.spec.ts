import { describe, it, expect } from 'vitest'
import {
  getHeadingNumberingCss,
  normalizeStartLevel,
  numberHeadings
} from '@/util/headingNumbering'

describe('numberHeadings', () => {
  it('numbers nested headings from H1', () => {
    expect(numberHeadings([1, 2, 2, 3, 1, 2], 1)).toEqual(['1.', '1.1', '1.2', '1.2.1', '2.', '2.1'])
  })

  it('leaves headings above the start level unnumbered', () => {
    expect(numberHeadings([1, 2, 3, 2, 1, 2], 2)).toEqual(['', '1.', '1.1', '2.', '', '3.'])
  })

  it('resets deeper levels when a higher heading follows', () => {
    expect(numberHeadings([2, 3, 4, 3, 2, 4], 2)).toEqual(['1.', '1.1', '1.1.1', '1.2', '2.', '2.0.1'])
  })

  it('ignores missing levels', () => {
    expect(numberHeadings([null, 1, undefined], 1)).toEqual(['', '1.', ''])
  })
})

describe('getHeadingNumberingCss', () => {
  it('scopes counters to direct child headings of the container', () => {
    const css = getHeadingNumberingCss('.markdown-body', '', 2)
    expect(css).toContain('.markdown-body { counter-reset: mt-heading-2 mt-heading-3')
    expect(css).toContain('.markdown-body > h2 { counter-increment: mt-heading-2; counter-reset: mt-heading-3')
    expect(css).toContain('.markdown-body > h3::before { content: counter(mt-heading-2) "." counter(mt-heading-3);')
    expect(css).not.toContain('> h1')
  })

  it('puts the label on the given child element', () => {
    const css = getHeadingNumberingCss('.mu-container', '.mu-content', 1)
    expect(css).toContain('.mu-container > h1 > .mu-content::before { content: counter(mt-heading-1) ".";')
  })
})

describe('normalizeStartLevel', () => {
  it('accepts 2 and falls back to 1', () => {
    expect(normalizeStartLevel(2)).toBe(2)
    expect(normalizeStartLevel('2')).toBe(2)
    expect(normalizeStartLevel(3)).toBe(1)
    expect(normalizeStartLevel(undefined)).toBe(1)
  })
})
