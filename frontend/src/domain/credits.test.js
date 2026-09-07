import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DAILY_REFILL, CAP, SIGNUP_BONUS, COST_PER_REVIEW,
  FREE_DECKS, FREE_CARDS, PASS_DECKS, PASS_CARDS,
  showsCap, fareFor, runFit,
} from './credits'

// ── 回数券 — the economy as the client states it ──────────────────
// This module's own header promises its figures "mirror
// backend/core/credits.py" so copy can print them before the API has
// answered. Nothing enforced that until here: the two files are edited
// months apart, and a client that promises 30 where the server grants
// 200 is a lie printed on the pass itself.

const BACKEND = readFileSync(new URL('../../../backend/core/credits.py', import.meta.url), 'utf8')

/** One `NAME = 123` from the backend module, as a number. */
function backendConst(name) {
  const m = BACKEND.match(new RegExp(`^${name} = (\\d+)$`, 'm'))
  if (!m) throw new Error(`core/credits.py declares no ${name}`)
  return Number(m[1])
}

describe('the figures mirror the backend', () => {
  it.each([
    ['DAILY_REFILL', DAILY_REFILL],
    ['CAP', CAP],
    ['SIGNUP_BONUS', SIGNUP_BONUS],
    ['COST_PER_REVIEW', COST_PER_REVIEW],
    ['FREE_DECKS', FREE_DECKS],
    ['FREE_CARDS', FREE_CARDS],
    ['PASS_DECKS', PASS_DECKS],
    ['PASS_CARDS', PASS_CARDS],
  ])('%s', (name, here) => {
    expect(here).toBe(backendConst(name))
  })
})

describe('the cap beside a balance', () => {
  // The cap bounds the daily refill, not the wallet. A welcome sits
  // above it by design, and "200/50" reads as a broken fraction rather
  // than as a generous one.
  it('is printed while the balance is within it', () => {
    expect(showsCap(0)).toBe(true)
    expect(showsCap(30)).toBe(true)
    expect(showsCap(CAP)).toBe(true)
  })

  it('is dropped once the balance is above it — a fresh welcome is', () => {
    expect(showsCap(CAP + 1)).toBe(false)
    expect(showsCap(SIGNUP_BONUS)).toBe(false)
    expect(SIGNUP_BONUS).toBeGreaterThan(CAP)
  })

  it('says nothing about a pass, which prints ∞ and no balance at all', () => {
    expect(showsCap(null)).toBe(false)
    expect(showsCap(undefined)).toBe(false)
  })

  it('takes the server cap over the mirrored one', () => {
    expect(showsCap(80, 100)).toBe(true)
    expect(showsCap(80, 50)).toBe(false)
  })
})

describe('what a run costs', () => {
  it('prices one credit a review, and never a negative fare', () => {
    expect(fareFor(12)).toBe(12 * COST_PER_REVIEW)
    expect(fareFor(0)).toBe(0)
    expect(fareFor(-3)).toBe(0)
  })

  it('rides what the balance covers and leaves the rest for the refill', () => {
    expect(runFit(10, 4)).toEqual({ rides: 4, waits: 6 })
    expect(runFit(10, 0)).toEqual({ rides: 0, waits: 10 })
    // A welcome covers any run a new learner could reach.
    expect(runFit(10, SIGNUP_BONUS)).toEqual({ rides: 10, waits: 0 })
    // A pass (null) rides everything.
    expect(runFit(10, null)).toEqual({ rides: 10, waits: 0 })
  })
})
