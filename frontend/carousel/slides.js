// ── カルーセル — the slides (plan 200) ──────────────────────────────
// A plan (sources.js) drawn as slides. Four directions, each the app's
// own idiom (DESIGN.md, "The idea"):
//   plates  駅名標  the station plates: a word is a stop on the line
//   board   発車標  the departure board: the words as departures
//   card    札      the study card, and the rating bar it ends on
//   exam    模試    the mock exam: the post opens on its question
// A direction is a style: the surface a slide is set on, how it titles a
// slide, how it draws a row of words, how it opens. Every other slide
// (the point at work, the stacked particles, the scene, the strokes …)
// is written once and set on the direction's surface.
//
// A colour keeps its meaning: a word wears the vocabulary line's pigment,
// a particle or an ending the grammar line's, a kanji the kanji line's;
// each source opens in its own line's (読書 verdigris, 翻訳 lapis, 文法
// pine …); your own lines in a scene are the pass's charcoal; the gold is
// the action (the metal) and nothing else.
import {
  FS, SP, R, TR, EDGE, RING, ASC, FORMATS, palette, font, alpha, shadow, noShadow, rrect, measure, text, caption,
  fit, paragraph, paragraphH, roundel, mark, metal, chevron, layoutSentence, drawSentence, lineOf, frame,
  ground, masthead, heading, pageMark, pages, strokeBox, marked, stamp,
} from './draw.js'
import { RATINGS_JP, formOf, tr, weldIf } from './strings.js'

export { FORMATS }

// ── Surfaces ──────────────────────────────────────────────────
function boardPanel(ctx, p, x, y, w, h) {
  ctx.save()
  shadow(ctx, p.board)
  ctx.fillStyle = p.panel
  rrect(ctx, x, y, w, h, R.panel)
  ctx.fill()
  ctx.restore()
}
function boardHead(ctx, p, x, y, w, left, right) {
  const h = FS.caption * 3.2
  ctx.fillStyle = p.gold
  ctx.beginPath()
  ctx.arc(x + SP[6], y + h / 2, 9, 0, Math.PI * 2)
  ctx.fill()
  caption(ctx, left, x + SP[6] + 26, y + h / 2 + FS.caption * 0.36, p.onPanelSoft)
  if (right) text(ctx, right, x + w - SP[6], y + h / 2 + FS.lead * 0.36, { f: font(700, FS.lead, 'latin'), color: p.gold, align: 'right' })
  ctx.fillStyle = p.panelLine
  ctx.fillRect(x, y + h, w, 2)
  return h + 2
}
const inner = (bx, by, bw, bh, padX = SP[7], padY = SP[7]) => ({
  x: bx + padX, y: by + padY, w: bw - padX * 2, h: bh - padY * 2, cx: bx + bw / 2, right: bx + bw - padX, bottom: by + bh - padY, W: bw, H: bh,
})
function studyCard(ctx, p, x, y, w, h, stripe) {
  ctx.fillStyle = p.surface
  rrect(ctx, x, y, w, h, R.panel)
  ctx.fill()
  ctx.strokeStyle = p.surfaceLine
  ctx.lineWidth = 2
  rrect(ctx, x + 1, y + 1, w - 2, h - 2, R.panel)
  ctx.stroke()
  if (stripe) {
    ctx.save()
    rrect(ctx, x, y, w, h, R.panel)
    ctx.clip()
    ctx.fillStyle = stripe
    ctx.fillRect(x, y, w, EDGE)
    ctx.restore()
  }
}
const cardInk = p => ({ ink: p.paper ? p.ink : p.onPanel, ink2: p.paper ? p.ink2 : p.onPanelSoft })

// Which line a slide belongs to, for the card's stripe.
const LINE_OF_KIND = {
  point: 'grammar', lesson: 'grammar', stack: 'grammar', watch: 'grammar', twist: 'grammar', usage: 'grammar',
  strokes: 'kanji', readings: 'kanji', kanareveal: 'kana', lookalike: 'kana', yourturn: 'sakubun', quiz: 'exam',
  answer: 'reading',
}

/** Set a slide's surface for a direction: the frame its content goes in, and its inks. */
function surface(dir, ctx, p, fr, line) {
  ground(ctx, p, fr)
  if (dir === 'board') {
    boardPanel(ctx, p, fr.x, fr.y, fr.w, fr.h)
    return { f: inner(fr.x, fr.y, fr.w, fr.h), ink: p.onPanel, ink2: p.onPanelSoft, dark: true, board: true }
  }
  if (dir === 'card') {
    studyCard(ctx, p, fr.x, fr.y, fr.w, fr.h, p.line[line] || p.line.reading)
    return { f: inner(fr.x, fr.y, fr.w, fr.h), ...cardInk(p), dark: !p.paper }
  }
  return { f: fr, ink: p.ink, ink2: p.ink2, dark: !p.paper }
}

/** A slide's title, as the direction sets it; returns the y under it. */
function title(c, str, y = c.f.y, right = '') {
  const { ctx, p, f } = c
  if (c.board) {
    ctx.fillStyle = p.gold
    ctx.beginPath()
    ctx.arc(f.x + 9, y + FS.caption * 0.62, 9, 0, Math.PI * 2)
    ctx.fill()
    caption(ctx, str, f.x + 30, y + FS.caption, c.ink2)
    if (right) text(ctx, right, f.right, y + FS.caption, { f: font(700, FS.lead, 'latin'), color: p.gold, align: 'right' })
    return y + FS.caption + SP[7]
  }
  const h = heading(ctx, p, f, str, y, c.ink)
  // A page count (2/3) or a level (N5), at the title's right.
  if (right) text(ctx, right, f.right, y + FS.heading * 0.8, { f: font(700, FS.lead, 'latin'), color: c.ink2, align: 'right' })
  return y + h + SP[6]
}

// ── Rows of words ─────────────────────────────────────────────
/** A word's sense, right-aligned and centred on `mid`: its gloss, and
 *  under it the senses after it (or a particle's form) when there is room. */
function senseBlock(ctx, word, rx, mid, rw, ih, ink, ink2) {
  const sub = word.sub ? fit(ctx, word.sub, { weight: 500, sizes: [FS.sm], maxW: rw, maxLines: 1, balanced: false }) : null
  const subH = sub ? paragraphH(sub) + SP[1] : 0
  const sizes = [FS.title, FS.lead, FS.body, FS.sm]
  let main = fit(ctx, word.main, { sizes, maxW: rw, maxH: ih - subH, lh: 1.12 })
  let withSub = !!sub
  if (sub && (main.cut || paragraphH(main, 1.12) + subH > ih)) {
    main = fit(ctx, word.main, { sizes, maxW: rw, maxH: ih, lh: 1.12 })
    withSub = false
  }
  const tall = paragraphH(main, 1.12) + (withSub ? subH : 0)
  let sy = mid - tall / 2
  sy += paragraph(ctx, main, rx, sy, ink, 'right', 1.12)
  if (withSub) paragraph(ctx, sub, rx, sy + SP[1], ink2, 'right')
}
const subOf = w => (w.kanji && w.reading ? (w.ro ? `${w.reading} · ${w.ro}` : w.reading) : w.ro)

/** One word as a hanging 駅名標: its number in a ring, its reading spaced
 *  over its name, its romaji under it, its sense on the right, the line's
 *  stripe along its foot. */
function plate(ctx, p, x, y, w, h, word) {
  const color = p.line[word.line]
  ctx.save()
  shadow(ctx, p.hang)
  ctx.fillStyle = p.surface
  rrect(ctx, x, y, w, h, R.plate)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = p.surfaceLine
  ctx.lineWidth = 2
  rrect(ctx, x + 1, y + 1, w - 2, h - 2, R.plate)
  ctx.stroke()
  ctx.save()
  rrect(ctx, x, y, w, h, R.plate)
  ctx.clip()
  ctx.fillStyle = color
  ctx.fillRect(x, y + h - EDGE * 1.4, w, EDGE * 1.4)
  ctx.restore()
  const pad = SP[6]
  const foot = EDGE * 1.4
  const ih = h - foot - SP[2]
  const mid = y + (h - foot) / 2
  const r = Math.min(40, h * 0.17)
  roundel(ctx, x + pad + r, mid, r, color, String(word.n), { ink: color, size: r * 0.95 })
  const nx = x + pad + r * 2 + SP[5]
  const leftW = w * 0.5 - (nx - x)
  const showReading = word.kanji && word.reading
  const rSize = FS.caption
  const above = showReading ? rSize * 1.15 : 0
  const below = word.ro ? FS.sm * 1.15 : 0
  let size = Math.min(ih - above - below, FS.display * 0.95)
  while (size > FS.lead && measure(ctx, word.t, font(700, size, 'serif')) > leftW) size -= 2
  let by = mid - (above + size + below) / 2
  if (showReading) {
    text(ctx, word.reading, nx, by + rSize * 0.92, { f: font(500, rSize, 'jp'), color: p.ink2, tr: TR.reading })
    by += above
  }
  text(ctx, word.t, nx, by + size * ASC, { f: font(700, size, 'serif'), color: p.ink })
  if (word.ro) text(ctx, word.ro, nx, by + size + FS.sm * 0.95, { f: font(500, FS.sm, 'latin'), color: p.ink2 })
  senseBlock(ctx, word, x + w - pad, mid, w * 0.46 - pad, ih, p.ink, p.ink2)
}

/** One word as a departure: its number in the metal's figure, the word
 *  over its type and its reading, its sense where the destination goes. */
