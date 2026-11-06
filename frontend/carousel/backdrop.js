// ── 下地 — what a reading challenge's words stand on (plan 309) ──────
// The hour's print under every frame of a reading challenge
// (challenge.js): washed with the app's paper under the scroll, darkened
// where the words go under the read-along, or a photo of the maker's own
// in its place (plan 276). Its own module since plan 309, so the
// sceneries and their dials are drawn here and nowhere else; each
// segment says which moment it draws (`plan`, `tl`, `t`, `seg`) and
// whether the hook stands as the cover (`cover`), and is told how much
// of the wash lies over the print (`laid`, 0 to 1), so what is written
// over it can wait for the paper.
//
// The print is drawn once and kept (rastersOf): it stands still under
// the text, so a frame lays the same picture, raised or carried along,
// and draws nothing of the print's own. What moves is said by the
// moment alone (trainRun, liftAt, panAt, washAt), so a second always
// draws the same frame. Each dial stands at what it was before plan 309
// until the owner has seen it drawn (tune.js, BEFORE_309), and there the
// frame is the one it was, pixel for pixel.
import { FORMATS, alpha, palette } from './draw.js'
import { MARIA, drawPrint } from './app.js'
import { coverOn } from './cover.js'
import { sceneryOf } from './sceneries.js'
import { tuned } from './tune.js'

const FMT = FORMATS.story
const PAPER = palette('paper')

/** A canvas to draw on away from the frame: none where there is no
 *  canvas at all (the tests). */
export const canvasOf = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h)
  : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : null)

const clamp = x => Math.min(1, Math.max(0, x))
const ease = x => 1 - (1 - clamp(x)) ** 3
const smooth = x => { const k = clamp(x); return k * k * (3 - 2 * k) }
const before = seg => seg == null || seg === 'hook'

// ── What moves, said by the moment alone ──
// The train parked where the still print has it, halfway across.
const PARKED = 0.45
/** Where the train's run has brought it, 0 to 1 (drawPrint's `run`):
 *  parked halfway, the look before plan 309, unless it is the reading's
 *  clock (`on`, challenge.train): halfway still under the hook, crossing
 *  as the text is read (`p`, the share of the reading gone), and out of
 *  the print once it is read. */
export function trainRun(seg, p, on = 1) {
  if (!(on > 0) || before(seg)) return PARKED
  return seg === 'reading' ? PARKED + (1 - PARKED) * clamp(p) : 1
}

// The print rises over the reading's first moments, alongside the text coming in.
const RISE = 1.6
/** How far the print is raised toward its foot, 0 to 1 (`on`,
 *  challenge.lift): not at all under the hook, so Fuji stands below the
 *  cover; rising over the reading's first 1.6 s (`into`, seconds into
 *  the segment), and raised from then on. */
export function liftAt(seg, into, on = 1) {
  if (!(on > 0) || before(seg)) return 0
  return on * (seg === 'reading' ? smooth(into / RISE) : 1)
}

/** The long view's window, its left edge on the print in pixels: `from`
 *  (Fuji's summit in its middle) under the hook, carried toward the
 *  season's tree as the text is read (`p`), `pan` of the way to 85% of
 *  what lies past it (`span`, the print's width less the frame's), and
 *  held there for the question and the way to the app. Both ends fall
 *  on whole pixels, so the held frame is laid unblurred. */
export function panAt(seg, p, { pan = 1, from = 0, span = 0 } = {}) {
  const to = Math.round(from + (span - from) * 0.85 * pan)
  if (before(seg)) return from
  return from + (to - from) * (seg === 'reading' ? smooth(p) : 1)
}

// How much of the paper lies over the print at each hour: the picture
// is still there, the ink reads over all of it, and the page stays
// paper, never the grey a dark sky washed thin would leave. The night's
// print is brightened first (LIFT, plan 261): washed as heavily as dusk
// its dark sky left a blank page; brightened, the moonlit scene stands
// under a lighter wash, the page a pale moonlit blue (the owner's pick).
const WASH = { dawn: 0.72, day: 0.72, dusk: 0.82, night: 0.6 }
const LIFT = 3
// The paper comes in over the print this long once a cover is cut away,
// and goes back to the hour's whole wash this long into the question.
const LAY = 0.7
const BACK = 0.6
/** The paper over the print at a moment: `alpha`, the wash laid (the
 *  hour's, times the maker's `wash`), and `laid`, the share of it come
 *  in since the cover (0 under the cover, then 1). Under the reading the
 *  wash is lighter (`read`, challenge.read), coming in from the hook's,
 *  and back to the hour's whole wash early in the question. With no
 *  cover and `read` at 1, the look before plan 309, it is the hour's
 *  wash at every moment. */
