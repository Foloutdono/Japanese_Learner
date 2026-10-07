import { track } from './track'
import { MARK_INK, MARK_ROAD } from '../components/ui/markPaths'
import { ticketName, ticketRoute, ticketNumber, ticketDate, sealDate, weekdayKanji } from '../domain/dayClear'
import { lineTotals } from '../domain/lineProgress'

// ── 記念乗車券 — a ticket, shared as an image (plan 191) ───────────────
// The canvas's Share board, drawn as it is: 540×675 on the board, here
// at twice that, 1080×1350. The 辻 mark and TSUJI over the ticket lying
// tilted (-5°) under a soft light, its notch punched, the day's station
// stamp pressed on its right third (14°, multiplied into the paper, the
// ink grained by the kit's #clrk-ink filter), and three figures under
// it. Turned into a PNG and handed to the system's share sheet
// (navigator.share with a file) where there is one, else downloaded.
// The event is `ticket_share` with the ticket's days and nothing else.
//
// Every measure below is the board's own, read off its layout in CSS px
// (the comment beside each says what it is); the canvas is scaled by 2.
// The fonts are loaded first: the app's Noto Sans JP and Space Grotesk
// 700, and -- because the app ships neither -- Noto Serif JP Black and
// Space Grotesk 600 under private names, for this image alone.
//
//   renderTicketPng(input) -> Promise<Blob>
//   shareTicket(input)     -> Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'>
//
// input: {
//   days       the ticket's days (14)
//   day        the day it was earned (YYYY-MM-DD; its foot)
//   from       the run's first day (YYYY-MM-DD)
//   stampDay   the day it is shared, for the stamp (YYYY-MM-DD; default today, UTC)
//   figures    { reviews: 412, words: 58, level: 'N5' } (TicketsScreen's
//              shareFigures: the reviews, the vocabulary line's cards
//              learned, the JLPT stop); a figure not known prints "—"
//   t          the locale table (tkbShareFigures, clrTicketCaption, tkbShareText)
//   blob       an image already drawn for this input (shareTicket only),
//              so the share sheet opens inside the tap that asked for it
// }
/** The three figures under the shared ticket, from what the profile and
 *  the statistics really count: every card reviewed (/api/profile's
 *  totalReviews), the vocabulary line's cards learned (/api/stats, the
 *  profile's ledger's own figure, plan 184) and the learner's JLPT stop
 *  (jlptLevel, where the pass's route starts). */
export function shareFigures(profile, stats) {
  return {
    reviews: profile?.totalReviews ?? null,
    words: stats ? lineTotals(stats, 'vocab').learned : null,
    level: profile?.jlptLevel ?? null,
  }
}

export const SHARE_W = 1080
export const SHARE_H = 1350
const SCALE = 2

// A canvas cannot read the sheet's custom properties, and the image is
// the dark board whatever the learner's theme: the same values, named as
// index.css names them (its dark :root).
const INK = {
  bgMain: '#17151a', bgPanel: '#100e13', border: '#35303a',
  onPanel: '#f3ecdf', secondary: '#a79c8c',
  paper: '#f3ecdf', print: '#1c1811', printSoft: '#665c4a',
  stamp: '#c33a2c', road: '#c99a3e',
}
const STAMP = (a) => `rgba(195, 58, 44, ${a})`

const SANS = '"Space Grotesk", "Noto Sans JP", system-ui, sans-serif'
const JP = '"Noto Sans JP", sans-serif'
// The private faces this image loads (privateFaces below), each falling
// back to the app's own family at the weight the app has.
const SERIF_BLACK = '"Tsuji Share Serif", "Noto Serif JP", serif'
const SANS_SEMI = '"Tsuji Share Grotesk", "Space Grotesk", system-ui, sans-serif'

// ── Fonts ─────────────────────────────────────────────────────
// @fontsource's stylesheets, read as text and registered under a name
// of this module's own, so the app's pages keep the weights they ship
// (a face is fetched only for the characters drawn: each @font-face
// keeps its unicode-range).
const PRIVATE = [
  ['Tsuji Share Serif', '900', () => import('@fontsource/noto-serif-jp/900.css?inline')],
  ['Tsuji Share Grotesk', '600', () => import('@fontsource/space-grotesk/latin-600.css?inline')],
]
let privateReady = null

