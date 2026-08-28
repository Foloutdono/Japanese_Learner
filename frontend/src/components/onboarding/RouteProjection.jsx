import { useMemo } from 'react'
import { useLang } from '../../LangContext'
import { projectJourney } from '../../domain/journeyProjection'

// ── 路線図 — the journey ahead, drawn as a line ──────────────────
// The projection rendered the way this app draws every ordered thing:
// a vertical line with stations on it, the same visual grammar as
// LevelSelector's route diagram. Each stop is a level completed at the
// chosen pace; the spacing between stops still encodes time (a fast
// pace bunches them, a slow one spreads them), and a journey that
// outruns the twelve-month horizon ends in a dashed "line continues"
// stop rather than pretending to finish.
//
// This replaced an SVG chart deliberately: the chart's line was
// mathematically straight (the model is linear by design, see
// domain/journeyProjection.js), and its HTML overlays were positioned
// by raw percentage with no clamping — the pinned test fixture itself
// put milestones at 91–94% of the width, one narrow viewport away
// from clipping. Block-flow rows cannot clip at an edge, so the fix
// is structural, not a defensive Math.min.

export default function RouteProjection({ volumes, startLevel, perDay, includeKana = false, months = 12 }) {
  const { t, lang } = useLang()

  const journey = useMemo(
    () => projectJourney(volumes, startLevel, perDay, { months, includeKana }),
    [volumes, startLevel, perDay, months, includeKana],
  )
  const monthName = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { month: 'long' })
    return idx => fmt.format(monthDate(idx))
  }, [lang])

  const { milestones, totalItems, horizonItems } = journey
  // Everything the app teaches from this level fits inside the
  // horizon: the line genuinely terminates, and says so, instead of
  // leaving "flat because done" indistinguishable from "still going".
  const finished = horizonItems >= totalItems

  // Spacing encodes elapsed time between stops, clamped so no pace
  // can crush rows together or push one off into the distance.
  const gapFor = delta => `${Math.round(Math.min(90, Math.max(14, delta * 18)))}px`

  const numberFmt = lang === 'fr' ? 'fr-FR' : 'en'

  return (
    <div className="onb-map">
      <p className="onb-map__total">{t.onbMapTotal(horizonItems, totalItems)}</p>

      <div className="onb-route">
        {/* The origin — where the learner stands today. */}
        <div className="onb-route__stop onb-route__stop--now" style={{ '--stop-i': 0, '--stop-gap': gapFor(milestones[0]?.monthIndex ?? 1) }}>
          <span className="onb-route__rail" aria-hidden="true" />
          <span className="onb-route__marker" aria-hidden="true" />
          <span className="onb-route__body">
            <span className="onb-route__level">{t.onbMapNow}</span>
            <span className="onb-route__when">{t.onbMapDeparting(startLevel)}</span>
          </span>
        </div>

        {milestones.map((ms, i) => {
          const next = milestones[i + 1]
          const last = i === milestones.length - 1
          return (
            <div
              key={ms.level}
              className={[
                'onb-route__stop',
                last && finished && 'onb-route__stop--complete',
              ].filter(Boolean).join(' ')}
              style={{
                '--stop-i': i + 1,
                '--stop-gap': last ? (finished ? '0px' : gapFor(months - ms.monthIndex)) : gapFor(next.monthIndex - ms.monthIndex),
              }}
            >
              <span className="onb-route__rail" aria-hidden="true" />
              <span className="onb-route__marker" aria-hidden="true" />
              <span className="onb-route__body">
                <span className="onb-route__level">{ms.level}</span>
                <span className="onb-route__when">{t.onbMapReached(monthName(Math.ceil(ms.monthIndex)))}</span>
                <span className="onb-route__items">{t.onbMapKnown(ms.items.toLocaleString(numberFmt))}</span>
              </span>
            </div>
          )
        })}

        {/* Past the horizon: the line keeps going — drawn as a dashed
            stop and a rail that fades out, never as a false terminus. */}
        {!finished && (
          <div className="onb-route__stop onb-route__stop--horizon" style={{ '--stop-i': milestones.length + 1 }}>
            <span className="onb-route__continues" aria-hidden="true" />
            <span className="onb-route__marker" aria-hidden="true" />
            <span className="onb-route__body">
              <span className="onb-route__when">
                {milestones.length === 0
                  ? t.onbMapNoMilestone
                  : t.onbMapContinues(horizonItems.toLocaleString(numberFmt))}
              </span>
            </span>
          </div>
        )}
      </div>

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
