import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 運転再開 — the comeback sheet (plan 217) ──────────────────────
// A gate whose reviews piled up opens on the paces to take them at:
// spread over a few days (the default, five), gently, or all now --
// each priced by the server. The answer is posted and the gate redrawn;
// shut without one, the sheet stays out of the way for the visit. It
// never stands over the rest-day notice.

const todayRef = { current: null }
const refreshToday = vi.fn(async () => {})
vi.mock('../../stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: (...a) => refreshToday(...a),
  refetchToday: vi.fn(() => Promise.resolve()),
  seedTodaySummary: vi.fn(),
}))
vi.mock('../../stores/profileSummary', async (o) => ({ ...(await o()),
  useProfileSummary: () => ({ username: 'Aiko', week: [], streak: 3, level: 12 }),
  refreshSummary: vi.fn(async () => {}),
}))
const apiJson = vi.fn(async () => ({}))
vi.mock('../../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'u1' } } } }) } },
}))
const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a), flush: vi.fn() }))
vi.mock('../../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 30, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('../../stores/departure', () => ({ beginDeparture: vi.fn(), useDeparture: () => null }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playAnnouncement: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayScreen } = await import('../../screens/TodayScreen')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

const OFFER = {
  owed: 112,
  days_away: 6,
  spread: [{ days: 3, per_day: 38 }, { days: 5, per_day: 23 }, { days: 7, per_day: 16 }],
  default_days: 5,
  gentle: { per_day: 20 },
}

function today(over = {}) {
  return {
    total: 112, fare: 112, seconds_per_review: 10,
    lanes: [{ id: 's~vocab~N5~vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 112, new: 0 }],
    by_source: { vocab: 112 }, next_due: null, pace: null, basics: null,
    day_clear: { done: false, preview: { streak: 4, bonus: 45, jackpot: 0, milestone: null } },
    rest: { held: 0, unseen: [], streak: 3, next_at: 7 },
    review: { cap: null, held: 0, catchup: null, away: null, comeback: OFFER },
    ...over,
  }
}

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <Routes>
          <Route path="/today" element={<TodayScreen session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('the comeback sheet', () => {
  beforeEach(() => {
    apiJson.mockClear()
    refreshToday.mockClear()
    track.mockClear()
    todayRef.current = today()
  })

  it('opens on the three paces, a spread over five days lit, each priced by the server', async () => {
    mount()
    await settle()
    const dialog = $('[role="dialog"].cb-sheet')
    expect(dialog).not.toBeNull()
    expect($$('.cb-sheet .svc').map(b => b.dataset.choice)).toEqual(['spread', 'gentle', 'all'])
    expect($('.cb-sheet .svc--on').dataset.choice).toBe('spread')
    // The server's prices, never a figure the sheet worked out.
    expect($('.cb-sheet [data-choice="spread"]').textContent).toContain('23')
    expect($('.cb-sheet [data-choice="gentle"]').textContent).toContain('20')
    expect($('.cb-sheet [data-choice="all"]').textContent).toContain('112')
    expect($$('.cb-sheet .seg__opt').map(o => o.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(track).toHaveBeenCalledWith('catchup_offer', { owed: 112, away: 6 })
  })

  it('posts a spread over the days picked, then redraws the gate', async () => {
    mount()
    await settle()
    await userEvent.click($$('.cb-sheet .seg__opt')[0])
    expect($('.cb-sheet [data-choice="spread"]').textContent).toContain('38')
    await userEvent.click($('[data-action="catchup-go"]'))
    await settle()
    expect(apiJson).toHaveBeenCalledWith('/api/review-plan/catchup', expect.anything(),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ choice: 'spread', days: 3 }) }))
    expect(refreshToday).toHaveBeenCalled()
    expect($('.cb-sheet')).toBeNull()
  })

  it('asks no days of gently or all now, and says the new cards wait only when they do', async () => {
    mount()
    await settle()
    await userEvent.click($('.cb-sheet [data-choice="all"]'))
    expect($('.cb-sheet .seg')).toBeNull()
    expect($$('.cb-sheet .slip__hint').length).toBe(1)
    await userEvent.click($('.cb-sheet [data-choice="gentle"]'))
    expect($$('.cb-sheet .slip__hint').length).toBe(2)
    await userEvent.click($('[data-action="catchup-go"]'))
    await settle()
    expect(apiJson).toHaveBeenCalledWith('/api/review-plan/catchup', expect.anything(),
      expect.objectContaining({ body: JSON.stringify({ choice: 'gentle' }) }))
  })

  it('stands aside for the rest-day notice', async () => {
    todayRef.current = today({ rest: { held: 0, unseen: ['2026-10-15'], streak: 3, next_at: 7 } })
    mount()
    await settle()
    expect($('.cb-sheet')).toBeNull()
  })

  // Last: the shut is the visit's, and outlives the test.
  it('shut without an answer, keeps out of the way for the visit', async () => {
    const view = await mount()
    await settle()
    await userEvent.keyboard('{Escape}')
    await settle()
    expect($('.cb-sheet')).toBeNull()
    expect(apiJson).not.toHaveBeenCalledWith('/api/review-plan/catchup', expect.anything(), expect.anything())
    view.unmount()
    mount()
    await settle()
    expect($('.cb-sheet')).toBeNull()
  })
})
