import { describe, it, expect } from 'vitest'
import { weld, welded } from './frenchSpacing.js'
import fr from './fr/index.js'

const NBSP = '\u00A0'

// ── The welder ──────────────────────────────────────────────────
// What the fix has to be: the same glyphs, the same width, one fewer
// place the line is allowed to end. A test that only checked the
// table would pass just as well if weld() replaced the punctuation
// with nothing, so the shape is pinned here and the coverage in
// locales.test.js.

describe('weld', () => {
  it('makes the space before high punctuation unbreakable', () => {
    expect(weld('pour vous :')).toBe(`pour vous${NBSP}:`)
    expect(weld('Bien ! Quel est votre niveau ?')).toBe(`Bien${NBSP}! Quel est votre niveau${NBSP}?`)
    expect(weld('à 3 par jour ; la date bouge')).toBe(`à 3 par jour${NBSP}; la date bouge`)
  })

  it('welds both guillemets to what they enclose', () => {
    expect(weld('« Sur l’écran d’accueil »')).toBe(`«${NBSP}Sur l’écran d’accueil${NBSP}»`)
  })

  it('changes nothing else — same text, same length, no lost glyph', () => {
    const before = 'À 10 min par jour, d’ici décembre 2026, pour vous :'
    const after = weld(before)
    expect(after).toHaveLength(before.length)
    expect(after.replace(/\u00A0/g, ' ')).toBe(before)
    // Punctuation with no space in front of it is left alone: a URL,
    // the bookmarklet's scheme, a ratio.
    expect(weld('javascript:void 0')).toBe('javascript:void 0')
    expect(weld('https://x/?a=b')).toBe('https://x/?a=b')
    // Already welded by hand, or by a previous pass: idempotent.
    expect(weld(weld('pour vous :'))).toBe(`pour vous${NBSP}:`)
  })

  it('collapses a run of spaces rather than leaving a breakable one', () => {
    expect(weld('pour vous  :')).toBe(`pour vous${NBSP}:`)
  })
})

describe('welded', () => {
  it('welds strings, nested groups and what a copy function returns', () => {
    const table = {
      plain: 'Réponse :',
      call: (n) => `${n} cartes !`,
      group: { one: 'Vraiment ?' },
      list: ['Et lui ?'],
      // Not copy, and not to be touched.
      count: 3,
      nothing: null,
      notText: () => ({ ok: true }),
    }
    const out = welded(table)
    expect(out.plain).toBe(`Réponse${NBSP}:`)
    expect(out.call(2)).toBe(`2 cartes${NBSP}!`)
    expect(out.group.one).toBe(`Vraiment${NBSP}?`)
    expect(out.list[0]).toBe(`Et lui${NBSP}?`)
    expect(out.count).toBe(3)
    expect(out.nothing).toBeNull()
    expect(out.notText()).toEqual({ ok: true })
    // The parity test compares typeof across tables: a wrapped copy
    // function has to stay a function.
    expect(typeof out.call).toBe('function')
  })

  it('is already applied to the French table', () => {
    // The screen that started this: the lead under the projection.
    expect(fr.brdLead(10, 'décembre 2026', fr.brdFor.other)).toBe(
      `À **10 min par jour**, d’ici **décembre 2026**, pour vous${NBSP}:`
    )
    expect(fr.brdNameQ).toBe(`Comment vous appelez-vous${NBSP}?`)
  })
})
