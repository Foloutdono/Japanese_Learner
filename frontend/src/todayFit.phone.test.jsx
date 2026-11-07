import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 改札 — the gate never leaves the screen (owner-directed) ──────
// Plan 166 stood Depart at the foot of the phone's Today with the air
// over it giving way first, and nothing else giving way: a full day --
// the pass strip, the agenda's next block, the basics, the line mix and
// a shortfall over the gate -- put it under the tab bar, 117px under it
// at 360×725 (the owner's phone). The foot docks on the tab bar since.
// Plan 199 (the day at a glance) moved all of that but the dial and
// its legend into the services sheet: a full day now fits the phone
// whole, the dial over its legend over the row and the gate, and the
// dock is the guard it was should a day ever outgrow it.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } },
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn() }))
const lane = (source, deck, mode, due) => ({ id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due })
const LANES = [
  lane('kana', 'hiragana_basic', 'kana.flashcard.f2b', 3),
  lane('vocab', 'N5', 'vocab.flashcard.f2b', 55),
  lane('kanji', 'N5', 'kanji.flashcard.f2b', 6),
  lane('kanji', 'N5', 'kanji.write_kanji', 1),
  lane('grammar', 'N5', 'grammar.ladder', 15),
]
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: {
    total: 80, by_source: {}, lanes: LANES, next_due: null, seconds_per_review: 15,
    pace: { target: 20, newToday: 0 },
    basics: { id: 'u2', unit: 2, of: 14, title: { fr: 'Ceci et cela', en: 'This and that' } },
  }, failed: false }),
  refreshToday: vi.fn(), refetchToday: vi.fn(() => Promise.resolve()), seedTodaySummary: vi.fn(),
}))
// Fewer credits than cards, so the shortfall is the dial's legend.
vi.mock('./stores/credits', async o => ({ ...(await o()),
  useCredits: () => ({ balance: 56, cap: 200, dailyRefill: 30, nextCreditAt: null, unlimited: false, enforced: false }),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  useVolumes: () => ({ data: null }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 47, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, jlptLevel: 'N5', streak: 6, week: [1, 1, 1, 1, 1, 1, 0], guided: { today: true } }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
vi.mock('./stores/agenda', () => ({
  useAgenda: () => ({ blocks: [{ id: 1, subject: 'kanji', days: [0, 1, 2, 3, 4, 5, 6], start: 540, end: 600, notify: true, lead: 10 }], failed: false }),
  saveAgenda: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell } = await import('./components/chrome/Shell')
const { default: TodayScreen } = await import('./screens/TodayScreen')
const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const rect = sel => document.querySelector(sel).getBoundingClientRect()

afterEach(async () => {
  document.scrollingElement.scrollTop = 0
  await page.viewport(390, 844)
})

describe('the gate on a full day', () => {
  for (const [w, h] of [[390, 844], [360, 725]]) {
    it(`fits the day whole at ${w}×${h}: the dial, its legend, the row and the gate over the tab bar`, async () => {
      await page.viewport(w, h)
      await render(
        <LangProvider>
          <MemoryRouter initialEntries={['/today']}>
            <Routes><Route element={<Shell />}><Route path="/today" element={<TodayScreen session={{}} />} /></Route></Routes>
          </MemoryRouter>
        </LangProvider>
      )
      await settle()
      // The shortfall is said under the dial, in its legend.
      expect(document.querySelector('.tdy-key--fare')).not.toBeNull()
      // At a glance: nothing under the fold, nothing wider than the phone.
      expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
      const hud = rect('.hud')
      // The dial by its rings: on the print (plan 205) its box is the
      // disc's glow, which runs under the HUD with the sky on a short
      // phone.
      const dial = rect('.tdy-dial__gate')
      const key = rect('.tdy-key--fare')
      const door = rect('.tdy-door')
      const go = rect('.btn-depart--gate')
      const tabs = rect('.tabbar')
      expect(dial.top).toBeGreaterThan(hud.bottom)
      expect(key.top).toBeGreaterThanOrEqual(dial.bottom)
      expect(door.top).toBeGreaterThanOrEqual(key.bottom)
      expect(go.top).toBeGreaterThanOrEqual(door.bottom)
      expect(go.bottom).toBeLessThanOrEqual(tabs.top)
      // The duels' key (plan 287) stands beside the gate, a square at
      // its height, inside the phone, and leaves the gate its word.
      const duels = rect('.pvp-key')
      expect(Math.round(duels.top)).toBe(Math.round(go.top))
      expect(Math.round(duels.height)).toBe(Math.round(go.height))
      expect(duels.left).toBeGreaterThan(go.right)
      expect(duels.right).toBeLessThanOrEqual(window.innerWidth)
      expect(rect('.btn-depart--gate .btn-depart__jp').left).toBeGreaterThan(rect('.btn-depart--gate .btn-depart__reader').right)
      // The row is a thumb's. Read to the pixel: a rect's edges are
      // float32 in the layout, so a row at a fractional top near 600px
      // reads 44 - 2^-14 tall (it failed CI so at 360×725).
      expect(Math.round(door.height)).toBeGreaterThanOrEqual(44)
    })
  }
})