function departure(ctx, p, f, cols, y, h, word) {
  const color = p.line[word.line]
  const mid = y + h / 2
  ctx.fillStyle = p.panelLine
  ctx.fillRect(f.x - SP[7], y, f.w + SP[7] * 2, 2)
  ctx.fillStyle = color
  ctx.fillRect(f.x - SP[7], y + SP[3], EDGE, h - SP[3] * 2)
  text(ctx, String(word.n).padStart(2, '0'), cols[0], mid + FS.title * 0.36, { f: font(700, FS.title, 'latin'), color: p.gold })
  const ww = (cols[2] - cols[1]) * 0.5
  let size = Math.min(h * 0.36, FS.display * 0.8)
  while (size > FS.title && measure(ctx, word.t, font(700, size, 'jp')) > ww) size -= 2
  const tf = font(700, FS.xs, 'latin')
  const label = String(word.pos || '').toLocaleUpperCase()
  const tw = label ? measure(ctx, label, tf, TR.caption) + SP[4] * 2 : 0
  const th = FS.xs * 1.9
  const block = size + SP[3] + th
  const wy = mid - block / 2
  text(ctx, word.t, cols[1], wy + size * ASC, { f: font(700, size, 'jp'), color: p.onPanel })
  const ty = wy + size + SP[3]
  if (label) {
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    rrect(ctx, cols[1], ty, tw, th, R.card)
    ctx.stroke()
    text(ctx, label, cols[1] + tw / 2, ty + th / 2 + FS.xs * 0.36, { f: tf, color: p.onPanel, align: 'center', tr: TR.caption })
  }
  const sub = word.kanji && word.reading ? word.reading : word.ro
  if (sub) {
    const subF = fit(ctx, sub, { weight: 500, sizes: [FS.sm, FS.caption, FS.xs], maxW: ww - tw - SP[4], maxLines: 1, balanced: false })
    text(ctx, subF.lines[0], cols[1] + (tw ? tw + SP[4] : 0), ty + th / 2 + subF.size * 0.36, { f: subF.f, color: p.onPanelSoft })
  }
  senseBlock(ctx, word, cols[2], mid, (cols[2] - cols[1]) * 0.46, h - SP[3] * 2, p.onPanel, p.onPanelSoft)
}

/** A row of the card's back: the word's line as a rail down its left. */
function cardRow(ctx, p, f, y, h, word, ink, ink2) {
  const mid = y + h / 2
  ctx.fillStyle = p.line[word.line]
  rrect(ctx, f.x, y + h * 0.16, EDGE, h * 0.68, EDGE / 2)
  ctx.fill()
  const x = f.x + EDGE + SP[6]
  let size = Math.min(h * 0.38, FS.display * 0.85)
  while (size > FS.title && measure(ctx, word.t, font(700, size, 'serif')) > f.w * 0.5) size -= 2
  const sub = subOf(word)
  const block = size + (sub ? SP[2] + FS.sm : 0)
  text(ctx, word.t, x, mid - block / 2 + size * ASC, { f: font(700, size, 'serif'), color: ink })
  if (sub) text(ctx, sub, x, mid + block / 2 - FS.sm * 0.15, { f: font(500, FS.sm, 'latin'), color: ink2 })
  senseBlock(ctx, word, f.right, mid, f.w * 0.44, h - SP[2], ink, ink2)
}

function latticeRow(ctx, p, f, y, h, word) {
  const color = p.line[word.line]
  const mid = y + h / 2
  const x = f.x + SP[6]
  roundel(ctx, x + 34, mid, 34, color, String(word.n), { ink: color, size: FS.lead })
  const wx = x + 68 + SP[5]
  let size = Math.min(h * 0.38, FS.display * 0.8)
  while (size > FS.title && measure(ctx, word.t, font(700, size, 'serif')) > f.w * 0.4) size -= 2
  const sub = subOf(word)
  const block = size + (sub ? SP[2] + FS.sm : 0)
  text(ctx, word.t, wx, mid - block / 2 + size * ASC, { f: font(700, size, 'serif'), color: p.ink })
  if (sub) text(ctx, sub, wx, mid + block / 2 - FS.sm * 0.15, { f: font(500, FS.sm, 'latin'), color: p.ink2 })
  senseBlock(ctx, word, f.right - SP[6], mid, f.w * 0.4, h - SP[4], p.ink, p.ink2)
}

/** The words slide, in the direction's own rows. */
function wordsSlide(dir, ctx, p, fr, plan, s, list, page, count) {
  const t = plan.t
  const name = s.title || t.words
  const pageLabel = count > 1 ? `${page}/${count}` : ''
  if (dir === 'board') {
    ground(ctx, p, fr)
    boardPanel(ctx, p, fr.x, fr.y, fr.w, fr.h)
    const hh = boardHead(ctx, p, fr.x, fr.y, fr.w, name, pageLabel)
    const f = inner(fr.x, fr.y, fr.w, fr.h)
    const cols = [f.x, f.x + 96, f.right]
    const capY = fr.y + hh + SP[5] + FS.xs
    t.columns.forEach((cap, i) => cap && caption(ctx, cap, cols[i], capY, p.onPanelSoft, i === 2 ? 'right' : 'left', FS.xs))
    let y = capY + SP[4]
    const h = Math.min((fr.bottom - SP[5] - y) / list.length, 230)
    for (const w of list) { departure(ctx, p, f, cols, y, h, w); y += h }
    return
  }
  if (dir === 'card') {
    const c = surface(dir, ctx, p, fr, s.line || plan.line)
    let y = c.f.y
    if (plan.hook.kind === 'sentence' || plan.hook.kind === 'prompt') {
      // The card's back: the sentence it asked, small, then its words.
      const L = layoutSentence(ctx, plan.hook.kind === 'sentence' ? plan.hook.rows : plan.slides.find(x => x.kind === 'answer')?.rows || [],
        { max: FS.display * 0.7, min: FS.lead, maxW: c.f.w - (pageLabel ? 90 : 0), maxLines: 2, script: plan.script === 'kana' ? 'kana' : 'furigana', rules: false, gap: 0.06 })
      drawSentence(ctx, L, c.f.x, y, 'left', () => ({ ink: c.ink2, rule: null, ruby: c.ink2 }))
      if (pageLabel) text(ctx, pageLabel, c.f.right, y + FS.lead * 0.8, { f: font(700, FS.lead, 'latin'), color: c.ink2, align: 'right' })
      y += L.h + SP[6]
    } else {
      y = title({ ...c, ctx, p }, name, y, pageLabel)
    }
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(c.f.x, y, c.f.w, 2)
    y += SP[5]
    const h = Math.min((c.f.bottom - y) / list.length, 220)
    for (const w of list) { cardRow(ctx, p, c.f, y, h, w, c.ink, c.ink2); y += h }
    return
  }
  ground(ctx, p, fr)
  let y = fr.y
  y += heading(ctx, p, fr, name, y)
  pageMark(ctx, p, fr, page, count, fr.y + FS.heading * 0.8, p.ink2)
  y += SP[6]
  if (dir === 'exam') {
    // The hairline lattice: the gap is the hairline.
    const h = Math.min((fr.bottom - y) / list.length, 230)
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(fr.x, y, fr.w, h * list.length)
    list.forEach((w, i) => {
      const ry = y + i * h
      ctx.fillStyle = p.surface
      ctx.fillRect(fr.x + 2, ry + 2, fr.w - 4, h - (i === list.length - 1 ? 4 : 2))
      latticeRow(ctx, p, fr, ry, h, w)
    })
    return
  }
  const gap = SP[4]
  const h = Math.min((fr.bottom - y - gap * (list.length - 1)) / list.length, 250)
  for (const w of list) { plate(ctx, p, fr.x, y, fr.w, h, w); y += h + gap }
}

// ── Pieces shared by the content slides ───────────────────────
/** A pill in a line's ring, a phrase in it (a point's form). */
function pill(ctx, str, x, y, maxW, color, ink) {
  const b = fit(ctx, str, { sizes: [FS.lead, FS.body, FS.sm], maxW: maxW - SP[6] * 2, maxLines: 1, balanced: false })
  const h = FS.lead * 2
  const w = measure(ctx, b.lines[0], b.f) + SP[6] * 2
  ctx.strokeStyle = color
  ctx.lineWidth = RING
  rrect(ctx, x + RING / 2, y + RING / 2, w - RING, h - RING, h / 2)
  ctx.stroke()
  text(ctx, b.lines[0], x + SP[6], y + h / 2 + b.size * 0.36, { f: b.f, color: ink })
  return h
}

/** Words set side by side, each with its label under it: the stretch of a
 *  sentence a point acts on. `items` [{ t, label, lit, line } | { gap }]. */
function chunkLayout(ctx, items, maxW, maxSize) {
  for (let size = maxSize; size >= FS.body; size -= 4) {
    const f = font(700, size, 'serif')
    const lf = font(700, Math.max(FS.xs, size * 0.3), 'latin')
    const gap = size * 0.34
    const placed = items.map(it => {
      if (it.gap) return { ...it, w: measure(ctx, '…', f), lw: 0 }
      if (it.op) return { ...it, w: measure(ctx, it.t, f), lw: 0 }
      if (it.arrow) return { ...it, w: size * 0.7, lw: 0 }
      const w = measure(ctx, it.t, f)
      const lw = it.label ? measure(ctx, it.label, lf) : 0
      return { ...it, w: Math.max(w, lw), tw: w, lw }
    })
    const total = placed.reduce((a, x) => a + x.w, 0) + gap * (placed.length - 1)
    if (total <= maxW || size - 4 < FS.body) {
      const labelH = items.some(x => x.label) ? Math.max(FS.xs, size * 0.3) * 1.6 : 0
      return { size, f, lf, gap, placed, w: total, h: size * 1.18 + EDGE + labelH }
    }
  }
}
function drawChunk(ctx, p, L, x, y, ink, ink2) {
  let at = x
  for (const it of L.placed) {
    if (it.gap) text(ctx, '…', at, y + L.size * ASC, { f: L.f, color: ink2 })
    else if (it.op) text(ctx, it.t, at, y + L.size * ASC, { f: L.f, color: ink2 })
    else if (it.arrow) chevron(ctx, at + L.size * 0.08, y + L.size * 0.5, L.size * 0.5, ink2)
    else {
      const color = p.line[it.line] || p.line.grammar
      text(ctx, it.t, at + (it.w - it.tw) / 2, y + L.size * ASC, { f: L.f, color: it.lit ? ink : ink })
      ctx.fillStyle = it.lit ? color : alpha(color, 0.45)
      rrect(ctx, at + (it.w - it.tw) / 2, y + L.size * 1.08, it.tw, EDGE, EDGE / 2)
      ctx.fill()
      if (it.label) text(ctx, it.label, at + it.w / 2, y + L.size * 1.08 + EDGE + Math.max(FS.xs, L.size * 0.3) * 1.15, { f: L.lf, color: it.lit ? color : ink2, align: 'center' })
    }
    at += it.w + L.gap
  }
}

