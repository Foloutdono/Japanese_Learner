// ── 余白 — a rim of paper round the words (plan 309) ─────────────────
// The scroll's text is written once on a strip of its own (challenge.js,
// stripOf). Turned on (`challenge.halo`), a rim of the page's paper is
// grown round every glyph on that strip, so the print under it never runs
// into a stroke, however little paper lies over the picture. It is drawn
// once a text, and costs no frame anything.
//
// The rim is grown from the strip's own ink: the strip laid again sixteen
// ways round itself, close and whole, then further out and fainter, so the
// paper thins into the print rather than stopping at an edge (an edge is a
// sticker's outline, never ink on paper). Coloured the page's paper, a
// little of the print still showing through it, it is laid under the ink.
import { alpha, palette } from './draw.js'

const PAPER = palette('paper')
// The rim's rings: how far out each is laid (pixels at ×1) and how strongly.
export const RIM = [[2, 1], [3.5, 0.4], [5, 0.15]]
// The ways round a glyph each ring is laid: enough that no corner of a stroke shows between two.
const WAYS = 16
// The page's paper, as the wash lays it, with a little of the print
// through it: as much of it at each hour as reads as the page. By day the
// page is paper all but whole and the rim is all but unseen; at night the
// page is a moonlit blue, the print brightened under a lighter wash
// (backdrop.js, WASH), and the rim as strong as by day stood round every
// glyph as a pale cream outline, a sticker's, never ink on paper. Quieter
// there, it keeps the sky out of the strokes and reads as the page.
export const RIM_AT = { dawn: 0.7, day: 0.7, dusk: 0.7, night: 0.45 }
/** The rim's ink at an hour of the print (the day's at an hour it does not know). */
export const rimInk = hour => alpha(PAPER.bg, RIM_AT[hour] ?? RIM_AT.day)
// By day, as the rim was first laid.
export const RIM_INK = rimInk('day')

/** Grows the rim on the strip `c`, `k` its width (0, the look before
 *  plan 309: none), at the print's `hour`, on the one canvas `canvasOf`
 *  makes for it, made after the strip and the strip's size. */
export function haloStrip(c, canvasOf, k, hour = 'day') {
  // Off, or no strip to grow it on: the strip is left as it is.
  if (!c || !(k > 0)) return
  const rim = canvasOf(c.width, c.height)
  if (!rim) return
  const x = rim.getContext('2d')
  for (const [r, a] of RIM) {
    x.globalAlpha = a
    for (let i = 0; i < WAYS; i++) x.drawImage(c, r * k * Math.cos((i * 2 * Math.PI) / WAYS), r * k * Math.sin((i * 2 * Math.PI) / WAYS))
  }
  // The glyphs themselves too, so the paper runs on unbroken under every stroke.
  x.globalAlpha = 1
  x.drawImage(c, 0, 0)
  // All of it the paper's colour, then laid under the ink.
  x.globalCompositeOperation = 'source-in'
  x.fillStyle = rimInk(hour)
  x.fillRect(0, 0, rim.width, rim.height)
  const s = c.getContext('2d')
  s.save()
  s.globalCompositeOperation = 'destination-over'
  s.drawImage(rim, 0, 0)
  s.restore()
}
