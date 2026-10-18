import { useEffect, useRef } from 'react'
import DESK from './desk.json'

// ── 鳥 — the desk's birds, jointed (plan 244c) ───────────────────────
// Today's print's birds (scripts/today-print/birds5.py): cranes (丹頂) at
// dawn and the geese of 落雁 at dusk, as the print flies them; by day the
// station's own bird, swallows (燕), which nest under a platform's
// canopy, each on its own swooping way, a few quick beats then a glide;
// none at night. Each wing is an arm hinged at the shoulder and a
// hand hinged at the wrist: the arm beats (a quicker downstroke, a
// slower recovery), the hand follows a beat late so the tip bends
// against the air, and the body rises a little on each downstroke. Seen
// from the side (the goose, the crane) a beating wing folds through its
// own edge. All fly left to right,
// so the board, over the scene's right, never hides a crossing's start.
//
// Every joint is an HTML box at its hinge, holding its part's drawing
// in an <svg> of its own, and every motion is a Web Animation on a box
// (DESIGN.md, "Motion"): the flock's flight, each bird's place in it
// breathing, its heave, its arms and its hands. The paths are the
// print's, in its units; a bird is scaled where it flies.

const INK = { goose: '#1b2238', gooseFar: '#2c3552', crane: '#f6f3ec', craneFar: '#d9d4ca', craneTip: '#14141c', swallow: '#141a28', swallowFar: '#2a3246', throat: '#9a3b2a' }

// A crossing at each hour: the kind, whether its drawing faces left
// (and is turned to fly right), the row it flies at (the sky's units,
// under the wires, over the land), its birds' places (units from the
// lead), their size, how long the crossing takes (the scene's whole
// width, of which the board hides the right half) and how long the sky
// then stays empty.
const FLIGHTS = {
  dawn: { kind: 'crane', turned: true, y: 150, scale: 0.78, cross: 62000, rest: 12000, beat: 1.8,
    birds: [[0, 0], [-46, 14]] },
  // swallows fly alone: each its own row, its own pace and its own wait
  day: { kind: 'swallow', solo: true, scale: 1.25, beat: 0.13,
    birds: [{ y: 118, cross: 16000, rest: 12000, wait: 2500, dips: 1.6 },
      { y: 176, cross: 19000, rest: 15000, wait: 8500, dips: 1.2 },
      { y: 146, cross: 14500, rest: 19000, wait: 15000, dips: 2.1 }] },
  dusk: { kind: 'goose', y: 176, scale: 1.25, cross: 52000, rest: 14000, beat: 0.9,
    birds: [[0, 0], [-26, -13], [-52, -26], [-26, 13], [-52, 26]] },
}
const FIRST = 4000        // ms before the first crossing
const SWAY = 16           // units the flight rises and falls along its way
const DIP = 26            // units a swallow swoops down and up

// A spread of numbers in [0, 1) drawn from an index (each bird keeps its
// own pace, the same on every visit).
const spread = (i, k) => ((i + 1) * k * 0.6180339887) % 1

function play(el, frames, options) {
  if (!el || typeof el.animate !== 'function') return null
  return el.animate(frames, options)
}