/** The pattern itself: a lone marker in the grammar line's ring, a longer
 *  pattern on the line's rule, its meaning beside or under it. */
/** A long pattern broken at its slashes (こんな／そんな／あんな／どんな),
 *  each line as full as the width allows. */
function slashLines(ctx, pattern, f, maxW) {
  const parts = pattern.split('／')
  const lines = []
  for (const part of parts) {
    const last = lines[lines.length - 1]
    if (last != null && measure(ctx, `${last}／${part}`, f) <= maxW) lines[lines.length - 1] = `${last}／${part}`
    else lines.push(part)
  }
  return lines.map((l, i) => (i < lines.length - 1 ? `${l}／` : l))
}

function patternHead(c, pattern, meaningText) {
  const { ctx, p, f, ink } = c
  const short = [...pattern].length <= 2
  let ps = short ? FS.display * 1.25 : FS.display * 1.05
  const pf = () => font(700, ps, 'serif')
  while (ps > FS.heading && measure(ctx, pattern, pf()) > f.w * (short ? 0.4 : 1)) ps -= 4
  const lines = short ? [pattern] : slashLines(ctx, pattern, pf(), f.w)
  const r = ps * 0.75
  const mx = short ? f.x + r * 2 + SP[7] : f.x
  const meaning = fit(ctx, meaningText, { sizes: [FS.heading, FS.title, FS.lead], maxW: f.right - mx, maxLines: 3 })
  const ph = ps * 1.02 * lines.length
  const h = short ? Math.max(r * 2, paragraphH(meaning)) : ph + EDGE + SP[5] + paragraphH(meaning)
  return {
    h,
    draw(top) {
      if (short) {
        roundel(ctx, f.x + r, top + h / 2, r, p.line.grammar, pattern, { ink, fam: 'serif', size: ps })
        paragraph(ctx, meaning, mx, top + h / 2 - paragraphH(meaning) / 2, ink)
      } else {
        lines.forEach((l, i) => text(ctx, l, f.x, top + ps * 1.02 * i + ps * ASC, { f: pf(), color: ink }))
        ctx.fillStyle = p.line.grammar
        ctx.fillRect(f.x, top + ph, Math.min(Math.max(...lines.map(l => measure(ctx, l, pf()))), f.w), EDGE)
        paragraph(ctx, meaning, f.x, top + ph + EDGE + SP[5], ink)
      }
    },
  }
}

/** How a point works in its sentence: the words it acts on, and the line
 *  that says it with them (explain.js). */
function howBlock(c, how, maxH) {
  const { ctx, p, f, ink, ink2 } = c
  if (!how) return null
  const items = how.type === 'chain'
    ? [{ t: how.from.t, label: how.from.label, line: 'vocab' }, { arrow: true }, ...how.to.map(x => ({ ...x, line: 'grammar' }))]
    : how.items
  const L = chunkLayout(ctx, items, f.w, FS.display * 0.95)
  const line = fit(ctx, how.line, { weight: 500, sizes: [FS.title, FS.lead, FS.body, FS.sm], maxW: f.w, maxH: Math.max(FS.body * 3.5, maxH - L.h - SP[6] - FS.caption - SP[5]), lh: 1.25, balanced: false })
  const h = FS.caption + SP[5] + L.h + SP[6] + paragraphH(line, 1.25)
  return {
    h,
    draw(top, cap) {
      caption(ctx, cap, f.x, top + FS.caption, p.line.grammar)
      drawChunk(ctx, p, L, f.x, top + FS.caption + SP[5], ink, ink2)
      paragraph(ctx, line, f.x, top + FS.caption + SP[5] + L.h + SP[6], ink, 'left', 1.25)
    },
  }
}

