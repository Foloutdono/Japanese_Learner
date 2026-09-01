import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
// The stylesheet-import trick every browser test here uses: the rules
// this test leans on (the 560px collapse, the map's grid) only exist
// once the real sheet is loaded.
import '../index.css'

// ── The gate hall (the wall-map redesign) ──────────────────────
// The home screen stopped being a departure board and became the gate
// hall: fare gate, commuter pass, wall map. These tests pin the parts
// with the most ways to fail quietly:
//
//   1. Every destination the board used to list is still reachable —
//      four tracked lines, four practice rows, three facility chips.
//      A section silently dropped from the map is a screen you can
//      never visit again without the burger menu.
//   2. The map's arithmetic reaches the DOM: stops past the halfway
//      mark are painted, due counts ride as chips.
//   3. The gate departs to /today through the same store the rows use.
//   4. A failed or foreign stats payload still draws the full map —
//      the exact shape App.onboarding.browser.test.jsx's generic mock
//      feeds every apiJson call.

const apiJson = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

// The ambiance loop and the announcement clips have no place in a test
// run. Spread importOriginal rather than a bare factory — other modules
// in the import graph pull further names out of lib/audio (see
// ExamResult.generating.browser.test.jsx's note).
const playAnnouncement = vi.fn()
vi.mock('../lib/audio', async (importOriginal) => ({
  ...(await importOriginal()),
  playAnnouncement: (...a) => playAnnouncement(...a),
  startAmbiance: vi.fn(),
  stopAmbiance: vi.fn(),
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

// LangContext fetches /api/translations/{kanji,vocab} on mount — same
// offline stub as the other screen tests.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: HomeScreen } = await import('./HomeScreen')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

const TODAY = {
  total: 24,
  by_source: { kanji: 12, vocab: 8, kana: 4, personal: 3 },
  lanes: [
    { kind: 'section', source: 'kanji', deck: 'N4', mode: 'kanji.write_kanji', due: 12 },
    { kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 8 },
    { kind: 'section', source: 'kana', deck: 'hiragana_basic', mode: 'kana.mcq.reading', due: 4 },
  ],
  next_due: null,
  pace: null,
}

const STATS = {
  vocab: {
    // N5 fully mastered, N4 half learning: two painted stops.
    N5: { 'vocab.flashcard.f2b': { total: 10, new: 0, learning: 0, mastered: 10 } },
    N4: { 'vocab.flashcard.f2b': { total: 10, new: 0, learning: 10, mastered: 0 } },
  },
  kana: {}, kanji: {}, grammar: {},
}

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter>
        <HomeScreen session={{ access_token: 'tok' }} />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiJson.mockReset()
  beginDeparture.mockReset()
  playAnnouncement.mockReset()
})

describe('HomeScreen — the gate hall', () => {
  it('keeps every destination reachable: 4 lines, 4 rows, 3 chips', async () => {
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return TODAY
      if (url === '/api/stats') return STATS
      return {}
    })
    const screen = await mount()
    await settle()

    const root = screen.container
    expect(root.querySelectorAll('.wmap-line')).toHaveLength(4)
    expect(root.querySelectorAll('.wmap-row')).toHaveLength(4)
    expect(root.querySelectorAll('.fac-chip')).toHaveLength(3)
    // The hall keeps the station's one heading.
    expect(root.querySelectorAll('h1')).toHaveLength(1)
  })

  it('paints the travelled stops and carries the due chips', async () => {
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return TODAY
      if (url === '/api/stats') return STATS
      return {}
    })
    const screen = await mount()
    await settle()

    const root = screen.container
    // vocab: N5 (1.0) and N4 (0.5) clear the half-way mark; N3..N1 don't.
    const vocabLine = [...root.querySelectorAll('.wmap-line')]
      .find(el => el.querySelector('.wmap-track'))
    expect(vocabLine).toBeTruthy()
    const painted = root.querySelectorAll('.wmap-track__stop--past')
    expect(painted).toHaveLength(2)

    // The gate leads with the day's number…
    expect(root.querySelector('.gate-card__count').textContent).toBe('24')
    // …and the map repeats it per line/chip: 12+8+4 on lines, 3 on 教材.
    const chips = [...root.querySelectorAll('.wmap-due')].map(el => el.textContent)
    expect(chips.join(' ')).toContain('12')
    expect(chips.join(' ')).toContain('3')
  })

  it('departs to /today through the gate store', async () => {
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return TODAY
      if (url === '/api/stats') return STATS
      return {}
    })
    const screen = await mount()
    await settle()

    screen.container.querySelector('.btn-depart').click()
    expect(playAnnouncement).toHaveBeenCalledWith('today')
    expect(beginDeparture).toHaveBeenCalledTimes(1)
    expect(beginDeparture.mock.calls[0][0]?.path).toBe('/today')
  })

  it('owns up on the notice line when a hall feed fails, and the notice retries', async () => {
    // Diagnosed on production: a session the backend rejects made
    // every feed 401 and the hall rendered identical to an empty
    // account. Quiet stays the manner — gate card out, map empty —
    // but the notice line must admit it, and tapping it must refetch.
    apiJson.mockRejectedValue(new Error('401'))
    const screen = await mount()
    await settle()

    const root = screen.container
    // Both notice hosts (band and footer) carry the admission; the
    // 560px query decides which one is visible.
    expect(root.querySelectorAll('.station__notice-retry')).toHaveLength(2)
    expect(root.querySelector('.gate-card')).toBeNull()
    // The map still draws — every destination stays reachable.
    expect(root.querySelectorAll('.wmap-line')).toHaveLength(4)

    // The feeds come back; the notice is the retry.
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return TODAY
      if (url === '/api/stats') return STATS
      return {}
    })
    root.querySelector('.station__notice-retry').click()
    await settle()

    expect(root.querySelectorAll('.station__notice-retry')).toHaveLength(0)
    expect(root.querySelector('.gate-card__count').textContent).toBe('24')
  })

  it('still draws the whole map from a failed or foreign stats payload', async () => {
    // The onboarding gate test's generic mock hands every apiJson call
    // a today-shaped object; the map must treat that as "no progress",
    // never as a crash.
    apiJson.mockImplementation(async url => {
      if (url === '/api/today') return { total: 0, by_source: {}, lanes: [], next_due: null }
      return { total: 0, by_source: {}, lanes: [], next_due: null }
    })
    const screen = await mount()
    await settle()

    const root = screen.container
    expect(root.querySelectorAll('.wmap-line')).toHaveLength(4)
    expect(root.querySelectorAll('.wmap-track__stop--past')).toHaveLength(0)
    // A cleared queue keeps the gate card, as the strip always did.
    expect(root.querySelector('.gate-card--clear')).toBeTruthy()
    expect(root.querySelector('.btn-depart')).toBeNull()
  })
})