// The motions, as the print's keyframes (birds5.CSS).
const FOLD = (open, shut) => [
  { offset: 0, transform: `scaleY(${open})`, easing: 'cubic-bezier(0.55, 0, 0.7, 0.4)' },
  { offset: 0.42, transform: `scaleY(${shut})`, easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)' },
  { offset: 1, transform: `scaleY(${open})` },
]
const FOLD_GLIDE = (open, shut, half) => [
  { offset: 0, transform: `scaleY(${open})`, easing: 'cubic-bezier(0.55, 0, 0.7, 0.4)' },
  { offset: 0.18, transform: `scaleY(${shut})`, easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)' },
  { offset: 0.4, transform: `scaleY(${open})`, easing: 'cubic-bezier(0.55, 0, 0.7, 0.4)' },
  { offset: 0.58, transform: `scaleY(${shut})`, easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)' },
  { offset: 0.8, transform: `scaleY(${half})` },
  { offset: 1, transform: `scaleY(${open})` },
]
const BEND = [
  { offset: 0, transform: 'rotate(14deg)' }, { offset: 0.42, transform: 'rotate(-22deg)' }, { offset: 1, transform: 'rotate(14deg)' },
]
const BEND_GLIDE = [
  { offset: 0, transform: 'rotate(12deg)' }, { offset: 0.18, transform: 'rotate(-20deg)' }, { offset: 0.4, transform: 'rotate(12deg)' },
  { offset: 0.58, transform: 'rotate(-20deg)' }, { offset: 0.8, transform: 'rotate(4deg)' }, { offset: 1, transform: 'rotate(12deg)' },
]
const HEAVE = [
  { offset: 0, transform: 'translateY(0.5px)' }, { offset: 0.3, transform: 'translateY(-0.7px)' }, { offset: 1, transform: 'translateY(0.5px)' },
]
const HEAVE_GLIDE = [
  { offset: 0, transform: 'translateY(0.6px)' }, { offset: 0.14, transform: 'translateY(-0.9px)' }, { offset: 0.4, transform: 'translateY(0.6px)' },
  { offset: 0.54, transform: 'translateY(-0.9px)' }, { offset: 0.8, transform: 'translateY(0.2px)' }, { offset: 1, transform: 'translateY(0.6px)' },
]
// The swallow: three quick beats, then a glide on wings held half up.
const BEATS = [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.5, 0.75, 1]
const SW_ARM = k => BEATS.map((offset, i) => (
  { offset, transform: `scaleY(${k * [1, -0.86, 1, -0.86, 1, -0.86, 0.5, 0.42, 0.5][i]})`, easing: 'ease-in-out' }))
const SW_HAND = BEATS.map((offset, i) => ({ offset, transform: `rotate(${[14, -22, 14, -22, 14, -22, 4, 8, 4][i]}deg)`, easing: 'ease-in-out' }))

/** A hinge: a box at a joint, turning about it, its part drawn from it. */
function Joint({ at = [0, 0], move, d, fill, stroke, children }) {
  return (
    <span className="pdesk-joint" style={{ left: at[0], top: at[1] }}>
      <span className="pdesk-joint" data-move={move}>
        {d && <svg className="pdesk-bone" width="1" height="1" aria-hidden="true">
          {[].concat(d).map((p, i) => <path key={i} d={p} fill={[].concat(fill)[i] ?? [].concat(fill)[0]}
            stroke={stroke} strokeWidth={stroke ? 0.25 : undefined} />)}
        </svg>}
        {children}
      </span>
    </span>
  )
}

function Body({ children }) {
  return <svg className="pdesk-bone" width="1" height="1" aria-hidden="true">{children}</svg>
}

/** A goose (雁) flying right, seen from the side (birds5.goose). */
function Goose() {
  const k = INK.goose
  const far = INK.gooseFar
  return (
    <span className="pdesk-joint" data-move="heave">
      <Joint at={[-1.2, 0.2]} move="arm-far" d="M-1.4 0 C-1.3 -2.2 -0.8 -4 -0.3 -5.5 L1.6 -5.2 C1.9 -3.5 2 -1.7 2.2 0 Z" fill={far}>
        <Joint at={[0.6, -5.4]} move="hand" d="M-0.9 -0.1 C-1 -2.2 -1.2 -3.9 -1.7 -5.6 C-0.3 -4.4 0.7 -2.7 1.1 0.2 Z" fill={far} />
      </Joint>
      <Body>
        <path d="M-7 0.6 C-5 -0.9 1 -1.5 4.6 -0.7 C5.6 -0.4 5.8 0.5 4.8 0.9 C1.8 1.8 -3.2 1.8 -7 0.6 Z" fill={k} />
        <path d="M4.4 -0.4 C6.8 -1 9.4 -1.5 11.6 -1.8" fill="none" stroke={k} strokeWidth="1.15" strokeLinecap="round" />
        <circle cx="12" cy="-1.9" r="1" fill={k} />
        <path d="M12.8 -1.9 L14.2 -1.6" stroke={k} strokeWidth="0.6" strokeLinecap="round" />
        <path d="M-7 0.6 L-9 0.2 L-8.6 1.4 Z" fill={k} />
      </Body>
      <Joint at={[0.2, -0.4]} move="arm" d="M-1.8 0 C-1.6 -2.6 -1 -4.8 -0.4 -6.6 L1.9 -6.2 C2.2 -4.2 2.4 -2 2.6 0 Z" fill={k}>
        <Joint at={[0.7, -6.4]} move="hand" d="M-1.1 -0.2 C-1.2 -2.6 -1.4 -4.6 -2 -6.6 C-0.4 -5.2 0.8 -3.2 1.3 0.2 Z" fill={k} />
      </Joint>
    </span>
  )
}

