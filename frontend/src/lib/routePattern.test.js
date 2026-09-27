// ── 経路 — a path becomes the route it matched, and nothing else ──
//
// The failure this pins is a leak, not a crash: `/learn/decks/42` and
// `/learn/vocab/theme/animaux/...` carry a deck the learner named and a
// theme they chose, and storing the pathname would put both in a row
// that outlives the session. Every screen_view goes through here, so a
// regression is silent -- the app keeps working and the trail quietly
// starts recording content.
//
// It also pins the drift: App.jsx declares the routes, ROUTES lists
// them, and nothing but the last test here notices when a screen is
// added to one and not the other.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

import { ROUTES, routePattern } from './routePattern'

describe('routePattern', () => {
  it('reduces a path with an id in it to its pattern', () => {
    expect(routePattern('/learn/decks/42')).toBe('/learn/decks/:deck_id')
    expect(routePattern('/learn/decks/42/study')).toBe('/learn/decks/:deck_id/study')
    expect(routePattern('/practice/exam/e-9f3a/results'))
      .toBe('/practice/exam/:examId/results')
  })

  it('never returns a segment the learner chose', () => {
    // The worst case in the app: a theme slug AND a level AND a mode.
    const p = routePattern('/learn/vocab/theme/animaux/level/N4/recognition')
    expect(p).toBe('/learn/vocab/theme/:theme/level/:themeLevel/:mode')
    expect(p).not.toContain('animaux')
  })

  it('prefers the literal route over the parameterised one', () => {
    // Both `/learn/vocab/levels` and `/learn/vocab/:level` match this.
    // First-past-the-post would make the answer depend on list order.
    expect(routePattern('/learn/vocab/levels')).toBe('/learn/vocab/levels')
    expect(routePattern('/learn/vocab/N5')).toBe('/learn/vocab/:level')
    expect(routePattern('/learn/kanji/tiers')).toBe('/learn/kanji/tiers')
    expect(routePattern('/learn/kanji/tier/3')).toBe('/learn/kanji/tier/:tier')
    expect(routePattern('/learn/kanji/radicals')).toBe('/learn/kanji/radicals')
    expect(routePattern('/learn/kanji/radical/85')).toBe('/learn/kanji/radical/:radical')
    expect(routePattern('/learn/kanji/radical/85/kanji.readings?g=水')).toBe('/learn/kanji/radical/:radical/:mode')
  })

  it('drops the query and the hash', () => {
    // `/exam/<id>?exclude=…` carries ids in the query specifically.
    expect(routePattern('/practice/exam/abc?exclude=1,2,3'))
      .toBe('/practice/exam/:examId')
    expect(routePattern('/profile/settings#data')).toBe('/profile/settings')
  })

  it('reduces every desk split row\'s link to its pattern', () => {
    // Plan 117: on the desk a split's rows are links, and their hrefs
    // name what the learner opened — a theme, a deck, a grammar point, an
    // exam question. A click on one is recorded the way a navigate() was
    // (App.jsx's Trail reads the router's pathname), a tab opened from
    // one records its own screen_view, and either way the pattern is all
    // that is kept. The query (point, question, level, size) never is.
    const links = {
      '/learn/vocab/N4': '/learn/vocab/:level',
      '/learn/kana/katakana_basic': '/learn/kana/:set',
      '/learn/vocab/theme/animaux/level/advanced': '/learn/vocab/theme/:theme/level/:themeLevel',
      '/learn/vocab/tier/6?size=200&domain=jmdict': '/learn/vocab/tier/:tier',
      '/learn/kanji/tier/4?size=200': '/learn/kanji/tier/:tier',
      '/learn/grammar/N4?index=1&point=grammar_N4_c': '/learn/grammar/:level',
      '/practice/exam?level=N3': '/practice/exam',
      '/learn/decks/library/42': '/learn/decks/library/:deck_id',
      '/practice/exam/e1/results?attempt=9&question=q2': '/practice/exam/:examId/results',
      // Plan 123: the desk's other places -- Settings' pages, the shelf's
      // decks, a radical page's tiles, the profile's halls and lines.
      '/profile/settings/display': '/profile/settings/:page',
      '/learn/decks/42': '/learn/decks/:deck_id',
      '/learn/decks/library': '/learn/decks/library',
      '/learn/kanji/radical/42': '/learn/kanji/radical/:radical',
    }
    for (const [href, pattern] of Object.entries(links)) {
      const p = routePattern(href)
      expect(p, href).toBe(pattern)
      expect(p, href).not.toMatch(/animaux|katakana|42|grammar_N4|q2|N3|N4|\?/)
    }
  })

  it('treats a trailing slash as the same screen', () => {
    expect(routePattern('/today/')).toBe('/today')
    expect(routePattern('/')).toBe('/')
  })

  it('answers null rather than guessing at an unknown path', () => {
    // An unrecognised path is exactly where returning it raw would leak
    // something. App.jsx drops the event when this is null.
    expect(routePattern('/not/a/route/here')).toBeNull()
    expect(routePattern('')).toBeNull()
    expect(routePattern(null)).toBeNull()
    expect(routePattern(undefined)).toBeNull()
  })
})

describe('ROUTES against App.jsx', () => {
  const app = readFileSync(
    fileURLToPath(new URL('../App.jsx', import.meta.url)),
    'utf-8',
  )
  const declared = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1])

  it('found the routes in App.jsx at all', () => {
    // If the JSX is ever reformatted so `path="…"` no longer sits on
    // the <Route, the test below would pass vacuously and stop being a
    // guard at all.
    expect(declared.length).toBeGreaterThan(40)
  })

  it('has a pattern for every route App.jsx declares', () => {
    // The dev workbench is behind import.meta.env.DEV and tree-shaken
    // out of production, so it is never navigated to by a learner.
    const missing = declared
      .filter(path => !path.startsWith('/dev/'))
      .filter(path => !ROUTES.includes(path))
    expect(missing, `add these to ROUTES in routePattern.js: ${missing.join(', ')}`)
      .toEqual([])
  })

  it('has no pattern App.jsx does not declare', () => {
    // The five sentence sections are generated from SENTENCE_SECTIONS
    // with .flatMap() rather than written as literal path="…", so they
    // have to be named here.
    const generated = new Set([
      '/practice/reading', '/practice/reading/levels', '/practice/reading/tiers', '/practice/reading/cards',
      '/practice/translation', '/practice/translation/levels', '/practice/translation/tiers', '/practice/translation/cards',
      '/practice/comprehension', '/practice/dictation', '/practice/composition',
    ])
    const stale = ROUTES.filter(p => !declared.includes(p) && !generated.has(p))
    expect(stale, `these are in ROUTES but no longer in App.jsx: ${stale.join(', ')}`)
      .toEqual([])
  })

  it('generates the sentence-section routes it claims to', () => {
    // Pins the .flatMap() above: if SENTENCE_SECTIONS changes shape the
    // allowance in the previous test would silently cover a stale list.
    expect(app).toContain('SENTENCE_SECTIONS.flatMap')
    for (const base of ['reading', 'translation', 'comprehension', 'dictation', 'composition']) {
      expect(app).toContain(`/practice/${base}`)
    }
  })
})
