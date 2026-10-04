import { Link } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { subjectInfo } from '../../lib/agenda'
import { whenLabel } from '../../lib/ahead'
import { ChevronIcon } from '../ui/Icons'
import { clock, progressOf, upcoming } from '../../domain/agenda'
import { sameLocalDay } from '../../lib/ahead'

export const AGENDA_PATH = '/profile/settings/agenda'

// ── 次 — what is next on the agenda (plan 181) ───────────────────
// The block under way, with how far it has run and the way into its
// subject, or the next one to come and when. One card wherever it is
// drawn: on the Agenda page over the week; on Today under the pass's
// strip (a phone) or in the side column (the desk), where it is also
// the way to the agenda and, given `then`, lists the blocks after it.
//
//   blocks   the week (stores/agenda)
//   now      the clock, read once a minute (hooks/useMinute)
//   open     the card's words open the agenda (on Today)
//   then     how many of the following blocks to list under it
export function AgendaNext({ blocks, now, open = false, then = 0 }) {
  const { t, lang } = useLang()
  const coming = upcoming(blocks, now, 1 + then)
  const next = coming[0]
  if (!next) return null
  const info = subjectInfo(next.block.subject, t)
  // The card is what is next by being there: a block to come says only
  // when; one under way says so, its hours at the two ends of its bar.
  const when = next.now
    ? t.agdNow
    : `${whenLabel(next.start, now, t, lang)} ${clock(next.block.start)}`
  const words = (
    <>
      <span className="agd-now__glyph" lang="ja" aria-hidden="true">{info.icon}</span>
      <span className="agd-now__text">
        <span className="agd-now__when">{when}</span>
        <b className="agd-now__name">{info.title}</b>
      </span>
    </>
  )
  const progress = next.now ? progressOf(next, now) : null

  return (
    <section
      className={`agd-now${next.now ? ' agd-now--live' : ''}${open ? ' agd-now--door' : ''}`}
      style={{ '--agd-line': info.color }}
      aria-label={t.settingsAgenda}
      data-next
    >
      <div className="agd-now__main">
        {open ? (
          <Link to={AGENDA_PATH} className="agd-now__open" onClick={() => playClick()}>
            {words}
            {!next.now && <ChevronIcon direction="right" size={16} className="agd-now__chev" />}
          </Link>
        ) : (
          <span className="agd-now__open">{words}</span>
        )}
        {(next.now || !open) && (
          <Link to={info.path} className="btn-secondary agd-now__go" onClick={() => playClick()}>{t.agdGo}</Link>
        )}
      </div>
      {progress != null && (
        <div className="agd-now__run">
          <span className="agd-now__at">{clock(next.block.start)}</span>
          <span
            className="agd-now__bar"
            role="progressbar"
            aria-label={t.agdProgressAria(info.title)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuetext={t.agdUntil(clock(next.block.end))}
          >
            <i style={{ width: `${progress * 100}%` }} />
          </span>
          <span className="agd-now__at">{clock(next.block.end)}</span>
        </div>
      )}
      {coming.length > 1 && (
        <ol className="agd-now__then" aria-label={t.agdThen}>
          {coming.slice(1).map(occ => {
            const o = subjectInfo(occ.block.subject, t)
            return (
              <li key={`${occ.start.getTime()}-${occ.block.subject}`} style={{ '--agd-line': o.color }}>
                {/* Today's hour alone; another day's name before it. */}
                <span className="agd-now__then-when">
                  {sameLocalDay(occ.start, now) ? clock(occ.block.start) : `${whenLabel(occ.start, now, t, lang)} ${clock(occ.block.start)}`}
                </span>
                <span className="agd-now__then-name">
                  <span className="agd-now__then-glyph" lang="ja" aria-hidden="true">{o.icon}</span>
                  {o.title}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
