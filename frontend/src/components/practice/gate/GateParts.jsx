import { useId, useLayoutEffect, useRef, useState } from 'react'
import { FOLD_MS, FOLDED, RAISE_MS, RAISED, folding, pose, rising } from './pantograph'

// ── The painted gate's drawn parts (plan 223) ─────────────────────────
// What PracticeGate draws over the owner's painting, where the painting
// has it, because it moves or says something: the door's two leaves,
// the pantograph's arms and head, the spark at the wire, the light the
// open door spills on the platform, the station clock and the rivets of
// the roll signs' housing. Every number is the scene's (390 × 724 units,
// one CSS px each inside the zoomed scene) and was measured on the
// painting on the canvas "Practice gate — five wheels", board 4.
// Drawn in SVG because they are pictures: their geometry is the
// drawing's, not the interface's spacing.

/** The door's two leaves, lit at the hour (`leaf`, gate.json's inks).
    They part when `open`; the stripe across them takes the line's
    pigment as the car's does (the colour blend in index.css). */
export function Leaves({ open, leaf }) {
  return (
    <div className={`pgate-door${open ? ' pgate-door--open' : ''}`} aria-hidden="true">
      <Leaf side="l" leaf={leaf} />
      <Leaf side="r" leaf={leaf} />
    </div>
  )
}

const LEAF_W = 40.64
const LEAF_H = 182.5
const EDGE = 2.2

function Leaf({ side, leaf }) {
  const id = useId()
  const l = side === 'l'
  // The right leaf is the left one mirrored, its window and fittings a
  // unit further from the meeting edge.
  const dx = l ? 0 : 1
  const face = l ? leaf.faceA : [...leaf.faceA].reverse()
  const faceAt = l ? [0, 0.38, 0.72, 1] : [0, 0.28, 0.62, 1]
  const inner = l ? [0, LEAF_W - EDGE] : [EDGE, LEAF_W]
  const bandH = l ? 18 : 16.8
  const band = [0, 0.6 / bandH, 1.4 / bandH, 0.5, 1 - 1.4 / bandH, 1 - 0.6 / bandH, 1]
  return (
    <span className={`pgate-leaf pgate-leaf--${side}`}>
      <svg viewBox={`0 0 ${LEAF_W} ${LEAF_H}`} width={LEAF_W} height={LEAF_H}>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
            {face.map((c, i) => <stop key={i} offset={faceAt[i]} stopColor={c} />)}
          </linearGradient>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            {leaf.glass.map((c, i) => <stop key={i} offset={[0, 0.16, 0.38, 1][i]} stopColor={c} />)}
          </linearGradient>
          <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1={-0.11 + dx} y1="17.01" x2={39.71 + dx} y2="85.99">
            <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.52" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="0.64" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}b`} gradientUnits="userSpaceOnUse" x1="0" y1="109.3" x2="0" y2={109.3 + bandH}>
            {leaf.band.map((c, i) => <stop key={i} offset={band[i]} stopColor={c} />)}
          </linearGradient>
          <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.22" />
            <stop offset="0.04" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={LEAF_W} height={LEAF_H} fill={`url(#${id}f)`} />
        <rect x={inner[0]} width={inner[1] - inner[0]} height={LEAF_H} fill={`url(#${id}t)`} />
        <rect x={l ? LEAF_W - EDGE : 0} width={EDGE} height={LEAF_H} fill={leaf.edge[0]} />
        <rect x={8.9 + dx} y="10.7" width="21.8" height="81.6" rx="2.8" fill={`url(#${id}g)`} stroke={leaf.glassEdge[0]} strokeWidth="1.4" />
        <rect x={9.6 + dx} y="11.4" width="20.4" height="80.2" rx="2.5" fill={`url(#${id}s)`} />
        <rect x={19.3 + dx} y="12" width="1" height="4" fill={leaf.brass[0]} />
        <circle cx={19.8 + dx} cy="18.8" r="2.7" fill="none" stroke={leaf.brass[1]} strokeWidth="1" />
        <rect x={inner[0]} y="160" width={inner[1] - inner[0]} height="1" fill="#000" fillOpacity="0.14" />
        <rect x={inner[0]} y="109.3" width={inner[1] - inner[0]} height={bandH} fill={`url(#${id}b)`} />
        <rect className="pgate-leaf__band" x={inner[0]} y="109.3" width={inner[1] - inner[0]} height={bandH} />
      </svg>
    </span>
  )
}

