import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import fr from '../locales/fr/index.js'
import { modeLabel } from '../domain/studyModes'
// The stylesheet-import trick every browser test here uses: the rules
// this test leans on only exist once the real sheet is loaded.
import '../index.css'

// ── The Learn gate on a phone (plan 068; plates since 094; folded since 291) ──
// The browser lane has no viewport of its own (an iframe about 414px
// wide), so this is the phone's gate: the lines folded one row each,
// the last ride over them, the decks under them, and the sheet a line
// raises. These pin:
//
//   1. Every line is reachable -- four tracked lines -- and the decks
//      fold under them. A section silently dropped from the gate is a
//      screen you can never visit again.
//   2. A fold names the stop the plate opens and that stop's figure,
//      and its stripe is painted to the stop's share. Due counts ride
//      as chips, from the shared today store the tab bar's badge reads.
//   3. A fold raises the line's sheet, opened on that line's page at
//      the learner's stop, in the learner's main mode; a stop and a mode
//      are chosen there, and Embarquer boards them -- and keeps the ride
//      as the last one.
//   4. The last ride waits over the lines and boards in one tap.
//   5. A failed or foreign stats payload still hangs every plate.
//   6. The plate prints the name once, in the learner's language.

const apiJson = vi.fn()
const apiFetch = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
// cachedJson (grammar's points per level) goes through apiJson too.
vi.mock('../lib/cachedJson', async (importOriginal) => ({
  ...(await importOriginal()),
  cachedJson: (...a) => apiJson(...a),
}))