export function washAt({ hour = 'day', wash = 1, read = 1, cover = false, seg = null, into = 0 } = {}) {
  const base = (WASH[hour] ?? WASH.day) * wash
  if (seg === 'hook' && cover) return { alpha: 0, laid: 0 }
  if (seg === 'reading') {
    const k = ease(into / LAY)
    // From the hook's wash (none under a cover) to the reading's.
    const from = cover ? 0 : 1
    return { alpha: Math.min(0.97, base * (from + (read - from) * k)), laid: cover ? k : 1 }
  }
  if (seg === 'question') return { alpha: Math.min(0.97, base * (read + (1 - read) * ease(into / BACK))), laid: 1 }
  return { alpha: Math.min(0.97, base), laid: 1 }
}

/** How much of the sun or moon shows, 0 to 1: always where the print is
 *  raised (`lifted`), clear above the reading's chip; else under the
 *  hook alone, going as the paper comes in, from under the chip. */
export function discAt(seg, into, lifted = false) {
  if (lifted || before(seg)) return 1
  return seg === 'reading' ? 1 - ease(into / LAY) : 0
}

// ── The print, drawn once and kept ──
// The rows the train runs in, in print units: its ink lies in 537.75 to
// 557.5 on every phone print and 699.75 to 719.5 on every desk print
// (measured on all 22 of each), kept with room either side. A scenery of
// the carousel's own says its own (meta.frame.trainBand: null, none).
const TRAIN_BANDS = { phone: [532, 564], desk: [694, 726] }
const trainBandOf = (P, view) => {
  if (view.source !== 'carousel') return TRAIN_BANDS[view.device] ?? [0, P.scene.h]
  return P.frame.trainBand === null ? null : (P.frame.trainBand ?? [0, P.scene.h])
}
// The sun or the moon, at the print's place for it: high over the
// light's road, beside the masthead and above the cover under the hook,
// clear above the masthead and the reading's chip once the print is raised.
const DISC = { cx: 195, cy: 150, r: 24 }
const discOf = (P, view) => (view.source === 'carousel' && P.frame.disc ? { cx: P.frame.cx, cy: P.frame.cy, r: P.frame.disc } : DISC)
// The long view's summit, in the desk print's units (today-print's
// layouts.py, DESK.fuji): the window opens with it in its middle.
const WIDE_SUMMIT = 650

// The night lit on a curve per channel (challenge.night, `n`): at 0 the
// print three times as bright (brightness(3), the look before plan 309,
// which sends every channel over 85 to white); toward 1 a curve that
// brings the night sky (14, 25, 52) to the same (42, 75, 156) and burns
// out none of its lights: the moon keeps its face, the blossom its pink.
const GAMMA = [0.62, 0.53, 0.31]
const tables = new Map()
function moonTable(n) {
  if (!tables.has(n)) tables.set(n, GAMMA.map(g => Uint8ClampedArray.from({ length: 256 }, (_, v) => Math.round((1 - n) * Math.min(255, LIFT * v) + n * 255 * (v / 255) ** g))))
  return tables.get(n)
}
// A canvas painted by `draw`, lit for the night (`lit`: none, or the
// dial's value): the curve read back and written once, or, at 0 and
// wherever the canvas cannot be read back, brightness(3) as before.
function paint(c, draw, lit) {
  const x = c.getContext('2d')
  if (lit == null) {
    draw(x)
    return
  }
  if (lit > 0) {
    draw(x)
    try {
      const img = x.getImageData(0, 0, c.width, c.height)
      const [r, g, b] = moonTable(lit)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        d[i] = r[d[i]]
        d[i + 1] = g[d[i + 1]]
        d[i + 2] = b[d[i + 2]]
      }
      x.putImageData(img, 0, 0)
      return
    } catch {
      x.clearRect(0, 0, c.width, c.height)
    }
  }
  x.filter = `brightness(${LIFT})`
  draw(x)
  x.filter = 'none'
}