/** The light the open door spills on the platform, warmer as the day goes. */
export function Spill() {
  const id = useId()
  return (
    <svg className="pgate-spill" viewBox="0 0 160 110" width="160" height="110" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd696" stopOpacity="0.72" />
          <stop offset="0.42" stopColor="#ffcf8c" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffc884" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}f`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
      </defs>
      <polygon points="40,4 120,4 152,102 6,102" fill={`url(#${id}g)`} filter={`url(#${id}f)`} />
    </svg>
  )
}

/** 菱 — the pantograph: five parts, each turning about its own joint
    (pantograph.js solves the pose from the head's height). `state` is
    where it is: 'down' folded on the roof, 'raised' on the wire, or on
    its way, 'raising' or 'lowering', when each frame is posed until it
    arrives. The bracket, the strut's foot and the hinge stay on the base. */
export function Pantograph({ state, bob }) {
  const id = useId()
  const lower = useRef(null)
  const upper = useRef(null)
  const knee = useRef(null)
  const head = useRef(null)
  const strut = useRef(null)
  useLayoutEffect(() => {
    const parts = { lower: lower.current, upper: upper.current, knee: knee.current, head: head.current, strut: strut.current }
    const put = top => {
      const p = pose(top)
      for (const [key, el] of Object.entries(parts)) if (el) el.style.transform = p[key]
    }
    if (state !== 'raising' && state !== 'lowering') {
      put(state === 'raised' ? RAISED : FOLDED)
      return undefined
    }
    const [curve, ms] = state === 'raising' ? [rising, RAISE_MS] : [folding, FOLD_MS]
    const start = performance.now()
    let frame = 0
    const step = at => {
      const k = Math.min(1, (at - start) / ms)
      put(curve(k))
      if (k < 1) frame = requestAnimationFrame(step)
    }
    put(curve(0))
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [state])
  return (
    <svg className="pgate-panto" viewBox="0 0 390 724" width="390" height="724" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#76808b" />
          <stop offset="0.14" stopColor="#5f6974" />
          <stop offset="0.3" stopColor="#3c424d" />
          <stop offset="0.55" stopColor="#30343c" />
          <stop offset="0.78" stopColor="#24262b" />
          <stop offset="1" stopColor="#18191d" />
        </linearGradient>
        <linearGradient id={`${id}col`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#848d97" />
          <stop offset="0.16" stopColor="#68717b" />
          <stop offset="0.4" stopColor="#424852" />
          <stop offset="0.75" stopColor="#2a2c31" />
          <stop offset="1" stopColor="#1b1c20" />
        </linearGradient>
        <linearGradient id={`${id}str`} x1="0" y1="-1.2" x2="0" y2="1.2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0d1214" />
          <stop offset="0.5" stopColor="#23292b" />
          <stop offset="1" stopColor="#3a4245" />
        </linearGradient>
      </defs>
      <g className={`pgate-panto__bob${bob ? ' pgate-panto__bob--on' : ''}`}>
        <g ref={strut}>
          <rect x="-0.6" y="-1.05" width="18.61" height="2.1" fill={`url(#${id}str)`} />
        </g>
        <circle cx="128.74" cy="310.88" r="1.25" fill="#2a2f31" stroke="#0e1213" strokeWidth="0.4" />
        <g ref={lower}>
          <line x1="0" y1="0" x2="85.13" y2="0" stroke="#303135" strokeWidth="5.8" strokeLinecap="round" />
          <line x1="1.5" y1="-2.55" x2="83.63" y2="-2.55" stroke="#0b1216" strokeWidth="0.75" strokeLinecap="round" />
          <line x1="2" y1="-1.7" x2="82.13" y2="-1.7" stroke="#24272b" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <line x1="3" y1="1.95" x2="78.13" y2="1.95" stroke="#bdb8bc" strokeWidth="0.6" strokeLinecap="round" />
          <line x1="2" y1="2.6" x2="82.63" y2="2.6" stroke="#17161b" strokeWidth="0.65" strokeLinecap="round" />
          <rect x="75.63" y="-2.5" width="5.4" height="5" rx="0.8" fill="#323439" stroke="#141519" strokeWidth="0.35" />
        </g>
        <path d="M 130.66 311.63 L 133.66 309.08 L 139.66 309.08 L 141.46 311.63 Z" fill="#2b2c31" stroke="#121317" strokeWidth="0.4" strokeLinejoin="round" />
        <circle cx="137.06" cy="310.58" r="1.25" fill="#5a5c61" stroke="#141519" strokeWidth="0.4" />
        <g ref={upper}>
          <line x1="0" y1="0" x2="62.31" y2="0" stroke="#2b2e34" strokeWidth="3.75" strokeLinecap="round" />
          <line x1="2" y1="-1.25" x2="60.31" y2="-1.25" stroke="#46525e" strokeWidth="0.85" strokeLinecap="round" />
          <line x1="2" y1="1.45" x2="61.31" y2="1.45" stroke="#060e15" strokeWidth="0.8" strokeLinecap="round" />
        </g>
        <g ref={knee}>
          <circle cx="0" cy="0" r="3.8" fill="#2b2f35" stroke="#0c141b" strokeWidth="0.5" />
          <path d="M -2.9 -1.2 A 3.1 3.1 0 0 1 1.4 -2.75" fill="none" stroke="#48535d" strokeWidth="0.6" strokeLinecap="round" />
          <circle cx="0" cy="0" r="1.15" fill="#272b31" stroke="#40474e" strokeWidth="0.4" />
        </g>
        <g ref={head}>
          <rect x="112.11" y="198.66" width="5.8" height="2.3" rx="0.7" fill="#212327" />
          <path d="M 86.20 197.10 Q 81.40 197.30 80.20 199.60 L 77.00 204.00 Q 76.30 204.90 76.40 205.40" fill="none" stroke="#24262b" strokeWidth="2.55" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 145.66 197.10 Q 150.46 197.30 151.66 199.60 L 154.86 204.00 Q 155.56 204.90 155.46 205.40" fill="none" stroke="#24262b" strokeWidth="2.55" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 85.60 196.50 Q 81.00 196.70 79.70 199.10 L 76.70 203.30" fill="none" stroke="#56606b" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 146.26 196.50 Q 150.86 196.70 152.16 199.10 L 155.16 203.30" fill="none" stroke="#56606b" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="85.39" y="194.50" width="61.07" height="5.15" rx="1.1" fill={`url(#${id}bar)`} />
          <rect x="85.19" y="194.35" width="4.90" height="5.45" rx="1" fill={`url(#${id}col)`} />
          <rect x="141.77" y="194.35" width="4.90" height="5.45" rx="1" fill={`url(#${id}col)`} />
          <line x1="90.09" y1="194.70" x2="90.09" y2="199.45" stroke="#121317" strokeWidth="0.45" />
          <line x1="141.77" y1="194.70" x2="141.77" y2="199.45" stroke="#121317" strokeWidth="0.45" />
          <line x1="86.59" y1="194.90" x2="145.27" y2="194.90" stroke="#97a1ab" strokeWidth="0.5" strokeLinecap="round" opacity="0.75" />
          <line x1="90.89" y1="198.51" x2="140.97" y2="198.51" stroke="#0f1013" strokeWidth="0.45" opacity="0.8" />
        </g>
      </g>
    </svg>
  )
}

/** A spark where the head meets the wire: a blue-white flash and its
    streaks. Keyed by PracticeGate, so each one is drawn afresh. */
export function Spark({ x }) {
  return (
    <span className="pgate-spark" style={{ left: x }} aria-hidden="true">
      <i className="pgate-spark__glow" />
      <svg className="pgate-spark__streak" viewBox="-12 -12 24 24" width="24" height="24">
        <g stroke="#eef6ff" strokeWidth="0.6" strokeLinecap="round">
          <line x1="-2" y1="-0.8" x2="-8.5" y2="-3.6" />
          <line x1="-1.2" y1="-1.8" x2="-4.2" y2="-7.6" />
          <line x1="1.4" y1="-1.7" x2="4.8" y2="-7" />
          <line x1="2.1" y1="-0.6" x2="9" y2="-2.6" />
          <line x1="1.6" y1="1.2" x2="6.4" y2="5" />
          <line x1="-1.7" y1="1.3" x2="-6.6" y2="4.6" />
        </g>
      </svg>
    </span>
  )
}

/** The four rivets at a housing's corners, `w` × `h` units. */
export function Rivets({ w, h }) {
  const id = useId()
  const at = [[4.4, 4.4], [w - 4.4, 4.4], [4.4, h - 4.4], [w - 4.4, h - 4.4]]
  return (
    <svg className="pgate-sign__rivets" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}r`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#4b4d52" />
          <stop offset="1" stopColor="#1d1e22" />
        </radialGradient>
      </defs>
      {at.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" fill={`url(#${id}r)`} stroke="#3b3d42" strokeWidth="0.35" />)}
    </svg>
  )
}

// The clock's minute marks and its numerals, on a 44.96 face.
const C = 22.48
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i * 6 * Math.PI) / 180
  const hour = i % 5 === 0
  const [r0, r1] = hour ? [17.9, 19.5] : [18.7, 19.5]
  const p = r => [C + r * Math.sin(a), C - r * Math.cos(a)].map(n => +n.toFixed(2))
  return { from: p(r0), to: p(r1), w: hour ? 0.9 : 0.45 }
})
const NUMERALS = Array.from({ length: 12 }, (_, i) => {
  const a = ((i + 1) * 30 * Math.PI) / 180
  return { n: i + 1, x: +(C + 14.3 * Math.sin(a)).toFixed(2), y: +(C - 14.3 * Math.cos(a)).toFixed(2) }
})

