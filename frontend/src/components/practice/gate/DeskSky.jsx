import { useEffect, useRef } from 'react'
import DESK from './desk.json'

// ── 空 — the desk's sky, alive (plan 244b) ───────────────────────────
// The painting stands still; its sky does not. Behind the sky's own mask
// (scripts/practice-gate/desk.py's sky.png: the canopy, its lamps, the
// wires, the pillars and the land stay in front), in the scene's units:
//
//   雲   the clouds, lifted off the sky (clouds.py), drifting a few
//        dozen units either way, slow enough to be seen only by a
//        learner who stays; they start where the painting has them
//   星   at dusk and at night, the brightest of the stars the hour drew
//        catching the light now and then
//   日月 the sun's or the moon's glow, breathing
//   鳥   by day, now and then a few birds crossing; at dusk the geese
//        of 落雁 in their V; none at night
//
// and under the canopy, once the lamps are on, one of its tubes
// stutters now and then, as a station's does (DeskFlicker).
//
// Every loop but the clouds' is a Web Animation, started once (DESIGN.md,
// "Many loops on one screen are Web Animations"), and none runs under
// reduced motion: the clouds keep the painting's place, and the sky is
// the painting's.

const clouds = hour => `/practice/gate/desk/${DESK.rev}/clouds-${hour}.webp`
const NONE = []

// A crossing: the birds' places in the flock (units from its lead), how
// long they take over the scene, how long the sky stays empty after, and
// the row they fly at (the sky's units, under the wires, over the land).
const FLOCK = {
  dawn: { birds: [[0, 0], [-30, 10], [-52, -5]], cross: 34000, rest: 38000, y: 214 },
  day: { birds: [[0, 0], [-26, 12], [-56, 5], [-36, -10]], cross: 30000, rest: 32000, y: 196 },
  dusk: { birds: [[0, 0], [-22, -11], [-44, -22], [-22, 11], [-44, 22]], cross: 42000, rest: 30000, y: 196 },
}
const BIRD = 18             // a bird's span, units
// The tube that stutters (desk.json's lamps, left to right), how often,
// and its stutter: off, on, off again, as a cycle's last moments (the
// first, five seconds after the lamps come on).
const TUBE = 1
const FLICKER = 19000
const STUTTER = [[0, 0], [0.9, 0], [0.904, 0.85], [0.909, 0.1], [0.914, 0.7], [0.93, 0], [1, 0]]
const BEAT = 460            // a wingbeat, ms
const FIRST = 5000          // ms before the first crossing

// A spread of numbers in [0, 1) drawn from an index, the same on every
// visit (a star's twinkle keeps its own pace).
const spread = (i, k) => ((i + 1) * k * 0.6180339887) % 1

function play(el, frames, options) {
  if (!el || typeof el.animate !== 'function') return null
  return el.animate(frames, options)
}

export function DeskSky({ hour, hours, still }) {
  const sky = DESK.sky
  const style = {
    '--pd-sky-top': sky.top,
    '--pd-sky-h': sky.h,
    '--pd-sky-pad': sky.pad,
    '--pd-drift': sky.drift,
    '--pd-sky': `url(/practice/gate/desk/${DESK.rev}/sky.png)`,
  }
  return (
    <div className="pdesk__sky" style={style} aria-hidden="true">
      {!still && <Disc key={`disc-${hour}`} hour={hour} />}
      {!still && <Glints key={`stars-${hour}`} hour={hour} />}
      <div className={`pgate__layers pdesk__clouds${still ? ' is-still' : ''}`}>
        {hours.map(h => <img key={h} className={`pgate__layer${h === hour ? ' is-on' : ''}`} src={clouds(h)} alt="" draggable="false" />)}
      </div>
      {!still && FLOCK[hour] && <Flock key={`birds-${hour}`} hour={hour} />}
    </div>
  )
}

