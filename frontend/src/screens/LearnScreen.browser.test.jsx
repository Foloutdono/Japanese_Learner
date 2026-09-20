import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
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
  apiJson.mockImplementation(async url => (url === '/api/decks' ? { decks: [{ id: 1, card_count: 40 }, { id: 2, card_count: 7 }] } : {}))
})

describe('LearnScreen — the plates', () => {
  it('keeps every line reachable: 4 line plates, the shelf as a fifth, no bar over them', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelectorAll('.plate--line')).toHaveLength(4)
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
    // line opens at 初, the novice's stop — so a line nobody has
    // touched stands at 初 with its first stop ahead. vocab has N5
    // finished and N4 half done: standing at N5, N4 ahead, and the
    // stripe half painted.
    const plates = [...root.querySelectorAll('.plate--line')]
    expect(plates.map(p => p.querySelector('.plate__here').textContent)).toEqual(['初', 'N5', '初', '初'])
    expect(plates.map(p => p.querySelector('.plate__next').textContent)).toEqual(['あ ›', 'N4 ›', 'N5 ›', 'N5 ›'])
    expect(plates[1].querySelector('.plate__prev').textContent).toBe('‹ 初')
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

  it('departs to a line through the gate store, announced', async () => {
    const screen = await mount()
    await settle()
    screen.container.querySelector('.plate--line .plate__head').click()
    expect(beginDeparture).toHaveBeenCalledTimes(1)
    expect(beginDeparture.mock.calls[0][0]?.path).toBe('/learn/kana')
    expect(playAnnouncement).toHaveBeenCalledWith('kana')
  })

  it('still hangs every plate from a failed or foreign stats payload', async () => {
    todayRef.current = { total: 0, by_source: {}, lanes: [], next_due: null }
    statsRef.current = { total: 0, by_source: {}, lanes: [], next_due: null }
    apiJson.mockImplementation(async () => { throw new Error('down') })
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelectorAll('.plate--line')).toHaveLength(4)
    // Nobody has travelled, so every line stands at 初: with no figures
    // at all the plate still says where the learner is, which is at
    // the start of every line.
    expect([...root.querySelectorAll('.plate__here')].map(el => el.textContent)).toEqual(['初', '初', '初', '初'])
    expect(root.querySelectorAll('.plate__due')).toHaveLength(0)
    // And the shelf hangs without its figures.
    expect(root.querySelectorAll('.plate--shelf')).toHaveLength(1)
    expect(root.querySelector('.plate--shelf .plate__meta')).toBeNull()
  })
})
