import { useRef } from 'react'
import { useLang } from '../../LangContext'

// ── 定着 — the retention line (plan 085) ──────────────────
// The screen's one chart: good-or-better as a share of the week's
// reviews, drawn in ink with a stop at every week ridden. Three rules
// from the owner's second look:
//
//   - The line leaves from the LEFT. The axis runs from the first week
//     with reviews to this week, so a learner two weeks in sees a line
//     across the card and not a dot at the far end of ten empty weeks;
//     a learner one week in sees the departure — one stop at the left
//     and the rail ahead, dashed.
//   - Every stop can be asked. A tap or a sweep along the line selects
//     the nearest week and the head above prints that week's figure;
//     the selection is the caller's, so the head and the drawing
//     cannot disagree. Arrow keys do the same from the keyboard.
//   - Little data still draws as one line. A week with nothing between
//     two ridden weeks is bridged with a dashed stroke, never a gap.
//
// The latest week's stop is pressed in the stamp's lacquer; the
// selected week wears a ring in the same ink.
const W = 326
const H = 96
// The inset clears the asked week's ring (r 8 + its stroke), so a stop
// at 100% or at either end of the axis is drawn whole, never clipped.
const RING = 8
const PAD = RING + 2
const FOOT = 4

export function RetentionLine({ weeks, currentIndex, firstIndex, selected, onSelect }) {
  const { t } = useLang()
  const svgRef = useRef(null)

  if (currentIndex === null || firstIndex === null) return null

  // The weeks on the axis: from the first ridden to this week.
  const shown = weeks.slice(firstIndex)
  const n = shown.length
  const pcts = shown.map(w => w.pct).filter(p => p !== null)
  // The floor follows the learner's own worst week so a line that
  // lives between 80 and 90 is not a flat ruling along the top.
  const lo = Math.max(0, Math.floor((Math.min(...pcts) - 10) / 10) * 10)
  const x = i => (n === 1 ? PAD : PAD + (i / (n - 1)) * (W - 2 * PAD))
  const y = p => H - FOOT - PAD - ((p - lo) / (100 - lo)) * (H - FOOT - 2 * PAD)
  const pt = i => `${x(i).toFixed(1)},${y(shown[i].pct).toFixed(1)}`

  // Consecutive ridden weeks join solid; a stretch of empty weeks
  // between two ridden ones is one dashed bridge.
  const ridden = shown.map((w, i) => (w.pct === null ? null : i)).filter(i => i !== null)
  const segments = []
  for (let k = 1; k < ridden.length; k++) {
    const a = ridden[k - 1], b = ridden[k]
    segments.push({ from: a, to: b, bridge: b - a > 1 })
  }

  const sel = selected ?? currentIndex
  const selShown = sel - firstIndex
  const nowShown = currentIndex - firstIndex

  function pick(clientX) {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || !ridden.length) return
    const px = ((clientX - box.left) / box.width) * W
    let best = ridden[0]
    for (const i of ridden) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    onSelect?.(best + firstIndex)
  }

  function onKey(e) {
    const at = ridden.indexOf(selShown)
    if (e.key === 'ArrowLeft' && at > 0) { e.preventDefault(); onSelect?.(ridden[at - 1] + firstIndex) }
    if (e.key === 'ArrowRight' && at < ridden.length - 1) { e.preventDefault(); onSelect?.(ridden[at + 1] + firstIndex) }
  }

  return (
    <div className="rep-line">
      <svg
        ref={svgRef}
        className="rep-line__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="slider"
        tabIndex={0}
        aria-label={t.reportRetention}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={weeks[sel].pct ?? undefined}
        aria-valuetext={t.reportWeekOf(weeks[sel].start, weeks[sel].reviews)}
        onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); pick(e.clientX) }}
        onPointerMove={e => { if (e.buttons) pick(e.clientX) }}
        onKeyDown={onKey}
      >
        {n === 1 && <line className="rep-line__ahead" x1={x(0)} y1={y(shown[0].pct)} x2={W - PAD} y2={y(shown[0].pct)} />}
        {segments.map(s => (
          <polyline
            key={s.from}
            className={s.bridge ? 'rep-line__bridge' : 'rep-line__path'}
            points={`${pt(s.from)} ${pt(s.to)}`}
          />
        ))}
        {ridden.map(i => (
          <circle
            key={i}
            className={i === nowShown ? 'rep-line__now' : 'rep-line__stop'}
            cx={x(i).toFixed(1)}
            cy={y(shown[i].pct).toFixed(1)}
            r={i === nowShown ? 4 : 2.5}
          />
        ))}
        {shown[selShown]?.pct !== null && selShown >= 0 && (
          <circle className="rep-line__sel" cx={x(selShown).toFixed(1)} cy={y(shown[selShown].pct).toFixed(1)} r={RING} />
        )}
      </svg>
      <div className="rep-axis" aria-hidden="true">
        <span>{n === 1 ? t.reportThisWeek : t.reportWeeksAgo(n - 1)}</span>
        {n > 1 && <span>{t.reportThisWeek}</span>}
      </div>
    </div>
  )
}
