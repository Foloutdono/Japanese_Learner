import { BOARD_PARAM } from './frontEntry'

// ── 外 — a page opened inside another app ────────────────────────
// Instagram, Facebook, TikTok… open a link in a browser of their own,
// whose storage is theirs and shared with no other browser on the
// phone. A guest pass (lib/guest.js) lives in that storage, so a
// learner who boards there and then moves to Safari or Chrome (the
// app's ⋯ menu offers it, and many take it) arrives with no pass, and
// Board mints a second one: in the thirty days to 2026-10-25, of the
// twelve accounts followed by another from the same address within
// three hours, eight began in Instagram's browser, most of them a
// minute or two before the second.
// So Board, in one of these, first offers the phone's own browser
// (App.jsx, components/boarding/OutsideSheet.jsx).
//
// Read off the user agent, which is the only place these browsers say
// who they are. A browser that names no app (Twitter's, which is
// Safari's own view) is not caught, and is not asked.
const APPS = [
  ['instagram', /\bInstagram\b/],
  ['facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\b|\bFBIOS\b/],
  // `musical_ly_36.5.0`: no word boundary after it.
  ['tiktok', /\bmusical_ly|\bBytedanceWebview\b|\bTikTok\b/],
  ['snapchat', /\bSnapchat\b/],
  ['linkedin', /\bLinkedInApp\b/],
  ['line', /\bLine\/\d/],
]

/** The app's name as it prints it, in every language. */
export const APP_NAMES = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  linkedin: 'LinkedIn',
  line: 'LINE',
}

const agent = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent ?? '')

/** The app whose browser this page is open in, or null. Never in the
 *  native shell, whose WebView is the app itself. */
export function inAppBrowser(ua = agent()) {
  if (import.meta.env.MODE === 'native') return null
  return APPS.find(([, test]) => test.test(ua))?.[0] ?? null
}

/** 'ios', 'android', or null: the phone's own browser differs. */
export function phoneOs(ua = agent()) {
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return 'ios'
  if (/\bAndroid\b/.test(ua)) return 'android'
  return null
}

/**
 * The address that hands this page's boarding to the phone's own
 * browser, or null where there is none to ask for. It opens on
 * `/app?board` (lib/frontEntry.js), so the browser mints the pass and
 * the boarding opens at once: Board is not pressed twice.
 *
 *   ios      Safari's own scheme, `x-safari-https://…`. Not every app's
 *            browser lets it through, which is why the sheet also says
 *            where the app's own menu is.
 *   android  an intent for Chrome, falling back to the same page here
 *            if Chrome is not installed.
 */
export function outsideUrl(origin, ua = agent()) {
  let target
  try { target = new URL(`/app?${BOARD_PARAM}`, origin) } catch { return null }
  const scheme = target.protocol.replace(':', '')
  const os = phoneOs(ua)
  if (os === 'ios') return `x-safari-${target.href}`
  if (os === 'android') {
    return `intent://${target.host}${target.pathname}${target.search}`
      + `#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target.href)};end`
  }
  return null
}