/** A red-crowned crane (丹頂) flying left, seen from the side (birds5.crane). */
function Crane() {
  const { crane: w, craneFar, craneTip: k } = INK
  return (
    <span className="pdesk-joint" data-move="heave-glide">
      <Joint at={[-3, -0.6]} move="arm-far-glide" d="M0 0 C-1.2 -4 -0.2 -8 2.6 -11.4 L5.2 -10.2 C4.4 -7 4.2 -3.6 4.6 -0.4 Z" fill={craneFar}>
        <Joint at={[3.9, -10.8]} move="hand-glide"
          d={['M-1.3 -0.6 C0 -4 2.6 -7.6 6.4 -10.4 C5.4 -6.6 4.4 -3.2 2.6 0.6 Z', 'M6.4 -10.4 C5.4 -7.6 4.6 -4.6 3.8 -1.6 L5.2 -2.4 C5.6 -5 5.9 -7.8 6.4 -10.4 Z']}
          fill={['#cfc9be', k]} />
      </Joint>
      <Body>
        <path d="M-13 0.6 C-7 -1.8 2 -2.6 9 -1.6 C13 -1 15.4 0.4 16.4 1.6 C11 3 3 3.6 -4 3.2 C-8 2.9 -11 2 -13 0.6 Z" fill={w} />
        <path d="M10 -0.2 C12.6 0.4 15 1 16.4 1.6 C14.6 2.2 12.4 2.4 10 2.2 Z" fill={k} />
        <path d="M-12.6 0.6 C-18 -0.6 -23 -1.7 -27.6 -2.6" fill="none" stroke={k} strokeWidth="2.1" strokeLinecap="round" />
        <path d="M-17.8 -0.4 C-20 -0.9 -22 -1.4 -23.6 -1.8" fill="none" stroke={w} strokeWidth="0.9" strokeLinecap="round" />
        <circle cx="-28.6" cy="-2.8" r="1.8" fill={k} />
        <circle cx="-28.9" cy="-4" r="0.9" fill="#c33a2c" />
        <path d="M-30.2 -2.6 L-35.6 -1.8" stroke="#cdb27a" strokeWidth="0.95" strokeLinecap="round" />
        <path d="M15.6 1.6 L32 3.6 M15.4 2.4 L31.4 5" stroke={k} strokeWidth="0.85" strokeLinecap="round" />
      </Body>
      <Joint at={[-1.6, -0.8]} move="arm-glide"
        d={['M-1 0 C-2.4 -4.4 -1.2 -9 2 -12.8 L5.2 -11.4 C4.4 -7.6 4.2 -3.8 4.8 -0.4 Z', 'M2 -12.8 L5.2 -11.4 C4.8 -9 4.6 -6.4 4.7 -3.6 L3.4 -3.2 C3.2 -6.4 2.8 -9.6 2 -12.8 Z']}
        fill={[w, k]}>
        <Joint at={[3.6, -12.1]} move="hand-glide"
          d={['M-1.6 -0.7 C-0.2 -4.6 2.6 -8.6 6.8 -11.8 C5.8 -7.6 4.8 -3.6 2.8 0.7 Z', 'M6.8 -11.8 C5.8 -8.6 4.9 -5.2 4 -1.8 L5.6 -2.6 C6 -5.6 6.3 -8.8 6.8 -11.8 Z']}
          fill={[w, k]} />
      </Joint>
    </span>
  )
}

