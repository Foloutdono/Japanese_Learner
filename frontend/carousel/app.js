// ── The app's own parts, drawn (plan 231) ─────────────────────────
// The promo stories show the app as a learner meets it: the review
// card, the rating bar, a question's choices, the pass on the profile,
// Today's dial and its Depart button, the analyser's sentence and its
// numbered points. Each is index.css's component at a phone's scale,
// measured in the running app (a 400px phone): every figure below is a
// CSS pixel of that screen, times `u`, the device pixels a CSS pixel
// takes on the slide. The colours are the palette's (landing/tokens.mjs);
// the few index.css inks tokens.mjs does not carry are APP_INKS, held
// equal to index.css by src/carousel.test.js.
import { MARK_INK, MARK_ROAD } from '../src/components/ui/markPaths.js'
import { printName } from '../src/domain/printHour.js'
import { RATING_INKS, TR, alpha, font, measure, mix, rrect, shadow, text } from './draw.js'

export const APP_INKS = {
  // The free card's band: one value in both themes (DESIGN.md, "The pass has two materials").
  '--pass-band': '#3f6d8e',
  // The print's paper, its ink and its seal red: the title slip's (TodayPrint).
  '--tpr-washi': '#efe3bf',
  '--tpr-sumi': '#1d1a16',
  '--tpr-shu': '#a8382a',
  // The cleared day's 硬券, which the duel's ticket is printed on, and its soft ink.
  '--paper': '#f3ecdf',
  '--paper-ink-soft': '#665c4a',
}

// The phone the parts were measured on: its column, inside its 16px gutters.
export const PHONE_W = 358

// 辻 in its two parts, as components/offers/markParts.js cuts it: 十 never fills.
const SUBPATHS = MARK_INK.match(/M[^M]*/g)
const CROSS = SUBPATHS.slice(0, 2).join('')
const SHIN = SUBPATHS.slice(2).join('')

const TR_NAME = 0.14 // --tr-name
const caps = (ctx, str, x, y, size, color, align = 'left', tr = TR.caption, weight = 700) =>
  text(ctx, str.toLocaleUpperCase(), x, y, { f: font(weight, size, 'latin'), color, align, tr })

/** The inks a part reads, per ground: index.css's tokens through the palette. */
function inks(p) {
  return {
    card: p.card,
    border: p.paper ? '#c3af7c' : '#35303a', // --border
    ink: p.ink,
    ink2: p.ink2,
    panel: p.panel,
    onPanel: p.onPanel,
    onFill: p.onFill,
    learning: '#b7402a', // --state-learning, the same in both themes
    mastered: '#a97a25', // --state-mastered
    stateNew: p.paper ? '#1a1812' : '#beb3a0',
    // What a list, a field or a sentence stands on: --surface by day, the
    // panel's sumi by night, with the ink each reads in.
    face: p.paper ? p.surface : p.panel,
    faceLine: p.paper ? p.surfaceLine : p.panelLine,
    faceInk: p.paper ? p.ink : p.onPanel,
    faceSoft: p.paper ? p.ink2 : p.onPanelSoft,
  }
}

// ── The review card (.prompt-card--footed, .flashcard) ────────────
/** The card a review turns: its stage at the top right, its foot (the
 *  level, the way it asks), the band of its progress along its edge.
 *  `body(x, y, w, h)` draws what the card says inside it. */
export function reviewCard(ctx, p, x, y, w, h, u, { stage = 'learning', stageLabel, foot = [], band = 0.5, hint, body }) {
  const c = inks(p)
  ctx.save()
  shadow(ctx, p.hang)
  ctx.fillStyle = c.card
  rrect(ctx, x, y, w, h, 8 * u)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = c.border
  ctx.lineWidth = u
  rrect(ctx, x + u / 2, y + u / 2, w - u, h - u, 8 * u)
  ctx.stroke()
  // The stage, in its seal's ink.
  const stageInk = stage === 'new' ? c.ink2 : mix(stage === 'mastered' ? c.mastered : c.learning, c.ink, 0.65)
  if (stageLabel) caps(ctx, stageLabel, x + w - 20 * u, y + 24 * u, 9.92 * u, stageInk, 'right')
  // The foot: a rule, the level on the left, the mode on the right.
  const footH = 35 * u
  const fy = y + h - footH
  ctx.fillStyle = c.border
  ctx.fillRect(x + u, fy, w - 2 * u, u)
  const fs = 11.52 * u
  if (foot[0]) text(ctx, foot[0], x + 16 * u, fy + footH / 2 + fs * 0.36, { f: font(400, fs, 'latin'), color: c.ink2 })
  if (foot[1]) text(ctx, foot[1], x + w - 16 * u, fy + footH / 2 + fs * 0.36, { f: font(400, fs, 'latin'), color: c.ink2, align: 'right' })
  // The band of its progress, inside the border along the foot.
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x + u, y + h - 5 * u, w - 2 * u, 4 * u, [0, 0, 8 * u, 8 * u])
  ctx.clip()
  ctx.fillStyle = alpha(p.paper ? '#221d15' : '#ece5d8', 0.1)
  ctx.fillRect(x, y + h - 5 * u, w, 4 * u)
  ctx.fillStyle = stage === 'mastered' ? c.mastered : stage === 'new' ? c.stateNew : c.learning
  ctx.fillRect(x + u, y + h - 5 * u, (w - 2 * u) * band, 4 * u)
  ctx.restore()
  const inner = { x: x + 28 * u, y: y + 44 * u, w: w - 56 * u, h: h - footH - 44 * u - 28 * u }
  if (hint) caps(ctx, hint, x + w / 2, inner.y + inner.h - 4 * u, 9.92 * u, c.ink2, 'center')
  if (body) body(inner.x, inner.y, inner.w, inner.h)
}

/** The card's front: the word as CharDisplay sets it (72px, the JP face),
 *  stepped down rather than past the card. */
export function cardWord(ctx, p, str, cx, cy, maxW, u, size = 72) {
  let z = size * u
  while (z > 28 * u && measure(ctx, str, font(400, z, 'jp')) > maxW) z -= 4 * u
  text(ctx, str, cx, cy + z * 0.36, { f: font(400, z, 'jp'), color: p.ink, align: 'center' })
  return z
}

// ── The rating bar (.rating-bar, the simple scale) ─────────────────
/** The bar a review is rated on: four keys, each lifted on its 3px foot,
 *  the two misses (Missed, Almost) on the panel's ink with their lamp,
 *  the two passes (Correct, Easy) with a check, each a fifth wider than a
 *  miss (index.css's 2 : 2.4): Correct a plain key, Easy filled with its
 *  blue. `labels`
 *  worst first; `pressed` the index pressed, if any (it sinks onto its
 *  foot). Returns its height and each key's centre. */
