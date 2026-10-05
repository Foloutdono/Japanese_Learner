import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The novice's stop is a word of the interface now, not the glyph 初,
// so the expected label comes from the string table the lane renders in.
import fr from '../locales/fr/index.js'
// The stylesheet-import trick every browser test here uses: the rules
// this test leans on (the map's grid) only exist once the real sheet
// is loaded.
import '../index.css'

// ── The Learn gate (plan 068; plates since plan 094) ───────────
// One station plate per line behind the Learn gate, the shelf of
// decks as a fifth. These pin what the wall map's tests pinned about
// the map, on the plates that replaced it:
//
//   1. Every line is reachable — four tracked lines and the shelf of
//      decks. A section silently dropped from the gate is a screen you
//      can never visit again.
//   2. The line's arithmetic reaches the DOM: the plate's foot names
//      the stop the learner stands at — the last level FINISHED, the
//      novice's stop until then — with the stop ahead beside it, and
//      the stripe fills with the leg being ridden. Due counts ride as
//      chips, the due figure from the shared today store the tab
//      bar's badge reads.
//   3. A line departs through the gate store, to its route behind the
//      gate, with its announcement.
//   4. A failed or foreign stats payload still hangs every plate.
//   5. The plate prints the name once, in the learner's language: no
//      reading over it and no caption under it (owner's call, from the
//      five directions drawn side by side).

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

const todayRef = { current: null }
vi.mock('../stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
// The distance travelled comes from the shared stats store now (plan
// 071: every station reads it too).
const statsRef = { current: null }
vi.mock('../stores/stats', () => ({
  useStats: () => ({ data: statsRef.current, failed: false }),
  refreshStats: vi.fn(),
  seedStats: vi.fn(),
}))

const playAnnouncement = vi.fn()
vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playAnnouncement: (...a) => playAnnouncement(...a),
}))

const beginDeparture = vi.fn()
vi.mock('../stores/departure', () => ({
  beginDeparture: (...a) => beginDeparture(...a),
}))

// 基礎 (plan 186g): the course's units, for the plate's neighbours.
const basicsRef = { current: null }
vi.mock('../stores/basics', () => ({
  useBasics: () => ({ data: basicsRef.current, failed: false }),
  refreshBasics: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: LearnScreen } = await import('./LearnScreen')
// The lines the learner rides come off the profile summary (a
// module-level cache): seeded per test, and cleared back to "never
// answered" so the plates hang in registry order everywhere else.
const { seedSummary } = await import('../stores/profileSummary')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

const TODAY = {
  total: 24,
  by_source: { kanji: 12, vocab: 8, kana: 4, personal: 3 },
  lanes: [],
  next_due: null,
  pace: null,
}

const STATS = {
  vocab: {
    N5: { 'vocab.flashcard.f2b': { total: 10, new: 0, learning: 0, mastered: 10 } },
    N4: { 'vocab.flashcard.f2b': { total: 10, new: 0, learning: 10, mastered: 0 } },
  },
  kana: {}, kanji: {}, grammar: {},
  items: {
    vocab: {
      N5: { total: 10, learned: 10, score: 1 },
      N4: { total: 10, learned: 0, score: 0.5 },
    },
    kana: {}, kanji: {}, grammar: {},
  },
}

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn']}>
        <LearnScreen session={{ access_token: 'tok' }} />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiJson.mockReset()
  beginDeparture.mockReset()
  playAnnouncement.mockReset()
  todayRef.current = TODAY
  statsRef.current = STATS
  basicsRef.current = null
  apiJson.mockImplementation(async url => (url === '/api/decks' ? { decks: [{ id: 1, card_count: 40 }, { id: 2, card_count: 7 }] } : {}))
})

