const BASE = import.meta.env.VITE_API_URL || ''

export const api = (path) => `${BASE}${path}`

export async function apiFetch(path, session, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers,
  }
  return fetch(api(path), { ...options, headers })
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
