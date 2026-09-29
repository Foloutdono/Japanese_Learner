import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 評価 — when, and how, a visit asks (plan 167) ──────────────
// The server says whether this learner is asked and how; this store
// says when: after VISIT_REVIEWS cards in this visit, once a visit, and
// again only after a request that failed. In the apps the question is
// the store's own prompt, at once and with nothing before it; on the
// web it is the app's sheet.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({ apiJson: (...a) => apiJson(...a) }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
}))
const plat = vi.hoisted(() => ({ platform: 'web', review: vi.fn(async () => true) }))
vi.mock('../lib/platform', () => ({
  nativePlatform: () => plat.platform,
  requestStoreReview: (...a) => plat.review(...a),
}))

const rating = await import('./rating')

function studied(n = rating.VISIT_REVIEWS) {
  for (let i = 0; i < n; i++) rating.noteReview()
}
const posted = () => apiJson.mock.calls
  .filter(([, , opts]) => opts?.method === 'POST')
  .map(([path, , opts]) => [path, JSON.parse(opts.body)])

beforeEach(() => {
  apiJson.mockReset()
  plat.platform = 'web'
  plat.review.mockReset()
  plat.review.mockResolvedValue(true)
  rating.resetRating()
})

describe('the moment', () => {
  it('waits for a visit that has been a real one', async () => {
    studied(rating.VISIT_REVIEWS - 1)
    expect(rating.readyToAsk()).toBe(false)
    expect(await rating.askRating()).toBe(null)
    expect(apiJson).not.toHaveBeenCalled()
    rating.noteReview()
    expect(rating.readyToAsk()).toBe(true)
  })

  it('asks the server once a visit, naming the platform', async () => {
    studied()
    apiJson.mockResolvedValue({ ask: false, how: 'sheet' })
    expect(await rating.askRating()).toBe(null)
    expect(apiJson).toHaveBeenCalledWith('/api/rating/prompt?platform=web', { access_token: 't' })
    studied()
    expect(rating.readyToAsk()).toBe(false)
    expect(apiJson).toHaveBeenCalledTimes(1)
  })

  it('asks again at the next moment after a failure', async () => {
    studied()
    apiJson.mockRejectedValueOnce(new Error('offline'))
    expect(await rating.askRating()).toBe(null)
    expect(rating.readyToAsk()).toBe(true)
  })
})

describe('the way it asks', () => {
  it('opens the sheet on the web', async () => {
    studied()
    apiJson.mockResolvedValue({ ask: true, how: 'sheet' })
    expect(await rating.askRating()).toBe('sheet')
    expect(rating.peekRatingOpen()).toBe(true)
    expect(plat.review).not.toHaveBeenCalled()
    expect(rating.readyToAsk()).toBe(false)
  })

  it.each(['ios', 'android'])('requests the store prompt in the %s app, and nothing else', async (p) => {
    plat.platform = p
    studied()
    apiJson.mockImplementation(async path => (path.startsWith('/api/rating/prompt') ? { ask: true, how: 'store' } : { ok: true }))
    expect(await rating.askRating()).toBe('store')
    expect(apiJson.mock.calls[0][0]).toBe(`/api/rating/prompt?platform=${p}`)
    expect(plat.review).toHaveBeenCalledTimes(1)
    expect(posted()).toEqual([['/api/rating', { kind: 'store_prompt', platform: p }]])
    // No sheet of the app's own, before or after the store's.
    expect(rating.peekRatingOpen()).toBe(false)
  })

  it('records nothing when the shell could not ask', async () => {
    plat.platform = 'android'
    plat.review.mockResolvedValue(false)
    studied()
    apiJson.mockResolvedValue({ ask: true, how: 'store' })
    await rating.askRating()
    expect(posted()).toEqual([])
  })
})

describe('what is sent', () => {
  it('a rating with its comment, a blank one dropped', async () => {
    apiJson.mockResolvedValue({ ok: true })
    await rating.sendRating({ stars: 3, comment: ' more listening ', lang: 'fr' })
    await rating.sendRating({ stars: 2, comment: '   ', lang: 'en' })
    expect(posted()).toEqual([
      ['/api/rating', { kind: 'rating', stars: 3, comment: 'more listening', platform: 'web', lang: 'fr' }],
      ['/api/rating', { kind: 'rating', stars: 2, comment: null, platform: 'web', lang: 'en' }],
    ])
  })

  it('"not now" as a put-off', async () => {
    apiJson.mockResolvedValue({ ok: true })
    await rating.sendRating({ lang: 'xx' })
    expect(posted()).toEqual([['/api/rating', { kind: 'put_off', platform: 'web', lang: null }]])
  })

  it('feedback from any platform', async () => {
    plat.platform = 'ios'
    apiJson.mockResolvedValue({ ok: true })
    await rating.sendFeedback('  the audio is quiet ', 'en')
    expect(posted()).toEqual([['/api/feedback', { comment: 'the audio is quiet', platform: 'ios', lang: 'en' }]])
  })
})
