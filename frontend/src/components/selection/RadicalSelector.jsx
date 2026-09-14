import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import Empty from '../ui/Empty'
import { RadicalGrid } from '../dictionary/RadicalIndex'

/**
 * RadicalSelector — 部首, as a way into the kanji (plan 086).
 *
 * The dictionary's radical index dressed as a study source: the same
 * strip and page (components/dictionary/RadicalIndex.jsx), but each
 * tile is one of the course's own radicals — only the 194 that file a
 * kanji the course teaches, since a lesson with no family is not a
 * lesson — and what it prints is what the choice is made on: the form
 * the learner will meet, its meaning in their language, and how many
 * of its kanji they have learned over how many the course holds.
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
 */
export default function RadicalSelector({ session, onSelect, stroke, onStroke }) {
  const { t, lang } = useLang()
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
      stroke={stroke}
      onStroke={onStroke}
      t={t}
    />
  )
}
