// ── 表紙 — the hook in colour, from the first frame (plan 309) ──────
// A thumbnail is the video's first look in a feed, and the scroll's hook
// is a pale washed card there, like every other one. Turned on
// (`challenge.cover`), the hook stands on the title slip's washi over the
// print unwashed, and the paper comes in only as the text does. Off (the
// look before plan 309), the hook draws its own lines, as it always has.
//
// The cover's words are the hook's own, written once in challenge.js
// (`hookWords`: { hook, title, chip }, in the plan's language) and handed
// to it here, so a hook reworded is reworded on the cover too.
//
// The slip is the one the promo's Today frames lay over the print
// (app.js, printPlate): washi, its sumi edge, the shu rule inside it. On
// it the hook's line in the sumi, the text's title in the comprehension
// station's line, the chip a sumi pill. All of it is there from the first
// frame, in both styles, so frame 0 and the thumbnail are the cover whole.
import { FORMATS, FS, SP, alpha, fit, font, frame, mark, measure, palette, paragraph, paragraphH, rrect, text } from './draw.js'
import { APP_INKS, PHONE_W, printPlate } from './app.js'
import { tuned } from './tune.js'
import { MARK_INK, MARK_ROAD } from '../src/components/ui/markPaths.js'

const FMT = FORMATS.story
const fr = frame(FMT)
const PAPER = palette('paper')
const { '--tpr-washi': WASHI, '--tpr-sumi': SUMI } = APP_INKS
// The slip's edge and rule as thick as on the promo's Today frames: a
// CSS pixel of the app's phone to the column.
const U = fr.w / PHONE_W
// Where it stands: under the masthead and the hour's disc (its foot at
// y 482), its foot above Fuji's summit on every scenery (the long view's
// at 956, the bay's at 1045), so the print shows its sky and its
// mountain round the words.
const TOP = 500
const FOOT = 940
// Its words spaced as the hook spaces them.
const HOOK_LH = 1.08
const TITLE_LH = 1.15
const CHIP_H = FS.body * 1.9
// Each as large as the slip leaves room for, the hook's line never
// smaller than the title under it: the title steps down a size, then the
// hook, till the slip's foot is above FOOT.
const LADDER = [
  [[FS.heading, FS.title], [FS.heading, FS.title]],
  [[FS.heading, FS.title], [FS.title]],
  [[FS.title], [FS.title]],
]

/** Whether the hook is drawn as the cover: asked for, and over a print, never a photo. */
export const coverOn = plan => tuned(plan.tune, 'challenge.cover') > 0 && !plan.photo

// The hook's line, on two lines at most: two sentences on two lines
// break between them, never inside one (Read along. / Can you keep up?).
function hookLines(ctx, str, sizes, maxW) {
  const b = fit(ctx, str, { weight: 900, fam: 'serif', sizes, maxW, maxLines: 2, lh: HOOK_LH })
  const said = str.split(/(?<=[.!?])\s+/)
  if (b.lines.length === 2 && said.length === 2 && said.every(s => measure(ctx, s, b.f) <= maxW)) return { ...b, lines: said }
  return b
}

// The slip laid out from the words, on the context that draws them: its
// words set to the text column, as the hook sets them, the washi wider
// than the column either side. On whole pixels, its foot as its sides,
// so its sumi edge and shu rule are drawn sharp all round (a foot
// between two pixels spread both over three rows); a size steps down
// on the height it is drawn at.
function slip(ctx, words) {
  const x = Math.round(fr.x - SP[3])
  const w = Math.round(fr.w + SP[3] * 2)
  const maxW = fr.w
  for (const [i, [hookSizes, titleSizes]] of LADDER.entries()) {
    const hook = hookLines(ctx, words.hook, hookSizes, maxW)
    const title = fit(ctx, words.title, { weight: 700, fam: 'serif', sizes: titleSizes.filter(z => z <= hook.size), maxW, maxLines: 2, lh: TITLE_LH })
    const h = Math.ceil(SP[4] + paragraphH(hook, HOOK_LH) + SP[3] + paragraphH(title, TITLE_LH) + SP[4] + CHIP_H + SP[4])
    if (TOP + h <= FOOT || i === LADDER.length - 1) return { box: { x, y: TOP, w, h }, hook, title }
  }
}

/** Where the cover's plate stands on the frame, laid out from the hook's
 *  `words` (challenge.js, hookWords): under the masthead's row, its foot
 *  above Fuji's summit on every scenery. */
export function coverBox(ctx, plan, words) {
  return slip(ctx, words).box
}

/** The cover: the hook's `words` (challenge.js, hookWords: its line, the
 *  title and the chip) on the slip's washi, `into` seconds into the hook,
 *  `laid` the share of the wash the backdrop has laid (0 to 1), `T` the
 *  look the hook is drawn in (challenge.js). The masthead is the hook's,
 *  drawn before it: as long as the paper is not there to read it on, the
 *  cover draws it again in its look, on its rim and glow. Nothing comes
 *  in: frame 0 is the cover whole. */
export function drawCover(ctx, plan, tl, into, P, T, { laid = 1, words } = {}) {
  glowMasthead(ctx, 1 - laid, T)
  const { box, hook, title } = slip(ctx, words)
  const { ink } = printPlate(ctx, PAPER, box.x, box.y, box.w, box.h, U)
  let y = box.y + SP[4]
  y += paragraph(ctx, hook, fr.cx, y, ink, 'center', HOOK_LH) + SP[3]
  y += paragraph(ctx, title, fr.cx, y, PAPER.line.rikai, 'center', TITLE_LH) + SP[4]
  chip(ctx, words.chip, y)
}

