import { useEffect, useMemo, useRef, useState } from 'react'
import { sampleStroke } from '../../domain/strokePath'
import { beginTrace, followTrace, runLengths, traceDone, traceMiss, traceProgress } from '../../domain/trace'
import { useMediaQuery } from '../../hooks/useMediaQuery'

// ── 初見 — the trace board (plans 216, 263) ────────────────────────
// The glyph tour's writing stop: the glyph's strokes as KanjiVG draws
// them, each to be traced in its turn from its start (a full dot, its
// number in it) to its end (a ring). The board is the writing board's
// slab (the sumi square with the practice sheet's 田, DrawingCanvas)
// and the ink is its brush: the strokes traced stand in the brush's
// ink, the ones ahead faint under it.
//
// The stroke asked is a hollow (plan 263, the owner's pick A1 + A2 of
// the canvas "Glyph tour — guided trace options"): its outline in the
// line's pigment, drawn in from its start so its way is seen before it
// is traced, and three chevrons inside it walking that way while the
// hand waits. The hand fills it: the ink is the stroke's own, carried
// along it as far as the finger has come (domain/trace.js), so what
// stands on the board is the stroke, never the finger's wobble. Lifted
// before the ring, the ink drains back and the board says what to fix.
//
// Controlled: the tour holds which stroke is asked (`at`), the strokes
// the board drew for the learner (`given`, after three misses on one)
// and where « Montre-moi » took over (`shownFrom`, every stroke from it
// drawn in turn). The board says how a trace went (`onVerdict`: 'ok',
// 'start', 'end' or 'path') and nothing else.
//
// What moves with the finger is painted on its element, not rendered:
// the ink, the ring reached and the chevrons ahead of the ink.
const BOX = 109
const VIEW = `0 0 ${BOX} ${BOX}`
// The chevrons, in KanjiVG units: their size, the gap between two, how
// far ahead of the ink the first stands, and how many walk at once.
const CHEVRON = { size: 2.6, gap: 10, lead: 6, count: 3 }
// The hollow's drawing in (as .gt-hollow's animation), then a chevron's
// walk of one gap.
const INTRO_MS = 520
const WALK_MS = 1000
// The share of the stroke at which the ring is seen reached.
const REACHED = 0.9

function strokeClass(i, { at, given, shownFrom }) {
  if (shownFrom != null && i >= shownFrom) return 'shown'
  if (given.includes(i)) return 'given'
  if (i < at) return 'done'
  if (i === at) return 'here'
  return 'ahead'
}

// The point at a length along the guide, and the way it heads there.
function along(guide, lengths, l) {
  let i = 1
  while (i < lengths.length - 1 && lengths[i] < l) i++
  const a = guide[i - 1]
  const b = guide[i] ?? a
  const t = Math.max(0, Math.min(1, (l - lengths[i - 1]) / ((lengths[i] - lengths[i - 1]) || 1)))
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }
}

function chevron({ x, y, ang }, size) {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const bx = x - c * size * 0.5
  const by = y - s * size * 0.5
  const f = n => n.toFixed(2)
  return `M${f(bx - s * size * 0.7)},${f(by + c * size * 0.7)}L${f(x + c * size * 0.5)},${f(y + s * size * 0.5)}L${f(bx + s * size * 0.7)},${f(by - c * size * 0.7)}`
}