const todayRef = { current: null }
vi.mock('../stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
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
// The doors: a boarding runs its commit at once here, so the route it
// goes to can be read off the router.
const board = vi.fn(commit => commit())
vi.mock('../stores/boarding', () => ({
  board: (...a) => board(...a),
}))

// 基礎 (plan 186g): the course's units, for the plate's stripe.
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
// The lines the learner rides, their grade and their last ride come off
// the profile summary (a module-level cache): seeded per test.
const { seedSummary } = await import('../stores/profileSummary')
const BASE = { username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100 }
// The shelf's last answer is kept between visits (plan 292): each test
// starts from none.
const { forgetCachedJson } = await import('../lib/cachedJson')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

const TODAY = {
  total: 24,
  by_source: { kanji: 12, vocab: 8, kana: 4, personal: 3 },
  lanes: [{ kind: 'personal', deck_id: 1, due: 3 }],
  next_due: null,
  pace: null,
}

const STATS = {
  vocab: {}, kana: {}, kanji: {}, grammar: {},
  items: {
    vocab: {
      N5: { total: 10, learned: 10, score: 1 },
      N4: { total: 10, learned: 4, score: 0.5 },
    },
    // Hiragana done, its combinations begun: the second set is where
    // this learner stands (domain/kanaSets.currentKanaSet).
    kana: {
      hiragana_basic: { total: 46, learned: 46, score: 1 },
      hiragana_combos: { total: 36, learned: 5, score: 0.2 },
    },
    kanji: {}, grammar: {},
  },
}

// The stop's own card (/api/station/{line}/samples), for the sheet.
const SAMPLES = {
  vocab: { stops: { N4: { card: { jp: '会議', reading: 'かいぎ', meaning: 'réunion' } }, N5: { card: { jp: '学校', reading: 'がっこう', meaning: 'école' } } } },
}

function Where() {
  const at = useLocation()
  return <p data-where={at.pathname} />
}

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn']}>
        <Routes>
          <Route path="/learn" element={<LearnScreen session={{ access_token: 'tok' }} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

const where = () => document.querySelector('[data-where]')?.dataset.where ?? null
const page = () => document.querySelector('.lrn-page:not([inert])')

beforeEach(() => {
  forgetCachedJson()
  apiJson.mockReset()
  apiFetch.mockReset()
  beginDeparture.mockReset()
  playAnnouncement.mockReset()
  board.mockClear()
  todayRef.current = TODAY
  statsRef.current = STATS
  basicsRef.current = null
  seedSummary({ ...BASE, jlptLevel: 'N4' })
  apiJson.mockImplementation(async url => {
    if (url === '/api/decks') return { decks: [{ id: 1, name: 'Frieren', card_count: 40 }, { id: 2, name: 'Cuisine', card_count: 7 }] }
    return {}
  })
  apiFetch.mockImplementation(async path => {
    const line = /\/api\/station\/(\w+)\/samples/.exec(path)?.[1]
    if (line && SAMPLES[line]) return { ok: true, status: 200, json: async () => SAMPLES[line] }
    if (path === '/api/profile/modes') return { ok: true, status: 200, json: async () => ({ main: { vocab: 'vocab.flashcard.b2f' } }) }
    return { ok: true, status: 200, json: async () => ({}) }
  })
})

describe('LearnScreen — the folded plates', () => {
  it('keeps every line reachable, folds the decks under them, and prints no bar', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelectorAll('.plate--line.plate--fold')).toHaveLength(4)
    // Nothing answered about the lines: every line is on the route.
    expect(root.querySelectorAll('.plate--off')).toHaveLength(0)
    // The decks: each its own fold, its cards under its name, the due
    // from today's personal lanes.
    const decks = [...root.querySelectorAll('.lrn-shelf .plate--deck')]
    expect(decks.map(d => d.querySelector('.plate__title').textContent)).toEqual(['Frieren', 'Cuisine'])
    expect(decks[0].querySelector('.plate__meta').textContent).toBe(fr.cardsCount(40))
    expect(decks[0].querySelector('.plate__due').textContent).toContain('3')
    expect(decks[1].querySelector('.plate__due')).toBeNull()
    // No bar over the plates (owner's call): the name is the screen's
    // one <h1>, clipped for a screen reader, and nothing prints it.
    expect(root.querySelectorAll('h1')).toHaveLength(1)
    expect(root.querySelector('h1').classList.contains('sr-only')).toBe(true)
    expect(root.querySelector('.bar')).toBeNull()
    // Folded, a plate has no foot.
    expect(root.querySelector('.plate--line .plate__foot')).toBeNull()
  })

  it('names the stop each plate opens and its figure, and paints the stripe to its share', async () => {
    const screen = await mount()
    await settle()
    const plates = [...screen.container.querySelectorAll('.plate--line')]
    expect(plates.map(p => p.querySelector('.lrn-record__stop').textContent)).toEqual(['きゃ', 'N4', 'N4', 'N4'])
    expect(plates[0].querySelector('.plate__meta').textContent).toBe('きゃ · 5 / 36')
    expect(plates[1].querySelector('.plate__meta').textContent).toBe('N4 · 4 / 10')
    // A stop with no figure yet says the stop alone.
    expect(plates[2].querySelector('.plate__meta').textContent).toBe('N4')
    expect(plates[1].querySelector('.plate__stripe i').style.width).toBe('50%')
    expect(plates[0].querySelector('.plate__stripe i').style.width).toBe('20%')
    const chips = [...screen.container.querySelectorAll('.plate--line .plate__due')].map(el => el.textContent)
    expect(chips.join(' ')).toContain('12')
    // grammar has nothing due, so it carries no chip at all.
    expect(plates[3].querySelector('.plate__due')).toBeNull()
  })

  it('prints each name once: the only Japanese on a line is its stop', async () => {
    const screen = await mount()
    await settle()
    for (const plate of screen.container.querySelectorAll('.plate--line')) {
      const title = plate.querySelector('.plate__title')
      expect(title.children).toHaveLength(0)
      expect(title.textContent.trim().length).toBeGreaterThan(0)
      for (const ja of plate.querySelectorAll('[lang="ja"]')) expect(ja.closest('.lrn-record')).toBeTruthy()
    }
  })

  // ── The lines chosen at the boarding hang first ──
  it('hangs the chosen lines first and marks the others off the route, all still reachable', async () => {
    seedSummary({ ...BASE, jlptLevel: 'N4', lines: ['kanji'] })
    const screen = await mount()
    await settle()
    const plates = [...screen.container.querySelectorAll('.plate--line')]
    expect(plates.map(p => p.querySelector('.plate__title').textContent)).toEqual(['Kana', 'Kanji', 'Vocabulaire JLPT', 'Grammaire'])
    expect(plates.map(p => p.classList.contains('plate--off'))).toEqual([false, false, true, true])
    expect(plates[2].querySelector('.plate__meta').textContent).toBe(fr.plateOffRoute)
    // Off the route is not off the map: the plate still raises its line.
    plates[3].querySelector('.plate__head').click()
    await settle()
    expect(page().getAttribute('aria-label')).toBe('Grammaire')
  })

  it('still hangs every plate from a failed or foreign stats payload', async () => {
    todayRef.current = { total: 0, by_source: {}, lanes: [], next_due: null }
    statsRef.current = { total: 0, by_source: {}, lanes: [], next_due: null }
    apiJson.mockImplementation(async () => { throw new Error('down') })
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelectorAll('.plate--line')).toHaveLength(4)
    expect(root.querySelectorAll('.plate__due')).toHaveLength(0)
    // No kana figures, so no kana stop yet; the declared grade still
    // names the other three.
    expect(root.querySelectorAll('.lrn-record__stop')).toHaveLength(3)
    // And the shelf hangs with its doors and no decks.
    expect(root.querySelectorAll('.plate--deck')).toHaveLength(0)
    expect(root.querySelectorAll('.lrn-shelf__door')).toHaveLength(2)
  })
})

