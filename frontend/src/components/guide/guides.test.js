import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GUIDES, DESK_ORDER, deskStops } from './guides'
import { TAB_IDS } from '../../config/tabs'
import en from '../../locales/en/index.js'
import fr from '../../locales/fr/index.js'

// ── 案内 — the registry's promises (plan 100) ────────────────────
// The gates are the tab bar's; every stop's anchor is written on some
// element in the source (a refactor that drops a `data-guide` fails
// here, not on a learner); every stop has its sentence and its pair in
// both languages.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.jsx?$/.test(name) && !name.includes('.test.')) out.push(readFileSync(p, 'utf8'))
  }
  return out
}
const sources = walk(SRC).join('\n')

describe('the guide registry', () => {
  it('has exactly the tab bar\'s gates, in its order', () => {
    expect(Object.keys(GUIDES)).toEqual(TAB_IDS)
  })

  it('names at most six stops a gate', () => {
    for (const [gate, stops] of Object.entries(GUIDES)) {
      expect(stops.length, gate).toBeLessThanOrEqual(6)
    }
  })

  it('every anchor is written on an element somewhere in the source', () => {
    for (const stops of Object.values(GUIDES)) {
      for (const stop of stops) {
        // `data-guide="x"` or a `guide="x"` / `'x'` prop that a component
        // prints as data-guide.
        const written = sources.includes(`"${stop.anchor}"`) || sources.includes(`'${stop.anchor}'`)
        expect(written, `${stop.anchor} is on no element`).toBe(true)
      }
    }
  })

  // One sentence per stop, in both tables. It was a sentence and a
  // Japanese eyebrow over it until 2026-09-21, when the ornamental
  // half of every such pair was retired app-wide (DESIGN.md, "Say
  // less"); the note is the sentence now, so a leftover `…Jp` string
  // would be a table entry nothing prints.
  it('every stop has its sentence in both tables, and no leftover eyebrow', () => {
    for (const stops of Object.values(GUIDES)) {
      for (const stop of stops) {
        for (const t of [en, fr]) {
          expect(typeof t[`guide${stop.key}`], stop.key).toBe('string')
          expect(t[`guide${stop.key}Jp`], stop.key).toBeUndefined()
        }
      }
    }
  })
})

// ── 机 — what the desk prints (plan 123) ──
// The desk reads guide<Key>Desk where a stop has one. Whatever it
// prints must be worded for a pointer: four notes said "tap" there, and
// two of them pointed at a thing the desk had already opened.
describe('the guide on the desk', () => {
  const printed = (t, key) => t[`guide${key}Desk`] ?? t[`guide${key}`]
  it('says tap nowhere the desk prints', () => {
    for (const stops of Object.values(GUIDES)) {
      for (const stop of stops) {
        for (const t of [en, fr]) expect(printed(t, stop.key), stop.key).not.toMatch(/\btap|touchez/i)
      }
    }
    for (const t of [en, fr]) {
      for (const [key, text] of Object.entries(t)) {
        if (/^ride[A-Za-z]*Desk$/.test(key)) expect(text, key).not.toMatch(/\btap|touchez/i)
      }
    }
  })

  it('walks a gate in a desk order made of its own stops, every one', () => {
    for (const [gate, order] of Object.entries(DESK_ORDER)) {
      expect([...order].sort(), gate).toEqual(GUIDES[gate].map(s => s.anchor).sort())
      expect(deskStops(gate).map(s => s.anchor)).toEqual(order)
    }
    expect(deskStops('learn')).toBe(GUIDES.learn)
  })
})
