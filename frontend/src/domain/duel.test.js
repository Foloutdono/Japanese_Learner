// ── 対戦 — the sprint's rules as the client draws them (plan 279) ──
// The server keeps the clock and the score; what the client draws must
// agree with it, and every refusal it can answer with must say
// something in both languages rather than the server's English.
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { ERROR_KEYS, errorKey, outcome, points, totalAt } from './duel'
import fr from '../locales/fr'
import en from '../locales/en'

const backend = name => readFileSync(fileURLToPath(new URL(`../../../backend/${name}`, import.meta.url)), 'utf8')

describe('the points', () => {
  it('are worth less as time passes, as the server counts them', () => {
    expect(points(0)).toBe(100)
    expect(points(1000)).toBe(100)
    expect(points(3500)).toBe(63)
    expect(points(6000)).toBe(25)
    expect(points(6001)).toBe(0)
  })
})

describe('the race', () => {
  it('replays a recording at the pace it was played', () => {
    const line = [{ t: 1000, pts: 100, right: true }, { t: 3000, pts: 0, right: false }, { t: 9000, pts: 0, right: true }]
    expect(totalAt(line, 500)).toEqual({ total: 0, rights: 0 })
    expect(totalAt(line, 3000)).toEqual({ total: 100, rights: 1 })
    // A right answer past the question's six seconds is right, and worth nothing.
    expect(totalAt(line, 60_000)).toEqual({ total: 100, rights: 2 })
  })

  it('reads the outcome from the learner’s side', () => {
    expect(outcome(5, 3)).toBe('win')
    expect(outcome(3, 5)).toBe('loss')
    expect(outcome(4, 4)).toBe('draw')
  })
})

describe('a refusal', () => {
  const raised = ['study/duel_friends.py', 'study/duels.py', 'routes/pvp.py']
    .flatMap(f => [...backend(f).matchAll(/Refused\(\d+, "(pvp_\w+)"\)/g)].map(m => m[1]))

  it('every code the server can raise has its words', () => {
    expect(raised.length).toBeGreaterThan(10)
    for (const code of new Set(raised)) expect(ERROR_KEYS, code).toHaveProperty(code)
  })

  it('every key is written in both languages', () => {
    for (const key of new Set([...Object.values(ERROR_KEYS), 'pvpErrFailed'])) {
      expect(typeof fr[key], key).toBe('string')
      expect(typeof en[key], key).toBe('string')
    }
  })

  it('a code nobody expected reads as the plain failure', () => {
    expect(errorKey({ code: 'pvp_something_new' })).toBe('pvpErrFailed')
    expect(errorKey(new Error('offline'))).toBe('pvpErrFailed')
    expect(errorKey({ code: 'out_of_credits' })).toBe('pvpErrCredits')
  })
})
