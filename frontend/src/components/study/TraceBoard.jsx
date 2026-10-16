import { useMemo, useRef, useState } from 'react'
import { sampleStroke } from '../../domain/strokePath'
import { traceVerdict } from '../../domain/trace'

// ── 初見 — the trace board (plan 216) ──────────────────────────────
// The glyph tour's writing stop: the glyph's strokes as KanjiVG draws
// them, each to be traced in its turn from its start (a full dot) to its
// end (a ring). The board is the writing board's slab (the sumi square
// with the practice sheet's 田, DrawingCanvas) and the ink is its brush:
// the strokes traced stand in the brush's ink, the ones ahead faint
// under it, the one asked in the line's pigment, drawn in once so its
// way is seen before it is traced.
//
// Controlled: the tour holds which stroke is asked (`at`), the strokes
// the board drew for the learner (`given`, after three misses on one)
// and where « Montre-moi » took over (`shownFrom`, every stroke from it
// drawn in turn). The board says how a trace went (`onVerdict`: 'ok',
// 'start', 'end' or 'path', domain/trace.js) and nothing else.
//
// Three drawings over the slab, so what moves is an <svg> of its own
// (DESIGN.md, Motion): the strokes, a missed line fading out, and the
// pen, which takes the pointer. A line is judged in KanjiVG's units,
// whatever the board's size on the screen.
const BOX = 109
const VIEW = `0 0 ${BOX} ${BOX}`
// The pen keeps a point every so often: a line, not every pixel moved.
const STEP = 0.8

function strokeClass(i, { at, given, shownFrom }) {
  if (shownFrom != null && i >= shownFrom) return 'shown'
  if (given.includes(i)) return 'given'
  if (i < at) return 'done'
  if (i === at) return 'here'
  return 'ahead'
}

export function TraceBoard({ strokes, at, given = [], shownFrom = null, tries = 0, label, onVerdict }) {
  const live = at < strokes.length && shownFrom == null
  const guide = useMemo(() => (live ? sampleStroke(strokes[at]) : []), [strokes, at, live])
  const penRef = useRef(null)
  const line = useRef(null)
  const [missed, setMissed] = useState(null)

  function unitsOf(e) {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * BOX, ((e.clientY - r.top) / r.height) * BOX]
  }

  function paint(points) {
    penRef.current?.setAttribute('points', points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '))
  }

  function down(e) {
    if (!live || (e.button != null && e.button !== 0)) return
    // Held while the finger drifts off the board. A pointer the browser
    // no longer knows (a synthetic one) cannot be captured, and the line
    // is drawn as well without it.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* not a live pointer */ }
    line.current = [unitsOf(e)]
    paint(line.current)
  }

  function move(e) {
    const points = line.current
    if (!points) return
    const p = unitsOf(e)
    const last = points[points.length - 1]
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < STEP) return
    points.push(p)
    paint(points)
  }

  function release(e) {
    const el = e.currentTarget
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    const drawn = line.current
    line.current = null
    paint([])
    return drawn
  }

  function up(e) {
    const drawn = release(e)
    if (!drawn) return
    const verdict = traceVerdict(drawn, guide)
    // A missed line stays a moment in the miss's ink, then goes.
    if (verdict !== 'ok') setMissed(m => ({ n: (m?.n ?? 0) + 1, points: drawn }))
    onVerdict?.(verdict)
  }

  const state = { at, given, shownFrom }
  const start = guide[0]
  const end = guide[guide.length - 1]
  return (
    <div className="gt-board" role="img" aria-label={label} data-stroke={live ? at + 1 : undefined}>
      <div className="canvas-grid" aria-hidden="true" />
      <svg className="gt-glyph" viewBox={VIEW} aria-hidden="true">
        {strokes.map((d, i) => {
          const cls = strokeClass(i, state)
          return (
            <path
              key={i}
              d={d}
              pathLength={1}
              className={`gt-stroke gt-stroke--${cls}`}
              style={cls === 'shown' ? { '--i': i - shownFrom } : undefined}
              data-state={cls}
            />
          )
        })}
        {/* The stroke asked, drawn in its way; again after each miss. */}
        {live && <path key={`${at}:${tries}`} d={strokes[at]} pathLength={1} className="gt-stroke gt-stroke--now" />}
        {live && end && <circle className="gt-end" cx={end[0]} cy={end[1]} r="4.5" />}
        {live && start && <circle className="gt-start" cx={start[0]} cy={start[1]} r="3.5" />}
      </svg>
      {missed && (
        <svg key={missed.n} className="gt-missed" viewBox={VIEW} aria-hidden="true">
          <polyline points={missed.points.map(p => p.join(',')).join(' ')} />
        </svg>
      )}
      <svg
        className={`gt-pen${live ? '' : ' gt-pen--off'}`}
        viewBox={VIEW}
        aria-hidden="true"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={release}
      >
        <polyline ref={penRef} points="" />
      </svg>
    </div>
  )
}