describe('LearnScreen — the sheet a line raises', () => {
  it('opens on the line tapped, at the learner\'s stop, in their main mode, and boards it', async () => {
    const screen = await mount()
    await settle()
    screen.container.querySelectorAll('.plate--line .plate__head')[1].click()
    await settle(300)
    expect(document.querySelector('.lrn-sheet')).toBeTruthy()
    expect(page().getAttribute('aria-label')).toBe('Vocabulaire JLPT')
    // The head is the plate risen: its name, the stop and its figure.
    expect(page().querySelector('.prc-page__meta').textContent).toBe('N4 · 4 / 10')
    // The line: every stop a ring, the learner's ringed, the chosen one
    // pressed -- here the same one.
    const stops = [...page().querySelectorAll('.lrn-stop')]
    expect(stops.map(s => s.querySelector('.lrn-stop__name').textContent)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
    expect(stops[1].getAttribute('aria-current')).toBe('location')
    expect(stops.map(s => s.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false', 'false'])
    expect(stops[0].classList.contains('lrn-stop--done')).toBe(true)
    // The main mode is chosen (plan 273), and the card is the stop's own
    // in that mode: the meaning asked, the word answered.
    const on = page().querySelector('.lrn-page__mode.chip--on')
    expect(on.textContent).toBe(modeLabel(fr, 'vocab.flashcard.b2f'))
    expect(page().querySelector('.lrn-card__q').textContent).toBe('réunion')
    expect(page().querySelector('.lrn-card__a').textContent).toBe('会議')
    // Embarquer names the stop and boards it, through the doors.
    const go = page().querySelector('.prc-page__go')
    expect(go.textContent).toBe(`${fr.depart} · N4`)
    go.click()
    await settle()
    expect(board).toHaveBeenCalledTimes(1)
    expect(where()).toBe('/learn/vocab/N4/vocab.flashcard.b2f')
    // ... and the ride is kept as the last one, on the account.
    expect(apiFetch).toHaveBeenCalledWith('/api/profile/ride', expect.anything(), expect.objectContaining({
      method: 'POST', body: JSON.stringify({ path: '/learn/vocab/N4/vocab.flashcard.b2f' }),
    }))
  })

  it('boards another stop and another mode: chosen first, then Embarquer', async () => {
    const screen = await mount()
    await settle()
    screen.container.querySelectorAll('.plate--line .plate__head')[1].click()
    await settle(300)
    const n5 = [...page().querySelectorAll('.lrn-stop')][0]
    n5.click()
    await settle()
    expect(n5.getAttribute('aria-pressed')).toBe('true')
    expect(page().querySelector('.prc-page__meta').textContent).toBe('N5 · 10 / 10')
    expect(page().querySelector('.lrn-card__q').textContent).toBe('école')
    const first = page().querySelectorAll('.lrn-page__mode')[0]
    first.click()
    await settle()
    expect(first.getAttribute('aria-pressed')).toBe('true')
    // Nothing boarded yet: a choice is a choice.
    expect(board).not.toHaveBeenCalled()
    page().querySelector('.prc-page__go').click()
    await settle()
    expect(where()).toBe('/learn/vocab/N5/vocab.flashcard.f2b')
  })

  it('keeps the line\'s other sources one tap from the sheet', async () => {
    const screen = await mount()
    await settle()
    screen.container.querySelectorAll('.plate--line .plate__head')[1].click()
    await settle(300)
    const doors = [...page().querySelectorAll('.lrn-page__door')]
    expect(doors.map(d => d.textContent)).toEqual([`${fr.byThemeShort} ›`, `${fr.byFrequencyShort} ›`])
    doors[0].click()
    await settle()
    expect(beginDeparture).toHaveBeenCalledWith(expect.objectContaining({ path: '/learn/vocab/themes' }))
    expect(playAnnouncement).toHaveBeenLastCalledWith('vocab')
  })

  it('opens kana on its first unfinished set, and the fast review boards with no doors', async () => {
    const screen = await mount()
    await settle()
    screen.container.querySelector('.plate--line .plate__head').click()
    await settle(300)
    expect(page().getAttribute('aria-label')).toBe('Kana')
    const pressed = page().querySelector('.lrn-stop[aria-pressed="true"]')
    expect(pressed.textContent).toContain('きゃ')
    const modes = [...page().querySelectorAll('.lrn-page__mode')]
    modes.at(-1).click()
    await settle()
    page().querySelector('.prc-page__go').click()
    await settle()
    expect(board).not.toHaveBeenCalled()
    expect(where()).toBe('/learn/kana/hiragana_combos/fast_review')
    // A browse is no ride: nothing is kept.
    expect(apiFetch).not.toHaveBeenCalledWith('/api/profile/ride', expect.anything(), expect.anything())
  })
})

describe('LearnScreen — the last ride', () => {
  it('waits over the lines and boards in one tap', async () => {
    seedSummary({ ...BASE, jlptLevel: 'N4', learnRide: { path: '/learn/kanji/N5/kanji.readings', at: new Date().toISOString() } })
    const screen = await mount()
    await settle()
    const resume = screen.container.querySelector('.prc-resume')
    expect(resume.querySelector('.prc-resume__title').textContent).toBe('Kanji · N5')
    expect(resume.querySelector('.prc-resume__sub').textContent).toContain('Lectures')
    expect(resume.querySelector('.prc-resume__go').textContent).toBe(fr.practiceResume)
    resume.click()
    await settle()
    expect(board).toHaveBeenCalledTimes(1)
    expect(where()).toBe('/learn/kanji/N5/kanji.readings')
  })

  it('offers nothing without one, nor for a path that is no ride', async () => {
    let screen = await mount()
    await settle()
    expect(screen.container.querySelector('.prc-resume')).toBeNull()
    seedSummary({ ...BASE, jlptLevel: 'N4', learnRide: { path: '/learn/vocab/theme/food/vocab.flashcard.f2b', at: null } })
    screen = await mount()
    await settle()
    expect(screen.container.querySelector('.prc-resume')).toBeNull()
  })
})

// ── 案内 — the anchors the guide points at (plan 100) ────────────
describe('LearnScreen — the guide\'s anchors', () => {
  it('marks the first plate, its stop and the shelf', async () => {
    apiJson.mockResolvedValue({ decks: [] })
    const screen = await mount()
    await settle(150)
    const root = screen.container
    expect(root.querySelector('.plate[data-guide="learn.plate"]')).toBeTruthy()
    expect(root.querySelector('[data-guide="learn.plate"] [data-guide="learn.stops"]')).toBeTruthy()
    expect(root.querySelector('.lrn-shelf[data-guide="learn.shelf"]')).toBeTruthy()
    expect(root.querySelectorAll('[data-guide="learn.plate"]')).toHaveLength(1)
  })
})

// ── 基礎 — the basics as a plate (plan 186g) ───────────────────────
describe('LearnScreen — the basics', () => {
  const AT = { done: false, unit: 3, of: 14, id: 'kazu', jp: '数', title: { en: 'Numbers', fr: 'Les nombres' } }
  const UNITS = ['はじめまして', 'これ・それ', '数', '〜ます'].map((jp, i) => ({
    unit: i + 1, id: ['hajimemashite', 'kore-sore', 'kazu', 'masu'][i], jp, total: 20, met: i < 2 ? 20 : i === 2 ? 5 : 0, learned: 0,
  }))

  it('hangs above the lines, folded, while the course is ridden, and opens the unit at hand', async () => {
    todayRef.current = { ...TODAY, basics: AT }
    basicsRef.current = { riding: true, at: 3, done: false, units: UNITS }
    const screen = await mount()
    await settle()
    const plates = [...screen.container.querySelectorAll('.lrn-folds > .plate')]
    expect(plates[0].classList.contains('plate--basics')).toBe(true)
    expect(plates[0].classList.contains('plate--fold')).toBe(true)
    // Still four lines: the course is no line.
    expect(screen.container.querySelectorAll('.plate--line')).toHaveLength(4)
    expect(plates[0].querySelector('.plate__meta').textContent).toBe(`${fr.basicsUnit(3, 14)} · 数`)
    expect(plates[0].querySelector('.plate__foot')).toBeNull()
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
