import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── A level is told once (the level-up played twice in a row) ─────────
const api = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }) } } }))
vi.mock('../lib/api', () => ({ apiFetch: api.apiFetch }))

const { seedSummary, applyXpGain, resetCelebrated, forgetSummary, refreshSummary, peekSummary } = await import('./profileSummary')
const { xpThreshold } = await import('../domain/xpCurve')

const AT = level => ({
  username: 'Aiko',
  level,
  xp: xpThreshold(level) + 10,
  xpPrevLevel: xpThreshold(level),
  xpForNext: xpThreshold(level + 1),
})
const NEXT = level => xpThreshold(level + 1) - xpThreshold(level)

beforeEach(() => {
  forgetSummary()
  seedSummary(AT(5))
})

describe('applyXpGain and the level-up', () => {
  it('flags the review that crosses a level', () => {
    expect(applyXpGain({ amount: NEXT(5) })).toEqual({ leveledUp: true, newLevel: 6 })
  })

  it('does not flag a gain that stays inside the level', () => {
    expect(applyXpGain({ amount: 1 })).toEqual({ leveledUp: false, newLevel: 5 })
  })

  it('does not tell the same level twice when a stale fetch puts the cache back', async () => {
    expect(applyXpGain({ amount: NEXT(5) }).leveledUp).toBe(true)
    // A real fetch lands with the figures from before the reviews in flight.
    api.apiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(AT(5)) })
    await refreshSummary()
    expect(peekSummary().level).toBe(5)
    const again = applyXpGain({ amount: NEXT(5) })
    expect(again).toEqual({ leveledUp: false, newLevel: 6 })
    // The bar still moves to the new level.
    expect(peekSummary().level).toBe(6)
  })

  it('still tells the next level', () => {
    expect(applyXpGain({ amount: NEXT(5) }).leveledUp).toBe(true)
    expect(applyXpGain({ amount: NEXT(6) })).toEqual({ leveledUp: true, newLevel: 7 })
  })

  it('tells a level again once the learner has wiped their XP', () => {
    expect(applyXpGain({ amount: NEXT(5) }).leveledUp).toBe(true)
    resetCelebrated()
    forgetSummary()
    seedSummary(AT(5))
    expect(applyXpGain({ amount: NEXT(5) }).leveledUp).toBe(true)
  })
})