export function ratingBar(ctx, p, x, y, w, u, labels, { pressed = null } = {}) {
  const c = inks(p)
  const foot = 3 * u // --key-foot
  const h = 61 * u
  const gap = 8 * u // --sp-3 between the keys
  const missW = (w - gap) * 2 / 4.4
  const keyW = (missW - gap) / 2
  const passW = (w - missW - 2 * gap) / 2
  const r = 8 * u
  const sole = mix(c.panel, '#000000', 0.4)
  const ls = 13.12 * u
  const missInks = [p.rating[0], p.rating[1]]
  const easy = RATING_INKS['--rating-correct']
  const key = (kx, kw, face, footInk, light, isPressed) => {
    const ky = y + (isPressed ? foot : 0)
    if (!isPressed) {
      ctx.fillStyle = footInk
      rrect(ctx, kx, y + foot, kw, h, r)
      ctx.fill()
    }
    ctx.fillStyle = face(ky)
    rrect(ctx, kx, ky, kw, h, r)
    ctx.fill()
    ctx.save()
    rrect(ctx, kx, ky, kw, h, r)
    ctx.clip()
    ctx.fillStyle = light
    ctx.fillRect(kx, ky, kw, u)
    ctx.restore()
    return ky
  }
  const centres = []
  for (let i = 0; i < 2; i++) {
    const kx = x + i * (keyW + gap)
    const isP = pressed === i
    const ky = key(kx, keyW, ky0 => {
      const g = ctx.createLinearGradient(0, ky0, 0, ky0 + h)
      g.addColorStop(0, mix(c.onPanel, c.panel, isP ? 0.14 : 0.1))
      g.addColorStop(1, mix(c.onPanel, c.panel, isP ? 0.09 : 0.06))
      return g
    }, sole, alpha(c.onPanel, 0.08), isP)
    const ink = missInks[i]
    const cx = kx + keyW / 2
    ctx.fillStyle = mix(ink, c.panel, isP ? 1 : 0.55)
    ctx.beginPath()
    ctx.arc(cx, ky + 20 * u, 4 * u, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = alpha(ink, 0.85)
    ctx.lineWidth = u
    ctx.beginPath()
    ctx.arc(cx, ky + 20 * u, 3.5 * u, 0, Math.PI * 2)
    ctx.stroke()
    text(ctx, labels[i], cx, ky + 32 * u + ls * 0.8, { f: font(700, ls, 'latin'), color: c.onPanel, align: 'center' })
    centres.push(cx)
  }
  // The passes: Correct the dark key a miss is, Easy its blue, lit from
  // the top, on a foot of its own ink; each with its check.
  for (let i = 0; i < 2; i++) {
    const filled = i === 1
    const kx = x + missW + gap + i * (passW + gap)
    const kw = passW
    const isP = pressed === 2 + i
    const ky = filled
      ? key(kx, kw, ky0 => {
        const g = ctx.createLinearGradient(0, ky0, 0, ky0 + h)
        g.addColorStop(0, mix(easy, c.onPanel, 0.85))
        g.addColorStop(1, easy)
        return g
      }, mix(easy, sole, 0.4), alpha(c.onPanel, 0.35), isP)
      : key(kx, kw, ky0 => {
        const g = ctx.createLinearGradient(0, ky0, 0, ky0 + h)
        g.addColorStop(0, mix(c.onPanel, c.panel, isP ? 0.14 : 0.1))
        g.addColorStop(1, mix(c.onPanel, c.panel, isP ? 0.09 : 0.06))
        return g
      }, sole, alpha(c.onPanel, 0.08), isP)
    const ink = filled ? c.onFill : c.onPanel
    const ccx = kx + kw / 2
    ctx.save()
    ctx.strokeStyle = ink
    ctx.lineWidth = 2 * u
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(ccx - 6 * u, ky + 22 * u)
    ctx.lineTo(ccx - 2 * u, ky + 26 * u)
    ctx.lineTo(ccx + 6 * u, ky + 18 * u)
    ctx.stroke()
    ctx.restore()
    text(ctx, labels[2 + i], ccx, ky + 35 * u + ls * 0.8, { f: font(700, ls, 'latin'), color: ink, align: 'center' })
    centres.push(ccx)
    if (isP) {
      ctx.strokeStyle = c.onPanel
      ctx.lineWidth = 2 * u
      rrect(ctx, kx + u, ky + u, kw - 2 * u, h - 2 * u, r)
      ctx.stroke()
    }
  }
  return { h: h + foot, centres }
}

// ── A question's choices (.mcq-row, in a run) ──────────────────────
/** The choices as a run lists them: a row each, its number in a ring of
 *  the line's pigment. `right` the index of the right one, shown answered
 *  (the success ink) when `answered`. Returns the height. */
export function choiceRows(ctx, p, x, y, w, u, choices, { line, right = -1, answered = false, jp = true, rowH: rowCss = 54, reveal = null } = {}) {
  const c = inks(p)
  const rowH = rowCss * u
  const gap = 8 * u
  const success = p.paper ? '#4d7639' : '#74a15f'
  // Once answered the run folds the other rows away: the right one stays.
  const rows = answered ? [right] : choices.map((_, i) => i)
  rows.forEach((i, at) => {
    const label = choices[i]
    // A clip brings the rows in one by one (`reveal`, 0 to 1 each).
    const r = reveal ? reveal[at] ?? 1 : 1
    ctx.save()
    ctx.globalAlpha *= r
    ctx.translate(0, (1 - r) * 16 * u)
    const ry = y + at * (rowH + gap)
    const ok = answered && i === right
    const ink = ok ? success : line
    ctx.fillStyle = ok ? mix(success, c.card, 0.12) : c.face
    rrect(ctx, x, ry, w, rowH, 6 * u)
    ctx.fill()
    ctx.strokeStyle = ok ? success : c.faceLine
    ctx.lineWidth = u
    rrect(ctx, x + u / 2, ry + u / 2, w - u, rowH - u, 6 * u)
    ctx.stroke()
    if (ok) {
      ctx.save()
      rrect(ctx, x, ry, w, rowH, 6 * u)
      ctx.clip()
      ctx.fillStyle = success
      ctx.fillRect(x, ry, 3 * u, rowH)
      ctx.restore()
    }
    const cx = x + 17 * u + 14 * u
    const cy = ry + rowH / 2
    ctx.beginPath()
    ctx.arc(cx, cy, 13 * u, 0, Math.PI * 2)
    if (ok) {
      ctx.fillStyle = success
      ctx.fill()
    } else {
      ctx.strokeStyle = alpha(ink, 0.55)
      ctx.lineWidth = 2 * u
      ctx.stroke()
    }
    const nz = 12.8 * u
    text(ctx, String(i + 1).padStart(2, '0'), cx, cy + nz * 0.36, { f: font(700, nz, 'latin'), color: ok ? p.bg : c.faceSoft, align: 'center' })
    const lz = 17 * u
    const tx = x + 57 * u
    const room = w - 57 * u - 16 * u
    let z = lz
    while (z > 12 * u && measure(ctx, label, font(600, z, jp ? 'jp' : 'latin')) > room) z -= u
    text(ctx, label, tx, cy + z * 0.36, { f: font(600, z, jp ? 'jp' : 'latin'), color: ok ? success : c.faceInk })
    ctx.restore()
  })
  return rows.length * rowH + (rows.length - 1) * gap
}

// ── The pass (.pcard--free: the profile's card) ────────────────────
/** The learner's card, face up, on its white plastic: the brand and its
 *  contactless mark, 辻 in the corner, the mark large and faint behind,
 *  the holder's name and level, the band with the fare and the class.
 *  Its aspect is the card's, 272:172. */
export function passCard(ctx, x, y, w, { name, level, meta, cls, brand = 'Pass', xp = 0.3, nameInk } = {}) {
  const k = w / 358
  const h = w * 172 / 272
  const r = 10 * k
  const band = APP_INKS['--pass-band']
  ctx.save()
  shadow(ctx, `0px ${14 * k / 2.7}px ${30 * k / 2.7}px rgba(0, 0, 0, 0.5)`)
  ctx.fillStyle = '#e2e0db'
  rrect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.restore()
  ctx.save()
  rrect(ctx, x, y, w, h, r)
  ctx.clip()
  const lin = ctx.createLinearGradient(x, y, x + w * 0.34, y + h)
  lin.addColorStop(0, '#f3f2ef')
  lin.addColorStop(1, '#e2e0db')
  ctx.fillStyle = lin
  ctx.fillRect(x, y, w, h)
  const rad = ctx.createRadialGradient(x + w * 0.22, y, 0, x + w * 0.22, y, w * 0.8)
  rad.addColorStop(0, 'rgba(255,255,255,0.9)')
  rad.addColorStop(0.6, 'rgba(255,255,255,0)')
  ctx.fillStyle = rad
  ctx.fillRect(x, y, w, h)
  const bandH = 44 * k * (h / (226 * k))
  ctx.fillStyle = band
  ctx.fillRect(x, y + h - bandH, w, bandH)
  // The seal: 辻 large and faint, 辶 filled with the XP from its foot.
  const ss = 163 * k
  const sx = x + w / 2 - 40 * k * (163 / 124)
  const sy = y + 13 * k
  ctx.save()
  ctx.translate(sx, sy)
  ctx.scale(ss / 1000, ss / 1000)
  ctx.fillStyle = 'rgba(30, 32, 36, 0.06)'
  ctx.fill(new Path2D(CROSS))
  ctx.fill(new Path2D(SHIN))
  ctx.fill(new Path2D(MARK_ROAD))
  ctx.beginPath()
  const top = 56 + 921 * (1 - xp)
  ctx.rect(0, top, 1000, 977 - top)
  ctx.clip()
  ctx.fillStyle = alpha(band, 0.55)
  ctx.fill(new Path2D(SHIN))
  ctx.fill(new Path2D(MARK_ROAD))
  ctx.restore()
  ctx.restore()
  ctx.strokeStyle = 'rgba(30, 32, 36, 0.12)'
  ctx.lineWidth = k
  rrect(ctx, x + k / 2, y + k / 2, w - k, h - k, r)
  ctx.stroke()
  // The brand: three arcs thickening outward, then its word.
  const px = x + 21 * k
  const by = y + 33 * k
  ctx.save()
  ctx.strokeStyle = 'rgba(34, 36, 40, 0.62)'
  ctx.lineWidth = 1.4 * k
  ctx.lineCap = 'round'
  const base = ctx.globalAlpha
  ;[[4, 1], [7, 0.75], [10.5, 0.55]].forEach(([rr, a]) => {
    ctx.globalAlpha = base * a
    ctx.beginPath()
    ctx.arc(px, by, rr * k, -0.9, 0.9)
    ctx.stroke()
  })
  ctx.restore()
  caps(ctx, brand, px + 21 * k, by + 9.92 * k * 0.36, 9.92 * k, 'rgba(34, 36, 40, 0.62)')
  // 辻 in the corner, its road in the band's ink.
  const cs = 34 * k
  ctx.save()
  ctx.translate(x + w - 21 * k - cs, y + 16 * k)
  ctx.scale(cs / 1000, cs / 1000)
  ctx.fillStyle = band
  ctx.fill(new Path2D(MARK_ROAD))
  ctx.fillStyle = '#222428'
  ctx.fill(new Path2D(MARK_INK))
  ctx.restore()
  // The holder: the name in the serif, the level under it.
  const nz = 20 * k
  text(ctx, name, px, y + 83 * k + nz * 0.8, { f: font(700, nz, 'serif'), color: nameInk || '#222428' })
  if (level != null) text(ctx, String(level), px, y + 114 * k + 17.92 * k * 0.8, { f: font(700, 17.92 * k, 'latin'), color: '#222428' })
  // The band: the fare, and the class large.
  const fy = y + h - bandH / 2
  if (meta) caps(ctx, meta, px, fy + 9.92 * k * 0.36, 9.92 * k, 'rgba(255, 255, 255, 0.92)', 'left', TR_NAME)
  if (cls) caps(ctx, cls, x + w - 21 * k, fy + 27.2 * k * 0.34, 27.2 * k, '#fff', 'right', TR_NAME)
  return h
}

// ── Today's print (TodayPrint, plan 205) ───────────────────────────
// The gate stands on the print of the hour: its layers are the app's own
// files (public/today/print/<rev>/<print>-phone.json, its grain and its
// paper), drawn here as the app draws them with motion reduced: the
// moving parts at rest, the train halfway across. index.css's own .tpr-
// rules and its reduced-motion block ride into each layer, so nothing of
// the print is copied here. The hour picks it in today's season, as the
// app's gate does (domain/printHour's printName, plan 261).
export const PRINT_HOURS = ['dawn', 'day', 'dusk', 'night']

function stillCss(css) {
  const rules = css.match(/^\.tpr-[a-z-]+(?:\s*,\s*\.tpr-[a-z-]+)*\s*\{[^}\n]*\}$/gm) || []
  const still = /@media \(prefers-reduced-motion: reduce\) \{\n {2}\/\* The still print[\s\S]*?\n\}\n/.exec(css)
  const inner = still ? still[0].replace(/^@media[^{]*\{/, '').replace(/\}\n$/, '') : ''
  return `${rules.join('\n')}\n${inner.replace(/\.tpr /g, '')}\n[class*="tpr-"] { animation: none !important; }`
}

const picture = src => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error(`print: ${src.slice(0, 60)}`))
  img.src = src
})

