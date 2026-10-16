// ── 指 — the finger (plan 210) ────────────────────────────────────────
// What makes a recording of an app look used rather than played: a
// finger that reaches. It travels on a slight arc with the minimum-jerk
// profile of a hand, settles a beat before it presses, presses a little
// off the dead centre of what it is aiming at, holds as a thumb does,
// and lifts. Its timings are drawn from a seeded stream, so it is never
// metronomic and every render of a script is the same film.
//
// What it presses, the app feels: each press is queued as real input
// (a mouse press and release at that point of the board), which the
// renderer hands to Chrome before the next frame, so the app's :active,
// focus, sounds and its own click handlers all answer exactly as they
// would to a thumb. Previewed in a plain browser there is no renderer,
// and the same press is dispatched into the stage as DOM events.

import { tween, wait, ease, lerp, clamp, seeded, every } from './clock'

const HAND_SVG = `
<svg viewBox="0 0 92 120" aria-hidden="true">
  <path d="M17 6c6 0 10 4.6 10 10.5V52l3.6-3.4c4.6-4.4 11.8-4.2 16 .5l1.4-1.2c4.6-4 11.6-3.4 15.5 1.3l1-.7c4.8-3.4 11.3-2.5 14.9 2.2 2.6 3.4 3.6 7.6 3.6 12V78c0 21-15 38-35.5 38h-6.8C25 116 13 107 8.4 94L2.2 76.6c-1.6-4.6.6-9.6 5.1-11.4l2.2-.9V16.5C9.5 10.6 11.6 6 17 6z" fill="#fbf7ef" stroke="#17151a" stroke-width="3" stroke-linejoin="round"/>
  <path d="M27 52v14M48 49v15M64 50v14" stroke="#17151a" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
</svg>`

