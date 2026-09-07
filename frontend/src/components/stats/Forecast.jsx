import { useLang } from '../../LangContext'

// ── Upcoming reviews (canvas Statistics, plan 074) ────────────
// A week of scheduled work, a bar a day with its count over it and
// the day's name under it. Today's bar already includes everything
// overdue (the backend folds late cards into day zero rather than
// leaving them under a date that has passed), so it is a backlog and
// not a plan — the cap above the chart prints the week's total.
export function Forecast({ forecast }) {
  const { t, lang } = useLang()
  if (!forecast?.length) return null

  const days = forecast.slice(0, 7)
  const max = Math.max(1, ...days.map(f => f.count))
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' })
  const full = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="forecast forecast--pass">
      <div className="forecast__bars">
        {days.map(day => {
          const date = new Date(`${day.date}T12:00:00`)
          return (
            <span key={day.date} className="forecast__col" title={`${full.format(date)} — ${t.reviewsCount(day.count)}`}>
              <span className="forecast__v">{day.count}</span>
              <span
                className="forecast__bar"
                style={{ height: `${day.count === 0 ? 0 : Math.max(3, (day.count / max) * 100)}%` }}
              />
            </span>
          )
        })}
      </div>
      <div className="forecast__days" aria-hidden="true">
        {days.map(day => <span key={day.date}>{weekday.format(new Date(`${day.date}T12:00:00`))}</span>)}
      </div>
    </div>
  )
}
