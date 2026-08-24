import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiJson, apiJsonWithTimeout, ApiError } from './api'

function mockFetchOnce(status, body) {
  global.fetch = vi.fn().mockResolvedValue({
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
