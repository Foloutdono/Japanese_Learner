import { describe, it, expect } from 'vitest'
import { TAB_IDS, DESK_TAB_IDS, DESK_PLACE_IDS, getDeskTabs, getDeskSections, getDeskPlaces, deskPlaceFor, onDeskRail, inSection, dueBadge, gateBeside, tabFor } from './tabs'

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
      '/learn/kana', '/learn/vocab', '/learn/kanji', '/learn/grammar',
    ])
    expect(getDeskSections('practice', t).map(s => s.path)).toEqual([
      '/practice/reading', '/practice/comprehension', '/practice/translation',
      '/practice/dictation', '/practice/composition', '/practice/exam', '/practice/conversation',
    ])
    // The queue IS the gate, and the catalogue is the dictionary; the
    // analyser, the shelf, the record and the settings are places
    // (plan 269), listed on their own.
    expect(getDeskSections('today', t)).toEqual([])
    expect(getDeskSections('dictionary', t)).toEqual([])
    expect(getDeskSections('profile', t)).toEqual([])
  })

  it('lists the four places, each behind the gate its phone route is (plan 269)', () => {
    expect(getDeskPlaces(t).map(p => p.id)).toEqual(DESK_PLACE_IDS)
    expect(getDeskPlaces(t).map(p => [p.path, tabFor(p.path)])).toEqual([
      ['/dictionary/analyzer', 'dictionary'],
      ['/learn/decks', 'learn'],
      ['/profile/stats', 'profile'],
      ['/profile/settings', 'profile'],
    ])
    // The profile's guide finds its two stops on the rail.
    expect(getDeskPlaces(t).map(p => p.guide)).toEqual([undefined, undefined, 'profile.stats', 'profile.settings'])
  })

  it('says which place a path stands in, the library and the shelf being one', () => {
    expect(deskPlaceFor('/learn/decks')?.id).toBe('library')
    expect(deskPlaceFor('/learn/decks/12')?.id).toBe('library')
    expect(deskPlaceFor('/learn/decks/library/12')?.id).toBe('library')
    expect(deskPlaceFor('/profile/settings/sound')?.id).toBe('settings')
    expect(deskPlaceFor('/dictionary/analyzer')?.id).toBe('analyzer')
    expect(deskPlaceFor('/dictionary')).toBeNull()
    expect(deskPlaceFor('/profile')).toBeNull()
    expect(deskPlaceFor('/learn/vocab')).toBeNull()
  })

  it('counts a place as a door the rail already has', () => {
    for (const p of getDeskPlaces(t)) expect(onDeskRail(p.path), p.path).toBe(true)
    expect(onDeskRail('/learn/vocab')).toBe(true)
    expect(onDeskRail('/learn/vocab/themes')).toBe(false)
  })

  it('carries no pigment: the rail is chrome', () => {
    for (const id of DESK_TAB_IDS) {
      for (const row of getDeskSections(id, t)) {
        expect(Object.keys(row).sort()).toEqual(['path', 'title'])
      }
    }
    // A place names a pictogram and a guide's stop, never a colour.
    for (const p of getDeskPlaces(t)) {
      expect(Object.keys(p).filter(k => k !== 'guide').sort()).toEqual(['id', 'path', 'title'])
    }
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
