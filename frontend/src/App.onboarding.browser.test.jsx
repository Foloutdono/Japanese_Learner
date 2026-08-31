import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── The onboarding gate in App ─────────────────────────────────
// Three behaviours, one of which is the load-bearing one: a signed-in
// user whose profile has no onboardedAt gets the ticket office instead
// of the router; one with it gets the router; and — the case that
// protects real users — a FAILED profile fetch opens the app rather
// than trapping anyone behind a gate their network dropped.

const apiJsonWithTimeout = vi.fn()
// /api/today, shaped fully so NextService renders quietly.
const apiJson = vi.fn(async () => ({ total: 0, by_source: {}, lanes: [], next_due: null }))
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
  },
}))

// LangContext pulls the content-translation maps over the network on
// mount — same stub the AnalyzerScreen polling test uses.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: App } = await import('./App')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

beforeEach(() => {
  apiJsonWithTimeout.mockReset()
  window.history.replaceState(null, '', '/')
})

describe('App onboarding gate', () => {
  it('shows the ticket office when the profile has no onboardedAt', async () => {
    apiJsonWithTimeout.mockResolvedValue({ username: 'Tester', onboardedAt: null, jlptLevel: null })

    const screen = await render(<App />)
    await settle()

    expect(screen.container.querySelector('.onb')).not.toBeNull()
    // No router mounted: the flow replaces the app, it doesn't cover it.
    // (.gatehall is the home screen's room — the wall-map redesign's
    // successor to the departure board this assertion used to probe.)
    expect(screen.container.querySelector('.gatehall')).toBeNull()
  })

  it('shows the app when the profile is already onboarded', async () => {
    apiJsonWithTimeout.mockResolvedValue({ username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4' })

    const screen = await render(<App />)
    await settle()

    expect(screen.container.querySelector('.onb')).toBeNull()
  })

  it('FAILS OPEN into the app when the profile fetch fails', async () => {
    apiJsonWithTimeout.mockRejectedValue(new Error('network down'))

    const screen = await render(<App />)
    await settle()

    expect(screen.container.querySelector('.onb')).toBeNull()
  })
})
