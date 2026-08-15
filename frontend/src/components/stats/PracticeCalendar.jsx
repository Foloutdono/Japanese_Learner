import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { buildCalendar, monthTicks } from '../../domain/statsModel'

// ── 稽古暦 — the practice calendar ─────────────────────────
// Half a year of days, one square each, inked by how much work went
// into them. The backend has always logged every review with a
// timestamp and the screen has always fetched it — `extra.trend` was
// requested on every load and then thrown away without being rendered
// once. This is that data.
//
// It earns its space by being the only view here with *shape*: a
// streak looks like a streak, a fortnight off looks like a hole, and
// "I only ever study on Sundays" is visible at a glance in a way no
// column of numbers makes visible.
// A full year. The backend sends 371 days for exactly this reason —
// 53 whole weeks, so the leading column is never a stub.
const WEEKS = 53

export function PracticeCalendar({ trend }) {
  const { t, lang } = useLang()
  const [hover, setHover] = useState(null)

  const { columns, max, days } = useMemo(() => buildCalendar(trend, WEEKS), [trend])
  const ticks = useMemo(() => monthTicks(columns), [columns])

  const past = days.filter(d => !d.future)
  const active = past.filter(d => d.count > 0)
  const totalReviews = past.reduce((n, d) => n + d.count, 0)
  const best = past.reduce((b, d) => (d.count > (b?.count ?? 0) ? d : b), null)

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, m) =>
      new Date(2000, m, 1).toLocaleDateString(lang, { month: 'short' })),
    [lang],
  )

  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }),
    [lang],
  )

  // A year reads oldest-to-newest left to right, which is correct and
  // stays. But the scroll then opens on last August: on a phone, where
  // only about six weeks fit, you had to drag the whole year sideways
  // to find out whether you studied *today*. Start pinned to the right
  // instead, so the newest weeks are what you land on and the history
  // is what you scroll back into. No-op on a desktop where the whole
  // year already fits, since there is nothing to scroll.
  const scrollRef = useRef(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [columns])

  return (
    <div className="calendar-panel">
      <div className="calendar-panel__scroll" ref={scrollRef}>
        <div className="calendar" style={{ '--weeks': WEEKS }}>
          <div className="calendar__months">
            {ticks.map(tick => (
              <span
                key={tick.index}
                className="calendar__month"
                style={{ gridColumn: tick.index + 1 }}
              >
                {monthNames[tick.month]}
              </span>
            ))}
          </div>

          <div className="calendar__grid">
            {columns.map((week, w) => (
              <div key={w} className="calendar__week">
                {week.map(day => (
                  <span
                    key={day.date}
                    className={`calendar__day calendar__day--l${day.level}${day.future ? ' calendar__day--future' : ''}`}
                    onMouseEnter={() => !day.future && setHover(day)}
                    onMouseLeave={() => setHover(null)}
                    title={day.future ? '' : `${dayFormat.format(new Date(`${day.date}T12:00:00`))} — ${day.count}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="calendar-panel__footer">
        <span className="calendar-panel__reading">
          {hover
            ? `${dayFormat.format(new Date(`${hover.date}T12:00:00`))} · ${t.reviewsCount(hover.count)}`
            : t.calendarSummary(active.length, past.length, totalReviews.toLocaleString())}
        </span>

        <span className="calendar-panel__legend">
          {best?.count > 0 && (
            <span className="calendar-panel__best">{t.bestDay} {best.count}</span>
          )}
          <span className="calendar-panel__scale">
            <span className="calendar-panel__scale-label">{t.calendarLess}</span>
            {[0, 1, 2, 3, 4].map(l => (
              <span key={l} className={`calendar__day calendar__day--l${l}`} />
            ))}
            <span className="calendar-panel__scale-label">{t.calendarMore}</span>
            <span className="calendar-panel__scale-max">{max}</span>
          </span>
        </span>
      </div>
    </div>
  )
}
