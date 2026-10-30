// ── 訪問の文脈 — what a visit was made on, in classes (plan 218) ──────
//
// The session_start of every visit carries these, so the dashboards can
// split anything by phone and desk, by system, by language. Each is a
// COARSE CLASS, read once and reduced here, and never the value it was
// read from: no user agent, no screen size, no time zone, no list of
// fonts. That is the line between measuring an audience and
// fingerprinting a device, and the CNIL exemption the trail relies on
// (docs/adr/0022) is only available on the near side of it. The server
// holds every one of these to its enum (backend/core/events.py VALUES)
// and drops anything else.
import { DESK_QUERY } from '../hooks/useDesk'
import { SUPPORTED_LANGS, pickInitialLang } from './locale'

const media = query => {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.(query).matches === true
  } catch {
    return false
  }
}

/** phone / tablet / desk / wide. Desk is useDesk's own line. */
export function viewportClass(width, desk = media(DESK_QUERY)) {
  if (desk) return width >= 1600 ? 'wide' : 'desk'
  return width >= 600 ? 'tablet' : 'phone'
}

/** The system's family, from the user agent, which is read and dropped. */
export function osFamily(ua = '', platform = '') {
  const s = `${ua} ${platform}`
  // iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
  if (/iPhone|iPad|iPod/i.test(s)) return 'ios'
  if (/Macintosh|Mac OS X|MacIntel/i.test(s)) {
    return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 ? 'ios' : 'mac'
  }
  if (/Android/i.test(s)) return 'android'
  if (/CrOS/i.test(s)) return 'chromeos'
  if (/Windows/i.test(s)) return 'windows'
  if (/Linux/i.test(s)) return 'linux'
  return 'other'
}

function themeChoice() {
  try {
    // stores/theme.js's key; read here rather than imported so the
    // trail does not pull React into the node lane.
    const saved = window.localStorage.getItem('jp-theme')
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

function langCode() {
  try {
    const saved = window.localStorage.getItem('lang')
    if (SUPPORTED_LANGS.includes(saved)) return saved
  } catch { /* the document's own language below */ }
  const doc = typeof document !== 'undefined' ? document.documentElement.lang : ''
  return pickInitialLang(null, doc)
}

/** The visit's context, as session_start carries it. */
export function visitContext() {
  if (typeof window === 'undefined') return {}
  const nav = typeof navigator !== 'undefined' ? navigator : {}
  return {
    platform: import.meta.env.MODE === 'native' ? 'native' : 'web',
    vp: viewportClass(window.innerWidth || 0),
    os: osFamily(nav.userAgent, nav.platform),
    lang: langCode(),
    theme: themeChoice(),
    input: media('(pointer: coarse)') ? 'touch' : 'mouse',
    standalone: media('(display-mode: standalone)'),
    reduced: media('(prefers-reduced-motion: reduce)'),
  }
}
