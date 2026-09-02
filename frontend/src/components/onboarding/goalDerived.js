import {
  DAYS_PER_MONTH,
  addDays,
  journeyItems,
  requiredPerDay,
} from '../../domain/goalMath'
import { MAX_PACE } from './paces'

// ── 行先's derived numbers (plan 063, phase E) ───────────────────
// One arithmetic shared by the departure board, the flow's honest
// line, Continue's gate and the final payload. Its own module (not a
// DepartureBoard export) so the component file exports components
// only — react-refresh's rule, and a fair one.
export function goalDerived(volumes, startLevel, goal, now) {
  const hasDest = goal.dest != null
  const items = volumes ? journeyItems(volumes, startLevel, hasDest ? goal.dest : null) : null
  if (hasDest && goal.mode === 'date') {
    const days = goal.months * DAYS_PER_MONTH
    const required = items != null ? requiredPerDay(items, days) : null
    return {
      hasDest,
      items,
      targetDate: addDays(now, days),
      required,
      feasible: required == null || required <= MAX_PACE,
      effectivePerDay: required,
    }
  }
  return {
    hasDest,
    items,
    targetDate: hasDest && items != null ? addDays(now, items / goal.perDay) : null,
    required: null,
    feasible: true,
    effectivePerDay: goal.perDay,
  }
}
