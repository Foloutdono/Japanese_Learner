import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 補充 — while you were away, on the desk (plans 141, 278) ──────
// On the desk the card lives in its holder at the rail's foot, and that
// is where it is charged (the owner's pick C2): it stands up out of the
// holder's mouth, clear of the case, the balance printed on it counting
// up, and sinks back; the case's figure takes the new balance with a
// glint. Nothing else on the page moves, and nothing hangs from a strip:
// the desk's shell draws none. The balance sheet, a door of the pass,
// keeps its place beside the rail's foot.

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
const { BalanceSheet } = await import('./components/credits/BalanceSheet')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const px = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/today" element={<main id="main-content">here</main>} />
          </Route>
        </Routes>
        <RefillMoment />
        <BalanceSheet />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  credits.forgetCredits()
  credits.closeBalance()
  Object.assign(server, { balance: 20, pending: 12 })
})

describe('the refill on the desk', () => {
  it('stands the card up out of its holder, clear of the case, and sinks it back', async () => {
    await mount()
    await settle(80)
    expect(document.documentElement.dataset.chrome).toBe('shell')
    const holder = document.querySelector('.desk-holder')
    expect(holder.classList.contains('desk-holder--refill')).toBe(true)
    // No sheet, no scrim, no strip to hang from.
    expect(document.querySelector('.sheet')).toBeNull()
    expect(document.querySelector('.refill-hang')).toBeNull()

    // Standing: the whole card above the case, inside the rail, charged.
    await settle(1300)
    const cardBox = holder.querySelector('.desk-holder__card > .pcard').getBoundingClientRect()
    const caseBox = holder.querySelector('.desk-holder__case').getBoundingClientRect()
    const rail = document.querySelector('.desk-rail').getBoundingClientRect()
    expect(cardBox.bottom).toBeLessThanOrEqual(caseBox.top)
    expect(cardBox.bottom).toBeGreaterThan(caseBox.top - px('--sp-3'))
    expect(cardBox.left).toBeGreaterThanOrEqual(rail.left)
    expect(cardBox.right).toBeLessThanOrEqual(rail.right)
    expect(holder.querySelector('.refill-print__fig b').textContent).toBe('32')
    // The case still says what it held until the card is back.
    expect(holder.querySelector('.desk-holder__fig b').textContent).toBe('20')

    // Back in the mouth: claimed, the case's figure moved, with a glint.
    await settle(REFILL_MS - 1380 + 250)
    expect(holder.classList.contains('desk-holder--refill')).toBe(false)
    expect(holder.querySelector('.refill-print')).toBeNull()
    expect(holder.querySelector('.desk-holder__fig b').textContent).toBe('32')
    expect(holder.querySelector('.desk-holder__landed')).toBeTruthy()
    expect(credits.peekBalance()).toBe(32)
  })

  it('leaves the balance sheet where the pass opens it, at the rail\'s foot', async () => {
    server.pending = 0
    await mount()
    await settle()
    expect(document.querySelector('.desk-holder--refill')).toBeNull()
    credits.openBalance()
    await settle()
    const box = document.querySelector('.sheet').getBoundingClientRect()
    expect(box.left).toBe(px('--desk-rail-w') + px('--sp-3'))
    expect(Math.round(window.innerHeight - box.bottom)).toBe(px('--sp-5'))
  })
})