// ── The content slides, written once ──────────────────────────
const KINDS = {
  /** 乗換: the point, at work in this sentence. */
  point(c, s) { pointSlide(c, s, c.plan.t.transfer, c.plan.t.inThisSentence) },
  /** The lesson: the point, its form, the rule, and one example at work. */
  lesson(c, s) { pointSlide(c, s, c.plan.t.rule, c.plan.t.inSentence) },

  /** Two particles side by side: what each does, and what the pair does. */
  stack(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const st = s.st
    let y = title(c, c.plan.t.stack)
    // に ＋ は ＝ には, each part's role under it.
    const parts = [...st.parts.map(x => ({ t: x.t, label: x.label, lit: true, line: 'grammar' })), { t: '＝', label: '', line: 'grammar' }, { t: st.key, label: '', lit: true, line: 'grammar' }]
    const eq = chunkLayout(ctx, [parts[0], { t: '＋', op: true }, parts[1], { t: '＝', op: true }, parts[3]], f.w, FS.display * 1.3)
    // The pair in its sentence: 会場 + には (+ the noun it describes).
    const inSentence = [{ t: st.host.t, label: st.host.label, line: 'vocab' }, { t: st.key, label: '', lit: true, line: 'grammar' }]
    if (st.next) inSentence.push({ gap: true }, { t: st.next.t, label: st.next.label, line: 'vocab' })
    const ch = chunkLayout(ctx, inSentence, f.w, FS.display)
    const room = f.bottom - y - eq.h - SP[8] - ch.h - SP[7]
    const line = fit(ctx, s.st.line, { weight: 500, sizes: [FS.title, FS.lead, FS.body, FS.sm], maxW: f.w, maxH: room, lh: 1.25, balanced: false })
    const used = eq.h + SP[8] + ch.h + SP[7] + paragraphH(line, 1.25)
    y += Math.max(0, (f.bottom - y - used) * 0.3)
    drawChunk(ctx, p, eq, f.x, y, ink, ink2)
    y += eq.h + SP[8]
    drawChunk(ctx, p, ch, f.x, y, ink, ink2)
    y += ch.h + SP[7]
    paragraph(ctx, line, f.x, y, ink, 'left', 1.25)
  },

  /** What the point is not: the catalogue's caution, and its rival. */
  watch(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const pt = s.pt
    const lang = c.plan.lang
    let y = title(c, c.plan.t.watch)
    const careful = tr(pt.careful, lang)
    const cmp = pt.compare
    const cmpText = cmp ? tr(cmp, lang) : ''
    const vsSize = FS.display
    const room = f.bottom - y - (cmp ? vsSize * 2 + SP[8] : 0)
    const a = careful ? fit(ctx, careful, { weight: 700, sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxH: cmp ? room * 0.5 : room, lh: 1.25, balanced: false }) : null
    const b = cmpText ? fit(ctx, cmpText, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxH: room - (a ? paragraphH(a, 1.25) + SP[8] : 0), lh: 1.3, balanced: false }) : null
    if (a) y += paragraph(ctx, a, f.x, y, ink, 'left', 1.25) + SP[8]
    if (cmp) {
      // The point and its rival, side by side.
      let size = vsSize
      const vf = () => font(700, size, 'serif')
      const vs = ' ／ '
      while (size > FS.title && measure(ctx, s.pattern + vs + cmp.p, vf()) > f.w) size -= 4
      if (measure(ctx, s.pattern + vs + cmp.p, vf()) <= f.w) {
        const w1 = text(ctx, s.pattern, f.x, y + size * ASC, { f: vf(), color: ink })
        ctx.fillStyle = p.line.grammar
        ctx.fillRect(f.x, y + size * 1.05, w1, EDGE)
        const w2 = text(ctx, vs, f.x + w1, y + size * ASC, { f: vf(), color: ink2 })
        text(ctx, cmp.p, f.x + w1 + w2, y + size * ASC, { f: vf(), color: ink2 })
        y += size * 1.05 + EDGE + SP[6]
      } else {
        // Too long for one line: the point, then its rival under it.
        while (size > FS.lead && Math.max(measure(ctx, s.pattern, vf()), measure(ctx, `／ ${cmp.p}`, vf())) > f.w) size -= 4
        const w1 = text(ctx, s.pattern, f.x, y + size * ASC, { f: vf(), color: ink })
        ctx.fillStyle = p.line.grammar
        ctx.fillRect(f.x, y + size * 1.05, w1, EDGE)
        y += size * 1.05 + EDGE + SP[3]
        text(ctx, `／ ${cmp.p}`, f.x, y + size * ASC, { f: vf(), color: ink2 })
        y += size * 1.05 + SP[6]
      }
      if (b) paragraph(ctx, b, f.x, y, ink2, 'left', 1.3)
    }
  },

  /** 終点: what the sentence says, then the sentence read and its romaji. */
  answer(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = c.board ? title(c, c.plan.t.arrived) : title(c, s.title || c.plan.t.terminus)
    const room = f.bottom - y
    const tr2 = fit(ctx, s.translation, { sizes: [FS.display, FS.display * 0.85, FS.heading, FS.title, FS.lead], maxW: f.w, maxH: room * 0.42, lh: 1.1 })
    const ro = fit(ctx, s.romaji, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxH: room * 0.2, balanced: false })
    const between = SP[5] + SP[8] + EDGE + SP[8]
    const L = layoutSentence(ctx, s.rows, { max: FS.display * 1.05, min: FS.body, maxW: f.w, maxLines: 4, maxH: room - paragraphH(tr2, 1.1) - paragraphH(ro) - between, script: c.plan.script === 'kana' ? 'kana' : 'furigana' })
    const total = L.h + paragraphH(ro) + between + paragraphH(tr2, 1.1)
    y += Math.max(0, (room - total) * 0.35)
    drawSentence(ctx, L, f.x, y, 'left', u => ({ ink, rule: lineOf(p, u.row), ruby: ink2 }))
    y += L.h + SP[5]
    y += paragraph(ctx, ro, f.x, y, ink2)
    y += SP[8]
    ctx.fillStyle = p.line[c.plan.line] || p.line.reading
    ctx.fillRect(f.x, y, SP[9], EDGE)
    y += EDGE + SP[8]
    paragraph(ctx, tr2, f.x, y, ink, 'left', 1.1)
  },

  /** A kanji (or a kana) written stroke by stroke, as a practice sheet prints it. */
  strokes(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const k = s.k
    const lang = c.plan.lang
    let y = title(c, c.plan.t.write)
    const n = k.s.d.length
    const big = Math.min(f.w * 0.52, f.h * 0.4)
    ctx.save()
    ctx.translate(f.x, y)
    ctx.scale(big / 109, big / 109)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3.2
    ctx.strokeStyle = ink
    k.s.d.forEach(d => ctx.stroke(new Path2D(d)))
    ctx.restore()
    const color = s.kana ? p.line.kana : p.line.kanji
    if (k.s.n.length === n) {
      const nf = font(700, Math.max(big * 0.065, FS.xs), 'latin')
      k.s.n.forEach(([nx, ny], i) => text(ctx, String(i + 1), f.x + nx * big / 109, y + ny * big / 109, { f: nf, color }))
    }
    // Beside it: the count, one on'yomi and one kun'yomi, its meaning.
    const ix = f.x + big + SP[7]
    const iw = f.right - ix
    let iy = y + SP[3]
    const figF = font(700, FS.display * 1.1, 'latin')
    text(ctx, String(n), ix, iy + FS.display * 0.9, { f: figF, color })
    iy += FS.display * 1.05
    caption(ctx, c.plan.t.strokes(n), ix, iy + FS.caption, ink2)
    iy += FS.caption + SP[6]
    const rf = font(500, FS.title, 'jp')
    for (const on of (k.on || []).slice(0, 1)) {
      text(ctx, on, ix, iy + FS.title * 0.9, { f: rf, color: ink, tr: TR.term })
      iy += FS.title * 1.35
    }
    for (const [stem, oku] of (k.kun || []).slice(0, 1)) {
      const w = text(ctx, stem, ix, iy + FS.title * 0.9, { f: rf, color: ink, tr: TR.term })
      if (oku) text(ctx, oku, ix + w + TR.term * FS.title, iy + FS.title * 0.9, { f: rf, color: ink2, tr: TR.term })
      iy += FS.title * 1.35
    }
    iy += SP[3]
    const meaning = (((lang === 'fr' && k.fr?.length) ? k.fr : k.en) || []).slice(0, 2).join(', ')
    const left = y + big - iy
    if (meaning && left >= FS.lead * 1.1) {
      const b = fit(ctx, weldIf(lang, meaning), { sizes: [FS.title, FS.lead, FS.body], maxW: iw, maxLines: 2, maxH: left, balanced: false })
      paragraph(ctx, b, ix, iy, ink)
    }
    y += big + SP[7]
    const room = f.bottom - y
    const cols = n <= 8 ? n : n <= 16 ? Math.ceil(n / 2) : Math.ceil(n / 3)
    const rows = Math.ceil(n / cols)
    const gap = SP[2]
    const size = Math.min((f.w - gap * (cols - 1)) / cols, (room - gap * (rows - 1)) / rows, f.w / 5)
    const gx = f.x + (f.w - (cols * size + (cols - 1) * gap)) / 2
    for (let i = 0; i < n; i++) {
      const cx = gx + (i % cols) * (size + gap)
      const cy = y + Math.floor(i / cols) * (size + gap)
      ctx.strokeStyle = c.board ? p.panelLine : p.surfaceLine
      ctx.lineWidth = 2
      rrect(ctx, cx + 1, cy + 1, size - 2, size - 2, R.card)
      ctx.stroke()
      strokeBox(ctx, k, cx + size * 0.08, cy + size * 0.08, size * 0.84, i, color, ink2, null)
    }
  },

  /** A twist of the tour: two forms side by side, and why they differ. */
  twist(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, c.plan.t.twist)
    caption(ctx, s.notion, f.x, y + FS.caption, p.line.grammar)
    y += FS.caption + SP[8]
    const sizes = [FS.word, FS.display * 1.4, FS.display * 1.2, FS.display, FS.heading]
    let size = sizes[sizes.length - 1]
    for (const z of sizes) if (s.pair.every(x => measure(ctx, x, font(700, z, 'serif')) <= f.w)) { size = z; break }
    const sf = font(700, size, 'serif')
    text(ctx, s.pair[0], f.x, y + size * ASC, { f: sf, color: ink2 })
    y += size * 1.15
    ctx.save()
    ctx.translate(f.x + size * 0.45, y + size * 0.1)
    ctx.rotate(Math.PI / 2)
    chevron(ctx, 0, 0, size * 0.6, p.line.grammar)
    ctx.restore()
    y += size * 0.9
    text(ctx, s.pair[1], f.x, y + size * ASC, { f: sf, color: ink })
    y += size * 1.15 + SP[7]
    if (s.why) {
      const b = fit(ctx, s.why, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxH: f.bottom - y, lh: 1.3, balanced: false })
      paragraph(ctx, b, f.x, y, ink2, 'left', 1.3)
    }
  },

  /** Another use of the point, in a sentence of the tour. */
  usage(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, c.plan.t.another)
    caption(ctx, s.notion, f.x, y + FS.caption, p.line.grammar)
    y += FS.caption + SP[7]
    const room = f.bottom - y
    const why = s.why ? fit(ctx, s.why, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxH: room * 0.4, lh: 1.3, balanced: false }) : null
    const trB = fit(ctx, s.tr, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxLines: 3 })
    const L = layoutSentence(ctx, s.rows, { max: FS.display * 1.05, min: FS.lead, maxW: f.w, maxLines: 3, maxH: room - paragraphH(trB) - (why ? paragraphH(why, 1.3) + SP[8] : 0) - SP[5], script: c.plan.script, gap: 0.08 })
    drawSentence(ctx, L, f.x, y, 'left', u => ({ ink, rule: u.row.lit ? p.line.grammar : null, ruby: ink2 }))
    y += L.h + SP[5]
    y += paragraph(ctx, trB, f.x, y, ink2) + SP[8]
    if (why) paragraph(ctx, why, f.x, y, ink, 'left', 1.3)
  },

  /** Example sentences: each on its rail, the point (or the word) lit. */
  examples(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, s.title || c.plan.t.examples)
    const color = p.line[s.line || 'grammar']
    const n = s.items.length
    const gap = SP[7]
    const each = (f.bottom - y - gap * (n - 1)) / n
    for (const it of s.items) {
      const trB = fit(ctx, it.tr, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w - SP[7], maxLines: 2, balanced: false })
      const L = layoutSentence(ctx, it.rows, { max: FS.display * 0.85, min: FS.body, maxW: f.w - SP[7], maxLines: 3, maxH: Math.min(each, 420) - paragraphH(trB) - SP[3], script: c.plan.script, gap: 0.06 })
      const h = L.h + SP[3] + paragraphH(trB)
      ctx.fillStyle = color
      rrect(ctx, f.x, y + SP[1], EDGE, h - SP[2], EDGE / 2)
      ctx.fill()
      drawSentence(ctx, L, f.x + SP[7], y, 'left', u => ({ ink, rule: u.row.lit ? color : null, ruby: ink2 }))
      paragraph(ctx, trB, f.x + SP[7], y + L.h + SP[3], ink2)
      y += h + gap
    }
  },

  /** The point at work in a conversation at a station: the other person's
   *  lines on the panel, yours in the pass's charcoal. */
  scene(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, c.plan.t.scene)
    // Where it happens, on a small station plate.
    const pf = font(700, FS.heading, 'serif')
    const pw = measure(ctx, s.place, pf) + SP[6] * 2
    const ph = FS.heading * 1.5
    ctx.fillStyle = c.dark ? p.surfaceLine : p.surface
    rrect(ctx, f.x, y, pw, ph, R.plate)
    ctx.fill()
    ctx.fillStyle = p.line.grammar
    ctx.fillRect(f.x, y + ph - EDGE, pw, EDGE)
    text(ctx, s.place, f.x + SP[6], y + ph / 2 + FS.heading * 0.36, { f: pf, color: ink })
    y += ph + SP[7]
    const note = s.note ? fit(ctx, s.note, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxLines: 3, balanced: false }) : null
    const room = f.bottom - y - (note ? paragraphH(note, 1.3) + SP[7] : 0)
    const each = Math.min(room / s.lines.length - SP[5], 330)
    const bw = f.w * 0.82
    for (const l of s.lines) {
      const mine = l.who === 'me'
      const trB = fit(ctx, l.tr, { weight: 500, sizes: [FS.body, FS.sm, FS.caption], maxW: bw - SP[6] * 2, maxLines: 2, balanced: false })
      const L = layoutSentence(ctx, l.rows, { max: FS.heading, min: FS.body, maxW: bw - SP[6] * 2, maxLines: 2, maxH: each - paragraphH(trB) - SP[5] * 2 - FS.caption * 1.6, script: c.plan.script, rules: false, gap: 0.04 })
      const who = mine ? c.plan.t.you : s.them
      const h = FS.caption * 1.6 + L.h + SP[2] + paragraphH(trB) + SP[5] * 2
      const bx = mine ? f.right - bw : f.x
      ctx.fillStyle = mine ? p.pass : (c.dark ? p.card : p.surface)
      rrect(ctx, bx, y, bw, h, R.panel)
      ctx.fill()
      if (!mine && !c.dark) { ctx.strokeStyle = p.surfaceLine; ctx.lineWidth = 2; rrect(ctx, bx + 1, y + 1, bw - 2, h - 2, R.panel); ctx.stroke() }
      const bInk = mine ? p.onPanel : ink
      const bInk2 = mine ? p.onPanelSoft : ink2
      caption(ctx, who, bx + SP[6], y + SP[5] + FS.caption, bInk2, 'left', FS.xs)
      drawSentence(ctx, L, bx + SP[6], y + SP[5] + FS.caption * 1.6, 'left', () => ({ ink: bInk, rule: null, ruby: bInk2 }))
      paragraph(ctx, trB, bx + SP[6], y + SP[5] + FS.caption * 1.6 + L.h + SP[2], bInk2)
      y += h + SP[5]
    }
    if (note) paragraph(ctx, note, f.x, y + SP[4], ink2, 'left', 1.3)
  },

  /** A question, and on the next slide its answer. */
  quiz(c, s) { quizSlide(c, s.quiz, s.revealed, s.title) },

  /** A word, revealed: its reading over it, its romaji, its sense. */
  reveal(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, c.plan.t.answer, f.y, s.level)
    const row = { t: s.text, fu: s.fu, k: 'word', ro: s.romaji }
    const main = fit(ctx, s.main, { sizes: [FS.display, FS.heading, FS.title], maxW: f.w, maxLines: 2 })
    const sub = s.sub ? fit(ctx, s.sub, { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w, maxLines: 2 }) : null
    const room = f.bottom - y - paragraphH(main) - (sub ? paragraphH(sub) + SP[3] : 0) - FS.lead * 1.6 - SP[8] * 2
    const L = layoutSentence(ctx, [row], { max: FS.glyph, min: FS.display, maxW: f.w, maxLines: 1, maxH: room, script: 'furigana', rules: false })
    const total = L.h + FS.lead * 1.6 + SP[8] + paragraphH(main) + (sub ? paragraphH(sub) + SP[3] : 0)
    y += Math.max(0, (f.bottom - y - total) / 2)
    drawSentence(ctx, L, f.cx, y, 'center', () => ({ ink, rule: null, ruby: ink2 }))
    y += L.h
    text(ctx, s.romaji, f.cx, y + FS.lead * 1.1, { f: font(500, FS.lead, 'latin'), color: ink2, align: 'center' })
    y += FS.lead * 1.6 + SP[8]
    ctx.fillStyle = p.line.vocab
    ctx.fillRect(f.cx - SP[9] / 2, y - SP[6], SP[9], EDGE)
    y += paragraph(ctx, main, f.cx, y, ink, 'center')
    if (sub) paragraph(ctx, sub, f.cx, y + SP[3], ink2, 'center')
  },

  /** A kana, revealed: its romaji, and its twin in the other script. */
  kanareveal(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    let y = title(c, t.answer)
    const gs = Math.min(FS.glyph * 1.2, f.h * 0.34)
    const total = gs * 1.05 + SP[6] + FS.display * 1.4 + (s.twin ? SP[8] + FS.heading * 2 : 0)
    y += Math.max(0, (f.bottom - y - total) / 2)
    text(ctx, s.k, f.cx, y + gs * ASC, { f: font(700, gs, 'serif'), color: ink, align: 'center' })
    y += gs * 1.05 + SP[6]
    text(ctx, s.ro, f.cx, y + FS.display * 1.1, { f: font(700, FS.display * 1.3, 'latin'), color: p.line.kana, align: 'center' })
    y += FS.display * 1.4
    if (s.twin) {
      y += SP[8]
      caption(ctx, t.otherScript[s.set], f.cx, y + FS.caption, ink2, 'center')
      text(ctx, s.twin, f.cx, y + FS.caption + SP[4] + FS.heading, { f: font(700, FS.heading * 1.2, 'serif'), color: ink, align: 'center' })
    }
  },

  /** A kanji's readings: its on'yomi and kun'yomi, and what it means. */
  readings(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    let y = title(c, t.readings, f.y, s.level)
    const gs = Math.min(FS.glyph * 1.1, f.w * 0.36)
    text(ctx, s.char, f.x, y + gs * ASC, { f: font(700, gs, 'serif'), color: ink })
    ctx.fillStyle = p.line.kanji
    ctx.fillRect(f.x, y + gs * 1.02, gs, EDGE)
    const ix = f.x + gs + SP[8]
    let iy = y
    const rf = font(500, FS.heading, 'jp')
    const group = (label, list, draw) => {
      if (!list.length) return
      caption(ctx, label, ix, iy + FS.caption, p.line.kanji)
      iy += FS.caption + SP[4]
      for (const r of list) { draw(r); iy += FS.heading * 1.3 }
      iy += SP[5]
    }
    group(t.on, s.on, r => text(ctx, r, ix, iy + FS.heading * 0.9, { f: rf, color: ink, tr: TR.term }))
    group(t.kun, s.kun, ([stem, oku]) => {
      const w = text(ctx, stem, ix, iy + FS.heading * 0.9, { f: rf, color: ink, tr: TR.term })
      if (oku) text(ctx, oku, ix + w + TR.term * FS.heading, iy + FS.heading * 0.9, { f: rf, color: ink2, tr: TR.term })
    })
    y = Math.max(y + gs * 1.02 + EDGE + SP[8], iy + SP[6])
    const b = fit(ctx, s.meaning, { sizes: [FS.display, FS.heading, FS.title], maxW: f.w, maxH: f.bottom - y, lh: 1.15 })
    paragraph(ctx, b, f.x, y, ink, 'left', 1.15)
  },

  /** Kana a learner mixes up, side by side, and how to tell them apart. */
  lookalike(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, c.plan.t.lookalike)
    const n = s.items.length
    const gap = SP[6]
    const cell = Math.min((f.w - gap * (n - 1)) / n, f.h * 0.42)
    const x0 = f.x + (f.w - (cell * n + gap * (n - 1))) / 2
    s.items.forEach((it, i) => {
      const x = x0 + i * (cell + gap)
      const here = it.k === s.here
      ctx.strokeStyle = here ? p.line.kana : (c.board ? p.panelLine : p.surfaceLine)
      ctx.lineWidth = here ? RING : 2
      rrect(ctx, x + RING / 2, y + RING / 2, cell - RING, cell - RING, R.card)
      ctx.stroke()
      text(ctx, it.k, x + cell / 2, y + cell * 0.5 + cell * 0.62 * 0.36, { f: font(700, cell * 0.62, 'serif'), color: ink, align: 'center' })
      text(ctx, it.ro, x + cell / 2, y + cell + SP[5] + FS.title * 0.8, { f: font(700, FS.title, 'latin'), color: here ? p.line.kana : ink2, align: 'center' })
    })
    y += cell + SP[5] + FS.title + SP[8]
    const b = fit(ctx, s.tip, { weight: 500, sizes: [FS.heading, FS.title, FS.lead], maxW: f.w, maxH: f.bottom - y, lh: 1.25, balanced: false })
    paragraph(ctx, b, f.x, y, ink, 'left', 1.25)
  },

  /** A page of a passage: its sentences set as a paragraph. */
  passage(c, s) {
    const { ctx, f, ink, ink2 } = c
    let y = title(c, c.plan.t.read, f.y, s.count > 1 ? `${s.page}/${s.count}` : '')
    if (s.page === 1) {
      const tb = fit(ctx, s.title, { fam: 'serif', sizes: [FS.heading, FS.title], maxW: f.w, maxLines: 2 })
      y += paragraph(ctx, tb, f.x, y, ink) + SP[6]
    }
    for (const L of s.layouts) {
      drawSentence(ctx, L, f.x, y, 'left', () => ({ ink, rule: null, ruby: ink2 }))
      y += L.h + SP[4]
    }
  },

  /** 作文: the reader's turn to write, in the comments. */
  yourturn(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    let y = title(c, t.yourTurn)
    const color = p.line.sakubun
    const line = fit(ctx, s.text, { sizes: [FS.display, FS.heading, FS.title, FS.lead], maxW: f.w, maxH: (f.bottom - y) * (s.model ? 0.34 : 0.6), lh: 1.18 })
    const model = s.model ? layoutSentence(ctx, s.model.rows, { max: FS.display * 0.8, min: FS.lead, maxW: f.w - SP[7], maxLines: 2, maxH: (f.bottom - y) * 0.24, script: c.plan.script, gap: 0.06, rules: false }) : null
    const mtr = s.model ? fit(ctx, s.model.tr, { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w - SP[7], maxLines: 2, balanced: false }) : null
    const total = paragraphH(line) + SP[7] + (s.form ? FS.lead * 2 + SP[8] : 0) + (model ? FS.caption + SP[4] + model.h + SP[3] + paragraphH(mtr) + SP[8] : 0) + FS.display
    y += Math.max(0, (f.bottom - y - total) * 0.4)
    y += paragraph(ctx, line, f.x, y, ink) + SP[7]
    if (s.form) y += pill(ctx, s.form, f.x, y, f.w, color, ink) + SP[8]
    if (model) {
      caption(ctx, t.like, f.x, y + FS.caption, ink2)
      y += FS.caption + SP[4]
      ctx.fillStyle = color
      rrect(ctx, f.x, y, EDGE, model.h + SP[3] + paragraphH(mtr), EDGE / 2)
      ctx.fill()
      drawSentence(ctx, model, f.x + SP[7], y, 'left', () => ({ ink, rule: null, ruby: ink2 }))
      paragraph(ctx, mtr, f.x + SP[7], y + model.h + SP[3], ink2)
      y += model.h + SP[3] + paragraphH(mtr) + SP[8]
    }
    ctx.save()
    ctx.translate(f.x + FS.display * 0.3, y)
    ctx.rotate(Math.PI / 2)
    chevron(ctx, 0, 0, FS.display * 0.6, p.gold)
    ctx.restore()
  },

  outro(c) {
    const { ctx, p, f, ink, ink2 } = c
    const size = Math.min(f.w * 0.42, f.h * 0.3)
    const line = fit(ctx, c.plan.t.outro, { sizes: [FS.heading, FS.title], maxW: f.w * 0.9, maxLines: 3 })
    const handle = c.plan.handle
    const total = size + SP[7] + FS.display + SP[6] + paragraphH(line) + (handle ? SP[7] + FS.title : 0)
    let y = f.y + (f.h - total) / 2
    mark(ctx, f.cx - size / 2, y, size, ink, p.gold)
    y += size + SP[7]
    text(ctx, 'Tsuji', f.cx, y + FS.display * 0.8, { f: font(700, FS.display, 'latin'), color: ink, align: 'center' })
    y += FS.display + SP[6]
    y += paragraph(ctx, line, f.cx, y, ink2, 'center')
    if (handle) text(ctx, handle, f.cx, y + SP[7] + FS.title * 0.8, { f: font(700, FS.title, 'latin'), color: p.gold, align: 'center' })
  },
}

