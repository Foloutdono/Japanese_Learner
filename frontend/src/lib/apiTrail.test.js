import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const track = vi.fn()
vi.mock('./track', () => ({ track: (...a) => track(...a) }))
vi.mock('./supabase', () => ({ supabase: { auth: {} } }))

const { recordApiFailure, watchApiFailures, _reset } = await import('./apiTrail')

beforeEach(() => { track.mockClear(); _reset(); vi.useFakeTimers() })
afterEach(() => vi.useRealTimers())

describe('recordApiFailure', () => {
  it('records the area of the path, never the path', () => {
    recordApiFailure({ path: '/api/decks/9f3a-77/cards?q=ma%20liste', status: 503 })
    expect(track).toHaveBeenCalledWith('api_error', { path: '/api/decks', status: 503 })
  })

  it('says a failure once a minute, not once per screen that hit it', () => {
    recordApiFailure({ path: '/api/stats', status: 502 })
    recordApiFailure({ path: '/api/stats/week', status: 502 })
    recordApiFailure({ path: '/api/stats', status: 0 })
    // Same area and status is one row; another status is another row.
    expect(track.mock.calls.map(c => c[1])).toEqual([
      { path: '/api/stats', status: 502 },
      { path: '/api/stats', status: 0 },
    ])
    vi.advanceTimersByTime(61_000)
    recordApiFailure({ path: '/api/stats', status: 502 })
    expect(track).toHaveBeenCalledTimes(3)
  })

  it("never records the trail's own batch, which would write a row about its failure", () => {
    recordApiFailure({ path: '/api/events', status: 500 })
    expect(track).not.toHaveBeenCalled()
  })

  it('records nothing for a path that is not an API path', () => {
    recordApiFailure({ path: '/learn/decks/42', status: 500 })
    expect(track).not.toHaveBeenCalled()
  })
})

describe('watchApiFailures', () => {
  it('wires a failed request in lib/api.js to the trail', async () => {
    watchApiFailures()
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const { apiFetch } = await import('./api')
    await apiFetch('/api/profile/learning', null)
    expect(track).toHaveBeenCalledWith('api_error', { path: '/api/profile', status: 500 })
  })
})
