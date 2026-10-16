import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// api.js reaches for supabase only to mend a refused session (the 401
// recovery path); everything else in this file must run without it.
const refreshSession = vi.fn()
const signOut = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      refreshSession: (...a) => refreshSession(...a),
      signOut: (...a) => signOut(...a),
    },
  },
}))

import { api, apiFetch, apiJson, apiJsonWithTimeout, ApiError } from './api'
import { onApiFailure } from './apiFailure'

describe('api', () => {
  it('is same-origin with no env: the web build never carries an origin', () => {
    expect(api('/api/x')).toBe('/api/x')
  })
})

function mockFetchOnce(status, body) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

describe('apiJson', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the parsed body on a 2xx response', async () => {
    mockFetchOnce(200, { cards: [1, 2, 3] })
    const result = await apiJson('/api/kana', null)
    expect(result).toEqual({ cards: [1, 2, 3] })
  })

  it('throws ApiError on a non-2xx response instead of returning the body', async () => {
    // This is the exact bug apiJson's own doc comment describes:
    // data.cards ?? [] on an error body silently reads as "empty batch".
    mockFetchOnce(400, { detail: "Invalid mode for kana: 'banana'" })
    await expect(apiJson('/api/kana?mode=banana', null)).rejects.toThrow(ApiError)
  })

  it('ApiError carries the backend detail message and status', async () => {
    mockFetchOnce(401, { detail: 'Missing token' })
    try {
      await apiJson('/api/exams', null)
      expect.unreachable('apiJson should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(401)
      expect(err.message).toBe('Missing token')
    }
  })

  it('falls back to a generic message when the error body has no detail key', async () => {
    mockFetchOnce(500, {})
    try {
      await apiJson('/api/exams', null)
      expect.unreachable('apiJson should have thrown')
    } catch (err) {
      expect(err.message).toContain('500')
      expect(err.message).toContain('/api/exams')
    }
  })
})

describe('401 recovery', () => {
  // recoverAuth is fire-and-forget from the request path; give its
  // microtasks a beat to run before asserting.
  const flush = () => new Promise(r => setTimeout(r, 0))

  beforeEach(() => {
    refreshSession.mockReset()
    signOut.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('leaves a sessionless 401 alone — that is the endpoint doing its job', async () => {
    mockFetchOnce(401, { detail: 'Missing token' })
    await expect(apiJson('/api/today', null)).rejects.toThrow(ApiError)
    await flush()
    expect(refreshSession).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('signs out THIS device when a presented session cannot be refreshed', async () => {
    // The production failure this path exists for: a stale session the
    // app kept using while every screen quietly rendered empty.
    mockFetchOnce(401, { detail: 'Invalid token' })
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'refresh_token_not_found' } })
    await expect(apiJson('/api/today', { access_token: 'stale' })).rejects.toThrow(ApiError)
    await flush()
    expect(refreshSession).toHaveBeenCalledTimes(1)
    // scope local: the other devices' sessions are not the broken one.
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('runs one refresh for a screenful of parallel 401s, and no sign-out on success', async () => {
    mockFetchOnce(401, { detail: 'Invalid token' })
    let release
    refreshSession.mockReturnValue(new Promise(r => { release = r }))
    const a = apiJson('/api/today', { access_token: 'old' }).catch(() => {})
    const b = apiJson('/api/stats', { access_token: 'old' }).catch(() => {})
    await Promise.all([a, b])
    release({ data: { session: { access_token: 'fresh' } }, error: null })
    await flush()
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('gives up on a session the backend rejects even freshly refreshed', async () => {
    // The test above left a successful refresh moments ago; a 401 on
    // the very next requests means the backend refuses fresh tokens
    // too, and another refresh would just loop. Module state carries
    // between these two tests on purpose — this IS the sequence a real
    // rejection plays out in.
    mockFetchOnce(401, { detail: 'Invalid token' })
    await expect(apiJson('/api/today', { access_token: 'fresh' })).rejects.toThrow(ApiError)
    await flush()
    expect(refreshSession).not.toHaveBeenCalled()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

describe('apiJsonWithTimeout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves normally when the request completes before the timeout', async () => {
    mockFetchOnce(200, { ok: true })
    const result = await apiJsonWithTimeout('/api/today', null, { timeoutMs: 5000 })
    expect(result).toEqual({ ok: true })
  })
})

// ── 足跡 — what counts as a failure worth recording ───────────────
describe('onApiFailure', () => {
  afterEach(() => {
    onApiFailure(null)
    vi.restoreAllMocks()
  })

  it('hears of a server error, with the path and the status', async () => {
    const seen = vi.fn()
    onApiFailure(seen)
    mockFetchOnce(503, {})
    await apiFetch('/api/decks/9f3', null)
    expect(seen).toHaveBeenCalledWith({ path: '/api/decks/9f3', status: 503 })
  })

  it('hears of a request that got no answer at all, as status 0', async () => {
    const seen = vi.fn()
    onApiFailure(seen)
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiFetch('/api/profile', null)).rejects.toThrow('Failed to fetch')
    expect(seen).toHaveBeenCalledWith({ path: '/api/profile', status: 0 })
  })

  it('does not hear of a refusal the endpoint meant (4xx), a success, or an abort', async () => {
    const seen = vi.fn()
    onApiFailure(seen)
    mockFetchOnce(402, { detail: 'out_of_credits' })
    await apiFetch('/api/x', null)
    mockFetchOnce(200, {})
    await apiFetch('/api/x', null)
    globalThis.fetch = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await expect(apiFetch('/api/x', null)).rejects.toThrow()
    expect(seen).not.toHaveBeenCalled()
  })

  it('never lets a listener that throws break the request', async () => {
    onApiFailure(() => { throw new Error('boom') })
    mockFetchOnce(500, {})
    const response = await apiFetch('/api/x', null)
    expect(response.status).toBe(500)
  })
})

// ── 429 — a learner asking too much at once (plan 210) ──────────────
// The server queues a learner past a few requests at once and refuses
// past the queue. That is not a server failure, a read is asked once
// more after the wait the server names, and a write is never repeated.
describe('a 429', () => {
  const answer = (status, headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => (status === 429 ? { detail: 'too_many_requests' } : { fine: true }),
  })

  afterEach(() => {
    onApiFailure(null)
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('asks a read once more after Retry-After, and is not a failure', async () => {
    vi.useFakeTimers()
    const seen = vi.fn()
    onApiFailure(seen)
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(answer(429, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(answer(200))
    const pending = apiJson('/api/frequency/vocab/tiers?tier_size=200', null)
    await vi.advanceTimersByTimeAsync(999)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({ fine: true })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(seen).not.toHaveBeenCalled()
  })

  it('asks a read only once more: a second 429 is the caller\'s', async () => {
    vi.useFakeTimers()
    globalThis.fetch = vi.fn().mockResolvedValue(answer(429))
    const pending = apiJson('/api/stats', null).catch(e => e)
    await vi.advanceTimersByTimeAsync(1000)
    const err = await pending
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(429)
    expect(err.code).toBe('too_many_requests')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('never sends a write twice', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(answer(429))
    const response = await apiFetch('/api/decks', null, { method: 'POST', body: '{}' })
    expect(response.status).toBe(429)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('stops waiting when the caller aborts', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(answer(429))
    const controller = new AbortController()
    const pending = apiFetch('/api/dictionary?q=x', null, { signal: controller.signal })
    await Promise.resolve()
    await Promise.resolve()
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