describe('LearnScreen — the plates', () => {
  it('keeps every line reachable: 4 line plates, the shelf as a fifth, no bar over them', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelectorAll('.plate--line')).toHaveLength(4)
    // Nothing answered: every line is on the route.
    expect(root.querySelectorAll('.plate--off')).toHaveLength(0)
    const shelf = root.querySelectorAll('.plate--shelf')
    expect(shelf).toHaveLength(1)
    // The shelf's figures come from /api/decks; the due chip from the
    // shared today store.
    expect(shelf[0].querySelector('.plate__meta').textContent).toContain('2')
    expect(shelf[0].querySelector('.plate__meta').textContent).toContain('47')
    expect(shelf[0].querySelector('.plate__due').textContent).toContain('3')
    // No bar over the plates (owner's call): the name is the screen's
    // one <h1>, clipped for a screen reader, and nothing prints it.
    expect(root.querySelectorAll('h1')).toHaveLength(1)
    expect(root.querySelector('h1').classList.contains('sr-only')).toBe(true)
    expect(root.querySelector('.bar')).toBeNull()
  })

  it('names the stop reached at the foot, and carries the due chips from the shared store', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    // A station is the completion of the level behind it, and every
    // line opens at the novice's stop — so a line nobody has
    // touched stands there with its first stop ahead. vocab has N5
    // finished and N4 half done: standing at N5, N4 ahead, and the
    // stripe half painted.
    const plates = [...root.querySelectorAll('.plate--line')]
    expect(plates.map(p => p.querySelector('.plate__here').textContent)).toEqual([fr.originStop, 'N5', fr.originStop, fr.originStop])
    expect(plates.map(p => p.querySelector('.plate__next').textContent)).toEqual(['あ ›', 'N4 ›', 'N5 ›', 'N5 ›'])
    expect(plates[1].querySelector('.plate__prev').textContent).toBe(`‹ ${fr.originStop}`)
    expect(plates[0].querySelector('.plate__prev').textContent).toBe('')
    expect(plates[1].querySelector('.plate__stripe i').style.width).toBe('50%')
    expect(plates[0].querySelector('.plate__stripe i').style.width).toBe('0%')
    const chips = [...root.querySelectorAll('.plate__due')].map(el => el.textContent)
    expect(chips.join(' ')).toContain('12')
    expect(chips.join(' ')).toContain('3')
    // grammar has nothing due, so it carries no chip at all.
    expect(plates[3].querySelector('.plate__due')).toBeNull()
  })

  it('prints each name once: no reading, no caption, nothing Japanese but the stops', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    for (const plate of root.querySelectorAll('.plate')) {
      const title = plate.querySelector('.plate__title')
      expect(title.children).toHaveLength(0)
      expect(title.textContent.trim().length).toBeGreaterThan(0)
      // Every Japanese glyph on the plate is a stop name in the foot.
      for (const ja of plate.querySelectorAll('[lang="ja"]')) expect(ja.closest('.plate__foot')).toBeTruthy()
    }
  })

  // ── The lines chosen at the boarding hang first ──
  // A learner riding the kanji alone still has four plates: the kana
  // (on every ticket) and the kanji first, then the vocabulary and the
  // grammar marked off their route -- still plates, still buttons.
  it('hangs the chosen lines first and marks the others off the route, all still reachable', async () => {
    seedSummary({ username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100, lines: ['kanji'] })
    try {
      const screen = await mount()
      await settle()
      const root = screen.container
      const plates = [...root.querySelectorAll('.plate--line')]
      expect(plates).toHaveLength(4)
      expect(plates.map(p => p.querySelector('.plate__title').textContent)).toEqual(['Kana', 'Kanji', 'Vocabulaire JLPT', 'Grammaire'])
      expect(plates.map(p => p.classList.contains('plate--off'))).toEqual([false, false, true, true])
      expect(plates[2].querySelector('.plate__meta').textContent).toBe('Hors de ton trajet')
      expect(plates[0].querySelector('.plate__meta')).toBeNull()
      // Off the route is not off the map: the plate still departs.
      plates[3].querySelector('.plate__head').click()
      await settle(20)
      expect(beginDeparture).toHaveBeenCalledWith(expect.objectContaining({ path: '/learn/grammar' }))
    } finally {
      seedSummary({ username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100 })
    }
  })

  it('departs to a line through the gate store, announced', async () => {
    const screen = await mount()
    await settle()
    screen.container.querySelector('.plate--line .plate__head').click()
    expect(beginDeparture).toHaveBeenCalledTimes(1)
    expect(beginDeparture.mock.calls[0][0]?.path).toBe('/learn/kana')
    expect(playAnnouncement).toHaveBeenCalledWith('kana')
  })

  // ── The plate opens where the learner is ──
  // The station is a stop list, and the learner picks the same stop
  // every day: the plate departs for it directly. The declared grade
  // on a JLPT line, the first unfinished set on かな — the two marks
  // the stop lists themselves ring as "You are here".
  it('departs to the stop the learner stands at: the declared grade, and かな\'s own', async () => {
    seedSummary({ username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100, jlptLevel: 'N4' })
    statsRef.current = {
      ...STATS,
      items: {
        ...STATS.items,
        // Hiragana done, its combinations begun: the second set is
        // where this learner stands (domain/kanaSets.currentKanaSet).
        kana: {
          hiragana_basic: { total: 46, learned: 46, score: 1 },
          hiragana_combos: { total: 36, learned: 5, score: 0.2 },
        },
      },
    }
    try {
      const screen = await mount()
      await settle()
      const heads = [...screen.container.querySelectorAll('.plate--line .plate__head')]
      const paths = []
      for (const head of heads) {
        head.click()
        await settle(20)
        paths.push(beginDeparture.mock.calls.at(-1)[0]?.path)
      }
      expect(paths).toEqual([
        '/learn/kana/hiragana_combos',
        '/learn/vocab/N4',
        '/learn/kanji/N4',
        '/learn/grammar/N4',
      ])
      // The gate still wipes in the LINE's identity — the deeper path
      // is where the train goes, not a different station.
      expect(beginDeparture.mock.calls.at(-1)[0]?.color).toBe('var(--line-grammar)')
      expect(playAnnouncement).toHaveBeenLastCalledWith('grammar')
    } finally {
      seedSummary({ username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100 })
    }
  })

  // Nothing known about the learner yet — no declared grade, no kana
  // figures — and the plate opens the station, as it always did: a
  // guess at the stop would be worse than the question.
  it('opens the station itself when nothing says where the learner stands', async () => {
    const screen = await mount()
    await settle()
    const heads = [...screen.container.querySelectorAll('.plate--line .plate__head')]
    const paths = []
    for (const head of heads) {
      head.click()
      await settle(20)
      paths.push(beginDeparture.mock.calls.at(-1)[0]?.path)
    }
    expect(paths).toEqual(['/learn/kana', '/learn/vocab', '/learn/kanji', '/learn/grammar'])
  })

  // The shelf is not a line: it has no stops, so it opens on the decks.
  it('opens the shelf on the decks themselves', async () => {
    seedSummary({ username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100, jlptLevel: 'N4' })
    try {
      const screen = await mount()
      await settle()
      screen.container.querySelector('.plate--shelf .plate__head').click()
      await settle(20)
      expect(beginDeparture.mock.calls.at(-1)[0]?.path).toBe('/learn/decks')
    } finally {
      seedSummary({ username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100 })
    }
  })

  it('still hangs every plate from a failed or foreign stats payload', async () => {
    todayRef.current = { total: 0, by_source: {}, lanes: [], next_due: null }
    statsRef.current = { total: 0, by_source: {}, lanes: [], next_due: null }
    apiJson.mockImplementation(async () => { throw new Error('down') })
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelectorAll('.plate--line')).toHaveLength(4)
    // Nobody has travelled, so every line stands at the novice's stop: with no figures
    // at all the plate still says where the learner is, which is at
    // the start of every line.
    expect([...root.querySelectorAll('.plate__here')].map(el => el.textContent)).toEqual(Array(4).fill(fr.originStop))
    expect(root.querySelectorAll('.plate__due')).toHaveLength(0)
    // And the shelf hangs without its figures.
    expect(root.querySelectorAll('.plate--shelf')).toHaveLength(1)
    expect(root.querySelector('.plate--shelf .plate__meta')).toBeNull()
  })
})


