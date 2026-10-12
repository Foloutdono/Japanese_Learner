import { Link } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useAgenda } from '../../stores/agenda'
import { useMinute } from '../../hooks/useMinute'
import { subjectInfo } from '../../lib/agenda'
import { whenLabel } from '../../lib/ahead'
import { clock, upcoming } from '../../domain/agenda'
import { utcToday, weekdayKanji } from '../../domain/dayClear'
import { playClick } from '../../lib/audio'
import { Slot } from '../dayclear/kit/WeekStamps'
import { AGENDA_PATH } from '../agenda/AgendaNext'

// ── 今日 — the day, in four figures (plan 199) ──────────────────
// What the gate's strip, the basics line and the agenda's card used to
// say over the gate, said once where the learner goes for more: the
// services sheet on a phone, the column beside the dial on the desk.
// A hairline lattice of bare figures (DESIGN.md, Surfaces), each with
// what it counts under it in the learner's words:
//
//   the streak     today's stamp, the rally's own slot, and the days
//   the new cards  learned today of the day's target
//   the basics     the unit the next new card comes from (N5 only)
//   the agenda     the next block, its hour and its subject; a door
//
// A figure the learner does not have is not drawn, and the lattice
// never shows a bare cell: an odd last one takes the row.
export function TodayDay({ today }) {
  const { t, lang } = useLang()
  const summary = useProfileSummary()
  const { blocks } = useAgenda()
  const now = useMinute()

  const cells = []
  if (summary?.streak > 0) {
    cells.push(
      <div key="streak" className="tdy-day__cell">
        <span className="tdy-day__fig">
          <Slot glyph={weekdayKanji(utcToday())} state="now" tilt={-4} aria-hidden="true" />
          {summary.streak}
        </span>
        <span className="tdy-day__what">{t.todayStreakDays}</span>
      </div>,
    )
  }
  const pace = today?.pace
  if (pace?.target) {
    cells.push(
      <div key="new" className="tdy-day__cell">
        <span className="tdy-day__fig">{pace.newToday}<small>/ {pace.target}</small></span>
        <span className="tdy-day__what">{t.todayNewToday}</span>
      </div>,
    )
  }
  const basics = today?.basics
  if (basics && !basics.done) {
    const title = basics.title?.[lang] ?? basics.title?.en ?? ''
    cells.push(
      <div key="basics" className="tdy-day__cell">
        <span className="tdy-day__fig">{basics.unit}<small>/ {basics.of}</small></span>
        <span className="tdy-day__what">{t.todayLesson} · <b>{title}</b></span>
      </div>,
    )
  }
  const next = blocks?.length ? upcoming(blocks, now, 1)[0] : null
  if (next) {
    const info = subjectInfo(next.block.subject, t)
    cells.push(
      <Link key="agenda" to={AGENDA_PATH} className="tdy-day__cell tdy-day__cell--door" onClick={() => playClick()}>
        <span className="tdy-day__fig">{next.now ? t.agdNow : clock(next.block.start)}</span>
        <span className="tdy-day__what">
          {next.now ? null : <>{whenLabel(next.start, now, t, lang)} · </>}
          <b>{info.title}</b>
        </span>
      </Link>,
    )
  }
  if (!cells.length) return null

  return (
    <div className={`tdy-day${cells.length % 2 ? ' tdy-day--odd' : ''}`} aria-label={t.todayDayLabel} role="group">
      {cells}
    </div>
  )
}
