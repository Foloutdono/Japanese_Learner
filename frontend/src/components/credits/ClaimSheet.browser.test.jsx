import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 補充 — while you were away (plan 139) ─────────────────────
// The refill lands a credit every 48 minutes, open app or not, and the
// server holds what landed as `pending`. On arrival the sheet offers it
// -- the figure, the balance it takes them from and to, one button --
// and every way out of the sheet claims. While the app stays open in
// front of the learner, a credit that lands is claimed quietly instead:
// no sheet in the middle of a card for one credit. Coming back after a
// quarter of an hour out of sight is arriving again.

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
}))
const server = vi.hoisted(() => ({ balance: 20, pending: 12, posts: 0 }))
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(async (path, _session, opts = {}) => {
    const summary = () => ({
      balance: server.balance, pending: server.pending, cap: 50, dailyRefill: 30, refillEvery: 2880,
      nextCreditAt: new Date(Date.now() + 40 * 60_000).toISOString(), fullAt: null,
      plan: 'free', unlimited: false, enforced: false,
    })
    const ok = body => ({ ok: true, status: 200, json: async () => body })
    if (path === '/api/credits/claim' && opts.method === 'POST') {
      server.posts += 1
      const claimed = server.pending
      server.balance += claimed
      server.pending = 0
      return ok({ ...summary(), claimed })
    }
    if (path === '/api/credits') return ok(summary())
    return { ok: false, status: 404 }
  }),
}))
vi.mock('../../lib/audio', async o => ({ ...(await o()), playFareTick: vi.fn() }))
// LangContext pulls the content maps over the network on mount.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const credits = await import('../../stores/credits')
const { ClaimSheet } = await import('./ClaimSheet')
const { AWAY_MS } = await import('../../hooks/useRefill')
const { playFareTick } = await import('../../lib/audio')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

function mount({ hold = false, at = '/today' } = {}) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <ClaimSheet hold={hold} />
      </MemoryRouter>
    </LangProvider>
  )
}

let visibility = 'visible'
function setVisibility(state) {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  credits.forgetCredits()
  Object.assign(server, { balance: 20, pending: 12, posts: 0 })
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  vi.mocked(playFareTick).mockClear()
})

describe('ClaimSheet — on arrival', () => {
  it('offers what landed while the app was closed, and the button claims it', async () => {
    await mount()
    await settle()
    const sheet = document.querySelector('.sheet')
    expect(sheet).toBeTruthy()
    expect(sheet.getAttribute('aria-label')).toBe('Pendant ton absence')
    expect(sheet.querySelector('.balance__fig').textContent).toContain('+12')
    expect(sheet.querySelector('.balance__of').textContent).toContain('20 → 32')
    // The 回数券 book: a stub a credit up to the cap -- the twenty held,
    // the twelve that landed, the room left -- read out as one figure.
    const book = sheet.querySelector('.claim-book')
    expect(book.getAttribute('aria-label')).toBe('32 crédits sur 50')
    expect(book.querySelectorAll('.claim-book__stub')).toHaveLength(50)
    expect(book.querySelectorAll('.claim-book__stub--held')).toHaveLength(20)
    expect(book.querySelectorAll('.claim-book__stub--new')).toHaveLength(12)
    expect(book.querySelectorAll('.claim-book__stub--room')).toHaveLength(18)
    // Ten to a row, and the new ones in the pass's full metal.
    const stubs = [...book.children].map(el => el.getBoundingClientRect())
    expect(stubs.filter(r => r.top === stubs[0].top)).toHaveLength(10)
    const gold = getComputedStyle(book.querySelector('.claim-book__stub--new')).backgroundColor
    expect(gold).not.toBe(getComputedStyle(book.querySelector('.claim-book__stub--held')).backgroundColor)
    // Nothing is claimed by being shown.
    expect(server.posts).toBe(0)

    const button = sheet.querySelector('.btn-depart')
    expect(button.textContent).toBe('Récupérer')
    button.click()
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(server.posts).toBe(1)
    expect(credits.peekBalance()).toBe(32)
    expect(credits.peekCredits().pending).toBe(0)
    expect(playFareTick).toHaveBeenCalledTimes(1)
  })

  it('claims on the way out, however the way out is taken', async () => {
    await mount()
    await settle()
    expect(document.querySelector('.sheet')).toBeTruthy()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(server.posts).toBe(1)
    expect(credits.peekBalance()).toBe(32)
  })

  it('opens on nothing when nothing landed', async () => {
    server.pending = 0
    await mount()
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(server.posts).toBe(0)
  })

  it('waits for the hold to let go, then arrives once', async () => {
    const screen = await mount({ hold: true })
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    screen.rerender(
      <LangProvider>
        <MemoryRouter initialEntries={['/today']}>
          <ClaimSheet hold={false} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.sheet')).toBeTruthy()
  })

  it('stays shut on the first ride', async () => {
    await mount({ at: '/ride/cards' })
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(server.posts).toBe(0)
  })
})

describe('ClaimSheet — staying and coming back', () => {
  it('claims a credit that lands while the app is open, quietly', async () => {
    server.pending = 0
    await mount()
    await settle()
    // A credit lands in front of the learner: the next answer carries it.
    server.pending = 1
    await credits.refreshCredits()
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(server.posts).toBe(1)
    expect(credits.peekBalance()).toBe(21)
  })

  it('a glance away is not arriving; a quarter of an hour away is', async () => {
    server.pending = 0
    await mount()
    await settle()
    const t0 = Date.now()
    const now = vi.spyOn(Date, 'now')

    // Out of sight for a minute, and a credit landed: taken quietly.
    now.mockReturnValue(t0)
    setVisibility('hidden')
    server.pending = 1
    now.mockReturnValue(t0 + 60_000)
    setVisibility('visible')
    await credits.refreshCredits()
    await settle()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(server.posts).toBe(1)

    // Out of sight for the quarter hour: the sheet, with what landed.
    now.mockReturnValue(t0 + 120_000)
    setVisibility('hidden')
    server.pending = 5
    now.mockReturnValue(t0 + 120_000 + AWAY_MS)
    setVisibility('visible')
    now.mockRestore()
    await settle()
    const sheet = document.querySelector('.sheet')
    expect(sheet).toBeTruthy()
    expect(sheet.querySelector('.balance__fig').textContent).toContain('+5')
    expect(server.posts).toBe(1)
  })
})