/** A swallow (燕) flying right, seen from the side: its forked tail,
    its red throat, its long swept wings. */
function Swallow() {
  const { swallow: k, swallowFar: far, throat } = INK
  const arm = 'M-1.2 0 C-1 -2.6 0 -5 1.2 -6.8 L2.9 -6.3 C2.2 -4.2 1.9 -2 2 0 Z'
  const hand = 'M-1.2 -0.3 C-2.8 -3 -5.2 -5.8 -9 -8 C-5.8 -5.2 -2.9 -2.4 1.3 0.4 Z'
  return (
    <span className="pdesk-joint" data-move="heave">
      <Joint at={[-0.6, 0.2]} move="sw-arm-far" d={arm} fill={far}>
        <Joint at={[2.1, -6.7]} move="sw-hand" d={hand} fill={far} />
      </Joint>
      <Body>
        <path d="M-5 0.2 C-2.5 -1.7 2.5 -2.1 5.2 -1.1 C6.6 -0.5 6.8 0.8 5.4 1.2 C2.6 1.9 -2 1.6 -5 0.2 Z" fill={k} />
        <path d="M6.5 -0.3 L8.1 0.15 L6.5 0.6 Z" fill={k} />
        <path d="M-4.4 -0.2 L-12.8 -2.3 L-4.9 0.8 Z" fill={k} />
        <path d="M-4.4 0.3 L-12.2 2.9 L-4.6 1.1 Z" fill={k} />
        <path d="M4.2 0.6 C5.2 0.9 5.8 0.9 6.2 0.7 C5.6 1.4 4.6 1.4 3.8 1.2 Z" fill={throat} />
      </Body>
      <Joint at={[0.6, -0.6]} move="sw-arm" d={arm} fill={k}>
        <Joint at={[2.1, -6.7]} move="sw-hand" d={hand} fill={k} />
      </Joint>
    </span>
  )
}

const KINDS = { goose: Goose, crane: Crane, swallow: Swallow }

// Each joint's motion, by its name, for a bird beating every `beat` s.
function motions(beat, phase) {
  const b = beat * 1000
  const ph = -phase * 1000
  const loop = { iterations: Infinity }
  return {
    heave: [HEAVE, { ...loop, duration: b, delay: ph, easing: 'ease-in-out' }],
    'heave-glide': [HEAVE_GLIDE, { ...loop, duration: b, delay: ph, easing: 'ease-in-out' }],
    arm: [FOLD(1, -0.86), { ...loop, duration: b, delay: ph }],
    'arm-far': [FOLD(0.82, -0.62), { ...loop, duration: b, delay: ph }],
    'arm-glide': [FOLD_GLIDE(1, -0.8, 0.55), { ...loop, duration: b, delay: ph }],
    'arm-far-glide': [FOLD_GLIDE(0.8, -0.6, 0.42), { ...loop, duration: b, delay: ph }],
    hand: [BEND, { ...loop, duration: b, delay: ph - b * 0.12, easing: 'ease-in-out' }],
    'hand-glide': [BEND_GLIDE, { ...loop, duration: b, delay: ph - b * 0.12, easing: 'ease-in-out' }],
    'sw-arm': [SW_ARM(1), { ...loop, duration: b * 8, delay: ph }],
    'sw-arm-far': [SW_ARM(0.82), { ...loop, duration: b * 8, delay: ph }],
    'sw-hand': [SW_HAND, { ...loop, duration: b * 8, delay: ph - b * 0.4 }],
  }
}

