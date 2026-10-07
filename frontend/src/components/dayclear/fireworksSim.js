import { rng } from './kit/rng'

// ── 花火 — the month's sky, as numbers (plan 191) ────────────────────
// The canvas's Milestone-30 particle system (its board's script, ported
// line for line): rising shells with wobbling sparkle trails, then 菊
// chrysanthemum, 牡丹 peony, 柳 willow, 冠 crown (kamuro), the red ring
// and a closing 千輪 cluster whose stars pop into crackling minis; drag,
// gravity, trails that outlive their star, glitter, smoke lit by the
// bursts, a glow per burst on the sky, and the station roof's edge
// catching the three brightest. Stepped at a fixed 1/60s from a seeded
// die, so a show is the same on every play. Pure: no DOM but the 2D
// contexts it is handed (Fireworks.jsx owns the canvases and the loop).
//
// Coordinates are the board's (a 390-wide sky, the roof's top at 266,
// shells launched from 432 under it); Fireworks maps them onto the
// screen's sky with one transform.

/** The palette: the paper, the gate's golds and one ring of stamp ink. */
export const COL = Object.freeze({
  white: [255, 250, 240], paper: [243, 236, 223], lit: [230, 189, 98],
  gold: [201, 154, 62], pale: [242, 210, 127], red: [195, 58, 44],
})
const RGB = Object.fromEntries(Object.entries(COL).map(([k, v]) => [k, `rgb(${v.join(',')})`]))

/** The show: five shells as the station rises, then the finale's three 千輪. */
export function showList(spread = 1) {
  const sx = x => 195 + (x - 195) * spread
  return [
    { t: 0.00, type: 'kiku', x0: 112, x1: 122, y1: 150, R: 100, T: 1.0, light: 1, lc: 'paper' },
    { t: 0.40, type: 'botan', x0: 290, x1: 278, y1: 112, R: 80, T: 0.95, light: 0.85, lc: 'lit' },
    { t: 0.80, type: 'yanagi', x0: 206, x1: 198, y1: 86, R: 92, T: 1.05, light: 0.9, lc: 'lit' },
    { t: 1.30, type: 'ring', x0: 302, x1: 290, y1: 160, R: 78, T: 0.9, light: 0.8, lc: 'paper' },
    { t: 1.75, type: 'kamuro', x0: 92, x1: 104, y1: 124, R: 88, T: 0.95, light: 0.9, lc: 'lit' },
    { t: 5.10, type: 'senrin', x0: 198, x1: 195, y1: 118, R: 62, T: 0.95, light: 0.8, lc: 'paper' },
    { t: 5.30, type: 'senrin', x0: 80, x1: 92, y1: 178, R: 48, T: 0.9, light: 0.6, lc: 'paper' },
    { t: 5.45, type: 'senrin', x0: 312, x1: 300, y1: 170, R: 48, T: 0.9, light: 0.6, lc: 'paper' },
  ].map(s => ({ ...s, x0: sx(s.x0), x1: sx(s.x1) }))
}

/** The small shells that keep the sky alive after the show (or after a skip). */
export function idleShell(i, spread = 1) {
  const r = rng(9100 + i * 131)
  const types = ['botan', 'kiku', 'yanagi', 'kamuro']    // the red ring is the show's, once
  const type = types[i % 4]
  const left = i % 2 === 1
  const x1 = 195 + ((left ? 84 + r() * 64 : 236 + r() * 64) - 195) * spread
  return {
    type, x0: x1 + (r() - 0.5) * 22, x1, y1: 100 + r() * 60, R: 50 + r() * 14, T: 0.95,
    light: 0.5, lc: type === 'kiku' ? 'paper' : 'lit', small: true,
  }
}

