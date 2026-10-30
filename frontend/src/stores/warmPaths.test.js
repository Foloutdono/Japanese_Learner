import { describe, it, expect, vi } from 'vitest'

// ── 予熱 — every store lib/warm.js names answers at its path (plan 291) ──
// The warm reaches the shared stores by path (stores/remote's
// warmStore), so a store whose endpoint moved would leave its gate
// unwarmed without a word. Each path the warm names is a real store's,
// and warming it asks that path once.

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}))
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('../lib/api', () => ({ apiFetch: (...a) => apiFetch(...a), apiJson: vi.fn() }))

// The stores the app imports eagerly (App.jsx's screens and chrome).
await Promise.all(['./today', './credits', './journey', './stats', './basics', './practiceRecord', './agenda', './duels']
  .map(m => import(m)))
const { warmStore, peekStore } = await import('./remote')
const { STORE_PATHS } = await import('../lib/warm')

describe('the stores lib/warm.js warms', () => {
  it('are each a store answering at its path, asked once while fresh', async () => {
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => ({ path }) }))
    for (const path of Object.values(STORE_PATHS)) {
      await warmStore(path)
      expect(peekStore(path), path).toEqual({ path })
    }
    const asked = apiFetch.mock.calls.map(([p]) => p)
    expect(asked.sort()).toEqual(Object.values(STORE_PATHS).sort())
  })

  it('asks nothing for a path no store answers', async () => {
    apiFetch.mockClear()
    await warmStore('/api/nowhere')
    expect(apiFetch).not.toHaveBeenCalled()
    expect(peekStore('/api/nowhere')).toBeNull()
  })
})
