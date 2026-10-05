import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── The agenda's save carries the learner's token (plan 181) ─────
// saveAgenda once passed `null` as the session, apiFetch then sent no
// Authorization header, and the server refused every save with a 401:
// the week loaded (the shared store finds its own session) and nothing
// added to it was ever kept. The store now asks for the session itself
// (lib/session.js), and this pins it.

const auth = vi.hoisted(() => ({ session: { access_token: 'tok-123' } }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: auth.session } }) } },
}))

const fetchSpy = vi.fn()
globalThis.fetch = fetchSpy

const { saveAgenda } = await import('./agenda')

const BLOCK = { id: 9, subject: 'kanji', days: [0, 1], start: 540, end: 600, notify: true, lead: 10 }

beforeEach(() => {
  auth.session = { access_token: 'tok-123' }
  fetchSpy.mockReset()
  fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ blocks: [BLOCK] }) })
})

describe('saveAgenda', () => {
  it('puts the week with the learner\'s bearer token', async () => {
    const out = await saveAgenda([BLOCK])
    expect(out).toEqual([BLOCK])
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/agenda$/)
    expect(init.method).toBe('PUT')
    expect(init.headers.Authorization).toBe('Bearer tok-123')
    // Only the fields the server holds; the id stays behind.
    expect(JSON.parse(init.body)).toEqual({ blocks: [{ subject: 'kanji', days: [0, 1], start: 540, end: 600, notify: true, lead: 10 }] })
  })

  it('rejects when the server refuses, so the editor can say so', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: 'Missing token' }) })
    await expect(saveAgenda([BLOCK])).rejects.toThrow()
  })
})