const UNDER = { under: true }
const OVER = { over: true }
// Each print's canvases, by the look they were drawn for: its night, kept
// tall to be raised, split at the train, its fireworks apart. A video
// asks for one look throughout (two, a night under a cover); the two
// last asked are kept, a print's canvases with the print.
const KEPT = 2
const kept = new WeakMap()
function rastersOf(P, look) {
  const { W, H, u, lit, tall, split, bursts, view } = look
  let looks = kept.get(P)
  if (!looks) kept.set(P, (looks = new Map()))
  const key = `${lit ?? 'raw'}|${tall}|${split}|${bursts}`
  if (looks.has(key)) {
    // The last asked, kept last.
    const R = looks.get(key)
    looks.delete(key)
    looks.set(key, R)
  } else {
    // With its fireworks apart, the print is drawn with the bursts gone from its sky.
    const src = bursts ? { ...P, img: { ...P.img, back: P.img.backBare } } : P
    const layer = parts => {
      const c = canvasOf(W, H)
      if (c) paint(c, x => drawPrint(x, src, 0, 0, u, { W, H, parts }), lit)
      return c
    }
    let R = null
    if (!split) {
      // The whole print, its train parked: the still print as drawPrint has always drawn it.
      const whole = layer(undefined)
      if (whole) R = { whole }
    } else {
      const under = layer(UNDER)
      const over = layer(OVER)
      if (under && over) R = { under, over, ...stripOf(P, view, u, lit) }
    }
    looks.set(key, R)
    while (looks.size > KEPT) looks.delete(looks.keys().next().value)
  }
  return looks.get(key)
}
// The train's rows alone, at twice the print's width (its image waits a
// print's width off the left edge), to be laid where its run brings it.
// Drawn a fraction of a pixel along (`phase`), so parked halfway, as on
// the cover, it is laid on whole pixels, as sharp as the print drew it.
function stripOf(P, view, u, lit) {
  const band = trainBandOf(P, view)
  if (!band) return { strip: null, top: 0, phase: 0 }
  const w = P.scene.w * u
  const top = Math.floor(band[0] * u)
  const parked = -w + w * (P.scene.train.run / 100) * PARKED
  const phase = parked - Math.floor(parked)
  const c = canvasOf(Math.ceil(2 * w + phase), Math.ceil(band[1] * u) - top)
  if (c) paint(c, x => x.drawImage(P.img.train, phase, -top, 2 * w, P.scene.h * u), lit)
  return { strip: c, top, phase }
}
// The fireworks in the sky, apart, behind whatever the front layer
// stands in front of them, to be laid over the paper: drawn once, unlit
// (their own colours, whatever the night does to the print).
const fireworks = new WeakMap()
function burstsOf(P, W, H, u) {
  const key = `${W}x${H}`
  if (fireworks.get(P)?.key !== key) {
    const c = canvasOf(W, H)
    if (c) {
      const x = c.getContext('2d')
      const w = P.scene.w * u
      const h = P.scene.h * u
      x.drawImage(P.img.bursts, 0, 0, w, h)
      x.globalCompositeOperation = 'destination-out'
      x.drawImage(P.img.front, 0, 0, w, h)
    }
    fireworks.set(P, { key, c })
  }
  return fireworks.get(P).c
}
// The sun or the moon as the print's dial draws it (app.js printDial),
// drawn once: its glow (softer at night), the disc in its two inks, the
// moon's seas. Its middle keeps the place's fraction of a pixel, so a
// whole-pixel move lays it unblurred.
const discs = new WeakMap()
function discSprite(P, D, u) {
  if (discs.has(P)) return discs.get(P)
  const look = P.look.disc
  const r = D.r * u
  const glow = 2.2 * r
  const half = Math.ceil(glow) + 2
  const c = canvasOf(2 * half, 2 * half)
  let out = null
  if (c) {
    const x = c.getContext('2d')
    const px = D.cx * u
    const py = D.cy * u
    const cx = half + px - Math.floor(px)
    const cy = half + py - Math.floor(py)
    const op = look.glowOp * (P.hour === 'night' ? 0.6 : 1)
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, glow)
    g.addColorStop(r / glow, alpha(look.glow, op))
    g.addColorStop((r + 0.34 * (glow - r)) / glow, alpha(look.glow, op * 0.35))
    g.addColorStop(1, alpha(look.glow, 0))
    x.fillStyle = g
    x.beginPath()
    x.arc(cx, cy, glow, 0, Math.PI * 2)
    x.fill()
    const f = x.createRadialGradient(cx - 0.2 * r, cy - 0.28 * r, 0, cx - 0.2 * r, cy - 0.28 * r, 0.72 * 2 * r)
    f.addColorStop(0, look.fill[0])
    f.addColorStop(1, look.fill[1])
    x.fillStyle = f
    x.beginPath()
    x.arc(cx, cy, r, 0, Math.PI * 2)
    x.fill()
    if (look.maria) {
      x.save()
      x.beginPath()
      x.arc(cx, cy, r, 0, Math.PI * 2)
      x.clip()
      x.globalAlpha = 0.2
      x.filter = `blur(${(0.03 * r).toFixed(2)}px)`
      x.fillStyle = '#c9b68a'
      for (const [mx, my, ms, mq] of MARIA) {
        x.beginPath()
        x.ellipse(cx + mx * r, cy + my * r, ms * r, ms * r * mq, 0, 0, Math.PI * 2)
        x.fill()
      }
      x.restore()
    }
    out = { c, x: Math.floor(px) - half, y: Math.floor(py) - half }
  }
  discs.set(P, out)
  return out
}

