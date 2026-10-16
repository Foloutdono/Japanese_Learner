import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./api', () => ({ apiJson: vi.fn() }))
import { apiJson } from './api'
import { cachedJson, forgetCachedJson, invalidateCachedJson, invalidateMine, MINE_TTL_MS } from './cachedJson'

// ── One answer per path, shared (plan 211) ──────────────────────
// A selector walked fast sent a request per step and per figure beside
// it. A path is asked once per learner while its answer is on its way
// and kept for a while after; a failure is never kept.

const me = { user: { id: 'u1' } }
const other = { user: { id: 'u2' } }
const later = () => {
  let resolve
  let reject
  const promise = new Promise((ok, no) => { resolve = ok; reject = no })
  return { promise, resolve, reject }
}

beforeEach(() => {
  forgetCachedJson()
  apiJson.mockReset()
})
afterEach(() => { vi.useRealTimers() })

describe('cachedJson', () => {
  it('shares one request between callers of the same path', async () => {
    const answer = later()
    apiJson.mockReturnValueOnce(answer.promise)
    const a = cachedJson('/api/themes', me)
    const b = cachedJson('/api/themes', me)
    answer.resolve({ themes: [1] })
    expect(await a).toEqual({ themes: [1] })
    expect(await b).toBe(await a)
    expect(apiJson).toHaveBeenCalledTimes(1)
  })

  it('keeps each path, and each learner, apart', async () => {
    apiJson.mockImplementation(async path => ({ path }))
    expect(await cachedJson('/api/frequency/vocab/tiers?tier_size=100', me)).toEqual({ path: '/api/frequency/vocab/tiers?tier_size=100' })
    expect(await cachedJson('/api/frequency/vocab/tiers?tier_size=200', me)).toEqual({ path: '/api/frequency/vocab/tiers?tier_size=200' })
    await cachedJson('/api/frequency/vocab/tiers?tier_size=100', other)
    expect(apiJson).toHaveBeenCalledTimes(3)
    // Walked back to: nothing asked.
    await cachedJson('/api/frequency/vocab/tiers?tier_size=100', me)
    expect(apiJson).toHaveBeenCalledTimes(3)
  })

  it('asks again once the TTL has run out', async () => {
    vi.useFakeTimers()
    apiJson.mockResolvedValue({ n: 1 })
    await cachedJson('/api/stats', me, { ttlMs: 1000 })
    vi.advanceTimersByTime(999)
    await cachedJson('/api/stats', me, { ttlMs: 1000 })
    expect(apiJson).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    await cachedJson('/api/stats', me, { ttlMs: 1000 })
    expect(apiJson).toHaveBeenCalledTimes(2)
  })

  it('keeps no failure', async () => {
    apiJson.mockRejectedValueOnce(new Error('503'))
    await expect(cachedJson('/api/themes', me)).rejects.toThrow('503')
    apiJson.mockResolvedValueOnce({ themes: [] })
    await expect(cachedJson('/api/themes', me)).resolves.toEqual({ themes: [] })
    expect(apiJson).toHaveBeenCalledTimes(2)
  })

  it('drops what is invalidated, and keeps nothing on its way across it', async () => {
    const answer = later()
    apiJson.mockReturnValueOnce(answer.promise)
    const first = cachedJson('/api/frequency/vocab/tiers/started?tier_size=100', me)
    invalidateCachedJson('/api/frequency/')
    answer.resolve({ started: { 1: 3 } })
    // The caller still has its answer...
    expect(await first).toEqual({ started: { 1: 3 } })
    // ...but the next one asks afresh.
    apiJson.mockResolvedValueOnce({ started: { 1: 4 } })
    expect(await cachedJson('/api/frequency/vocab/tiers/started?tier_size=100', me)).toEqual({ started: { 1: 4 } })
    expect(apiJson).toHaveBeenCalledTimes(2)
  })

  it('drops the learner\'s own figures after a review, and keeps the content', async () => {
    apiJson.mockImplementation(async path => ({ path }))
    await cachedJson('/api/themes', me)
    await cachedJson('/api/kanji/stats?radical=9&mode=x', me, { ttlMs: MINE_TTL_MS })
    invalidateMine()
    await cachedJson('/api/themes', me)
    await cachedJson('/api/kanji/stats?radical=9&mode=x', me, { ttlMs: MINE_TTL_MS })
    expect(apiJson.mock.calls.map(([p]) => p)).toEqual([
      '/api/themes',
      '/api/kanji/stats?radical=9&mode=x',
      '/api/kanji/stats?radical=9&mode=x',
    ])
  })

  it('keeps nothing the leaving learner asked for', async () => {
    const answer = later()
    apiJson.mockReturnValueOnce(answer.promise)
    const asked = cachedJson('/api/stats', me)
    forgetCachedJson()
    answer.resolve({ mine: true })
    await asked
    apiJson.mockResolvedValueOnce({ mine: false })
    expect(await cachedJson('/api/stats', me)).toEqual({ mine: false })
  })

  it('is bounded, the least recently used going first', async () => {
    apiJson.mockImplementation(async path => ({ path }))
    for (let i = 0; i < 200; i += 1) await cachedJson(`/api/p/${i}`, me)
    // The first, used again, is kept; the second goes when one more comes.
    await cachedJson('/api/p/0', me)
    await cachedJson('/api/p/200', me)
    apiJson.mockClear()
    await cachedJson('/api/p/0', me)
    expect(apiJson).not.toHaveBeenCalled()
    await cachedJson('/api/p/1', me)
    expect(apiJson).toHaveBeenCalledTimes(1)
  })
})
