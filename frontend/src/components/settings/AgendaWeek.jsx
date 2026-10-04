import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { subjectInfo } from '../../lib/agenda'
import { AXIS_FROM, AXIS_TO, DAYS, clock, dayName } from '../../domain/agenda'

// ── The week, drawn (plan 181) ───────────────────────────────────
// Seven columns, Monday first, one stretch of the day from the morning
// to midnight; each block stands in its day's column where its hours
// fall, in its subject's line colour, and opens its editor. It is the
// agenda as a picture: the list under it says the same in words.
// `today` is the agenda's day (0 = Monday) lit in the header, or -1.
const SPAN = AXIS_TO - AXIS_FROM

export function AgendaWeek({ blocks, today = -1, onOpen }) {
  const { t, lang } = useLang()
  return (
    <div className="agd-week" role="group" aria-label={t.agdWeekAria}>
      {DAYS.map(day => (
        <div key={day} className={`agd-col${day === today ? ' agd-col--today' : ''}`}>
          <span className="agd-col__name" title={dayName(day, lang, 'long')}>{dayName(day, lang, 'narrow')}</span>
          <div className="agd-track">
            {blocks.map((block, i) => {
              if (!block.days.includes(day)) return null
              const info = subjectInfo(block.subject, t)
              const top = Math.max(0, (block.start - AXIS_FROM) / SPAN)
              const bottom = Math.min(1, (block.end - AXIS_FROM) / SPAN)
              if (bottom <= top) return null
              return (
                <button
                  key={i}
                  type="button"
                  className="agd-block"
                  style={{ '--agd-top': top, '--agd-size': bottom - top, '--agd-line': info.color }}
                  aria-label={t.agdBlockAria(info.title, dayName(day, lang, 'long'), clock(block.start), clock(block.end))}
                  onClick={() => { playClick(); onOpen(i) }}
                >
                  <span lang="ja" aria-hidden="true">{info.icon}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
