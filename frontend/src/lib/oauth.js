import { supabase } from './supabase'
import { isNative } from './platform'

// The shell's half, loaded only once isNative() has said yes — the
// same rule lib/platform.js follows, so the web bundle never carries a
// Capacitor plugin and a web test never loads one. Reaching it from
// here rather than through another named export on platform.js also
// keeps this off the list of things a partial vi.mock of platform can
// break in a suite that never signs anyone in.
const native = () => import('./native')

// ── 改札 — signing in through Google ─────────────────────────────
// Supabase runs the whole exchange: the browser goes to the project's
// /authorize, Google returns to the project's /auth/v1/callback — the
// two URLs registered in the Cloud console — and only then does
// Supabase send the learner back to us. So Google never sees this
// app's own redirect, which is why the shells can use a custom scheme
// that Google would refuse outright on a Web client.
//
// Where "back to us" is differs by build, and so does how we get
// there:
//
//   web    the page navigates away and returns; nothing in memory
//          survives (see BoardingFlow's stash for what that costs
//          mid-boarding).
//   shell  the WebView must NOT navigate — its origin is the bundle,
//          and a page that leaves it cannot come home. The OAuth page
//          opens in the system browser instead and the answer arrives
//          as a deep link on the scheme below, with the WebView still
//          mounted the whole time.
//
// Both of these have to be in Supabase's own Redirect URLs allowlist
// (Authentication → URL Configuration) or the round trip ends on
// Supabase's error page instead of here. See docs/oauth.md.

/** The shells' deep link. Registered in AndroidManifest.xml and
 *  Info.plist; anything else here has to change all three. */
export const NATIVE_REDIRECT = 'com.japaneselearner.app://auth-callback'

/** Where Supabase should send the learner back to. */
export function redirectTarget() {
  if (isNative()) return NATIVE_REDIRECT
  // The origin, not href: a redirect back onto a deep path would be
  // allowlisted separately, and the app routes itself from / anyway.
  return `${window.location.origin}/`
}

// What the callback carries depends on the client's flowType, and the
// shell has to read it by hand either way — the deep link never
// touches the page, so detectSessionInUrl (which does this for us on
// the web) never sees it.
//
//   pkce      ?code=…                  → exchangeCodeForSession
//   implicit  #access_token=…&refresh… → setSession
//
// supabase-js still defaults to implicit, and this app does not
// override it; both are read anyway so that turning PKCE on later —
// which is worth doing, see docs/oauth.md — is a one-line change in
// lib/supabase.js and not a silent breakage out here.
function credentialsFrom(url) {
  try {
    const u = new URL(url)
    const code = u.searchParams.get('code')
    if (code) return { code }
    // The fragment is not part of searchParams; it is its own query.
    const frag = new URLSearchParams(u.hash.replace(/^#/, ''))
    const access_token = frag.get('access_token')
    const refresh_token = frag.get('refresh_token')
    if (access_token && refresh_token) return { access_token, refresh_token }
    return null
  } catch {
    return null
  }
}

// Supabase's own wording, turned into something the UI can translate.
// The raw message is developer text — "Manual linking is disabled" is
// a dashboard setting a LEARNER cannot act on, and it reached a French
// learner's screen in English on the first real sign-in attempt. It is
// still returned alongside, for the console and for docs/oauth.md's
// benefit; it is just never the thing shown to somebody trying to
// study Japanese.
function reasonFor(error) {
  const said = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase()
  if (said.includes('manual link') || said.includes('manual_link')) return 'linkingOff'
  if (said.includes('not enabled') || said.includes('provider_disabled')) return 'providerOff'
  if (said.includes('already') && (said.includes('registered') || said.includes('linked') || said.includes('exists'))) return 'taken'
  return 'failed'
}

/**
 * Sign in with a provider, or — with `link` — put that provider onto
 * the account already signed in, which is how a guest keeps every
 * card, review and credit they earned before deciding to keep them.
 *
 * -> { ok: true }            the shell finished the round trip here
 * -> { ok: true, redirecting: true }  the web is leaving; nothing after
 *                            this call will run
 * -> { ok: false, reason, message }  reason is for the learner (the UI
 *                            translates it); message is Supabase's own
 *                            words, for the console
 *
 * `link` needs manual linking enabled on the project. Where losing the
 * current account would be silent data loss the caller must NOT retry
 * unlinked — see components/settings/AccountPage.jsx.
 */
export async function connectProvider({ provider = 'google', link = false } = {}) {
  const inShell = isNative()
  const options = {
    redirectTo: redirectTarget(),
    // In the shell we want the URL, not a navigation: the WebView has
    // to stay exactly where it is.
    skipBrowserRedirect: inShell,
  }

  try {
    const call = link
      ? supabase.auth.linkIdentity({ provider, options })
      : supabase.auth.signInWithOAuth({ provider, options })
    const { data, error } = await call
    if (error) return { ok: false, reason: reasonFor(error), message: error.message }

    if (!inShell) {
      // supabase-js has already set window.location; this frame is
      // over. Saying so lets the caller keep its spinner up rather
      // than flashing a finished state before the page goes.
      return { ok: true, redirecting: true }
    }

    if (!data?.url) return { ok: false, reason: 'failed', message: 'no authorization url' }
    const { openAuthTab } = await native()
    const back = await openAuthTab(data.url, `${NATIVE_REDIRECT.split('://')[0]}://`)
    if (!back) return { ok: false, cancelled: true }

    const creds = credentialsFrom(back)
    // No code and no tokens means the callback carried a refusal (or
    // an error) — never a session, so never report one.
    if (!creds) return { ok: false, reason: 'failed', message: 'no credentials on the callback' }
    const { error: sessionError } = creds.code
      ? await supabase.auth.exchangeCodeForSession(creds.code)
      : await supabase.auth.setSession(creds)
    if (sessionError) return { ok: false, reason: reasonFor(sessionError), message: sessionError.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: 'failed', message: err?.message }
  }
}
