import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 補充 — while you were away (plans 141, 278) ──────────────
// The refill lands a credit every 48 minutes, open app or not, and the
// server holds what landed as `pending`. On arrival the card is charged
// with it (plan 278, the owner's pick C2): it drops out from under its
// strip, the balance printed on it counting up from what was held to
// what it holds now, and goes back, and the claim is taken as it does --
// the one way out, which always claims. Nothing waits on it. While the
// app stays open in front of the learner, a credit that lands is claimed
// quietly instead: no card in the middle of a card for one credit.
// Coming back after a quarter of an hour out of sight is arriving again.

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
vi.mock('../../lib/audio', async o => ({ ...(await o()), playFareTick: vi.fn(), playClick: vi.fn() }))
const motion = vi.hoisted(() => ({ reduced: false }))
vi.mock('../dayclear/useReducedMotion', () => ({ useReducedMotion: () => motion.reduced }))
// LangContext pulls the content maps over the network on mount.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const credits = await import('../../stores/credits')
const { RefillMoment } = await import('./RefillMoment')
const { HudPass } = await import('../chrome/Hud')
const { REFILL_MS } = await import('./refill')
const { AWAY_MS } = await import('../../hooks/useRefill')
const { playFareTick } = await import('../../lib/audio')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
// The whole moment and a margin for the claim's answer.
const moment = () => settle(REFILL_MS + 250)

function tree({ hold = false, at = '/today' } = {}) {
  return (
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <HudPass onClick={() => {}} />
        <RefillMoment hold={hold} />
      </MemoryRouter>
    </LangProvider>
  )
}
const mount = opts => render(tree(opts))
const card = () => document.querySelector('.refill-hang')
const figure = () => document.querySelector('.refill-print__fig b')?.textContent
const said = () => document.querySelector('[aria-live="polite"]')?.textContent

let visibility = 'visible'
function setVisibility(state) {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  credits.forgetCredits()
  Object.assign(server, { balance: 20, pending: 12, posts: 0 })
  motion.reduced = false
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  vi.mocked(playFareTick).mockClear()
})

describe('RefillMoment — on arrival', () => {
  it('charges the card with what landed, and claims it as the card goes back', async () => {
    await mount()
    await settle(150)
    // Out: the card hung from the strip, the strip its empty pocket,
    // the balance on the card at what was held, the amount on its way.
    expect(card()).toBeTruthy()
    expect(document.querySelector('.hstrip__pocket')).toBeTruthy()
    expect(document.querySelector('.refill-print__plus').textContent).toBe('+12')
    expect(figure()).toBe('20')
    expect(said()).toBe('12 crédits arrivés pendant ton absence · 32 sur 50')
    // It gates nothing: a tap goes through it to the screen.
    expect(getComputedStyle(card()).pointerEvents).toBe('none')
    // Nothing is claimed by being shown.
    expect(server.posts).toBe(0)

    // Counted up, a coin a credit, and the gauge at the share it holds.
    await settle(1300)
    expect(figure()).toBe('32')
    expect(playFareTick).toHaveBeenCalledTimes(12)
    expect(document.querySelector('.refill-print').style.getPropertyValue('--refill-share')).toBe('0.64')
    expect(server.posts).toBe(0)

    // Back in its pocket: claimed, and the balance it came back with
    // glints on the strip's door (a moment after the claim, then gone).
    await settle(REFILL_MS - 1450 + 250)
    expect(card()).toBeNull()
    expect(document.querySelector('.hstrip__pocket')).toBeNull()
    expect(server.posts).toBe(1)
    expect(credits.peekBalance()).toBe(32)
    expect(credits.peekCredits().pending).toBe(0)
    expect(document.querySelector('.hstrip__fig b').textContent).toBe('32')
    expect(document.querySelector('.hstrip__landed')).toBeTruthy()
    await settle(1400)
    expect(document.querySelector('.hstrip__landed')).toBeNull()
  })

  it('counts by more than one past twelve credits, so the coin never buzzes', async () => {
    Object.assign(server, { balance: 2, pending: 30 })
    await mount()
    await settle(1600)
    expect(figure()).toBe('32')
    expect(playFareTick).toHaveBeenCalledTimes(12)
    await moment()
    expect(credits.peekBalance()).toBe(32)
  })

  it('shows the end at once under reduced motion, without the coin', async () => {
    motion.reduced = true
    await mount()
    await settle(150)
    expect(figure()).toBe('32')
    await settle(1300)
    expect(playFareTick).not.toHaveBeenCalled()
    await moment()
    expect(server.posts).toBe(1)
  })

  it('runs on the clock index.css runs its beats on', async () => {
    expect(getComputedStyle(document.documentElement).getPropertyValue('--refill-ms').trim()).toBe(`${REFILL_MS}ms`)
  })

  it('draws nothing when nothing landed', async () => {
    server.pending = 0
    await mount()
    await settle()
    expect(card()).toBeNull()
    expect(server.posts).toBe(0)
  })

  it('waits for the hold to let go, then arrives once', async () => {
    const screen = await mount({ hold: true })
    await settle()
    expect(card()).toBeNull()
    await screen.rerender(tree({ hold: false }))
    await settle()
    expect(card()).toBeTruthy()
    await moment()
    expect(server.posts).toBe(1)
  })

  it('stays back on the first ride', async () => {
    await mount({ at: '/ride/cards' })
    await settle()
    expect(card()).toBeNull()
    expect(server.posts).toBe(0)
  })
})

describe('RefillMoment — staying and coming back', () => {
  it('claims a credit that lands while the app is open, quietly', async () => {
    server.pending = 0
    await mount()
    await settle()
    // A credit lands in front of the learner: the next answer carries it.
    server.pending = 1
    await credits.refreshCredits()
    await settle()
    expect(card()).toBeNull()
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
    expect(card()).toBeNull()
    expect(server.posts).toBe(1)

    // Out of sight for the quarter hour: the card, charged with what landed.
    now.mockReturnValue(t0 + 120_000)
    setVisibility('hidden')
    server.pending = 5
    now.mockReturnValue(t0 + 120_000 + AWAY_MS)
    setVisibility('visible')
    now.mockRestore()
    await settle(150)
    expect(card()).toBeTruthy()
    expect(document.querySelector('.refill-print__plus').textContent).toBe('+5')
    expect(server.posts).toBe(1)
    await moment()
    expect(server.posts).toBe(2)
    expect(credits.peekBalance()).toBe(26)
  })
})
