import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

vi.mock('../lib/audio', async (o) => ({
  ...(await o()),
  playUi: vi.fn(),
  playClick: vi.fn(),
  playAnnouncement: vi.fn(),
  startAmbiance: vi.fn(),
  stopAmbiance: vi.fn(),
}))
// The two stores under a route stop (stats, the profile summary) both
// fail quiet, so a station draws with no figures rather than not at
// all — which is all these tests need, and it keeps the fixture to
// the routing question they are actually about.
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))

const { default: KanjiScreen } = await import('./KanjiScreen')
const { default: VocabScreen } = await import('./VocabScreen')
// The browser lane runs at locale fr-FR (see vite.config.js), so read
// the labels from the French table rather than hard-coding them: this
// is about which sources a station offers and where each one goes,
// not about how any of them is worded.
const { default: fr } = await import('../locales/fr/index.js')

// ── 出発案内 — a source is a platform card, not a bar link ───────
// Vocabulary and kanji are each ordered along more than one axis —
// the JLPT grades, raw frequency, and (for vocabulary) subject — and
// until this change two of those three lived as `.bar__link`s in the
// bar's aside, in eight-point capitals beside the title, with the
// third not offered at all because it was whatever you happened to be
// looking at. Reading practice had asked the same question properly
// for a plan already (screens/SentenceStation.jsx): a source page of
// platform cards, then that source's own list.
//
// What this pins is the shape, because the shape is the fix: the
// station root IS the sources, every source has a card, no source
// hides in the chrome, and each card lands on its own list — which is
// also what keeps `/learn/<line>/levels` from being read as a stop
// called "levels" by the `:level` route beside it.

// The station's routes, as App.jsx spells them out. The params matter:
// a wildcard would leave useParams empty and every screen would think
// it was at its own root.
const KANJI = [
  '/learn/kanji',
  '/learn/kanji/levels',
  '/learn/kanji/tiers',
  '/learn/kanji/tier/:tier',
  '/learn/kanji/:level',
]
const VOCAB = [
  '/learn/vocab',
  '/learn/vocab/levels',
  '/learn/vocab/tiers',
  '/learn/vocab/themes',
  '/learn/vocab/tier/:tier',
  '/learn/vocab/theme/:theme/level/:themeLevel',
  '/learn/vocab/theme/:theme',
  '/learn/vocab/:level',
]

function Where() {
  const { pathname, search } = useLocation()
  return <b data-testid="where">{pathname + search}</b>
}

async function station(at) {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          {KANJI.map(path => (
            <Route key={path} path={path} element={<KanjiScreen session={null} />} />
          ))}
          {VOCAB.map(path => (
            <Route key={path} path={path} element={<VocabScreen session={null} />} />
          ))}
          {/* The gate the sources leave to, and anywhere else a run
              would be: this fixture mounts the stations only. */}
          <Route path="*" element={<main id="main-content">elsewhere</main>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </LangProvider>
  )
  // Scoped to this render's own container, and never unmounted: a
  // mount that is torn down takes the next one in the file with it
  // (see WallMap.geometry.browser.test.jsx's note on the third render
  // in a browser test), so the trees are left standing side by side
  // and each helper only ever looks inside its own.
  const all = sel => [...screen.container.querySelectorAll(sel)]
  return {
    where: () => screen.container.querySelector('[data-testid="where"]')?.textContent,
    cards: () => all('.platform-card'),
    titles: () => all('.platform-card__title').map(n => n.textContent),
    stops: () => all('.route-stop'),
    leave: () => screen.container.querySelector('.bar__aside .stage__leave'),
    links: () => all('.bar__link'),
  }
}

let originalFetch
beforeEach(() => {
  originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn(async () => new Response('{}', {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))
})
afterEach(() => { globalThis.fetch = originalFetch })

describe('the station asks for a source first', () => {
  it('kanji: two sources, both as cards, neither in the bar', async () => {
    const s = await station('/learn/kanji')
    expect(s.titles()).toEqual([fr.byLevel, fr.byFrequencyKanji])
    expect(s.links(), 'a source is a platform card now, not a bar link').toHaveLength(0)
    // Every card says where it goes, which is the whole reason the
    // bar link was the wrong home for it.
    expect(s.cards()[1].querySelector('.platform-card__desc').textContent).toBe(fr.byFrequencyKanjiDesc)
  })

  it('vocabulary: three sources, the JLPT one among them', async () => {
    const s = await station('/learn/vocab')
    expect(s.titles()).toEqual([fr.byLevel, fr.byFrequency, fr.byTheme])
    expect(s.links()).toHaveLength(0)
  })

  it('each card opens that source\'s own list', async () => {
    for (const [at, index, to] of [
      ['/learn/kanji', 0, '/learn/kanji/levels'],
      ['/learn/kanji', 1, '/learn/kanji/tiers'],
      ['/learn/vocab', 2, '/learn/vocab/themes'],
    ]) {
      const s = await station(at)
      s.cards()[index].click()
      await expect.poll(s.where).toBe(to)
      }
  })
})

describe('the way back out', () => {
  it('a source list leaves to the sources, not to the other source', async () => {
    for (const at of ['/learn/kanji/levels', '/learn/vocab/themes']) {
      const s = await station(at)
      expect(s.leave().textContent).toBe(fr.leaveSources)
      s.leave().click()
      await expect.poll(s.where).toBe(at.replace(/\/[^/]+$/, ''))
      }
  })

  it('a grade\'s platforms leave to the grades, which is a page now', async () => {
    const s = await station('/learn/kanji/N5')
    expect(s.leave().textContent).toBe(fr.leaveLevels)
    s.leave().click()
    await expect.poll(s.where).toBe('/learn/kanji/levels')
  })
})

describe('the JLPT stops still live one page down', () => {
  it('draws the five grades under /levels', async () => {
    const s = await station('/learn/vocab/levels')
    await expect.poll(() => s.stops().length).toBe(5)
    expect(s.stops().map(n => n.querySelector('.route-stop__code').textContent))
      .toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
    s.stops()[1].click()
    await expect.poll(s.where).toBe('/learn/vocab/N4')
  })

  it('sends a grade that is not one back to the grades', async () => {
    const s = await station('/learn/kanji/N9')
    await expect.poll(s.where).toBe('/learn/kanji/levels')
  })
})
