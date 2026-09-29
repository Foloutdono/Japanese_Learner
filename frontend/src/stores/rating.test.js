import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 評価 — when a visit asks (plan 167) ────────────────────────
// The server says whether this learner is asked; this store says when:
// after VISIT_REVIEWS cards in this visit, once a visit, and only
// again after a request that failed.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({ apiJson: (...a) => apiJson(...a) }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
}))

const rating = await import('./rating')

function studied(n = rating.VISIT_REVIEWS) {
  for (let i = 0; i < n; i++) rating.noteReview()
}

beforeEach(() => {
  apiJson.mockReset()
  rating.resetRating()
})

describe('the rating moment', () => {
  it('waits for a visit that has been a real one', async () => {
    studied(rating.VISIT_REVIEWS - 1)
    expect(rating.readyToAsk()).toBe(false)
    expect(await rating.askRating()).toBe(false)
    expect(apiJson).not.toHaveBeenCalled()
    rating.noteReview()
    expect(rating.readyToAsk()).toBe(true)
  })

  it('opens the sheet when the server says so, and asks once a visit', async () => {
    studied()
    apiJson.mockResolvedValue({ ask: true })
    expect(await rating.askRating()).toBe(true)
    expect(apiJson).toHaveBeenCalledWith('/api/rating/prompt', { access_token: 't' })
    expect(rating.readyToAsk()).toBe(false)
    rating.closeRating()
    studied()
    expect(rating.readyToAsk()).toBe(false)
    expect(await rating.askRating()).toBe(false)
    expect(apiJson).toHaveBeenCalledTimes(1)
  })

  it('takes a no for the visit', async () => {
    studied()
    apiJson.mockResolvedValue({ ask: false })
    expect(await rating.askRating()).toBe(false)
    expect(rating.readyToAsk()).toBe(false)
  })

  it('asks again at the next moment after a failure', async () => {
    studied()
    apiJson.mockRejectedValueOnce(new Error('offline'))
    expect(await rating.askRating()).toBe(false)
    expect(rating.readyToAsk()).toBe(true)
  })
})

describe('the answer', () => {
  it('names the platform and drops a blank comment', async () => {
    apiJson.mockResolvedValue({ ok: true, store: false })
    await rating.sendRating({ stars: 3, comment: '   ', lang: 'fr' })
    const [path, , opts] = apiJson.mock.calls[0]
    expect(path).toBe('/api/rating')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ stars: 3, comment: null, platform: 'web', lang: 'fr' })
  })

  it('sends "not now" as no stars', async () => {
    apiJson.mockResolvedValue({ ok: true, store: false })
    await rating.sendRating({ stars: null, lang: 'xx' })
    expect(JSON.parse(apiJson.mock.calls[0][2].body)).toEqual({ stars: null, comment: null, platform: 'web', lang: null })
  })
})
