// ── 足跡 — what the trail records, and what it must never ──
//
// Two failures, both silent, both worse than a crash:
//
//   A learner's own words reaching the queue. clean() drops any key a
//   name did not declare and any value that is not a scalar, which is
//   the only thing standing between a careless call site and a
//   dictation answer in a row that outlives the session. The server
//   applies the same rules again, but a mistake caught only there is a
//   mistake that already left the device.
//
//   The opt-out not holding. Someone who has said no in Réglages ›
//   Données must produce nothing at all -- not a smaller queue, not a
//   queue that flushes later. Nothing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getSession = vi.fn()
const apiFetch = vi.fn()

vi.mock('./supabase', () => ({ supabase: { auth: { getSession } } }))
vi.mock('./api', () => ({ apiFetch }))

const { track, flush, EVENTS, _peek, _reset } = await import('./track')
const { setOptedOut } = await import('../stores/analyticsOptOut')

beforeEach(() => {
  vi.clearAllMocks()
  setOptedOut(false)
  _reset()
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 't' } } })
  apiFetch.mockResolvedValue({ ok: true, status: 202 })
})

afterEach(() => { setOptedOut(false); _reset() })

// ── The closed set ────────────────────────────────────────────────

describe('the event names', () => {
  it('drops a name that is not in the set', () => {
    track('not_an_event', { a: 1 })
    expect(_peek()).toEqual([])
  })

  it('queues one that is', () => {
    track('screen_view', { route: '/today', tab: 'today' })
    expect(_peek()).toHaveLength(1)
    expect(_peek()[0].name).toBe('screen_view')
  })

  it('declares every name as an array of keys', () => {
    for (const [name, keys] of Object.entries(EVENTS)) {
      expect(Array.isArray(keys), `${name} must declare an array`).toBe(true)
    }
  })
})

// ── The privacy rule ──────────────────────────────────────────────

describe('what a property may carry', () => {
  it('drops a key the name did not declare', () => {
    track('screen_view', { route: '/today', answer: 'こんにちは' })
    expect(_peek()[0].props).toEqual({ route: '/today' })
  })

  it('drops a value that is not a scalar', () => {
    // An array or an object is the shape a token list, an analysed
    // sentence or a card body would arrive in.
    track('run_complete', {
      kind: 'vocab', mode: 'recognition',
      items: [{ surface: '猫' }], secs: 30,
    })
    expect(_peek()[0].props).toEqual({ kind: 'vocab', mode: 'recognition', secs: 30 })
  })

  it('cuts a long string rather than carrying it', () => {
    track('screen_view', { route: '/' + 'ね'.repeat(500) })
    expect(_peek()[0].props.route.length).toBe(64)
  })

  it('survives props that are not an object at all', () => {
    track('boot_timeout', null)
    track('boot_timeout', 'nonsense')
    expect(_peek()).toHaveLength(2)
    expect(_peek()[0].props).toEqual({})
  })

  it('replaces a non-finite number rather than sending NaN', () => {
    // JSON.stringify turns NaN into null anyway; doing it here means
    // the localStorage mirror and the request agree.
    track('app_open', { boot_ms: NaN })
    expect(_peek()[0].props.boot_ms).toBeNull()
  })
})

// ── The opt-out ───────────────────────────────────────────────────

describe('the opt-out', () => {
  it('produces nothing at all once set', () => {
    setOptedOut(true)
    track('screen_view', { route: '/today' })
    track('app_open', { boot_ms: 10 })
    expect(_peek()).toEqual([])
  })

  it('leaves what was already queued alone but adds nothing', () => {
    track('screen_view', { route: '/today' })
    setOptedOut(true)
    track('screen_view', { route: '/learn' })
    expect(_peek()).toHaveLength(1)
  })
})

// ── The flush ─────────────────────────────────────────────────────

describe('flush', () => {
  it('posts the queue and clears it', async () => {
    track('screen_view', { route: '/today' })
    await flush()
    expect(apiFetch).toHaveBeenCalledOnce()
    const [path, session, options] = apiFetch.mock.calls[0]
    expect(path).toBe('/api/events')
    expect(session.user.id).toBe('u1')
    expect(options.method).toBe('POST')
    // sendBeacon cannot set an Authorization header; keepalive is how
    // this outlives the page AND stays authenticated.
    expect(options.keepalive).toBe(true)
    expect(JSON.parse(options.body).events[0].name).toBe('screen_view')
    expect(_peek()).toEqual([])
  })

  it('keeps the queue when the network fails', async () => {
    apiFetch.mockRejectedValue(new Error('offline'))
    track('screen_view', { route: '/today' })
    await flush()
    expect(_peek()).toHaveLength(1)
  })

  it('keeps the queue on a 5xx but drops it on a 4xx', async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 503 })
    track('screen_view', { route: '/today' })
    await flush()
    expect(_peek()).toHaveLength(1)

    // A 4xx will fail the same way forever; retrying is a loop.
    apiFetch.mockResolvedValue({ ok: false, status: 400 })
    await flush()
    expect(_peek()).toEqual([])
  })

  it('sends nothing when nobody is signed in', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    track('screen_view', { route: '/today' })
    await flush()
    expect(apiFetch).not.toHaveBeenCalled()
    expect(_peek()).toHaveLength(1)
  })

  it('does not post an empty batch', async () => {
    await flush()
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

// ── The bound ─────────────────────────────────────────────────────

describe('the queue bound', () => {
  it('keeps the newest and drops the oldest past the cap', () => {
    // A long offline stretch must not fill a phone's storage quota --
    // the auth token lives in the same one.
    apiFetch.mockRejectedValue(new Error('offline'))
    for (let i = 0; i < 260; i++) track('boot_timeout', { waited_ms: i })
    const queued = _peek()
    expect(queued.length).toBeLessThanOrEqual(200)
    // The last one written is still there; the first is not.
    expect(queued[queued.length - 1].props.waited_ms).toBe(259)
    expect(queued[0].props.waited_ms).not.toBe(0)
  })
})