/** The point (or the lesson): pattern, meaning, form, then how it works in
 *  a sentence, then the catalogue's rule in whatever room is left. */
function pointSlide(c, s, name, howCaption) {
  const { ctx, p, f, ink, ink2 } = c
  const lang = c.plan.lang
  const pt = s.pt
  let y = title(c, name)
  const head = patternHead(c, s.pattern, tr(pt, lang))
  const form = formOf(pt, lang)
  const formH = form ? FS.lead * 2 + SP[7] : 0
  const room = f.bottom - y - head.h - SP[7] - formH
  // The point at work in this sentence comes first; the catalogue's
  // general rule takes what room is left.
  const how = howBlock(c, s.how, room)
  const rule = tr(pt.rule, lang)
  const ruleRoom = room - (how ? how.h + SP[8] : 0)
  const ruleB = rule && ruleRoom > FS.body * 2.4
    ? fit(ctx, rule, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxH: ruleRoom, lh: 1.32, balanced: false })
    : null
  const used = head.h + SP[7] + formH + (how ? how.h + SP[8] : 0) + (ruleB ? paragraphH(ruleB, 1.32) : 0)
  y += Math.max(0, (f.bottom - y - used) * 0.3)
  head.draw(y)
  y += head.h + SP[7]
  if (form) y += pill(ctx, form, f.x, y, f.w, p.line.grammar, ink) + SP[7]
  if (how) { how.draw(y, howCaption); y += how.h + SP[8] }
  if (ruleB) paragraph(ctx, ruleB, f.x, y, ink2, 'left', 1.32)
}

