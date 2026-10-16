// ── 滞在と利用 — the screen's time and its feature counts (plan 215) ──
//
// What has to hold: leaving a screen sends its engaged time and one
// feature_use per (feature, action) with the count; a hide closes the
// stretch but keeps the screen; a practice run ends with its screen,
// and a new screen's run is not closed by the leaving of the old one.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }))
vi.mock('./api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn() }))

// The stopwatch, made deterministic: every read is 1500 ms, every lap too.
vi.mock('./dwell', () => ({
  stopwatch: () => ({ read: () => 1500, lap: () => 1500, stop: () => {} }),
}))

const { _peek, _reset } = await import('./track')
const { enterScreen, leaveScreen, countUse, _current, _resetScreen } = await import('./screenTrail')
const { startTally, countReview } = await import('../stores/runTally')
const { _resetRun, percentile } = await import('./runTrail')

const events = () => _peek().filter(e => e.name !== 'session_start').map(e => [e.name, e.props])

beforeEach(() => { _reset(); _resetScreen(); _resetRun() })
afterEach(() => { _reset(); _resetScreen(); _resetRun() })

describe('the screen', () => {
  it('sends its engaged time when the route changes', () => {
    enterScreen('/today', 'today')
    enterScreen('/learn', 'learn')
    expect(events()).toEqual([['screen_leave', { route: '/today', tab: 'today', ms: 1500 }]])
    expect(_current()).toEqual({ route: '/learn', tab: 'learn' })
  })

  it('counts features on the screen and sends one row each when it is left', () => {
    enterScreen('/dictionary', 'dictionary')
    countUse('dictionary', 'search')
    countUse('dictionary', 'search')
    countUse('speech', 'play')
    leaveScreen({ ended: true })
    expect(events()).toEqual([
      ['feature_use', { feature: 'dictionary', action: 'search', route: '/dictionary', n: 2 }],
      ['feature_use', { feature: 'speech', action: 'play', route: '/dictionary', n: 1 }],
      ['screen_leave', { route: '/dictionary', tab: 'dictionary', ms: 1500 }],
    ])
  })

  it('keeps the screen through a hide, to resume on the tab coming back', () => {
    enterScreen('/today', 'today')
    leaveScreen({ ended: false })
    expect(_current()).toEqual({ route: '/today', tab: 'today' })
    enterScreen('/today', 'today')   // same route: no second leave
    expect(events()).toHaveLength(1)
  })

  it('drops a use with no screen up rather than giving it to the next', () => {
    countUse('speech', 'play')
    enterScreen('/today', 'today')
    leaveScreen({ ended: true })
    expect(events().map(([name]) => name)).toEqual(['screen_leave'])
  })
})

describe('a practice run', () => {
  it('starts with its tally and completes with its screen, with how it went', () => {
    enterScreen('/practice/reading/level/:level', 'practice')
    startTally('reading:N4')
    countReview({ quality: 4 })
    countReview({ quality: 1 })
    countReview({ quality: 3 })
    enterScreen('/practice', 'practice')
    const runs = events().filter(([name]) => name.startsWith('run_'))
    expect(runs[0]).toEqual(['run_start', { kind: 'reading', mode: 'stream', level: 'N4', where: 'other' }])
    expect(runs[1][0]).toBe('run_complete')
    expect(runs[1][1]).toMatchObject({ kind: 'reading', mode: 'stream', level: 'N4', items: 3, right: 2, ms: 1500, card_p50: 1500, card_p90: 1500 })
  })

  it('records a glance as nothing', () => {
    enterScreen('/practice/dictation', 'practice')
    startTally('dictation:N5')
    enterScreen('/practice', 'practice')
    expect(events().filter(([name]) => name === 'run_complete')).toEqual([])
  })

  it('is not a run for the card runs, whose hook reports them', () => {
    startTally('jp-session:v5:vocab:N5:recognition')
    expect(events().filter(([name]) => name === 'run_start')).toEqual([])
  })

  it('ends the run before when a new one starts', () => {
    startTally('translation:N3')
    countReview({ quality: 4 })
    startTally('translation:N2')
    const names = events().map(([name, props]) => `${name}:${props.level}`)
    expect(names).toEqual(['run_start:N3', 'run_complete:N3', 'run_start:N2'])
  })
})

describe('percentile', () => {
  it('reads the nearest rank', () => {
    expect(percentile([], 50)).toBeUndefined()
    expect(percentile([300, 100, 200], 50)).toBe(200)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 100], 90)).toBe(9)
  })
})
