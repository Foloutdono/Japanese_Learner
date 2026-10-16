import { describe, it, expect } from 'vitest'
import en from '../locales/en/index.js'
import fr from '../locales/fr/index.js'
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
    expect(authErrorMessage(undefined, en, { form: true })).toBeNull()
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
    expect(authErrorMessage({ code: 'email_address_invalid', message: supabaseSaid }, en))
      .toBe(en.claimEmailUnreachable)
    // …and by the sentence alone, for a deployment that sends no code.
    expect(authErrorMessage({ message: supabaseSaid }, en))
      .toBe(en.claimEmailUnreachable)
    expect(authErrorMessage({ code: 'email_address_not_authorized' }, en))
      .toBe(en.claimEmailUnreachable)
    expect(en.claimEmailUnreachable).toBeTruthy()
    expect(en.claimEmailUnreachable).not.toContain('""')
  })

  // Plan 210: the sign-in form printed Supabase's message as it came —
  // "Invalid login credentials", "Email not confirmed", "Unable to
  // validate email address: invalid format" — to a French learner.
  // Each is named by its code, and the same code passes the same
  // sentence in either language.
  it('names what the sign-in form is refused with', () => {
    for (const t of [fr, en]) {
      expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }, t, { form: true }))
        .toBe(t.authBadCredentials)
      expect(authErrorMessage({ code: 'email_not_confirmed', message: 'Email not confirmed' }, t, { form: true }))
        .toBe(t.authEmailNotConfirmed)
      expect(authErrorMessage({ code: 'validation_failed', message: 'Unable to validate email address: invalid format' }, t, { form: true }))
        .toBe(t.authEmailInvalid)
      expect(authErrorMessage({ code: 'validation_failed', message: 'Signup requires a valid password' }, t, { form: true }))
        .toBe(t.authCheckFields)
      expect(authErrorMessage({ code: 'signup_disabled', message: 'Signups not allowed for this instance' }, t, { form: true }))
        .toBe(t.authSignupDisabled)
      expect(authErrorMessage({ code: 'weak_password', message: 'Password should be at least 6 characters.' }, t, { form: true }))
        .toBe(t.claimWeakPassword)
      expect(authErrorMessage({ code: 'user_already_exists', message: 'User already registered' }, t, { form: true }))
        .toBe(t.claimEmailTaken)
      for (const key of ['authBadCredentials', 'authEmailNotConfirmed', 'authEmailInvalid', 'authCheckFields', 'authSignupDisabled']) {
        expect(t[key]).toBeTruthy()
      }
    }
  })

  // On the form nobody is a guest: an invalid address is the one typed,
  // not a confirmation that could not go out to a blank.
  it('reads an invalid address as the field’s on the form, the mail’s on the claim', () => {
    const refused = { code: 'email_address_invalid', message: 'Email address "a@example.com" is invalid' }
    expect(authErrorMessage(refused, fr, { form: true })).toBe(fr.authEmailInvalid)
    expect(authErrorMessage(refused, fr)).toBe(fr.claimEmailUnreachable)
  })

  // Off the form, the same code is Supabase refusing a provider it has
  // not enabled: "check your fields" under the Google button would send
  // the learner looking for a mistake that is not theirs.
  it('does not blame the fields for a provider refused', () => {
    const refused = { code: 'validation_failed', message: 'Unsupported provider: provider is not enabled' }
    expect(authErrorMessage(refused, fr)).toBe(fr.genericError)
  })

  // A confirmation link followed too late, or twice: it comes back on
  // the URL (lib/authRedirect.js) with Supabase's "Email link is
  // invalid or has expired".
  it('names a link that has expired', () => {
    expect(authErrorMessage({ code: 'otp_expired', description: 'Email link is invalid or has expired' }, fr))
      .toBe(fr.authLinkExpired)
    expect(fr.authLinkExpired).toBeTruthy()
  })

  // A dropped connection reaches supabase-js as a TypeError and comes
  // back as AuthRetryableFetchError: no code, and the browser's English
  // for a message ("Failed to fetch", Safari's "Load failed").
  it('says the generic line for a dropped connection', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }, fr, { form: true }))
      .toBe(fr.genericError)
    expect(authErrorMessage(new TypeError('Load failed'), fr)).toBe(fr.genericError)
  })

  it('never shows Supabase’s own sentence for anything unnamed', () => {
    expect(authErrorMessage({ code: 'bad_oauth_state', message: 'Invalid state' }, en)).toBe(en.genericError)
    expect(authErrorMessage({ code: 'something_new' }, en)).toBe(en.genericError)
    // oauth.js's own names for a broken round trip in the shell.
    expect(authErrorMessage({ code: 'no_credentials', message: 'no credentials on the callback' }, fr)).toBe(fr.genericError)
    expect(authErrorMessage({ code: 'no_authorization_url', message: 'no authorization url' }, fr)).toBe(fr.genericError)
  })
})