/** 時計 — the station clock under the canopy, keeping the time: its
    hands turn from where `now` puts them, the second hand stepping.
    The bezel and the dial are the button's (index.css); this is what
    is printed and turns on them. */
export function ClockFace() {
  // Read once: each hand's turn runs on from here (its negative delay).
  const [now] = useState(() => new Date())
  const s = now.getSeconds() + now.getMilliseconds() / 1000
  const m = now.getMinutes() * 60 + s
  const h = (now.getHours() % 12) * 3600 + m
  return (
    <svg className="pgate-clock__face" viewBox="0 0 44.96 44.96" width="44.96" height="44.96" aria-hidden="true">
      <g stroke="#2a2a2c" strokeLinecap="round">
        {TICKS.map((tk, i) => <line key={i} x1={tk.from[0]} y1={tk.from[1]} x2={tk.to[0]} y2={tk.to[1]} strokeWidth={tk.w} />)}
      </g>
      <g className="pgate-clock__numerals" fontSize="4.9" fontWeight="600" fill="#1c1c1e" textAnchor="middle" dominantBaseline="central">
        {NUMERALS.map(({ n, x, y }) => <text key={n} x={x} y={y}>{n}</text>)}
      </g>
      <rect className="pgate-clock__hand pgate-clock__hand--h" x="21.48" y="12.98" width="2" height="9.5" rx="1" style={{ animationDelay: `-${h.toFixed(1)}s` }} />
      <rect className="pgate-clock__hand pgate-clock__hand--m" x="21.83" y="8.48" width="1.3" height="14" rx="0.65" style={{ animationDelay: `-${m.toFixed(1)}s` }} />
      <rect className="pgate-clock__hand pgate-clock__hand--s" x="22.13" y="6.48" width="0.7" height="19" style={{ animationDelay: `-${Math.floor(s)}s` }} />
      <circle cx={C} cy={C} r="1.5" fill="#141416" />
    </svg>
  )
}
