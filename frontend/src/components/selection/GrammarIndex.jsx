import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { StageMark } from '../study/StageMark'
import { ChevronIcon } from '../ui/Icons'
import { SplitRow } from './SplitRow'
import { useRef } from 'react'
import { useListWalk, useFollowFocus, WALK_KEYS_PAGED } from '../../hooks/useListWalk'

// ── The points of a level, as an index (plan 087) ───────────────
// Behind the station's door (GrammarScreen, ?index=1): one row per
// point in the order the level teaches them — the pattern, its gloss,
// the stage the learner has reached — each a door onto the lesson
// sheet. Hairline-divided rows, no heading: the bar overhead names the
// level, the rows name themselves.
//
// `selected` is the desk's (plan 115): there the lesson stands open
// beside the index, and its row is marked as the page shown. So is
// `linkTo(rawId)` (plan 117): the URL a point opens there, which makes
// its row a link (SplitRow) rather than a call to `onOpen`.
//
// On the desk the index is one tab stop, the open point, walked with
// ↑/↓/Home/End (hooks/useListWalk, plan 123): up to 117 rows were a
// tab stop each. The page's ←/→ open the next point, and the focus goes
// with it while it is in the list.
export default function GrammarIndex({ points, onOpen, selected = null, linkTo = null }) {
  const { t } = useLang()
  const walked = linkTo != null
  const onWalk = useListWalk(walked, { items: ':scope > li > a' })
  const listRef = useRef(null)
  useFollowFocus(listRef, selected, walked)
  if (!points?.length) return null
  const stop = points.some(p => p.raw_id === selected) ? selected : points[0].raw_id
  return (
    <ol className="gl-index" aria-label={t.glPoints} ref={listRef} onKeyDown={onWalk} aria-keyshortcuts={walked ? WALK_KEYS_PAGED : undefined}>
      {points.map(p => (
        <li key={p.raw_id}>
          <SplitRow to={linkTo?.(p.raw_id)} className={`gl-index__row gl-index__row--${p.stage}`}
                    aria-current={selected === p.raw_id ? 'page' : undefined}
                    tabIndex={walked ? (p.raw_id === stop ? 0 : -1) : undefined}
                    onClick={() => { playUi('click-screen-selection'); if (!linkTo) onOpen(p.raw_id) }}>
            <span className="gl-index__pattern" lang="ja">{p.pattern}</span>
            <span className="gl-index__gloss">{p.meaning}</span>
            <StageMark stage={p.stage} inline />
            <ChevronIcon direction="right" size={14} className="gl-index__chev" />
          </SplitRow>
        </li>
      ))}
    </ol>
  )
}
