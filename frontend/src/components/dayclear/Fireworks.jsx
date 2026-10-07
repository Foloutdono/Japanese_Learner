import { useEffect, useRef } from 'react'
import { createSky, drawLight, drawSparks, fadeSky, makeSprites, skyDone, stepSky } from './fireworksSim'

// ── 花火 — the month's fireworks (plan 191) ──────────────────────────
// The canvas's Milestone-30 sky on two <canvas>es behind the station: the
// light (smoke, each burst's glow, the trails; cleared every frame) and
// the sparks (additive, their trails kept by fading the last frame with
// 'destination-out', so the CSS night shows through). Both
// devicePixelRatio-aware (at most 2). The simulation is
// fireworksSim.js, the board's own, stepped at a fixed 1/60s from the
// elapsed time with a seeded die, so a show is the same on every play;
// a frame that fell behind steps without drawing and fades the trails
// once for the steps it skipped (the board's catch-up, capped at 4s).
//
// The loop ends by itself when the sky is empty (`onDone`), on unmount,
// and whenever `mode` goes; a hidden tab pauses it (the clock waits
// with it, so the show picks up where it was rather than jumping).
//
// Props:
//   mode    'show' (the board's eight shells and two small ones after),
//           'idle' (three small shells: a skip that came before the show)
//           or null (nothing: reduced motion, or not yet); `play` is the
//           foundation's boolean for 'show'
//   seed    the die's seed (default the board's: 30061006, 4242 idle)
//   sky     { w, h }: the canvases' CSS size, in the stage's px
//           { k, dx, dy }: the board's sky → the stage (x' = dx + x·k,
//           y' = dy + y·k), so the show stands over the roof at any
//           height; `spread` widens the launches about the centre
//   rim     { ref, edge, fill, w, x }: the station's rim canvas, the
//           roof's edge and fill as Path2D in the station's px, its
//           width, and the board's x → the station's (the roof catches
//           the three brightest bursts)
//   scale   the stage's own CSS scale (a short desk), so the canvases
//           are drawn at the pixels they are shown at
//   onBurst(i, x, y)  each burst, in the board's coordinates
//   onDone()          the sky is empty
//   className         on the wrapper (absolute, over the night, under the station)
let SPRITES = null

export default function Fireworks({ mode: modeProp = null, play = false, seed, sky, rim, scale = 1, onBurst, onDone, className = '' }) {
  const mode = modeProp ?? (play ? 'show' : null)
  const glowRef = useRef(null)
  const fxRef = useRef(null)
  const cb = useRef({ onBurst, onDone })
  useEffect(() => { cb.current = { onBurst, onDone } })
  const w = sky?.w ?? 390
  const h = sky?.h ?? 420
  const k = sky?.k ?? 1
  const dx = sky?.dx ?? 0
  const dy = sky?.dy ?? 0
  const spread = sky?.spread ?? 1

  useEffect(() => {
    const cvF = fxRef.current
    const cvG = glowRef.current
    if (!mode || !cvF || !cvG) return undefined
    const dpr = Math.min(2, window.devicePixelRatio || 1) * scale
    const fit = (cv, cw, ch) => {
      const W = Math.round(cw * dpr)
      const H = Math.round(ch * dpr)
      if (cv.width !== W) cv.width = W
      if (cv.height !== H) cv.height = H
    }
    fit(cvF, w, h)
    fit(cvG, w, h)
    const cvR = rim?.ref?.current ?? null
    if (cvR) fit(cvR, rim.w, 160)
    const f = cvF.getContext('2d')
    const g = cvG.getContext('2d')
    const r = cvR ? cvR.getContext('2d') : null
    if (!f || !g) return undefined
    if (!SPRITES) SPRITES = makeSprites()
    const m = [dpr * k, dpr * dx, dpr * dy]
    const roof = cvR && rim?.edge ? { edge: rim.edge, fill: rim.fill, w: rim.w, x: rim.x, dpr } : null
    const sim = createSky(mode, { spread, seed, onBurst: (i, x, y) => cb.current.onBurst?.(i, x, y) })
    const bk = {}
    const DT = 1 / 60
    let t0 = performance.now()
    let raf = 0
    let hiddenAt = 0

    const clearAll = () => {
      for (const c of [f, g, r]) {
        if (!c) continue
        c.setTransform(1, 0, 0, 1, 0, 0)
        c.clearRect(0, 0, c.canvas.width, c.canvas.height)
      }
    }
    const frame = now => {
      raf = 0
      const target = (now - t0) / 1000
      let n = Math.floor((target - sim.t) / DT + 1e-6)
      if (n > 240) { t0 += (n - 240) * DT * 1000; n = 240 }
      // steps that are not drawn fade the trails once, as their n fades would have
      const pre = Math.max(0, n - 4)
      for (let i = 0; i < pre; i++) stepSky(sim, DT)
      if (pre) fadeSky(f, 1 - Math.pow(0.7, pre))
      for (let i = pre; i < n; i++) { stepSky(sim, DT); fadeSky(f, 0.3); drawSparks(sim, f, SPRITES, m) }
      drawLight(sim, g, m, r, roof, bk)
      if (skyDone(sim)) {      // the sky is empty: the loop ends
        clearAll()
        cb.current.onDone?.()
        return
      }
      raf = requestAnimationFrame(frame)
    }
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; hiddenAt = performance.now() }
      } else if (hiddenAt) {
        t0 += performance.now() - hiddenAt
        hiddenAt = 0
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (document.hidden) hiddenAt = performance.now()
    else raf = requestAnimationFrame(frame)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      clearAll()
    }
    // A show is one run: the geometry is read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <div className={['ms-fw', className].filter(Boolean).join(' ')} style={{ width: w, height: h }} aria-hidden="true">
      <canvas ref={glowRef} className="ms-fw__cv" style={{ width: w, height: h }} />
      <canvas ref={fxRef} className="ms-fw__cv" style={{ width: w, height: h }} />
    </div>
  )
}