// ── 案内 — the anchors the guide points at (plan 100) ────────────
describe('LearnScreen — the guide\'s anchors', () => {
  it('marks the first plate, its foot and the shelf', async () => {
    apiJson.mockResolvedValue({ decks: [] })
    const screen = await mount()
    await settle(150)
    const root = screen.container
    expect(root.querySelector('.plate[data-guide="learn.plate"]')).toBeTruthy()
    expect(root.querySelector('[data-guide="learn.plate"] [data-guide="learn.stops"]')).toBeTruthy()
    expect(root.querySelector('.plate--shelf[data-guide="learn.shelf"]')).toBeTruthy()
    expect(root.querySelectorAll('[data-guide="learn.plate"]')).toHaveLength(1)
  })
})

// ── 基礎 — the basics as a plate (plan 186g) ───────────────────────
describe('LearnScreen — the basics', () => {
  const AT = { done: false, unit: 3, of: 14, id: 'kazu', jp: '数', title: { en: 'Numbers', fr: 'Les nombres' } }
  const UNITS = ['はじめまして', 'これ・それ', '数', '〜ます'].map((jp, i) => ({
    unit: i + 1, id: ['hajimemashite', 'kore-sore', 'kazu', 'masu'][i], jp, total: 20, met: i < 2 ? 20 : i === 2 ? 5 : 0, learned: 0,
  }))

  it('hangs above the lines while the course is ridden, and opens the unit at hand', async () => {
    todayRef.current = { ...TODAY, basics: AT }
    basicsRef.current = { riding: true, at: 3, done: false, units: UNITS }
    const screen = await mount()
    await settle()
    const plates = [...screen.container.querySelectorAll('.plates > .plate')]
    expect(plates[0].classList.contains('plate--basics')).toBe(true)
    // Still four lines: the course is no line.
    expect(screen.container.querySelectorAll('.plate--line')).toHaveLength(4)
    const foot = plates[0].querySelector('.plate__foot')
    expect(foot.querySelector('.plate__prev').textContent).toContain('これ・それ')
    expect(foot.querySelector('.plate__here').textContent).toBe('数')
    expect(foot.querySelector('.plate__next').textContent).toContain('〜ます')
    // The stripe: the unit at hand's cards met, five of twenty.
    expect(plates[0].querySelector('.plate__stripe > i').style.width).toBe('25%')
    plates[0].querySelector('.plate__head').click()
    expect(beginDeparture).toHaveBeenCalledWith(expect.objectContaining({ path: '/learn/basics/kazu' }))
  })

  it('hangs nothing above N5, nor once the course is met', async () => {
    todayRef.current = { ...TODAY, basics: null }
    let screen = await mount()
    await settle()
    expect(screen.container.querySelector('.plate--basics')).toBeNull()
    todayRef.current = { ...TODAY, basics: { done: true, of: 14 } }
    screen = await mount()
    await settle()
    expect(screen.container.querySelector('.plate--basics')).toBeNull()
  })
})
