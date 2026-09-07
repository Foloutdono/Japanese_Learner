import { supabase } from './supabase'

// ── 仮乗車券 — riding without an account ──────────────────────────
// A guest is a REAL Supabase user that simply has no credentials on
// it: signInAnonymously mints a normal `authenticated` token with a
// normal `sub`, so backend/core/auth.py verifies it exactly like any
// other and every card, review and credit the guest earns is ordinary
// server-side state under an ordinary user id. Nothing downstream
// needs to know, which is the whole reason for doing it this way —
// the alternative, a local-only guest, would have meant a second
// storage layer under every screen and a migration for progress that
// only ever existed on one device.
//
// The account a guest later creates is the SAME user: `updateUser`
// puts an email and a password onto the row it already has, so the id
// never changes and there is nothing to migrate. That is what makes
// "continue without an account" an honest offer rather than a trap.
//
// The one thing outside this file's control is the project setting:
// anonymous sign-ins are a toggle in the Supabase dashboard (Auth →
// Providers → Anonymous). With it off, signInAnonymously returns
// `anonymous_provider_disabled` and `startGuest` reports it as
// unavailable rather than throwing, so the caller can fall back to
// asking for an account up front — the flow this replaced.

/** Whether this session is riding on a guest pass. */
export function isGuest(session) {
  return session?.user?.is_anonymous === true
}

/**
 * Board without an account.
 *
 * -> { ok: true } — a guest session exists; the auth listener will
 *    deliver it like any other sign-in.
 * -> { ok: false, unavailable: true } — the project does not allow
 *    anonymous sign-ins. The caller should ask for a real account
 *    instead; this is configuration, not a fault the learner can fix.
 * -> { ok: false, message } — anything else (offline, rate limit).
 */
export async function startGuest() {
  try {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      // Supabase names the disabled provider in `code`; older
      // deployments only say it in the message, so both are read.
      const disabled = error.code === 'anonymous_provider_disabled'
        || /anonymous/i.test(error.message ?? '')
      return disabled
        ? { ok: false, unavailable: true }
        : { ok: false, message: error.message }
    }
    return data?.session ? { ok: true } : { ok: false, unavailable: true }
  } catch (err) {
    // supabase-js throws rather than returning on a transport failure.
    return { ok: false, message: err?.message }
  }
}

/**
 * 本乗車券 — turn the guest pass into a real one, in place.
 *
 * The id does not change, so everything already earned stays exactly
 * where it is. Whether the account is permanent the moment this
 * resolves depends on the project: with "confirm email" on, the
 * password is set immediately and the address only lands once the
 * learner follows the emailed link. `needsConfirmation` says which
 * happened so the caller can print the right sentence instead of
 * promising more than took effect.
 */
export async function claimAccount({ email, password }) {
  try {
    const { data, error } = await supabase.auth.updateUser({ email, password })
    if (error) return { ok: false, message: error.message }
    // A confirmed address arrives on the user straight away; a pending
    // one sits in new_email until the link is followed.
    const confirmed = !!data?.user?.email && data.user.email === email
      && data.user.is_anonymous !== true
    return { ok: true, needsConfirmation: !confirmed }
  } catch (err) {
    return { ok: false, message: err?.message }
  }
}
