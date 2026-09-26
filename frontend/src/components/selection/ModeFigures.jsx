import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { useStats } from '../../stores/stats'
import { apiFetch } from '../../lib/api'
import { bucketRow, modeRow } from '../../domain/statsModel'
import { Composition } from '../stats/Composition'

// ── 机 — a platform's own figures (plan 114) ────────────────────────
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
  return <Figures row={modeRow(useStats().data, source, deck, mode)} />
}

// The same figures for a stop /api/stats does not carry (plan 115): a
// theme band, a frequency tier. Each platform asks its own scoped
// stats route — the one its run already reads for its head — so the
// figure beside the card is the figure the run will open on.
export function ScopeFigures({ url, session }) {
  const [got, setGot] = useState(null)
  useEffect(() => {
    let live = true
    apiFetch(url, session)
      .then(r => (r.ok ? r.json() : null))
      .then(body => { if (live) setGot({ url, row: bucketRow(body) }) })
      .catch(() => { if (live) setGot({ url, row: null }) })
    return () => { live = false }
  }, [url, session])
  // A figure from the stop the learner just left is not this stop's.
  return <Figures row={got?.url === url ? got.row : null} />
}

// With nothing due, the cards in progress say what the bar's red sliver
// is (plan 137): a fortnight of first passes leaves "0 / 674" mastered
// on every platform, and this is the figure that moves meanwhile.
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
        <span className="sr-only">{t.mastered} </span>
        <b>{row.mastered}</b>/ {row.total}
      </span>
    </span>
  )
}
