import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── Signed out: Welcome, then the sign-in on the matching side ──
// The boarding's step zero replaces the landing page (plan 075): Board
// boards on a guest pass or, with none to be had, opens the sign-in on
// Sign up; "Have an account?" opens it on Login -- since plan 168 in the
// promise's place on the Welcome itself -- and ‹ puts the promise back.
// No session, no router.

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
      // No guest passes in this project: Board falls back to the sign-up.
      signInAnonymously: (...a) => signInAnonymously(...a),
    },
  },
}))
const signInAnonymously = vi.fn(async () => ({ data: { session: null }, error: { code: 'anonymous_provider_disabled' } }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: App } = await import('./App')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
// Login is the first side of the control, Sign up the second (the lane runs fr-FR, so no words).
const checkedSide = screen => [...screen.container.querySelectorAll('.auth-card .seg__opt')].findIndex(o => o.getAttribute('aria-checked') === 'true')

describe('App signed out', () => {
  it('shows Welcome, falls back to Sign up, signs in on Login, and comes back', async () => {
    window.history.replaceState(null, '', '/')
    const screen = await render(<App />)
    await settle()

    // The crossroads (plan 168): the promise over the app's lines.
    expect(screen.container.querySelector('.brd--welcome')).not.toBeNull()
    expect(screen.container.querySelectorAll('.brd-front__stn')).toHaveLength(7)
    expect(screen.container.querySelector('.brd-tagline')).not.toBeNull()
    expect(screen.container.querySelector('.brd-signin')).toBeNull()

    // No guest pass to be had here, so Board opens the sign-in on Sign
    // up, in the promise's place, with both sides named.
    screen.container.querySelector('[data-action="board"]').click()
    await settle(60)
    expect(screen.container.querySelector('.brd-signin')).not.toBeNull()
    expect(screen.container.querySelector('.brd-front__promise')).toBeNull()
    expect(checkedSide(screen)).toBe(1)
    expect(screen.container.querySelector('.auth-foot')).not.toBeNull()
    // The seg switches sides in place.
    screen.container.querySelectorAll('.auth-card .seg__opt')[0].click()
    await settle(30)
    expect(checkedSide(screen)).toBe(0)

    screen.container.querySelector('[data-action="welcome"]').click()
    await settle(60)
    expect(screen.container.querySelector('.brd-front__promise')).not.toBeNull()

    // Log in opens on its own side and names no other: Board stands in
    // the corner instead.
    screen.container.querySelector('[data-action="sign-in"]').click()
    await settle(60)
    expect(screen.container.querySelector('.brd-signin')).not.toBeNull()
    expect(checkedSide(screen)).toBe(-1)
    expect(screen.container.querySelector('[data-action="board-corner"]')).not.toBeNull()
  })

  // The browser's Back (plan 123): the sign-in replaces Welcome through
  // state, so Back used to leave Tsuji. It returns to Welcome now, and
  // the ‹ leaves no entry behind it.
  it('returns to Welcome on the browser\'s Back, and ‹ leaves no entry behind', async () => {
    window.history.replaceState(null, '', '/')
    const start = window.history.length
    const screen = await render(<App />)
    await settle()
    const popped = () => new Promise(r => window.addEventListener('popstate', () => setTimeout(r, 60), { once: true }))

    screen.container.querySelector('[data-action="sign-in"]').click()
    await settle(60)
    expect(screen.container.querySelector('.brd-signin')).not.toBeNull()
    expect(window.history.length).toBe(start + 1)
    let back = popped()
    window.history.back()
    await back
    await settle(60)
    expect(screen.container.querySelector('.brd-signin')).toBeNull()
    expect(screen.container.querySelector('.brd-front__promise')).not.toBeNull()

    screen.container.querySelector('[data-action="sign-in"]').click()
    await settle(60)
    back = popped()
    screen.container.querySelector('[data-action="welcome"]').click()
    await back
    await settle(60)
    expect(screen.container.querySelector('.brd-front__promise')).not.toBeNull()
    expect(window.history.state).toBeNull()
  })

  // Se connecter on the landing page (lib/frontEntry.js): the sign-in is
  // open on arrival, on Login, with no Welcome to press it on again.
  it('opens the sign-in at once when the landing page asked for it', async () => {
    window.history.replaceState(null, '', '/app')
    const screen = await render(<App front={{ entry: 'signin', back: '/' }} />)
    await settle()
    expect(screen.container.querySelector('.brd-signin')).not.toBeNull()
    expect(screen.container.querySelector('.brd-front__promise')).toBeNull()
    expect(checkedSide(screen)).toBe(-1)
  })
})


// ── 外 — Board inside another app's browser (lib/inAppBrowser.js) ──
// A pass minted in Instagram's browser stays there, and the phone's own
// browser, where most go next, boards a second learner. So Board asks
// first, and mints nothing until the learner stays.
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G100 Instagram 452.0.1.39.54 (iPhone15,3; iOS 18_6_2;'

describe('App signed out, in another app\'s browser', () => {
  const outside = () => document.body.querySelector('.brd-sheet--outside')
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', { value: INSTAGRAM, configurable: true })
    signInAnonymously.mockClear()
  })
  afterEach(() => { delete window.navigator.userAgent })

  it('offers the phone\'s browser before any pass is minted, and boards here on Stay', async () => {
    window.history.replaceState(null, '', '/')
    const screen = await render(<App />)
    await settle()

    screen.container.querySelector('[data-action="board"]').click()
    await settle(60)
    expect(outside()).not.toBeNull()
    expect(outside().textContent).toContain('Instagram')
    expect(outside().querySelector('[data-action="outside-open"]')).not.toBeNull()
    expect(signInAnonymously).not.toHaveBeenCalled()

    outside().querySelector('[data-action="outside-stay"]').click()
    await settle(60)
    expect(outside()).toBeNull()
    expect(signInAnonymously).toHaveBeenCalledTimes(1)

    // No pass here (the project allows none), so the sign-up opened;
    // its corner Board, once the learner chose to stay, asks no more.
    screen.container.querySelector('[data-action="board-corner"]').click()
    await settle(60)
    expect(outside()).toBeNull()
    expect(signInAnonymously).toHaveBeenCalledTimes(2)
  })

  it('holds Board pressed on the landing page to the same question, on the Welcome', async () => {
    window.history.replaceState(null, '', '/app')
    const screen = await render(<App front={{ entry: 'board', back: '/' }} />)
    await settle()

    expect(screen.container.querySelector('.brd--welcome')).not.toBeNull()
    expect(outside()).not.toBeNull()
    expect(signInAnonymously).not.toHaveBeenCalled()
  })
})
