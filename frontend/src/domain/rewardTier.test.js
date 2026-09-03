import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rewardTier } from './rewardTier'

// ── The tier decides whether the next card waits ────────────────
// Every study screen gates its advance on the reward finishing, so
// which tier a review lands in is not cosmetic: it is the difference
// between the next card arriving now and arriving 2.2 seconds later
// (1900ms hold + 260ms exit, measured). The overwhelming majority of
// reviews are 'fare', and 'fare' must stay ungated.

describe('rewardTier', () => {
  it('calls an ordinary review a fare tick', () => {
    // No level change: the common case, and the one that must not
    // hold the next card.
    expect(rewardTier({ amount: 7, leveledUp: false })).toBe('fare')
    expect(rewardTier({ amount: 0 })).toBe('fare')
    expect(rewardTier(null)).toBe('fare')
  })

  it('separates a level from a rank by the title, not a round number', () => {
    // A level-up that stays inside its band is 'level'; one that
    // changes the 称号 is 'rank'. Which is which comes from
    // domain/levelTitle, so this pins the boundary behaviour rather
    // than specific levels: whatever the bands are, crossing one must
    // read as 'rank' and staying inside it as 'level'.
    const tiers = Array.from({ length: 40 }, (_, i) =>
      rewardTier({ leveledUp: true, newLevel: i + 1 }))
    expect(new Set(tiers)).toEqual(new Set(['level', 'rank']))
    expect(tiers.filter(t => t === 'rank').length).toBeGreaterThan(0)
    // Ranks are rare by design — "four times in the entire
    // progression" — so they must not outnumber plain level-ups.
    expect(tiers.filter(t => t === 'rank').length)
      .toBeLessThan(tiers.filter(t => t === 'level').length)
  })

  it('is never gated on by the study screens for a fare tick', () => {
    // The regression this guards is silent: re-adding an unconditional
    // `gates.add('toast')` puts the 2.2s delay back on every review
    // and nothing fails. The screens must reach the gate through the
    // tier, never straight.
    const here = dirname(fileURLToPath(import.meta.url))
    const screens = join(here, '..', 'screens')
    const offenders = []
    for (const f of readdirSync(screens).filter(n => n.endsWith('.jsx') && !n.includes('.test.'))) {
      const src = readFileSync(join(screens, f), 'utf8')
      for (const line of src.split('\n')) {
        const t = line.trim()
        // The gate may only be reached through the tier: a bare add,
        // or any add on a line that never consults rewardTier, is the
        // regression.
        if (t.includes("gates.add('toast')") && !t.includes('rewardTier')) offenders.push(`${f}: ${t}`)
      }
    }
    expect(offenders, `the 'toast' gate must be conditioned on rewardTier:\n${offenders.join('\n')}`)
      .toEqual([])
  })
})