/** The dials as a plan sets them: each at its default where there is no
 *  plan, as the look the studio opens on. */
const dialsOf = plan => {
  const d = key => tuned(plan?.tune, `challenge.${key}`)
  return { read: d('read'), lift: d('lift'), disc: d('disc'), night: d('night'), train: d('train'), bursts: d('bursts'), pan: d('pan') }
}

// The hour's print under it: darkened where the words go (`dark`), or
// washed whole with the app's paper, the words in ink over it.
export function backdrop(ctx, P, T, { dark = 0.5, hour = 'day', wash = 1, plan = null, tl = null, t = 0, seg = null, cover = false } = {}) {
  if (P?.photo) {
    photoBackdrop(ctx, P, dark)
    return { laid: 1 }
  }
  const paper = T.ground === 'paper'
  const dial = dialsOf(plan)
  // The moment: how far into its own part, and how much of the reading is gone.
  const own = tl?.segs.find(s => s.key === seg)
  const rd = tl?.segs.find(s => s.key === 'reading')
  const into = own ? t - own.start : 0
  const p = rd ? clamp((t - rd.start) / rd.dur) : 0
  // A video that opens on the cover lays its paper as the text comes in.
  const opened = cover || (plan ? coverOn(plan) : false)
  const { alpha: washed, laid } = washAt({ hour, wash, read: dial.read, cover: opened, seg, into })
  // The night's print is lit for the paper laid over it: under a cover,
  // where none is, it stands as it is, and its light comes in with the paper.
  const lit = paper && hour === 'night' ? dial.night : null
  const at = P ? printAt(ctx, P, { lit, opened, laid, dial, seg, into, p }) : null
  if (!P) { ctx.fillStyle = paper ? PAPER.card : '#17151a'; ctx.fillRect(0, 0, FMT.w, FMT.h) }
  if (paper) {
    if (washed > 0) {
      ctx.fillStyle = alpha(PAPER.bg, washed)
      ctx.fillRect(0, 0, FMT.w, FMT.h)
    }
  } else if (laid > 0) {
    // The sky darkened where the words go, so they read at every hour.
    const d = dark * laid
    const g = ctx.createLinearGradient(0, 0, 0, FMT.h * 0.72)
    g.addColorStop(0, `rgba(12,10,22,${d})`)
    g.addColorStop(0.7, `rgba(12,10,22,${d * 0.6})`)
    g.addColorStop(1, 'rgba(12,10,22,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, FMT.w, FMT.h * 0.72)
  }
  // The fireworks over it all, in their own colours.
  if (at?.bursts) ctx.drawImage(at.bursts, at.x, at.y)
  return { laid }
}

// The print laid for this moment: raised, travelled, its sun or moon and
// its train between what lies under and over them. Gives where it was
// laid, and its fireworks, to be laid there over the paper.
function printAt(ctx, P, { lit, opened, laid, dial, seg, into, p }) {
  const view = sceneryOf(P.scenery)
  // The long view stands at the frame's height, wider than it; the rest across its width.
  const wide = view.pan
  const u = wide ? FMT.h / P.scene.h : FMT.w / P.scene.w
  const w = P.scene.w * u
  const h = P.scene.h * u
  // Kept tall only to be raised (drawn taller, a few edge pixels fall a
  // level or two apart: unraised, the frame stays the one it was).
  const tall = !wide && view.lift && dial.lift > 0
  const W = wide ? Math.ceil(w) : FMT.w
  const H = tall ? Math.ceil(h) : FMT.h
  const disc = dial.disc > 0 && view.disc && !!P.look?.disc && !/hanabi/.test(P.name)
  const split = dial.train > 0 || disc
  const bursts = dial.bursts > 0 && !!P.img.bursts && !!P.img.backBare
  // Raised by whole pixels, its foot at the frame's.
  const rise = tall ? liftAt(seg, into, dial.lift) : 0
  const y = rise > 0 ? (FMT.h - Math.floor(h)) * rise : 0
  // The long view's window opens on Fuji's summit, in its middle.
  const summit = Math.min(W - FMT.w, Math.max(0, Math.round(WIDE_SUMMIT * u - FMT.w / 2)))
  const x = wide ? -panAt(seg, p, { pan: dial.pan, from: summit, span: W - FMT.w }) : 0
  const run = trainRun(seg, p, dial.train)
  // Under a cover the night's print stands unlit, and its light comes in with the paper.
  const looks = lit != null && opened ? [[null, 1], [lit, laid]] : [[lit, 1]]
  const Rs = looks.map(([l]) => rastersOf(P, { W, H, u, lit: l, tall, split, bursts, view }))
  if (Rs.some(R => !R)) {
    // No canvas to keep it on: drawn as it is, every frame.
    drawPrint(ctx, P, x, y, u, { W: FMT.w, H: FMT.h, run })
    return { bursts: null, x, y }
  }
  // What a whole look laid over it hides is not laid.
  const first = Math.max(0, looks.findLastIndex(([, a]) => a >= 1))
  looks.forEach(([, a], i) => {
    if (a <= 0 || i < first) return
    const R = Rs[i]
    if (a < 1) {
      ctx.save()
      ctx.globalAlpha *= a
    }
    if (!split) ctx.drawImage(R.whole, x, y)
    else {
      ctx.drawImage(R.under, x, y)
      const shown = disc ? discAt(seg, into, tall) : 0
      const s = shown > 0 ? discSprite(P, discOf(P, view), u) : null
      if (s) {
        ctx.save()
        ctx.globalAlpha *= shown
        ctx.drawImage(s.c, x + s.x, y + s.y)
        ctx.restore()
      }
      if (R.strip) ctx.drawImage(R.strip, x + (-w + w * (P.scene.train.run / 100) * run - R.phase), y + R.top)
      ctx.drawImage(R.over, x, y)
    }
    if (a < 1) ctx.restore()
  })
  return { bursts: bursts ? burstsOf(P, W, H, u) : null, x, y }
}

// The photo laid to cover the frame, its middle kept, made once: dark,
// dimmed whole and darker still where the words go; blur, softened and
// dimmed so the words read over any of it; paper, washed as the print is.
const photos = new WeakMap()
function photoBackdrop(ctx, P, dark) {
  if (!photos.has(P)) {
    const c = canvasOf(FMT.w, FMT.h)
    if (c) {
      const x = c.getContext('2d')
      const img = P.photo
      const k = Math.max(FMT.w / img.width, FMT.h / img.height) * (P.look === 'blur' ? 1.06 : 1)
      const w = img.width * k
      const h = img.height * k
      if (P.look === 'blur') x.filter = 'blur(14px)'
      x.drawImage(img, (FMT.w - w) / 2, (FMT.h - h) / 2, w, h)
      x.filter = 'none'
      if (P.look === 'paper') {
        x.fillStyle = alpha(PAPER.bg, 0.72)
        x.fillRect(0, 0, FMT.w, FMT.h)
      } else {
        x.fillStyle = `rgba(8,8,16,${P.look === 'blur' ? 0.42 : 0.3})`
        x.fillRect(0, 0, FMT.w, FMT.h)
      }
    }
    photos.set(P, c)
  }
  const c = photos.get(P)
  if (c) ctx.drawImage(c, 0, 0)
  if (P.look === 'paper') return
  // Darker still where the words go, as over the print.
  const g = ctx.createLinearGradient(0, 0, 0, FMT.h)
  g.addColorStop(0, `rgba(8,8,16,${dark})`)
  g.addColorStop(0.75, `rgba(8,8,16,${dark * 0.7})`)
  g.addColorStop(1, `rgba(8,8,16,${dark * 0.3})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, FMT.w, FMT.h)
}
