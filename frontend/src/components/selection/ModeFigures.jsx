import { useLang } from '../../LangContext'
import { useStats } from '../../stores/stats'
import { MINE_TTL_MS, useCachedJson } from '../../lib/cachedJson'
import { bucketRow, modeRow } from '../../domain/statsModel'
import { Composition } from '../stats/Composition'

// ── 机 — a platform's own figures (plan 114) ────────────────────────
// A platform card wider than ~440px must earn its width with a
// right-hand column (DESIGN.md, the density contract), and in the
// desk's station split every card is. What earns it is the platform's
// own record, from the buckets /api/stats already keeps per mode: how
// many of its cards are due now (the state's ink), and how far the
// deck has come on it — the composition bar, what the cards add up to
// and the cards met beyond it over the whole, with the figure beside
// it: each card counts for how far it has come, the sum shown whole
// (plan 184), as a stop's figure on the Learn plate is.
// Nothing for a platform with no bucket (the fast review) or none of
// the cards yet: an empty column says less than no column.
//
// Mounted only on the desk, so the stats fetch it reads is shared with
// the route beside it and costs a phone nothing.
//
// `line` is a car's (plan 251, components/selection/LinePlatforms): the
// figures as one line under the car's description -- what is due, or
// under way, then what the cards add up to, or before any is met how
// many there are -- over the composition bar across the car's foot.
export function ModeFigures({ source, deck, mode, line = false }) {
  const row = modeRow(useStats().data, source, deck, mode)
  return line ? <Record row={row} /> : <Figures row={row} />
}

// The same figures for a stop /api/stats does not carry (plan 115): a
// theme band, a frequency tier. Each platform asks its own scoped
// stats route — the one its run already reads for its head — so the
// figures beside the card are the ones the run opens on: its legend
// splits the cards by stage (new, in progress, mastered), where this
// figure adds them up, as the stop's does.
export function ScopeFigures({ url, session }) {
  // Shared and kept briefly (lib/cachedJson, plan 211): a station's
  // platforms used to ask again on every return to the stop. A figure
  // from the stop the learner just left is not this stop's.
  const body = useCachedJson(url, session, { ttlMs: MINE_TTL_MS })
  return <Figures row={body ? bucketRow(body) : null} />
}

// With nothing due, the cards in progress say what the bar's lighter
// part is (plan 137, when a fortnight of first passes left "0 / 674"
// mastered on every platform and this was the figure that moved): the
// count of cards met and not yet counted in full, still true beside a
// figure that now moves too.
function Figures({ row }) {
  const { t } = useLang()
  if (!row || row.total === 0) return null
  return (
    <span className="desk-mode-fig">
      {row.due > 0 && (
        <span className="desk-mode-fig__due">{row.due}<span className="desk-mode-fig__unit">{t.dueUnit}</span></span>
      )}
      {row.due === 0 && row.learning > 0 && (
        <span className="desk-mode-fig__now">{row.learning}<span className="desk-mode-fig__unit">{t.learningUnit}</span></span>
      )}
      <Composition row={row} />
      <span className="desk-mode-fig__count">
        <span className="sr-only">{t.learnedLabel} </span>
        <b>{row.learned}</b>/ {row.total}
      </span>
    </span>
  )
}

function Record({ row }) {
  const { t } = useLang()
  if (!row || row.total === 0) return null
  const met = row.learning + row.mastered > 0
  return (
    <span className="desk-mode-fig desk-mode-fig--line">
      <span className="desk-mode-fig__rec">
        {row.due > 0 && <span className="desk-mode-fig__due">{row.due} {t.dueUnit}</span>}
        {row.due === 0 && row.learning > 0 && <span className="desk-mode-fig__now">{row.learning} {t.learningUnit}</span>}
        {met
          ? (
            <span className="desk-mode-fig__count">
              <span className="sr-only">{t.learnedLabel} </span>
              <b>{row.learned}</b> / {row.total}
            </span>
          )
          : <span className="desk-mode-fig__count">{t.cardsCount(row.total)}</span>}
      </span>
      <Composition row={row} />
    </span>
  )
}
