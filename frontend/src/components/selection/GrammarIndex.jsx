import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { StageMark } from '../study/StageMark'
import { ChevronIcon } from '../ui/Icons'

// ── The points of a level, as an index (plan 087) ───────────────
// Behind the station's door (GrammarScreen, ?index=1): one row per
// point in the order the level teaches them — the pattern, its gloss,
// the stage the learner has reached — each a door onto the lesson
// sheet. Hairline-divided rows, no heading: the bar overhead names the
// level, the rows name themselves.
export default function GrammarIndex({ points, onOpen }) {
  const { t } = useLang()
  if (!points?.length) return null
  return (
    <ol className="gl-index" aria-label={t.glPoints}>
      {points.map(p => (
        <li key={p.raw_id}>
          <button type="button" className={`gl-index__row gl-index__row--${p.stage}`}
                  onClick={() => { playUi('click-screen-selection'); onOpen(p.raw_id) }}>
            <span className="gl-index__pattern" lang="ja">{p.pattern}</span>
            <span className="gl-index__gloss">{p.meaning}</span>
            <StageMark stage={p.stage} inline />
            <ChevronIcon direction="right" size={14} className="gl-index__chev" />
          </button>
        </li>
      ))}
    </ol>
  )
}