export function createFinger(layer, { kind = 'dot', seed = 7, send }) {
  const rnd = seeded(seed * 97 + 13)
  const root = document.createElement('div')
  root.className = `finger finger--${kind}`
  root.innerHTML = `<div class="finger__ring"></div><div class="finger__pad"></div><div class="finger__hand">${HAND_SVG}</div>`
  layer.appendChild(root)
  const pad = root.querySelector('.finger__pad')
  const hand = root.querySelector('.finger__hand')

  const state = { x: 470, y: 860, opacity: 0, press: 0 }
  let side = 1

  function paint() {
    const s = 1 - 0.14 * state.press
    root.style.opacity = String(state.opacity)
    root.style.transform = `translate(${state.x}px, ${state.y}px)`
    pad.style.transform = `scale(${s})`
    hand.style.transform = `scale(${1 - 0.06 * state.press}) translateY(${3 * state.press}px)`
  }
  every(paint)

  function ripple(x, y) {
    const el = document.createElement('div')
    el.className = 'finger__tap'
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    layer.appendChild(el)
    tween(0.42, k => {
      el.style.opacity = String(0.75 * (1 - k))
      el.style.transform = `scale(${lerp(0.55, 1.9, k)})`
    }, ease.outCubic).then(() => el.remove())
  }

  const jitter = (a, b) => a + (b - a) * rnd()

  /** Glide to a point (or a point that moves: a function of nothing). */
  async function moveTo(target, { duration, arc = true } = {}) {
    const goal = typeof target === 'function' ? target : () => target
    const from = { x: state.x, y: state.y }
    const first = goal()
    const dist = Math.hypot(first.x - from.x, first.y - from.y)
    const d = duration ?? clamp(0.2 + 0.11 * Math.log2(1 + dist / 26), 0.28, 0.82)
    side = -side
    const bow = arc ? clamp(dist * 0.1, 4, 26) * side * jitter(0.6, 1.2) : 0
    await tween(d, k => {
      const to = goal()
      const nx = -(to.y - from.y) / (dist || 1)
      const ny = (to.x - from.x) / (dist || 1)
      const lift = Math.sin(Math.PI * k) * bow
      state.x = lerp(from.x, to.x, k) + nx * lift
      state.y = lerp(from.y, to.y, k) + ny * lift
    }, ease.reach)
  }

  async function appear() {
    if (state.opacity > 0.99) return
    // From below and to the right, where a right thumb comes from.
    if (state.opacity < 0.01) Object.assign(state, { x: 380 + jitter(0, 40), y: 800 })
    await tween(0.22, k => { state.opacity = k }, ease.outCubic)
  }

  const finger = {
    root,
    get pos() { return { x: state.x, y: state.y } },
    moveTo,
    appear,
    /** Off the screen, down and right, as a hand that is done. */
    async leave() {
      const from = { x: state.x, y: state.y }
      await tween(0.45, k => {
        state.x = lerp(from.x, 450, k)
        state.y = lerp(from.y, 830, k)
        state.opacity = 1 - k * k
      }, ease.inCubic)
      state.opacity = 0
    },
    /**
     * Reach `target` and press it. `target` is a board point or a
     * function giving one (re-read every frame, so a target the camera
     * is moving stays under the finger). `onPress` runs at the moment of
     * contact, for presses the director handles itself.
     */
    async tap(target, { hold, settle, onPress, input = true, quick = false } = {}) {
      await appear()
      const goal = typeof target === 'function' ? target : () => target
      // Never quite the centre: a thumb lands a little low and to the side.
      const off = { x: jitter(-3, 3), y: jitter(0, 4) }
      await moveTo(() => { const g = goal(); return { x: g.x + off.x, y: g.y + off.y } })
      await wait(settle ?? (quick ? jitter(0.03, 0.07) : jitter(0.07, 0.16)))
      const at = { x: state.x, y: state.y }
      await tween(0.07, k => { state.press = k }, ease.outCubic)
      ripple(at.x, at.y)
      if (input) send({ kind: 'mouse', type: 'mousePressed', x: at.x, y: at.y })
      onPress?.(at)
      await wait(hold ?? (quick ? jitter(0.05, 0.08) : jitter(0.08, 0.14)))
      if (input) send({ kind: 'mouse', type: 'mouseReleased', x: at.x, y: at.y })
      await tween(0.12, k => { state.press = 1 - k }, ease.outCubic)
      // The finger leaves the glass: nothing stays hovered under it.
      if (input) send({ kind: 'mouse', type: 'mouseMoved', x: -40, y: -40 })
      return at
    },
    /** Press at `from` and slide to `to` (a scroll, a swipe), then lift. */
    async drag(from, to, { duration = 0.5, onMove, input = true } = {}) {
      await appear()
      await moveTo(from)
      await tween(0.06, k => { state.press = k }, ease.outCubic)
      if (input) send({ kind: 'mouse', type: 'mousePressed', x: state.x, y: state.y })
      await tween(duration, k => {
        state.x = lerp(from.x, to.x, k)
        state.y = lerp(from.y, to.y, k)
        if (input) send({ kind: 'mouse', type: 'mouseMoved', x: state.x, y: state.y, drag: true })
        onMove?.(k)
      }, ease.inOutSine)
      if (input) send({ kind: 'mouse', type: 'mouseReleased', x: state.x, y: state.y })
      await tween(0.12, k => { state.press = 1 - k }, ease.outCubic)
      if (input) send({ kind: 'mouse', type: 'mouseMoved', x: -40, y: -40 })
    },
    /**
     * Write one stroke: press at its first point, follow `points` (a
     * polyline, in board pixels) at an even pace along its length, as a
     * brush is drawn, and lift. Between strokes the finger travels in the
     * air, the way a hand writing does.
     */
    async trace(points, { duration = 0.4, input = true } = {}) {
      if (points.length < 2) return
      await appear()
      await moveTo(points[0], { duration: 0.16, arc: false })
      await tween(0.05, k => { state.press = k }, ease.outCubic)
      if (input) send({ kind: 'mouse', type: 'mousePressed', x: points[0].x, y: points[0].y })
      // Arc length to each point, so the stroke moves at one speed.
      const at = [0]
      for (let i = 1; i < points.length; i++) at.push(at[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
      const total = at[at.length - 1] || 1
      let i = 1
      await tween(duration, k => {
        const d = k * total
        while (i < points.length - 1 && at[i] < d) i++
        const span = at[i] - at[i - 1] || 1
        const f = Math.min(1, Math.max(0, (d - at[i - 1]) / span))
        state.x = lerp(points[i - 1].x, points[i].x, f)
        state.y = lerp(points[i - 1].y, points[i].y, f)
        if (input) send({ kind: 'mouse', type: 'mouseMoved', x: state.x, y: state.y, drag: true })
      }, ease.inOutSine)
      const last = points[points.length - 1]
      if (input) send({ kind: 'mouse', type: 'mouseReleased', x: last.x, y: last.y })
      await tween(0.06, k => { state.press = 1 - k }, ease.outCubic)
    },
    /** Hover over a point without pressing (a thumb that hesitates). */
    async hover(target, seconds = 0.3) {
      await appear()
      await moveTo(target)
      await wait(seconds)
    },
    /** Rest out of the way at the screen's foot while the app works. */
    async rest(target) {
      if (state.opacity < 0.01) return
      await moveTo(target ?? { x: 360 + jitter(-12, 12), y: 700 + jitter(-10, 10) }, { duration: 0.5 })
    },
    jitter,
  }
  return finger
}
