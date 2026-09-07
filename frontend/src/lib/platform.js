// ── Where the app is running ──────────────────────────────────
// The one question the web build and the native shells (plan 076)
// answer differently: a WebView inside the store app can schedule a
// local notification, share a file, ask the OS for a permission; the
// browser cannot. Read through this module rather than sniffing
// `window.Capacitor` at the call site, so plan 076 has one place to
// wire the bridge and every branch on it is greppable.
//
// Until the shells exist this is false everywhere -- the boarding's
// nudge screen (plan 075) is the first caller, and it simply does not
// appear on the web, where there is nothing to schedule.
export function isNative() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

/** A daily local reminder can be scheduled here (native only). */
export function canNudge() {
  return isNative()
}
