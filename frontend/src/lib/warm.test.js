import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── 予熱 — a gate's answers, asked before it is opened (plan 291) ──
// Today is warmed by the first ride; the four other gates by Today,
// once a visit, behind the day and two at a time, so no warm stands in
// the learner's six-at-a-time queue ahead of the screen in front of them.

const calls = []
const later = () => {
  let resolve
  const promise = new Promise(ok => { resolve = ok })
  return { promise, resolve }
}
// Each warm records itself and answers when the test says so.
const pending = []
const warm = name => vi.fn(() => {
  calls.push(name)
  const answer = later()
  pending.push(answer)
  return answer.promise
})
const stores = vi.hoisted(() => ({}))

vi.mock('./cachedJson', () => ({
  CONTENT_TTL_MS: 600_000,
  cachedJson: (path, session, { ttlMs }) => stores.cachedJson(path, session, ttlMs),
}))
// Each store by its path, as stores/remote reaches it.
const NAMES = {
  '/api/today': 'today', '/api/credits': 'credits', '/api/journey/status': 'journey', '/api/stats': 'stats',
  '/api/basics': 'basics', '/api/practice/record': 'record', '/api/agenda': 'agenda', '/api/pvp': 'duels',
}
vi.mock('../stores/remote', () => ({ warmStore: path => stores[NAMES[path]]() }))
vi.mock('../stores/stationSamples', () => ({ warmStationSamples: source => stores.samples(source) }))
vi.mock('../components/station/print/usePrint', () => ({ preloadHourPrint: desk => stores.print(desk) }))

const { warmToday, warmGates, forgetWarm, GATE_PATHS, STORE_PATHS } = await import('./warm')

const me = { user: { id: 'u1' } }
const other = { user: { id: 'u2' } }
// setTimeout is faked: a few turns of the microtask queue instead.
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
async function answerAll() {
  while (pending.length) {
    pending.shift().resolve()
    await flush()
  }
}

beforeEach(() => {
  calls.length = 0
  pending.length = 0
  for (const name of ['today', 'credits', 'journey', 'stats', 'basics', 'record', 'agenda', 'duels', 'print']) stores[name] = warm(name)
  stores.samples = vi.fn(source => warm(`samples:${source}`)())
  stores.cachedJson = vi.fn((path, _s, ttlMs) => warm(`${path} ${ttlMs}`)())
  forgetWarm()
  vi.useFakeTimers({ toFake: ['setTimeout'] })
})
afterEach(() => { vi.useRealTimers() })

describe('warmToday', () => {
  it('asks the day, the balance, the journey and the print of the hour', () => {
    warmToday(true)
    expect(calls).toEqual(['today', 'credits', 'journey', 'print'])
    expect(stores.print).toHaveBeenCalledWith(true)
  })
})

describe('warmGates', () => {
  it('asks nothing until Today has had the page to itself', async () => {
    warmGates({ session: me, lang: 'fr' })
    await flush()
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1200)
    await flush()
    expect(calls.length).toBe(2)
  })

  it('asks two at a time, each lane on once its last has answered, every gate in turn', async () => {
    warmGates({ session: me, lang: 'fr' })
    vi.advanceTimersByTime(1200)
    await flush()
    expect(calls).toEqual(['stats', `${GATE_PATHS.decks} 0`])
    pending.shift().resolve()
    await flush()
    expect(calls).toHaveLength(3)
    await answerAll()
    expect(calls).toEqual([
      'stats',
      `${GATE_PATHS.decks} 0`,
      'record',
      `${GATE_PATHS.catalogue('fr')} 0`,
      `${GATE_PATHS.radicals} 600000`,
      `${GATE_PATHS.board} 0`,
      `${GATE_PATHS.week} 0`,
      'agenda',
      'duels',
    ])
  })

  it("adds the basics while they ride, and the desk's specimens on the desk", async () => {
    warmGates({ session: me, lang: 'en', desk: true, basics: true })
    vi.advanceTimersByTime(1200)
    await flush()
    await answerAll()
    expect(calls).toContain('basics')
    expect(calls.filter(c => c.startsWith('samples:'))).toHaveLength(7)
    expect(calls).toContain(`${GATE_PATHS.catalogue('en')} 0`)
  })

  it('warms once a visit per learner, and afresh after a sign-out', async () => {
    warmGates({ session: me, lang: 'fr' })
    warmGates({ session: me, lang: 'fr' })
    vi.advanceTimersByTime(1200)
    await flush()
    await answerAll()
    const once = calls.length
    warmGates({ session: me, lang: 'fr' })
    vi.advanceTimersByTime(1200)
    await flush()
    expect(calls.length).toBe(once)

    forgetWarm()
    warmGates({ session: other, lang: 'fr' })
    vi.advanceTimersByTime(1200)
    await flush()
    expect(calls.length).toBe(once + 2)
  })

  it('stops a queue whose learner has left', async () => {
    warmGates({ session: me, lang: 'fr' })
    forgetWarm()
    vi.advanceTimersByTime(1200)
    await flush()
    expect(calls).toEqual([])
  })

  it('asks nothing without a learner', async () => {
    warmGates({ session: null, lang: 'fr' })
    vi.advanceTimersByTime(1200)
    await flush()
    expect(calls).toEqual([])
  })
})

describe('GATE_PATHS', () => {
  it("spells the Dictionary's opening as its screen asks it", () => {
    expect(GATE_PATHS.catalogue('fr')).toBe('/api/dictionary?q=&page=0&limit=50&lang=fr&category=kanji')
  })
})

describe('STORE_PATHS', () => {
  it('names the stores by the paths the test reaches them by', () => {
    expect(Object.values(STORE_PATHS).sort()).toEqual(Object.keys(NAMES).sort())
  })
})
