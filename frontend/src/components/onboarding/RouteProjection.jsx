import { useMemo } from 'react'
import { useLang } from '../../LangContext'
import { projectJourney } from '../../domain/journeyProjection'

// ── 路線図 — the journey ahead, drawn as a line ──────────────────
// The projection rendered the way this app draws every ordered thing:
// a line with stations on it. The x-axis is the next twelve months,
// the rising line is everything learned at the chosen pace, and each
// level's completion is a station marker ON the line — the same
// white-filled, line-stroked marker LevelSelector's route diagram
// uses, because it is the same idea: a stop you will reach.
//
// The SVG is decorative (aria-hidden); the real content is the
// milestone list rendered as text below it, one row per station, plus
// the honest-assumption line. No chart library — the house idiom is
// hand SVG (see PassHolder's XP ring).

const CHART = { w: 720, h: 210, left: 34, right: 700, top: 22, bottom: 168 }

export default function RouteProjection({ volumes, startLevel, perDay, includeKana = false, months = 12 }) {
  const { t, lang } = useLang()

  const journey = useMemo(
    () => projectJourney(volumes, startLevel, perDay, { months, includeKana }),
    [volumes, startLevel, perDay, months, includeKana],
  )
  const monthName = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { month: 'long' })
    const short = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { month: 'short' })
    return {
      long: idx => fmt.format(monthDate(idx)),
      short: idx => short.format(monthDate(idx)),
    }
  }, [lang])

  const { points, milestones, totalItems, horizonItems } = journey
  const maxY = Math.max(horizonItems, 1)

  const x = m => CHART.left + (m / months) * (CHART.right - CHART.left)
  const y = items => CHART.bottom - (Math.min(items, maxY) / maxY) * (CHART.bottom - CHART.top)

  const polyline = points.map(p => `${x(p.monthIndex).toFixed(1)},${y(p.cumulativeItems).toFixed(1)}`).join(' ')

  const tickMonths = [0, 3, 6, 9, 12].filter(m => m <= months)

  return (
    <div className="onb-map">
      {/* The month labels live in HTML, absolutely positioned at the
          same x the SVG ticks use — SVG text scales down with the
          viewBox and was ~5px on a phone; HTML text stays readable at
          every width. */}
      <div className="onb-map__wrap" aria-hidden="true">
        <svg className="onb-map__chart" viewBox={`0 0 ${CHART.w} ${CHART.h}`}>
        {/* Baseline rail with a tick per quarter. */}
        <line className="onb-map__baseline" x1={CHART.left} y1={CHART.bottom} x2={CHART.right} y2={CHART.bottom} />
        {tickMonths.map(m => (
          <line key={m} className="onb-map__tick" x1={x(m)} y1={CHART.bottom} x2={x(m)} y2={CHART.bottom + 5} />
        ))}

        {/* The travelled line, drawing itself out of the origin the
            way the pass ring fills — pathLength=1 so the CSS dash
            trick needs no measured length (reduced motion shows it
            complete, see onboarding.css). */}
        <polyline className="onb-map__line" points={polyline} pathLength="1" />

        {/* Level-completion stations on the line, arriving in order
            just behind the line that reaches them. */}
        {milestones.map((ms, i) => (
          <g key={ms.level} className="onb-map__station" style={{ '--stop-i': i }}>
            <line
              className="onb-map__drop"
              x1={x(ms.monthIndex)} y1={y(ms.items)}
              x2={x(ms.monthIndex)} y2={CHART.bottom}
            />
            <circle className="onb-map__stop" cx={x(ms.monthIndex)} cy={y(ms.items)} r="6" />
          </g>
        ))}
        </svg>

        {/* HTML overlays on the chart: station plates at each level's
            crossing, month labels under the baseline ticks. Positions
            are percentages of the same coordinate space the SVG draws
            in, so they cannot drift from it. */}
        {milestones.map((ms, i) => (
          <span
            key={ms.level}
            className="onb-map__plate onb-map__station"
            style={{
              '--stop-i': i,
              left: `${(x(ms.monthIndex) / CHART.w) * 100}%`,
              top: `${(y(ms.items) / CHART.h) * 100}%`,
            }}
          >
            {ms.level}
          </span>
        ))}
        {tickMonths.map(m => (
          <span
            key={m}
            className="onb-map__month"
            style={{ left: `${(x(m) / CHART.w) * 100}%` }}
          >
            {m === 0 ? t.onbMapNow : monthName.short(m)}
          </span>
        ))}
      </div>

      {/* The same information as text — the SVG above is decoration. */}
      <p className="onb-map__total">{t.onbMapTotal(horizonItems, totalItems)}</p>
      <ul className="onb-map__milestones">
        {milestones.map(ms => (
          <li key={ms.level} className="onb-map__milestone">
            <span className="onb-map__milestone-marker" aria-hidden="true" />
            <span>{t.onbMapMilestone(ms.level, ms.items, monthName.long(Math.ceil(ms.monthIndex)))}</span>
          </li>
        ))}
        {milestones.length === 0 && (
          <li className="onb-map__milestone">{t.onbMapNoMilestone}</li>
        )}
      </ul>
      <p className="onb-map__assumption">{t.onbMapAssumption}</p>
    </div>
  )
}

function monthDate(monthIndex) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + monthIndex)
  return d
}