// ── The question ──────────────────────────────────────────────
/** The teacher's question: the paper's instruction, the stem, the answers
 *  in a hairline lattice; revealed, the right one circled and stamped. In
 *  the exam direction it is headed as the JLPT heads it (もんだい); in the
 *  others, by its title. */
function quizSlide(c, q, revealed, head, number = 1) {
  const { ctx, p, f, ink, ink2 } = c
  const t = c.plan.t
  const lang = c.plan.lang
  let y = f.y
  if (head === 'exam') {
    const N3 = ['N3', 'N2', 'N1'].includes(c.plan.level)
    const hs = FS.title * 1.1
    const hw = text(ctx, N3 ? '問題' : 'もんだい', f.x, y + hs * ASC, { f: font(700, hs, 'serif'), color: ink })
    roundel(ctx, f.x + hw + SP[4] + 32, y + hs * 0.46, 32, p.line.exam, String(number), { ink: p.line.exam, size: FS.lead })
    if (/^N\d$/.test(c.plan.level)) caption(ctx, c.plan.level, f.right, y + hs * 0.62, ink2, 'right')
    y += hs * 1.15 + SP[5]
  } else {
    y = title(c, head)
  }
  if (q.askJp) {
    const a = fit(ctx, q.askJp, { weight: 500, fam: 'jp', sizes: [FS.lead, FS.body], maxW: f.w, maxLines: 1, balanced: false })
    y += paragraph(ctx, a, f.x, y, ink)
  }
  if (q.ask && q.ask !== head) {
    const ask = fit(ctx, q.ask, { weight: q.askJp ? 500 : 700, sizes: q.askJp ? [FS.body, FS.sm] : [FS.title, FS.lead, FS.body], maxW: f.w, maxLines: 3, balanced: false })
    y += paragraph(ctx, ask, f.x, y, q.askJp ? ink2 : ink) + SP[7]
  }

  // The foot: the call to answer, or the answer explained.
  const n = q.choices.length
  const cta = revealed ? null : fit(ctx, weldIf(lang, t.examCta(n)), { sizes: [FS.title, FS.lead], maxW: f.w, maxLines: 2 })
  const ex = q.explain || {}
  const exHead = revealed && ex.head ? ex.head : ''
  const exSense = revealed && ex.sense ? fit(ctx, ex.sense, { sizes: [FS.title, FS.lead], maxW: f.w - 160, maxLines: 2 }) : null
  const exWhy = revealed && ex.why ? fit(ctx, ex.why, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w - 160, maxH: f.h * 0.24, lh: 1.25, balanced: false }) : null
  const foot = cta ? paragraphH(cta)
    : Math.max(150, (exHead ? FS.display * 0.75 + SP[3] : 0) + (exSense ? paragraphH(exSense) : 0) + (exWhy ? paragraphH(exWhy, 1.25) + SP[3] : 0))

  // The answers: two by two for four, else one under the other (or side by
  // side when each is short): a lattice whose columns divide its content.
  const short = q.choices.every(x => (x.text || '').length <= 8 && !x.rows)
  const cols = n === 4 ? 2 : short ? n : 1
  const rowsN = Math.ceil(n / cols)
  // The stem: on the answer, a dialogue's cue gives way to the task alone.
  const st = q.stem?.cue && revealed ? { task: q.stem.task } : q.stem
  const gridH = st ? Math.min(Math.max(f.w * 0.3, (f.bottom - y) * 0.36), rowsN * 200) : Math.min(f.bottom - y - SP[7] - foot, rowsN * 230)
  const room = st ? f.bottom - y - SP[7] - gridH - SP[7] - foot : -SP[7]
  if (st?.rows) {
    const blankless = st.rows
    const L = layoutSentence(ctx, blankless, { max: FS.display * 1.1, min: FS.lead, maxW: f.w, maxLines: 3, maxH: room - (st.tr ? FS.lead * 2.6 : 0), rules: !!st.under, gap: 0.08, script: c.plan.script === 'kana' ? 'kana' : c.plan.script })
    const top = y + Math.max(0, (room - L.h - (st.tr ? FS.lead * 2.6 : 0)) / 2)
    drawSentence(ctx, L, f.x, top, 'left', u => ({
      ink, ruby: ink2,
      rule: st.under && u.i === st.target ? (revealed ? p.line.exam : ink) : null,
      ruleW: revealed ? EDGE : 4,
    }))
    if (st.tr) paragraph(ctx, fit(ctx, st.tr, { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w, maxLines: 2, balanced: false }), f.x, top + L.h + SP[3], ink2)
  } else if (st?.specimen) {
    const z = Math.min([...st.specimen].length === 1 ? FS.glyph : FS.word, room * 0.9)
    let size = z
    while (size > FS.heading && measure(ctx, st.specimen, font(700, size, 'serif')) > f.w) size -= 4
    text(ctx, st.specimen, f.cx, y + room / 2 + size * 0.36, { f: font(700, size, 'serif'), color: ink, align: 'center' })
  } else if (st?.text) {
    const b = fit(ctx, `“${st.text}”`, { sizes: [FS.display, FS.heading, FS.title], maxW: f.w, maxH: room, lh: 1.15 })
    paragraph(ctx, b, f.x, y + Math.max(0, (room - paragraphH(b, 1.15)) / 2), ink, 'left', 1.15)
  } else if (st?.cue) {
    // What the other person said, and what the reader has to say.
    const task = fit(ctx, st.task, { weight: 700, sizes: [FS.title, FS.lead], maxW: f.w, maxLines: 2, balanced: false })
    const bw = f.w * 0.86
    const ctr = fit(ctx, st.cue.tr, { weight: 500, sizes: [FS.body, FS.sm], maxW: bw - SP[6] * 2, maxLines: 2, balanced: false })
    const L = layoutSentence(ctx, st.cue.rows, { max: FS.heading, min: FS.body, maxW: bw - SP[6] * 2, maxLines: 2, maxH: room - paragraphH(task) - paragraphH(ctr) - FS.caption * 1.6 - SP[5] * 3, script: c.plan.script, rules: false, gap: 0.04 })
    const bh = FS.caption * 1.6 + L.h + SP[2] + paragraphH(ctr) + SP[5] * 2
    let by = y + Math.max(0, (room - bh - SP[5] - paragraphH(task)) / 2)
    ctx.fillStyle = c.dark ? p.card : p.surface
    rrect(ctx, f.x, by, bw, bh, R.panel)
    ctx.fill()
    if (!c.dark) { ctx.strokeStyle = p.surfaceLine; ctx.lineWidth = 2; rrect(ctx, f.x + 1, by + 1, bw - 2, bh - 2, R.panel); ctx.stroke() }
    caption(ctx, st.them || '', f.x + SP[6], by + SP[5] + FS.caption, ink2, 'left', FS.xs)
    drawSentence(ctx, L, f.x + SP[6], by + SP[5] + FS.caption * 1.6, 'left', () => ({ ink, rule: null, ruby: ink2 }))
    paragraph(ctx, ctr, f.x + SP[6], by + SP[5] + FS.caption * 1.6 + L.h + SP[2], ink2)
    by += bh + SP[5]
    paragraph(ctx, task, f.x, by, p.line.grammar)
  } else if (st?.task) {
    const task = fit(ctx, st.task, { weight: 700, sizes: [FS.title, FS.lead], maxW: f.w, maxLines: 2, balanced: false })
    paragraph(ctx, task, f.x, y + Math.max(0, (room - paragraphH(task)) / 2), p.line.grammar)
  }
  y += room + SP[7]

  const HL = 3
  const cw = (f.w - HL * (cols + 1)) / cols
  const chh = (gridH - HL * (rowsN + 1)) / rowsN
  ctx.fillStyle = c.board ? p.panelLine : p.surfaceLine
  ctx.fillRect(f.x, y, f.w, gridH)
  // Every answer in one size: the largest at which all of them fit.
  const textW = cw - SP[5] - 60 - SP[4] - SP[4]
  const sizes = [FS.display * 0.62, FS.title, FS.lead, FS.body, FS.sm]
  const fitsAt = (ch, z) => ch.rows || !fit(ctx, ch.text, { weight: ch.fam === 'jp' ? 500 : 700, fam: ch.fam || 'latin', sizes: [z], maxW: textW, maxH: chh - SP[4], maxLines: 3, balanced: false }).cut
  const common = sizes.find(z => q.choices.every(ch => fitsAt(ch, z))) || FS.sm
  q.choices.forEach((choice, i) => {
    const cx = f.x + HL + (i % cols) * (cw + HL)
    const cy = y + HL + Math.floor(i / cols) * (chh + HL)
    ctx.fillStyle = c.board ? p.panel : c.dark ? p.card : p.surface
    ctx.fillRect(cx, cy, cw, chh)
    const right = i === q.right
    const dim = revealed && !right
    const r = 30
    roundel(ctx, cx + SP[5] + r, cy + chh / 2, r, dim ? (c.board ? p.panelLine : p.surfaceLine) : p.line.exam, String(i + 1), { ink: dim ? ink2 : p.line.exam, size: FS.lead })
    const tx = cx + SP[5] + r * 2 + SP[4]
    const tw = cx + cw - SP[4] - tx
    if (choice.rows) {
      const L = layoutSentence(ctx, choice.rows, { max: FS.title, min: FS.sm, maxW: tw, maxLines: 2, maxH: chh - SP[4], script: c.plan.script, rules: false, gap: 0.04, fam: 'jp', weight: 500 })
      drawSentence(ctx, L, tx, cy + (chh - L.h) / 2, 'left', () => ({ ink: dim ? ink2 : ink, rule: null, ruby: ink2 }))
    } else {
      const fam = choice.fam || 'latin'
      const b = fit(ctx, choice.text, { weight: fam === 'jp' ? 500 : 700, fam, sizes: [common], maxW: tw, maxH: chh - SP[4], maxLines: 3, balanced: false })
      paragraph(ctx, b, tx, cy + chh / 2 - paragraphH(b) / 2, dim ? ink2 : ink)
    }
    if (revealed && right) marked(ctx, p, cx + SP[5] + r, cy + chh / 2, r)
  })
  y += gridH + SP[7]
  if (cta) { paragraph(ctx, cta, f.x, y, ink); return }
  let ey = y
  if (exHead) {
    text(ctx, exHead, f.x, ey + FS.display * 0.62, { f: font(700, FS.display * 0.7, 'serif'), color: ink })
    ey += FS.display * 0.75 + SP[3]
  }
  if (exSense) ey += paragraph(ctx, exSense, f.x, ey, ink2)
  if (exWhy) paragraph(ctx, exWhy, f.x, ey + SP[3], ink2, 'left', 1.25)
  stamp(ctx, p, f.right - 66, y + Math.min(foot, 150) / 2 + 10, 62)
}

