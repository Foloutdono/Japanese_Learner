import { describe, it, expect } from 'vitest'
import { TAB_IDS, DESK_TAB_IDS, getDeskTabs, getDeskSections, inSection, dueBadge, gateBeside, tabFor } from './tabs'

// ── Which gate is next along the bar ──────────────────────────
// The arithmetic behind the sideways flick (hooks/useGateSwipe), on
// its own in the node lane: it is three rules, and each one of them
// is a decision rather than a detail — where it answers from, in what
// order, and what it does at the ends.

describe('the gate beside one', () => {
  it('walks the bar in the order the bar prints', () => {
    expect(TAB_IDS).toEqual(['learn', 'practice', 'today', 'dictionary', 'profile'])
    expect(gateBeside('/today', 1)).toBe('/dictionary')
    expect(gateBeside('/today', -1)).toBe('/practice')
  })

  it('does not wrap at either end', () => {
    // Past Learn and past Profile there is no next gate: wrapping
    // would turn one over-eager flick into a jump across the app.
    expect(gateBeside('/learn', -1)).toBeNull()
    expect(gateBeside('/profile', 1)).toBeNull()
    expect(gateBeside('/learn', 1)).toBe('/practice')
    expect(gateBeside('/profile', -1)).toBe('/dictionary')
  })

  it('answers from anywhere behind a gate, and lands on the gate', () => {
    // The lit gate is the answer wherever you are standing under the
    // chrome — not the sibling station, which is why a flick from a
    // level opens the next GATE and not the next line.
    expect(gateBeside('/learn/decks', 1)).toBe('/practice')
    expect(gateBeside('/learn/vocab/N5', 1)).toBe('/practice')
    expect(gateBeside('/profile/settings/sound', -1)).toBe('/dictionary')
    expect(gateBeside('/dictionary/analyzer', -1)).toBe('/today')
  })

  it('is no gate at all off the five', () => {
    // The dev routes carry no tab bar, and nothing else is under it.
    expect(tabFor('/dev/ride')).toBeNull()
    expect(gateBeside('/dev/ride', 1)).toBeNull()
    expect(gateBeside('/', 1)).toBeNull()
    expect(gateBeside('', 1)).toBeNull()
    expect(gateBeside(undefined, 1)).toBeNull()
  })
})

// ── 机 — the rail's lists (plan 113) ─────────────────────────
// The desk chrome's navigation, read off the same registry the tab bar
// reads, so a section added to one is on both.
const t = new Proxy({}, { get: (_, key) => String(key) })

describe('the rail', () => {
  it('lists the same five gates, Today first', () => {
    expect([...DESK_TAB_IDS].sort()).toEqual([...TAB_IDS].sort())
    expect(DESK_TAB_IDS[0]).toBe('today')
    expect(getDeskTabs(t).map(tab => tab.id)).toEqual(DESK_TAB_IDS)
    expect(getDeskTabs(t).map(tab => tab.path)).toEqual(DESK_TAB_IDS.map(id => `/${id}`))
  })

  it('lists a gate\'s sections without the gate itself', () => {
    expect(getDeskSections('learn', t).map(s => s.path)).toEqual([
      '/learn/kana', '/learn/vocab', '/learn/kanji', '/learn/grammar', '/learn/decks', '/learn/decks/library',
    ])
    expect(getDeskSections('practice', t).map(s => s.path)).toEqual([
      '/practice/reading', '/practice/comprehension', '/practice/translation',
      '/practice/dictation', '/practice/composition', '/practice/exam',
    ])
    // The queue IS the gate, and the catalogue is the dictionary.
    expect(getDeskSections('today', t)).toEqual([])
    expect(getDeskSections('dictionary', t).map(s => s.path)).toEqual(['/dictionary/analyzer'])
    // The pass's halls: the record, and its settings.
    expect(getDeskSections('profile', t).map(s => s.path)).toEqual(['/profile/stats', '/profile/settings'])
  })

  it('carries no pigment: the rail is chrome', () => {
    for (const id of DESK_TAB_IDS) {
      // A guide anchor is not a colour: the profile's Settings station
      // carries the stop the page's door carried (plan 143).
      for (const row of getDeskSections(id, t)) {
        expect(Object.keys(row).filter(k => k !== 'guide').sort()).toEqual(['path', 'title'])
      }
    }
    expect(getDeskSections('profile', t).map(s => s.guide)).toEqual([undefined, 'profile.settings'])
  })

  it('lights a section from anywhere behind it, and only there', () => {
    expect(inSection('/learn/decks', '/learn/decks')).toBe(true)
    expect(inSection('/learn/decks/library/abc', '/learn/decks')).toBe(true)
    expect(inSection('/profile/settings/sound', '/profile/settings')).toBe(true)
    // A shared prefix is not a shared section.
    expect(inSection('/learn/kanjiX', '/learn/kanji')).toBe(false)
    expect(inSection('/learn', '/learn/kana')).toBe(false)
  })

  it('caps the due count the way the tab bar always has', () => {
    expect(dueBadge(24)).toBe('24')
    expect(dueBadge(99)).toBe('99')
    expect(dueBadge(100)).toBe('99+')
  })
})
