// ── 時刻 — the reel's clock and its motion (plan 210) ─────────────────
// Everything the director moves is a function of one clock: seconds
// since the reel started, read from performance.now(). Rendering, that
// clock is the page's virtual time, stepped a frame at a time by
// reel.mjs, so every wait and every tween lands on the same frame in
// every render; previewed in a browser, it is plain time.
//
// One requestAnimationFrame loop drives every continuous motion (the
// camera's spring, the finger, the handheld drift): each registers an
// updater with every(), and all of them read the same instant per frame.

let origin = null
let pace = 1

/** Seconds since start(), or 0 before it. */
export function now() {
  return origin == null ? 0 : (performance.now() - origin) / 1000
}

export function start(p = 1) {
  pace = p
  origin = performance.now()
}

export const started = () => origin != null

/** Wait `seconds` of the reel (scaled by its pace). */
export function wait(seconds) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, (seconds * 1000) / pace)))
}

/** The next frame. */
export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

const updaters = new Set()

/** Call fn(t, dt) on every frame until the returned function is called. */
export function every(fn) {
  updaters.add(fn)
  return () => updaters.delete(fn)
}

let last = null
function loop() {
  const t = now()
  const dt = last == null ? 0 : Math.max(0, t - last)
  last = t
  for (const fn of [...updaters]) fn(t, dt)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

// ── Easing ─────────────────────────────────────────────────────────
export const ease = {
  linear: x => x,
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outCubic: x => 1 - (1 - x) ** 3,
  inCubic: x => x * x * x,
  outQuint: x => 1 - (1 - x) ** 5,
  outExpo: x => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  // A hand reaching for a point: the minimum-jerk profile.
  reach: x => x * x * x * (10 - 15 * x + 6 * x * x),
  outBack: x => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
  },
  // A press that lands and settles.
  pop: x => {
    if (x >= 1) return 1
    return 1 - Math.exp(-6 * x) * Math.cos(x * 9.5)
  },
}

/**
 * Animate over `duration` reel seconds, calling update(k) with the eased
 * progress 0…1 each frame; resolves after the last frame.
 */
export function tween(duration, update, easing = ease.inOutCubic) {
  const d = Math.max(0.0001, duration / pace)
  return new Promise(resolve => {
    const begin = now()
    update(easing(0), 0)
    const stop = every(t => {
      const raw = Math.min(1, (t - begin) / d)
      update(easing(raw), raw)
      if (raw >= 1) {
        stop()
        resolve()
      }
    })
  })
}

export const lerp = (a, b, k) => a + (b - a) * k
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

/** A seeded random stream (mulberry32): a reel is the same film each time. */
export function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let r = Math.imul(s ^ (s >>> 15), 1 | s)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth drift in -1…1: three incommensurate sines, phased by `seed`. */
export function drift(seed) {
  const rnd = seeded(seed)
  const p = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28]
  return t => Math.sin(t * 1.13 + p[0]) * 0.55 + Math.sin(t * 2.71 + p[1]) * 0.3 + Math.sin(t * 5.37 + p[2]) * 0.15
}
