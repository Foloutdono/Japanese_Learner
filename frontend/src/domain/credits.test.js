import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DAILY_REFILL, CAP, SIGNUP_BONUS, COST_PER_REVIEW, FREE_SOURCES,
  FREE_DECKS, FREE_CARDS, PASS_DECKS, PASS_CARDS, REFILL_EVERY_MIN,
  showsCap, fareFor, runFit, isFreeMode, isFreeLane, laneFreeShare, refillMinutes, nextCreditClock,
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

// The free lines are not a number, so backendConst cannot reach them —
// but they are the one figure here a learner would notice being wrong,
// and the two files are edited months apart like every other pair
// above.
describe('the free lines mirror the backend', () => {
  it('names exactly what core/credits.py names', () => {
    const m = BACKEND.match(/^FREE_SOURCES = frozenset\(\{([^}]*)\}\)$/m)
    if (!m) throw new Error('core/credits.py declares no FREE_SOURCES')
    const there = m[1].split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    expect([...FREE_SOURCES].sort()).toEqual(there.sort())
  })
})

// 補充 — the refill's rhythm (plan 141). The server derives it from the
// daily figure rather than writing it down, and so does the client; what
// is pinned is that both derive it the same way.
describe('the refill fills through the day', () => {
  it('lands the day\'s thirty one every 48 minutes, as the backend does', () => {
    expect(BACKEND).toMatch(/^REFILL_EVERY = timedelta\(days=1\) \/ DAILY_REFILL$/m)
    expect(REFILL_EVERY_MIN).toBe(48)
    expect(REFILL_EVERY_MIN * DAILY_REFILL).toBe(24 * 60)
  })

  it('takes the server\'s rhythm when it has one', () => {
    expect(refillMinutes({ refillEvery: 2880 })).toBe(48)
    expect(refillMinutes({ refillEvery: 1800 })).toBe(30)
    expect(refillMinutes(null)).toBe(48)
    expect(refillMinutes({})).toBe(48)
  })

  it('names the next credit\'s hour, and none when nothing is coming', () => {
    const at = '2026-09-07T14:48:00+00:00'
    const clock = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date(at))
    expect(nextCreditClock({ balance: 10, nextCreditAt: at, unlimited: false }, 'en')).toBe(clock)
    // A full tank, a welcome over the cap, a pass, no answer yet.
    expect(nextCreditClock({ balance: 50, nextCreditAt: null, unlimited: false }, 'en')).toBe(null)
    expect(nextCreditClock({ balance: null, nextCreditAt: at, unlimited: true }, 'en')).toBe(null)
    expect(nextCreditClock(null, 'en')).toBe(null)
  })
})

describe('what rides free', () => {
  it('reads the source off a mode key', () => {
    expect(isFreeMode('kana.flashcard.f2b')).toBe(true)
    expect(isFreeMode('kana.write_kana')).toBe(true)
    expect(isFreeMode('vocab.flashcard.f2b')).toBe(false)
    expect(isFreeMode('kanji.readings')).toBe(false)
  })

  it('matches a whole source, and nothing at all is not free', () => {
    expect(isFreeMode('kanamoji.flashcard.f2b')).toBe(false)
    expect(isFreeMode(undefined)).toBe(false)
    expect(isFreeMode(null)).toBe(false)
    expect(isFreeMode('')).toBe(false)
  })

  it('takes the server\'s word on a lane over its own', () => {
    // The flag the day's summary puts on every lane.
    expect(isFreeLane({ kind: 'section', source: 'kana', free: true })).toBe(true)
    expect(isFreeLane({ kind: 'section', source: 'kana', free: false })).toBe(false)
    expect(isFreeLane({ kind: 'section', source: 'vocab', free: true })).toBe(true)
  })

  it('falls back to the source for a summary served before the flag', () => {
    expect(isFreeLane({ kind: 'section', source: 'kana' })).toBe(true)
    expect(isFreeLane({ kind: 'section', source: 'vocab' })).toBe(false)
    // A personal deck is never free — no deck structure is a kana one.
    expect(isFreeLane({ kind: 'personal', source: 'kana' })).toBe(false)
    expect(isFreeLane(null)).toBe(false)
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

  it('charges nothing for the reviews that ride free', () => {
    expect(fareFor(12, 5)).toBe(7 * COST_PER_REVIEW)
    expect(fareFor(12, 12)).toBe(0)
    // More free than due is not a refund.
    expect(fareFor(3, 10)).toBe(0)
    expect(fareFor(12, -1)).toBe(12 * COST_PER_REVIEW)
  })

  it('rides what the balance covers and leaves the rest for the refill', () => {
    expect(runFit(10, 4)).toEqual({ rides: 4, waits: 6 })
    expect(runFit(10, 0)).toEqual({ rides: 0, waits: 10 })
    // A welcome covers any run a new learner could reach.
    expect(runFit(10, SIGNUP_BONUS)).toEqual({ rides: 10, waits: 0 })
    // A pass (null) rides everything.
    expect(runFit(10, null)).toEqual({ rides: 10, waits: 0 })
  })

  it("counts a lane's learning-step repeats as free, the last of its due cards", () => {
    const lane = { kind: 'section', source: 'vocab', due: 10, new: 5, free: false, freeCards: 4 }
    // The whole lane: every repeat.
    expect(laneFreeShare(lane, 15)).toBe(4)
    // Cut short: the repeats are the least overdue, so the first six
    // due cards are the paid ones and none of the repeats is promised.
    expect(laneFreeShare(lane, 6)).toBe(0)
    expect(laneFreeShare(lane, 8)).toBe(2)
    // The day's new cards come after the due ones, and are paid.
    expect(laneFreeShare(lane, 12)).toBe(4)
    // A free line rides whole; a lane from before freeCards, none.
    expect(laneFreeShare({ ...lane, source: 'kana', free: true }, 7)).toBe(7)
    expect(laneFreeShare({ kind: 'section', source: 'vocab', due: 3 }, 3)).toBe(0)
    expect(laneFreeShare(lane, 0)).toBe(0)
    expect(laneFreeShare(null, 3)).toBe(0)
  })

  it('rides the free ones whatever the balance is', () => {
    // An empty balance is no longer an empty run: the kana in it goes.
    expect(runFit(10, 0, 10)).toEqual({ rides: 10, waits: 0 })
    expect(runFit(10, 0, 4)).toEqual({ rides: 4, waits: 6 })
    // The balance is spent on the paid ones only.
    expect(runFit(10, 2, 4)).toEqual({ rides: 6, waits: 4 })
    expect(runFit(10, 6, 4)).toEqual({ rides: 10, waits: 0 })
    // Never past the run's own length, however it is counted.
    expect(runFit(10, 30, 4)).toEqual({ rides: 10, waits: 0 })
    expect(runFit(10, 0, 30)).toEqual({ rides: 10, waits: 0 })
  })
})