/** The sun's or the moon's glow, over the painted one, breathing. */
function Disc({ hour }) {
  const ref = useRef(null)
  const d = DESK.disc?.[hour]
  useEffect(() => {
    const a = play(ref.current, [{ opacity: 0.04 }, { opacity: 0.2 }],
      { duration: 7000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' })
    return () => a?.cancel()
  }, [])
  if (!d) return null
  const size = d.reach * 2
  return (
    <i ref={ref} className="pdesk-disc" style={{
      left: d.x - size / 2,
      top: d.y - DESK.sky.top - size / 2,
      width: size,
      height: size,
      '--pd-glow': d.glow,
    }} />
  )
}

/** The brightest stars, catching the light each at its own pace. */
function Glints({ hour }) {
  const refs = useRef([])
  const stars = DESK.stars?.[hour] ?? NONE
  useEffect(() => {
    const anims = refs.current.map((el, i) => play(el, [
      { opacity: 0, transform: 'scale(0.5)' },
      { opacity: Math.min(1, 0.45 + stars[i][2]), transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.5)' },
    ], {
      duration: 1800 + spread(i, 7) * 2600,
      delay: spread(i, 3) * 6000,
      endDelay: 1500 + spread(i, 11) * 7000,
      iterations: Infinity,
      easing: 'ease-in-out',
    }))
    return () => anims.forEach(a => a?.cancel())
  }, [stars])
  return stars.map(([x, y], i) => (
    <i key={i} ref={el => { refs.current[i] = el }} className="pdesk-glint"
      style={{ left: x, top: y - DESK.sky.top }} />
  ))
}

/** A few birds crossing the sky, left to right, beating their wings. */
function Flock({ hour }) {
  const box = useRef(null)
  const wings = useRef([])
  const f = FLOCK[hour]
  useEffect(() => {
    const W = DESK.scene.w
    const total = f.cross + f.rest
    const at = (x, y) => `translate(${x}px, ${y}px)`
    const fly = play(box.current, [
      { transform: at(-80, f.y + 14), opacity: 0, offset: 0 },
      { transform: at(-40, f.y + 12), opacity: 1, offset: 0.02 },
      { transform: at(W + 60, f.y - 10), opacity: 1, offset: f.cross / total },
      { transform: at(W + 60, f.y - 10), opacity: 0, offset: Math.min(1, f.cross / total + 0.001) },
      { transform: at(W + 60, f.y - 10), opacity: 0, offset: 1 },
    ], { duration: total, delay: FIRST, iterations: Infinity, fill: 'both' })
    const beats = wings.current.map((el, i) => play(el, [
      { transform: 'scaleY(1)' },
      { transform: 'scaleY(-0.35)' },
      { transform: 'scaleY(1)' },
    ], { duration: BEAT + spread(i, 5) * 120, delay: spread(i, 13) * BEAT, iterations: Infinity, easing: 'ease-in-out' }))
    return () => { fly?.cancel(); beats.forEach(a => a?.cancel()) }
  }, [f])
  return (
    <span ref={box} className="pdesk-flock" style={{ color: DESK.fill[hour].top }}>
      {f.birds.map(([x, y], i) => (
        <svg key={i} ref={el => { wings.current[i] = el }} className="pdesk-bird" viewBox="0 0 20 8"
          style={{ left: x, top: y, width: BIRD, height: BIRD * 0.4 }}>
          <path d="M0.5 5.5 Q5 0.5 10 4.5 Q15 0.5 19.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ))}
    </span>
  )
}

/** A tube of the canopy's stuttering now and then, once the lamps are on. */
export function DeskFlicker({ hour, still }) {
  const ref = useRef(null)
  const on = !still && (hour === 'dusk' || hour === 'night')
  useEffect(() => {
    if (!on) return undefined
    const a = play(ref.current, STUTTER.map(([offset, opacity]) => ({ offset, opacity })),
      { duration: FLICKER, delay: -0.62 * FLICKER, iterations: Infinity })
    return () => a?.cancel()
  }, [on])
  if (!on) return null
  const [x0, x1] = DESK.lamps.tubes[TUBE]
  const [y0, y1] = DESK.lamps.rows
  return <i ref={ref} className="pdesk-flicker" aria-hidden="true" style={{ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }} />
}