const hr = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x) }
const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`

/** One radial sprite per colour (made once per document). */
export function makeSprites() {
  const mk = (rgb, core) => {
    const cv = document.createElement('canvas')
    cv.width = 64
    cv.height = 64
    const c = cv.getContext('2d')
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    const tint = (m, a) => `rgba(${rgb.map(v => Math.round(v + (255 - v) * m)).join(',')},${a})`
    g.addColorStop(0, tint(core, 1))
    g.addColorStop(0.1, tint(core * 0.55, 1))
    g.addColorStop(0.22, tint(0.05, 0.75))
    g.addColorStop(0.36, tint(0, 0.16))
    g.addColorStop(1, tint(0, 0))
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
    return cv
  }
  const out = {}
  for (const k in COL) out[k] = mk(COL[k], k === 'red' ? 0.45 : 0.85)
  return out
}

/**
 * A sky: `mode` 'show' (the board's eight shells, then two small ones)
 * or 'idle' (three small ones, as after a skip that came before the
 * show). `spread` widens the launches about the centre (the desk's
 * wider sky); `onBurst(i, x, y)` hears each burst.
 */
export function createSky(mode, { spread = 1, seed, onBurst } = {}) {
  return {
    mode, t: 0, step: 0, nid: 1, bursts: 0, spread, onBurst,
    rnd: rng(seed ?? (mode === 'idle' ? 4242 : 30061006)),
    queue: mode === 'show' ? showList(spread) : [], qi: 0,
    idleNext: mode === 'show' ? 8.75 : 0.3, idleIdx: 0, idleMax: mode === 'show' ? 2 : 3,
    shells: [], stars: [], pend: [], ghosts: [], sparks: [], crackles: [], cores: [], flashes: [], smoke: [],
  }
}

/** Whether the sky has emptied: nothing queued, nothing alight. */
export function skyDone(fx) {
  return fx.qi >= fx.queue.length && fx.idleIdx >= fx.idleMax &&
    !fx.shells.length && !fx.stars.length && !fx.pend.length && !fx.ghosts.length && !fx.sparks.length &&
    !fx.crackles.length && !fx.cores.length && !fx.flashes.length && !fx.smoke.length
}

function star(fx, x, y, vx, vy, o, z) {
  const R = fx.rnd
  const st = {
    id: fx.nid++, x, y, vx, vy, age: 0,
    life: o.life[0] + R() * (o.life[1] - o.life[0]),
    k: o.k, g: o.g, s: o.size,
    b0: (o.b0 ?? 1) * (0.74 + 0.26 * ((z ?? 0) + 1) / 2),
    cols: o.cols, fo: o.fo ?? 0.7, flick: !!o.flick, tw: o.twinkle || 0,
    tl: o.tl || 0, te: o.te || 1, tb: o.tb || 0, tc: o.tc || null, tw2: o.tw || 1.1, sag: o.sag || 0,
    sparkle: o.sparkle || 0, glit: o.glit || 0, gc: o.gc || 'white', crackle: o.crackle || 0, pop: o.pop || null,
    tr: o.tl ? [] : null, ti: 0,
  }
  fx.pend.push(st)
  return st
}

function sphere(fx, x, y, Rr, o) {
  const R = fx.rnd
  const n = o.n
  const ga = Math.PI * (3 - Math.sqrt(5))
  const rot = R() * Math.PI * 2
  const tilt = (R() - 0.5) * 1.3
  const ct = Math.cos(tilt)
  const stl = Math.sin(tilt)
  for (let i = 0; i < n; i++) {
    const z0 = 1 - (2 * i + 1) / n
    const rr = Math.sqrt(1 - z0 * z0)
    const th = i * ga + rot
    const x0 = Math.cos(th) * rr
    const y0 = Math.sin(th) * rr
    const yv = y0 * ct - z0 * stl
    const zv = y0 * stl + z0 * ct
    const sp = Rr * o.k * (1 + (R() - 0.5) * (o.jit || 0.06))
    const dj = (R() - 0.5) * 0.05
    star(fx, x, y, (x0 + dj) * sp, (yv - dj) * sp, o, zv)
  }
}

function burst(fx, s) {
  const R = fx.rnd
  const x = s.x
  const y = s.y
  const Rr = s.R
  const m = s.small ? 0.62 : 1
  const dim = s.small ? 0.8 : 1
  fx.onBurst?.(fx.bursts++, x, y)
  fx.flashes.push({ x, y, age: 0, I: s.light, c: s.lc, rad: 150 + Rr * 1.15 })
  fx.cores.push({ x, y, age: 0, life: 0.08, size: (8 + Rr * 0.08) * (s.small ? 0.75 : 1) })
  const smoke = k => {
    for (let i = 0; i < k; i++) {
      fx.smoke.push({ x: x + (R() - 0.5) * Rr * 0.9, y: y + (R() - 0.3) * Rr * 0.7, age: 0, life: 5 + R() * 2, r0: 20 + R() * 16, r1: 70 + R() * 46, a: 0.05 + R() * 0.03 })
    }
  }
  if (s.type === 'kiku') {
    sphere(fx, x, y, Rr, {
      n: Math.round(96 * m), k: 2.0, g: 50, life: [1.6, 2.0], size: 1.3, b0: dim,
      cols: [['paper', 0], ['lit', 0.3], ['gold', 0.78]], fo: 0.72, flick: true,
      tl: 0.6, te: 1, tb: 0.46, tc: ['pale', 'lit'], tw: 1.0, sag: 6, sparkle: 0.1, jit: 0.06,
    })
    sphere(fx, x, y, Rr * 0.38, {
      n: Math.round(24 * m), k: 2.4, g: 36, life: [1.0, 1.25], size: 1.5, b0: 0.9 * dim,
      cols: [['pale', 0], ['lit', 0.6]], fo: 0.6, flick: true, jit: 0.08,
    })
    smoke(4)
  } else if (s.type === 'botan') {
    sphere(fx, x, y, Rr, {
      n: Math.round(104 * m), k: 2.4, g: 44, life: [1.5, 1.85], size: 1.6, b0: dim,
      cols: [['lit', 0], ['lit', 0.36], ['paper', 0.6], ['white', 0.82]], fo: 0.8, flick: true, jit: 0.05,
    })
    sphere(fx, x, y, Rr * 0.42, {
      n: Math.round(22 * m), k: 2.8, g: 40, life: [1.1, 1.35], size: 1.4, b0: 0.85 * dim,
      cols: [['paper', 0], ['white', 0.6]], fo: 0.65, flick: true, jit: 0.07,
    })
    smoke(3)
  } else if (s.type === 'yanagi') {
    sphere(fx, x, y, Rr, {
      n: Math.round(56 * m), k: 1.15, g: 52, life: [4.2, 4.8].map(v => v * (s.small ? 0.7 : 1)), size: 1.15, b0: 0.9 * dim,
      cols: [['pale', 0], ['lit', 0.1], ['gold', 0.45]], fo: 0.66, flick: false,
      tl: s.small ? 1.8 : 2.8, te: 2, tb: 0.5, tc: ['pale', 'gold'], tw: 1.0, sag: 5, sparkle: 0.04, jit: 0.08,
    })
    smoke(4)
  } else if (s.type === 'kamuro') {
    sphere(fx, x, y, Rr, {
      n: Math.round(118 * m), k: 1.7, g: 50, life: [2.6, 3.1], size: 1.1, b0: 0.9 * dim,
      cols: [['lit', 0], ['gold', 0.45]], fo: 0.72, flick: true, twinkle: 24,
      tl: 1.4, te: 2, tb: 0.42, tc: ['lit', 'gold'], tw: 1.0, sag: 18, glit: 0.45, gc: 'pale', jit: 0.07,
    })
    smoke(4)
  } else if (s.type === 'ring') {
    sphere(fx, x, y, Rr * 0.62, {
      n: Math.round(48 * m), k: 2.2, g: 48, life: [1.4, 1.7], size: 1.25, b0: dim,
      cols: [['paper', 0], ['lit', 0.55]], fo: 0.7, flick: true, tl: 0.38, te: 1, tb: 0.42, tc: ['paper', 'pale'], tw: 1.0, jit: 0.06,
    })
    const n = Math.round(42 * m)
    const tilt = 1.05
    const rot = 0.35 + R() * 0.3
    const ro = { k: 2.3, g: 42, life: [1.55, 1.8], size: 1.8, b0: dim, cols: [['red', 0]], fo: 0.72, flick: true }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const dx = Math.cos(a)
      const dy = Math.sin(a) * Math.cos(tilt)
      const rx = dx * Math.cos(rot) - dy * Math.sin(rot)
      const ry = dx * Math.sin(rot) + dy * Math.cos(rot)
      const sp = Rr * 2.3 * (1 + (R() - 0.5) * 0.03)
      star(fx, x, y, rx * sp, ry * sp, ro, Math.sin(a))
    }
    smoke(3)
  } else if (s.type === 'senrin') {
    const nS = 12
    const rot = R() * Math.PI * 2
    for (let i = 0; i < nS; i++) {
      const a = rot + (i / nS) * Math.PI * 2 + (R() - 0.5) * 0.3
      const sp = Rr * 2.2 * (0.75 + R() * 0.45)
      star(fx, x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.9, {
        k: 2.2, g: 30, life: [0.3, 0.82], size: 1.1, cols: [['pale', 0]], fo: 0.97,
        tl: 0.26, te: 1, tb: 0.5, tc: ['pale', 'lit'], tw: 0.9, pop: { R: 18 + R() * 9, alt: i % 3 },
      }, 0.6)
    }
    smoke(3)
  }
}

function mini(fx, st) {
  fx.flashes.push({ x: st.x, y: st.y, age: 0, I: 0.28, c: 'paper', rad: 100, mini: true })
  fx.cores.push({ x: st.x, y: st.y, age: 0, life: 0.07, size: 8 })
  const pal = [[['lit', 0], ['gold', 0.55]], [['paper', 0], ['pale', 0.5]], [['pale', 0], ['lit', 0.5]]][st.pop.alt]
  sphere(fx, st.x, st.y, st.pop.R, { n: 20, k: 3.0, g: 36, life: [0.65, 0.95], size: 1.1, cols: pal, fo: 0.45, flick: true, crackle: 1, jit: 0.12 })
}

function launch(fx, e) {
  const R = fx.rnd
  fx.shells.push({
    ...e,
    x: e.x0, y: 432, y0: 432, age: 0,
    wa: 2 + R() * 2.2, wf: 13 + R() * 8, wp: R() * 6.28,
    tl: 0.3, te: 1, tb: 0.6, tc: ['pale', 'lit'], tw2: 1.35, sag: 0, tr: [], ti: 0,
  })
}

/** One fixed step of `dt` seconds. */
export function stepSky(fx, dt) {
  const R = fx.rnd
  fx.t += dt
  fx.step++
  const t = fx.t
  const step = fx.step
  while (fx.qi < fx.queue.length && fx.queue[fx.qi].t <= t) launch(fx, fx.queue[fx.qi++])
  if (fx.idleIdx < fx.idleMax && t >= fx.idleNext) { launch(fx, idleShell(fx.idleIdx++, fx.spread)); fx.idleNext += 3.6 }

  // shells climbing, a wobble and a sparkle trail
  let w = 0
  for (let i = 0; i < fx.shells.length; i++) {
    const s = fx.shells[i]
    s.age += dt
    const u = Math.min(1, s.age / s.T)
    s.x = s.x0 + (s.x1 - s.x0) * u + Math.sin(s.age * s.wf + s.wp) * s.wa * (1 - u)
    s.y = s.y0 + (s.y1 - s.y0) * (1 - (1 - u) * (1 - u))
    s.tr.push(s.x, s.y, t)
    const k = u < 0.85 ? 2 : 1
    for (let j = 0; j < k; j++) {
      fx.sparks.push({
        id: fx.nid++, x: s.x + (R() - 0.5) * 2, y: s.y + 2, vx: (R() - 0.5) * 26, vy: 8 + R() * 36,
        age: 0, life: 0.26 + R() * 0.4, dl: 0, k: 2.4, g: 62, c: R() < 0.5 ? 'pale' : 'lit', s: 1.1, fl: true,
      })
    }
    if (u >= 1) { burst(fx, s); fx.ghosts.push(s) } else fx.shells[w++] = s
  }
  fx.shells.length = w

  // stars: drag, gravity, trails, glitter
  w = 0
  for (let i = 0; i < fx.stars.length; i++) {
    const st = fx.stars[i]
    st.age += dt
    if (st.age >= st.life) {
      if (st.pop) mini(fx, st)
      if (st.crackle && R() < 0.8) {
        const c = R() < 0.45 ? 2 : 1
        for (let j = 0; j < c; j++) fx.crackles.push({ x: st.x + (R() - 0.5) * 8, y: st.y + (R() - 0.5) * 8, dl: R() * 0.24, dur: 0.035 + R() * 0.05, age: 0 })
      }
      if (st.tl) fx.ghosts.push(st)
      continue
    }
    const f = Math.exp(-st.k * dt)
    st.vx *= f
    st.vy = st.vy * f + st.g * dt
    st.x += st.vx * dt
    st.y += st.vy * dt
    if (st.tl && step % st.te === 0) st.tr.push(st.x, st.y, t)
    if (st.sparkle && R() < st.sparkle) {
      fx.sparks.push({
        id: fx.nid++, x: st.x, y: st.y, vx: (R() - 0.5) * 18, vy: (R() - 0.5) * 18 + 8,
        age: 0, life: 0.22 + R() * 0.26, dl: 0, k: 3, g: 40, c: 'pale', s: 1.0, fl: true,
      })
    }
    if (st.glit && R() < st.glit) {
      fx.sparks.push({
        id: fx.nid++, x: st.x, y: st.y, vx: st.vx * 0.12 + (R() - 0.5) * 10, vy: st.vy * 0.12 + R() * 8,
        age: 0, life: 0.3 + R() * 0.3, dl: 0.1 + R() * 0.26, k: 3, g: 26, c: st.gc, s: 1.4, glit: true,
      })
    }
    fx.stars[w++] = st
  }
  fx.stars.length = w
  if (fx.pend.length) { for (const st of fx.pend) fx.stars.push(st); fx.pend.length = 0 }

  // trails that outlive their star
  w = 0
  for (let i = 0; i < fx.ghosts.length; i++) {
    const o = fx.ghosts[i]
    const tr = o.tr
    if (tr.length && t - tr[tr.length - 1] <= o.tl) fx.ghosts[w++] = o
  }
  fx.ghosts.length = w

  // sparks
  w = 0
  for (let i = 0; i < fx.sparks.length; i++) {
    const p = fx.sparks[i]
    p.age += dt
    if (p.age >= p.life) continue
    const f = Math.exp(-p.k * dt)
    p.vx *= f
    p.vy = p.vy * f + p.g * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    fx.sparks[w++] = p
  }
  fx.sparks.length = w

  const age = (arr, keep) => {
    let n = 0
    for (let i = 0; i < arr.length; i++) { const o = arr[i]; o.age += dt; if (keep(o)) arr[n++] = o }
    arr.length = n
  }
  age(fx.crackles, o => o.age < o.dl + o.dur)
  age(fx.cores, o => o.age < o.life)
  age(fx.flashes, o => o.age < 2.4)
  age(fx.smoke, o => o.age < o.life)
}

function starB(st, step) {
  const u = st.age / st.life
  let b = st.b0
  if (st.age < 0.12) { const q = st.age / 0.12; b *= q * q }
  if (st.tw) b *= 0.7 + 0.3 * Math.sin(st.age * st.tw + st.id * 1.7)
  if (u > st.fo) {
    const v = (u - st.fo) / (1 - st.fo)
    b *= 1 - v * v
    if (st.flick && hr(st.id, step) < v * 0.8) b *= 0.12
  }
  return b
}

function starCol(st) {
  const c = st.cols
  const u = st.age / st.life
  if (c.length === 1) return [c[0][0], c[0][0], 0]
  for (let i = c.length - 1; i > 0; i--) {
    if (u >= c[i][1]) return [c[i][0], c[i][0], 0]
    if (u >= c[i - 1][1]) {
      const span = c[i][1] - c[i - 1][1]
      return [c[i - 1][0], c[i][0], span > 0 ? (u - c[i - 1][1]) / span : 1]
    }
  }
  return [c[0][0], c[0][0], 0]
}

/** The trails fade: the last frame wiped by `a` (the CSS night shows through). */
export function fadeSky(c, a) {
  c.save()
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.globalCompositeOperation = 'destination-out'
  c.globalAlpha = 1
  c.fillStyle = `rgba(0,0,0,${a.toFixed(4)})`
  c.fillRect(0, 0, c.canvas.width, c.canvas.height)
  c.restore()
}

/** The sparks, the stars, the cores and the crackle, additive, in `m` (the board→canvas transform). */
export function drawSparks(fx, c, S, m) {
  const step = fx.step
  c.setTransform(m[0], 0, 0, m[0], m[1], m[2])
  c.globalCompositeOperation = 'lighter'
  for (const k of fx.cores) {
    const u = k.age / k.life
    const sz = k.size * (1 + u * 0.8)
    c.globalAlpha = (1 - u) * (1 - u)
    c.drawImage(S.white, k.x - sz / 2, k.y - sz / 2, sz, sz)
  }
  for (const st of fx.stars) {
    const b = starB(st, step)
    if (b < 0.015) continue
    const sz = st.s * 5.6
    const cc = starCol(st)
    if (cc[2] < 1) { c.globalAlpha = b * (1 - cc[2]); c.drawImage(S[cc[0]], st.x - sz / 2, st.y - sz / 2, sz, sz) }
    if (cc[2] > 0) { c.globalAlpha = b * cc[2]; c.drawImage(S[cc[1]], st.x - sz / 2, st.y - sz / 2, sz, sz) }
  }
  for (const s of fx.shells) {
    c.globalAlpha = 0.85 + 0.15 * hr(s.wp * 100, step)
    c.drawImage(S.pale, s.x - 3, s.y - 3, 6, 6)
  }
  let cur = ''
  for (const p of fx.sparks) {
    const a = p.age - p.dl
    if (a < 0) continue
    const span = p.life - p.dl
    let b = 1 - a / span
    if (p.glit) {
      b = a < 0.05 ? 1 : b * 0.75
      c.globalAlpha = b
      c.drawImage(S[p.c], p.x - 2.5, p.y - 2.5, 5, 5)
      continue
    }
    if (p.fl && hr(p.id, step) < 0.3) b *= 0.25
    if (b < 0.02) continue
    const fs = RGB[p.c]
    if (fs !== cur) { c.fillStyle = fs; cur = fs }
    c.globalAlpha = b
    c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s)
  }
  for (const k of fx.crackles) {
    const a = k.age - k.dl
    if (a < 0 || a > k.dur) continue
    c.globalAlpha = 1
    c.drawImage(S.white, k.x - 3.5, k.y - 3.5, 7, 7)
  }
  c.globalAlpha = 1
}

const lightI = f => f.I * (0.72 * Math.exp(-f.age / 0.1) + 0.28 * Math.exp(-f.age / 0.85))

/**
 * The light: smoke lit by the bursts, the sky's glow, the trails (on
 * `g`, cleared each frame), and the roof's edge catching the three
 * brightest (on `rim`, in the station's own px: `roof` = { edge, fill,
 * w, x(boardX) }). `m` the board→canvas transform [scale, dx, dy].
 */
export function drawLight(fx, g, m, rim, roof, bk) {
  const C = COL
  const t = fx.t
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalCompositeOperation = 'source-over'
  g.globalAlpha = 1
  g.clearRect(0, 0, g.canvas.width, g.canvas.height)
  g.setTransform(m[0], 0, 0, m[0], m[1], m[2])

  // the flashes still lighting the sky, strongest first; a small pop counts only while bright
  const lit = []
  for (const f of fx.flashes) {
    const I = lightI(f)
    if (I >= (f.mini ? 0.03 : 0.01)) lit.push({ I, f })
  }
  lit.sort((a, b) => b.I - a.I)

  // smoke, lit by the bursts around it
  for (const s of fx.smoke) {
    const u = s.age / s.life
    const env = Math.min(1, s.age / 0.7) * (1 - u)
    const r = s.r0 + (s.r1 - s.r0) * (1 - (1 - u) * (1 - u))
    const mx = s.x + s.age * 5
    const my = s.y - s.age * 2.5
    let L = 0
    for (const o of lit) {
      if (o.I < 0.02) continue
      L += o.I * Math.max(0, 1 - Math.hypot(mx - o.f.x, my - o.f.y) / 300)
    }
    L = Math.min(1, L)
    const a = s.a * env * (0.35 + 1.7 * L)
    if (a < 0.004) continue
    const col = [Math.round(118 + 114 * L), Math.round(110 + 96 * L), Math.round(140 + 10 * L)]
    const gr = g.createRadialGradient(mx, my, 0, mx, my, r)
    gr.addColorStop(0, rgba(col, a))
    gr.addColorStop(0.55, rgba(col, a * 0.45))
    gr.addColorStop(1, rgba(col, 0))
    g.fillStyle = gr
    g.fillRect(mx - r, my - r, r * 2, r * 2)
  }

  // the sky lit by each burst: ten glows at most
  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < lit.length && i < 10; i++) {
    const I = lit[i].I
    const f = lit[i].f
    const c = C[f.c]
    const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rad)
    gr.addColorStop(0, rgba(c, 0.28 * I))
    gr.addColorStop(0.3, rgba(c, 0.1 * I))
    gr.addColorStop(1, rgba(c, 0))
    g.fillStyle = gr
    g.fillRect(f.x - f.rad, f.y - f.rad, f.rad * 2, f.rad * 2)
  }

  // trails, bucketed by colour and brightness
  for (const key in bk) for (const arr of bk[key]) arr.length = 0
  const add = (key, bi, x1, y1, x2, y2) => {
    let b = bk[key]
    if (!b) { b = bk[key] = []; for (let i = 0; i < 16; i++) b.push([]) }
    b[bi].push(x1, y1, x2, y2)
  }
  const trail = (o, alive) => {
    const tr = o.tr
    if (!tr) return
    while (o.ti < tr.length && t - tr[o.ti + 2] > o.tl) o.ti += 3
    if (o.ti > 150) { tr.splice(0, o.ti); o.ti = 0 }
    let px = 0
    let py = 0
    let has = false
    const wkey = o.tw2 > 1.2 ? 'W' : ''
    for (let j = o.ti; j < tr.length; j += 3) {
      const ag = t - tr[j + 2]
      const u = ag / o.tl
      const x = tr[j]
      const y = tr[j + 1] + o.sag * ag * ag
      if (has) {
        const a = o.tb * Math.pow(1 - u, 1.5)
        const bi = Math.min(15, (a * 16) | 0)
        if (bi > 0) add((u < 0.3 ? o.tc[0] : o.tc[1]) + wkey, bi, px, py, x, y)
      }
      px = x
      py = y
      has = true
    }
    if (alive && has) {
      const bi = Math.min(15, (o.tb * 16) | 0)
      if (bi > 0) add(o.tc[0] + wkey, bi, px, py, o.x, o.y)
    }
  }
  for (const s of fx.shells) trail(s, true)
  for (const st of fx.stars) if (st.tr) trail(st, true)
  for (const o of fx.ghosts) trail(o, false)
  g.lineCap = 'round'
  for (const key in bk) {
    const wide = key.endsWith('W')
    const col = C[wide ? key.slice(0, -1) : key]
    g.lineWidth = wide ? 1.3 : 0.95
    const b = bk[key]
    for (let bi = 1; bi < 16; bi++) {
      const arr = b[bi]
      if (!arr.length) continue
      g.beginPath()
      for (let i = 0; i < arr.length; i += 4) { g.moveTo(arr[i], arr[i + 1]); g.lineTo(arr[i + 2], arr[i + 3]) }
      g.strokeStyle = rgba(col, (bi + 0.5) / 16)
      g.stroke()
    }
  }

  // the roof's top edge catching the main bursts, the three brightest at a time
  if (rim && roof) {
    rim.setTransform(roof.dpr, 0, 0, roof.dpr, 0, 0)
    rim.globalCompositeOperation = 'source-over'
    rim.globalAlpha = 1
    rim.clearRect(0, 0, roof.w, 160)
    rim.globalCompositeOperation = 'lighter'
    rim.lineJoin = 'round'
    let lim = 3
    for (const o of lit) {
      if (o.f.mini) continue
      const f = o.f
      const I = Math.min(1, o.I * 1.1)
      if (I < 0.05) break
      if (lim-- <= 0) break
      const c = C[f.c === 'paper' ? 'pale' : f.c]
      const fx0 = roof.x(f.x)
      const gr = rim.createLinearGradient(fx0 - 190, 0, fx0 + 190, 0)
      gr.addColorStop(0, rgba(c, 0))
      gr.addColorStop(0.5, rgba(c, I))
      gr.addColorStop(1, rgba(c, 0))
      rim.strokeStyle = gr
      rim.globalAlpha = 0.75
      rim.lineWidth = 1.1
      rim.stroke(roof.edge)
      rim.globalAlpha = 0.16
      rim.lineWidth = 4
      rim.stroke(roof.edge)
      rim.globalAlpha = 0.06
      rim.fillStyle = gr
      rim.fill(roof.fill)
      const wg = rim.createRadialGradient(fx0, 40, 0, fx0, 40, 230)
      wg.addColorStop(0, rgba(c, 0.07 * I))
      wg.addColorStop(1, rgba(c, 0))
      rim.globalAlpha = 1
      rim.fillStyle = wg
      rim.fillRect(0, 80, roof.w, 80)
    }
    rim.globalAlpha = 1
  }
}
