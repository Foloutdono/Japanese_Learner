import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── The balance moves twice per review (plan 069) ─────────────
// An optimistic decrement the moment the rating lands, then the
// server's own figure from the response, which wins. A 402 mid-run
// zeroes it and raises the run-out sheet.

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
}))
vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }))

const credits = await import('./credits')
const { apiFetch } = await import('../lib/api')

const FREE = { balance: 30, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }

beforeEach(() => {
  credits.seedCredits(FREE)
  credits.clearRunOut()
})

describe('the credits store', () => {
  it('decrements optimistically, never below zero', () => {
    credits.applySpend(1)
    credits.applySpend(1)
    expect(credits.peekBalance()).toBe(28)
    credits.seedCredits({ ...FREE, balance: 0 })
    credits.applySpend(1)
    expect(credits.peekBalance()).toBe(0)
  })

  it('takes the server\'s figure over its own guess', () => {
    credits.applySpend(1)                       // 29, the guess
    credits.reconcileCredits({ balance: 31, unlimited: false })  // a refill landed
    expect(credits.peekBalance()).toBe(31)
    credits.reconcileCredits({ balance: null, unlimited: true })
    expect(credits.peekBalance()).toBe(null)
    // A pass never decrements.
    credits.applySpend(1)
    expect(credits.peekBalance()).toBe(null)
  })

  it('zeroes the balance and raises the run-out sheet on a refusal', () => {
    credits.markRunOut({ balance: 0, nextCreditAt: null, cleared: 12 })
    expect(credits.peekBalance()).toBe(0)
    expect(credits.peekRunOut()).toEqual({ balance: 0, nextCreditAt: null, cleared: 12 })
    credits.clearRunOut()
    expect(credits.peekRunOut()).toBe(null)
  })
})

// ── 補充 — the claim (plan 139) ────────────────────────────────
// The sheet's figure is what it moves: the store takes it into the
// balance the moment the sheet closes, and the server's answer wins
// when it arrives -- or puts the store back on a failure.
describe('the claim', () => {
  const ok = body => ({ ok: true, status: 200, json: async () => body })

  it('opens on something, never on nothing', () => {
    credits.forgetCredits()
    credits.offerClaim(0, 20)
    expect(credits.peekClaimOffer()).toBe(null)
    credits.offerClaim(12, 20)
    expect(credits.peekClaimOffer()).toEqual({ amount: 12, from: 20 })
    // A sign-out takes the offer with the balance.
    credits.forgetCredits()
    expect(credits.peekClaimOffer()).toBe(null)
  })

  it('moves the balance at once, then takes the server\'s figure', async () => {
    credits.seedCredits({ ...FREE, balance: 20, pending: 12 })
    let answer
    apiFetch.mockImplementationOnce(() => new Promise(r => { answer = r }))
    credits.offerClaim(12, 20)
    const done = credits.takeClaim()
    expect(credits.peekClaimOffer()).toBe(null)
    expect(credits.peekBalance()).toBe(32)
    expect(credits.peekCredits().pending).toBe(0)
    // A fare between the two: the server's word is 31, and it wins.
    await new Promise(r => setTimeout(r, 0))  // the session, then the request
    answer(ok({ ...FREE, balance: 31, pending: 0, claimed: 12 }))
    expect(await done).toBe(12)
    expect(apiFetch).toHaveBeenLastCalledWith('/api/credits/claim', { access_token: 't' }, { method: 'POST' })
    expect(credits.peekBalance()).toBe(31)
    // The store keeps the summary, not the call's own `claimed`.
    expect(credits.peekCredits().claimed).toBeUndefined()
  })

  it('claims nothing twice, and a failure is not a balance', async () => {
    credits.seedCredits({ ...FREE, balance: 20, pending: 3 })
    apiFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    apiFetch.mockResolvedValueOnce(ok({ ...FREE, balance: 20, pending: 3 }))  // the refresh after it
    credits.offerClaim(3, 20)
    const first = credits.takeClaim()
    expect(await credits.takeClaim()).toBe(0)  // the sheet is already shut
    expect(await first).toBe(0)
    await new Promise(r => setTimeout(r, 0))
    expect(credits.peekBalance()).toBe(20)
    expect(credits.peekCredits().pending).toBe(3)
  })
})
