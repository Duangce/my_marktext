// Automatic heading numbering ("1.", "1.1", "1.1.1"). Display-only: the
// markdown file is never changed. The editor and the HTML/PDF export draw the
// numbers with CSS counters; the sidebar outline computes the same numbers in
// JS (`numberHeadings`). Both only number top-level headings — the ones
// `muya.getTOC()` lists — so a heading inside a quote or list is skipped.

export type HeadingNumberingStartLevel = 1 | 2

const MAX_LEVEL = 6

export const normalizeStartLevel = (value: unknown): HeadingNumberingStartLevel =>
  Number(value) === 2 ? 2 : 1

const counterName = (level: number): string => `mt-heading-${level}`

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)

/**
 * CSS that numbers the headings directly inside `container`.
 *
 * @param container Selector of the element whose child headings are numbered
 *   (`.mu-container` in the editor, `.markdown-body` in the export).
 * @param labelSelector Selector, relative to the heading, of the element that
 *   carries the number as `::before` (empty to put it on the heading itself).
 */
export const getHeadingNumberingCss = (
  container: string,
  labelSelector: string,
  startLevel: HeadingNumberingStartLevel
): string => {
  const levels = range(startLevel, MAX_LEVEL)
  const rules = [`${container} { counter-reset: ${levels.map(counterName).join(' ')}; }`]

  for (const level of levels) {
    const heading = `${container} > h${level}`
    const deeper = range(level + 1, MAX_LEVEL).map(counterName)
    rules.push(
      `${heading} { counter-increment: ${counterName(level)};${deeper.length ? ` counter-reset: ${deeper.join(' ')};` : ''} }`
    )

    const parts = range(startLevel, level).map((l) => `counter(${counterName(l)})`)
    const suffix = level === startLevel ? ' "."' : ''
    const target = labelSelector ? `${heading} > ${labelSelector}::before` : `${heading}::before`
    rules.push(
      `${target} { content: ${parts.join(' "." ')}${suffix}; margin-inline-end: 0.5em; }`
    )
  }

  return rules.join('\n')
}

/**
 * The number label for each heading in document order, matching the CSS
 * counters above; '' for headings above `startLevel`.
 */
export const numberHeadings = (
  levels: Array<number | null | undefined>,
  startLevel: HeadingNumberingStartLevel
): string[] => {
  const counts = new Array<number>(MAX_LEVEL + 1).fill(0)
  return levels.map((raw) => {
    const level = Number(raw)
    if (!Number.isInteger(level) || level < startLevel || level > MAX_LEVEL) return ''
    counts[level]!++
    for (let deeper = level + 1; deeper <= MAX_LEVEL; deeper++) counts[deeper] = 0
    const label = counts.slice(startLevel, level + 1).join('.')
    return level === startLevel ? `${label}.` : label
  })
}

const EDITOR_STYLE_ID = 'heading-numbering-styles'

/** Add, update or remove the editor's heading-numbering stylesheet. */
export const applyEditorHeadingNumbering = (
  enabled: boolean,
  startLevel: HeadingNumberingStartLevel
): void => {
  let style = document.getElementById(EDITOR_STYLE_ID) as HTMLStyleElement | null
  if (!enabled) {
    style?.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = EDITOR_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = getHeadingNumberingCss('.mu-container', '.mu-content', startLevel)
}

/** Stylesheet for the exported document (HTML, PDF, print). */
export const getExportHeadingNumberingCss = (startLevel: HeadingNumberingStartLevel): string =>
  getHeadingNumberingCss('.markdown-body', '', startLevel)
