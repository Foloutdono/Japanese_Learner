import { describe, it, expect } from 'vitest'
import en from '../locales/en/index.js'
import { authErrorMessage } from './authErrors'

// ── 改札 — the one table both refusal shapes read ────────────────
// A refusal reaches the app as a returned `{ code, message }` when the
// call stayed in the page, and as `error_code`/`error_description` on
// a URL when it went to Google and back. Same codes, so one table —
// and against the REAL en table, not a stub: a mistyped key renders as
// nothing at all, which is the silence this whole path exists to end
// (see locales.test.js).

describe('authErrorMessage', () => {
  it('says nothing when nothing was refused', () => {
    expect(authErrorMessage(null, en)).toBeNull()
    expect(authErrorMessage(undefined, en, 'ignored')).toBeNull()
  })

  it('names the provider refusals, whichever shape they arrived in', () => {
    expect(authErrorMessage({ code: 'identity_already_exists' }, en)).toBe(en.oauthAlreadyLinked)
    expect(authErrorMessage({ code: 'manual_linking_disabled' }, en)).toBe(en.oauthLinkingOff)
    expect(en.oauthAlreadyLinked).toBeTruthy()
    expect(en.oauthLinkingOff).toBeTruthy()
  })

  it('names the refusals a learner meets while claiming the pass', () => {
    expect(authErrorMessage({ code: 'email_exists' }, en)).toBe(en.claimEmailTaken)
    expect(authErrorMessage({ code: 'user_already_exists' }, en)).toBe(en.claimEmailTaken)
    expect(authErrorMessage({ code: 'weak_password' }, en)).toBe(en.claimWeakPassword)
    expect(authErrorMessage({ code: 'over_email_send_rate_limit' }, en)).toBe(en.claimTooSoon)
    expect(authErrorMessage({ code: 'over_request_rate_limit' }, en)).toBe(en.claimTooSoon)
    expect(en.claimEmailTaken).toBeTruthy()
    expect(en.claimWeakPassword).toBeTruthy()
    expect(en.claimTooSoon).toBeTruthy()
  })

  // The one Supabase sentence that must never be shown as it stands.
  // A guest has no current address, and Supabase quotes the address it
  // was about to MAIL rather than the one it was handed, so the
  // learner is told an empty string is invalid while their own address
  // sits filled in above it. See lib/guest.js for the whole path.
  it('never repeats the empty quoted address back at a learner', () => {
    const supabaseSaid = 'Email address "" is invalid'
    expect(authErrorMessage({ code: 'email_address_invalid', message: supabaseSaid }, en, supabaseSaid))
      .toBe(en.claimEmailUnreachable)
    // …and by the sentence alone, for a deployment that sends no code.
    expect(authErrorMessage({ message: supabaseSaid }, en, supabaseSaid))
      .toBe(en.claimEmailUnreachable)
    expect(authErrorMessage({ code: 'email_address_not_authorized' }, en))
      .toBe(en.claimEmailUnreachable)
    expect(en.claimEmailUnreachable).toBeTruthy()
    expect(en.claimEmailUnreachable).not.toContain('""')
  })

  it('prefers Supabase’s own sentence to a shrug for anything unnamed', () => {
    expect(authErrorMessage({ code: 'bad_oauth_state' }, en, 'Invalid state')).toBe('Invalid state')
    expect(authErrorMessage({ code: 'something_new' }, en)).toBe(en.genericError)
    expect(authErrorMessage({ code: 'something_new' }, en, '')).toBe(en.genericError)
  })
})
