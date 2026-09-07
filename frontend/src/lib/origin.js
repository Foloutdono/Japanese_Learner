// ── Where the backend is ──────────────────────────────────────
// Same-origin on the web, the Vercel origin inside the native shell —
// the whole reasoning is on lib/api.js's `api`, which re-exports this.
// It lives in its own module, with no imports, because it is reached
// from places that must not drag lib/api's supabase dependency in and
// from modules that tests stub lib/api out from under (LangContext →
// translationCache, DrawingCanvas, DictionaryDetail): a mock of lib/api
// that omits `api` must not break a screen that never called it.
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? ''

export const api = (path) => API_ORIGIN + path
