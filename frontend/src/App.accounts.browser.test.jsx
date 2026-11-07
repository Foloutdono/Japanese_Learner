import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── Signing out, and boarding the next account ───────────────────
// The signed-out continuum (Welcome → the sign-in → the boarding) is
// rendered INSTEAD of the router, so it touches neither the address
// bar nor a single module-level store. Two things followed from that,
// both reported from the same flow — sign out from the settings
// screen, then board a brand-new account:
//
//   the address  stayed at /profile/settings, so the next account's
//                router mounted on the last one's settings page and
//                never passed '/', the only route that opens the
//                first ride (plan 098). A new learner got no lesson
//                and a settings screen for a welcome.
//   the caches   stayed full of the account that had just left: the
//                summary the guide reads `guided` off, the balance on
//                the pass, the day's queue, the standing.
//
// Both are fixed at the same door — App's auth listener, which every
// sign-out passes through (Settings, the boarding's two exits, a 401).

const apiJsonWithTimeout = vi.fn()
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

// The listener is captured so a sign-out can be delivered the way
// Supabase delivers one: a SIGNED_OUT event with no session.
let authListener = null
const session = { access_token: 'tok', user: { id: 'user-1' } }

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'user-1' } } } }),
      onAuthStateChange: cb => {
        authListener = cb
        return { data: { subscription: { unsubscribe() { authListener = null } } } }
      },
      signOut: async () => {},
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ error: null })),
    },
  },
}))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: App } = await import('./App')
const { markShown, wasShown } = await import('./stores/guide')
const { seedCredits, peekBalance } = await import('./stores/credits')

const settle = (ms = 140) => new Promise(r => setTimeout(r, ms))

// Always the arriving car: the leaving one stays mounted for the 260 ms
// of the pull, and it carries the same selectors.
async function click(screen, sel) {
  // The next screen comes a frame after the tap (a transition,
  // BoardingFlow's go()), so its control is waited for.
  const find = () => screen.container.querySelector(`.brd__car:not(.brd__car--out) ${sel}`)
    ?? screen.container.querySelector(sel)
  await vi.waitFor(() => expect(find(), sel).toBeTruthy(), { timeout: 2000 })
  const el = find()
  el.click()
  await settle(40)
}

beforeEach(() => {
  apiJsonWithTimeout.mockReset()
  authListener = null
  window.history.replaceState(null, '', '/')
  try { window.localStorage.removeItem('jp-onboarded') } catch { /* private mode */ }
  try { window.localStorage.removeItem('jp-guided') } catch { /* private mode */ }
})

describe('signing out', () => {
  it('puts the address back at the front door, so the next account does not mount on this one', async () => {
    apiJsonWithTimeout.mockResolvedValue({
      username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4',
      tutorialAt: '2026-08-28T09:05:00Z', guided: { today: true },
    })
    window.history.replaceState(null, '', '/profile/settings')

    await render(<App />)
    await settle(300)
    expect(window.location.pathname).toBe('/profile/settings')

    expect(authListener).toBeTypeOf('function')
    authListener('SIGNED_OUT', null)
    await settle()

    expect(window.location.pathname).toBe('/')
  })

  it('takes the last account\'s cached answers with it', async () => {
    apiJsonWithTimeout.mockResolvedValue({
      username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4',
      tutorialAt: '2026-08-28T09:05:00Z', guided: {},
    })

    await render(<App />)
    await settle(300)

    // What the leaving account left behind: a gate whose guide it had
    // already been shown, and a balance on its pass.
    markShown('today')
    seedCredits({ balance: 7, cap: 40, unlimited: false })
    expect(wasShown('today')).toBe(true)
    expect(peekBalance()).toBe(7)

    authListener('SIGNED_OUT', null)
    await settle()

    expect(wasShown('today')).toBe(false)
    expect(peekBalance()).toBe(undefined)
  })

  it('keeps everything on a token refresh, which carries a session', async () => {
    apiJsonWithTimeout.mockResolvedValue({
      username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4',
      tutorialAt: '2026-08-28T09:05:00Z', guided: {},
    })
    window.history.replaceState(null, '', '/profile/settings')

    await render(<App />)
    await settle(300)

    seedCredits({ balance: 7, cap: 40, unlimited: false })
    authListener('TOKEN_REFRESHED', { ...session, access_token: 'tok2' })
    await settle()

    expect(window.location.pathname).toBe('/profile/settings')
    expect(peekBalance()).toBe(7)
  })
})

describe('the boarding reached on a stale address', () => {
  it('opens the 改札 on the first ride, not on the page the last account left', async () => {
    // The gate's profile: never onboarded, so the boarding runs; no
    // tutorialAt, so the ride is due the moment '/' is reached.
    apiJsonWithTimeout.mockResolvedValue({ username: 'Tester', onboardedAt: null, jlptLevel: null, guided: {} })
    window.history.replaceState(null, '', '/profile/settings')

    const screen = await render(<App />)
    await settle(300)
    expect(screen.container.querySelector('.brd')).not.toBeNull()

    // The two questions, then the card (plan 247), issued as it stands.
    await click(screen, '[data-kana="both"]')                    // → the level list
    await click(screen, '[data-level="N5"]')
    await click(screen, '[data-action="continue"]')              // → the card, filled in
    await settle(120)
    await click(screen, '[data-action="issue"]')                 // the card, issued
    await settle(400)

    expect(screen.container.querySelector('.brd')).toBeNull()
    expect(window.location.pathname).toBe('/ride/cards')
  })
})

describe('a card kept at the boarding\'s gate', () => {
  // Keeping the card (lib/guest.js claimAccount) delivers USER_UPDATED,
  // a new session for the same user, a second before the card issues.
  // The gate used to ask for the profile again then; the answer left
  // before onboarded_at was stamped, landed after the boarding closed,
  // and put the learner back at its first question.
  it('does not ask the gate again, so a stale answer cannot reopen the boarding', async () => {
    let answerStale = null
    let profileAsks = 0
    apiJsonWithTimeout.mockImplementation(async path => {
      if (path === '/api/onboarding/complete') return { onboardedAt: '2026-10-25T14:08:14Z' }
      if (path !== '/api/profile') return {}
      profileAsks += 1
      if (profileAsks === 1) return { username: 'Tester', onboardedAt: null, jlptLevel: null, guided: {} }
      return new Promise(resolve => { answerStale = resolve })
    })

    const screen = await render(<App />)
    await settle(300)
    await click(screen, '[data-kana="both"]')
    await click(screen, '[data-level="N5"]')
    await click(screen, '[data-action="continue"]')
    await settle(120)

    authListener('USER_UPDATED', { ...session, access_token: 'tok2' })
    await settle()
    await click(screen, '[data-action="issue"]')
    await settle(400)
    answerStale?.({ username: 'Tester', onboardedAt: null, jlptLevel: null, guided: {} })
    await settle(300)

    expect(screen.container.querySelector('.brd')).toBeNull()
    expect(window.location.pathname).toBe('/ride/cards')
    expect(profileAsks).toBe(1)
  })
})
