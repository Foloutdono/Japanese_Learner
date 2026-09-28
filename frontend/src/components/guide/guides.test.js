import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GUIDES, DESK_ORDER, DESK_RADIUS, deskStops } from './guides'
import { TAB_IDS } from '../../config/tabs'
import en from '../../locales/en/index.js'
import fr from '../../locales/fr/index.js'

// ── 案内 — the registry's promises (plan 100) ────────────────────
// The gates are the tab bar's; every stop's anchor is written on some
// element in the source (a refactor that drops a `data-guide` fails
// here, not on a learner); every stop has its sentence and its pair in
// both languages.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// The guide's own folder is left out: the registry names every anchor,
// so reading it as a source found every anchor written, including one
// no element carries.
const GUIDE_DIR = dirname(fileURLToPath(import.meta.url))
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (p === GUIDE_DIR) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.jsx?$/.test(name) && !name.includes('.test.')) out.push(readFileSync(p, 'utf8'))
  }
  return out
}
const sources = walk(SRC).join('\n')
// Stops no element carries yet, on purpose: the practice gate's pass
// tag is drawn once something is for sale (plan 122), and the guide
// skips it until then.
const UNDRAWN = new Set(['practice.pass'])

describe('the guide registry', () => {
  it('has exactly the tab bar\'s gates, in its order', () => {
    expect(Object.keys(GUIDES)).toEqual(TAB_IDS)
  })

  it('names at most ten stops a gate', () => {
    for (const [gate, stops] of Object.entries(GUIDES)) {
      expect(stops.length, gate).toBeLessThanOrEqual(10)
    }
  })

  it('every anchor is written on an element somewhere in the source', () => {
    for (const stops of Object.values(GUIDES)) {
      for (const stop of stops) {
        if (UNDRAWN.has(stop.anchor)) continue
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

  // Plan 143: the profile's Settings stop is the rail's station on the
  // desk, a lozenge; on the phone it is a flush lattice cell. Every
  // anchor DESK_RADIUS names is a stop somewhere.
  it('draws the rail\'s stations with a panel\'s corner, and only on the desk', () => {
    const anchors = Object.values(GUIDES).flat().map(s => s.anchor)
    for (const anchor of Object.keys(DESK_RADIUS)) expect(anchors, anchor).toContain(anchor)
    const profile = Object.fromEntries(deskStops('profile').map(s => [s.anchor, s.radius]))
    expect(profile['profile.settings']).toBe('panel')
    expect(GUIDES.profile.find(s => s.anchor === 'profile.settings').radius).toBe('flat')
    // The phone walks the screen top to bottom, the door under the pass;
    // the desk walks the page first and ends on the rail's station.
    expect(GUIDES.profile.map(s => s.anchor).slice(0, 3)).toEqual(['profile.pass', 'profile.stats', 'profile.settings'])
    expect(deskStops('profile').map(s => s.anchor).slice(-2)).toEqual(['profile.stats', 'profile.settings'])
  })
})

// The first gate after the first ride says how to start and where the
// rest is, and nothing more (2026-09-28): the level, the status, the
// balance, the run's length and fare, the strip, the journey and the
// week ahead are left to be found.
describe('Today\'s guide', () => {
  it('stops at the gate and the gates only', () => {
    expect(GUIDES.today.map(s => s.anchor)).toEqual(['today.gate', 'tabbar'])
  })
})
