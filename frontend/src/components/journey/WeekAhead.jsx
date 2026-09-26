import { useLang } from '../../LangContext'
import { useForecast } from '../../stores/forecast'
import { useTodaySummary } from '../../stores/today'
import { useLeft } from '../../stores/gateRun'

// ── 七日 — the week ahead, under the journey (plan 135) ─────────────
// The owner's pick (A·2 of the Today canvas) put the next seven days at
// the foot of the desk's side column: a bar a day, its count over it
// and its weekday under it, today's in gold; and, when the gate's run
// is shorter than the day, what it leaves for tomorrow. Today's bar is
// the gate's own total (/api/today), not the forecast's first figure,
// which counts scheduler rows the queue may not serve: the two numbers
// on one screen must agree. Desk only (TodayScreen's DeskSide).
const WEEKDAY = new Intl.DateTimeFormat('ja-JP', { weekday: 'narrow', timeZone: 'UTC' })

export function WeekAhead() {
  const { t } = useLang()
  const { data } = useForecast()
  const { data: today } = useTodaySummary()
  const left = useLeft()
  const days = data?.days
  if (!days?.length) return null
  const counts = days.map((d, i) => (i === 0 && today ? today.total ?? d.count : d.count))
  const top = Math.max(1, ...counts)

  return (
    <section className="desk-week" aria-label={t.weekAhead} data-guide="today.week">
      <ol className="desk-week__bars">
        {days.map((d, i) => (
          <li key={d.date} className={`desk-week__day${i === 0 ? ' desk-week__day--today' : ''}`}>
            <span className="desk-week__n">{counts[i]}</span>
            <span className="desk-week__bar" style={{ '--week-share': counts[i] / top }} aria-hidden="true" />
            <span className="desk-week__d" lang="ja">{WEEKDAY.format(new Date(`${d.date}T12:00:00Z`))}</span>
          </li>
        ))}
      </ol>
      {left > 0 && (
        <p className="desk-week__left">
          <span>{t.weekLeft}</span>
          <b>{left}</b>
        </p>
      )}
    </section>
  )
}
