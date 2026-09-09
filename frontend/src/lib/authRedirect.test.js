import { describe, it, expect } from 'vitest'
import en from '../locales/en/index.js'
import {
  authRedirectMessage, isAlreadyLinked, isCancellation, parseAuthRedirect,
} from './authRedirect'

// ── 改札 — reading a refusal off the callback URL ────────────────
// The web's OAuth round trip has no return value: the page left for
// Google and came back as a new load, so everything the app knows
// about what happened is in the URL Supabase sent it to. These are the
// shapes that URL actually takes.

describe('parseAuthRedirect', () => {
  it('finds nothing on an ordinary load', () => {
    expect(parseAuthRedirect('https://app.test/')).toBeNull()
    expect(parseAuthRedirect('https://app.test/today?tab=2#section')).toBeNull()
  })

  it('is not fooled by a URL it cannot parse', () => {
    expect(parseAuthRedirect('not a url')).toBeNull()
    expect(parseAuthRedirect(undefined)).toBeNull()
  })

  it('reads the implicit flow’s refusal out of the fragment', () => {
    const err = parseAuthRedirect(
      'https://app.test/#error=server_error&error_code=identity_already_exists' +
      '&error_description=Identity+is+already+linked+to+another+user',
    )
    expect(err.error).toBe('server_error')
    expect(err.code).toBe('identity_already_exists')
    // `+` is a space, and the sentence is what a learner would be shown
    // if there were no named message for the code.
    expect(err.description).toBe('Identity is already linked to another user')
  })

  // The client's flowType decides which half of the URL carries it, and
  // lib/supabase.js is one line away from PKCE (docs/oauth.md). Reading
  // both means that change cannot silently blind this.
  it('reads the PKCE flow’s refusal out of the query', () => {
    const err = parseAuthRedirect('https://app.test/?error=access_denied&error_code=otp_expired')
    expect(err.error).toBe('access_denied')
    expect(err.code).toBe('otp_expired')
    expect(err.description).toBeNull()
  })

  // supabase-js reads the same URL, and an error left on it makes its
  // initialize() return early WITHOUT recovering the stored session —
  // which would sign a guest out of a boarding they are mid-way
  // through. Handing it a clean URL keeps that path ordinary.
  it('hands back the URL with the refusal taken off it', () => {
    expect(parseAuthRedirect(
      'https://app.test/#error=server_error&error_code=x&error_description=y',
    ).cleaned).toBe('https://app.test/')
    expect(parseAuthRedirect('https://app.test/today?tab=2&error=server_error').cleaned)
      .toBe('https://app.test/today?tab=2')
  })
})

describe('what a refusal means', () => {
  it('treats backing out at Google as an answer, not a fault', () => {
    // The shell already says nothing when the system browser is
    // dismissed (lib/oauth.js's `cancelled`); the web agrees.
    expect(isCancellation({ error: 'access_denied', code: null })).toBe(true)
    expect(isCancellation({ error: 'server_error', code: 'user_cancelled' })).toBe(true)
    expect(isCancellation(null)).toBe(false)
    // A named code is a real refusal even under access_denied — an
    // expired link is not a learner changing their mind.
    expect(isCancellation({ error: 'access_denied', code: 'otp_expired' })).toBe(false)
  })

  it('names the Google account that is already somebody’s pass', () => {
    expect(isAlreadyLinked({ code: 'identity_already_exists' })).toBe(true)
    expect(isAlreadyLinked({ code: 'manual_linking_disabled' })).toBe(false)
    expect(isAlreadyLinked(null)).toBe(false)
  })
})

describe('authRedirectMessage', () => {
  it('says nothing when nothing was refused', () => {
    expect(authRedirectMessage(null, en)).toBeNull()
  })

  // Against the real table, not a stub: a mistyped key renders as
  // nothing at all, which is the very silence this whole module exists
  // to end (see locales.test.js).
  it('has its own sentence for the two refusals that actually happen', () => {
    expect(authRedirectMessage({ code: 'identity_already_exists' }, en)).toBe(en.oauthAlreadyLinked)
    expect(authRedirectMessage({ code: 'manual_linking_disabled' }, en)).toBe(en.oauthLinkingOff)
    expect(en.oauthAlreadyLinked).toBeTruthy()
    expect(en.oauthLinkingOff).toBeTruthy()
  })

  it('falls back to Supabase’s own sentence, and only then to a shrug', () => {
    expect(authRedirectMessage({ code: 'bad_oauth_state', description: 'Invalid state' }, en))
      .toBe('Invalid state')
    expect(authRedirectMessage({ error: 'server_error' }, en)).toBe(en.genericError)
  })
})
