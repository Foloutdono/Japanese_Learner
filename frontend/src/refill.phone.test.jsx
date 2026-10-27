import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 補充 — while you were away, on a phone (plans 141, 276) ────────
// The owner's pick C2: the card drops out from under the HUD's strip and
// hangs below it, at the strip's right edge, as drawn -- 240 wide on a
// 390 phone -- the strip its empty pocket meanwhile, and goes back into
// it. Nothing is dimmed and nothing waits: a tap on the card lands on
// the screen under it.

const server = vi.hoisted(() => ({ balance: 20, pending: 12 }))
vi.mock('./lib/api', () => {
  const summary = () => ({
    balance: server.balance, pending: server.pending, cap: 50, dailyRefill: 30, refillEvery: 2880,
    nextCreditAt: new Date(Date.now() + 40 * 60_000).toISOString(), fullAt: null,
    plan: 'free', unlimited: false, enforced: false,
  })
  return {
    api: p => p,
    apiFetch: vi.fn(async (path, _session, opts = {}) => {
      let body = {}
      if (path === '/api/credits/claim' && opts.method === 'POST') {
        const claimed = server.pending
        server.balance += claimed
        server.pending = 0
        body = { ...summary(), claimed }
      } else if (path === '/api/credits') body = summary()
      return { ok: true, status: 200, json: async () => body }
    }),
    apiJson: vi.fn(async () => ({})),
    apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
    ApiError: class extends Error {},
  }
})
vi.mock('./lib/supabase', () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } },
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, username: 'Aiko', streak: 3 }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 24, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playFareTick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const credits = await import('./stores/credits')
const { Shell } = await import('./components/chrome/Shell')
const { RefillMoment } = await import('./components/credits/RefillMoment')
const { REFILL_MS } = await import('./components/credits/refill')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/today" element={<main id="main-content"><button type="button" className="under">Depart</button></main>} />
          </Route>
        </Routes>
        <RefillMoment />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  credits.forgetCredits()
  Object.assign(server, { balance: 20, pending: 12 })
})

describe('the refill on a phone', () => {
  it('hangs the card under the strip, at its right edge, and puts it back', async () => {
    await mount()
    await settle(1000)
    expect(document.documentElement.dataset.chrome).toBe('shell')
    const strip = document.querySelector('.hud .hstrip')
    const hang = strip.querySelector('.refill-hang')
    expect(hang).toBeTruthy()
    // The strip is the empty pocket, over the whole of it.
    const pocket = strip.querySelector('.hstrip__pocket').getBoundingClientRect()
    const stripBox = strip.getBoundingClientRect()
    expect(pocket.width).toBe(stripBox.width)
    expect(pocket.height).toBe(stripBox.height)
    // Hung: below the strip, flush with its right edge, as drawn, and
    // the whole card on the screen.
    const cardBox = hang.querySelector('.pcard').getBoundingClientRect()
    expect(Math.round(cardBox.width)).toBe(240)
    expect(Math.abs(cardBox.right - stripBox.right)).toBeLessThanOrEqual(1)
    expect(cardBox.top).toBeGreaterThanOrEqual(stripBox.bottom)
    expect(cardBox.left).toBeGreaterThanOrEqual(0)
    expect(cardBox.bottom).toBeLessThan(window.innerHeight / 2)
    // A tap where the card hangs is the screen's.
    const x = cardBox.left + cardBox.width / 2
    const y = cardBox.top + cardBox.height / 2
    expect(document.elementFromPoint(x, y)?.closest('.refill-hang')).toBeNull()

    await settle(REFILL_MS - 1000 + 250)
    expect(strip.querySelector('.refill-hang')).toBeNull()
    expect(strip.querySelector('.hstrip__pocket')).toBeNull()
    expect(strip.querySelector('.hstrip__fig b').textContent).toBe('32')
    expect(credits.peekBalance()).toBe(32)
  })
})
