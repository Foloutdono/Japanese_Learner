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
import { FORMATS, alpha, palette } from './draw.js'
import { drawPrint } from './app.js'

const FMT = FORMATS.story
const PAPER = palette('paper')

/** A canvas to draw on away from the frame: none where there is no
 *  canvas at all (the tests). */
export const canvasOf = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h)
  : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : null)

// The hour's print under it: darkened where the words go (`dark`), or
// washed whole with the app's paper, the words in ink over it.
// eslint-disable-next-line no-unused-vars -- the moment drawn and the cover, which the print does not follow yet
export function backdrop(ctx, P, T, { dark = 0.5, hour = 'day', wash = 1, plan = null, tl = null, t = 0, seg = null, cover = false } = {}) {
  if (P?.photo) {
    photoBackdrop(ctx, P, dark)
    return { laid: 1 }
  }
  const lift = T.ground === 'paper' && P ? liftedPrint(P, LIFT[hour]) : null
  if (lift) ctx.drawImage(lift, 0, 0)
  else if (P) drawPrint(ctx, P, 0, 0, FMT.w / P.scene.w, { W: FMT.w, H: FMT.h })
  else { ctx.fillStyle = T.ground === 'paper' ? PAPER.card : '#17151a'; ctx.fillRect(0, 0, FMT.w, FMT.h) }
  if (T.ground === 'paper') {
    ctx.fillStyle = alpha(PAPER.bg, Math.min(0.97, (WASH[hour] ?? WASH.day) * wash))
    ctx.fillRect(0, 0, FMT.w, FMT.h)
    return { laid: 1 }
  }
  // The sky darkened where the words go, so they read at every hour.
  const g = ctx.createLinearGradient(0, 0, 0, FMT.h * 0.72)
  g.addColorStop(0, `rgba(12,10,22,${dark})`)
  g.addColorStop(0.7, `rgba(12,10,22,${dark * 0.6})`)
  g.addColorStop(1, 'rgba(12,10,22,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, FMT.w, FMT.h * 0.72)
  return { laid: 1 }
}
// How much of the paper lies over the print at each hour: the picture
// is still there, the ink reads over all of it, and the page stays
// paper, never the grey a dark sky washed thin would leave. The night's
// print is brightened first (LIFT, plan 261): washed as heavily as dusk
// its dark sky left a blank page; brightened, the moonlit scene stands
// under a lighter wash, the page a pale moonlit blue (the owner's pick).
const WASH = { dawn: 0.72, day: 0.72, dusk: 0.82, night: 0.6 }
const LIFT = { night: 3 }
// The print brightened once and kept: it stands still under the text, so
// every frame lays the same picture. Where there is no canvas to draw it
// on (the tests), it is drawn as it is.
const lifts = new WeakMap()
function liftedPrint(P, lift) {
  if (!lift) return null
  if (!lifts.has(P)) {
    const c = canvasOf(FMT.w, FMT.h)
    if (c) {
      const x = c.getContext('2d')
      x.filter = `brightness(${lift})`
      drawPrint(x, P, 0, 0, FMT.w / P.scene.w, { W: FMT.w, H: FMT.h })
    }
    lifts.set(P, c)
  }
  return lifts.get(P)
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
