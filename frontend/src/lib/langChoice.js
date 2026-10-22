// ── The learner's language choice, kept on the account ───────────
// A choice made in Réglages › Affichage was kept in localStorage alone,
// and a browser forgets: Safari clears a site's storage after a week
// without a visit, a WebView purges it under pressure, a second device
// or a cleared cache starts empty. The language then fell back to the
// device's (French unless the device speaks English), and an English
// learner was switched back to French "constantly".
//
// So the choice is the ACCOUNT's (user_profiles.ui_lang), as the trail's
// switch is (stores/analyticsOptOut.js). localStorage stays: the first
// paint reads it synchronously, before the profile has answered. What
// holds:
//   - a choice is written here at once and up to the account;
//   - the account's answer lands on the device at boot (syncLang), so a
//     cleared browser or a new device reads the choice back;
//   - an account that was never asked takes the device's choice up, once;
//   - a write that did not reach the account (offline) is kept as
//     pending and wins over the account's older answer at the next boot;
//   - nothing but the learner's own click ever changes it.
import { SUPPORTED_LANGS } from './locale'

const KEY = 'lang'
// Set while the last choice has not reached the account.
const PENDING_KEY = 'jp-lang-pending'

const listeners = new Set()

function emit() { listeners.forEach(fn => fn()) }

export function subscribeLang(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function get(key) {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function set(key, value) {
  try { window.localStorage.setItem(key, value) } catch { /* private mode: held for this tab only */ }
}

function drop(key) {
  try { window.localStorage.removeItem(key) } catch { /* nothing to clear */ }
}

/** The language the learner chose on this device, or null if never. */
export function savedLang() {
  const saved = typeof window === 'undefined' ? null : get(KEY)
  return SUPPORTED_LANGS.includes(saved) ? saved : null
}

function writeAccount(code, session) {
  // Loaded here rather than at the top, for the reason
  // stores/analyticsOptOut.js gives: this module is read at boot.
  return import('./api').then(({ apiJson }) => apiJson('/api/profile/learning', session, {
    method: 'PATCH',
    body: JSON.stringify({ uiLang: code }),
  })).then(
    () => { if (get(KEY) === code) drop(PENDING_KEY) },
    () => { /* stays pending; the next boot's syncLang writes it again */ },
  )
}

/**
 * The learner's choice: this device at once, and the account when there
 * is a session to write it with. `session` may be a promise (the
 * language context holds none and asks for one).
 */
export function rememberLang(code, session) {
  if (!SUPPORTED_LANGS.includes(code)) return
  set(KEY, code)
  set(PENDING_KEY, '1')
  emit()
  Promise.resolve(session).then(s => { if (s) return writeAccount(code, s) })
}

/**
 * On boot, with the profile's `uiLang`. The account's answer wins, except
 * where this device holds a choice the account has not heard (never
 * asked, or a write that failed): that one is carried up instead.
 */
export function syncLang(accountLang, session) {
  if (accountLang !== null && !SUPPORTED_LANGS.includes(accountLang)) return
  const local = savedLang()
  if (local && (accountLang === null || get(PENDING_KEY) === '1')) {
    if (local !== accountLang) writeAccount(local, session)
    else drop(PENDING_KEY)
    return
  }
  if (accountLang && accountLang !== local) {
    set(KEY, accountLang)
    emit()
  }
}
