import { supabase } from './supabase'

// Same-origin, unconditionally — on the web. This used to resolve
// against VITE_API_URL, until the deployed value pointed the browser
// straight at onrender.com — a zone some mobile carriers cannot reach
// at all (2026-09-01: every preflight died in transit) — and a leftover
// copy of the variable in the Vercel dashboard silently out-prioritised
// the tracked .env.production that had been emptied to fix it. The API
// is reached through the app's own origin everywhere (Vite proxy in
// dev, vercel.json rewrites in prod), so a knob for the web build only
// ever existed to reintroduce the outage.
//
// The one exception is the native shell (plan 066, ADR 0008). A
// WebView's own origin is capacitor://localhost on iOS and
// https://localhost on Android, and it serves nothing but the bundle,
// so there the app needs an absolute origin — the VERCEL one, so the
// rewrite proxy stays in the path and no build ever talks to
// onrender.com. It is set only by .env.native (`vite build --mode
// native`); vite.config.js refuses any other build that carries it,
// which is what keeps a dashboard leftover from doing this again.
//
// Bundled assets (/sounds) never pass through here: in the
// shell they live inside the app and resolving them against the web
// origin would fetch them over the network instead.
//
// The value itself lives in lib/origin.js (see there for why); this is
// the name every backend caller imports.
export { api } from './origin'
import { api } from './origin'
import { reportApiFailure } from './apiFailure'
import { releaseNotice } from '../stores/releaseNotice'

// ── 401 recovery ──────────────────────────────────────────────
// A session the backend rejects used to be invisible: supabase-js
// keeps handing out its cached session, every request 401s, and each
// screen's quiet-failure path renders the "nothing here" state — a
// dead token was indistinguishable from an empty account, on every
// screen at once. (Diagnosed live on production, 2026-09-01: the gate
// hall renders, the map is empty, and seven 401s sit in the console
// with nothing on screen admitting to any of them.)
//
// So a 401 on a request that DID carry a session now tries to mend the
// session once: refresh, and if Supabase won't refresh, sign out —
// which lands on the login screen instead of a hollow app. The caller
// still gets its ApiError for the request that failed; recovery works
// through the auth listener in App (a refreshed session is a new
// session object, so every screen's [session] effect refetches).
let recovery = null
let lastRefreshAt = 0

function recoverAuth() {
  // Single-flight: a screen's worth of parallel 401s is one refresh.
  if (recovery) return recovery
  recovery = (async () => {
    try {
      // A token minted by a refresh moments ago is still being
      // rejected — the backend refuses even fresh credentials, and
      // another refresh would just loop. Drop the session instead.
      if (Date.now() - lastRefreshAt < 15000) {
        await supabase.auth.signOut({ scope: 'local' })
        return
      }
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data?.session) {
        // 'local' on purpose: this device's session is the broken
        // one; the default 'global' would also revoke the user's
        // other devices.
        await supabase.auth.signOut({ scope: 'local' })
      } else {
        lastRefreshAt = Date.now()
      }
    } catch {
      // Offline, or the placeholder client — the ApiError already on
      // its way to the caller is the honest report.
    } finally {
      recovery = null
    }
  })()
  return recovery
}

// 足跡 — a failed request is announced through lib/apiFailure.js (see there
// for what counts), so this file never imports the trail it is carried by.
function isAbort(err) {
  return err?.name === 'AbortError'
}

async function send(path, init) {
  let response
  try {
    response = await fetch(api(path), init)
  } catch (err) {
    if (!isAbort(err)) reportApiFailure(path, 0)
    throw err
  }
  if (response.status >= 500) reportApiFailure(path, response.status)
  // 工事 — whether a release is announced rides on every answer (plan 262).
  releaseNotice.seen(response)
  return response
}

// ── 429, a learner asking too much at once (plan 211) ──────────
// The server holds each learner to a few requests at once, queues the
// next ones and refuses past the queue: a 429, {"detail":
// "too_many_requests"}, with Retry-After. It is not a failure of the
// server (lib/apiFailure counts 5xx and no answer only), and a read
// is asked once more after the wait the server names, held to a few
// seconds. A write is never sent twice: the caller hears the 429.
const RETRY_CAP_MS = 5000