// ── Hooks: the first slide of a post ──────────────────────────
/** The thing the post opens on, measured, then drawn in a box. */
function hookContent(c, plan, maxW, maxH, fam, align) {
  const { ctx, p, ink, ink2 } = c
  const h = plan.hook
  if (h.kind === 'sentence') {
    const L = layoutSentence(ctx, h.rows, { max: FS.word * 0.8, min: FS.title, maxW, maxH, script: plan.script, romaji: plan.showRomaji, fam, weight: 700, rules: c.rules !== false, gap: c.rules === false ? 0.08 : 0.3 })
    return { h: L.h, draw: (x, y) => drawSentence(ctx, L, x, y, align, u => ({ ink, rule: c.rules === false ? null : lineOf(p, u.row), romaji: ink2, ruby: ink2 })) }
  }
  if (h.kind === 'pattern') {
    let size = FS.word * 0.85
    const pf = () => font(700, size, fam)
    while (size > FS.heading && measure(ctx, h.pattern, pf()) > maxW) size -= 4
    const L = h.rows.length ? layoutSentence(ctx, h.rows, { max: FS.display * 0.8, min: FS.lead, maxW, maxLines: 2, maxH: maxH - size * 1.3 - SP[7], script: plan.script, gap: 0.06 }) : null
    const H = size * 1.15 + EDGE + (L ? SP[8] + L.h : 0)
    return {
      h: H,
      draw(x, y) {
        const w = text(ctx, h.pattern, align === 'center' ? x : x, y + size * ASC, { f: pf(), color: ink, align })
        ctx.fillStyle = p.line.grammar
        ctx.fillRect(align === 'center' ? x - w / 2 : x, y + size * 1.1, w, EDGE)
        if (L) drawSentence(ctx, L, x, y + size * 1.15 + EDGE + SP[8], align, u => ({ ink: u.row.lit ? ink : ink2, rule: u.row.lit ? p.line.grammar : null, ruby: ink2 }))
      },
    }
  }
  if (h.kind === 'specimen') {
    const one = [...h.text].length === 1
    let size = Math.min(h.small ? FS.display * 1.2 : one ? FS.glyph * 1.25 : FS.word, maxH * 0.9)
    while (size > FS.title && measure(ctx, h.text, font(700, size, fam)) > maxW) size -= 4
    const b = h.small ? fit(ctx, h.text, { fam, sizes: [FS.display * 1.2, FS.display, FS.heading, FS.title], maxW, maxLines: 3 }) : null
    if (b) return { h: paragraphH(b), draw: (x, y) => paragraph(ctx, b, x, y, ink, align) }
    return { h: size * 1.1, draw: (x, y) => text(ctx, h.text, x, y + size * ASC, { f: font(700, size, fam), color: ink, align }) }
  }
  if (h.kind === 'prompt') {
    // What to say, and the words to say it with, as tiles.
    const b = fit(ctx, `“${h.text}”`, { sizes: [FS.display, FS.heading, FS.title], maxW, maxH: maxH * 0.45, lh: 1.15 })
    const tf = font(700, FS.title * 1.1, 'jp')
    const pad = SP[5]
    const th = FS.title * 1.1 + pad * 2
    const tiles = h.tiles.map(r => ({ t: r.t, w: measure(ctx, r.t, tf) + pad * 2, line: r.k === 'word' ? 'vocab' : 'grammar' }))
    const lines = [[]]
    let lw = 0
    for (const tile of tiles) {
      if (lw + tile.w > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0 }
      lines[lines.length - 1].push(tile)
      lw += tile.w + SP[3]
    }
    const tilesH = lines.length * th + (lines.length - 1) * SP[3]
    return {
      h: paragraphH(b, 1.15) + SP[8] + tilesH,
      draw(x, y) {
        paragraph(ctx, b, x, y, ink, align, 1.15)
        let ty = y + paragraphH(b, 1.15) + SP[8]
        for (const line of lines) {
          const w = line.reduce((a, t2) => a + t2.w, 0) + SP[3] * (line.length - 1)
          let tx = align === 'center' ? x - w / 2 : x
          for (const tile of line) {
            ctx.strokeStyle = p.line[tile.line]
            ctx.lineWidth = RING
            rrect(ctx, tx + RING / 2, ty + RING / 2, tile.w - RING, th - RING, R.card)
            ctx.stroke()
            text(ctx, tile.t, tx + pad, ty + th / 2 + FS.title * 1.1 * 0.36, { f: tf, color: ink })
            tx += tile.w + SP[3]
          }
          ty += th + SP[3]
        }
      },
    }
  }
  return { h: 0, draw() {} }
}

/** The level, in a ring of the source's line: N5, or あ / ア for a kana. */
function levelRing(ctx, p, plan, cx, cy, r, ink) {
  const label = plan.level === 'hiragana' ? 'あ' : plan.level === 'katakana' ? 'ア' : plan.level
  roundel(ctx, cx, cy, r, p.line[plan.line] || p.line.reading, label, { ink, size: FS.lead, fam: /^N/.test(label) ? 'latin' : 'jp' })
}
const promptOf = (plan, dir) => (typeof plan.prompt === 'string' ? plan.prompt : plan.prompt[dir] || plan.prompt.plates)

