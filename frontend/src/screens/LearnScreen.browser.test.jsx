import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The stylesheet-import trick every browser test here uses: the rules
// this test leans on (the map's grid) only exist once the real sheet
// is loaded.
import '../index.css'

// ── The Learn gate (plan 068) ───────────────────────────────────
// The wall map the gate hall used to hang, on its own page behind the
// Learn gate. These pin what the hall's tests pinned about the map:
//
//   1. Every line is reachable — four tracked lines and the shelf of
//      decks. A section silently dropped from the map is a screen you
//      can never visit again.
//   2. The map's arithmetic reaches the DOM: the stops the train has
//      passed are painted, due counts ride as chips — the due figure
//      from the shared today store the tab bar's badge reads.
//   3. A line departs through the gate store, to its route behind the
//      gate, with its announcement.
//   4. A failed or foreign stats payload still draws the full map.

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
  apiJson.mockImplementation(async url => (url === '/api/stats' ? STATS : {}))
})

describe('LearnScreen — the route map', () => {
  it('keeps every line reachable: 4 lines, the decks shelf, one heading', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelectorAll('.wmap-line')).toHaveLength(4)
    expect(root.querySelectorAll('.fac-chip')).toHaveLength(1)
    // The practice register is empty here: those platforms live
    // behind their own gate now.
    expect(root.querySelectorAll('.wmap-row')).toHaveLength(0)
    expect(root.querySelectorAll('h1')).toHaveLength(1)
  })

  it('paints the travelled stops and carries the due chips from the shared store', async () => {
    const screen = await mount()
    await settle()
    const root = screen.container
    // vocab: N5 finished and N4 half done puts the train on N4's
    // platform, so N5 alone is behind it.
    expect(root.querySelectorAll('.wmap-track__stop--past')).toHaveLength(1)
    const chips = [...root.querySelectorAll('.wmap-due')].map(el => el.textContent)
    expect(chips.join(' ')).toContain('12')
    expect(chips.join(' ')).toContain('3')
  })

  it('departs to a line through the gate store, announced', async () => {
    const screen = await mount()
    await settle()
    screen.container.querySelector('.wmap-line').click()
    expect(beginDeparture).toHaveBeenCalledTimes(1)
    expect(beginDeparture.mock.calls[0][0]?.path).toBe('/learn/kana')
    expect(playAnnouncement).toHaveBeenCalledWith('kana')
  })

  it('still draws the whole map from a failed or foreign stats payload', async () => {
    todayRef.current = { total: 0, by_source: {}, lanes: [], next_due: null }
    apiJson.mockImplementation(async () => ({ total: 0, by_source: {}, lanes: [], next_due: null }))
    const screen = await mount()
    await settle()
    const root = screen.container
    expect(root.querySelectorAll('.wmap-line')).toHaveLength(4)
    expect(root.querySelectorAll('.wmap-track__stop--past')).toHaveLength(0)
  })
})
