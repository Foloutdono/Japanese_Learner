import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── 改札 — the Google round trip ─────────────────────────────────
// Two builds, two entirely different journeys to the same place, and
// the branch between them cannot be exercised by hand here: the shell
// half needs a Capacitor bridge and the web half ends by navigating
// the page away. So it is pinned at the seam instead — what Supabase
// is asked for, and what is done with what it gives back.
//
// The details that actually break sign-in in production, and each has
// a case below: the redirect must be the app's own origin (or the
// shells' scheme) rather than Supabase's default Site URL; the shell
// must ask Supabase NOT to navigate, since its WebView cannot come
// home; and a guest must be LINKED, never signed in afresh, or the
// account they were promised they were keeping is quietly swapped for
// an empty one.

const auth = {
  signInWithOAuth: vi.fn(),
  linkIdentity: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
}
const isNative = vi.fn(() => false)
const openAuthTab = vi.fn()

vi.mock('./supabase', () => ({ supabase: { auth } }))
vi.mock('./platform', () => ({ isNative: () => isNative() }))
vi.mock('./native', () => ({ openAuthTab: (...a) => openAuthTab(...a) }))

const { connectProvider, redirectTarget, NATIVE_REDIRECT } = await import('./oauth')

beforeEach(() => {
  for (const m of [auth.signInWithOAuth, auth.linkIdentity, auth.exchangeCodeForSession, auth.setSession, openAuthTab]) m.mockReset()
  isNative.mockReturnValue(false)
  // A known origin, so the assertion names the value rather than
  // restating whatever the lane happens to be served from.
  vi.stubGlobal('window', { location: { origin: 'https://app.test' } })
  auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.test/o' }, error: null })
  auth.linkIdentity.mockResolvedValue({ data: { url: 'https://accounts.google.test/o' }, error: null })
  auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null })
  auth.setSession.mockResolvedValue({ data: {}, error: null })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('where Supabase sends the learner back', () => {
  it('is the app\'s own origin on the web, not wherever Site URL points', () => {
    expect(redirectTarget()).toBe('https://app.test/')
  })

  it('is the shells\' deep link in the shell, which Google never sees', () => {
    isNative.mockReturnValue(true)
    expect(redirectTarget()).toBe(NATIVE_REDIRECT)
    // The manifests are written against this exact string.
    expect(NATIVE_REDIRECT).toBe('com.japaneselearner.app://auth-callback')
  })
})

describe('on the web', () => {
  it('lets supabase-js navigate, and says the frame is over', async () => {
    const r = await connectProvider({})
    expect(r).toEqual({ ok: true, redirecting: true })
    const [[args]] = auth.signInWithOAuth.mock.calls
    expect(args.provider).toBe('google')
    expect(args.options.redirectTo).toBe('https://app.test/')
    // Navigation is the whole mechanism here; skipping it would leave
    // the learner on a page that never goes anywhere.
    expect(args.options.skipBrowserRedirect).toBe(false)
    expect(openAuthTab).not.toHaveBeenCalled()
  })

  it('reports a refusal instead of pretending to have left', async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: { message: 'provider is not enabled' } })
    expect(await connectProvider({}))
      .toEqual({ ok: false, reason: 'providerOff', message: 'provider is not enabled' })
  })
})

describe('in the shell', () => {
  beforeEach(() => { isNative.mockReturnValue(true) })

  it('keeps the WebView where it is and finishes the exchange itself', async () => {
    openAuthTab.mockResolvedValue('com.japaneselearner.app://auth-callback?code=abc123')
    const r = await connectProvider({})
    expect(r).toEqual({ ok: true })

    const [[args]] = auth.signInWithOAuth.mock.calls
    // The one flag that matters: a WebView whose origin is the bundle
    // cannot navigate to Google and come home.
    expect(args.options.skipBrowserRedirect).toBe(true)
    expect(args.options.redirectTo).toBe(NATIVE_REDIRECT)
    // The authorization page goes to the system browser, and only a
    // deep link on our own scheme is listened for.
    expect(openAuthTab).toHaveBeenCalledWith('https://accounts.google.test/o', 'com.japaneselearner.app://')
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123')
  })

  it('treats closing the browser as an answer, not a fault', async () => {
    openAuthTab.mockResolvedValue(null)
    expect(await connectProvider({})).toEqual({ ok: false, cancelled: true })
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  // supabase-js still defaults to IMPLICIT, so the callback normally
  // carries tokens in the fragment and never a code. Reading only
  // ?code= here would have meant a sign-in that worked everywhere it
  // was tested and silently did nothing on a phone.
  it('takes the session straight off the fragment under the implicit flow', async () => {
    openAuthTab.mockResolvedValue(
      'com.japaneselearner.app://auth-callback#access_token=at1&refresh_token=rt1&token_type=bearer',
    )
    expect(await connectProvider({})).toEqual({ ok: true })
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'at1', refresh_token: 'rt1' })
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('will not half-accept a fragment carrying only an access token', async () => {
    openAuthTab.mockResolvedValue('com.japaneselearner.app://auth-callback#access_token=at1')
    expect((await connectProvider({})).ok).toBe(false)
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('does not invent a session when the callback carries a refusal', async () => {
    openAuthTab.mockResolvedValue('com.japaneselearner.app://auth-callback?error=access_denied')
    const r = await connectProvider({})
    expect(r.ok).toBe(false)
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it('passes a failed exchange back rather than reporting success', async () => {
    openAuthTab.mockResolvedValue('com.japaneselearner.app://auth-callback?code=abc123')
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'code expired' } })
    expect(await connectProvider({}))
      .toEqual({ ok: false, reason: 'failed', message: 'code expired' })
  })
})

// The learner never sees Supabase's wording, so every refusal has to
// arrive as one of the handful of reasons the copy has a sentence for.
// This is the case that actually happened: manual linking off, and
// "Manual linking is disabled" printed in English under the password
// field of a French boarding screen.
describe('naming the refusal for the learner', () => {
  it.each([
    ['Manual linking is disabled', 'linkingOff'],
    ['Unsupported provider: provider is not enabled', 'providerOff'],
    ['Identity is already linked to another user', 'taken'],
    ['User already registered', 'taken'],
    ['something nobody has seen before', 'failed'],
  ])('%s → %s', async (message, reason) => {
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: { message } })
    expect((await connectProvider({})).reason).toBe(reason)
  })

  it('reads the code when Supabase sends one', async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: {}, error: { code: 'manual_linking_disabled', message: '' },
    })
    expect((await connectProvider({})).reason).toBe('linkingOff')
  })
})

describe('a guest keeping what they have', () => {
  it('LINKS the provider rather than signing in as somebody new', async () => {
    await connectProvider({ link: true })
    expect(auth.linkIdentity).toHaveBeenCalledTimes(1)
    // The distinction is the learner's entire history: signInWithOAuth
    // here would hand them a fresh, empty account and say nothing.
    expect(auth.signInWithOAuth).not.toHaveBeenCalled()
    expect(auth.linkIdentity.mock.calls[0][0].provider).toBe('google')
  })

  it('reports manual linking being off, and never falls back to a sign-in', async () => {
    auth.linkIdentity.mockResolvedValue({ data: {}, error: { message: 'Manual linking is disabled' } })
    const r = await connectProvider({ link: true })
    // The reason is what the UI translates; the message is Supabase's
    // own words, kept for the console and never shown to a learner.
    expect(r).toEqual({ ok: false, reason: 'linkingOff', message: 'Manual linking is disabled' })
    expect(auth.signInWithOAuth).not.toHaveBeenCalled()
  })
})
