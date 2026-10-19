import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 運転再開 — the comeback notice at the thumb (plan 254) ──────────
// The owner: the comeback sheet that opened over the gate is a notice
// inside the screen. On a phone it is one quiet row in the gate's foot,
// over the run's own as the level-fit row is (plan 224): the legend
// above it untouched, its words whole, its ✕ a thumb's, and the gate
// still over the tab bar -- at the owner's 360×725 too.

vi.mock('../../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } },
}))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn() }))
vi.mock('../../lib/track', () => ({ track: vi.fn(), flush: vi.fn() }))
const lane = (source, deck, mode, due) => ({ id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due })
// A learner back from three weeks away: the backlog on every line.
const LANES = [
  lane('kana', 'hiragana_basic', 'kana.flashcard.f2b', 24),
  lane('vocab', 'N5', 'vocab.flashcard.f2b', 236),
  lane('kanji', 'N5', 'kanji.flashcard.f2b', 98),
  lane('kanji', 'N5', 'kanji.write_kanji', 17),
  lane('grammar', 'N5', 'grammar.ladder', 37),
]
const OWED = LANES.reduce((n, l) => n + l.due, 0)
const OFFER = {
  owed: OWED,
  days_away: 21,
  spread: [{ days: 3, per_day: 154 }, { days: 5, per_day: 102 }, { days: 7, per_day: 77 }],
  default_days: 5,
  gentle: { per_day: 20 },
}
vi.mock('../../stores/today', () => ({
  useTodaySummary: () => ({ data: {
    total: OWED, by_source: {}, lanes: LANES, next_due: null, seconds_per_review: 12,
    pace: { target: 20, newToday: 0 },
    review: { cap: null, held: 0, catchup: null, away: null, comeback: OFFER },
  }, failed: false }),
  refreshToday: vi.fn(), refetchToday: vi.fn(() => Promise.resolve()), seedTodaySummary: vi.fn(),
}))
// Fewer credits than cards, so the shortfall is the dial's legend: the
// tallest legend the gate draws.
vi.mock('../../stores/credits', async o => ({ ...(await o()),
  useCredits: () => ({ balance: 56, cap: 200, dailyRefill: 30, nextCreditAt: null, unlimited: false, enforced: false }),
}))
vi.mock('../../stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  useVolumes: () => ({ data: null }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('../../stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 47, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, jlptLevel: 'N5', streak: 0, week: [], guided: { today: true } }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
vi.mock('../../stores/agenda', () => ({ useAgenda: () => ({ blocks: [], failed: false }), saveAgenda: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell } = await import('../chrome/Shell')
const { default: TodayScreen } = await import('../../screens/TodayScreen')
const { resetComeback } = await import('../../stores/comeback')
const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const rect = sel => document.querySelector(sel).getBoundingClientRect()

beforeEach(() => {
  resetComeback()
  localStorage.removeItem('lang')
})

afterEach(async () => {
  document.scrollingElement.scrollTop = 0
  localStorage.removeItem('lang')
  await page.viewport(390, 844)
})

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <Routes><Route element={<Shell />}><Route path="/today" element={<TodayScreen session={{}} />} /></Route></Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('the comeback notice on a phone', () => {
  for (const [w, h] of [[390, 844], [360, 725]]) {
    it(`stands in the foot over the run's row at ${w}×${h}, the legend and the gate in their places`, async () => {
      await page.viewport(w, h)
      await mount()
      await settle()
      // A notice, never a sheet over the gate.
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      const foot = document.querySelector('.tdy__foot')
      expect(foot.firstElementChild.classList.contains('tdy-cb')).toBe(true)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
      const key = rect('.tdy-key--fare')
      const cb = rect('.tdy-cb')
      const door = rect('.tdy-door')
      const go = rect('.btn-depart--gate')
      const tabs = rect('.tabbar')
      expect(cb.top).toBeGreaterThanOrEqual(key.bottom)
      expect(door.top).toBeGreaterThanOrEqual(cb.bottom)
      expect(go.bottom).toBeLessThanOrEqual(tabs.top)
      // One row as the door is, and its ✕ a thumb's, at its end: 44
      // wide, and pressed from the row's top edge to its foot.
      expect(Math.round(cb.height)).toBe(Math.round(door.height))
      expect(Math.round(cb.width)).toBe(Math.round(door.width))
      const hide = rect('.tdy-cb__hide')
      expect(Math.round(hide.width)).toBeGreaterThanOrEqual(44)
      expect(Math.round(cb.height)).toBeGreaterThanOrEqual(44)
      const mid = hide.left + hide.width / 2
      for (const y of [cb.top + 0.5, cb.bottom - 0.5]) {
        expect(document.elementFromPoint(mid, y)?.closest('.tdy-cb__hide')).not.toBeNull()
      }
      expect(Math.round(cb.right - hide.right)).toBeLessThanOrEqual(1)
      // Its words whole, the way on beside them.
      const what = document.querySelector('.tdy-cb .tdy-door__what')
      expect(what.textContent).toBe(`${OWED} cartes accumulées`)
      expect(what.scrollWidth, what.textContent).toBeLessThanOrEqual(what.clientWidth)
      expect(rect('.tdy-cb .tdy-door__what').right).toBeLessThanOrEqual(rect('.tdy-cb .tdy-door__go').left)
      expect(rect('.tdy-cb .tdy-door__go').right).toBeLessThanOrEqual(hide.left)
    })
  }

  it('holds its English words whole at 360×725 too', async () => {
    localStorage.setItem('lang', 'en')
    await page.viewport(360, 725)
    await mount()
    await settle()
    const what = document.querySelector('.tdy-cb .tdy-door__what')
    expect(what.textContent).toBe(`${OWED} cards piled up`)
    expect(what.scrollWidth, what.textContent).toBeLessThanOrEqual(what.clientWidth)
    expect(document.querySelector('.tdy-cb .tdy-door__go').textContent).toBe('Spread out')
  })
})