// A declaration ends at its `;`, or at the block's `}` where a minified
// build dropped the last one.
export function parseFaces(css) {
  const faces = []
  for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
    const src = /src:\s*([^;}]+)/.exec(block)?.[1]
    const range = /unicode-range:\s*([^;}]+)/.exec(block)?.[1]
    if (src) faces.push({ src: src.trim(), range: range?.trim() })
  }
  return faces
}

function privateFaces() {
  if (privateReady) return privateReady
  privateReady = Promise.all(PRIVATE.map(async ([family, weight, load]) => {
    try {
      const css = (await load()).default
      for (const { src, range } of parseFaces(css)) {
        const face = new FontFace(family, src, { weight, style: 'normal', ...(range ? { unicodeRange: range } : {}) })
        document.fonts.add(face)
      }
    } catch {
      // The family falls back to the app's own (see SERIF_BLACK).
    }
  }))
  return privateReady
}

async function loadFonts(texts) {
  await privateFaces()
  const all = texts.join('')
  const wants = [
    [`700 36px ${SANS}`, all], [`400 36px ${SANS}`, all],
    [`700 30px ${JP}`, all],
    [`900 144px ${SERIF_BLACK}`, all], [`600 30px ${SANS_SEMI}`, all],
  ]
  // A face that cannot load is drawn in its fallback: never a reason to fail.
  await Promise.all(wants.map(([font, text]) => document.fonts.load(font, text).catch(() => [])))
}

// ── Drawing helpers (board units; the context carries the scale) ──
/**
 * Text at a baseline, as CSS sets it: `ls` the letter-spacing after each
 * character, `ti` the text-indent, `align` left / center / right of `x`,
 * `tnum` the digits in tabular cells. Drawn a character at a time when
 * spaced or tabular, so every browser draws it the same.
 */
function text(ctx, str, x, y, { font, color, align = 'left', ls = 0, ti = 0, tnum = false }) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const chars = [...str]
  const tab = tnum ? ctx.measureText('0').width : 0
  const adv = c => (tnum && /\d/.test(c) ? tab : ctx.measureText(c).width)
  const whole = !ls && !tnum
  const width = whole ? ctx.measureText(str).width : chars.reduce((w, c) => w + adv(c) + ls, 0)
  const total = width + ti
  let at = align === 'center' ? x - total / 2 + ti : align === 'right' ? x - width : x + ti
  if (whole) {
    ctx.fillText(str, at, y)
    return
  }
  for (const c of chars) {
    const w = adv(c)
    const glyph = ctx.measureText(c).width
    ctx.fillText(c, at + (tnum && /\d/.test(c) ? (w - glyph) / 2 : 0), y)
    at += w + ls
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** A CSS linear-gradient's line over a w×h box at `deg`: [x0, y0, x1, y1]. */
function gradientLine(w, h, deg) {
  const a = (deg * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const len = Math.abs(w * dx) + Math.abs(h * dy)
  return [w / 2 - (dx * len) / 2, h / 2 - (dy * len) / 2, w / 2 + (dx * len) / 2, h / 2 + (dy * len) / 2]
}

/** repeating-linear-gradient(deg, ink 0 1px, transparent 1px 7px) over w×h. */
function lattice(ctx, w, h, deg, ink) {
  const a = (deg * Math.PI) / 180
  const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))
  const reach = Math.hypot(w, h)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  // The gradient runs along (sin a, -cos a): turn it onto the x axis.
  ctx.rotate(Math.atan2(-Math.cos(a), Math.sin(a)))
  ctx.fillStyle = ink
  for (let s = -len / 2; s < len / 2; s += 7) ctx.fillRect(s, -reach, 1, reach * 2)
  ctx.restore()
}

function canvasOf(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.round(w)
  c.height = Math.round(h)
  return c
}

