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

const { track, flush, EVENTS, VALUES, _peek, _reset } = await import('./track')

// The queue as the events the test tracked: the first one of a visit
// brings its own session_start, which the session tests below read.
const peek = () => _peek().filter(e => e.name !== 'session_start')
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
    expect(peek()).toEqual([])
  })

  it('queues one that is', () => {
    track('screen_view', { route: '/today', tab: 'today' })
    expect(peek()).toHaveLength(1)
    expect(peek()[0].name).toBe('screen_view')
    // An id of its own, so a batch sent twice is kept once (plan 100's
    // live walk found two rows for one guide_done).
    expect(typeof peek()[0].id).toBe('string')
    expect(peek()[0].id.length).toBeGreaterThan(8)
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
    expect(peek()[0].props).toEqual({ route: '/today' })
  })

  it('drops a value that is not a scalar', () => {
    // An array or an object is the shape a token list, an analysed
    // sentence or a card body would arrive in.
    track('run_complete', {
      kind: 'vocab', mode: 'recognition',
      items: [{ surface: '猫' }], secs: 30,
    })
    expect(peek()[0].props).toEqual({ kind: 'vocab', mode: 'recognition', secs: 30 })
  })

  it('cuts a long string rather than carrying it', () => {
    track('boarding_step', { step: 'ね'.repeat(500) })
    expect(peek()[0].props.step.length).toBe(64)
  })

  it('survives props that are not an object at all', () => {
    track('boot_timeout', null)
    track('boot_timeout', 'nonsense')
    expect(peek()).toHaveLength(2)
    expect(peek()[0].props).toEqual({})
  })

  it('replaces a non-finite number rather than sending NaN', () => {
    // JSON.stringify turns NaN into null anyway; doing it here means
    // the localStorage mirror and the request agree.
    track('app_open', { boot_ms: NaN })
    expect(peek()[0].props.boot_ms).toBeNull()
  })
})

// ── The opt-out ───────────────────────────────────────────────────

describe('the opt-out', () => {
  it('produces nothing at all once set', () => {
    setOptedOut(true)
    track('screen_view', { route: '/today' })
    track('app_open', { boot_ms: 10 })
    expect(peek()).toEqual([])
  })

  it('leaves what was already queued alone but adds nothing', () => {
    track('screen_view', { route: '/today' })
    setOptedOut(true)
    track('screen_view', { route: '/learn' })
    expect(peek()).toHaveLength(1)
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
    expect(JSON.parse(options.body).events.map(e => e.name)).toEqual(['session_start', 'screen_view'])
    expect(peek()).toEqual([])
  })

  it('keeps the queue when the network fails', async () => {
    apiFetch.mockRejectedValue(new Error('offline'))
    track('screen_view', { route: '/today' })
    await flush()
    expect(peek()).toHaveLength(1)
  })

  it('keeps the queue on a 5xx but drops it on a 4xx', async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 503 })
    track('screen_view', { route: '/today' })
    await flush()
    expect(peek()).toHaveLength(1)

    // A 4xx will fail the same way forever; retrying is a loop.
    apiFetch.mockResolvedValue({ ok: false, status: 400 })
    await flush()
    expect(peek()).toEqual([])
  })

  it('sends nothing when nobody is signed in', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    track('screen_view', { route: '/today' })
    await flush()
    expect(apiFetch).not.toHaveBeenCalled()
    expect(peek()).toHaveLength(1)
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
    const queued = peek()
    expect(queued.length).toBeLessThanOrEqual(200)
    // The last one written is still there; the first is not.
    expect(queued[queued.length - 1].props.waited_ms).toBe(259)
    expect(queued[0].props.waited_ms).not.toBe(0)
  })
})

// ── The visit ─────────────────────────────────────────────────────

