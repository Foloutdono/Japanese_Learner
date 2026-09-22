import { useLang } from '../../LangContext'
import { useStats } from '../../stores/stats'
import { modeRow } from '../../domain/statsModel'
import { Composition } from '../stats/LineRows'

// ── 机 — a platform's own figures (plan 113) ────────────────────────
// A platform card wider than ~440px must earn its width with a
// right-hand column (DESIGN.md, the density contract), and in the
// desk's station split every card is. What earns it is the platform's
// own record, from the buckets /api/stats already keeps per mode: how
// many of its cards are due now (the state's ink), and how far the
// deck has come on it — the stats screen's composition bar, mastered
// and in progress over the whole, with the mastered count beside it.
// Nothing for a platform with no bucket (the fast review) or none of
// the cards yet: an empty column says less than no column.
//
// Mounted only on the desk, so the stats fetch it reads is shared with
// the route beside it and costs a phone nothing.
export function ModeFigures({ source, deck, mode }) {
  const { t } = useLang()
  const stats = useStats().data
  const row = modeRow(stats, source, deck, mode)
  if (!row || row.total === 0) return null
  return (
    <span className="desk-mode-fig">
      {row.due > 0 && (
        <span className="desk-mode-fig__due">{row.due}<span className="desk-mode-fig__unit">{t.dueUnit}</span></span>
      )}
      <Composition row={row} />
      <span className="desk-mode-fig__count">
        <span className="sr-only">{t.mastered} </span>
        <b>{row.mastered}</b>/ {row.total}
      </span>
    </span>
  )
}
