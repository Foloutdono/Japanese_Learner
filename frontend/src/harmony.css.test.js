import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ── 調和 — the harmony rules hold (plan 174) ─────────────────────────
// The owner's harmony round ("Tsuji — harmony") found the screens had
// drifted apart one feature at a time: four colours for the primary
// action, two for "selected", one panel at three radii, twelve pigments
// at twelve strengths. The rules it settled are read here, statically,
// so a later feature cannot quietly reopen one:
//
//   一面  a panel's corner is --r-panel, a control's --r-card
//   一金  every primary action is the metal (--metal)
//   一選  what is chosen is lit in the selection's gold (--sel-*)
//   線    a line's edge is 3px; a figure on a plate is not boxed
//   一戻  the way back is bare
//   状態  the rating's best tile is not gold
//   一族  the line pigments are one family: one lightness per theme

const CSS = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
const SHEET = stripComments(CSS)

// The body of the first rule whose selector list is exactly `selector`.
function rule(selector) {
  const re = new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
  const m = SHEET.match(re)
  if (!m) throw new Error(`no rule ${selector}`)
  return m[2]
}
const decl = (body, prop) => body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*([^;]+);`))?.[1].trim()

// The :root blocks' custom properties.
function block(open) {
  const i = SHEET.indexOf(open)
  const body = SHEET.slice(SHEET.indexOf('{', i) + 1, SHEET.indexOf('\n}', i))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
}
const DARK = block('\n:root {')
const LIGHT = block(':root[data-theme="light"] {')

// OKLCH lightness and chroma of a #rrggbb.
function oklch(hex) {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16)))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(A, B) }
}

describe('調和 — the harmony rules (plan 174)', () => {
  it('一面: a panel\'s corner is the panel\'s, a control\'s the control\'s', () => {
    const panels = ['.plate', '.platform-card', '.route-stop', '.dict-entry-card', '.records', '.exam-st__row',
      '.anl-door', '.anl-entry', '.rep-plate', '.rep-strip', '.dict-form', '.deck-identity', '.card-list',
      '.balance__rows', '.jour-cmps', '.stg-list', '.sbook', '.gate-card__short', '.console', '.gate-card', '.exam-st__hero']
    for (const p of panels) expect(decl(rule(p), 'border-radius'), p).toBe('var(--r-panel)')
    for (const c of ['.seg', '.field']) expect(decl(rule(c), 'border-radius'), c).toBe('var(--r-card)')
  })

  it('一金: the primary and the filled action are the metal', () => {
    expect(decl(rule('.btn-primary'), 'background')).toBe('var(--metal)')
    expect(decl(rule('.btn-depart'), 'background')).toBe('var(--metal)')
    expect(decl(rule('.btn-primary'), 'color')).toBe('var(--text-on-fill)')
  })

  it('一選: a chosen chip, segment, band and key are lit in the selection\'s gold', () => {
    for (const s of ['.chip--on', '.console__band-opt--on', '.stroke-rail__key--on']) {
      const body = rule(s)
      expect(decl(body, 'background'), s).toBe('var(--sel-wash)')
      expect(decl(body, 'color'), s).toBe('var(--sel-ink)')
    }
    expect(rule('.seg__opt--on')).toContain('var(--sel-wash)')
    // Where you are is not a choice: it keeps the line's pigment.
    expect(rule('.chip--here')).toContain('var(--line-color)')
  })

  it('線 and 一戻: an edge of 3px, a count unboxed, a bare way back', () => {
    expect(decl(rule('.plate__stripe'), 'height')).toBe('3px')
    expect(decl(rule('.plate__due'), 'border')).toBeUndefined()
    expect(decl(rule('.stage__leave'), 'border')).toBe('0')
  })

  it('状態: the rating\'s best tile is not filled', () => {
    expect(SHEET).not.toMatch(/\.rating-bar__btn--best[^{]*\{[^}]*background:\s*var\(--accent2\)/)
  })

  it('一族: the line pigments are one lightness in each theme', () => {
    // 山吹 is the metal and stays it; 鶯 is no longer a line.
    const lines = Object.keys(DARK).filter(k => k.startsWith('line-') && !['line-jisho', 'line-douga'].includes(k))
    expect(lines.length).toBe(12)
    for (const k of lines) {
      const d = oklch(DARK[k])
      const l = oklch(LIGHT[k])
      expect(Math.abs(d.L - 0.56), `${k} dark ${DARK[k]}`).toBeLessThan(0.015)
      expect(Math.abs(l.L - 0.48), `${k} light ${LIGHT[k]}`).toBeLessThan(0.015)
      expect(d.C, k).toBeLessThan(0.15)
    }
  })
})