const HOOKS = {
  plates(ctx, p, fr, plan) {
    ground(ctx, p, fr)
    masthead(ctx, p, fr)
    levelRing(ctx, p, plan, fr.right - 46, fr.y + 32, 46, p.ink)
    const c = { ctx, p, f: fr, ink: p.ink, ink2: p.ink2 }
    const pill = 44 * 2.7
    const top = fr.y + 64 + SP[8]
    const room = fr.bottom - pill - SP[8] - top
    const prompt = fit(ctx, promptOf(plan, 'plates'), { sizes: [FS.title, FS.lead], maxW: fr.w * 0.9, maxLines: 2 })
    const content = hookContent(c, plan, fr.w, room - paragraphH(prompt) - SP[8], 'serif', 'center')
    const total = content.h + SP[8] + paragraphH(prompt)
    let y = top + Math.max(0, (room - total) / 2)
    content.draw(fr.cx, y)
    y += content.h + SP[8]
    paragraph(ctx, prompt, fr.cx, y, p.ink2, 'center')
    metal(ctx, p, fr.cx, fr.bottom - pill, plan.t.next)
  },
  board(ctx, p, fr, plan) {
    ground(ctx, p, fr)
    masthead(ctx, p, fr)
    const pill = 44 * 2.7
    const top = fr.y + 64 + SP[7]
    const bh = fr.bottom - pill - SP[8] - top
    boardPanel(ctx, p, fr.x, top, fr.w, bh)
    const levelLabel = /^N/.test(plan.level) ? plan.level : ''
    const hh = boardHead(ctx, p, fr.x, top, fr.w, plan.t.departure, levelLabel)
    const box = inner(fr.x, top + hh, fr.w, bh - hh)
    const c = { ctx, p, f: box, ink: p.onPanel, ink2: p.onPanelSoft, dark: true }
    const prompt = fit(ctx, promptOf(plan, 'board'), { weight: 500, sizes: [FS.title, FS.lead], maxW: box.w, maxLines: 2 })
    const content = hookContent(c, plan, box.w, box.h - paragraphH(prompt) - SP[8], 'jp', 'center')
    const total = content.h + SP[8] + paragraphH(prompt)
    let y = box.y + Math.max(0, (box.h - total) / 2)
    content.draw(box.cx, y)
    y += content.h + SP[8]
    paragraph(ctx, prompt, box.cx, y, p.onPanelSoft, 'center')
    metal(ctx, p, fr.cx, fr.bottom - pill, plan.t.next)
  },
  card(ctx, p, fr, plan) {
    ground(ctx, p, fr)
    masthead(ctx, p, fr)
    const { ink, ink2 } = cardInk(p)
    const pill = 44 * 2.7
    const prompt = fit(ctx, promptOf(plan, 'card'), { sizes: [FS.title, FS.lead], maxW: fr.w * 0.9, maxLines: 2 })
    const top = fr.y + 64 + SP[7]
    const ch = fr.bottom - pill - SP[7] - paragraphH(prompt) - SP[7] - top
    studyCard(ctx, p, fr.x, top, fr.w, ch, p.line[plan.line])
    if (/^N/.test(plan.level)) caption(ctx, plan.level, fr.x + SP[6], top + SP[6] + FS.caption, ink2)
    const box = inner(fr.x, top, fr.w, ch, SP[7], SP[9])
    const c = { ctx, p, f: box, ink, ink2, dark: !p.paper, rules: false }
    const content = hookContent(c, plan, box.w, box.h, 'serif', 'center')
    content.draw(box.cx, box.y + Math.max(0, (box.h - content.h) / 2))
    paragraph(ctx, prompt, fr.cx, top + ch + SP[7], p.ink, 'center')
    metal(ctx, p, fr.cx, fr.bottom - pill, plan.t.next)
  },
}

// ── The rating bar (the study card's last word) ───────────────
function ratingSlide(ctx, p, fr, plan) {
  ground(ctx, p, fr)
  const t = plan.t
  const title2 = fit(ctx, t.rate, { sizes: [FS.display, FS.heading], maxW: fr.w, maxLines: 2 })
  const barH = 120 * 2.7 * 0.62
  const cta = fit(ctx, t.rateCta, { weight: 500, sizes: [FS.title, FS.lead], maxW: fr.w, maxLines: 2 })
  const total = paragraphH(title2) + SP[8] + barH + SP[8] + paragraphH(cta) + SP[6] + FS.display
  let y = fr.y + (fr.h - total) / 2
  y += paragraph(ctx, title2, fr.cx, y, p.ink, 'center') + SP[8]
  ctx.fillStyle = p.panel
  rrect(ctx, fr.x, y, fr.w, barH, R.panel)
  ctx.fill()
  const bw = fr.w / 4
  for (let i = 0; i < 4; i++) {
    const bx = fr.x + i * bw
    if (i) { ctx.fillStyle = p.panelLine; ctx.fillRect(bx, y + SP[4], 2, barH - SP[4] * 2) }
    const cx = bx + bw / 2
    ctx.fillStyle = p.rating[i]
    ctx.beginPath()
    ctx.arc(cx, y + barH * 0.27, 13, 0, Math.PI * 2)
    ctx.fill()
    const lf = fit(ctx, t.ratings[i], { sizes: [FS.lead, FS.body, FS.sm], maxW: bw - SP[3] * 2, maxLines: 1 })
    text(ctx, lf.lines[0], cx, y + barH * 0.62, { f: lf.f, color: p.onPanel, align: 'center' })
    text(ctx, RATINGS_JP[i], cx, y + barH * 0.86, { f: font(500, FS.caption, 'jp'), color: p.onPanelSoft, align: 'center' })
  }
  y += barH + SP[8]
  y += paragraph(ctx, cta, fr.cx, y, p.ink2, 'center') + SP[6]
  ctx.save()
  ctx.translate(fr.cx, y)
  ctx.rotate(Math.PI / 2)
  chevron(ctx, 0, 0, FS.display * 0.6, p.gold)
  ctx.restore()
}

// ── The directions and their decks ────────────────────────────
export const DIRECTIONS = [
  { id: 'plates', jp: '駅名標', name: { en: 'Station plates', fr: 'Plaques de gare' } },
  { id: 'board', jp: '発車標', name: { en: 'Departure board', fr: 'Tableau des départs' } },
  { id: 'card', jp: '札', name: { en: 'Study card', fr: 'Carte d’étude' } },
  { id: 'exam', jp: '模試', name: { en: 'Mock exam', fr: 'Examen blanc' } },
]

/** A passage's sentences, laid out and cut into pages that fit. */
function passagePages(plan, s, fmt, direction) {
  if (typeof document === 'undefined') return [s.sents]
  const ctx = document.createElement('canvas').getContext('2d')
  const fr = frame(fmt)
  const f = direction === 'board' || direction === 'card' ? inner(fr.x, fr.y, fr.w, fr.h) : fr
  // Under the title: a board's caption, or a heading.
  const top = direction === 'board' ? FS.caption + SP[7] : FS.heading * 1.1 + SP[6]
  const size = fmt.id === 'story' ? FS.heading : FS.title * 1.15
  const layouts = s.sents.map(rows => layoutSentence(ctx, rows, { max: size, min: size, maxW: f.w, maxLines: 20, script: plan.script, rules: false, gap: 0.02 }))
  const out = [[]]
  // The first page also carries the passage's title.
  let used = FS.heading * 1.6 + SP[6]
  const room = f.h - top
  for (const L of layouts) {
    if (used + L.h > room && out[out.length - 1].length) { out.push([]); used = 0 }
    out[out.length - 1].push(L)
    used += L.h + SP[4]
  }
  return out
}

/** The slides a direction deals for a plan: [{ key, draw(ctx) }]. */
export function deck(direction, plan, fmt, opts) {
  const fr = frame(fmt)
  const p = palette(opts.ground)
  const per = fmt.id === 'story' ? 6 : 5
  const exam = direction === 'exam'
  const slides = []
  const add = (key, fn) => slides.push({ key, draw: ctx => { noShadow(ctx); fn(ctx) } })
  const render = (s, extra = {}) => ctx => {
    const c = { ctx, p, plan, ...surface(direction, ctx, p, fr, LINE_OF_KIND[s.kind] || s.line || plan.line) }
    if (s.kind === 'quiz') return quizSlide(c, s.quiz, s.revealed, exam ? 'exam' : s.title, extra.number)
    KINDS[s.kind](c, { ...s, ...extra })
  }
  let number = 0
  if (exam && plan.quiz) {
    number += 1
    const c0 = ctx => ({ ctx, p, plan, ...surface('exam', ctx, p, fr, 'exam') })
    add('question', ctx => quizSlide(c0(ctx), plan.quiz, false, 'exam', 1))
    add('answer', ctx => quizSlide(c0(ctx), plan.quiz, true, 'exam', 1))
  } else {
    add('hook', ctx => HOOKS[exam ? 'plates' : direction](ctx, p, fr, plan))
  }
  for (const s of plan.slides) {
    if (s.kind === 'rating') { if (direction === 'card') add('rating', ctx => ratingSlide(ctx, p, fr, plan)); continue }
    if (exam && s.skipOnExam && plan.quiz === s.quiz) continue
    if (exam && s.kind === 'quiz' && s.revealed && plan.quiz === s.quiz) continue
    if (s.kind === 'words') {
      const ps = pages(s.items, per)
      ps.forEach((list, i) => add(`words-${i + 1}`, ctx => { noShadow(ctx); wordsSlide(direction, ctx, p, fr, plan, s, list, i + 1, ps.length) }))
      continue
    }
    if (s.kind === 'passage') {
      const ps = passagePages(plan, s, fmt, direction)
      ps.forEach((layouts, i) => add(`passage-${i + 1}`, render(s, { layouts, page: i + 1, count: ps.length })))
      continue
    }
    if (s.kind === 'quiz' && !s.revealed) number += 1
    add(s.kind === 'quiz' ? (s.revealed ? `answer-${number}` : `question-${number}`) : s.kind, render(s, { number }))
  }
  return slides
}
