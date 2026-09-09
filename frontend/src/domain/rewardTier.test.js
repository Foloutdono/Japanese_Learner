import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rewardTier } from './rewardTier'

// ── The tier decides how big the moment is ──────────────────────
// It used to decide something heavier: whether the next card waited.
// The rank re-issue was the one tier that gated, and it went with the
// rank titles, so nothing between two cards waits on an animation any
// more. That is the property worth guarding here.

describe('rewardTier', () => {
  it('calls an ordinary review a fare tick', () => {
    // No level change: the common case, and the quietest.
    expect(rewardTier({ amount: 7, leveledUp: false })).toBe('fare')
    expect(rewardTier({ amount: 0 })).toBe('fare')
    expect(rewardTier(null)).toBe('fare')
  })

  it('calls every level-up a level board, whatever the number', () => {
    // There is no third tier. Levels used to sit in bands with a title
    // each (見習い … 免許皆伝), and crossing one promoted the reward to
    // a full-screen pass re-issue; now a level is a level.
    const tiers = Array.from({ length: 40 }, (_, i) =>
      rewardTier({ leveledUp: true, newLevel: i + 1 }))
    expect(new Set(tiers)).toEqual(new Set(['level']))
  })

  it('is never gated on, by a screen or by the hook', () => {
    // The regression this guards is silent: re-adding a
    // `gates.add('toast')` puts a 2.2s delay back on every review and
    // nothing fails. Nothing may open that gate now — the fare rides
    // the level HUD and the level board plays over the next card.
    const here = dirname(fileURLToPath(import.meta.url))
    const offenders = []
    for (const dir of [join(here, '..', 'screens'), join(here, '..', 'hooks')]) {
      for (const f of readdirSync(dir)) {
        if (!/\.jsx?$/.test(f) || f.includes('.test.')) continue
        const src = readFileSync(join(dir, f), 'utf8')
        for (const line of src.split('\n')) {
          if (line.includes("gates.add('toast')")) offenders.push(`${f}: ${line.trim()}`)
        }
      }
    }
    expect(offenders, `no reward may hold the next card:\n${offenders.join('\n')}`)
      .toEqual([])
  })
})