export function TraceBoard({ strokes, at, given = [], shownFrom = null, label, onVerdict }) {
  const live = at < strokes.length && shownFrom == null
  const guide = useMemo(() => (live ? sampleStroke(strokes[at]) : []), [strokes, at, live])
  const lengths = useMemo(() => runLengths(guide), [guide])
  const still = useMediaQuery('(prefers-reduced-motion: reduce)')
  const inkRef = useRef(null)
  const endRef = useRef(null)
  const chevrons = useRef([])
  // The hand on the board (domain/trace's run), the finger's own line
  // (kept to show a miss) and the share of the stroke the ink has reached.
  const run = useRef(null)
  const line = useRef(null)
  const share = useRef(0)
  const [missed, setMissed] = useState(null)
  // The stroke whose dot is called, after one begun away from it.
  const [called, setCalled] = useState(-1)

  function paint(to, drain = false) {
    share.current = to
    const ink = inkRef.current
    if (ink) {
      ink.classList.toggle('gt-ink--drain', drain)
      ink.style.strokeDasharray = `${to} 2`
      ink.style.opacity = to > 0 ? '1' : '0'
    }
    endRef.current?.classList.toggle('gt-end--reached', to >= REACHED)
  }

  // A new stroke starts clean.
  useEffect(() => {
    run.current = null
    line.current = null
    share.current = 0
  }, [at, live])

  // The chevrons stand ahead of the ink, once the hollow is drawn in,
  // and walk its way while the hand waits (in place, if motion is off).
  useEffect(() => {
    if (!live || guide.length < 2) return undefined
    const total = lengths[lengths.length - 1]
    const start = performance.now()
    let frame = 0
    const tick = now => {
      const shown = still || now - start >= INTRO_MS
      const idle = !run.current && share.current === 0
      const walk = shown && idle && !still ? ((now - start - INTRO_MS) % WALK_MS) / WALK_MS : 0
      const rise = idle && !still ? Math.min(1, walk * 4) : 1
      const first = share.current * total + CHEVRON.lead + walk * CHEVRON.gap
      chevrons.current.forEach((el, k) => {
        if (!el) return
        const l = first + k * CHEVRON.gap
        const on = shown && l <= total - CHEVRON.lead
        el.setAttribute('d', on ? chevron(along(guide, lengths, l), CHEVRON.size) : '')
        el.style.opacity = on ? String((1 - (k + walk) / CHEVRON.count) * (k === 0 ? rise : 1)) : '0'
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [live, guide, lengths, still])

  function unitsOf(e) {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * BOX, ((e.clientY - r.top) / r.height) * BOX]
  }

  function release(e) {
    const el = e.currentTarget
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
  }

  function miss(verdict) {
    const drawn = line.current
    run.current = null
    line.current = null
    paint(0, true)
    // A missed line stays a moment in the miss's ink, then goes.
    if (drawn?.length > 1) setMissed(m => ({ n: (m?.n ?? 0) + 1, points: drawn }))
    setCalled(verdict === 'start' ? at : -1)
    onVerdict?.(verdict)
  }

  function down(e) {
    if (!live || (e.button != null && e.button !== 0)) return
    // Held while the finger drifts off the board. A pointer the browser
    // no longer knows (a synthetic one) cannot be captured, and the line
    // is followed as well without it.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* not a live pointer */ }
    const p = unitsOf(e)
    line.current = [p]
    // Begun away from the dot, the line is still kept, to be shown.
    run.current = beginTrace(guide, p)
    if (run.current) paint(0)
  }

  function move(e) {
    if (!line.current) return
    const p = unitsOf(e)
    line.current.push(p)
    if (!run.current) return
    run.current = followTrace(run.current, guide, p)
    if (traceDone(run.current, guide)) {
      // The ring reached: the stroke is whole, whatever the hand does next.
      run.current = null
      line.current = null
      paint(1)
      onVerdict?.('ok')
      return
    }
    paint(traceProgress(run.current, guide))
  }

  function up(e) {
    release(e)
    if (!line.current) return
    miss(run.current ? traceMiss(run.current) : 'start')
  }

  function cancel(e) {
    release(e)
    run.current = null
    line.current = null
    paint(0, true)
  }

  const state = { at, given, shownFrom }
  const classes = strokes.map((_, i) => strokeClass(i, state))
  const stroke = i => (
    <path
      key={i}
      d={strokes[i]}
      pathLength={1}
      className={`gt-stroke gt-stroke--${classes[i]}`}
      style={classes[i] === 'shown' ? { '--i': i - shownFrom } : undefined}
      data-state={classes[i]}
    />
  )
  const start = guide[0]
  const end = guide[guide.length - 1]
  return (
    <div className="gt-board" role="img" aria-label={label} data-stroke={live ? at + 1 : undefined}>
      <div className="canvas-grid" aria-hidden="true" />
      <svg className="gt-glyph" viewBox={VIEW} aria-hidden="true">
        {strokes.map((_, i) => (classes[i] === 'ahead' ? stroke(i) : null))}
        {/* The stroke asked: its hollow, drawn in along its way. Keyed by
            the stroke, so each new one draws itself in, its ink empty. */}
        {live && (
          <g key={`hollow:${at}`} className="gt-hollow">
            <path className="gt-hollow__edge" d={strokes[at]} pathLength={1} />
            <path className="gt-hollow__in" d={strokes[at]} pathLength={1} />
          </g>
        )}
        {strokes.map((_, i) => (classes[i] === 'done' || classes[i] === 'given' || classes[i] === 'shown' ? stroke(i) : null))}
        {live && Array.from({ length: CHEVRON.count }, (_, k) => (
          <path key={k} className="gt-chevron" ref={el => { chevrons.current[k] = el }} d="" />
        ))}
        {live && (
          <path
            key={`ink:${at}`}
            ref={inkRef}
            className="gt-ink"
            d={strokes[at]}
            pathLength={1}
            style={{ strokeDasharray: '0 2', opacity: 0 }}
          />
        )}
        {live && end && <circle key={`end:${at}`} ref={endRef} className="gt-end" cx={end[0]} cy={end[1]} r="5.2" />}
        {live && start && (
          <g className={`gt-start${called === at ? ' gt-start--call' : ''}`}>
            <circle cx={start[0]} cy={start[1]} r="5" />
            {/* Sized in the board's own units, as the strokes are: the
                number is drawn on the glyph, not set in the type scale. */}
            <text className="gt-start__n" x={start[0]} y={start[1]} fontSize="6" textAnchor="middle" dominantBaseline="central">
              {at + 1}
            </text>
          </g>
        )}
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
        onPointerCancel={cancel}
      />
    </div>
  )
}
