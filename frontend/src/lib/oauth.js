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
export const NATIVE_REDIRECT = 'app.tsuji://auth-callback'

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

/**
 * Sign in with a provider, or — with `link` — put that provider onto
 * the account already signed in, which is how a guest keeps every
 * card, review and credit they earned before deciding to keep them.
 *
 * -> { ok: true }            the shell finished the round trip here
 * -> { ok: true, redirecting: true }  the web is leaving; nothing after
 *                            this call will run
 * -> { ok: false, message }  anything else, already human-readable
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
    // 券面の名義 — WHICH Google account, asked every time.
    //
    // Without this, Google signs in whichever account the browser is
    // already holding, silently, whenever there is exactly one. That
    // is the wrong default for both halves of this call:
    //
    //   sign-in  a Google account no pass carries is a NEW pass, and
    //            a new pass has no journey on it — so App.jsx reads
    //            onboarded_at as null and starts the boarding from
    //            question one. A learner whose journey is on their
    //            OTHER address never sees a chooser, and cannot tell
    //            why the app forgot them.
    //   link     the address being written onto this pass is not one
    //            the learner picked.
    //
    // `select_account` is the parameter Google reads for it; other
    // providers ignore an unknown prompt rather than refusing.
    queryParams: { prompt: 'select_account' },
  }

  try {
    const call = link
      ? supabase.auth.linkIdentity({ provider, options })
      : supabase.auth.signInWithOAuth({ provider, options })
    const { data, error } = await call
    if (error) return { ok: false, message: error.message }

    if (!inShell) {
      // supabase-js has already set window.location; this frame is
      // over. Saying so lets the caller keep its spinner up rather
      // than flashing a finished state before the page goes.
      return { ok: true, redirecting: true }
    }

    if (!data?.url) return { ok: false, message: 'no authorization url' }
    const { openAuthTab } = await native()
    const back = await openAuthTab(data.url, `${NATIVE_REDIRECT.split('://')[0]}://`)
    if (!back) return { ok: false, cancelled: true }

    const creds = credentialsFrom(back)
    // No code and no tokens means the callback carried a refusal (or
    // an error) — never a session, so never report one.
    if (!creds) return { ok: false, message: 'no credentials on the callback' }
    const { error: sessionError } = creds.code
      ? await supabase.auth.exchangeCodeForSession(creds.code)
      : await supabase.auth.setSession(creds)
    if (sessionError) return { ok: false, message: sessionError.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err?.message }
  }
}

/**
 * Whether the account behind this session already carries an identity
 * from `provider`.
 *
 * Two sources, because they fail in different places: `app_metadata
 * .providers` is a claim on the token itself, so it is present the
 * moment a session exists and is re-read on every refresh; `identities`
 * is the fuller list on the user object, and is what a freshly linked
 * identity lands in. Either saying yes is a yes.
 *
 * Used to decide whether to OFFER Google on an account that already
 * has a key (Settings › Account): an account that has it needs no
 * offer, and one that lacks it has no other way to be reached by the
 * Google button on the sign-in screen — signing in there would make a
 * second, empty account rather than opening this one.
 */
export function hasProvider(session, provider = 'google') {
  const user = session?.user
  if (!user) return false
  const claimed = user.app_metadata?.providers
  if (Array.isArray(claimed) && claimed.includes(provider)) return true
  const identities = user.identities
  return Array.isArray(identities) && identities.some(i => i?.provider === provider)
}