// The print in motion, for a clip (plan 231): index.css's .tpr- rules and
// their keyframes, every animation held paused at the clip's moment `t`.
// An element's own delay (its phase, written on it) moves on by t; one
// with none starts at t.
function motionCss(css) {
  const rules = css.match(/^\.tpr-[a-z-]+(?:\s*,\s*\.tpr-[a-z-]+)*\s*\{[^}\n]*\}$/gm) || []
  const frames = []
  const re = /@keyframes tpr-[\w-]+\s*\{/g
  let m
  while ((m = re.exec(css))) {
    let depth = 0
    let i = m.index + m[0].length - 1
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}' && --depth === 0) break
    }
    frames.push(css.slice(m.index, i + 1))
  }
  return `${rules.join('\n')}\n${frames.join('\n')}`
}
/** A layer's markup at the clip's moment `t` (seconds). */
function layerAt(markup, t) {
  return markup.replace(/animation-delay:\s*(-?[\d.]+)s/g, (_, d) => `animation-delay: ${(+d - t).toFixed(3)}s`)
}

/** The hour's print in today's season, its layers decoded: `base` is the
 *  frontend's root as the page sees it. */
export async function loadPrint(hour, { base = '../', device = 'phone', now = new Date() } = {}) {
  const get = async (path, as = 'json') => {
    const r = await fetch(base + path)
    if (!r.ok) throw new Error(`print: ${path} ${r.status}`)
    return as === 'json' ? r.json() : r.text()
  }
  const meta = await get('src/components/station/print/print.json')
  const name = printName(now, hour)
  const scene = await get(`public/today/print/${meta.rev}/${name}-${device}.json`)
  const cssText = await get('src/index.css', 'text')
  const css = stillCss(cssText)
  // On the page the four layers share one document, and a layer fills
  // with a gradient another declares: each image carries them all.
  const defs = Object.values(scene.layers).flatMap(l => l.match(/<defs>[\s\S]*?<\/defs>/g) || []).join('')
  // The train waits off the print's left edge until it runs (the page
  // lets it overflow its box): its image spans a print's width either side.
  const svg = (inner, left = 0) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-left} 0 ${scene.w + left} ${scene.h}" width="${(scene.w + left) * 4}" height="${scene.h * 4}"><style>${css}</style>${defs}${inner}</svg>`)}`
  const [sky, back, train, front, grain, paper] = await Promise.all([
    picture(svg(scene.layers.sky)), picture(svg(scene.layers.back)), picture(svg(scene.layers.train, scene.w)), picture(svg(scene.layers.front)),
    picture(`${base}public/today/print/${meta.rev}/grain.png`), picture(`${base}public/today/print/${meta.rev}/paper.png`),
  ])
  const moving = motionCss(cssText)
  const at = (name, t, left = 0) => picture(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-left} 0 ${scene.w + left} ${scene.h}" width="${(scene.w + left) * 4}" height="${scene.h * 4}"><style>${moving}\n[class*="tpr-"] { animation-delay: ${(-t).toFixed(3)}s; animation-play-state: paused !important; }</style>${defs}${layerAt(scene.layers[name], t)}</svg>`)}`)
  /** The layers that move, as they stand `t` seconds in. */
  const moment = async t => {
    const [s2, b2, f2] = await Promise.all([at('sky', t), at('back', t), at('front', t)])
    return { sky: s2, back: b2, front: f2 }
  }
  return { hour, scene, frame: meta.frames[device], look: meta.prints[name], img: { sky, back, train, front, grain, paper }, moment }
}

/** The print with its top-left corner at (x, y), `u` pixels a unit; the
 *  band's ink fills above it, as the gate's frame does. */
export function drawPrint(ctx, P, x, y, u, { W = ctx.canvas.width, H = ctx.canvas.height, moving = null, t = null } = {}) {
  const { scene, frame, look } = P
  // A clip's frame: the layers as they stand at `t`, the train where its
  // run has brought it; a still: the print at rest, the train halfway.
  const img = moving ? { ...P.img, ...moving } : P.img
  const run = t == null ? 0.45 : (((t + scene.train.delay) % scene.train.dur) / scene.train.dur)
  const w = scene.w * u
  const h = scene.h * u
  ctx.fillStyle = look.band
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  const sky = ctx.createLinearGradient(0, y, 0, y + h)
  for (const [o, col] of look.sky) sky.addColorStop((o * frame.horizon) / scene.h, col)
  sky.addColorStop(frame.horizon / scene.h, look.ground)
  sky.addColorStop(1, look.ground)
  ctx.fillStyle = sky
  ctx.fillRect(x, y, w, h)
  ctx.drawImage(img.sky, x, y, w, h)
  const tile = (pic, tw, th, hh) => {
    for (let ty = 0; ty < hh; ty += th) for (let tx = 0; tx < w; tx += tw) ctx.drawImage(pic, x + tx, y + ty, tw, Math.min(th, hh - ty))
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, (frame.horizon + 12) * u)
  ctx.clip()
  tile(img.grain, 640 * u, 120 * u, (frame.horizon + 12) * u)
  ctx.restore()
  ctx.drawImage(img.back, x, y, w, h)
  ctx.drawImage(img.train, x - w + w * (scene.train.run / 100) * run, y, 2 * w, h)
  ctx.drawImage(img.front, x, y, w, h)
  tile(img.paper, 128 * u, 128 * u, h)
  ctx.restore()
}

const MARIA = [[-0.56, -0.42, 0.2, 0.781], [-0.2, -0.66, 0.16, 0.7377], [0.52, -0.5, 0.15, 0.8627],
  [0.66, 0.34, 0.16, 0.7181], [-0.6, 0.48, 0.13, 0.834], [0.18, 0.72, 0.12, 0.7914]]

/** Today's dial as the hour's sun or moon on its print (PrintDial): its
 *  glow, the halo of its lines at dusk and night, the disc, an arc per
 *  line round it, the count in the disc's inks; then the time under it.
 *  (cx, cy) the disc's centre, `u` the print's unit. */
