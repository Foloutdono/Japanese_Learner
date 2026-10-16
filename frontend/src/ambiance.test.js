import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import AMBIANCE from './lib/audio/ambiance.json'
import { ambianceUrl } from './lib/audio/ambiance'
import { printHour } from './domain/printHour'

// ── 湖の刻 — the ambiance of the hour (plan 219) ─────────────────────
// The four loops are drawn ahead of time (scripts/ambiance/build.py)
// into public/sounds/ambiant/<rev>/, and lib/audio/ambiance.js plays
// the one the print's clock names. Written apart, held together here:
// every hour the clock can name has its loop on disk at the revision
// the app asks for, each long enough to hold its loop and both pads,
// and nothing stale is left beside it (the worker keeps /sounds/ for
// a year, so an old file would only be weight in the repository).

const ROOT = new URL('../public/sounds/ambiant/', import.meta.url)
const at = h => new Date(2026, 9, 16, h, 0)

describe('the ambiance of the hour', () => {
  it('has a loop for every hour the print can show', () => {
    const hours = new Set([0, 5, 9, 16, 20].map(h => printHour(at(h))))
    expect([...hours].sort()).toEqual([...AMBIANCE.hours].sort())
  })

  it('finds each one at the revision the app asks for', () => {
    for (const hour of AMBIANCE.hours) {
      expect(ambianceUrl(hour)).toBe(`/sounds/ambiant/${AMBIANCE.rev}/${hour}.mp3`)
      const file = new URL(`${AMBIANCE.rev}/${hour}.mp3`, ROOT)
      // A constant 128 kbps: 16 kB a second, for the loop and its pads.
      const seconds = statSync(file).size / 16000
      expect(seconds).toBeGreaterThan(AMBIANCE.loop + 2 * AMBIANCE.pad - 0.1)
    }
  })

  it('keeps nothing else in the folder', () => {
    expect(readdirSync(ROOT)).toEqual([AMBIANCE.rev])
    expect(readdirSync(new URL(`${AMBIANCE.rev}/`, ROOT)).sort())
      .toEqual(AMBIANCE.hours.map(h => `${h}.mp3`).sort())
  })

  it('loops inside its pads', () => {
    expect(AMBIANCE.pad).toBeGreaterThan(0)
    expect(AMBIANCE.loop).toBeGreaterThanOrEqual(60)
  })
})
