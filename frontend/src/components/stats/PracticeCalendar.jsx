import { useMemo } from 'react'
import { useLang } from '../../LangContext'
import { buildCalendar, monthTicks } from '../../domain/statsModel'

// ── The practice calendar (canvas Statistics, plan 074) ───────
// Fourteen weeks of days, one square each, inked by how much work went
// into them — a streak looks like a streak, a fortnight off looks like
// a hole, and "I only ever study on Sundays" is visible at a glance in
// a way no column of numbers makes visible. Fourteen columns fit a
// phone whole, so there is nothing to scroll: the newest week is the
// right-hand column. The backend sends a year of days (extra.trend);
// the last fourteen weeks are what fits.
export function PracticeCalendar({ trend, weeks = 14 }) {
  const { t, lang } = useLang()
  const { columns, days } = useMemo(() => buildCalendar(trend, weeks), [trend, weeks])
  const ticks = useMemo(() => monthTicks(columns), [columns])

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, m) =>
      new Date(2000, m, 1).toLocaleDateString(lang, { month: 'short' })),
    [lang],
  )
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }),
    [lang],
  )

  const past = days.filter(d => !d.future)
  const active = past.filter(d => d.count > 0)
  const totalReviews = past.reduce((n, d) => n + d.count, 0)

  return (
    <div className="cal cal--gold" style={{ '--weeks': weeks }}>
      <div className="cal__months" aria-hidden="true">
        {ticks.map((tick, i) => (
          <span
            key={tick.index}
            className="cal__month"
            style={{ gridColumn: `${tick.index + 1} / span ${(ticks[i + 1]?.index ?? weeks) - tick.index}` }}
          >
            {monthNames[tick.month]}
          </span>
        ))}
      </div>
      <div
        className="cal__grid"
        role="img"
        aria-label={t.calendarSummary(active.length, past.length, totalReviews.toLocaleString())}
      >
        {days.map(day => (
          <span
            key={day.date}
            className={`cal__cell${day.level ? ` cal__cell--${day.level}` : ''}${day.future ? ' cal__cell--future' : ''}`}
            title={day.future ? '' : `${dayFormat.format(new Date(`${day.date}T12:00:00`))} — ${t.reviewsCount(day.count)}`}
          />
        ))}
      </div>
      <div className="cal__foot">
        <span>{t.calFoot}</span>
        <span className="cal__scale" aria-hidden="true">
          {t.calendarLess}
          {[0, 1, 2, 3, 4].map(l => <span key={l} className={`cal__cell${l ? ` cal__cell--${l}` : ''}`} />)}
          {t.calendarMore}
        </span>
      </div>
    </div>
  )
}