// A flock's way across: in at the left, out at the right, rising and
// falling a little as it goes, slowing a touch in the middle.
function flockWay(root, f) {
  const W = DESK.scene.w
  const total = f.cross + f.rest
  const end = f.cross / total
  const [from, to] = [-140, W + 120]
  const way = [0, 0.22, 0.5, 0.78, 1].map((t, i) => ({
    offset: t * end,
    transform: `translate(${from + (to - from) * (t + 0.04 * Math.sin(t * Math.PI * 2))}px, ${f.y + SWAY * [0.6, -0.4, 0.3, -0.8, 0.2][i]}px)`,
    opacity: 1,
  }))
  const last = way[way.length - 1].transform
  return [play(root, [
    ...way,
    { offset: Math.min(1, end + 0.0005), transform: last, opacity: 0 },
    { offset: 1, transform: last, opacity: 0 },
  ], { duration: total, delay: FIRST, iterations: Infinity, fill: 'both' })]
}

// A swallow's own way: swooping down and up as it goes, its body along
// its way, then gone until its next.
function soloWay(el, b, i) {
  const W = DESK.scene.w
  const total = b.cross + b.rest
  const end = b.cross / total
  const n = 16
  const phase = spread(i, 17) * Math.PI * 2
  const at = t => [-80 + (W + 160) * t, b.y + DIP * Math.sin(phase + t * Math.PI * 2 * b.dips)]
  const way = Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n
    const [x, y] = at(t)
    const [x2, y2] = at(Math.min(1, t + 0.01))
    const [x1, y1] = at(Math.max(0, t - 0.01))
    const turn = Math.max(-28, Math.min(28, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI))
    return { offset: t * end, transform: `translate(${x}px, ${y}px) rotate(${turn}deg)`, opacity: 1 }
  })
  const last = way[n].transform
  return play(el, [
    ...way,
    { offset: Math.min(1, end + 0.0005), transform: last, opacity: 0 },
    { offset: 1, transform: last, opacity: 0 },
  ], { duration: total, delay: b.wait, iterations: Infinity, fill: 'both' })
}

/** The hour's birds, now and then, over the sky (none at night). */
export function DeskBirds({ hour }) {
  const box = useRef(null)
  const f = FLIGHTS[hour]
  useEffect(() => {
    const root = box.current
    if (!root || !f) return undefined
    const anims = f.solo
      ? [...root.querySelectorAll('.pdesk-way')].map((el, i) => soloWay(el, f.birds[i], i))
      : flockWay(root, f)
    root.querySelectorAll('.pdesk-bird').forEach((bird, i) => {
      const m = motions(f.beat * (0.94 + 0.12 * spread(i, 5)), spread(i, 13) * f.beat)
      // in a flock, each bird keeps its place loosely
      if (!f.solo) {
        anims.push(play(bird.firstElementChild, [
          { transform: 'translate(0, 0)' },
          { transform: `translate(${(spread(i, 3) - 0.5) * 8}px, ${(spread(i, 7) - 0.5) * 6}px)` },
        ], { duration: 4200 + spread(i, 11) * 3000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }))
      }
      bird.querySelectorAll('[data-move]').forEach(el => {
        const [frames, options] = m[el.dataset.move]
        anims.push(play(el, frames, options))
      })
    })
    return () => anims.forEach(a => a?.cancel())
  }, [f])
  if (!f) return null
  const Kind = KINDS[f.kind]
  const bird = (x, y, i) => (
    <span key={i} className="pdesk-bird"
      style={{ left: x * f.scale, top: y * f.scale, transform: `scale(${f.turned ? -f.scale : f.scale}, ${f.scale})` }}>
      <span className="pdesk-joint"><Kind /></span>
    </span>
  )
  return (
    <span ref={box} className={`pdesk-flock${f.solo ? ' pdesk-flock--solo' : ''}`}>
      {f.solo
        ? f.birds.map((_, i) => <span key={i} className="pdesk-way">{bird(0, 0, i)}</span>)
        : f.birds.map(([x, y], i) => bird(x, y, i))}
    </span>
  )
}
