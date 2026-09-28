import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DESK_QUERY } from './hooks/useDesk'

// ── 机 — the desk may not touch the phone (plan 113) ─────────────────
// Tsuji has two chromes: the phone's, which every width below 1100px
// draws exactly as it did before the desk existed, and the desk's. The
// owner's one condition on the second was that it can never break the
// first. The DOM half of that promise is JavaScript's (the components
// render the desk only when hooks/useDesk says so; the phone lane checks
// nothing of it is drawn). This is the stylesheet's half, read statically
// so it holds for every rule rather than for the ones a fixture happens
// to render:
//
//   1. The desk's rules are one section at the very end of index.css,
//      between two markers, and every statement in it is ONE media query
//      — the same string hooks/useDesk.js answers from. A rule there
//      cannot reach a phone, because the query is its only door.
//   2. The desk's own names (.desk-*, .phone--desk, @keyframes desk-*)
//      are written nowhere else in the sheet, so no rule outside the
//      section can style a desk object at a phone's width by accident.
//   3. No !important in the section: the desk wins by coming last, never
//      by shouting, so the phone's cascade is not bent around it.
//   4. JavaScript writes the width once — in hooks/useDesk.js — so the
//      split cannot drift between the components and the sheet.

const SRC = fileURLToPath(new URL('.', import.meta.url))
const CSS = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

const OPEN = '/* ═══ 机 — the desk (plan 113)'
const CLOSE = '/* ═══ 机 — end of the desk'

// The sheet quotes real declarations inside its comments constantly, so
// every scan strips them first (the other guards do the same).
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

const count = (hay, needle) => hay.split(needle).length - 1
const norm = s => s.trim().replace(/\s+/g, ' ')

// The statements directly inside `text`: a prelude and, for a block, its
// body. Braces inside strings do not occur in this sheet's desk section.
function statements(text) {
  const out = []
  let depth = 0
  let start = 0
  let bodyStart = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '{') {
      if (depth === 0) bodyStart = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0) {
        out.push({ prelude: norm(text.slice(start, bodyStart)), body: text.slice(bodyStart + 1, i) })
        start = i + 1
      }
    } else if (c === ';' && depth === 0) {
      out.push({ prelude: norm(text.slice(start, i)), body: null })
      start = i + 1
    }
  }
  const rest = norm(text.slice(start))
  if (rest) out.push({ prelude: rest, body: null })
  return out
}

function section() {
  const open = CSS.indexOf(OPEN)
  const openEnd = CSS.indexOf('*/', open) + 2
  const close = CSS.indexOf(CLOSE)
  const closeEnd = CSS.indexOf('*/', close) + 2
  return { open, close, closeEnd, text: stripComments(CSS.slice(openEnd, close)) }
}

function sources(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) ? [path] : []
  })
}

describe('the desk section of index.css', () => {
  it('is one section, and the last thing in the file', () => {
    expect(count(CSS, OPEN)).toBe(1)
    expect(count(CSS, CLOSE)).toBe(1)
    const { open, close, closeEnd } = section()
    expect(open).toBeLessThan(close)
    expect(CSS.slice(closeEnd).trim()).toBe('')
  })

  it('is written under the query hooks/useDesk.js answers from, and nothing else', () => {
    const top = statements(section().text)
    expect(top.length).toBeGreaterThan(0)
    for (const st of top) expect(st.prelude).toBe(`@media ${DESK_QUERY}`)
  })

  it('nests only a motion answer, a pointer answer and its own keyframes', () => {
    const allowed = [
      /^@media \(prefers-reduced-motion: reduce\)$/,
      /^@media \(pointer: fine\)$/,
      /^@keyframes desk-[a-z0-9-]+$/,
    ]
    for (const block of statements(section().text)) {
      for (const st of statements(block.body)) {
        if (!st.prelude.startsWith('@')) continue
        expect(allowed.some(re => re.test(st.prelude)), st.prelude).toBe(true)
      }
    }
  })

  it('never raises its voice', () => {
    expect(section().text).not.toMatch(/!important/)
  })

  it('owns its names: no desk selector or keyframes outside it', () => {
    const outside = stripComments(CSS.slice(0, section().open))
    expect(outside.match(/\.(desk-[\w-]+|phone--desk)\b/g) ?? []).toEqual([])
    expect(outside).not.toMatch(/@keyframes desk-/)
  })
})

describe('the desk width in JavaScript', () => {
  it('is written once, in hooks/useDesk.js', () => {
    const writers = sources(SRC)
      .filter(path => readFileSync(path, 'utf8').includes('min-width: 1100px'))
      .map(path => relative(SRC, path).split('\\').join('/'))
    expect(writers).toEqual(['hooks/useDesk.js'])
  })
})

// ── plan 122 — first contact leaves the short step alone ──
// The boarding steps its question, its answers and its action down a
// rung when its frame is under 740px tall (the `brd` container query):
// on a 1366×768 laptop that is the desk's case too. A desk rule on the
// same element and property would beat it by specificity and hold the
// tall value on a short window -- so the desk's first-contact rules
// write none of the pairs the short step writes, compared on the
// rightmost class each selector styles and on longhand properties.
const LONGHANDS = {
  gap: ['row-gap', 'column-gap'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'padding-block': ['padding-top', 'padding-bottom'],
  'padding-inline': ['padding-left', 'padding-right'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  'margin-block': ['margin-top', 'margin-bottom'],
  'margin-inline': ['margin-left', 'margin-right'],
}
function subject(selector) {
  let s = selector
  for (let i = 0; i < 4; i++) s = s.replace(/:(not|has|is|where)\([^()]*\)/g, '')
  const last = s.trim().split(/[\s>+~]+/).at(-1) ?? ''
  return last.match(/\.[\w-]+/g)?.at(-1) ?? null
}
function pairs(rules) {
  const out = new Set()
  for (const rule of rules) {
    const props = rule.body.split(';').map(d => d.split(':')[0].trim()).filter(Boolean)
    for (const sel of rule.prelude.split(',')) {
      const cls = subject(sel)
      if (!cls) continue
      for (const p of props) for (const l of LONGHANDS[p] ?? [p]) out.add(`${cls} ${l}`)
    }
  }
  return out
}
function rulesIn(text) {
  return statements(text).flatMap(st => (st.body == null ? [] : st.prelude.startsWith('@') ? rulesIn(st.body) : [st]))
}

describe('the desk\'s first contact (plan 122)', () => {
  it('writes no pair the boarding\'s short step writes', () => {
    const outside = stripComments(CSS.slice(0, section().open))
    const at = outside.indexOf('@container brd (max-height: 739px)')
    expect(at).toBeGreaterThan(-1)
    const short = pairs(rulesIn(statements(outside.slice(at))[0].body))
    expect(short.size).toBeGreaterThan(10)
    const desk = pairs(rulesIn(section().text).filter(r => /\.desk-(brd|front)\b/.test(r.prelude)))
    expect(desk.size).toBeGreaterThan(10)
    expect([...desk].filter(p => short.has(p))).toEqual([])
  })
})
