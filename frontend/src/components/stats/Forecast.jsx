import { useLang } from '../../LangContext'

// ── 先の山 — what's coming ─────────────────────────────────
// A fortnight of scheduled work. Two readings on one chart: the bars
// are each day's own pile, and the ghost behind them is the running
// total — because the question people actually ask of a forecast is
// "what happens if I skip tomorrow", and only the cumulative line
// answers it.
//
// Today's bar is called out separately: it's the only one that already
// includes everything overdue (the backend folds late cards into day
// zero rather than leaving them under a date that has passed), so it
// is a backlog and not a plan.
export function Forecast({ forecast }) {
  const { t, lang } = useLang()
  if (!forecast?.length) return null

  const max = Math.max(1, ...forecast.map(f => f.count))
  const total = forecast.reduce((n, f) => n + f.count, 0)

  // Accumulated by reading back the previous entry rather than by
  // carrying a counter declared outside the loop: a binding in the
  // component body that keeps being reassigned during render is
  // exactly what react-hooks/immutability is there to catch.
  const days = forecast.reduce((acc, f, i) => {
    acc.push({ ...f, cumulative: (acc[i - 1]?.cumulative ?? 0) + f.count, index: i })
    return acc
  }, [])

  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'narrow' })
  const dayNum = new Intl.DateTimeFormat(lang, { day: 'numeric' })

  return (
    <div className="forecast">
      <div className="forecast__chart">
        {days.map(day => {
          const date = new Date(`${day.date}T12:00:00`)
          const isToday = day.index === 0
          return (
            <div
              key={day.date}
              className={`forecast__day${isToday ? ' forecast__day--today' : ''}`}
              title={`${date.toLocaleDateString(lang)} — ${t.reviewsCount(day.count)} (${t.cumulative}: ${day.cumulative})`}
            >
              <span className="forecast__count">{day.count || ''}</span>
              <span className="forecast__bars">
                <span
                  className="forecast__cumulative"
                  style={{ height: `${(day.cumulative / Math.max(1, total)) * 100}%` }}
                />
                <span
                  className="forecast__bar"
                  style={{ height: `${day.count === 0 ? 0 : Math.max(3, (day.count / max) * 100)}%` }}
                />
              </span>
              <span className="forecast__label">
                <span className="forecast__weekday">{weekday.format(date)}</span>
                <span className="forecast__date">{dayNum.format(date)}</span>
              </span>
            </div>
          )
        })}
      </div>

      <div className="forecast__legend">
        <span className="forecast__legend-item forecast__legend-item--bar">{t.perDay}</span>
        <span className="forecast__legend-item forecast__legend-item--cum">{t.cumulative} {total.toLocaleString()}</span>
      </div>
    </div>
  )
}