describe('the session', () => {
  const GAP = 30 * 60_000

  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-13T10:00:00Z') }))
  afterEach(() => vi.useRealTimers())

  it('opens with session_start, and every event after it carries the same id', () => {
    track('screen_view', { route: '/today' })
    vi.advanceTimersByTime(60_000)
    track('screen_view', { route: '/learn' })
    const q = _peek()
    expect(q.map(e => e.name)).toEqual(['session_start', 'screen_view', 'screen_view'])
    expect(q[0].props).toEqual({})
    expect(new Set(q.map(e => e.sid)).size).toBe(1)
    expect(q[0].sid).toMatch(/^[A-Za-z0-9-]{8,64}$/)
  })

  it('lets a visit go on while events keep coming, even past thirty minutes in all', () => {
    track('screen_view', { route: '/today' })
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(GAP - 60_000)
      track('screen_view', { route: '/learn' })
    }
    expect(_peek().filter(e => e.name === 'session_start')).toHaveLength(1)
  })

  it('begins another after thirty minutes without an event', () => {
    track('screen_view', { route: '/today' })
    vi.advanceTimersByTime(GAP + 1000)
    track('screen_view', { route: '/learn' })
    const q = _peek()
    expect(q.filter(e => e.name === 'session_start')).toHaveLength(2)
    expect(q[0].sid).not.toBe(q[q.length - 1].sid)
  })

  it('does not begin, or keep alive, a visit for a failed request', () => {
    track('api_error', { path: '/api/decks', status: 503 })
    expect(_peek().map(e => e.name)).toEqual(['api_error'])
    expect(_peek()[0].sid).toBeUndefined()

    track('screen_view', { route: '/today' })
    vi.advanceTimersByTime(GAP - 1000)
    track('api_error', { path: '/api/decks', status: 503 })
    vi.advanceTimersByTime(2000)
    track('screen_view', { route: '/learn' })
    // The error at +29:59 did not extend the visit past the gap.
    expect(_peek().filter(e => e.name === 'session_start')).toHaveLength(2)
  })

  it('is sent with the batch, beside the event and not inside its properties', async () => {
    track('screen_view', { route: '/today' })
    await flush()
    const sent = JSON.parse(apiFetch.mock.calls[0][2].body).events
    expect(sent.map(e => e.name)).toEqual(['session_start', 'screen_view'])
    expect(sent[1].sid).toBe(sent[0].sid)
    expect(sent[1].props).toEqual({ route: '/today' })
  })

  it('records nothing, not even a session, for someone who opted out', () => {
    setOptedOut(true)
    track('screen_view', { route: '/today' })
    expect(_peek()).toEqual([])
  })
})

// ── 足跡 II (plan 218): enums and shapes ──────────────────────────

describe('the values a property may take', () => {
  it('drops an enum value that is not on its list', () => {
    // The structural half of "nothing a learner typed": under an
    // enumerated key, only the app's own words get through.
    track('feature_use', { feature: 'speech', action: 'play', route: '/today/run', n: 2 })
    track('feature_use', { feature: 'mon mot', action: 'search', n: 1 })
    track('setting_change', { setting: 'theme', value: 'rose' })
    expect(peek().map(e => e.props)).toEqual([
      { feature: 'speech', action: 'play', route: '/today/run', n: 2 },
      { action: 'search', n: 1 },
      { setting: 'theme' },
    ])
  })

  it('holds a route to the shape of a pattern', () => {
    track('screen_view', { route: '/learn/vocab/theme/:theme', tab: 'learn' })
    track('screen_view', { route: '/learn/vocab/theme/mes mots préférés' })
    track('api_error', { path: '/api/decks/9f3a', status: 500 })
    expect(peek().map(e => e.props)).toEqual([
      { route: '/learn/vocab/theme/:theme', tab: 'learn' },
      {},
      { status: 500 },
    ])
  })

  it('names only keys its event declares', () => {
    for (const [name, keys] of Object.entries(VALUES)) {
      expect(EVENTS[name], name).toBeDefined()
      for (const key of Object.keys(keys)) expect(EVENTS[name], `${name}.${key}`).toContain(key)
    }
  })
})