export function printDial(ctx, p, P, cx, cy, u, { parts, count, unit, time, end, breath = null }) {
  const { frame, look } = P
  const disc = look.disc
  const r = frame.disc * u
  const halo = frame.halo * u
  const width = 3.4 * u
  // The glow breathes in a clip (tpr-breathe: 0.8 to 1, 0.985 to 1.035).
  const glowR = (r + 70 * u) * (breath == null ? 1 : 0.985 + 0.05 * breath)
  const glowA = breath == null ? 1 : 0.8 + 0.2 * breath
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
  g.addColorStop(r / glowR, alpha(disc.glow, disc.glowOp * glowA))
  g.addColorStop((r + 24 * u) / glowR, alpha(disc.glow, disc.glowOp * 0.35 * glowA))
  g.addColorStop(1, alpha(disc.glow, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
  ctx.fill()
  // The arcs: dialArcs at the halo's radius, a gap of 11 units in 101.
  const total = parts.reduce((s, q) => s + q.n, 0)
  const C = 2 * Math.PI * halo
  const gap = (11 * halo) / 101
  const cap = width / 2
  const arcs = parts.length === 1
    ? [{ color: parts[0].color, a0: 0, a1: Math.PI * 2 }]
    : (() => {
      const usable = C - gap * parts.length
      let at = gap / 2
      return parts.map(q => {
        const span = (usable * q.n) / total
        const a0 = -Math.PI / 2 + (at + cap) / halo
        at += span + gap
        return { color: q.color, a0, a1: a0 + Math.max(0, span - 2 * cap) / halo }
      })
    })()
  const stroke = (lw, filter) => {
    ctx.save()
    ctx.lineCap = parts.length === 1 ? 'butt' : 'round'
    ctx.lineWidth = lw
    if (filter) ctx.filter = filter
    for (const a of arcs) {
      ctx.strokeStyle = a.color
      ctx.beginPath()
      ctx.arc(cx, cy, halo, a.a0, a.a1)
      ctx.stroke()
    }
    ctx.restore()
  }
  if (disc.haloGlow > 0) {
    ctx.save()
    ctx.globalAlpha *= disc.haloGlow
    stroke(13 * u, `blur(${4.5 * u}px)`)
    ctx.restore()
  }
  const f = ctx.createRadialGradient(cx - 0.2 * r, cy - 0.28 * r, 0, cx - 0.2 * r, cy - 0.28 * r, 0.72 * 2 * r)
  f.addColorStop(0, disc.fill[0])
  f.addColorStop(1, disc.fill[1])
  ctx.fillStyle = f
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  if (disc.maria) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    ctx.globalAlpha *= 0.2
    ctx.filter = `blur(${2.4 * u}px)`
    ctx.fillStyle = '#c9b68a'
    for (const [mx, my, ms, mq] of MARIA) {
      ctx.beginPath()
      ctx.ellipse(cx + mx * r, cy + my * r, ms * r, ms * r * mq, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
  stroke(width)
  // The count, in the disc's two inks, and its unit.
  const cz = 72 * u * (frame.disc / 80)
  const cg = ctx.createLinearGradient(0, cy - cz * 0.62, 0, cy + cz * 0.2)
  cg.addColorStop(0, look.ink.countA)
  cg.addColorStop(1, look.ink.countB)
  text(ctx, String(count), cx, cy + cz * 0.14, { f: font(700, cz, 'latin'), color: cg, align: 'center' })
  caps(ctx, unit, cx, cy + cz * 0.42, 9.92 * u, look.ink.discSoft, 'center')
  // Under it: the time large, then when the run is done.
  if (time) {
    const tz = 20 * u
    const ez = 13.12 * u
    const tw = measure(ctx, time, font(700, tz, 'latin'))
    const sep = end ? ` · ${end}` : ''
    const ew = sep ? measure(ctx, sep, font(400, ez, 'latin')) : 0
    const x0 = cx - (tw + ew) / 2
    const ty = cy + (frame.fare + 32) * u
    text(ctx, time, x0, ty, { f: font(700, tz, 'latin'), color: look.ink.text })
    if (sep) text(ctx, sep, x0 + tw, ty, { f: font(400, ez, 'latin'), color: look.ink.soft })
  }
}

/** The print's title plate: the date and the view's name, set downwards
 *  on the washi, in the sumi, the view in the shu, framed twice. (x, y)
 *  its top-right corner. */
export function printTitle(ctx, x, y, u, { date, view }) {
  const { '--tpr-washi': washi, '--tpr-sumi': sumi, '--tpr-shu': shu } = APP_INKS
  const z = 15.2 * u
  const step = z * 1.06
  const n = [...date].length + [...view].length
  const w = z + 2 * 4 * u + 2 * u
  const h = n * step + 2 * 12 * u
  const x0 = x - w
  ctx.fillStyle = washi
  ctx.fillRect(x0, y, w, h)
  ctx.strokeStyle = sumi
  ctx.lineWidth = u
  ctx.strokeRect(x0 + u / 2, y + u / 2, w - u, h - u)
  ctx.strokeStyle = shu
  ctx.strokeRect(x0 + 3.5 * u, y + 3.5 * u, w - 7 * u, h - 7 * u)
  let ty = y + 12 * u + z * 0.86
  for (const ch of date) { text(ctx, ch, x0 + w / 2, ty, { f: font(700, z, 'serif'), color: sumi, align: 'center' }); ty += step }
  for (const ch of view) { text(ctx, ch, x0 + w / 2, ty, { f: font(900, z, 'serif'), color: shu, align: 'center' }); ty += step }
  return { w, h }
}

/** The gate's Depart button: the gold pill, the reader's dark roundel at
 *  its left with the contactless mark in gold, the word centred. Still,
 *  its two ripples stand where they pass; with `ready` (seconds since the
 *  button came to rest) it moves as .btn-depart--gate does: the halo
 *  breathes (btn-gate-breathe, 2.8s), two ripples leave the reader 1.1s
 *  apart (btn-gate-rip, 2.2s), and after four seconds untaken the reader
 *  steps toward the way on twice (btn-gate-nudge, 720ms). */
export function departButton(ctx, p, x, y, w, u, label, ready = null) {
  const h = 66 * u
  const moving = ready != null
  // Its own shades are of what it is given: a button coming in is faint whole.
  const base = ctx.globalAlpha
  if (moving) {
    // The breath's peak, a layer under the fill: a 9px ring and a glow.
    const b = 0.5 - 0.5 * Math.cos((2 * Math.PI * ready) / 2.8)
    ctx.save()
    ctx.globalAlpha *= b
    shadow(ctx, `0px ${8 * u}px ${28 * u}px ${alpha(p.goldMid, 0.4)}`)
    ctx.fillStyle = alpha(p.goldMid, 0.16)
    rrect(ctx, x - 9 * u, y - 9 * u, w + 18 * u, h + 18 * u, h / 2 + 9 * u)
    ctx.fill()
    ctx.restore()
  }
  ctx.save()
  shadow(ctx, `0px 4px 18px ${alpha(p.goldMid, 0.35)}`)
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, p.goldLit)
  g.addColorStop(1, p.goldMid)
  ctx.fillStyle = g
  rrect(ctx, x, y, w, h, h / 2)
  ctx.fill()
  ctx.restore()
  const nudge = moving ? NUDGE(ready - 4) : 0
  const rx = x + 8 * u + 24 * u + nudge * 6 * u
  const ry = y + h / 2
  ctx.fillStyle = '#100e13'
  ctx.beginPath()
  ctx.arc(rx, ry, 24 * u, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.strokeStyle = alpha('#100e13', 0.55)
  ctx.lineWidth = 2 * u
  const rips = moving
    ? [0, 1.1].filter(d => ready >= d).map(d => EASE_OUT(((ready - d) % 2.2) / 2.2)).map(e => [23 * (1 + 0.75 * e), 0.8 * (1 - e)])
    : [[28.5, 1], [39, 1]]
  for (const [rr, a] of rips) {
    ctx.globalAlpha = base * a
    ctx.beginPath()
    ctx.arc(rx, ry, rr * u, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = base
  passWave(ctx, rx - 24 * u, ry, u)
  ctx.restore()
  // The word centred on the pill, or in what the reader leaves of it
  // when it is long, a size down rather than past its end.
  const free = x + 8 * u + 48 * u + 16 * u
  const room = x + w - 24 * u - free
  let lz = 17.92 * u
  while (lz > 13 * u && measure(ctx, label, font(700, lz, 'latin')) > room) lz -= 0.5 * u
  const lw = measure(ctx, label, font(700, lz, 'latin'))
  const cx = Math.max(x + w / 2, free + lw / 2)
  text(ctx, label, cx, ry + lz * 0.36, { f: font(700, lz, 'latin'), color: '#1c1811', align: 'center' })
  return h
}

/** The pass's contactless mark as the reader wears it (.pass__wave.
 *  btn-depart__wave): three circles 8, 15 and 22px across, their left
 *  edges together 10px into the reader, each showing only its right
 *  border, 2px of the lamp's gold, cut where the box's diagonals cut it
 *  (±45°): a crescent, then two arcs. `x` is the reader's left, `y` its middle. */
function passWave(ctx, x, y, u) {
  ctx.fillStyle = '#dcad4e'
  for (const d of [8, 15, 22]) {
    const r = (d / 2) * u
    const cx = x + (10 + d / 2) * u
    ctx.beginPath()
    ctx.arc(cx, y, r, -Math.PI / 4, Math.PI / 4)
    ctx.arc(cx, y, r - 2 * u, Math.PI / 4, -Math.PI / 4, true)
    ctx.closePath()
    ctx.fill()
  }
}

/** A CSS timing function (cubic-bezier(x1, y1, x2, y2)) as a function of
 *  the share of time gone, 0 to 1. */
export function cssEase(x1, y1, x2, y2) {
  const at = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3
  return x => {
    const t = Math.min(1, Math.max(0, x))
    let lo = 0
    let hi = 1
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < t) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}
const EASE_OUT = cssEase(0, 0, 0.58, 1)
const EASE_IN_OUT = cssEase(0.42, 0, 0.58, 1)
// btn-gate-nudge over 720ms: out at 25% and 75%, home at 0, 50% and 100%.
function NUDGE(s) {
  const x = s / 0.72
  if (x <= 0 || x >= 1) return 0
  const q = (x * 4) % 2
  return EASE_IN_OUT(q <= 1 ? q : 2 - q)
}

// ── The analyser (.anl-subs__line, .bkd-point) ─────────────────────
/** The sentence as the analyser draws it: each word with its reading
 *  over it and its stage's rule under it, each grammar point's words in
 *  a box of the grammar line's ink with its number on the box's corner.
 *  `toks`: [{ t, fu, point }] (point from 1, 0 for none). Lines wrap
 *  inside `w`; returns the height. */
export function analyserLine(ctx, p, x, y, w, u, toks, { center = true } = {}) {
  const c = inks(p)
  const wz = 20 * u
  const fz = 9.92 * u
  const pad = 4 * u
  const boxPad = 4 * u
  const green = p.line.grammar
  // Group the tokens: a run of one point is one box.
  const groups = []
  for (const tk of toks) {
    const last = groups[groups.length - 1]
    if (tk.point && last && last.point === tk.point) last.toks.push(tk)
    else groups.push({ point: tk.point || 0, toks: [tk] })
  }
  const tokW = tk => measure(ctx, tk.t, font(600, wz, 'jp')) + 2 * pad
  const groupW = g => g.toks.reduce((s, tk) => s + tokW(tk), 0) + (g.point ? 2 * boxPad : 0)
  const lineH = 47 * u + 4 * u
  const lines = [[]]
  let lw = 0
  for (const g of groups) {
    const gw = groupW(g)
    if (lw + gw > w && lines[lines.length - 1].length) { lines.push([]); lw = 0 }
    lines[lines.length - 1].push(g)
    lw += gw + 4 * u
  }
  lines.forEach((ln, li) => {
    const total = ln.reduce((s, g) => s + groupW(g) + 4 * u, -4 * u)
    let gx = center ? x + (w - total) / 2 : x
    const ly = y + 14 * u + li * (lineH + 8 * u)
    for (const g of ln) {
      const gw = groupW(g)
      if (g.point) {
        ctx.strokeStyle = green
        ctx.lineWidth = 2 * u
        rrect(ctx, gx + u, ly + u, gw - 2 * u, 47 * u - 2 * u, 6 * u)
        ctx.stroke()
      }
      let tx = gx + (g.point ? boxPad : 0)
      for (const tk of g.toks) {
        const tw = tokW(tk)
        const gram = !!g.point || tk.k === 'punct'
        const base = ly + 4 * u + 15 * u + wz * 0.82
        if (tk.fu && !gram) text(ctx, tk.fu, tx + tw / 2, ly + 4 * u + fz * 0.9, { f: font(500, fz, 'jp'), color: c.ink2, align: 'center' })
        text(ctx, tk.t, tx + tw / 2, base, { f: font(600, wz, 'jp'), color: gram ? c.ink2 : c.ink, align: 'center' })
        if (!gram) {
          ctx.fillStyle = c.stateNew
          ctx.fillRect(tx + u, base + 8 * u, tw - 2 * u, 2 * u)
        }
        tx += tw
      }
      if (g.point) {
        const nx = gx + gw - 6 * u
        const ny = ly - 1 * u
        ctx.fillStyle = green
        ctx.beginPath()
        ctx.arc(nx, ny, 11 * u, 0, Math.PI * 2)
        ctx.fill()
        text(ctx, String(g.point), nx, ny + fz * 0.36, { f: font(700, fz, 'latin'), color: c.card, align: 'center' })
      }
      gx += gw + 4 * u
    }
  })
  return 14 * u + lines.length * (lineH + 8 * u)
}

/** A grammar point as the analyser lists it: its number, its pattern,
 *  its level, its gloss, and the words it is made of. Returns the height. */
export function pointCard(ctx, p, x, y, w, u, { n, pattern, level, gloss, parts }) {
  const c = inks(p)
  const h = 102 * u
  const green = p.line.grammar
  ctx.fillStyle = p.paper ? p.surface : '#17151a'
  rrect(ctx, x, y, w, h, 6 * u)
  ctx.fill()
  ctx.strokeStyle = p.panelLine
  ctx.lineWidth = u
  rrect(ctx, x + u / 2, y + u / 2, w - u, h - u, 6 * u)
  ctx.stroke()
  const ix = x + 17 * u
  ctx.fillStyle = green
  ctx.beginPath()
  ctx.arc(ix + 11 * u, y + 27 * u, 11 * u, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, String(n), ix + 11 * u, y + 27 * u + 9.92 * u * 0.36, { f: font(700, 9.92 * u, 'latin'), color: c.card, align: 'center' })
  text(ctx, pattern, ix + 34 * u, y + 27 * u + 17.92 * u * 0.36, { f: font(700, 17.92 * u, 'serif'), color: c.ink })
  if (level) {
    const lz = 9.92 * u
    const lw = measure(ctx, level, font(700, lz, 'latin')) + 8 * u
    ctx.strokeStyle = p.panelLine
    ctx.lineWidth = u
    rrect(ctx, x + w - 17 * u - lw, y + 19 * u, lw, 15 * u, 3 * u)
    ctx.stroke()
    text(ctx, level, x + w - 17 * u - lw / 2, y + 19 * u + 7.5 * u + lz * 0.36, { f: font(700, lz, 'latin'), color: c.ink2, align: 'center' })
  }
  const gz = 13.12 * u
  let g = gloss
  while (g.length > 4 && measure(ctx, g, font(400, gz, 'latin')) > w - 45 * u - 17 * u) g = g.slice(0, -2).trimEnd() + '…'
  text(ctx, g, ix + 28 * u, y + 46 * u + gz * 0.9, { f: font(400, gz, 'latin'), color: c.ink })
  let px = ix + 28 * u
  const py = y + 70 * u
  const pz = 13.12 * u
  parts.forEach(([t, inPoint], i) => {
    if (i) {
      text(ctx, '+', px + 4 * u, py + 9.5 * u + pz * 0.36, { f: font(400, pz, 'latin'), color: c.ink2, align: 'center' })
      px += 12 * u
    }
    const tw = measure(ctx, t, font(600, pz, 'jp')) + 12 * u
    ctx.fillStyle = inPoint ? alpha(green, 0.16) : (p.paper ? p.card : '#17151a')
    rrect(ctx, px, py, tw, 19 * u, 4 * u)
    ctx.fill()
    text(ctx, t, px + tw / 2, py + 9.5 * u + pz * 0.36, { f: font(600, pz, 'jp'), color: c.ink, align: 'center' })
    px += tw + 4 * u
  })
  return h
}

/** A plate of the title slip's washi, framed as the slip is (its sumi
 *  edge, the shu rule inside it), for words set over the print: the
 *  print has no ground they can be read on at every hour. */
export function printPlate(ctx, p, x, y, w, h, u) {
  const { '--tpr-washi': washi, '--tpr-sumi': sumi, '--tpr-shu': shu } = APP_INKS
  ctx.save()
  shadow(ctx, p.hang)
  ctx.fillStyle = washi
  ctx.fillRect(x, y, w, h)
  ctx.restore()
  ctx.lineWidth = u
  ctx.strokeStyle = sumi
  ctx.strokeRect(x + u / 2, y + u / 2, w - u, h - u)
  ctx.strokeStyle = shu
  ctx.strokeRect(x + 3.5 * u, y + 3.5 * u, w - 7 * u, h - 7 * u)
  return { ink: sumi }
}

/** What a panel of the app stands on, per ground: its fill, rule and inks. */
export const faceOf = p => {
  const c = inks(p)
  return { bg: c.face, line: c.faceLine, ink: c.faceInk, soft: c.faceSoft }
}

/** A hex ink at an opacity, for a halo or a scrim over the print. */
export const inkAlpha = alpha

// ── 対戦, the duels (plan 281) ──────────────────────────────────────
// The duels' screens (plan 279, index.css's .pvp-*) as a sprint draws
// them, measured on the same 400px phone, dark and light: the duel's
// ticket and the stage's gold button, the race on its line, the
// question's page and the answers docked under it, the result face to
// face over the finish, the records under it, the Elo over its curve and
// the Elo board's rows. Where index.css gives a theme its own ink the
// palette does not carry, DUEL_INKS holds it, held equal to index.css by
// src/carousel.test.js.
export const DUEL_INKS = {
  sumi: { '--medal-gold': '#c99a3e', '--medal-silver': '#a8adb4', '--medal-bronze': '#a8703f', '--overlay-hover': 'rgba(255, 255, 255, 0.035)' },
  paper: { '--medal-gold': '#a97a25', '--medal-silver': '#8d939b', '--medal-bronze': '#8a5527', '--overlay-hover': 'rgba(28, 24, 17, 0.045)' },
}

function duelInks(p) {
  const d = DUEL_INKS[p.paper ? 'paper' : 'sumi']
  return {
    ...inks(p),
    surface: p.surface,
    line: p.surfaceLine,
    pass: p.pass,
    sel: p.selInk,
    gold: p.goldMid,
    right: RATING_INKS['--rating-correct'],
    wrong: p.rating[0],
    soft: p.onPanelSoft,
    medal: { 1: d['--medal-gold'], 2: d['--medal-silver'], 3: d['--medal-bronze'] },
    hover: d['--overlay-hover'],
  }
}

/** A panel of the app: its fill, its 1px rule inside its edge. */
function panelBox(ctx, x, y, w, h, r, fill, rule, u) {
  ctx.fillStyle = fill
  rrect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.strokeStyle = rule
  ctx.lineWidth = u
  rrect(ctx, x + u / 2, y + u / 2, w - u, h - u, r)
  ctx.stroke()
}

/** Stripes `period` apart, `width` wide, across the box, at a CSS
 *  gradient's angle (repeating-linear-gradient's stripes). */
function stripes(ctx, x, y, w, h, deg, period, width, color) {
  const a = (deg * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const R = Math.hypot(w, h)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  const n = Math.ceil(R / period) + 1
  for (let k = -n; k <= n; k++) {
    const off = k * period + width / 2
    const cx = x + w / 2 + dx * off
    const cy = y + h / 2 + dy * off
    ctx.beginPath()
    ctx.moveTo(cx + dy * R, cy - dx * R)
    ctx.lineTo(cx - dy * R, cy + dx * R)
    ctx.stroke()
  }
  ctx.restore()
}

/** The duel's ticket (.clrk-tk--paper.pvp-ticket): the cleared day's
 *  硬券 printed for two -- 対戦券 and its number, the two names and their
 *  levels either side of ⇄, the facts, the station that issued it and
 *  the sprint. `pulse` (0 to 1) swells the ⇄. Returns its height. */
export function duelTicket(ctx, p, x, y, w, u, { no, you, them, facts, foot, pulse = 0 }) {
  const { '--paper': paper, '--paper-ink-soft': soft } = APP_INKS
  const ink = p.onFill
  const factsH = facts.length * 21 + (facts.length - 1) * 6
  const h = (22 + 13.81 + 12 + 1 + 12 + 46.42 + 12 + factsH + 12 + 11.9 + 22) * u
  ctx.save()
  rrect(ctx, x, y, w, h, 10 * u)
  ctx.fillStyle = paper
  ctx.fill()
  // The paper's lattice: hairlines at ±60°, 7px apart, in the stamp's ink.
  stripes(ctx, x, y, w, h, 60, 7 * u, u, alpha(p.stamp, 0.055))
  stripes(ctx, x, y, w, h, -60, 7 * u, u, alpha(p.stamp, 0.055))
  ctx.restore()
  // Its double rule, 6px in: two hairlines a pixel apart.
  ctx.strokeStyle = alpha(p.stamp, 0.72)
  ctx.lineWidth = u
  rrect(ctx, x + 6.5 * u, y + 6.5 * u, w - 13 * u, h - 13 * u, 4 * u)
  ctx.stroke()
  rrect(ctx, x + 8.5 * u, y + 8.5 * u, w - 17 * u, h - 17 * u, 2 * u)
  ctx.stroke()
  const L = x + 28 * u
  const R = x + w - 28 * u
  const at = v => y + v * u
  // 対戦券 and its number, on one baseline.
  text(ctx, '対戦券', L, at(33.3), { f: font(700, 11.52 * u, 'jp'), color: ink, tr: 0.3 })
  text(ctx, `N° ${String(no).padStart(4, '0')}`, R, at(33.3), { f: font(700, 9.92 * u, 'latin'), color: soft, align: 'right', tr: TR_NAME })
  ctx.fillStyle = alpha(ink, 0.28)
  ctx.fillRect(L, at(47.81), R - L, u)
  // Who: the two names in the serif, their levels under them, ⇄ between.
  const nf = font(700, 20 * u, 'serif')
  const lf = font(700, 11.52 * u, 'latin')
  text(ctx, you.name, L, at(79.6), { f: nf, color: ink })
  text(ctx, you.level, L, at(102.1), { f: lf, color: soft })
  text(ctx, them.name, R, at(79.6), { f: nf, color: ink, align: 'right' })
  text(ctx, them.level, R, at(102.1), { f: lf, color: soft, align: 'right' })
  ctx.save()
  const vx = x + w / 2
  const vy = at(87.2)
  ctx.translate(vx, vy)
  ctx.scale(1 + 0.35 * pulse, 1 + 0.35 * pulse)
  text(ctx, '⇄', 0, 7.2 * u, { f: font(700, 20 * u, 'latin'), color: mix(p.stamp, ink, 0.7), align: 'center' })
  ctx.restore()
  // The facts, a term and its value a line.
  const ff = font(400, 13.12 * u, 'latin')
  const fb = font(700, 13.12 * u, 'latin')
  facts.forEach(([dt, dd], i) => {
    const by = at(119.23 + i * 27 + 15.2)
    text(ctx, dt, L, by, { f: ff, color: soft })
    text(ctx, dd, R, by, { f: fb, color: ink, align: 'right' })
  })
  const fy = at(119.23 + factsH + 12 + 9.55)
  text(ctx, foot[0], L, fy, { f: font(700, 9.92 * u, 'jp'), color: soft, tr: TR_NAME })
  text(ctx, foot[1], R, fy, { f: font(700, 9.92 * u, 'latin'), color: soft, align: 'right', tr: TR_NAME })
  return h
}

/** The stage's gold button (.btn-primary.exam-cover__go, 52px): the
 *  metal lit from the top, its word centred. `press` (0 to 1) sinks it. */
export function stageButton(ctx, p, x, y, w, u, label, { press = 0 } = {}) {
  const h = 52 * u
  const yy = y + press * u
  const g = ctx.createLinearGradient(0, yy, 0, yy + h)
  g.addColorStop(0, p.goldLit)
  g.addColorStop(1, p.goldMid)
  ctx.fillStyle = g
  rrect(ctx, x, yy, w, h, 6 * u)
  ctx.fill()
  if (press > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.14 * press})`
    rrect(ctx, x, yy, w, h, 6 * u)
    ctx.fill()
  }
  text(ctx, label, x + w / 2, yy + h / 2 + 15.2 * u * 0.36, { f: font(600, 15.2 * u, 'latin'), color: p.onFill, align: 'center' })
  return h
}

/** The race (.pvp-line-race, the owner's P2c): the minute as a bar, then
 *  the two trains on their line, the other's above. `rows`: [{ who, n,
 *  me, at }], `at` the train's share of its rail; `gap`, on the trailing
 *  train's rail, hatched from its nose to the leader's in the leader's
 *  ink, what it is worth over it: { row, from, span, fig, mine }.
 *  Returns its height. */
export function raceLine(ctx, p, x, y, w, u, { clock, rows, gap = null }) {
  const c = duelInks(p)
  ctx.fillStyle = c.line
  rrect(ctx, x, y, w, 6 * u, 3 * u)
  ctx.fill()
  if (clock > 0) {
    ctx.fillStyle = c.pass
    rrect(ctx, x, y, w * Math.min(1, clock), 6 * u, 3 * u)
    ctx.fill()
  }
  const py = y + 14 * u
  const ph = (16 + rows.length * 40 + (rows.length - 1) * 6 + 2) * u
  panelBox(ctx, x, py, w, ph, 8 * u, c.surface, c.line, u)
  const inner = w - 26 * u
  const rx = x + 13 * u + 68.39 * u + 8 * u
  const rw = inner - 68.39 * u - 8 * u - 36 * u
  const figF = font(700, 13.12 * u, 'latin')
  rows.forEach((r, i) => {
    const bottom = py + (9 + i * 46 + 40) * u
    caps(ctx, r.who, x + 13 * u, bottom - 8.4 * u, 9.92 * u, r.me ? c.ink : c.ink2)
    ctx.fillStyle = c.line
    ctx.fillRect(rx, bottom - 7 * u, rw + 36 * u, 2 * u)
    if (gap && gap.row === i && gap.span > 0) {
      const gx = rx + gap.from * rw + 36 * u
      const gw = gap.span * rw
      stripes(ctx, gx, bottom - 12 * u, gw, 12 * u, 135, 8 * u, 4 * u, alpha(gap.mine ? c.pass : c.ink2, 0.3))
      text(ctx, gap.fig, gx + 6 * u, bottom - 17.84 * u, { f: figF, color: gap.mine ? c.pass : c.ink2 })
    }
    const tx = rx + Math.max(0, Math.min(1, r.at)) * rw
    ctx.fillStyle = r.me ? c.pass : c.ink2
    ctx.beginPath()
    ctx.roundRect(tx, bottom - 12 * u, 36 * u, 12 * u, [0, 6 * u, 6 * u, 0])
    ctx.fill()
    text(ctx, r.fig, tx + 18 * u, bottom - 17.85 * u, { f: figF, color: r.me ? c.ink : c.ink2, align: 'center' })
  })
  return 14 * u + ph
}

/** The question's page (.exam-page.pvp-page): its kind, what it is worth
 *  now over the gold that runs out, the prompt (a word's reading over
 *  it); once answered, its edge in the verdict's ink. With `count` it is
 *  the count before the start. */
export function duelPage(ctx, p, x, y, w, h, u, { kind, worth, share = 0, prompt, reading, verdict = null, count = null, pop = 0 }) {
  // `pop` swells the count, or what the answer paid, as it lands.
  const c = duelInks(p)
  panelBox(ctx, x, y, w, h, 8 * u, c.card, verdict === 'right' ? c.right : verdict === 'wrong' ? c.wrong : c.border, u)
  if (count != null) {
    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    ctx.scale(1 + pop, 1 + pop)
    text(ctx, String(count), 0, 40 * u * 0.36, { f: font(700, 40 * u, 'latin'), color: c.ink, align: 'center' })
    ctx.restore()
    return
  }
  ctx.fillStyle = c.border
  ctx.fillRect(x + u, y + 52 * u, w - 2 * u, u)
  const kw = caps(ctx, kind, x + 17 * u, y + 30.07 * u, 9.92 * u, c.ink2)
  const worthW = 44.8 * u
  const d0 = x + 17 * u + kw + 12 * u
  const d1 = x + w - 17 * u - worthW - 12 * u
  ctx.fillStyle = c.line
  rrect(ctx, d0, y + 24.5 * u, d1 - d0, 4 * u, 2 * u)
  ctx.fill()
  if (share > 0) {
    ctx.fillStyle = c.gold
    rrect(ctx, d0, y + 24.5 * u, (d1 - d0) * share, 4 * u, 2 * u)
    ctx.fill()
  }
  ctx.save()
  ctx.translate(x + w - 17 * u, y + 26.5 * u)
  ctx.scale(1 + pop, 1 + pop)
  text(ctx, String(worth), 0, 6.44 * u, { f: font(700, 17.92 * u, 'latin'), color: c.sel, align: 'right' })
  ctx.restore()
  // The body: the reading over the prompt, the two centred in what is left.
  const top = y + 53 * u
  const room = y + h - u - top
  const block = (reading ? 24.32 + 6 : 0) + 48
  const by = top + (room - block * u) / 2
  if (reading) text(ctx, reading, x + w / 2, by + 17.9 * u, { f: font(400, 15.2 * u, 'jp'), color: c.ink2, align: 'center', tr: 0.3 })
  let z = 40 * u
  while (z > 20 * u && measure(ctx, prompt, font(500, z, 'jp')) > w - 34 * u) z -= u
  text(ctx, prompt, x + w / 2, by + ((reading ? 30.32 : 0) + 24) * u + z * 0.38, { f: font(500, z, 'jp'), color: c.ink, align: 'center' })
}

/** The answers docked under the thumb (.exam-tiles in .pvp-dock): a word's
 *  meanings one under another, a reading or a spelling two by two; the
 *  picked one, once answered, in the verdict's ink, never the right one
 *  shown. Each tile's centre is returned with the height. */
export function duelTiles(ctx, p, x, y, w, u, { choices, two, picked = null, verdict = null }) {
  const c = duelInks(p)
  const cols = two ? 2 : 1
  const gap = (two ? 8 : 6) * u
  const tw = (w - gap * (cols - 1)) / cols
  const th = 56 * u
  const centres = []
  choices.forEach((label, i) => {
    const tx = x + (i % cols) * (tw + gap)
    const ty = y + Math.floor(i / cols) * (th + gap)
    const mine = verdict && i === picked
    const ink = mine ? (verdict === 'right' ? c.right : c.wrong) : null
    ctx.strokeStyle = ink || alpha(c.onPanel, 0.18)
    ctx.lineWidth = u
    rrect(ctx, tx + u / 2, ty + u / 2, tw - u, th - u, 8 * u)
    ctx.stroke()
    const cx = tx + 23 * u
    const cy = ty + th / 2
    ctx.beginPath()
    if (ink) {
      ctx.fillStyle = ink
      ctx.arc(cx, cy, 16 * u, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.strokeStyle = c.soft
      ctx.lineWidth = 2 * u
      ctx.arc(cx, cy, 15 * u, 0, Math.PI * 2)
      ctx.stroke()
    }
    text(ctx, String(i + 1), cx, cy + 15.2 * u * 0.36, { f: font(700, 15.2 * u, 'latin'), color: ink ? c.panel : c.soft, align: 'center' })
    const room = tw - 47 * u - 8 * u
    if (two) {
      let z = 17.92 * u
      while (z > 11 * u && measure(ctx, label, font(600, z, 'jp')) > room) z -= 0.5 * u
      text(ctx, label, tx + 47 * u, cy + z * 0.38, { f: font(600, z, 'jp'), color: c.onPanel })
    } else {
      let z = 13.12 * u
      while (z > 10 * u && measure(ctx, label, font(500, z, 'latin')) > room) z -= 0.5 * u
      text(ctx, label, tx + 47 * u, cy + z * 0.36, { f: font(500, z, 'latin'), color: c.onPanel })
    }
    centres.push([cx + (tw - 46 * u) / 2, cy])
  })
  const rows = Math.ceil(choices.length / cols)
  return { h: rows * th + (rows - 1) * gap, centres }
}

/** The tiles' height for a question of `two` columns, as duelTiles sets them. */
export const tilesHeight = (n, two) => (two ? Math.ceil(n / 2) * 56 + (Math.ceil(n / 2) - 1) * 8 : n * 56 + (n - 1) * 6)

/** The result face to face (.pvp-face, the owner's R1a): the verdict and
 *  by how much, the two totals (the learner's underlined in the pass's
 *  ink) with who and how many right, the finish under them. `show`:
 *  { word, figs, finish } shares (0 to 1) of each part's entrance.
 *  Returns its height. */
export function faceOff(ctx, p, x, y, w, u, { word, win = true, by, sides, finish, show = {} }) {
  const c = duelInks(p)
  const h = 287.27 * u
  panelBox(ctx, x, y, w, h, 8 * u, c.surface, c.line, u)
  const ix = x + 23 * u
  const iw = w - 46 * u
  const fade = (k, fn) => {
    const f = show[k] ?? 1
    if (f <= 0) return
    ctx.save()
    ctx.globalAlpha *= f
    fn(f)
    ctx.restore()
  }
  fade('word', f => {
    ctx.save()
    ctx.translate(x + w / 2, y + 48.6 * u)
    const s = 1 + 0.3 * (1 - f)
    ctx.scale(s, s)
    text(ctx, word, 0, 0, { f: font(700, 27.2 * u, 'serif'), color: win ? c.ink : c.ink2, align: 'center' })
    ctx.restore()
    text(ctx, by, x + w / 2, y + 74.86 * u, { f: font(400, 13.12 * u, 'latin'), color: c.ink2, align: 'center' })
  })
  const pt = y + 102.64 * u
  ctx.fillStyle = c.line
  ctx.fillRect(ix + iw / 2, pt, u, 88.88 * u)
  fade('figs', () => {
    sides.forEach((s, i) => {
      const cx = ix + (iw / 2) * i + iw / 4
      const fw = text(ctx, s.fig, cx, pt + 34.4 * u, { f: font(700, 40 * u, 'latin'), color: c.ink, align: 'center' })
      if (s.me) {
        ctx.fillStyle = c.pass
        ctx.fillRect(cx - fw / 2, pt + 34.4 * u + 6.5 * u, fw, 3 * u)
      }
      caps(ctx, s.who, cx, pt + 57.5 * u, 9.92 * u, c.ink2, 'center')
      text(ctx, s.rights, cx, pt + 83.1 * u, { f: font(400, 13.12 * u, 'latin'), color: c.ink2, align: 'center' })
    })
  })
  const ft = y + 213.52 * u
  ctx.fillStyle = c.line
  ctx.fillRect(ix, ft, iw, u)
  const railX = ix + 76.39 * u
  const railW = iw - 76.39 * u - 32 * u
  finish.forEach((r, i) => {
    const top = ft + (13 + i * 21.88) * u
    caps(ctx, r.who, ix, top + 11.5 * u, 9.92 * u, r.me ? c.ink : c.ink2)
    ctx.fillStyle = c.line
    ctx.fillRect(railX, top + 6.94 * u, railW + 32 * u, 2 * u)
    const at = (show.finish ?? 1) * r.at
    ctx.fillStyle = r.me ? c.pass : c.ink2
    ctx.beginPath()
    ctx.roundRect(railX + at * railW, top + 0.94 * u, 32 * u, 14 * u, [0, 7 * u, 7 * u, 0])
    ctx.fill()
  })
  return h
}

/** The records under a result (.records.pvp-two): each a figure (its unit,
 *  or the Elo's move in its verdict's ink, after it) over its caption.
 *  `cells`: [{ value, unit, move: { text, up, pop }, label }]. Returns its height. */
export function recordsRow(ctx, p, x, y, w, u, cells) {
  const c = duelInks(p)
  const cw = (w - 2 * u - u * (cells.length - 1)) / cells.length
  const lf = font(700, 9.92 * u, 'latin')
  const labelLines = cells.map(cell => wrapCaps(ctx, cell.label, lf, cw - 24 * u))
  const blocks = labelLines.map(ls => 20 + 4 + ls.length * 15.87)
  const h = (Math.max(...blocks) + 24 + 2) * u
  ctx.save()
  rrect(ctx, x, y, w, h, 8 * u)
  ctx.fillStyle = c.line
  ctx.fill()
  ctx.clip()
  cells.forEach((cell, i) => {
    const cx = x + u + i * (cw + u)
    ctx.fillStyle = c.surface
    ctx.fillRect(cx, y + u, cw, h - 2 * u)
    const top = y + (h - blocks[i] * u) / 2
    const vx = cx + 12 * u
    const vb = top + 17.2 * u
    const vw = text(ctx, cell.value, vx, vb, { f: font(700, 20 * u, 'latin'), color: c.ink })
    if (cell.unit) text(ctx, cell.unit, vx + vw + 8 * u, vb, { f: font(600, 13.12 * u, 'latin'), color: c.ink2 })
    if (cell.move) {
      const mx = vx + vw + 8 * u
      const s = 1 + 0.6 * (cell.move.pop ?? 0)
      ctx.save()
      ctx.translate(mx, vb)
      ctx.scale(s, s)
      text(ctx, cell.move.text, 0, 0, { f: font(700, 13.12 * u, 'latin'), color: cell.move.up ? p.success : p.danger })
      ctx.restore()
    }
    labelLines[i].forEach((l, j) => text(ctx, l, vx, top + (24 + j * 15.87 + 11.5) * u, { f: lf, color: c.ink2, tr: TR.caption }))
  })
  ctx.restore()
  ctx.strokeStyle = c.line
  ctx.lineWidth = u
  rrect(ctx, x + u / 2, y + u / 2, w - u, h - u, 8 * u)
  ctx.stroke()
  return h
}

/** A caption's words in caps, wrapped to `maxW` at its tracking. */
function wrapCaps(ctx, str, f, maxW) {
  const words = str.toLocaleUpperCase().split(' ')
  const lines = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (!cur || measure(ctx, test, f, TR.caption) <= maxW) cur = test
    else { lines.push(cur); cur = word }
  }
  if (cur) lines.push(cur)
  return lines
}

// The curve's drawing box (components/pvp/parts.jsx's EloCurve): its
// viewBox, stretched to the card's width at its own height.
const CURVE_W = 320
const CURVE_H = 72

/** The Elo at the hall's head (.pvp-curve, the owner's G1): the figure
 *  over its curve, the last ranked duels, the level's start dashed
 *  under the line, the last duel a dot; where it started and its peak
 *  at the foot. `drawn` (0 to 1) is how much of the line is drawn, the
 *  dot at its head. Returns its height. */
export function eloCard(ctx, p, x, y, w, u, { cap, fig, trend, start, drawn = 1, foot = ['', ''], footShow = 1 }) {
  const c = duelInks(p)
  const h = 209.42 * u
  panelBox(ctx, x, y, w, h, 8 * u, c.surface, c.line, u)
  const ix = x + 17 * u
  const iw = w - 34 * u
  caps(ctx, cap, ix, y + 31.07 * u, 9.92 * u, c.ink2)
  text(ctx, fig, ix, y + 80.4 * u, { f: font(700, 40 * u, 'latin'), color: c.ink })
  // The curve, as EloCurve plots it in its viewBox (-4 -4, 328 x 80).
  const sy = y + 94 * u
  const all = start != null ? [...trend, start] : trend
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max(8, (hi - lo) * 0.15)
  const min = lo - pad
  const span = hi + pad - min
  const kx = iw / (CURVE_W + 8)
  const ky = (72 * u) / (CURVE_H + 8)
  const px = vx => ix + (vx + 4) * kx
  const py = vy => sy + (vy + 4) * ky
  const vxOf = i => (trend.length === 1 ? CURVE_W : (i / (trend.length - 1)) * CURVE_W)
  const vyOf = v => CURVE_H - ((v - min) / span) * CURVE_H
  if (start != null) {
    ctx.save()
    ctx.strokeStyle = c.border
    ctx.lineWidth = 1.5 * u
    ctx.setLineDash([4 * u, 4 * u])
    ctx.beginPath()
    ctx.moveTo(px(0), py(vyOf(start)))
    ctx.lineTo(px(CURVE_W), py(vyOf(start)))
    ctx.stroke()
    ctx.restore()
  }
  const pts = trend.map((v, i) => [px(vxOf(i)), py(vyOf(v))])
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]))
  let left = seg.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, drawn))
  ctx.save()
  ctx.strokeStyle = c.pass
  ctx.lineWidth = 2.5 * u
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(...pts[0])
  let head = pts[0]
  for (let i = 0; i < seg.length && left > 0; i++) {
    const f = Math.min(1, left / seg[i])
    head = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]
    ctx.lineTo(...head)
    left -= seg[i]
  }
  ctx.stroke()
  ctx.restore()
  if (drawn > 0) {
    ctx.fillStyle = c.pass
    ctx.beginPath()
    ctx.arc(head[0], head[1], 4 * u, 0, Math.PI * 2)
    ctx.fill()
  }
  if (footShow > 0) {
    ctx.save()
    ctx.globalAlpha *= footShow
    const fb = y + 187.36 * u
    ctx.strokeStyle = c.border
    ctx.lineWidth = 1.5 * u
    ctx.setLineDash([3 * u, 3 * u])
    ctx.beginPath()
    ctx.moveTo(ix, y + 183.45 * u)
    ctx.lineTo(ix + 16 * u, y + 183.45 * u)
    ctx.stroke()
    ctx.setLineDash([])
    text(ctx, foot[0], ix + 22 * u, fb, { f: font(400, 11.52 * u, 'latin'), color: c.ink2 })
    text(ctx, foot[1], ix + iw, fb, { f: font(400, 11.52 * u, 'latin'), color: c.ink2, align: 'right' })
    ctx.restore()
  }
  return h
}

/** The Elo board's rows (.banzuke, .leaderboard-row): the rank in its
 *  roundel (the three medals ringed), the name, the Elo at the edge; the
 *  learner's row lit with the pass's ink along its edge; the gap to the
 *  next place at the foot. `rows`: [{ rank, name, elo, me, dy }], `dy`
 *  moving a row by CSS pixels. Returns its height. */
export function boardRows(ctx, p, x, y, w, u, rows, { foot = '', footShow = 1 } = {}) {
  const c = duelInks(p)
  const rowH = 55 * u
  const h = rows.length * rowH + 18.42 * u + u
  panelBox(ctx, x, y, w, h, 6 * u, c.surface, c.line, u)
  ctx.save()
  rrect(ctx, x + u, y + u, w - 2 * u, h - 2 * u, 5 * u)
  ctx.clip()
  // The separators stand where the rows stand, the last over the foot; a
  // moving row is drawn over them.
  for (let i = 1; i <= rows.length; i++) {
    ctx.fillStyle = c.line
    ctx.fillRect(x + u, y + u + i * rowH - u, w - 2 * u, u)
  }
  const order = [...rows].sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0))
  for (const r of order) {
    const i = rows.indexOf(r)
    const top = y + u + i * rowH + (r.dy || 0) * u
    if (r.me) {
      // A row on its way to another place rides over the rows it passes.
      if (r.dy) {
        ctx.save()
        shadow(ctx, p.hang)
        ctx.fillStyle = c.surface
        ctx.fillRect(x + u, top, w - 2 * u, rowH - u)
        ctx.restore()
      }
      ctx.fillStyle = c.surface
      ctx.fillRect(x + u, top, w - 2 * u, rowH - u)
      ctx.fillStyle = c.hover
      ctx.fillRect(x + u, top, w - 2 * u, rowH - u)
      ctx.fillStyle = c.pass
      ctx.fillRect(x + u, top, 3 * u, rowH - u)
    }
    const cy = top + 27 * u
    const rx = x + 32 * u
    ctx.fillStyle = c.panel
    ctx.beginPath()
    ctx.arc(rx, cy, 15 * u, 0, Math.PI * 2)
    ctx.fill()
    const medal = c.medal[r.rank]
    if (medal) {
      ctx.strokeStyle = medal
      ctx.lineWidth = 1.5 * u
      ctx.beginPath()
      ctx.arc(rx, cy, 14.25 * u, 0, Math.PI * 2)
      ctx.stroke()
    }
    const rankInk = medal ? mix(medal, c.onPanel, r.rank === 3 ? 0.55 : 0.7) : c.soft
    text(ctx, String(r.rank), rx, cy + 13.12 * u * 0.36, { f: font(700, 13.12 * u, 'latin'), color: rankInk, align: 'center' })
    text(ctx, r.name, x + 59 * u, cy + 15.2 * u * 0.36, { f: font(700, 15.2 * u, 'latin'), color: c.ink })
    text(ctx, r.elo, x + w - 17 * u, cy + 13.12 * u * 0.36, { f: font(700, 13.12 * u, 'latin'), color: c.ink, align: 'right' })
  }
  ctx.restore()
  if (foot && footShow > 0) {
    ctx.save()
    ctx.globalAlpha *= footShow
    text(ctx, foot, x + 17 * u, y + u + rows.length * rowH + 13.36 * u, { f: font(400, 11.52 * u, 'latin'), color: c.ink2 })
    ctx.restore()
  }
  return h
}
