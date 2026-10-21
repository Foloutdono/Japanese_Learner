import { supabase } from './supabase'
import { emailRedirectTarget } from './oauth'

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

// ── A pass put down is picked up again ────────────────────────────
// Backing out of the boarding's first question signs the guest out (the
// Welcome is only drawn without a session), and the next Board used to
// mint a second guest: a visitor who bounced three times left three
// users behind, 36 of the first 46 anonymous accounts never answered a
// card. A guest left at that point has done nothing, so its tokens are
// parked on this device and the next Board takes the SAME user back.
// Only the boarding's own exit parks one; Settings' sign-out of a guest
// with progress ("will erase it for good") never does.
const PARKED_KEY = 'tsuji.parkedGuest'

/** Keep the tokens of a guest session about to be signed out. */
export function parkGuest(session) {
  if (!isGuest(session) || !session.access_token || !session.refresh_token) return
  try {
    localStorage.setItem(PARKED_KEY, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }))
  } catch { /* storage refused: the next Board mints a pass, as before */ }
}

/** Drop a parked pass (the learner went to sign in to an account). */
export function forgetParkedGuest() {
  try { localStorage.removeItem(PARKED_KEY) } catch { /* nothing to drop */ }
}

// True when the parked pass was restored. Single use: it is removed
// before it is tried, so a dead one is never tried twice.
async function resumeParkedGuest() {
  let creds = null
  try {
    creds = JSON.parse(localStorage.getItem(PARKED_KEY) ?? 'null')
  } catch { /* unreadable: treated as none */ }
  forgetParkedGuest()
  if (!creds?.access_token || !creds?.refresh_token) return false
  try {
    const { data, error } = await supabase.auth.setSession(creds)
    return !error && isGuest(data?.session)
  } catch {
    return false
  }
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
    if (await resumeParkedGuest()) return { ok: true }
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      // Supabase names the disabled provider in `code`; older
      // deployments only say it in the message, so both are read.
      const disabled = error.code === 'anonymous_provider_disabled'
        || /anonymous sign-?ins are disabled/i.test(error.message ?? '')
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
 *
 * ── The second project setting, and the sentence it produces ──────
 * "Confirm email" (Authentication → Providers → Email) is not merely
 * the difference between two success messages here: with it ON, this
 * call can refuse a guest outright, and refuse them in words that
 * blame the address they just typed. Supabase's own code, for a user
 * who is still anonymous:
 *
 *   api/user.go   an anonymous user gets the auto-confirm shortcut
 *                 ONLY when Mailer.Autoconfirm is set — which is
 *                 "Confirm email" being OFF. Otherwise the update
 *                 takes the ordinary email-CHANGE road.
 *   api/mail.go   sendEmailChange() calls sendEmail() without a
 *                 recipient, so it falls back to the user's CURRENT
 *                 address … which a guest does not have.
 *                 Any failure on that road is then reported as
 *                 `Email address %q is invalid` with that empty
 *                 field quoted, i.e.
 *
 *                     Email address "" is invalid
 *
 * So the message names nothing the learner wrote and nothing they can
 * fix. `code` is carried out of here for exactly that reason:
 * lib/authErrors.js turns `email_address_invalid` into a sentence
 * that points at the routes which still work, rather than repeating
 * a quoted blank back at someone with their address on screen.
 */
export async function claimAccount({ email, password, lang }) {
  try {
    // `data` is the user's metadata, written before the confirmation is
    // sent: `lang` is what the dashboard's e-mail templates branch on
    // ({{ .Data.lang }}), so the learner who claimed the pass in French
    // is mailed in French (plan 215). Omitted when unknown.
    // `emailRedirectTo`: the confirmation lands on the origin the pass
    // was claimed on, not on the project's Site URL (lib/oauth.js).
    const { data, error } = await supabase.auth.updateUser({
      email, password, ...(lang ? { data: { lang } } : {}),
    }, { emailRedirectTo: emailRedirectTarget() })
    // `code` is the part worth having: the message is English-only and
    // sometimes describes the wrong field (see above).
    if (error) return { ok: false, code: error.code, message: error.message }
    // A confirmed address arrives on the user straight away; a pending
    // one sits in new_email until the link is followed.
    const confirmed = !!data?.user?.email && data.user.email === email
      && data.user.is_anonymous !== true
    return { ok: true, needsConfirmation: !confirmed }
  } catch (err) {
    return { ok: false, message: err?.message }
  }
}

/**
 * 本乗車券 by a link (plan 247) — the card's account sheet: an address
 * and nothing else. Supabase mails it a link; followed, the address is
 * the account's, on the same id as everything else, so nothing moves.
 * No password is set, which is the point (the sign-in card mails a link
 * too, components/account/AuthCard.jsx). The project's "confirm email"
 * road is claimAccount's, above, refusals and all: `code` is carried out
 * for lib/authErrors.js.
 */
export async function claimByLink({ email, lang }) {
  try {
    const { error } = await supabase.auth.updateUser({
      email, ...(lang ? { data: { lang } } : {}),
    }, { emailRedirectTo: emailRedirectTarget() })
    if (error) return { ok: false, code: error.code, message: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err?.message }
  }
}

// ── Asked to keep the card (plan 269) ─────────────────────────────
// A guest is asked for an address before the card is issued (the
// boarding's gate) and again on Today, at most once a day, never told
// they must: « Continuer en invité » is always the way past it. The
// note is per user and per local day, on this device: cleared storage
// costs one more ask, never a lost card.
const ASKED_KEY = 'tsuji.keepAsked'
const ASKED_KEEP = 8

const localDay = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

function readAsked() {
  try {
    const raw = JSON.parse(localStorage.getItem(ASKED_KEY) ?? '{}')
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

/**
 * Whether a session is one to ask: a guest whose address is not
 * already on its way (a link sent and not yet followed sits in
 * `new_email`), not yet asked today on this device.
 */
export function shouldAskToKeep(session, now = new Date()) {
  const user = session?.user
  if (!isGuest(session) || !user?.id || user.new_email) return false
  return readAsked()[user.id] !== localDay(now)
}

/** Note that `userId` was asked today. */
export function noteAskedToKeep(userId, now = new Date()) {
  if (!userId) return
  const kept = Object.entries(readAsked()).filter(([id]) => id !== userId).slice(-(ASKED_KEEP - 1))
  try {
    localStorage.setItem(ASKED_KEY, JSON.stringify(Object.fromEntries([...kept, [userId, localDay(now)]])))
  } catch { /* not persisted: asked again on the next visit */ }
}
