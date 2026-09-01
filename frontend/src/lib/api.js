import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL || ''

export const api = (path) => `${BASE}${path}`

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

export async function apiFetch(path, session, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers,
  }
  const response = await fetch(api(path), { ...options, headers })
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
    // `detail` is FastAPI's own error shape (HTTPException) — worth
    // surfacing verbatim, since the backend's messages name the actual
    // problem ("Invalid mode for kana: 'banana'").
    const detail = typeof body === 'object' && body !== null ? body.detail : null
    super(detail ? String(detail) : `Request failed (${status}) for ${path}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.path = path
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
  const response = await fetch(api(path), { method: 'POST', body: formData, headers })
  if (response.status === 401 && session) recoverAuth()
  const body = await readJson(response)
  if (!response.ok) throw new ApiError(response.status, body, path)
  return body
}
