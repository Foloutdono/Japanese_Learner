import { useEffect, useMemo, useRef } from 'react'
import { handOver } from '../station/print/liftPrint'
import { rng } from './kit'

// ── 終着 — what crosses the print on a milestone day (plan 247) ───────
// Drawn on Today's print in its units (components/station/print/
// usePrint.js: --tpr-u pixels to the unit, the print's corner at
// --tpr-x/--tpr-y), each in a box that clips to the print's room, so
// nothing crosses the desk's rail. Their loops (a wing beat, a bird's
// bob, a lantern's drift and flicker) are handed to the Web Animations
// API once they run (DESIGN.md, Motion: many loops on one screen).

// The loops of `ref`'s box, handed over while it is mounted.
function useLoops(ref, on = true) {
  useEffect(() => {
    if (!on) return undefined
    const made = handOver(ref.current, { loops: true, keep: true })
    return () => made.forEach(a => a.cancel())
  }, [ref, on])
}

// ── 鶴 — a crane a day crosses the print (B2·b) ──────────────────────
// The streak counted in the sky: one 丹頂 a day of it in a V, the leader
// first, from the print's right edge to past its left, low enough to
// pass in front of the sun. A bird is a box of two drawings, wings up
// and wings down, shown by turns; the flock is one box that travels.
// The desk's sky is three times the phone's: its birds are a quarter
// larger (the dial's own ratio) and cross it in 4 s (2.8 on a phone).
const WING_UP = 'M27 14 C29 7 33 2.5 40 .5 L44.5 2.5 C40 6.5 37 10 35.5 14 Z'
const WING_DN = 'M27 16.5 C29 23 33 27.5 40 29.5 L44.5 27.5 C40 23.5 37 20 35.5 16.5 Z'
const EDGE_UP = 'M40 .5 L44.5 2.5 C40 6.5 37 10 35.5 14'
const EDGE_DN = 'M40 29.5 L44.5 27.5 C40 23.5 37 20 35.5 16.5'

function Crane({ up }) {
  return (
    <svg className={up ? 'tdy-crane__up' : 'tdy-crane__dn'} viewBox="0 0 60 30" aria-hidden="true" focusable="false">
      <path className="tdy-crane__plume" d={up ? WING_UP : WING_DN} />
      <path className="tdy-crane__edge" d={up ? EDGE_UP : EDGE_DN} />
      <ellipse className="tdy-crane__plume" cx="32" cy="15.5" rx="9.5" ry="3.6" />
      <path className="tdy-crane__tail" d="M39 14.5 L44.5 13.6 L43.2 16.8 Z" />
      <path className="tdy-crane__neck" d="M24 14.6 C18 13.6 13 13.4 8.5 13.6" />
      <circle className="tdy-crane__plume" cx="7" cy="13.6" r="2.3" />
      <circle className="tdy-crane__crown" cx="7.3" cy="12.4" r="1.1" />
      <path className="tdy-crane__beak" d="M5 14 L1 14.6" />
      <path className="tdy-crane__legs" d="M41 16.4 L57 17.6 M41 17.2 L56 19" />
    </svg>
  )
}

export function Cranes({ streak, frame, desk = false, label }) {
  const ref = useRef(null)
  useLoops(ref)
  const k = frame.disc / 80
  const birds = useMemo(() => Array.from({ length: Math.max(1, streak) }, (_, i) => {
    const step = Math.ceil(i / 2)
    const side = i % 2 ? -1 : 1
    return { x: step * 26 * k, y: i === 0 ? 0 : side * step * 13 * k, beat: -((i * 137) % 520) }
  }), [streak, k])
  const span = (Math.ceil((birds.length - 1) / 2) * 26 + 44) * k
  return (
    <div className="tdy-sky" aria-hidden="true">
      <div
        ref={ref}
        className={desk ? 'tdy-cranes tdy-cranes--desk' : 'tdy-cranes'}
        style={{ '--at-x': frame.w + 30 * k, '--at-y': frame.cy + 24 * k, '--k': k, '--cross': frame.w + 60 * k + span }}
      >
        {birds.map((b, i) => (
          <span key={i} className="tdy-crane" style={{ '--bx': b.x, '--by': b.y, '--beat': `${b.beat}ms` }}>
            <Crane up />
            <Crane />
          </span>
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

// ── 灯籠流し — a lantern a day on the lake (B3·b) ─────────────────────
// Set on the lake from the near shore on the left, one a day of the
// month (at 100 days a hundred smaller ones; at a year a river of them,
// 365 on the desk's lake and 160 on a phone's), each lit from inside
// with its light on the water. They drift for the rest of the night:
// in six companies, each drifting and flickering as one, so the lake's
// loops are twelve however many float on it.
const COMPANIES = 6
const PHONE_MOST = 160

/** The lanterns' sizes, in a phone's units: far to near. */
function sizes(days) {
  if (days >= 365) return [2, 4]
  if (days >= 100) return [3, 6]
  return [5, 9]
}

export function Lanterns({ days, frame, desk = false, play = true, label }) {
  const ref = useRef(null)
  const k = frame.disc / 80
  const n = Math.min(days, desk ? 365 : PHONE_MOST)
  const lanterns = useMemo(() => {
    const random = rng(days * 7 + (desk ? 1 : 0))
    const [s0, s1] = sizes(days)
    // Clear of the desk's pine on the left of its print; a phone's lake
    // runs edge to edge.
    const x0 = desk ? 224 : 10
    const x1 = frame.w - 10
    const top = frame.horizon + 8 * k
    const deep = 42 * k
    return Array.from({ length: n }, () => {
      const depth = random()
      return { x: x0 + random() * (x1 - x0), y: top + depth * deep, s: (s0 + depth * (s1 - s0)) * k }
    }).sort((a, b) => a.x - b.x)
  }, [days, desk, frame, k, n])
  const companies = useMemo(() => Array.from({ length: COMPANIES }, (_, c) => lanterns
    .map((l, i) => ({ ...l, i }))
    .filter(l => l.i % COMPANIES === c)), [lanterns])
  useLoops(ref, play)
  const step = 1800 / n
  return (
    <div className="tdy-sky" role="img" aria-label={label}>
      <div ref={ref} className="tdy-lake">
        {companies.map((list, c) => (
          <div key={c} className="tdy-lake__company" style={{ '--drift': `${7 + c}s`, '--flicker': `${-c * 380}ms` }}>
            {list.map(l => (
              <i
                key={l.i}
                className="tdy-lantern"
                style={{ '--at-x': l.x, '--at-y': l.y, '--s': l.s, '--d': `${Math.round(l.i * step)}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 夜 — night falls on the print (B3·b) ─────────────────────────────
// A veil of the night's own sky over the print, opaque at the turn, the
// print turned to night under it, then gone: the month's ceremony is a
// night's whatever the hour.
export function NightVeil({ sky }) {
  return <div className="tdy-veil" style={{ '--veil': sky }} aria-hidden="true" />
}
