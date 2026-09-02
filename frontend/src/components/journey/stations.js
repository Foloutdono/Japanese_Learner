import { journeyIncludesKana, journeyLevels } from '../../domain/goalMath'
import { levelItems } from '../../domain/journeyProjection'

// ── The stations under the ghost track ───────────────────────────
// 発 at the origin, then each level at its cumulative share of the
// promised total — the same arithmetic routes/journey.py priced the
// journey with. Shared by the pass back (JourneyPass) and the
// onboarding's 案内 promise scene; its own module because component
// files export components only (react-refresh's rule). Without
// volumes the drawing degrades to departure + destination.
export function journeyStations(volumes, startLevel, goalLevel, itemsTotal) {
  const base = [{ label: '発', jp: true, pos: 0 }]
  if (!volumes || !startLevel || !itemsTotal) {
    return goalLevel ? [...base, { label: goalLevel, pos: 100 }] : base
  }
  let cumulative = journeyIncludesKana(startLevel) ? (volumes.kana ?? 0) : 0
  const stops = journeyLevels(startLevel, goalLevel).map(level => {
    cumulative += levelItems(volumes, level)
    return { label: level, pos: Math.min(cumulative / itemsTotal, 1) * 100 }
  })
  return [...base, ...stops]
}
