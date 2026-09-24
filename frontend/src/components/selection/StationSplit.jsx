import { Navigate } from 'react-router-dom'
import { useProfileSummaryState } from '../../stores/profileSummary'
import { useStats } from '../../stores/stats'
import { currentKanaSet } from '../../domain/kanaSets'
import { Loading } from '../ui/Loading'

// ── 机 — a station as two panes (plan 114) ───────────────────────────
// On a phone a station is two screens: the line's stops, then — one tap
// later — the chosen stop's platforms. On the desk there is room for
// both at once, which is what a desktop list of choices beside the thing
// chosen looks like: the stops upright in the second column's width on
// the left (the route diagram, still the one component), the platforms
// on the right, each carrying its own figures. Choosing another stop
// swaps the right pane in place (the URL follows, replacing rather than
// stacking), so the stops never leave the screen and the step that
// only existed because a phone could show one list at a time is gone.
//
// Rendered only when hooks/useDesk says so, by the screen that owns it
// (VocabScreen, KanjiScreen, KanaScreen, GrammarScreen, ExamScreen; since
// plan 115 the grammar points, the tiers, the theme bands, the exam's
// review and the library's shelf, whose `className` sets its columns).
//
// The list's rows are links (plan 117, SplitRow): another stop is a
// URL, so it opens in a new tab as well as beside the list, and the
// link replaces rather than pushes, as the split always has.
export function StationSplit({ label, list, className = '', children }) {
  return (
    <div className={className ? `desk-split ${className}` : 'desk-split'}>
      <nav className="desk-split__list" aria-label={label}>{list}</nav>
      <div className="desk-split__page">{children}</div>
    </div>
  )
}

// The page that was only the list of stops has nothing left to show on
// its own once the stops stand beside the platforms: it opens on the
// learner's own stop — the declared level, or for kana the set the
// figures say they are on — the way Settings' bare list opens on its
// first page. It waits for the answer rather than guessing N5 and
// jumping, so an N3 learner never sees N5's platforms flash past.
export function LevelRedirect({ to }) {
  const { summary, failed } = useProfileSummaryState()
  if (!summary && !failed) return <Loading />
  return <Navigate replace to={to(summary?.jlptLevel || 'N5')} />
}

export function KanaSetRedirect({ to }) {
  const { data, failed } = useStats()
  if (!data && !failed) return <Loading />
  return <Navigate replace to={to(currentKanaSet(data?.items?.kana) ?? 'hiragana_basic')} />
}
