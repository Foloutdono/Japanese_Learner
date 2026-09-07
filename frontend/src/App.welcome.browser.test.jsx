import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'

// ── Signed out: Welcome, then the sign-in on the matching side ──
// The boarding's step zero replaces the landing page (plan 075): Board
// opens the sign-in on Sign up, "Have an account?" on Login, and the
// back button returns to Welcome. No session, no router.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ error: null })),
    },
  },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: App } = await import('./App')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
// Login is the first side of the control, Sign up the second (the lane runs fr-FR, so no words).
const checkedSide = screen => [...screen.container.querySelectorAll('.auth-card .seg__opt')].findIndex(o => o.getAttribute('aria-checked') === 'true')

describe('App signed out', () => {
  it('shows Welcome, boards onto Sign up, signs in on Login, and comes back', async () => {
    window.history.replaceState(null, '', '/')
    const screen = await render(<App />)
    await settle()

    expect(screen.container.querySelector('.brd--welcome')).not.toBeNull()
    expect(screen.container.querySelectorAll('.brd-roll__lane')).toHaveLength(2)
    expect(screen.container.querySelector('.brd-tagline')).not.toBeNull()
    expect(screen.container.querySelector('.auth')).toBeNull()

    screen.container.querySelector('[data-action="board"]').click()
    await settle(60)
    expect(screen.container.querySelector('.auth')).not.toBeNull()
    expect(checkedSide(screen)).toBe(1)
    expect(screen.container.querySelector('.auth-foot')).not.toBeNull()

    screen.container.querySelector('.auth__head .brd__back').click()
    await settle(60)
    expect(screen.container.querySelector('.brd--welcome')).not.toBeNull()

    screen.container.querySelector('[data-action="sign-in"]').click()
    await settle(60)
    expect(checkedSide(screen)).toBe(0)
    // The seg switches sides in place.
    screen.container.querySelectorAll('.auth-card .seg__opt')[1].click()
    await settle(30)
    expect(checkedSide(screen)).toBe(1)
  })
})
