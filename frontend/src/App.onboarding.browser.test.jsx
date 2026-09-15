import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── The onboarding gate in App ─────────────────────────────────
// Four behaviours, two of them load-bearing: a signed-in user whose
// profile has no onboardedAt gets the boarding (plan 075) instead of
// the router; one with it gets the router; a FAILED profile fetch
// opens the app for a learner this device has already seen through
// the gate, rather than trapping them behind a gate their network
// dropped; and — the case that keeps the boarding from being
// skippable — the same failure for anyone ELSE (a guest whose pass
// was minted a moment ago, on a cold start) keeps the loading screen
// up and asks again, instead of seating them in an app they never
// boarded.

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
      getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'user-1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
  },
}))

// LangContext pulls the content-translation maps over the network on
// mount — same stub the AnalyzerScreen polling test uses.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: App } = await import('./App')
const { rememberOnboarded, wasOnboardedHere } = await import('./stores/onboarded')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

beforeEach(() => {
  apiJsonWithTimeout.mockReset()
  window.history.replaceState(null, '', '/')
  try { window.localStorage.removeItem('jp-onboarded') } catch { /* private mode */ }
})

describe('App onboarding gate', () => {
  it('shows the boarding when the profile has no onboardedAt', async () => {
    apiJsonWithTimeout.mockResolvedValue({ username: 'Tester', onboardedAt: null, jlptLevel: null })

    const screen = await render(<App />)
    await settle()

    expect(screen.container.querySelector('.brd')).not.toBeNull()
    expect(screen.container.querySelector('.brd').dataset.step).toBe('name')
    // No router mounted: the flow replaces the app, it doesn't cover it.
    // (.gatehall is the home screen's room — the wall-map redesign's
    // successor to the departure board this assertion used to probe.)
    expect(screen.container.querySelector('.gatehall')).toBeNull()
  })

  it('shows the app when the profile is already onboarded', async () => {
    apiJsonWithTimeout.mockResolvedValue({ username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4' })

    const screen = await render(<App />)
    await settle()

    expect(screen.container.querySelector('.brd')).toBeNull()
  })

  it('FAILS OPEN into the app when the fetch fails for a learner this device let through before', async () => {
    rememberOnboarded('user-1')
    apiJsonWithTimeout.mockRejectedValue(new Error('network down'))

    const screen = await render(<App />)
    await settle()

    expect(screen.container.querySelector('.brd')).toBeNull()
    expect(screen.container.querySelector('.app-loading')).toBeNull()
  })

  it('keeps waiting and asks again when the fetch fails for a learner it has never seen', async () => {
    apiJsonWithTimeout.mockRejectedValue(new Error('cold start'))

    const screen = await render(<App />)
    await settle()

    // Neither the app nor the boarding: the wait, honestly drawn.
    expect(screen.container.querySelector('.brd')).toBeNull()
    expect(screen.container.querySelector('.gatehall')).toBeNull()
    expect(screen.container.querySelector('.app-loading')).not.toBeNull()
    expect(wasOnboardedHere('user-1')).toBe(false)

    // The server answers on the next try: the boarding, not the app.
    apiJsonWithTimeout.mockResolvedValue({ username: '', onboardedAt: null, jlptLevel: null })
    await vi.waitFor(() => {
      expect(screen.container.querySelector('.brd')).not.toBeNull()
    }, { timeout: 6000 })
    expect(screen.container.querySelector('.brd').dataset.step).toBe('name')
  })

  it('remembers a learner the profile called onboarded', async () => {
    apiJsonWithTimeout.mockResolvedValue({ username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4' })

    await render(<App />)
    await settle()

    expect(wasOnboardedHere('user-1')).toBe(true)
  })
})
