// ── 改札の戻り — the shell's way home from Google ────────────────
// The shell opens Google in the system browser (lib/native.js's
// openAuthTab) and waits for a deep link on its own scheme. Where
// Supabase sends the learner after the exchange is the `redirect_to`
// it was asked for — IF that URL is on the project's allowlist. When
// it is not, Supabase says nothing and redirects to the project's
// Site URL instead: the web app, in the custom tab. The tab then
// signs the WEB in with the new session and shows it the boarding
// from question one (no stash in that browser), while the shell
// underneath waits on a promise nothing will settle. That is the
// "Google works on the phone's browser and not in the app" report.
//
// So the shell no longer asks for its deep link directly. It asks for
// THIS path on the web origin, which Supabase accepts without any
// allowlist entry (a redirect onto the Site URL's own hostname is
// always honoured), and the page at that path forwards the callback —
// tokens, code or refusal, untouched — to the deep link the shell is
// listening for. One hop through the web, and no dashboard setting
// left to get wrong.
//
// No imports, on purpose: main.jsx reads this before deciding whether
// to boot the app at all, and lib/supabase.js reads it to keep
// supabase-js's hands off a fragment that is not the web's to take.

/** The shells' deep link. Registered in AndroidManifest.xml and
 *  Info.plist; anything else here has to change all three. */
export const NATIVE_REDIRECT = 'app.tsuji://auth-callback'

/** The web path the shell's round trip lands on before going home. */
export const NATIVE_RETURN_PATH = '/auth/native'

/** Whether this page load is the shell's callback passing through. */
export function isNativeReturn(href) {
  try {
    return new URL(href).pathname === NATIVE_RETURN_PATH
  } catch {
    return false
  }
}

/**
 * The deep link to forward this callback to: the same query and the
 * same fragment, on the shell's scheme, so lib/oauth.js reads exactly
 * what it would have read had Supabase sent it there itself.
 */
export function nativeReturnUrl(href) {
  try {
    const u = new URL(href)
    return `${NATIVE_REDIRECT}${u.search}${u.hash}`
  } catch {
    return NATIVE_REDIRECT
  }
}
