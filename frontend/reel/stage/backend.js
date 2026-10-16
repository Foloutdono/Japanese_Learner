// ── 舞台裏 — the stage's backend (plan 210) ─────────────────────────
// The reel films the real app, and the real app asks a server for
// everything it draws. This answers in the server's place, inside the
// page: window.fetch is replaced before the app's first module runs
// (stage/main.jsx imports boot.js first), so every apiFetch, apiJson
// and apiUpload lands here and nothing reaches the network or a
// database. What a screen is told is the reel's script and the
// fixtures in stage/fixtures.js; a request nobody answers is written to
// `unhandled`, answered 404, and named in the render's log, so a scene
// that asks for something new says so instead of filming an empty
// screen.
//
// An answer may take a beat (`delay`, in ms, on the page's clock): the
// analyzer reading a photo is a moment on screen, not a frame.

const routes = []

/** Compile '/api/decks/:id/cards' into a matcher with named params. */
function compile(pattern) {
  if (pattern instanceof RegExp) return path => path.match(pattern)?.groups ?? (pattern.test(path) ? {} : null)
  const names = []
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)' })}$`)
  return path => {
    const m = path.match(re)
    if (!m) return null
    return Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]))
  }
}

/**
 * Answer `method` requests to `pattern` with `handler(req)`, whose
 * return is the JSON body, or `{ status, body, delay, raw }` to say
 * more. A later route for the same path wins, so a scene can override
 * the stage's defaults.
 */
export function route(method, pattern, handler) {
  routes.unshift({ method: method.toUpperCase(), match: compile(pattern), handler })
}

export const unhandled = []
export const served = []

const sleep = ms => new Promise(r => setTimeout(r, ms))

function bodyOf(init) {
  const raw = init?.body
  if (typeof raw !== 'string') return raw ?? null
  try { return JSON.parse(raw) } catch { return raw }
}

const reply = (status, body) => new Response(body instanceof Blob ? body : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': body instanceof Blob ? body.type : 'application/json' },
})

/** The paths the app's server answers: the API and its two static mounts. */
const OURS = /^\/(api|kanjivg|exam-audio)\//

export function installBackend() {
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href)
    if (url.origin !== window.location.origin || !OURS.test(url.pathname)) return realFetch(input, init)
    const method = String(init.method ?? input.method ?? 'GET').toUpperCase()
    for (const r of routes) {
      if (r.method !== method && r.method !== '*') continue
      const params = r.match(url.pathname)
      if (!params) continue
      const out = await r.handler({ method, url, params, query: url.searchParams, body: bodyOf(init), realFetch })
      served.push(`${method} ${url.pathname}`)
      if (out instanceof Response) return out
      const shaped = out && typeof out === 'object' && ('status' in out || 'delay' in out) && 'body' in out
      const { status = 200, body = out, delay = 0 } = shaped ? out : { body: out }
      if (delay) await sleep(delay)
      return reply(status, body ?? {})
    }
    unhandled.push(`${method} ${url.pathname}${url.search}`)
    return reply(404, { detail: 'reel: no fixture' })
  }
}
