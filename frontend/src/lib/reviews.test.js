import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── One helper for the fare (plan 069) ────────────────────────
// The six review sites post through here: the balance drops before
// the response, the response's figure replaces it, and a 402
// out_of_credits raises the run-out sheet while the caller still gets
// its rejection.

const apiJson = vi.fn()
vi.mock('./api', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, apiJson: (...a) => apiJson(...a) }
})
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))

const { ApiError } = await import('./api')
const credits = await import('../stores/credits')
const { postReview } = await import('./reviews')

const FREE = { balance: 10, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: true }

beforeEach(() => {
  apiJson.mockReset()
  credits.seedCredits(FREE)
  credits.clearRunOut()
})

describe('postReview', () => {
  it('charges before the response and reconciles after it', async () => {
    let seen
    apiJson.mockImplementation(async () => {
      seen = credits.peekBalance()
      return { xp_earned: 4, credits: { balance: 7, unlimited: false } }
    })
    const res = await postReview('/api/kana/review', { access_token: 't' }, { card_id: 'x', mode: 'm', quality: 4 })
    expect(seen).toBe(9)
    expect(res.xp_earned).toBe(4)
    expect(credits.peekBalance()).toBe(7)
    expect(apiJson).toHaveBeenCalledWith('/api/kana/review', { access_token: 't' }, expect.objectContaining({ method: 'POST' }))
  })

  it('raises the run-out sheet on a 402 out_of_credits and still rejects', async () => {
    apiJson.mockRejectedValue(new ApiError(402, { detail: 'out_of_credits', balance: 0, refillAt: '2026-09-07T00:00:00+00:00' }, '/api/today/review'))
    await expect(postReview('/api/today/review', {}, {}, { cleared: 12 })).rejects.toBeInstanceOf(ApiError)
    expect(credits.peekRunOut()).toEqual({ balance: 0, refillAt: '2026-09-07T00:00:00+00:00', cleared: 12 })
    expect(credits.peekBalance()).toBe(0)
  })

  it('leaves the sheet down on any other failure', async () => {
    apiJson.mockRejectedValue(new ApiError(500, { detail: 'boom' }, '/api/today/review'))
    await expect(postReview('/api/today/review', {}, {})).rejects.toBeInstanceOf(ApiError)
    expect(credits.peekRunOut()).toBe(null)
  })

  it('reads the code off the refusal', () => {
    expect(new ApiError(402, { detail: 'pass_required' }, '/x').code).toBe('pass_required')
    expect(new ApiError(400, { detail: "Invalid mode for kana: 'banana'" }, '/x').code).toBe(null)
    expect(new ApiError(500, null, '/x').code).toBe(null)
  })
})
