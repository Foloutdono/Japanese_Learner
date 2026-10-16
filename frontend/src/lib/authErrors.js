// ── 改札 — Supabase's refusals, said to a learner ─────────────────
// Every auth refusal reaches the app in one of two shapes: as a
// returned value (`{ code, message }` off supabase-js) when the call
// stayed inside this page, and as a URL (`error_code`,
// `error_description`) when the round trip left for Google and came
// back (lib/authRedirect.js). Both carry the same `code`, so both are
// named here, once — two tables would have been two screens
// disagreeing about what the same refusal means.
//
// Only the codes that actually happen get a sentence of their own.
// Anything else — an unnamed code, a dropped connection (supabase-js's
// AuthRetryableFetchError carries no code, and its message is the
// browser's "Failed to fetch") — gets the table's generic line. It
// used to get Supabase's own sentence instead, as "a fact rather than
// a shrug"; but that sentence is English and written for developers,
// and this app is read in French first (plan 210). A refusal worth
// explaining is worth a line here.
//
// `email_address_invalid` is the code that made this file, and it is
// worth knowing why, because the sentence Supabase sends is not
// merely unfriendly — it is untrue. On the guest claim (lib/guest.js)
// the message quotes the address the mail was going OUT to, and for a
// guest that field is empty, so the learner is shown
//
//     Email address "" is invalid
//
// with their own address sitting filled in directly above it. The one
// thing they can act on is the only thing the sentence does not say.
// On the sign-in form, where nobody is a guest, the same code is about
// the address typed (`form`, below).
//
// This module is imported by lib/authRedirect.js, which loads before
// lib/supabase.js builds the client. Nothing here may gain an import
// with a side effect, or that ordering breaks.
const NAMED = {
  // The provider round trip.
  identity_already_exists: t => t.oauthAlreadyLinked,
  manual_linking_disabled: t => t.oauthLinkingOff,
  // Putting an address on the pass — and, the same refusals, signing
  // up with one.
  email_exists: t => t.claimEmailTaken,
  user_already_exists: t => t.claimEmailTaken,
  email_address_invalid: t => t.claimEmailUnreachable,
  email_address_not_authorized: t => t.claimEmailUnreachable,
  weak_password: t => t.claimWeakPassword,
  over_email_send_rate_limit: t => t.claimTooSoon,
  over_request_rate_limit: t => t.claimTooSoon,
  // The sign-in form (components/account/AuthCard.jsx).
  invalid_credentials: t => t.authBadCredentials,
  email_not_confirmed: t => t.authEmailNotConfirmed,
  signup_disabled: t => t.authSignupDisabled,
  email_provider_disabled: t => t.authSignupDisabled,
  // A confirmation link followed too late, or twice (a mail scanner
  // that opens links counts): it arrives on the URL (lib/authRedirect.js).
  otp_expired: t => t.authLinkExpired,
}

// What a code means on the sign-in form, where it differs. There is no
// guest there, so an invalid address is the one in the field; and
// `validation_failed` is about the two fields only there — off the
// form, the same code is Supabase refusing a provider it has not
// enabled ("Unsupported provider"), which the fields cannot fix.
const ON_FORM = {
  email_address_invalid: t => t.authEmailInvalid,
  // "Unable to validate email address: invalid format" is the one a
  // learner meets; the others under this code are a field left empty.
  validation_failed: (t, err) => (/invalid format/i.test(err.message ?? '') ? t.authEmailInvalid : t.authCheckFields),
}

// The empty quoted address, for a deployment that sends the sentence
// without a `code` beside it. Unmistakable, and the one message that
// must never reach a learner verbatim.
const EMPTY_ADDRESS = /^email address\s*""\s*is invalid/i

/**
 * The sentence for a learner, from whichever refusal shape arrived:
 * always one from the table, never Supabase's own.
 *
 * `form` is the sign-in form's reading of a code (ON_FORM).
 */
export function authErrorMessage(err, t, { form = false } = {}) {
  if (!err) return null
  const named = (form && ON_FORM[err.code]) || NAMED[err.code]
  if (named) return named(t, err)
  if (EMPTY_ADDRESS.test(err.message ?? '')) return t.claimEmailUnreachable
  return t.genericError
}