/** Where the masthead stands, the one place every frame draws it: the
 *  hook, the reading, the question and the way to the app (challenge.js,
 *  masthead) and the cover, here. The mark `size` square at the column's
 *  head, TSUJI beside it. */
export const MASTHEAD = { x: fr.x, y: fr.y, size: 64, tsuji: { x: fr.x + 64 + SP[4], y: fr.y + 64 * 0.66, f: font(700, FS.caption, 'latin') } }
/** The masthead as it stands: the mark in `ink`, its road in `road`, TSUJI in `ink`. */
export function drawMasthead(ctx, ink, road) {
  const M = MASTHEAD
  mark(ctx, M.x, M.y, M.size, ink, road)
  text(ctx, 'TSUJI', M.tsuji.x, M.tsuji.y, { f: M.tsuji.f, color: ink })
}
// The rim's rings: how far out, in pixels, and how strongly. They are not
// halo.js's (RIM there: [[2, 1], [3.5, 0.4], [5, 0.15]]), and on purpose:
// the reading's words stand on a wash, a page of paper already round
// them, where the masthead stands on the print unwashed (the cover, and
// the moment after it before the paper is laid), its strokes thinner than
// any word's. On halo.js's rings it met the night's sky inside 2 px
// (4.47:1 at its worst); on these, 6.2. Tuned as one, the masthead would
// fall back under 4.5:1 or the words gain an outline: tune each on its own.
const RIM = [[2, 1], [3.5, 0.6], [5, 0.2]]
// The night round the read-along's light ink (the backdrop's darkening's own ink).
const NIGHT = '#0c0a16'
// Each look's rim and glow, `rings` the rings' strength (× RIM's): the
// page's paper round the paper's ink, as the reading's words stand; night
// round the read-along's light ink, its glow the shadow it has always
// stood on (rgba(0,0,0,0.55), 16 px, 2 down). Its rings are quieter than
// the paper's: at 0.7 the light ink stood in a black outline on the day's
// sky (a sticker's, never a shadow's); at 0.25 it is the shadow made firm,
// the worst pixel within 2 px of it 4.92:1 under the cover and 4.68 as it
// is cut away, over every print of the six sceneries.
const RIMS = {
  paper: { rim: PAPER.bg, rings: 0.7, glow: alpha(PAPER.bg, 0.9), blur: 18, dy: 0 },
  sumi: { rim: NIGHT, rings: 0.25, glow: 'rgba(0,0,0,0.55)', blur: 16, dy: 2 },
}
/** The rim and glow round a look's masthead: `T`, the look (challenge.js,
 *  its ink, its road and its ground), the paper's when none is given. */
export function rimOf(T) {
  const L = T?.ground === 'sumi' ? RIMS.sumi : RIMS.paper
  return { ink: T?.ink ?? PAPER.ink, road: T?.road ?? PAPER.gold, ...L }
}
/** The masthead over the print unwashed, standing as the reading's words
 *  stand over theirs (halo.js): on a rim, whole close to every stroke and
 *  thinning out, so no sky runs into one (a glow alone leaves the night's
 *  sky against them), then its glow, drawn twice; all `k` as strong (1 −
 *  the share of the wash laid, none at 0); then its ink, once and whole.
 *  In its look `T` (rimOf): the paper's ink on the page's paper (the
 *  scroll), the read-along's light ink on night, so neither changes ink
 *  as the cover is cut away. The cover draws it over the hook's own; the
 *  moment after the cover, before the paper or the dark is laid, draws it
 *  in the masthead's place (challenge.js, masthead), and it becomes the
 *  masthead as `k` comes to 0. */
export function glowMasthead(ctx, k, T = null) {
  if (!(k > 0)) return
  const L = rimOf(T)
  const M = MASTHEAD
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.font = M.tsuji.f
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const outline = new Path2D(`${MARK_ROAD} ${MARK_INK}`)
  // Each ring one stroke of every outline, so it is as even where two meet.
  for (const [r, a] of RIM) {
    ctx.strokeStyle = alpha(L.rim, L.rings * a * k)
    ctx.lineWidth = r * 2
    ctx.strokeText('TSUJI', M.tsuji.x, M.tsuji.y)
    ctx.save()
    ctx.translate(M.x, M.y)
    ctx.scale(M.size / 1000, M.size / 1000)
    ctx.lineWidth = (r * 2 * 1000) / M.size
    ctx.stroke(outline)
    ctx.restore()
  }
  // The glow, twice, cast by the masthead's shape in the rim's own colour
  // and laid before any ink: cast by the ink, each glow fell on the ink
  // drawn before it.
  ctx.globalAlpha *= k
  ctx.shadowColor = L.glow
  ctx.shadowBlur = L.blur
  ctx.shadowOffsetY = L.dy
  for (let i = 0; i < 2; i++) drawMasthead(ctx, L.rim, L.rim)
  ctx.restore()
  // Then the ink, once, as the hook draws it: as the glow ends it is the
  // masthead's own, not thinned in a frame from two draws to one.
  drawMasthead(ctx, L.ink, L.road)
}

// The chip as the hook sets it, in the slip's inks: washi on a sumi pill.
function chip(ctx, label, y) {
  const f = font(700, FS.body, 'latin')
  const w = measure(ctx, label, f) + SP[5] * 2
  const x = fr.cx - w / 2
  ctx.fillStyle = SUMI
  rrect(ctx, x, y, w, CHIP_H, CHIP_H / 2)
  ctx.fill()
  text(ctx, label, x + SP[5], y + CHIP_H / 2 + FS.body * 0.36, { f, color: WASHI })
}