// ── The stamp (駅スタンプ, the kit's seal on paper) ────────────────
// The face is drawn at its own 192 units with a margin for the grain,
// then run through the kit's #clrk-ink filter inside an SVG image (the
// only filter every browser applies to a canvas's pixels).
const FACE = 192
const FACE_PAD = 12
const INK_FILTER = `<filter id="ink" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="fine"/>
<feDisplacementMap in="SourceGraphic" in2="fine" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="rough"/>
<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="4" result="grain"/>
<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -12 0 0 0 8.52" result="voids"/>
<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="2" result="blot"/>
<feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 2 0 0 -0.05" result="pressure"/>
<feComposite in="voids" in2="pressure" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="mask"/>
<feComposite in="rough" in2="mask" operator="in"/>
</filter>`

function drawFace(px, stampDay) {
  const side = FACE + FACE_PAD * 2
  const c = canvasOf(side * px, side * px)
  const ctx = c.getContext('2d')
  ctx.scale(px, px)
  ctx.translate(FACE_PAD, FACE_PAD)
  const ink = INK.stamp
  ctx.strokeStyle = ink
  // The ring: 5 units inside the face's edge.
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(96, 96, 93.5, 0, Math.PI * 2)
  ctx.stroke()
  // The inner ring and the date band: 6 inside the ring, 1.5 thick, the
  // band's two rules clipped by it.
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(96, 96, 84.25, 0, Math.PI * 2)
  ctx.stroke()
  ctx.save()
  ctx.beginPath()
  ctx.arc(96, 96, 85, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = ink
  ctx.fillRect(0, 11 + 121, FACE, 1.5)
  ctx.fillRect(0, 11 + 143.5, FACE, 1.5)
  ctx.restore()
  // 辻駅 over the day's weekday over the date (baselines read off the board).
  text(ctx, '辻駅', 96, 49, { font: `700 13.12px ${JP}`, color: ink, align: 'center', ls: 3.936, ti: 3.936 })
  text(ctx, weekdayKanji(stampDay), 96, 121, { font: `900 72px ${SERIF_BLACK}`, color: ink, align: 'center' })
  text(ctx, sealDate(stampDay), 96, 147, { font: `700 11.52px ${SANS}`, color: ink, align: 'center', ls: 1.6128, ti: 1.6128, tnum: true })
  return c
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

/** The face, grained by the ink filter; the plain face where a browser will not. */
async function inkedFace(face) {
  const side = FACE + FACE_PAD * 2
  try {
    const href = face.toDataURL('image/png')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${face.width}" height="${face.height}" viewBox="${-FACE_PAD} ${-FACE_PAD} ${side} ${side}"><defs>${INK_FILTER}</defs><image x="${-FACE_PAD}" y="${-FACE_PAD}" width="${side}" height="${side}" href="${href}" xlink:href="${href}" filter="url(#ink)"/></svg>`
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    const out = canvasOf(face.width, face.height)
    const ctx = out.getContext('2d')
    ctx.drawImage(img, 0, 0, out.width, out.height)
    ctx.getImageData(0, 0, 1, 1) // throws where the image tainted the canvas
    return out
  } catch {
    return face
  }
}

// ── The ticket (the kit's 硬券, at the Share board's 448×240) ─────────
const TK_W = 448
const TK_H = 240

async function drawTicket({ days, day, stampDay, t }) {
  const c = canvasOf(TK_W * SCALE, TK_H * SCALE)
  const ctx = c.getContext('2d')
  ctx.scale(SCALE, SCALE)
  roundRect(ctx, 0, 0, TK_W, TK_H, 10)
  ctx.clip()
  // The paper and its 地紋, a lattice in stamp ink at 5.5%.
  ctx.fillStyle = INK.paper
  ctx.fillRect(0, 0, TK_W, TK_H)
  lattice(ctx, TK_W, TK_H, 60, STAMP(0.055))
  lattice(ctx, TK_W, TK_H, -60, STAMP(0.055))
  // The double rule, 6 inside the edge: 1, a gap of 1, 1.
  ctx.strokeStyle = STAMP(0.72)
  ctx.lineWidth = 1
  roundRect(ctx, 6.5, 6.5, TK_W - 13, TK_H - 13, 3.5)
  ctx.stroke()
  roundRect(ctx, 8.5, 8.5, TK_W - 17, TK_H - 17, 1.5)
  ctx.stroke()
  // The light falling across the paper.
  const [x0, y0, x1, y1] = gradientLine(TK_W, TK_H, 160)
  const light = ctx.createLinearGradient(x0, y0, x1, y1)
  light.addColorStop(0, 'rgba(255, 255, 255, 0.16)')
  light.addColorStop(0.34, 'rgba(255, 255, 255, 0)')
  light.addColorStop(0.58, 'rgba(28, 24, 17, 0)')
  light.addColorStop(1, 'rgba(28, 24, 17, 0.08)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, TK_W, TK_H)

  // The print: the kind and the number, the rule, then the route, the
  // name and its caption on the left two thirds (the right is the
  // stamp's), and the foot.
  text(ctx, '記念乗車券', 28, 33, { font: `700 11.52px ${JP}`, color: INK.print, ls: 3.456 })
  text(ctx, `N° ${ticketNumber(days)}`, 420, 33, { font: `700 9.92px ${SANS}`, color: INK.printSoft, align: 'right', ls: 1.3888, tnum: true })
  ctx.globalAlpha = 0.28
  ctx.fillStyle = INK.print
  ctx.fillRect(28, 43.81, 392, 1)
  ctx.globalAlpha = 1
  text(ctx, ticketRoute(days), 154, 79.22, { font: `700 15.2px ${JP}`, color: INK.print, align: 'center', ls: 2.128 })
  text(ctx, ticketName(days), 154, 156.45, { font: `900 72px ${SERIF_BLACK}`, color: INK.print, align: 'center', ls: 4.32, ti: 4.32 })
  text(ctx, t?.clrTicketCaption?.(days) ?? '', 154, 183.45, { font: `600 15.2px ${SANS_SEMI}`, color: INK.print, align: 'center' })
  text(ctx, '辻駅 発行', 28, 215.09, { font: `700 9.92px ${SANS}`, color: INK.printSoft, ls: 1.3888 })
  if (day) text(ctx, ticketDate(day), 89.09, 215.09, { font: `700 9.92px ${SANS}`, color: INK.printSoft, ls: 1.3888, tnum: true })

  // The day's stamp: 136 units, 22 from the right and 28 from the foot,
  // turned 14°, multiplied into the paper.
  const seal = await inkedFace(drawFace((136 / FACE) * SCALE, stampDay))
  const unit = 136 / FACE
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.translate(290 + 68, 76 + 68)
  ctx.rotate((14 * Math.PI) / 180)
  const side = (FACE + FACE_PAD * 2) * unit
  ctx.drawImage(seal, -68 - FACE_PAD * unit, -68 - FACE_PAD * unit, side, side)
  ctx.restore()

  // The notch, punched through: 11.5 units on the right edge's middle.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(TK_W, TK_H / 2, 11.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  return c
}

// ── The image ─────────────────────────────────────────────────
function figureText(v) {
  return v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString() : String(v)
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}

/** The Share board on a 1080×1350 canvas (exported for the tests). */
export async function drawShare(canvas, { days, day, stampDay, figures, t }) {
  const stamped = stampDay ?? todayUtc()
  const labels = t?.tkbShareFigures ?? {}
  const figs = [
    [figureText(figures?.reviews), labels.reviews ?? ''],
    [figureText(figures?.words), labels.words ?? ''],
    [figureText(figures?.level), labels.level ?? ''],
  ]
  await loadFonts([
    'TSUJI', '記念乗車券', 'N° 0123456789', ticketRoute(days), ticketName(days), t?.clrTicketCaption?.(days) ?? '',
    '辻駅 発行', ticketDate(day ?? stamped), weekdayKanji(stamped), sealDate(stamped), '—',
    ...figs.flat().map(s => s.toUpperCase()), ...figs.flat(),
  ])

  canvas.width = SHARE_W
  canvas.height = SHARE_H
  const ctx = canvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(SCALE, SCALE)
  const W = SHARE_W / SCALE
  const H = SHARE_H / SCALE

  // The ground: the page's sumi to the panel's, and a soft light at its middle.
  const ground = ctx.createLinearGradient(0, 0, 0, H)
  ground.addColorStop(0, INK.bgMain)
  ground.addColorStop(1, INK.bgPanel)
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(W / 2, H / 2)
  const rx = 0.72 * W
  const ry = 0.44 * H
  ctx.scale(1, ry / rx)
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  glow.addColorStop(0, 'rgba(243, 236, 223, 0.13)')
  glow.addColorStop(0.46, 'rgba(243, 236, 223, 0.05)')
  glow.addColorStop(0.78, 'rgba(243, 236, 223, 0)')
  glow.addColorStop(1, 'rgba(243, 236, 223, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(-W, -H / (ry / rx), W * 2, (H * 2) / (ry / rx))
  ctx.restore()

  // The mark (辻, its road in the metal) and TSUJI.
  ctx.save()
  ctx.translate(211.11, 44)
  ctx.scale(44 / 1000, 44 / 1000)
  ctx.fillStyle = INK.road
  ctx.fill(new Path2D(MARK_ROAD))
  ctx.fillStyle = INK.onPanel
  ctx.fill(new Path2D(MARK_INK))
  ctx.restore()
  text(ctx, 'TSUJI', 267.11, 72.03, { font: `700 17.92px ${SANS}`, color: INK.onPanel, ls: 3.2256 })

  // The ticket, tilted -5° about its middle, under its two shadows (the
  // kit's hang and the board's), which follow the punched notch.
  const ticket = await drawTicket({ days, day, stampDay: stamped, t })
  const layer = canvasOf(SHARE_W, SHARE_H)
  const lctx = layer.getContext('2d')
  lctx.scale(SCALE, SCALE)
  // 210: the board's 209.55, on the whole pixel the browser drew it at.
  lctx.translate(46 + TK_W / 2, 210 + TK_H / 2)
  lctx.rotate((-5 * Math.PI) / 180)
  lctx.drawImage(ticket, -TK_W / 2, -TK_H / 2, TK_W, TK_H)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // Each shadow alone: the layer drawn far above the canvas, its shadow
  // thrown back down onto it.
  const away = SHARE_H * 2
  for (const [y, blur, alpha] of [[24, 60, 0.34], [10, 26, 0.22]]) {
    ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`
    ctx.shadowBlur = blur * SCALE
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = y * SCALE + away
    ctx.drawImage(layer, 0, -away)
  }
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.drawImage(layer, 0, 0)
  ctx.restore()

  // Three figures, a third of the width each, a hairline between them.
  const colW = (W - 88) / 3
  ctx.fillStyle = INK.border
  ctx.fillRect(44 + colW, 571.09, 1, 59.91)
  ctx.fillRect(44 + colW * 2, 571.09, 1, 59.91)
  figs.forEach(([value, label], i) => {
    const cx = 44 + colW * i + colW / 2
    text(ctx, value, cx, 604.09, { font: `700 40px ${SANS}`, color: INK.onPanel, align: 'center', tnum: true })
    text(ctx, label.toUpperCase(), cx, 628.09, { font: `700 9.92px ${SANS}`, color: INK.secondary, align: 'center', ls: 1.7856, ti: 1.7856 })
  })
  return canvas
}

export async function renderTicketPng(input) {
  const canvas = await drawShare(document.createElement('canvas'), input)
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'))
}

/** Share the ticket's image, or download it where the system cannot share a file. */
export async function shareTicket(input) {
  const { days, t } = input
  let blob = input.blob
  if (!blob) {
    try {
      blob = await renderTicketPng(input)
    } catch {
      return 'failed'
    }
  }
  const name = `tsuji-${ticketNumber(days)}.png`
  const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null
  if (file && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: t?.tkbShareText?.(days) })
      track('ticket_share', { days })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
      // Refused (the tap forgotten, a policy): the download below.
    }
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    return 'failed'
  }
  track('ticket_share', { days })
  return 'downloaded'
}
