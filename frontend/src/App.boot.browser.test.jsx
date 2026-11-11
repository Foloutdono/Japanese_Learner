import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── The boot gate counts a failed boot once (plan 312) ───────────
// The gate asks /api/profile again every few seconds until it answers,
// and every failed try used to send its own boot_timeout: October's
// 456 rows were 29 failed boots, and "the share of opens that fail"
// could not be read off them. One row per boot now, on the first
// failure, saying why (`reason`); the app_open that follows says the
// boot recovered.

const track = vi.fn()
vi.mock('./lib/track', () => ({ track }))

class ApiError extends Error {
  constructor(status) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

const apiJsonWithTimeout = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({ total: 0, by_source: {}, lanes: [], next_due: null })),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError,
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'user-boot' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
  },
}))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: App } = await import('./App')

const named = name => track.mock.calls.filter(([n]) => n === name)

beforeEach(() => {
  track.mockClear()
  apiJsonWithTimeout.mockReset()
  window.history.replaceState(null, '', '/')
  try { window.localStorage.removeItem('jp-onboarded') } catch { /* private mode */ }
})

describe('the boot gate', () => {
  it('records one boot_timeout for a boot that fails twice, then opens', async () => {
    apiJsonWithTimeout
      .mockRejectedValueOnce(new ApiError(502))
      .mockRejectedValueOnce(new ApiError(502))
      .mockResolvedValue({
        username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4',
        tutorialAt: '2026-08-28T09:05:00Z', guided: { today: true },
      })
    await render(<App />)

    // Two retries, three seconds apart (GATE_RETRY_MS), then the answer.
    await vi.waitFor(() => expect(named('app_open')).toHaveLength(1), { timeout: 10000 })
    expect(apiJsonWithTimeout.mock.calls.filter(([p]) => p === '/api/profile')).toHaveLength(3)
    expect(named('boot_timeout')).toHaveLength(1)
    expect(named('boot_timeout')[0][1]).toMatchObject({ reason: 'server' })
  })

  it('names a request that never answered as the network', async () => {
    apiJsonWithTimeout
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValue({
        username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4',
        tutorialAt: '2026-08-28T09:05:00Z', guided: { today: true },
      })
    await render(<App />)

    await vi.waitFor(() => expect(named('app_open')).toHaveLength(1), { timeout: 10000 })
    expect(named('boot_timeout')).toHaveLength(1)
    expect(named('boot_timeout')[0][1]).toMatchObject({ reason: 'network' })
  })
})
