import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 補充 — while you were away, on the desk (plan 141) ─────────────
// The balance sheet is one of the pass's doors: the rail's pass opens
// it, so it stands beside the rail's foot (plan 127). The claim sheet
// shows the balance too, but nothing on the rail opened it -- it
// arrives on its own over whatever screen the learner came back to --
// and beside the rail's foot it read as misplaced (the owner's word).
// So it takes the window's middle, at a column's width: the 回数券 book
// is drawn for a phone's, a stub a thumb's width across.

const server = vi.hoisted(() => ({ pending: 12 }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => ({
    ok: true, status: 200,
    json: async () => (path === '/api/credits'
      ? { balance: 20, pending: server.pending, cap: 50, dailyRefill: 30, refillEvery: 2880,
          nextCreditAt: new Date(Date.now() + 40 * 60_000).toISOString(), fullAt: null,
          plan: 'free', unlimited: false, enforced: false }
      : {}),
  })),
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
const { ClaimSheet } = await import('./components/credits/ClaimSheet')
const { BalanceSheet } = await import('./components/credits/BalanceSheet')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const px = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
// What a fixed box is laid out in: the window less the scrollbar gutter
// the root keeps stable, which every desk dialog is centred on.
function viewport() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position: fixed; inset: 0'
  document.body.appendChild(probe)
  const box = probe.getBoundingClientRect()
  probe.remove()
  return box
}

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/today" element={<main id="main-content">here</main>} />
          </Route>
        </Routes>
        <ClaimSheet />
        <BalanceSheet />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  credits.forgetCredits()
  credits.closeBalance()
  server.pending = 12
})

describe('the claim sheet on the desk', () => {
  it('opens in the window\'s middle, at a column\'s width', async () => {
    await mount()
    await settle()
    expect(document.documentElement.dataset.chrome).toBe('shell')
    const sheet = document.querySelector('.sheet.claim-sheet')
    expect(sheet).toBeTruthy()
    const box = sheet.getBoundingClientRect()
    expect(box.width).toBe(px('--desk-side-w'))
    // Centred both ways, not stood at the rail's foot.
    const view = viewport()
    expect(Math.abs((box.left - view.left) - (view.right - box.right))).toBeLessThanOrEqual(1)
    expect(Math.abs((box.top - view.top) - (view.bottom - box.bottom))).toBeLessThanOrEqual(1)
    expect(box.left).toBeGreaterThan(px('--desk-rail-w') + px('--sp-8'))
    // The book keeps its ten stubs a row, a thumb's width each.
    const stubs = [...sheet.querySelectorAll('.claim-book__stub')].map(el => el.getBoundingClientRect())
    expect(stubs).toHaveLength(50)
    expect(stubs.filter(r => r.top === stubs[0].top)).toHaveLength(10)
    expect(stubs[0].width).toBeGreaterThan(20)
    expect(stubs[0].width).toBeLessThan(40)
    // And its one button takes the row.
    const button = sheet.querySelector('.btn-depart').getBoundingClientRect()
    expect(Math.round(button.width)).toBe(Math.round(sheet.querySelector('.claim-book').getBoundingClientRect().width))
  })

  it('leaves the balance sheet where the pass opens it, at the rail\'s foot', async () => {
    server.pending = 0
    await mount()
    await settle()
    expect(document.querySelector('.claim-sheet')).toBeNull()
    credits.openBalance()
    await settle()
    const box = document.querySelector('.sheet').getBoundingClientRect()
    expect(box.left).toBe(px('--desk-rail-w') + px('--sp-3'))
    expect(Math.round(window.innerHeight - box.bottom)).toBe(px('--sp-5'))
  })
})