function retryDelay(response) {
  const seconds = Number(response.headers?.get?.('Retry-After'))
  return seconds > 0 ? Math.min(RETRY_CAP_MS, seconds * 1000) : 1000
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, ms)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function apiFetch(path, session, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers,
  }
  let response = await send(path, { ...options, headers })
  const method = (options.method ?? 'GET').toUpperCase()
  if (response.status === 429 && (method === 'GET' || method === 'HEAD')) {
    await wait(retryDelay(response), options.signal)
    response = await send(path, { ...options, headers })
  }
  // Only when a session was presented and refused — a 401 on a
  // sessionless call is the endpoint doing its job.
  if (response.status === 401 && session) recoverAuth()
  return response
}

// ── Error-aware JSON fetch ────────────────────────────────────
// apiFetch deliberately keeps its raw-Response contract (many callers
// read headers or status themselves), so this is a sibling rather than
// a change to it.
//
// It exists because `apiFetch` never checks `response.ok`, and every
// study screen then did `data.cards ?? []`. A 401, a 500, or a 400 for
// an unrecognised study mode all return a JSON body with no `cards` key, so
// they became an empty batch — which useCardSession reads as "the deck
// is finished" and celebrates with the arrival fanfare. An error was
// indistinguishable from success, on the one code path where that
// matters most.
export class ApiError extends Error {
  constructor(status, body, path) {
    // `detail` is FastAPI's own error shape (HTTPException). The message
    // is for the console and the logs, never for a screen: the backend
    // writes it in English, and a learner reads French first (plan 215).
    // What a screen may say comes from `code`, below, through its own
    // locale table.
    const detail = typeof body === 'object' && body !== null ? body.detail : null
    const said = detail && typeof detail === 'object' ? detail.message : detail
    super(said ? String(said) : `Request failed (${status}) for ${path}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.path = path
    // Two shapes carry a code. The fare gate's refusals (plan 069)
    // arrive as a bare string in `detail` — 'out_of_credits',
    // 'pass_required', 'limit_reached' — with their figures beside it
    // in the body; a refusal that also explains itself in English for
    // the logs arrives as `detail: { code, message }` (routes/video.py,
    // routes/agenda.py). `code` is the name either way, so a caller can
    // tell refusals apart without matching on a sentence; every other
    // error keeps code null.
    const code = detail && typeof detail === 'object' ? detail.code : detail
    this.code = typeof code === 'string' && /^[a-z][a-z0-9_]*$/.test(code) ? code : null
  }
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Fetch JSON, throwing ApiError on any non-2xx. Use this anywhere a
 * missing key in the response would otherwise be silently read as a
 * legitimate empty result.
 */
export async function apiJson(path, session, options = {}) {
  const response = await apiFetch(path, session, options)
  const body = await readJson(response)
  if (!response.ok) throw new ApiError(response.status, body, path)
  return body
}

/**
 * apiJson with an owned AbortController, so callers stop hand-rolling
 * the same controller + setTimeout pair (there were five near-identical
 * copies across the study screens, each of them a timeout only —
 * nothing ever aborted on unmount).
 *
 * `signal` lets a caller pass its own abort source (the session hook
 * aborts on mode change); it is linked to the timeout rather than
 * replacing it, so whichever fires first wins.
 */
export async function apiJsonWithTimeout(path, session, { timeoutMs = 10000, signal, ...options } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onOuterAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onOuterAbort)
  }
  try {
    return await apiJson(path, session, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onOuterAbort)
  }
}

/**
 * POST a FormData body (a file upload), throwing ApiError on any
 * non-2xx -- the multipart sibling of apiJson.
 *
 * Not built on apiFetch: that sets Content-Type: application/json
 * unconditionally, which would break a multipart body (the browser has
 * to set Content-Type itself, WITH the multipart boundary, which only
 * happens when the header is left unset entirely). First real need:
 * routes/video.py's subtitle upload (plan 019).
 */
export async function apiUpload(path, session, formData) {
  const headers = session ? { Authorization: `Bearer ${session.access_token}` } : {}
  const response = await send(path, { method: 'POST', body: formData, headers })
  if (response.status === 401 && session) recoverAuth()
  const body = await readJson(response)
  if (!response.ok) throw new ApiError(response.status, body, path)
  return body
}
