import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import Empty from '../ui/Empty'
import { Loading } from '../ui/Loading'
import { RadicalGrid } from '../dictionary/RadicalIndex'
import { firstRadical } from '../../domain/radicals'

/**
 * RadicalSelector — 部首, as a way into the kanji (plan 086).
 *
 * The dictionary's radical index dressed as a study source: the same
 * pad and page (components/dictionary/RadicalIndex.jsx), but each
 * tile is one of the course's own radicals — only the 194 that file a
 * kanji the course teaches, since a lesson with no family is not a
 * lesson — and what it prints is what the choice is made on: the form
 * the learner will meet, its meaning in their language, and how many
 * of its kanji they have learned over how many the course holds.
 *
 * `order="rank"` is the other half of that: a page of the index is
 * read here as a shelf of lessons, not as a lookup, so it opens with
 * the families worth the most work rather than in Kangxi order.
 *
 * The count is the COURSE's, never the language's. The dictionary's
 * tile says 氵 files 656 characters, which is true and useless as a
 * denominator; the station says 123, which is a number a learner can
 * finish.
 *
 * Props:
 *   session   — forwarded to apiFetch
 *   onSelect(number)
 *   stroke / onStroke — the page, carried in the station's URL so the
 *               way back from a lesson lands on the page it left
 *   linkTo    — the desk's (plan 123): a radical's URL, which makes its
 *               tile a link (SplitRow), as every split's rows are.
 *   selected  — the desk's (plan 118): the radical whose lesson stands
 *               beside the index, marked, its page the one opened
 *   push      — a tile's link pushes rather than replaces: the kanji
 *               sources' plate, where a radical is a place left for
 *               and Back comes back (SplitRow's `push`)
 */
export default function RadicalSelector({ session, onSelect, stroke, onStroke, selected, linkTo = null, push = false }) {
  const { t } = useLang()
  const { groups, failed } = useRadicalGroups(session)

  if (failed) return <Empty message={t.loadError} />

  return (
    <RadicalGrid
      groups={groups}
      loading={!groups}
      onPick={n => { playUi('click-mode-selection'); onSelect(n) }}
      tile={r => ({
        glyph: r.glyph,
        sub: r.meaning,
        count: r.count,
        learned: r.learned,
        started: r.started > 0,
        title: `${r.meaning} · ${r.count} ${t.kanjiUnit}`,
      })}
      order="rank"
      stroke={stroke}
      onStroke={onStroke}
      selected={selected}
      linkTo={linkTo}
      push={push}
      t={t}
    />
  )
}

// ── 机 — the bare index opens on a radical (plan 118) ─────────────────
// On the desk the index stands beside every radical's page, so the page
// that was only the index has nothing left to show on its own: it opens
// on a radical, the way the frequency tiers open on the first — the
// biggest family of the page it was left on (domain/radicals.js's
// firstRadical). It waits for the index rather than guessing, as
// StationSplit's LevelRedirect waits for the level.
export function RadicalRedirect({ session, stroke, to }) {
  const { t } = useLang()
  const { groups, failed } = useRadicalGroups(session)
  if (failed) return <Empty message={t.loadError} />
  if (!groups) return <Loading />
  const first = firstRadical(groups, stroke)
  if (first == null) return <Empty message={t.loadError} />
  return <Navigate replace to={to(first)} />
}

// The course's radicals, a page per stroke count, in the learner's
// language — the index's one read.
function useRadicalGroups(session) {
  const { lang } = useLang()
  const [groups, setGroups] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch reset that must land with the fetch it announces; not an id-keyed reset.
    setGroups(null)
    setFailed(false)
    apiFetch(`/api/kanji/radicals?lang=${lang}`, session)
      .then(r => r.json())
      .then(data => { if (!cancelled) setGroups(data.groups ?? []) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [session, lang])

  return { groups, failed }
}
