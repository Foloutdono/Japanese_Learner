import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── The balance moves twice per review (plan 069) ─────────────
// An optimistic decrement the moment the rating lands, then the
// server's own figure from the response, which wins. A 402 mid-run
// zeroes it and raises the run-out sheet.

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }))

const credits = await import('./credits')

const FREE = { balance: 30, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }

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
    credits.markRunOut({ balance: 0, refillAt: null, cleared: 12 })
    expect(credits.peekBalance()).toBe(0)
    expect(credits.peekRunOut()).toEqual({ balance: 0, refillAt: null, cleared: 12 })
    credits.clearRunOut()
    expect(credits.peekRunOut()).toBe(null)
  })
})
