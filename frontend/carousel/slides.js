// ── カルーセル — the slides (plans 200, 200c) ───────────────────────
// A plan (sources.js) drawn as slides. Since plan 200c a carousel's
// type is what it does, not how it looks; each is the app's own idiom
// (DESIGN.md, "The idea"):
//   plates   駅名標  the guided walk: the item stop by stop, on its line
//   exam     模試    the mock exam: a cover, questions in the JLPT's
//                    forms, their answers, the answer sheet
//   compare  乗換    this or that: two things a learner mixes up
//   build    組立    the sentence put together piece by piece
//   list     一覧    a short list worth saving, one item a slide
//   talk     会話    a scene, line by line, then the reader's line
// Every slide is written once and set on the station plates' ground, and
// the last slide is the ending the studio picks (the mark, by default).
//
// A colour keeps its meaning: a word wears the vocabulary line's pigment,
// a particle or an ending the grammar line's, a kanji the kanji line's;
// each source opens in its own line's (読書 verdigris, 翻訳 lapis, 文法
// pine …); your own lines in a scene are the pass's charcoal; the gold is
// the action (the metal) and nothing else.
import {
  FS, SP, R, TR, EDGE, RING, ASC, FORMATS, palette, font, alpha, shadow, noShadow, rrect, measure, text, caption,
  fit, wrap, paragraph, paragraphH, roundel, mark, metal, chevron, layoutSentence, drawSentence, lineOf, frame,
  ground, masthead, heading, pageMark, pages, strokeBox, marked, stamp, METAL_H,
} from './draw.js'
import { SELF_CHECK_JP, SITE, formOf, tr, weldIf } from './strings.js'
import { picked } from './sources.js'
import { withoutGiveaways } from './quizzes.js'
import { furiganaOf } from './common.js'

export { FORMATS }

// ── Surfaces ──────────────────────────────────────────────────
/** A slide's ground, and the frame and inks its content is set in. */
function surface(ctx, p, fr) {
  ground(ctx, p, fr)
  return { f: fr, ink: p.ink, ink2: p.ink2, dark: !p.paper }
}

/** A slide's title, as a station prints its names; returns the y under it. */
function title(c, str, y = c.f.y, right = '') {
  const { ctx, p, f } = c
  // A page count (2/3) or a level (N5), at the title's right, kept clear of it.
  const rf = font(700, FS.lead, 'latin')
  const rw = right ? measure(ctx, right, rf) + SP[5] : 0
  const h = heading(ctx, p, { ...f, w: f.w - rw }, str, y, c.ink)
  if (right) text(ctx, right, f.right, y + FS.heading * 0.8, { f: rf, color: c.ink2, align: 'right' })
  return y + h + SP[6]
}

// ── Rows of words ─────────────────────────────────────────────
/** A word's sense, right-aligned and centred on `mid`: its gloss, and
 *  under it the senses after it (or a particle's form) when there is room. */
/** A row's sense as it is set in `rw`: its meaning, and the line under it
 *  where both fit; `w` the widest of them. */
function senseOf(ctx, word, rw, ih) {
  const sub = word.sub ? fit(ctx, word.sub, { weight: 500, sizes: [FS.body, FS.sm], maxW: rw, maxLines: 1, balanced: false }) : null
  const subH = sub ? paragraphH(sub) + SP[1] : 0
  const sizes = [FS.title, FS.lead, FS.body, FS.sm]
  let main = fit(ctx, word.main, { sizes, maxW: rw, maxH: ih - subH, lh: 1.12 })
  let withSub = !!sub
  if (sub && (main.cut || paragraphH(main, 1.12) + subH > ih)) {
    main = fit(ctx, word.main, { sizes, maxW: rw, maxH: ih, lh: 1.12 })
    withSub = false
  }
  const widest = b => Math.max(0, ...b.lines.map(l => measure(ctx, l, b.f)))
  return { main, sub, subH, withSub, w: Math.max(widest(main), withSub ? widest(sub) : 0) }
}
function senseBlock(ctx, word, rx, mid, rw, ih, ink, ink2, tag) {
  // A level tag (`tag`: { p, label }) stands under the sense, right-aligned.
  const tagH = tag ? SP[2] + LEVEL_H : 0
  const { main, sub, subH, withSub } = senseOf(ctx, word, rw, ih - tagH)
  const tall = paragraphH(main, 1.12) + (withSub ? subH : 0) + tagH
  let sy = mid - tall / 2
  sy += paragraph(ctx, main, rx, sy, ink, 'right', 1.12)
  if (withSub) sy += SP[1] + paragraph(ctx, sub, rx, sy + SP[1], ink2, 'right')
  if (tag) levelTag(ctx, tag.p, rx - levelW(ctx, tag.label), sy + SP[2], tag.label)
}
const subOf = w => (w.kanji && w.reading ? (w.ro ? `${w.reading} · ${w.ro}` : w.reading) : w.ro)

/** The JLPT level a row names, in the app's quiet frame (its rows' level
 *  tag, index.css .browse-result-row__level): context, not a colour. */
const levelOf = word => (/^N[1-5]$/.test(word.sub || '') ? word.sub : '')
const LEVEL_H = FS.xs * 1.5
const levelW = (ctx, label) => measure(ctx, label, font(700, FS.xs, 'latin'), TR.caption) + SP[3] * 2
function levelTag(ctx, p, x, y, label) {
  const f = font(700, FS.xs, 'latin')
  const w = levelW(ctx, label)
  ctx.strokeStyle = alpha(p.ink2, 0.55)
  ctx.lineWidth = 2
  rrect(ctx, x + 1, y + 1, w - 2, LEVEL_H - 2, R.card / 2)
  ctx.stroke()
  text(ctx, label, x + SP[3], y + LEVEL_H / 2 + FS.xs * 0.36, { f, color: p.ink2, tr: TR.caption })
  return w
}

/** One word as a hanging 駅名標: its number in a ring, its furigana over
 *  its kanji (plan 200i: over the kanji only, never the word whole), its
 *  romaji and its level under it, its sense on the right, the line's
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
  // Half the row for the word; a long one (片付けさせました) takes what its
  // sense leaves, and the sense narrows for it, to a third of the row.
  const shown = levelOf(word) ? { ...word, sub: '' } : word
  const roomBy = rw => x + w - pad - senseOf(ctx, shown, rw, ih).w - SP[6] - nx
  const need = measure(ctx, word.t, font(700, FS.lead, 'serif'))
  let rw = w * 0.46 - pad
  if (need > roomBy(rw)) rw = Math.max(w * 0.26, rw - (need - roomBy(rw)))
  const leftW = Math.max(w * 0.5 - (nx - x), roomBy(rw))
  const level = levelOf(word)
  // The romaji sits beside the word, on its baseline (会う au), and a
  // level tag under the sense: stacked under a word and its furigana the
  // romaji crowds both, and the furigana's least size leaves a kanji word
  // small. A word too long for the row beside its romaji keeps it on a
  // line under it, clear of it (plan 200l).
  const roAt = maxW => fit(ctx, word.ro, { weight: 500, sizes: [FS.sm, FS.xs], maxW, maxLines: 1, balanced: false })
  let ro = word.ro ? roAt(leftW * 0.45) : null
  const fu = word.kanji && word.reading ? word.fu || furiganaOf(word.t, word.reading) : null
  const layout = (maxW, maxH) => layoutSentence(ctx, [{ t: word.t, k: 'word', fu }], {
    max: FS.display * 0.95, min: FS.sm, maxW, maxLines: 1, maxH, rules: false, under: 0.04, script: fu ? 'furigana' : 'kanji',
  })
  const fits = (L, maxW, maxH) => L.lines.length === 1 && L.lineW(L.lines[0]) <= maxW + 0.5 && L.h <= maxH + 0.5
  const sideW = ro ? measure(ctx, ro.lines[0], ro.f) + SP[4] : 0
  let L = layout(leftW - sideW, ih - SP[3])
  const beside = !ro || (!ro.cut && fits(L, leftW - sideW, ih - SP[3]) && L.size >= FS.title)
  if (!beside) ro = roAt(leftW)
  const lineH = beside ? 0 : SP[2] + ro.size * 1.05
  if (!beside) L = layout(leftW, ih - lineH - SP[3])
  const by = mid - (L.h + lineH) / 2
  drawSentence(ctx, L, nx, by, 'left', () => ({ ink: p.ink, rule: null, ruby: p.ink2 }))
  // Beside: on the word's baseline. Under: on a line of its own.
  if (ro) {
    const rx = beside ? nx + L.lineW(L.lines[0]) + SP[4] : nx
    text(ctx, ro.lines[0], rx, beside ? by + L.rubyH + L.size * ASC : by + L.h + SP[2] + ro.size * 0.8, { f: ro.f, color: p.ink2 })
  }
  senseBlock(ctx, level ? { ...word, sub: '' } : word, x + w - pad, mid, rw, ih, p.ink, p.ink2, level ? { p, label: level } : null)
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
  const gap = SP[3]
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
  for (let size = maxSize; size >= FS.body * 0.8; size -= 4) {
    const f = font(700, size, 'serif')
    let lz = Math.max(FS.sm, size * 0.34)
    let lf = font(700, lz, 'latin')
    const gap = size * 0.34
    const place = () => items.map(it => {
      if (it.gap) return { ...it, w: measure(ctx, '…', f), lw: 0 }
      if (it.op) return { ...it, w: measure(ctx, it.t, f), lw: 0 }
      if (it.arrow) return { ...it, w: size * 0.7, lw: 0 }
      const w = measure(ctx, it.t, f)
      const lw = it.label ? measure(ctx, it.label, lf) : 0
      return { ...it, w: Math.max(w, lw), tw: w, lw }
    })
    let placed = place()
    let total = placed.reduce((a, x) => a + x.w, 0) + gap * (placed.length - 1)
    const last = size - 4 < FS.body * 0.8
    if (total > maxW && (last || size < FS.sm)) {
      // At the least sizes the labels step down to the caption rung first.
      lz = FS.xs
      lf = font(700, lz, 'latin')
      placed = place()
      total = placed.reduce((a, x) => a + x.w, 0) + gap * (placed.length - 1)
    }
    if (total > maxW && last) {
      // Still too wide at the least size: a label longer than its word is
      // cut to the word's width (or an even share of the line), with …
      const share = maxW / placed.length
      for (const it of placed) {
        if (!it.label || it.lw <= Math.max(it.tw, share)) continue
        const room = Math.max(it.tw, share)
        let cut = it.label
        while (cut.length > 1 && measure(ctx, `${cut}…`, lf) > room) cut = cut.slice(0, -1)
        it.label = `${cut.trim()}…`
        it.lw = measure(ctx, it.label, lf)
        it.w = Math.max(it.tw, it.lw)
      }
      total = placed.reduce((a, x) => a + x.w, 0) + gap * (placed.length - 1)
    }
    if (total <= maxW || last) {
      const labelH = items.some(x => x.label) ? lz * 1.6 : 0
      return { size, f, lf, lz, gap, placed, w: total, h: size * 1.18 + EDGE + labelH }
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
      if (it.label) text(ctx, it.label, at + it.w / 2, y + L.size * 1.08 + EDGE + L.lz * 1.15, { f: L.lf, color: it.lit ? color : ink2, align: 'center' })
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

/** A head set as large as `maxSize` allows inside `maxW`, in at most
 *  `maxLines` lines: broken at its slashes (〜はじめる／〜おわる), else
 *  between characters, down to `minSize`, never wider than the line. */
function headLines(ctx, str, { fam = 'serif', weight = 700, maxW, maxSize, minSize = FS.title, maxLines = 2, maxH = Infinity }) {
  const at = size => {
    const f = font(weight, size, fam)
    const lines = measure(ctx, str, f) <= maxW ? [str] : str.includes('／') ? slashLines(ctx, str, f, maxW) : wrap(ctx, str, f, maxW)
    return { size, f, lines: lines.flatMap(l => (measure(ctx, l, f) > maxW ? wrap(ctx, l, f, maxW) : [l])), lh: size * 1.08 }
  }
  for (let size = maxSize; size > minSize; size -= 4) {
    const h = at(size)
    if (h.lines.length <= maxLines && h.lines.length * h.lh <= maxH && h.lines.every(l => measure(ctx, l, h.f) <= maxW + 1)) return h
  }
  return at(minSize)
}
const headH = h => h.lines.length * h.lh
function drawHead(ctx, h, x, y, color, align = 'left') {
  h.lines.forEach((l, i) => text(ctx, l, x, y + i * h.lh + h.size * ASC, { f: h.f, color, align }))
}

function patternHead(c, pattern, meaningText, sizes = [FS.heading, FS.title, FS.lead]) {
  const { ctx, p, f, ink } = c
  const short = [...pattern].length <= 2
  let ps = short ? FS.display * 1.25 : FS.display * 1.05
  const pf = () => font(700, ps, 'serif')
  while (ps > FS.heading && measure(ctx, pattern, pf()) > f.w * (short ? 0.4 : 1)) ps -= 4
  const lines = short ? [pattern] : headLines(ctx, pattern, { maxW: f.w, maxSize: ps, minSize: ps, maxLines: 3 }).lines
  const r = ps * 0.75
  const mx = short ? f.x + r * 2 + SP[7] : f.x
  const meaning = fit(ctx, meaningText, { sizes, maxW: f.right - mx, maxLines: 3 })
  const ph = ps * 1.02 * lines.length
  const h = short ? Math.max(r * 2, paragraphH(meaning)) : ph + EDGE + SP[5] + paragraphH(meaning)
  return {
    h,
    draw(top) {
      if (short) {
        // The marker in its ring, never wider than the ring holds (〜ば).
        let gs = ps
        while (gs > FS.title && measure(ctx, pattern, font(700, gs, 'serif')) > r * 1.5) gs -= 4
        roundel(ctx, f.x + r, top + h / 2, r, p.line.grammar, pattern, { ink, fam: 'serif', size: gs })
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
  const L = chunkLayout(ctx, items, f.w, Math.max(FS.title, Math.min(FS.display * 0.95, maxH * 0.32)))
  const line = fit(ctx, how.line, { weight: 500, sizes: [FS.title, FS.lead, FS.body, FS.sm], maxW: f.w, maxH: Math.max(FS.sm * 1.2, maxH - L.h - SP[6] - FS.caption - SP[5]), lh: 1.25, balanced: false })
  const h = FS.caption + SP[5] + L.h + SP[6] + paragraphH(line, 1.25)
  return {
    h,
    size: line.size,
    draw(top, cap) {
      caption(ctx, cap, f.x, top + FS.caption, p.line.grammar)
      drawChunk(ctx, p, L, f.x, top + FS.caption + SP[5], ink, ink2)
      paragraph(ctx, line, f.x, top + FS.caption + SP[5] + L.h + SP[6], ink, 'left', 1.25)
    },
  }
}

// ── The station's own plate ──
/** A 駅名標 for the source's station: its reading over its name, its
 *  code in the line's roundel, its name in the reader's language, and
 *  the line's band along the foot with the stations either side. */
function stationPlate(ctx, p, x, y, w, h, st, color) {
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
  const band = h * 0.24
  ctx.save()
  rrect(ctx, x, y, w, h, R.plate)
  ctx.clip()
  ctx.fillStyle = color
  ctx.fillRect(x, y + h - band, w, band)
  ctx.restore()
  const top = h - band
  const kf = font(500, FS.title, 'jp')
  text(ctx, st.kana, x + w / 2, y + top * 0.2, { f: kf, color: p.ink2, align: 'center', tr: TR.reading })
  let size = Math.min(FS.word, top * 0.48)
  while (size > FS.heading && measure(ctx, st.jp, font(900, size, 'serif')) > w * 0.56) size -= 4
  const ny = y + top * 0.24 + size * ASC
  text(ctx, st.jp, x + w / 2, ny, { f: font(900, size, 'serif'), color: p.ink, align: 'center' })
  const nameW = measure(ctx, st.jp, font(900, size, 'serif'))
  const r = Math.min(56, top * 0.16)
  roundel(ctx, x + w / 2 - nameW / 2 - SP[6] - r, y + top * 0.24 + size * 0.48, r, color, st.code, { ink: color, size: r * 0.72 })
  const lf = fit(ctx, st.name, { sizes: [FS.title, FS.lead], maxW: w * 0.8, maxLines: 1 })
  text(ctx, lf.lines[0], x + w / 2, y + top * 0.24 + size * 1.05 + FS.title, { f: lf.f, color: p.ink2, align: 'center' })
  // The stations either side, on the band.
  const by = y + top + band / 2
  const sf = font(700, FS.title, 'serif')
  const cf = font(500, FS.caption, 'jp')
  const arrow = band * 0.3
  if (st.prev) {
    ctx.save()
    ctx.translate(x + SP[6] + arrow, by)
    ctx.rotate(Math.PI)
    chevron(ctx, 0, 0, arrow, p.onLine)
    ctx.restore()
    const w1 = text(ctx, st.prev.jp, x + SP[6] + arrow + SP[4], by + FS.title * 0.36, { f: sf, color: p.onLine })
    text(ctx, st.prev.kana, x + SP[6] + arrow + SP[4] + w1 + SP[3], by + FS.caption * 0.36, { f: cf, color: p.onLine })
  }
  if (st.next) {
    const kw = measure(ctx, st.next.kana, cf)
    const jw = measure(ctx, st.next.jp, sf)
    const ax = x + w - SP[6] - arrow
    chevron(ctx, ax, by, arrow, p.onLine)
    text(ctx, st.next.kana, ax - SP[4] - kw, by + FS.caption * 0.36, { f: cf, color: p.onLine })
    text(ctx, st.next.jp, ax - SP[4] - kw - SP[3] - jw, by + FS.title * 0.36, { f: sf, color: p.onLine })
  }
}

// A question's section as the paper names it: kana up to N4, kanji from N3.
const KIND_JP = {
  reading: ['かんじよみ', '漢字読み'], orthography: ['ひょうき', '表記'], meaning: ['いみ', '意味'], grammar: ['ぶんぽう', '文法'],
  translation: ['ほんやく', '翻訳'], say: ['ほんやく', '翻訳'], assembly: ['ぶんの くみたて', '文の組み立て'], scene: ['かいわ', '会話'],
  tour: ['ぶんぽう', '文法'], pointMeaning: ['いみ', '意味'], compare: ['いみ', '意味'], kanji: ['よみかた', '読み方'],
  kanjiMeaning: ['いみ', '意味'], kanjiKun: ['よみかた', '読み方'], kanjiVocab: ['ごい', '語彙'], wordReverse: ['ごい', '語彙'], kinVocab: ['ごい', '語彙'], strokes: ['かくすう', '画数'], inWord: ['よみかた', '読み方'],
  kana: ['よみかた', '読み方'], kanaReverse: ['かな', 'かな'], twin: ['かな', 'かな'], passage: ['どっかい', '読解'], passageReading: ['よみかた', '読み方'],
  picture: ['ごい', '語彙'], kanjiPick: ['かんじ', '漢字'], trap: ['ぶんぽう', '文法'],
}

// ── Pictures (plan 200m) ──────────────────────────────────────
/** A theme's picture, an emoji, centred on (cx, cy) at `size`. */
function picture(ctx, e, cx, cy, size) {
  if (!e) return
  ctx.font = font(400, size, 'emoji')
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(e, cx, cy)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}
/** The card a picture, or a row of the set, sits on. */
function pictureCard(c, x, y, w, h) {
  const { ctx, p } = c
  ctx.fillStyle = c.dark ? p.card : p.surface
  rrect(ctx, x, y, w, h, R.card)
  ctx.fill()
  ctx.strokeStyle = p.surfaceLine
  ctx.lineWidth = 2
  rrect(ctx, x + 1, y + 1, w - 2, h - 2, R.card)
  ctx.stroke()
}
/** A word as a sentence of one, its reading over it and its romaji under it. */
const wordRow = w => ({ t: w.t, fu: w.fu, k: 'word', ro: w.ro })
/** A word's romaji, and its level in the tag the rows give it, centred together. */
function romajiLine(c, ro, lv, cx, y) {
  const { ctx, p, ink2 } = c
  const rf = font(500, FS.lead, 'latin')
  const level = levelOf({ sub: lv })
  const rw = ro ? measure(ctx, ro, rf) : 0
  const lw = level ? levelW(ctx, level) : 0
  const rx = cx - (rw + (rw && lw ? SP[4] : 0) + lw) / 2
  if (ro) text(ctx, ro, rx, y + FS.lead * 1.1, { f: rf, color: ink2 })
  if (level) levelTag(ctx, p, rx + rw + (rw ? SP[4] : 0), y + FS.lead * 1.1 - FS.lead * 0.36 - LEVEL_H / 2, level)
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
    // The point and its rival, measured first: on one line where they go,
    // else one under the other.
    const vs = ' ／ '
    let vsSize = FS.display
    const vf = () => font(700, vsSize, 'serif')
    let inline = true
    if (cmp) {
      while (vsSize > FS.title && measure(ctx, s.pattern + vs + cmp.p, vf()) > f.w) vsSize -= 4
      inline = measure(ctx, s.pattern + vs + cmp.p, vf()) <= f.w
      if (!inline) while (vsSize > FS.lead && Math.max(measure(ctx, s.pattern, vf()), measure(ctx, `／ ${cmp.p}`, vf())) > f.w) vsSize -= 4
    }
    const vsH = !cmp ? 0 : inline ? vsSize * 1.05 + EDGE + SP[6] : vsSize * 2.1 + EDGE + SP[3] + SP[6]
    const room = f.bottom - y - vsH
    // The caution, then why the two differ, as large as they both go; a
    // caution of a line or two in bold, a longer one in the reading weight.
    const sizes = [FS.heading, FS.title, FS.lead, FS.body, FS.sm]
    let a = null, b = null
    for (let i = 0; i < sizes.length; i++) {
      a = careful ? fit(ctx, careful, { weight: careful.length > 70 ? 500 : 700, sizes: [sizes[i]], maxW: f.w, maxLines: 20, lh: 1.25, balanced: false }) : null
      b = cmpText ? fit(ctx, cmpText, { weight: 500, sizes: [sizes[Math.min(i + 1, sizes.length - 1)]], maxW: f.w, maxLines: 9, lh: 1.3, balanced: false }) : null
      if ((a ? paragraphH(a, 1.25) + SP[8] : 0) + (b ? paragraphH(b, 1.3) : 0) <= room) break
    }
    if (a) y += paragraph(ctx, a, f.x, y, ink, 'left', 1.25) + SP[8]
    if (cmp) {
      const w1 = text(ctx, s.pattern, f.x, y + vsSize * ASC, { f: vf(), color: ink })
      ctx.fillStyle = p.line.grammar
      ctx.fillRect(f.x, y + vsSize * 1.05, w1, EDGE)
      if (inline) {
        const w2 = text(ctx, vs, f.x + w1, y + vsSize * ASC, { f: vf(), color: ink2 })
        text(ctx, cmp.p, f.x + w1 + w2, y + vsSize * ASC, { f: vf(), color: ink2 })
        y += vsSize * 1.05 + EDGE + SP[6]
      } else {
        y += vsSize * 1.05 + EDGE + SP[3]
        text(ctx, `／ ${cmp.p}`, f.x, y + vsSize * ASC, { f: vf(), color: ink2 })
        y += vsSize * 1.05 + SP[6]
      }
      if (b) paragraph(ctx, b, f.x, y, ink2, 'left', 1.3)
    }
  },

  /** 終点: what the sentence says, then the sentence read and its romaji. */
  answer(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, s.title || c.plan.t.terminus)
    const room = f.bottom - y
    const between = SP[5] + SP[8] + EDGE + SP[8]
    // The sentence first, in up to half the room; its romaji and its
    // translation in what it leaves. The translation is never cut: the
    // sentence steps down for it, then the romaji gives way.
    const at = (share, withRo) => {
      const L = layoutSentence(ctx, s.rows, { max: FS.display * 1.05, min: FS.body, maxW: f.w, maxLines: 4, maxH: room * share, script: c.plan.script === 'kana' ? 'kana' : 'furigana' })
      const ro = withRo ? fit(ctx, s.romaji, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxH: Math.min(room * 0.2, room - L.h - between - FS.lead * 1.2), balanced: false }) : null
      const tr2 = fit(ctx, s.translation, { sizes: [FS.display, FS.display * 0.85, FS.heading, FS.title, FS.lead, FS.body], maxW: f.w, maxH: room - L.h - (ro ? paragraphH(ro) : 0) - between, lh: 1.1 })
      return { L, ro, tr2 }
    }
    const steps = [[0.55, true], [0.46, true], [0.38, true], [0.46, false], [0.38, false], [0.3, false]]
    let A = at(...steps[0])
    for (const step of steps.slice(1)) { if (!A.tr2.cut && !A.ro?.cut) break; A = at(...step) }
    const { L, ro, tr2 } = A
    const total = L.h + (ro ? paragraphH(ro) : 0) + between + paragraphH(tr2, 1.1)
    y += Math.max(0, (room - total) * 0.35)
    drawSentence(ctx, L, f.x, y, 'left', u => ({ ink, rule: lineOf(p, u.row), ruby: ink2 }))
    y += L.h + SP[5]
    if (ro) y += paragraph(ctx, ro, f.x, y, ink2)
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
      ctx.strokeStyle = p.surfaceLine
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
    const notion = captionBlock(ctx, s.notion, f.w)
    notion.draw(f.x, y, p.line.grammar)
    y += notion.h + SP[8]
    // The two forms in one size: the largest at which both keep to two lines.
    let pair = null
    for (let z = FS.word; z >= FS.title; z -= 4) {
      pair = s.pair.map(x => headLines(ctx, x, { maxW: f.w, maxSize: z, minSize: z, maxLines: 2 }))
      if (pair.every(h => h.lines.length <= (z > FS.display ? 1 : 2)) && headH(pair[0]) + headH(pair[1]) + z * 0.9 <= (f.bottom - y) * 0.62) break
    }
    const size = pair[0].size
    drawHead(ctx, pair[0], f.x, y, ink2)
    y += headH(pair[0]) + size * 0.07
    ctx.save()
    ctx.translate(f.x + size * 0.45, y + size * 0.1)
    ctx.rotate(Math.PI / 2)
    chevron(ctx, 0, 0, size * 0.6, p.line.grammar)
    ctx.restore()
    y += size * 0.9
    drawHead(ctx, pair[1], f.x, y, ink)
    y += headH(pair[1]) + size * 0.07 + SP[7]
    if (s.why) {
      const b = fit(ctx, s.why, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxH: f.bottom - y, lh: 1.3, balanced: false })
      paragraph(ctx, b, f.x, y, ink2, 'left', 1.3)
    }
  },

  /** Another use of the point, in a sentence of the tour. */
  usage(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, c.plan.t.another)
    const notion = captionBlock(ctx, s.notion, f.w)
    notion.draw(f.x, y, p.line.grammar)
    y += notion.h + SP[7]
    const room = f.bottom - y
    let why = s.why ? fit(ctx, s.why, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxH: room * 0.4, lh: 1.3, balanced: false }) : null
    const trB = fit(ctx, s.tr, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxLines: 3 })
    const L = layoutSentence(ctx, s.rows, { max: FS.display * 1.05, min: FS.lead, maxW: f.w, maxLines: 3, maxH: room - paragraphH(trB) - (why ? paragraphH(why, 1.3) + SP[8] : 0) - SP[5], script: c.plan.script, gap: 0.08 })
    drawSentence(ctx, L, f.x, y, 'left', u => ({ ink, rule: u.row.lit ? p.line.grammar : null, ruby: ink2 }))
    y += L.h + SP[5]
    y += paragraph(ctx, trB, f.x, y, ink2) + SP[8]
    // A sentence longer than its room leaves the why less: it steps down
    // into what is left, and gives way where nothing is (plan 200l).
    if (why && paragraphH(why, 1.3) > f.bottom - y) {
      why = f.bottom - y >= FS.sm * 2.4 ? fit(ctx, s.why, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxH: f.bottom - y, lh: 1.3, balanced: false }) : null
    }
    if (why) paragraph(ctx, why, f.x, y, ink, 'left', 1.3)
  },

  /** Example sentences: each on its rail, the point (or the word) lit,
   *  at the largest setting at which all of them fit. */
  examples(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, s.title || c.plan.t.examples)
    const color = p.line[s.line || 'grammar']
    const room = f.bottom - y
    const w = f.w - SP[7]
    // Everything at one scale, the largest the room holds; a translation
    // never under the body rung while a smaller scale can keep it there.
    const lay = (k, trMin) => {
      const max = Math.max(FS.body, FS.display * 0.85 * k)
      const trSize = Math.max(trMin, Math.min(FS.lead, max * 0.55))
      const gap = Math.max(SP[3], SP[7] * k)
      const items = s.items.map(it => {
        const trB = fit(ctx, it.tr, { weight: 500, sizes: [trSize], maxW: w, maxLines: 4, balanced: false })
        const L = layoutSentence(ctx, it.rows, { max, min: Math.min(max, FS.body), maxW: w, maxLines: 3, script: c.plan.script, gap: 0.06 })
        return { trB, L, h: L.h + SP[3] + paragraphH(trB) }
      })
      return { items, gap, h: items.reduce((a, x) => a + x.h, 0) + gap * (items.length - 1) }
    }
    let laid = null
    for (const trMin of [FS.body, FS.sm, FS.xs]) {
      for (let k = 1; k >= 0.45; k -= 0.04) { laid = lay(k, trMin); if (laid.h <= room) break }
      if (laid.h <= room) break
    }
    y += Math.max(0, (room - laid.h) * 0.3)
    for (const it of laid.items) {
      if (y + it.h > f.bottom + 1) break // what still does not fit is left off, never drawn over the foot
      ctx.fillStyle = color
      rrect(ctx, f.x, y + SP[1], EDGE, it.h - SP[2], EDGE / 2)
      ctx.fill()
      drawSentence(ctx, it.L, f.x + SP[7], y, 'left', u => ({ ink, rule: u.row.lit ? color : null, ruby: ink2 }))
      paragraph(ctx, it.trB, f.x + SP[7], y + it.L.h + SP[3], ink2)
      y += it.h + laid.gap
    }
  },

  /** The point at work in a conversation at a station: the other person's
   *  lines on the panel, yours in the pass's charcoal, all of them in the
   *  room the slide has. */
  scene(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, c.plan.t.scene)
    let bw = f.w * 0.9
    let iw = bw - SP[6] * 2
    // The bubble's own room (its padding, its label's) shrinks with its words.
    const padOf = k => Math.max(SP[3], SP[5] * k)
    const lay = (k, withNote, trSize) => {
      const max = Math.max(FS.body, FS.heading * k)
      const gap = Math.max(SP[2], SP[5] * k)
      const pad = padOf(k)
      const bubbles = s.lines.map(l => {
        const trB = fit(ctx, l.tr, { weight: 500, sizes: [trSize], maxW: iw, maxLines: 3, balanced: false })
        const L = layoutSentence(ctx, l.rows, { max, min: Math.min(max, FS.body), maxW: iw, maxLines: 3, script: c.plan.script, rules: false, gap: 0.04 })
        return { l, trB, L, pad, h: FS.caption * 1.45 + L.h + SP[2] + paragraphH(trB) + pad * 2 }
      })
      const note = withNote && s.note ? fit(ctx, s.note, { weight: 500, sizes: [trSize], maxW: f.w, maxLines: 4, balanced: false }) : null
      const h = bubbles.reduce((a, b) => a + b.h, 0) + gap * bubbles.length + (note ? paragraphH(note, 1.3) + SP[4] : 0)
      return { bubbles, note, gap, h }
    }
    const room = f.bottom - y
    let laid = null
    // The translations at the largest rung that holds, the Japanese over
    // them as large as it then fits and never smaller than they are; the
    // note gives way before the translations step down.
    find: for (const trSize of [FS.lead, FS.body, FS.sm, FS.xs]) {
      for (const withNote of [true, false]) {
        // A long scene's bubbles take the whole width before its lines step down.
        for (const share of [0.9, 1]) {
          bw = f.w * share
          iw = bw - SP[6] * 2
          for (let k = 1; k >= 0.5 && FS.heading * k >= trSize * 1.05; k -= 0.04) { laid = lay(k, withNote, trSize); if (laid.h <= room) break find }
        }
      }
    }
    for (const b of laid.bubbles) {
      if (y + b.h > f.bottom + 1) break
      const mine = b.l.who === 'me'
      const bx = mine ? f.right - bw : f.x
      ctx.fillStyle = mine ? p.pass : (c.dark ? p.card : p.surface)
      rrect(ctx, bx, y, bw, b.h, R.panel)
      ctx.fill()
      if (!mine && !c.dark) { ctx.strokeStyle = p.surfaceLine; ctx.lineWidth = 2; rrect(ctx, bx + 1, y + 1, bw - 2, b.h - 2, R.panel); ctx.stroke() }
      const bInk = mine ? p.onPanel : ink
      const bInk2 = mine ? p.onPanelSoft : ink2
      caption(ctx, mine ? c.plan.t.you : s.them, bx + SP[6], y + b.pad + FS.caption * 0.9, bInk2)
      drawSentence(ctx, b.L, bx + SP[6], y + b.pad + FS.caption * 1.45, 'left', () => ({ ink: bInk, rule: null, ruby: bInk2 }))
      paragraph(ctx, b.trB, bx + SP[6], y + b.pad + FS.caption * 1.45 + b.L.h + SP[2], bInk2)
      y += b.h + laid.gap
    }
    if (laid.note) paragraph(ctx, laid.note, f.x, y + SP[2], ink2, 'left', 1.3)
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
    const L = layoutSentence(ctx, [row], { max: FS.glyph, min: FS.title, maxW: f.w, maxLines: 1, maxH: room, script: 'furigana', rules: false })
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
    // The readings in one size: the largest at which the longest fits beside the glyph.
    const iw = f.right - ix
    const all = [...s.on, ...s.kun.map(([a, b]) => a + b)]
    let rs = FS.heading
    while (rs > FS.lead && all.some(r => measure(ctx, r, font(500, rs, 'jp'), TR.term) > iw)) rs -= 4
    const rf = font(500, rs, 'jp')
    const group = (label, list, draw) => {
      if (!list.length) return
      caption(ctx, label, ix, iy + FS.caption, p.line.kanji)
      iy += FS.caption + SP[4]
      for (const r of list) { draw(r); iy += rs * 1.3 }
      iy += SP[5]
    }
    group(t.on, s.on, r => text(ctx, r, ix, iy + rs * 0.9, { f: rf, color: ink, tr: TR.term }))
    group(t.kun, s.kun, ([stem, oku]) => {
      const w = text(ctx, stem, ix, iy + rs * 0.9, { f: rf, color: ink, tr: TR.term })
      if (oku) text(ctx, oku, ix + w + TR.term * rs, iy + rs * 0.9, { f: rf, color: ink2, tr: TR.term })
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
      ctx.strokeStyle = here ? p.line.kana : p.surfaceLine
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
    const bubble = FS.display * 0.7
    const mtr = s.model ? fit(ctx, s.model.tr, { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w - SP[7], maxLines: 2, balanced: false }) : null
    // What is fixed (the gaps, the form, the model's caption and
    // translation, the comment mark) first; the ask and the model share
    // the rest.
    const fixed = SP[7] + (s.form ? FS.lead * 2 + SP[8] : 0) + (s.model ? FS.caption + SP[4] + SP[3] + paragraphH(mtr) + SP[7] : 0) + bubble * 0.95
    const free = f.bottom - y - fixed
    const line = fit(ctx, s.text, { sizes: [FS.display, FS.heading, FS.title, FS.lead], maxW: f.w, maxH: free * (s.model ? 0.55 : 1), lh: 1.18 })
    const model = s.model ? layoutSentence(ctx, s.model.rows, { max: FS.display * 0.8, min: FS.lead, maxW: f.w - SP[7], maxLines: 2, maxH: free - paragraphH(line), script: c.plan.script, gap: 0.06, rules: false }) : null
    const total = paragraphH(line) + fixed + (model ? model.h : 0)
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
      y += model.h + SP[3] + paragraphH(mtr) + SP[7]
    }
    if (f.bottom - y >= bubble * 0.95) commentMark(ctx, p, f.x, y, bubble)
  },

  /** 終点: the post's last slide, in the ending the studio picked. */
  outro(c) { (ENDINGS[c.ending] || ENDINGS.mark)(c) },

  /** 模試's cover: the paper's name, its level, its sections, a name to fill in. */
  cover(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const plan = c.plan
    const t = plan.t
    const kanaOnly = !['N3', 'N2', 'N1'].includes(plan.level)
    masthead(ctx, p, f)
    levelRing(ctx, p, plan, f.right - 46, f.y + 32, 46, ink)
    const pill = 44 * 2.7
    const top = f.y + 64 + SP[7]
    const sub = fit(ctx, weldIf(plan.lang, t.coverSub(s.quizzes.length)), { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w, maxLines: 2 })
    const boxH = f.bottom - pill - SP[7] - paragraphH(sub) - SP[6] - top
    // The booklet: a double rule, as a printed paper is framed.
    ctx.strokeStyle = ink
    ctx.lineWidth = 4
    ctx.strokeRect(f.x + 2, top + 2, f.w - 4, boxH - 4)
    ctx.lineWidth = 1.5
    ctx.strokeRect(f.x + 16, top + 16, f.w - 32, boxH - 32)
    const ix = f.x + SP[7]
    const iw = f.w - SP[7] * 2
    let y = top + SP[7]
    caption(ctx, `${t.jlptStyle} · ${t.cover} · ${/^N\d$/.test(plan.level) ? plan.level : plan.source}`, ix, y + FS.caption, p.line.exam)
    y += FS.caption + SP[5]
    // The paper's name as large as the sections under it leave room for:
    // each section keeps a row it can be read in.
    const nameH = FS.caption + SP[5] + 4
    const n = Math.max(1, s.quizzes.length)
    const rowsRoom = ts => top + boxH - SP[7] - nameH - SP[4] - (y + ts * 1.08 + SP[3] + EDGE + SP[4])
    const ts = [FS.display, FS.heading, FS.title].find(z => rowsRoom(z) / n >= FS.lead * 1.4) || FS.title
    const rowH = Math.min(FS.lead * 1.7, rowsRoom(ts) / n)
    text(ctx, '模擬試験', ix, y + ts * ASC, { f: font(900, ts, 'serif'), color: ink })
    y += ts * 1.08 + SP[3]
    ctx.fillStyle = p.line.exam
    ctx.fillRect(ix, y, iw, EDGE)
    y += EDGE + SP[4]
    // The sections: もんだい1 かんじよみ — Reading.
    const rs = Math.max(FS.sm, Math.min(FS.lead, rowH * 0.6))
    s.quizzes.forEach((q, i) => {
      const ry = y + i * rowH
      const w = text(ctx, `${kanaOnly ? 'もんだい' : '問題'}${i + 1}`, ix, ry + rowH * 0.62, { f: font(700, rs, 'jp'), color: ink })
      const jp = KIND_JP[q.kind]?.[kanaOnly ? 0 : 1] || ''
      const w2 = jp ? SP[5] + text(ctx, jp, ix + w + SP[5], ry + rowH * 0.62, { f: font(500, rs, 'jp'), color: ink }) : 0
      // A question may name itself more briefly on the cover (plan 200n).
      const lb = fit(ctx, q.cover || q.label || '', { weight: 500, sizes: [Math.max(FS.sm, Math.min(FS.body, rowH * 0.55)), FS.sm, FS.caption], maxW: iw - w - w2 - SP[7], maxLines: 1, balanced: false })
      text(ctx, lb.lines[0] || '', ix + iw, ry + rowH * 0.62, { f: lb.f, color: ink2, align: 'right' })
    })
    // なまえ, and a line to write it on.
    const ny = top + boxH - SP[7] - 4
    caption(ctx, kanaOnly ? 'なまえ Name' : '名前 Name', ix, ny - SP[3], ink2)
    ctx.fillStyle = ink2
    ctx.fillRect(ix + 260, ny, iw - 260, 2)
    paragraph(ctx, sub, f.cx, top + boxH + SP[6], ink2, 'center')
    metal(ctx, p, f.cx, f.bottom - pill, t.next)
  },

  /** 解答: every question's number, and its right answer marked as a sheet is. */
  sheet(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const plan = c.plan
    const t = plan.t
    const kanaOnly = !['N3', 'N2', 'N1'].includes(plan.level)
    const hs = FS.title * 1.1
    const hw = text(ctx, kanaOnly ? 'かいとう' : '解答', f.x, f.y + hs * ASC, { f: font(700, hs, 'serif'), color: ink })
    text(ctx, t.sheet, f.x + hw + SP[5], f.y + hs * 0.8, { f: font(700, FS.lead, 'latin'), color: ink2 })
    let y = f.y + hs * 1.2 + SP[7]
    const cta = fit(ctx, weldIf(plan.lang, t.cta.exam(s.quizzes.length)), { sizes: [FS.title, FS.lead], maxW: f.w, maxLines: 2 })
    const n = s.quizzes.length
    const rowH = Math.min(190, (f.bottom - y - paragraphH(cta) - SP[8]) / n)
    const r = Math.min(34, rowH * 0.28)
    const HL = 3
    // Every label in one size: the largest at which each keeps to two
    // lines in the room its row's answer circles leave it.
    const bw0 = r * 2.2
    const roomOf = q => f.right - SP[5] - q.choices.length * r * 2 - (q.choices.length - 1) * SP[4] - SP[4] - (f.x + SP[5] + bw0 + SP[5])
    const labelSize = [FS.body, FS.sm, FS.caption].find(z => s.quizzes.every(q => !fit(ctx, q.label || '', { weight: 500, sizes: [z], maxW: roomOf(q), maxLines: 2, balanced: false }).cut)) || FS.caption
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(f.x, y, f.w, rowH * n + HL)
    s.quizzes.forEach((q, i) => {
      const ry = y + i * rowH
      ctx.fillStyle = c.dark ? p.card : p.surface
      ctx.fillRect(f.x + HL, ry + HL, f.w - HL * 2, rowH - HL)
      const mid = ry + HL + (rowH - HL) / 2
      // The number in its box, as the sheet prints it.
      const bw = r * 2.2
      ctx.strokeStyle = ink
      ctx.lineWidth = 2
      ctx.strokeRect(f.x + SP[5], mid - bw / 2, bw, bw)
      text(ctx, String(i + 1), f.x + SP[5] + bw / 2, mid + FS.lead * 0.36, { f: font(700, FS.lead, 'latin'), color: ink, align: 'center' })
      // The label keeps to the room the answer circles leave it.
      const k = q.choices.length
      const lx = f.x + SP[5] + bw + SP[5]
      const circles = f.right - SP[5] - k * r * 2 - (k - 1) * SP[4]
      const label = fit(ctx, q.label || '', { weight: 500, sizes: [labelSize], maxW: circles - SP[4] - lx, maxLines: 2, balanced: false })
      paragraph(ctx, label, lx, mid - paragraphH(label) / 2, ink2)
      // ① ② ③ ④, the right one filled in.
      for (let j = 0; j < k; j++) {
        const cx = f.right - SP[5] - r - (k - 1 - j) * (r * 2 + SP[4])
        const right = j === q.right
        ctx.beginPath()
        ctx.arc(cx, mid, r, 0, Math.PI * 2)
        if (right) { ctx.fillStyle = p.line.exam; ctx.fill() }
        ctx.strokeStyle = right ? p.line.exam : ink2
        ctx.lineWidth = 2.5
        ctx.stroke()
        text(ctx, String(j + 1), cx, mid + FS.body * 0.36, { f: font(700, FS.body, 'latin'), color: right ? p.onLine : ink2, align: 'center' })
      }
    })
    y += rowH * n + HL + SP[8]
    paragraph(ctx, cta, f.x, y, ink)
  },

  /** 乗換: the two (or three) side by side, each on its own plate. */
  sides(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    let y = title(c, t.types.compare.name)
    const sides = s.sides
    const n = sides.length
    const gap = SP[5]
    const across = sides.every(x => [...x.head].length <= 3)
    const cw = across ? (f.w - gap * (n - 1)) / n : f.w
    const room = across ? f.bottom - y : (f.bottom - y - gap * (n - 1)) / n
    // Each plate as tall as what it holds, the largest setting the row: a
    // scale under which every plate's head, meaning and form fit its room.
    const headMax = k => k * (across ? Math.min(FS.glyph, cw * 0.62, room * 0.3) : Math.min(FS.word * 0.7, room * 0.34))
    const meanSizes = k => [FS.heading, FS.title, FS.lead, FS.body].map(z => z * Math.max(k, 0.75))
    const need = (x, k) => {
      const iw = cw - SP[6] * 2
      const head = headLines(ctx, x.head, { maxW: iw, maxSize: headMax(k), minSize: FS.lead, maxLines: 2 })
      const m = x.meaning ? paragraphH(fit(ctx, x.meaning, { sizes: meanSizes(k), maxW: iw, maxLines: 4, lh: 1.15 }), 1.15) + SP[3] : 0
      const fm = x.form ? paragraphH(fit(ctx, x.form, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: iw, maxLines: 3, balanced: false })) + SP[3] : 0
      const sub = x.sub ? FS.title * 1.2 + SP[3] : 0
      const words = (x.words || []).length * (FS.title * 1.15 + FS.body * 1.4 + SP[3])
      return SP[6] * 2 + headH(head) + SP[4] + sub + m + fm + words + EDGE * 1.4
    }
    const k = [1, 0.85, 0.7, 0.55, 0.45].find(z => Math.max(...sides.map(x => need(x, z))) <= room) ?? 0.45
    const ch = Math.min(room, Math.max(...sides.map(x => need(x, k))))
    if (across) y += (room - ch) * 0.3
    sides.forEach((x, i) => {
      const bx = across ? f.x + i * (cw + gap) : f.x
      const by = across ? y : y + i * (ch + gap)
      const color = p.line[x.line] || p.line.grammar
      ctx.fillStyle = c.dark ? p.card : p.surface
      rrect(ctx, bx, by, cw, ch, R.plate)
      ctx.fill()
      ctx.strokeStyle = x.here ? color : p.surfaceLine
      ctx.lineWidth = x.here ? RING : 2
      rrect(ctx, bx + 1, by + 1, cw - 2, ch - 2, R.plate)
      ctx.stroke()
      ctx.save()
      rrect(ctx, bx, by, cw, ch, R.plate)
      ctx.clip()
      ctx.fillStyle = color
      ctx.fillRect(bx, by + ch - EDGE * 1.4, cw, EDGE * 1.4)
      ctx.restore()
      const pad = SP[6]
      const iw = cw - pad * 2
      let iy = by + pad
      // The head, as large as its plate allows.
      const head = headLines(ctx, x.head, { maxW: iw, maxSize: headMax(k), minSize: FS.lead, maxLines: 2 })
      drawHead(ctx, head, across ? bx + cw / 2 : bx + pad, iy, ink, across ? 'center' : 'left')
      iy += headH(head) + SP[4]
      const ax = across ? bx + cw / 2 : bx + pad
      const align = across ? 'center' : 'left'
      if (x.sub) {
        text(ctx, x.sub, ax, iy + FS.title * 0.85, { f: font(700, FS.title, 'latin'), color, align })
        iy += FS.title * 1.2 + SP[3]
      }
      const end = by + ch - EDGE * 1.4 - SP[4]
      const left = end - iy
      // The form keeps its room first, then the meaning takes the rest: a
      // plate held to the row's height never sets either past its foot.
      const formFit = h => fit(ctx, x.form, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: iw, maxLines: 3, maxH: h, balanced: false })
      const formH = x.form ? paragraphH(formFit(left * 0.45)) + SP[3] : 0
      if (x.meaning) {
        const m = fit(ctx, x.meaning, { sizes: meanSizes(k), maxW: iw, maxH: Math.max(left - formH - SP[3], FS.body * 1.2), lh: 1.15 })
        iy += paragraph(ctx, m, ax, iy, ink, align, 1.15) + SP[3]
      }
      if (x.form) iy += paragraph(ctx, formFit(Math.max(end - iy, FS.sm * 1.3)), ax, iy, ink2, align) + SP[3]
      for (const w of x.words || []) {
        if (iy + FS.body * 2.6 > by + ch - EDGE * 1.4) break
        text(ctx, w.t, ax, iy + FS.title * 0.9, { f: font(700, FS.title, 'jp'), color: ink, align })
        iy += FS.title * 1.15
        const wb = fit(ctx, `${w.r} · ${w.main}`, { weight: 500, sizes: [FS.body, FS.sm, FS.caption], maxW: iw, maxLines: 1, balanced: false })
        paragraph(ctx, wb, ax, iy, ink2, align)
        iy += paragraphH(wb) + SP[3]
      }
    })
  },

  /** What tells them apart, in the catalogue's words. */
  difference(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    let y = title(c, c.plan.t.difference)
    const heads = s.sides.map(x => x.head)
    const L = chunkLayout(ctx, heads.flatMap((h, i) => (i ? [{ t: '／', op: true }, { t: h, lit: true, line: s.sides[i].line }] : [{ t: h, lit: true, line: s.sides[i].line }])), f.w, FS.display)
    if (L.w <= f.w) {
      drawChunk(ctx, p, L, f.x, y, ink, ink2)
      y += L.h + SP[8]
    } else {
      // Too long side by side: one under the other, each on its line's rule.
      for (const [i, h] of heads.entries()) {
        const hd = headLines(ctx, h, { maxW: f.w, maxSize: FS.heading, minSize: FS.lead, maxLines: 2 })
        drawHead(ctx, hd, f.x, y, ink)
        y += headH(hd)
        ctx.fillStyle = p.line[s.sides[i].line] || p.line.grammar
        ctx.fillRect(f.x, y + SP[1], Math.min(f.w, Math.max(...hd.lines.map(l => measure(ctx, l, hd.f)))), EDGE)
        y += EDGE + SP[5]
      }
      y += SP[5]
    }
    const room = f.bottom - y
    const a = s.diff ? fit(ctx, s.diff, { sizes: [FS.heading, FS.title, FS.lead], maxW: f.w, maxH: s.careful ? room * 0.6 : room, lh: 1.22, balanced: false }) : null
    if (a) y += paragraph(ctx, a, f.x, y, ink, 'left', 1.22) + SP[8]
    if (s.careful) {
      const b = fit(ctx, s.careful, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxH: f.bottom - y, lh: 1.3, balanced: false })
      paragraph(ctx, b, f.x, y, ink2, 'left', 1.3)
    }
  },

  /** 組立: the sentence so far, the piece this step adds lit on its line,
   *  and under it each word of the piece with what it does. */
  step(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const b = s.build
    const st = b.steps[s.n - 1]
    let y = title(c, c.plan.t.step(s.n, b.steps.length))
    const goal = fit(ctx, `“${b.translation}”`, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxLines: 2, balanced: false })
    y += paragraph(ctx, goal, f.x, y, ink2) + SP[7]
    const pieces = chunkLayout(ctx, st.items.length ? st.items : [{ t: '…' }], f.w, FS.display * 1.2)
    // The whole sentence sets the size, so it grows the same on every step.
    const whole = layoutSentence(ctx, b.rows, { max: FS.display * 1.1, min: FS.lead, maxW: f.w, maxLines: 3, maxH: Math.max(FS.display * 1.4, f.h * 0.34), script: c.plan.script, gap: 0.1 })
    const rows = b.rows.slice(0, st.upto)
    const L = layoutSentence(ctx, rows, { max: whole.size, min: whole.size, maxW: f.w, maxLines: 3, script: c.plan.script, gap: 0.1 })
    drawSentence(ctx, L, f.x, y, 'left', u => ({ ink: u.i >= st.from ? ink : ink2, rule: u.i >= st.from ? lineOf(p, u.row) : null, ruby: ink2 }))
    y += L.h + SP[8]
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(f.x, y - SP[5], f.w, 2)
    drawChunk(ctx, p, pieces, f.x, y + SP[3], ink, ink2)
    y += pieces.h + SP[6] + SP[3]
    // What the point does here, in what room is left under the pieces.
    const how = st.line && f.bottom - y > FS.sm * 1.2 ? fit(ctx, st.line, { weight: 500, sizes: [FS.title, FS.lead, FS.body, FS.sm], maxW: f.w, maxLines: 5, maxH: f.bottom - y, lh: 1.25, balanced: false }) : null
    if (how) paragraph(ctx, how, f.x, y, ink, 'left', 1.25)
  },

  /** 一覧: one item of the list, as large as it goes. */
  item(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const it = s.item
    const color = p.line[s.line] || p.line.vocab
    const y0 = title(c, s.title, f.y, s.of ? `${it.n}/${s.of}` : '')
    let y = y0
    if (it.kind === 'sentence') {
      const trB = fit(ctx, it.tr, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w - SP[7], maxLines: 3, balanced: false })
      const note = it.note ? captionBlock(ctx, it.note, f.w) : null
      const L = layoutSentence(ctx, it.rows, { max: FS.display * 1.1, min: FS.lead, maxW: f.w - SP[7], maxLines: 4, maxH: f.bottom - y - paragraphH(trB) - SP[6] - (note ? note.h + SP[6] : 0) - SP[8], script: c.plan.script, gap: 0.08 })
      const h = L.h + SP[5] + paragraphH(trB)
      y += Math.max(0, (f.bottom - y - h - (note ? note.h + SP[6] : 0)) * 0.42)
      if (note) { note.draw(f.x, y, color); y += note.h + SP[6] }
      ctx.fillStyle = color
      rrect(ctx, f.x, y, EDGE, h, EDGE / 2)
      ctx.fill()
      drawSentence(ctx, L, f.x + SP[7], y, 'left', u => ({ ink, rule: u.row.lit ? color : null, ruby: ink2 }))
      paragraph(ctx, trB, f.x + SP[7], y + L.h + SP[5], ink2)
      return
    }
    // A word: its number on the line, the word with its reading, its sense.
    const row = { t: it.head, fu: it.fu || furiganaOf(it.head, it.reading), k: 'word', ro: it.ro }
    const main = fit(ctx, it.main || '', { sizes: [FS.display, FS.heading, FS.title], maxW: f.w, maxLines: 2 })
    const room = f.bottom - y - paragraphH(main) - FS.lead * 1.6 - SP[8] * 2
    const L = layoutSentence(ctx, [row], { max: FS.glyph, min: FS.title, maxW: f.w, maxLines: 1, maxH: room, script: 'furigana', rules: false })
    const total = L.h + FS.lead * 1.6 + SP[8] + paragraphH(main)
    y += Math.max(0, (f.bottom - y - total) / 2)
    drawSentence(ctx, L, f.cx, y, 'center', () => ({ ink, rule: null, ruby: ink2 }))
    y += L.h
    // Its romaji, its level in the tag the rows give it, centred together.
    const rf = font(500, FS.lead, 'latin')
    const level = levelOf({ sub: it.tag })
    const rw = it.ro ? measure(ctx, it.ro, rf) : 0
    const lw = level ? levelW(ctx, level) : 0
    const rx = f.cx - (rw + (rw && lw ? SP[4] : 0) + lw) / 2
    if (it.ro) text(ctx, it.ro, rx, y + FS.lead * 1.1, { f: rf, color: ink2 })
    if (level) levelTag(ctx, p, rx + rw + (rw ? SP[4] : 0), y + FS.lead * 1.1 - FS.lead * 0.36 - LEVEL_H / 2, level)
    y += FS.lead * 1.6 + SP[8]
    ctx.fillStyle = color
    ctx.fillRect(f.cx - SP[9] / 2, y - SP[6], SP[9], EDGE)
    paragraph(ctx, main, f.cx, y, ink, 'center')
  },

  /** 会話: one line of the scene, the line before it small above. */
  line(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    let y = title(c, s.place, f.y, `${s.n}/${s.of}`)
    // A bubble at the largest setting that keeps it inside `maxH`.
    const bubble = (l, maxH, big) => {
      const mine = l.who === 'me'
      const bw = f.w * (big ? 0.92 : 0.8)
      const iw = bw - SP[6] * 2
      const ladder = big
        ? [[FS.display, FS.title], [FS.heading, FS.lead], [FS.title, FS.body], [FS.lead, FS.body], [FS.body, FS.sm]]
        : [[FS.title, FS.body], [FS.lead, FS.body], [FS.body, FS.sm]]
      let B = null
      for (const [max, trSize] of ladder) {
        const trB = fit(ctx, l.tr, { weight: 500, sizes: [trSize], maxW: iw, maxLines: 3, balanced: false })
        const L = layoutSentence(ctx, l.rows, { max, min: Math.min(max, FS.body), maxW: iw, maxLines: 4, script: c.plan.script, rules: false, gap: 0.05 })
        B = { mine, bw, trB, L, h: FS.caption * 1.8 + L.h + SP[4] + paragraphH(trB) + SP[6] * 2, who: mine ? t.you : s.them }
        if (B.h <= maxH) return B
      }
      return { ...B, over: true }
    }
    const drawBubble = (B, by, dim) => {
      const bx = B.mine ? f.right - B.bw : f.x
      ctx.fillStyle = B.mine ? p.pass : (c.dark ? p.card : p.surface)
      ctx.globalAlpha = dim ? 0.8 : 1
      rrect(ctx, bx, by, B.bw, B.h, R.panel)
      ctx.fill()
      ctx.globalAlpha = 1
      if (!B.mine && !c.dark) { ctx.strokeStyle = p.surfaceLine; ctx.lineWidth = 2; rrect(ctx, bx + 1, by + 1, B.bw - 2, B.h - 2, R.panel); ctx.stroke() }
      const bInk = B.mine ? p.onPanel : ink
      const bInk2 = B.mine ? p.onPanelSoft : ink2
      caption(ctx, B.who, bx + SP[6], by + SP[6] + FS.caption, bInk2)
      drawSentence(ctx, B.L, bx + SP[6], by + SP[6] + FS.caption * 1.8, 'left', () => ({ ink: bInk, rule: null, ruby: bInk2 }))
      paragraph(ctx, B.trB, bx + SP[6], by + SP[6] + FS.caption * 1.8 + B.L.h + SP[4], bInk2)
    }
    const room = f.bottom - y
    // The line before, small, where it fits; the line itself in the rest.
    const prev = s.prev ? bubble(s.prev, room * 0.36, false) : null
    if (prev && !prev.over) { drawBubble(prev, y, true); y += prev.h + SP[7] }
    const cur = bubble(s.line, f.bottom - y, true)
    drawBubble(cur, y + Math.max(0, (f.bottom - y - cur.h) * 0.3), false)
  },

  // ── Plan 200m's modes ─────────────────────────────────────────
  /** 単語帳: a word of the theme, drawn: its picture on a card, the word
   *  with its reading over it, its romaji, its sense. */
  picture(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const w = s.w
    let y = title(c, s.title, f.y, `${s.n}/${s.of}`)
    const room = f.bottom - y
    const main = fit(ctx, w.main, { sizes: [FS.display, FS.heading, FS.title], maxW: f.w, maxLines: 2 })
    const L = layoutSentence(ctx, [wordRow(w)], { max: FS.word * 0.8, min: FS.title, maxW: f.w, maxLines: 1, maxH: room * 0.22, script: 'furigana', rules: false })
    const roH = FS.lead * 1.6
    // The picture takes what the word and its sense leave it.
    const card = Math.max(FS.word, Math.min(f.w * 0.6, room - L.h - roH - paragraphH(main) - SP[6] * 2 - SP[7]))
    const total = card + SP[6] + L.h + roH + SP[7] + paragraphH(main)
    y += Math.max(0, (room - total) / 2)
    pictureCard(c, f.cx - card / 2, y, card, card)
    picture(ctx, w.e, f.cx, y + card / 2, card * 0.6)
    y += card + SP[6]
    drawSentence(ctx, L, f.cx, y, 'center', () => ({ ink, rule: null, ruby: ink2 }))
    y += L.h
    romajiLine(c, w.ro, w.lv, f.cx, y)
    y += roH + SP[7]
    ctx.fillStyle = p.line.vocab
    ctx.fillRect(f.cx - SP[9] / 2, y - SP[6], SP[9], EDGE)
    paragraph(ctx, main, f.cx, y, ink, 'center')
  },

  /** 単語帳's recap: every word of the post on one slide, two by two. */
  picturegrid(c, s) {
    const { ctx, f, ink, ink2 } = c
    let y = title(c, s.title)
    const n = s.items.length
    const cols = n > 4 ? 2 : 1
    const rows = Math.ceil(n / cols)
    const gap = SP[4]
    const cw = (f.w - gap * (cols - 1)) / cols
    const ch = Math.min((f.bottom - y - gap * (rows - 1)) / rows, cw * 0.62)
    y += Math.max(0, (f.bottom - y - (ch * rows + gap * (rows - 1))) / 2)
    s.items.forEach((w, i) => {
      const x = f.x + (i % cols) * (cw + gap)
      const top = y + Math.floor(i / cols) * (ch + gap)
      pictureCard(c, x, top, cw, ch)
      const pad = SP[4]
      // The word and its gloss beside the picture; a word too long for the
      // room (懐中電灯 read かいちゅうでんとう) has the picture step down for it.
      const lay = ps => {
        const tx = x + pad + ps * 1.1 + SP[3]
        const tw = x + cw - pad - tx
        // A gloss is never broken inside a word (strawbe-rry): a size down first.
        const sizes = [FS.lead, FS.body, FS.sm, FS.caption]
        const whole = z => w.main.split(/\s+/).every(part => measure(ctx, part, font(500, z, 'latin')) <= tw)
        const main = fit(ctx, w.main, { weight: 500, sizes: [sizes.find(whole) || FS.caption], maxW: tw, maxLines: 3, balanced: false })
        const L = layoutSentence(ctx, [wordRow(w)], { max: FS.title, min: FS.xs, maxW: tw, maxLines: 1, maxH: ch - paragraphH(main) - SP[2] - SP[3] * 2, script: 'furigana', rules: false })
        return { ps, tx, main, L, fits: L.lineW(L.lines[0]) <= tw && L.lines.length === 1 }
      }
      let at = lay(Math.min(ch * 0.5, cw * 0.2))
      if (!at.fits) at = lay(Math.min(ch * 0.5, cw * 0.12))
      const { ps, tx, main, L } = at
      picture(ctx, w.e, x + pad + ps * 0.55, top + ch / 2, ps)
      const h = L.h + SP[2] + paragraphH(main)
      const ty = top + Math.max(SP[3], (ch - h) / 2)
      drawSentence(ctx, L, tx, ty, 'left', () => ({ ink, rule: null, ruby: ink2 }))
      paragraph(ctx, main, tx, ty + L.h + SP[2], ink2)
    })
  },

  /** 仲間外れ: six words, one not of the theme; on the answer, what each
   *  means and the impostor circled. */
  oddone(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    const lang = c.plan.lang
    const round = s.round
    let y = title(c, s.revealed ? t.modes.revealed : t.modes.impostor, f.y, `${s.n}/${s.of}`)
    const ask = fit(ctx, weldIf(lang, s.ask), { sizes: [FS.title, FS.lead], maxW: f.w, maxLines: 2 })
    y += paragraph(ctx, ask, f.x, y, ink) + SP[7]
    const foot = s.revealed
      ? fit(ctx, round.why, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: f.w - 170, maxLines: 3, balanced: false })
      : fit(ctx, weldIf(lang, t.examCta(round.words.length)), { sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxLines: 2 })
    const footH = Math.max(paragraphH(foot), s.revealed ? 140 : 0)
    const gap = SP[4]
    const cw = (f.w - gap) / 2
    const rowsN = Math.ceil(round.words.length / 2)
    const gridH = f.bottom - y - SP[7] - footH
    const ch = (gridH - gap * (rowsN - 1)) / rowsN
    const r = 26
    round.words.forEach((w, i) => {
      const x = f.x + (i % 2) * (cw + gap)
      const top = y + Math.floor(i / 2) * (ch + gap)
      const odd = i === round.at
      const dim = s.revealed && !odd
      ctx.fillStyle = c.dark ? p.card : p.surface
      rrect(ctx, x, top, cw, ch, R.card)
      ctx.fill()
      ctx.strokeStyle = s.revealed && odd ? p.line.exam : p.surfaceLine
      ctx.lineWidth = s.revealed && odd ? RING : 2
      rrect(ctx, x + ctx.lineWidth / 2, top + ctx.lineWidth / 2, cw - ctx.lineWidth, ch - ctx.lineWidth, R.card)
      ctx.stroke()
      const rx = x + SP[4] + r
      roundel(ctx, rx, top + ch / 2, r, dim ? p.surfaceLine : p.line.exam, String(i + 1), { ink: dim ? ink2 : p.line.exam, size: FS.body })
      // The word beside its number, its reading over it, its romaji under
      // it; on the answer, what it means in the romaji's place (read on
      // the question already), on one line.
      const tx = rx + r + SP[3]
      const inner = x + cw - SP[4] - tx
      const meaning = s.revealed ? fit(ctx, w.main, { weight: odd ? 700 : 500, sizes: [FS.lead, FS.body, FS.sm, FS.caption], maxW: inner, maxLines: 2, balanced: false }) : null
      const mh = meaning ? paragraphH(meaning) + SP[1] : 0
      const L = layoutSentence(ctx, [wordRow(w)], { max: FS.heading, min: FS.sm, maxW: inner, maxLines: 1, maxH: ch - SP[3] * 2 - mh, script: 'furigana', romaji: !s.revealed, rules: false })
      const h = L.h + mh
      const ty = top + Math.max(SP[2], (ch - h) / 2)
      drawSentence(ctx, L, tx + inner / 2, ty, 'center', () => ({ ink: dim ? ink2 : ink, rule: null, ruby: ink2, romaji: ink2 }))
      if (meaning) paragraph(ctx, meaning, tx + inner / 2, ty + L.h + SP[1], odd ? ink : ink2, 'center')
      if (s.revealed && odd) marked(ctx, p, rx, top + ch / 2, r)
    })
    y += gridH + SP[7]
    paragraph(ctx, foot, f.x, y, ink)
    if (s.revealed) stamp(ctx, p, f.right - 66, y + 70, 62)
  },

  /** 似た字: one kanji of the set, its readings, its sense, a word it
   *  writes, and what tells it from the others. */
  lookchar(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    const k = s.k
    let y = title(c, s.all.join('・'), f.y, `${s.n}/${s.of}`)
    const gs = Math.min(FS.glyph * 0.9, f.w * 0.3)
    text(ctx, k.c, f.x, y + gs * ASC, { f: font(700, gs, 'serif'), color: ink })
    ctx.fillStyle = p.line.kanji
    ctx.fillRect(f.x, y + gs * 1.02, gs, EDGE)
    const ix = f.x + gs + SP[8]
    let iy = y
    const iw = f.right - ix
    const all = [...k.on, ...k.kun.map(([a, b]) => a + b)]
    let rs = FS.heading
    while (rs > FS.lead && all.some(r => measure(ctx, r, font(500, rs, 'jp'), TR.term) > iw)) rs -= 4
    const rf = font(500, rs, 'jp')
    // Two readings of each kind at most: the slide is about the shape.
    const group = (label, list, draw) => {
      if (!list.length) return
      caption(ctx, label, ix, iy + FS.caption, p.line.kanji)
      iy += FS.caption + SP[4]
      for (const r of list.slice(0, 2)) { draw(r); iy += rs * 1.3 }
      iy += SP[5]
    }
    group(t.on, k.on, r => text(ctx, r, ix, iy + rs * 0.9, { f: rf, color: ink, tr: TR.term }))
    group(t.kun, k.kun, ([stem, oku]) => {
      const w = text(ctx, stem, ix, iy + rs * 0.9, { f: rf, color: ink, tr: TR.term })
      if (oku) text(ctx, oku, ix + w + TR.term * rs, iy + rs * 0.9, { f: rf, color: ink2, tr: TR.term })
    })
    y = Math.max(y + gs * 1.02 + EDGE + SP[7], iy + SP[5])
    const meaning = fit(ctx, k.meaning, { sizes: [FS.display, FS.heading, FS.title], maxW: f.w, maxLines: 2 })
    y += paragraph(ctx, meaning, f.x, y, ink) + SP[6]
    // What sets it apart, then a word it writes; the word gives way first.
    const wordOf = () => {
      if (!k.word) return null
      const W = layoutSentence(ctx, [{ t: k.word.t, fu: k.word.fu, k: 'word' }], { max: FS.heading, min: FS.title, maxW: f.w * 0.5, maxLines: 1, script: 'furigana', rules: false })
      const g = fit(ctx, k.word.main, { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w - W.lineW(W.lines[0]) - SP[6], maxLines: 2, balanced: false })
      return { W, g, h: Math.max(W.h, paragraphH(g)) }
    }
    let word = wordOf()
    const noteAt = (room, sizes) => fit(ctx, k.note, { weight: 500, sizes, maxW: f.w - SP[7], maxH: room, lh: 1.25, balanced: false })
    let note = noteAt(f.bottom - y - (word ? word.h + SP[7] : 0), [FS.heading, FS.title, FS.lead])
    if (note.cut && word) { word = null; note = noteAt(f.bottom - y, [FS.heading, FS.title, FS.lead, FS.body]) }
    const nh = paragraphH(note, 1.25)
    ctx.fillStyle = p.line.kanji
    rrect(ctx, f.x, y, EDGE, nh, EDGE / 2)
    ctx.fill()
    paragraph(ctx, note, f.x + SP[7], y, ink, 'left', 1.25)
    y += nh + SP[7]
    if (word && y + word.h <= f.bottom) {
      drawSentence(ctx, word.W, f.x, y, 'left', () => ({ ink, rule: null, ruby: ink2 }))
      const gx = f.x + word.W.lineW(word.W.lines[0]) + SP[6]
      paragraph(ctx, word.g, gx, y + word.h - paragraphH(word.g), ink2)
    }
  },

  /** 似た字's summary: every kanji of the set beside its sense and what
   *  tells it apart. */
  apart(c, s) {
    const { ctx, f, ink, ink2 } = c
    let y = title(c, c.plan.t.modes.apart)
    const n = s.chars.length
    const gap = SP[4]
    const rowH = Math.min((f.bottom - y - gap * (n - 1)) / n, FS.glyph * 1.3)
    y += Math.max(0, (f.bottom - y - rowH * n - gap * (n - 1)) / 2)
    const gs = Math.min(rowH * 0.62, FS.glyph)
    s.chars.forEach((k, i) => {
      const top = y + i * (rowH + gap)
      pictureCard(c, f.x, top, f.w, rowH)
      text(ctx, k.c, f.x + SP[4], top + (rowH - gs) / 2 + gs * ASC, { f: font(700, gs, 'serif'), color: ink })
      const tx = f.x + SP[4] + gs + SP[5]
      const tw = f.right - SP[4] - tx
      // The note is what the slide is for: the meaning steps down first.
      // Its senses on one line, else its first alone.
      let meaning = fit(ctx, k.meaning, { sizes: [FS.title, FS.lead, FS.body], maxW: tw, maxLines: 1 })
      if (meaning.cut) meaning = fit(ctx, k.meaning.split(', ')[0], { sizes: [FS.title, FS.lead, FS.body], maxW: tw, maxLines: 1 })
      const note = fit(ctx, k.note, { weight: 500, sizes: [FS.lead, FS.body, FS.sm, FS.caption], maxW: tw, maxH: rowH - paragraphH(meaning) - SP[1] - SP[2] * 2, maxLines: 3, lh: 1.2, balanced: false })
      const h = paragraphH(meaning) + SP[1] + paragraphH(note, 1.2)
      const ty = top + Math.max(SP[2], (rowH - h) / 2)
      paragraph(ctx, meaning, tx, ty, ink)
      paragraph(ctx, note, tx, ty + paragraphH(meaning) + SP[1], ink2, 'left', 1.2)
    })
  },

  /** 返事: what they say, and what you could answer; on the next slide,
   *  the answer said. Every line with its furigana and its romaji, for
   *  a beginner to read. */
  turn(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    const lang = c.plan.lang
    const tu = s.turn
    let y = title(c, s.place, f.y, `${s.n}/${s.of}`)
    const room = f.bottom - y
    const r = 28
    // A beginner's conversation (N5, N4) sets its romaji under every word
    // (plan 200n); a later level's, its furigana alone.
    const ro = s.romaji !== false
    const say = (rows, max, maxW, romaji = ro) => layoutSentence(ctx, rows, { max, min: Math.min(max, FS.sm), maxW, maxLines: 3, script: 'furigana', romaji, rules: false, gap: 0.18 })
    // A bubble: who says it, the line, its translation (none where it gave way).
    const bubbleOf = (rows, trText, bw, max, trSize, romaji) => {
      const iw = bw - SP[6] * 2
      const L = say(rows, max, iw, romaji)
      const trB = trText ? fit(ctx, trText, { weight: 500, sizes: [trSize], maxW: iw, maxLines: 3, balanced: false }) : null
      return { L, trB, bw, h: FS.caption * 1.6 + L.h + (trB ? SP[3] + paragraphH(trB) : 0) + SP[4] * 2 }
    }
    const lay = ([max, trSize, small], o) => {
      // On the question their line takes the width, and keeps to fewer
      // lines; on the answer, read already, it goes without its romaji,
      // then without its translation, then gives way to the why.
      const them = o.them === false ? null : bubbleOf(tu.them.rows, o.themTr === false ? '' : tu.them.tr, s.revealed ? f.w * 0.92 : f.w, max, trSize, s.revealed ? false : o.themRo)
      const themH = them ? them.h + SP[6] : 0
      if (!s.revealed) {
        const task = o.task ? fit(ctx, t.modes.say, { sizes: [trSize === FS.lead ? FS.title : FS.lead], maxW: f.w, maxLines: 1 }) : null
        const cw = f.w - SP[4] - r * 2 - SP[3] - SP[4]
        const choices = tu.choices.map(rows => say(rows, small, cw))
        const chH = choices.map(L => Math.max(r * 2, L.h) + SP[3] * 2)
        const cta = o.cta ? fit(ctx, weldIf(lang, t.examCta(tu.choices.length)), { sizes: [FS.lead, FS.body], maxW: f.w, maxLines: 2 }) : null
        const h = themH + (task ? paragraphH(task) + SP[4] : 0) + chH.reduce((a, b) => a + b, 0) + SP[3] * (chH.length - 1) + (cta ? SP[6] + paragraphH(cta) : 0)
        return { them, task, choices, chH, cta, h }
      }
      const mine = bubbleOf(tu.choices[tu.right], tu.reply, f.w - r * 2 - SP[6], max, trSize, ro)
      // Why, in the room the two lines leave it, never under their translations' rung.
      const free = room - themH - mine.h - SP[7]
      const whyAt = maxW => fit(ctx, tu.why, { weight: 500, sizes: [FS.title, FS.lead, FS.body, FS.sm].filter(z => z >= Math.min(trSize, FS.body)), maxW, maxH: free, maxLines: 8, lh: 1.25, balanced: false })
      let why = whyAt(f.w - 170)
      // At the least setting, a long why takes the stamp's room.
      const wide = why.cut && trSize === FS.sm
      if (wide) why = whyAt(f.w)
      // A why cut short is no fit: the lines step down for it first.
      const h = why.cut ? Infinity : themH + mine.h + SP[7] + Math.max(paragraphH(why, 1.25), wide ? 0 : 140)
      return { them, mine, why, wide, h }
    }
    // The lines at the largest setting that holds. On the question the
    // call to comment gives way first (the number circles say how to
    // answer), then their line's romaji, then the ask: the answers keep
    // theirs. On the answer, their line (read on the question) gives way
    // before the why is ever cut.
    const passes = s.revealed
      ? [{}, { themTr: false }, { them: false }]
      : [{ cta: true, themRo: ro, task: true }, { themRo: ro, task: true }, { themRo: false, task: true }, { themRo: false }]
    let L = null
    find: for (const o of passes) {
      for (const step of [[FS.heading, FS.lead, FS.title], [FS.title, FS.lead, FS.lead], [FS.title, FS.body, FS.body], [FS.lead, FS.body, FS.body], [FS.lead, FS.sm, FS.sm], [FS.body, FS.sm, FS.sm]]) {
        L = lay(step, o)
        if (L.h <= room) break find
      }
    }
    y += Math.max(0, (room - L.h) * 0.4)
    const drawBubble = (B, bx, by, mine, who) => {
      ctx.fillStyle = mine ? p.pass : (c.dark ? p.card : p.surface)
      rrect(ctx, bx, by, B.bw, B.h, R.panel)
      ctx.fill()
      if (!mine && !c.dark) { ctx.strokeStyle = p.surfaceLine; ctx.lineWidth = 2; rrect(ctx, bx + 1, by + 1, B.bw - 2, B.h - 2, R.panel); ctx.stroke() }
      const bInk = mine ? p.onPanel : ink
      const bInk2 = mine ? p.onPanelSoft : ink2
      caption(ctx, who, bx + SP[6], by + SP[4] + FS.caption, bInk2)
      drawSentence(ctx, B.L, bx + SP[6], by + SP[4] + FS.caption * 1.6, 'left', () => ({ ink: bInk, rule: null, ruby: bInk2, romaji: bInk2 }))
      if (B.trB) paragraph(ctx, B.trB, bx + SP[6], by + SP[4] + FS.caption * 1.6 + B.L.h + SP[3], bInk2)
    }
    if (L.them) {
      drawBubble(L.them, f.x, y, false, s.them)
      y += L.them.h + SP[6]
    }
    if (!s.revealed) {
      if (L.task) y += paragraph(ctx, L.task, f.x, y, p.line.grammar) + SP[4]
      L.choices.forEach((CL, i) => {
        const h = L.chH[i]
        ctx.fillStyle = c.dark ? p.card : p.surface
        rrect(ctx, f.x, y, f.w, h, R.card)
        ctx.fill()
        ctx.strokeStyle = p.surfaceLine
        ctx.lineWidth = 2
        rrect(ctx, f.x + 1, y + 1, f.w - 2, h - 2, R.card)
        ctx.stroke()
        roundel(ctx, f.x + SP[4] + r, y + h / 2, r, p.line.exam, String(i + 1), { ink: p.line.exam, size: FS.lead })
        drawSentence(ctx, CL, f.x + SP[4] + r * 2 + SP[3], y + (h - CL.h) / 2, 'left', () => ({ ink, rule: null, ruby: ink2, romaji: ink2 }))
        y += h + SP[3]
      })
      if (L.cta) paragraph(ctx, L.cta, f.x, y - SP[3] + SP[6], ink)
      return
    }
    // The answer, said: the right number circled beside your line.
    const bx = f.right - L.mine.bw
    drawBubble(L.mine, bx, y, true, t.you)
    roundel(ctx, f.x + r, y + L.mine.h / 2, r, p.line.exam, String(tu.right + 1), { ink: p.line.exam, size: FS.lead })
    marked(ctx, p, f.x + r, y + L.mine.h / 2, r * 0.7)
    y += L.mine.h + SP[7]
    paragraph(ctx, L.why, f.x, y, ink2, 'left', 1.25)
    if (!L.wide) stamp(ctx, p, f.right - 66, y + 70, 62)
  },
}

/** A caption kept to the frame's width as it is drawn (capitals, tracked):
 *  a size down before it takes a second line. */
function captionBlock(ctx, str, maxW) {
  const linesAt = size => {
    const f = font(700, size, 'latin')
    const out = []
    for (const w of str.toLocaleUpperCase().split(' ')) {
      const t = out.length ? `${out[out.length - 1]} ${w}` : w
      if (out.length && measure(ctx, t, f, TR.caption) <= maxW) out[out.length - 1] = t
      else out.push(w)
    }
    return out
  }
  const one = [FS.caption, FS.xs].find(z => linesAt(z).length === 1)
  const size = one || FS.caption
  const lines = linesAt(size)
  const lh = size * 1.4
  return {
    h: size + (lines.length - 1) * lh,
    draw(x, y, color) { lines.forEach((l, i) => caption(ctx, l, x, y + size + i * lh, color, 'left', size)) },
  }
}

/** The point (or the lesson): pattern, meaning, form, then how it works in
 *  a sentence, then the catalogue's rule in whatever room is left. */
function pointSlide(c, s, name, howCaption) {
  const { ctx, p, f, ink, ink2 } = c
  const lang = c.plan.lang
  const pt = s.pt
  let y = title(c, name)
  // The point at work in this sentence comes first: the meaning over it
  // gives way to it, then the form; the catalogue's general rule takes
  // what room is left.
  const ladder = [
    { sizes: [FS.heading, FS.title, FS.lead], form: true },
    { sizes: [FS.title, FS.lead], form: true },
    { sizes: [FS.lead, FS.body], form: true },
    { sizes: [FS.lead, FS.body], form: false },
  ]
  let head, form, formH, room, how
  // Its line read at the lead rung where the head can give way for it,
  // else at the body rung at least.
  settle: for (const least of [FS.lead, FS.body]) {
    for (const step of ladder) {
      head = patternHead(c, s.pattern, tr(pt, lang), step.sizes)
      form = step.form ? formOf(pt, lang) : null
      formH = form ? FS.lead * 2 + SP[7] : 0
      room = f.bottom - y - head.h - SP[7] - formH
      how = howBlock(c, s.how, room)
      if (!how || (how.h <= room && how.size >= least)) break settle
    }
  }
  if (how && how.h > room) how = null
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


// ── Endings: the last slide, in six designs to pick from (plans 200d–200f) ──
// Each closes on the source's own station and what its line teaches, in
// figures the bank counts (index.json), and asks for what the type asks
// (a score after an exam, a save after a list).
/** The mark, the name and the handle, on one line centred on `cx` and
 *  no wider than `maxW`: a long handle steps down, and one too long for
 *  the line goes under it, never cut (plan 200l). Returns its height. */
function brandRow(ctx, p, cx, y, ms, ink, handle, maxW, nameSize = ms * 0.55) {
  const nf = font(700, nameSize, 'latin')
  const nw = measure(ctx, 'Tsuji', nf)
  const room = maxW - ms - SP[5] - nw - SP[7]
  const sizes = [FS.title, FS.lead, FS.body, FS.sm]
  const inline = handle ? fit(ctx, handle, { sizes, maxW: room, maxLines: 1, balanced: false }) : null
  const under = inline?.cut ? fit(ctx, handle, { sizes, maxW, maxLines: 2, balanced: false }) : null
  const hb = under ? null : inline
  const hw = hb ? measure(ctx, hb.lines[0], hb.f) + SP[7] : 0
  let x = cx - (ms + SP[5] + nw + hw) / 2
  mark(ctx, x, y, ms, ink, p.gold)
  x += ms + SP[5]
  text(ctx, 'Tsuji', x, y + ms / 2 + nameSize * 0.36, { f: nf, color: ink })
  if (hb) text(ctx, hb.lines[0], x + nw + SP[7], y + ms / 2 + hb.size * 0.36, { f: hb.f, color: p.gold })
  if (under) return ms + SP[4] + paragraph(ctx, under, cx, y + ms + SP[4], p.gold, 'center')
  return ms
}
const ctaOf = (c, sizes = [FS.title, FS.lead], weight = 500) => (c.cta ? fit(c.ctx, weldIf(c.plan.lang, c.cta), { weight, sizes, maxW: c.f.w, maxLines: 2 }) : null)
const figureOf = (c, sizes = [FS.heading, FS.title, FS.lead]) => (c.plan.figure ? fit(c.ctx, c.plan.figure, { sizes, maxW: c.f.w, maxLines: 3 }) : null)

/** A small icon in a line's ring: save, send, follow. */
function icon(ctx, kind, cx, cy, s, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(3, s * 0.09)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (kind === 'save') {
    ctx.moveTo(cx - s * 0.3, cy - s * 0.45)
    ctx.lineTo(cx + s * 0.3, cy - s * 0.45)
    ctx.lineTo(cx + s * 0.3, cy + s * 0.45)
    ctx.lineTo(cx, cy + s * 0.18)
    ctx.lineTo(cx - s * 0.3, cy + s * 0.45)
    ctx.closePath()
  } else if (kind === 'send') {
    ctx.moveTo(cx - s * 0.45, cy - s * 0.05)
    ctx.lineTo(cx + s * 0.45, cy - s * 0.42)
    ctx.lineTo(cx + s * 0.12, cy + s * 0.45)
    ctx.lineTo(cx - s * 0.06, cy + s * 0.08)
    ctx.closePath()
    ctx.moveTo(cx - s * 0.06, cy + s * 0.08)
    ctx.lineTo(cx + s * 0.45, cy - s * 0.42)
  } else {
    ctx.moveTo(cx - s * 0.38, cy)
    ctx.lineTo(cx + s * 0.38, cy)
    ctx.moveTo(cx, cy - s * 0.38)
    ctx.lineTo(cx, cy + s * 0.38)
  }
  ctx.stroke()
  ctx.restore()
}

/** The handle the studio was given, unless it only names the website
 *  the metal already prints (plan 200f). */
const bare = h => h.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase()
const handleBesides = plan => (plan.handle && bare(plan.handle) !== SITE ? plan.handle : '')

/** Today's stop as a plate the app would print: the line's rail down its
 *  left edge, the code in the line's roundel, the station's name over its
 *  reading, what it does in the slide's language. */
function stopPlate(c, color, maxW) {
  const { ctx, p, ink, ink2 } = c
  const st = c.plan.station
  const rail = EDGE * 2.4
  const pad = SP[6]
  const at = z => {
    const jf = font(900, z, 'serif')
    const kf = font(500, Math.max(FS.xs, z * 0.42), 'jp')
    const lf = font(700, Math.max(FS.body, z * 0.7), 'latin')
    const r = z * 0.62
    const textW = Math.max(measure(ctx, st.jp, jf), measure(ctx, st.kana, kf))
    const w = rail + pad + r * 2 + SP[5] + textW + SP[5] + measure(ctx, st.name, lf) + pad
    return { z, jf, kf, lf, r, w, h: z * 2.3 }
  }
  const L = [FS.title * 1.1, FS.title, FS.lead, FS.body].map(at).find(x => x.w <= maxW) || at(FS.body)
  return {
    w: L.w,
    h: L.h,
    draw(x, y) {
      ctx.save()
      shadow(ctx, p.hang)
      ctx.fillStyle = c.dark ? p.card : p.surface
      rrect(ctx, x, y, L.w, L.h, R.plate)
      ctx.fill()
      ctx.restore()
      ctx.save()
      rrect(ctx, x, y, L.w, L.h, R.plate)
      ctx.clip()
      ctx.fillStyle = color
      ctx.fillRect(x, y, rail, L.h)
      ctx.restore()
      const cy = y + L.h / 2
      let at2 = x + rail + pad
      roundel(ctx, at2 + L.r, cy, L.r, color, st.code, { ink: color, size: L.r * 0.7 })
      at2 += L.r * 2 + SP[5]
      const nameW = Math.max(measure(ctx, st.jp, L.jf), measure(ctx, st.kana, L.kf))
      const kz = Math.max(FS.xs, L.z * 0.42)
      text(ctx, st.kana, at2 + nameW / 2, cy - L.z * 0.42, { f: L.kf, color: ink2, align: 'center' })
      text(ctx, st.jp, at2 + nameW / 2, cy + L.z * 0.56 + kz * 0.2, { f: L.jf, color: ink, align: 'center' })
      at2 += nameW + SP[5]
      text(ctx, st.name, at2, cy + Math.max(FS.body, L.z * 0.7) * 0.36, { f: L.lf, color: ink2 })
    },
  }
}

/** A comment, as the feeds draw the way to one: a speech bubble in the
 *  metal's gold, three dots in it (plan 200l: it replaced a lone arrow
 *  pointing down at nothing). `x` its left edge, `y` its top. */
function commentMark(ctx, p, x, y, s) {
  const w = s
  const h = s * 0.74
  ctx.save()
  ctx.strokeStyle = p.gold
  ctx.fillStyle = p.gold
  ctx.lineWidth = Math.max(4, s * 0.075)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  rrect(ctx, x, y, w, h, h * 0.36)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + w * 0.22, y + h)
  ctx.lineTo(x + w * 0.16, y + h + s * 0.2)
  ctx.lineTo(x + w * 0.42, y + h)
  ctx.stroke()
  for (const k of [0.3, 0.5, 0.7]) {
    ctx.beginPath()
    ctx.arc(x + w * k, y + h / 2, s * 0.055, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  return h + s * 0.2
}

const ENDINGS = {
  /** 路線図: the app's two lines out of 辻, every station on them, the
   *  source's lit and marked "you are here". */
  map(c) {
    const { ctx, p, f, ink, ink2 } = c
    const plan = c.plan
    const t = plan.t
    masthead(ctx, p, f)
    caption(ctx, `${t.end.routeMap} · 路線図`, f.right, f.y + 64 * 0.66, ink2, 'right')
    const figure = figureOf(c, [FS.title, FS.lead, FS.body])
    const cta = ctaOf(c, [FS.lead, FS.body])
    const textH = (figure ? paragraphH(figure) + SP[5] : 0) + (cta ? paragraphH(cta) : 0)
    const head = f.y + 64 + SP[7]
    const mapH = Math.min(f.bottom - textH - SP[8] - head, f.w * 0.9)
    // The map and its words centred in what the masthead leaves.
    const top = head + Math.max(0, (f.bottom - head - mapH - SP[8] - textH) / 2)
    const cy = top + mapH / 2
    const off = mapH * 0.27
    const hubR = 50
    const hubX = f.x + hubR + 4
    const x0 = hubX + hubR + 150
    // The last stop's name (and its reading) kept inside the frame.
    const half = plan.map.reduce((m, L) => {
      const st = L.stops[L.stops.length - 1]
      const nz = st.here ? FS.title * 1.1 : FS.lead * 0.92
      return Math.max(m, measure(ctx, st.jp, font(st.here ? 900 : 700, nz, 'serif')) / 2, measure(ctx, st.kana, font(500, FS.xs, 'jp')) / 2, 28)
    }, 0)
    const x1 = f.right - half - 4
    const track = p.surfaceLine
    ctx.lineCap = 'round'
    plan.map.forEach((L, li) => {
      const ly = li ? cy + off : cy - off
      ctx.strokeStyle = track
      ctx.lineWidth = EDGE * 2.4
      ctx.beginPath()
      ctx.moveTo(hubX, cy)
      ctx.bezierCurveTo(hubX + 70, cy, x0 - 110, ly, x0 - 40, ly)
      ctx.lineTo(x1 + 20, ly)
      ctx.stroke()
      // The line's name on the curve where it leaves the hub, away from the stations.
      const lx = hubX + hubR * 0.4
      text(ctx, L.jp, lx, li ? ly + SP[8] + FS.lead * 0.5 : ly - SP[8] + FS.lead * 0.1, { f: font(700, FS.lead, 'serif'), color: ink2 })
      caption(ctx, t.end.lines[L.key], lx, li ? ly + SP[8] + FS.lead * 0.5 + FS.xs * 1.6 : ly - SP[8] - FS.lead * 0.95, ink2, 'left', FS.xs)
    })
    plan.map.forEach((L, li) => {
      const ly = li ? cy + off : cy - off
      const n = L.stops.length
      const step = (x1 - x0) / Math.max(1, n - 1)
      // Sizes the stops' spacing holds: no name nor reading meets its
      // neighbour's, the station you are at the largest that still clears.
      const nameF = z => font(700, z, 'serif')
      const hereF = z => font(900, z, 'serif')
      const widest = (list, f) => Math.max(0, ...list.map(x => measure(ctx, x, f)))
      const scaled = (z, room, w) => Math.min(z, z * room / Math.max(1, w))
      const kz = Math.max(FS.xs * 0.84, scaled(FS.xs, step - SP[2], widest(L.stops.map(x => x.kana), font(500, FS.xs, 'jp'))))
      const oz = Math.max(FS.sm, scaled(FS.lead * 0.92, step - SP[3], widest(L.stops.map(x => x.jp), nameF(FS.lead * 0.92))))
      const hi = L.stops.findIndex(x => x.here)
      const nextTo = hi < 0 ? 0 : widest([L.stops[hi - 1], L.stops[hi + 1]].filter(Boolean).map(x => x.jp), nameF(oz))
      const hz = hi < 0 ? oz : Math.max(oz, scaled(FS.title * 1.1, 2 * (step - SP[2]) - nextTo, measure(ctx, L.stops[hi].jp, hereF(FS.title * 1.1))))
      L.stops.forEach((st, i) => {
        const x = x0 + i * step
        const col = st.pig ? p.line[st.pig] : ink2
        ctx.beginPath()
        if (st.here) {
          ctx.arc(x, ly, 26, 0, Math.PI * 2)
          ctx.fillStyle = p.bg
          ctx.fill()
          ctx.lineWidth = 9
          ctx.strokeStyle = col
          ctx.stroke()
        } else {
          ctx.arc(x, ly, 13, 0, Math.PI * 2)
          ctx.fillStyle = col
          ctx.fill()
        }
        // Names away from the middle, readings beyond them.
        const nz = st.here ? hz : oz
        const nf = (st.here ? hereF : nameF)(nz)
        const kf = font(500, kz, 'jp')
        const gap = st.here ? 46 : 32
        if (li === 0) {
          text(ctx, st.jp, x, ly - gap, { f: nf, color: st.here ? ink : ink2, align: 'center' })
          text(ctx, st.kana, x, ly - gap - nz * 0.92 - SP[2], { f: kf, color: ink2, align: 'center' })
        } else {
          text(ctx, st.jp, x, ly + gap + nz * 0.82, { f: nf, color: st.here ? ink : ink2, align: 'center' })
          text(ctx, st.kana, x, ly + gap + nz * 0.82 + SP[2] + kz * 1.05, { f: kf, color: ink2, align: 'center' })
        }
        if (st.here) {
          // You are here: a pill in the station's pigment, toward the middle.
          const lf = font(700, FS.body, 'latin')
          const label = t.end.youAreHere
          const w = measure(ctx, label, lf) + SP[5] * 2
          const h = FS.body * 1.8
          const px = Math.min(Math.max(x - w / 2, f.x), f.right - w)
          const py = li ? ly - 40 - h : ly + 40
          ctx.fillStyle = col
          rrect(ctx, px, py, w, h, h / 2)
          ctx.fill()
          text(ctx, label, px + w / 2, py + h / 2 + FS.body * 0.36, { f: lf, color: p.onLine, align: 'center' })
        }
      })
    })
    // 辻, where both lines leave from.
    ctx.beginPath()
    ctx.arc(hubX, cy, hubR, 0, Math.PI * 2)
    ctx.fillStyle = p.bg
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = ink
    ctx.stroke()
    text(ctx, '辻', hubX, cy + FS.heading * 0.36, { f: font(900, FS.heading, 'serif'), color: ink, align: 'center' })
    let y = top + mapH + SP[8]
    if (figure) y += paragraph(ctx, figure, f.x, y, ink) + SP[5]
    if (cta) paragraph(ctx, cta, f.x, y, ink2)
    // The handle top right, on one line in the half the line captions
    // leave it; one too long even small is left off, never cut.
    const hb = plan.handle ? fit(ctx, plan.handle, { sizes: [FS.lead, FS.body, FS.sm, FS.caption], maxW: f.w * 0.5, maxLines: 1, balanced: false }) : null
    if (hb && !hb.cut) text(ctx, hb.lines[0], f.right, f.y + 64 * 0.66 + FS.title * 1.5, { f: hb.f, color: p.gold, align: 'right' })
  },

  /** 定期券: a commuter pass from 辻 to the source's station. */
  pass(c) {
    const { ctx, p, f, ink, ink2 } = c
    const plan = c.plan
    const t = plan.t
    const st = plan.station
    const color = p.line[plan.line] || p.line.reading
    const figure = figureOf(c, [FS.title, FS.lead, FS.body])
    const cta = ctaOf(c, [FS.lead, FS.body])
    const textH = (figure ? paragraphH(figure) + SP[5] : 0) + (cta ? paragraphH(cta) : 0)
    const ch = Math.min(f.w * 0.72, f.h - textH - SP[8] * 2)
    let y = f.y + Math.max(0, (f.h - ch - SP[8] - textH) / 2)
    const x = f.x
    // The card, its line's band across the top.
    ctx.save()
    shadow(ctx, p.hang)
    ctx.fillStyle = c.dark ? p.card : p.surface
    rrect(ctx, x, y, f.w, ch, R.identity)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = p.surfaceLine
    ctx.lineWidth = 2
    rrect(ctx, x + 1, y + 1, f.w - 2, ch - 2, R.identity)
    ctx.stroke()
    const band = ch * 0.2
    ctx.save()
    rrect(ctx, x, y, f.w, ch, R.identity)
    ctx.clip()
    ctx.fillStyle = color
    ctx.fillRect(x, y, f.w, band)
    ctx.restore()
    const pad = SP[7]
    const tw = text(ctx, '定期券', x + pad, y + band / 2 + FS.title * 0.36, { f: font(900, FS.title, 'serif'), color: p.onLine })
    caption(ctx, t.end.pass, x + pad + tw + SP[5], y + band / 2 + FS.caption * 0.36, p.onLine)
    mark(ctx, x + f.w - pad - band * 0.62, y + band * 0.19, band * 0.62, p.onLine, p.onLine)
    // 辻 ⇄ the station: each name with its reading over it.
    const ry = y + band + (ch - band) * 0.12
    const nz = Math.min(FS.display * 1.15, (ch - band) * 0.3)
    const nf = font(900, nz, 'serif')
    const kf = font(500, FS.sm, 'jp')
    const from = { jp: '辻', kana: 'つじ' }
    const arrowW = nz * 0.9
    const fw = measure(ctx, from.jp, nf)
    const tw2 = measure(ctx, st.jp, nf)
    const total = fw + arrowW + tw2 + SP[6] * 2
    let rx = x + (f.w - total) / 2
    const base = ry + FS.sm * 1.5 + nz * ASC
    text(ctx, from.kana, rx + fw / 2, ry + FS.sm, { f: kf, color: ink2, align: 'center' })
    text(ctx, from.jp, rx, base, { f: nf, color: ink })
    rx += fw + SP[6]
    // ⇄ drawn as two chevrons.
    const ay = base - nz * 0.38
    ctx.strokeStyle = color
    ctx.lineWidth = EDGE * 1.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(rx, ay - nz * 0.12); ctx.lineTo(rx + arrowW, ay - nz * 0.12)
    ctx.moveTo(rx + arrowW - nz * 0.14, ay - nz * 0.26); ctx.lineTo(rx + arrowW, ay - nz * 0.12)
    ctx.moveTo(rx, ay + nz * 0.12); ctx.lineTo(rx + arrowW, ay + nz * 0.12)
    ctx.moveTo(rx + nz * 0.14, ay + nz * 0.26); ctx.lineTo(rx, ay + nz * 0.12)
    ctx.stroke()
    rx += arrowW + SP[6]
    text(ctx, st.kana, rx + tw2 / 2, ry + FS.sm, { f: kf, color: ink2, align: 'center' })
    text(ctx, st.jp, rx, base, { f: nf, color: ink })
    // The fields: valid, line, holder.
    const fy = base + nz * 0.25 + SP[7]
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(x + pad, fy - SP[4], f.w - pad * 2, 2)
    const fields = [
      [t.end.valid, plan.source === 'kana' ? 'あ → ン' : 'N5 → N1'],
      [t.end.line, `${st.line.jp} ${t.end.lines[st.line.key]}`],
      [t.end.holder, plan.handle || t.end.you],
    ]
    const share = [0.26, 0.4, 0.34]
    let fx = x + pad
    fields.forEach(([label, value], i) => {
      const colW = (f.w - pad * 2) * share[i]
      caption(ctx, label, fx, fy + FS.caption, ink2, 'left', FS.xs)
      // On one line where it fits (a handle is never cut), else on two.
      const one = fit(ctx, value, { sizes: [FS.lead, FS.body], maxW: colW - SP[4], maxLines: 1, balanced: false })
      const vb = one.cut ? fit(ctx, value, { sizes: [FS.lead, FS.body], maxW: colW - SP[4], maxLines: 2, balanced: false }) : one
      paragraph(ctx, vb, fx, fy + FS.caption + SP[4], ink)
      fx += colW
    })
    y += ch + SP[8]
    if (figure) y += paragraph(ctx, figure, f.x, y, ink) + SP[5]
    if (cta) paragraph(ctx, cta, f.x, y, ink2)
  },

  /** 辻: the mark, large, and what its name means; today's stop on its
   *  plate, the post's ask, and the metal to the website (plan 200f),
   *  the handle under it when the studio was given one. */
  mark(c) {
    const { ctx, p, f, ink, ink2 } = c
    const plan = c.plan
    const t = plan.t
    const color = p.line[plan.line] || p.line.reading
    const tag = fit(ctx, weldIf(plan.lang, t.outro), { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w * 0.86, maxLines: 2 })
    const ask = c.cta ? fit(ctx, weldIf(plan.lang, c.cta), { sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxLines: 2 }) : null
    const plate = stopPlate(c, color, f.w)
    const nameH = FS.display * 0.72
    const capH = FS.caption * 0.74
    const handle = handleBesides(plan)
    const handleH = handle ? SP[5] + FS.lead * 1.1 : 0
    // What gives way when the room is short, before the mark goes small:
    // the space between the groups, then the plate's caption, then the
    // line under the name.
    const ladder = [
      { gap: SP[8], tag: true, today: true },
      { gap: SP[7], tag: true, today: true },
      { gap: SP[7], tag: true, today: false },
      { gap: SP[7], tag: false, today: false },
      { gap: SP[6], tag: false, today: false },
    ]
    const restOf = L => SP[7] + nameH + (L.tag ? SP[6] + paragraphH(tag) : 0) + L.gap
      + (L.today ? capH + SP[4] : 0) + plate.h + L.gap + (ask ? paragraphH(ask) + SP[6] : 0) + METAL_H + handleH
    const most = Math.min(f.w * 0.4, f.h * 0.27)
    const L = ladder.find(x => f.h - restOf(x) >= Math.min(most, f.h * 0.2)) || ladder[ladder.length - 1]
    const rest = restOf(L)
    const size = Math.max(f.h * 0.12, Math.min(most, f.h - rest))
    let y = f.y + Math.max(0, (f.h - size - rest) / 2)
    mark(ctx, f.cx - size / 2, y, size, ink, p.gold)
    y += size + SP[7]
    text(ctx, 'Tsuji', f.cx, y + nameH, { f: font(700, FS.display, 'latin'), color: ink, align: 'center' })
    y += nameH
    if (L.tag) y += SP[6] + paragraph(ctx, tag, f.cx, y + SP[6], ink2, 'center')
    y += L.gap
    if (L.today) {
      caption(ctx, t.end.today, f.cx, y + capH, color, 'center')
      y += capH + SP[4]
    }
    plate.draw(f.cx - plate.w / 2, y)
    y += plate.h + L.gap
    if (ask) y += paragraph(ctx, ask, f.cx, y, ink, 'center') + SP[6]
    metal(ctx, p, f.cx, y, weldIf(plan.lang, t.end.start(SITE)), f.w)
    if (handle) {
      const hb = fit(ctx, handle, { sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxLines: 1, balanced: false })
      text(ctx, hb.lines[0], f.cx, y + METAL_H + SP[5] + FS.lead * 0.8, { f: hb.f, color: ink2, align: 'center' })
    }
  },

  /** What to do with the post, large, and the three ways to do it. */
  cta(c) {
    const { ctx, p, f, ink, ink2 } = c
    const plan = c.plan
    const t = plan.t
    const color = p.line[plan.line] || p.line.reading
    masthead(ctx, p, f)
    let y = f.y + 64 + SP[8]
    const head = c.cta ? fit(ctx, weldIf(plan.lang, c.cta), { sizes: [FS.display, FS.heading, FS.title], maxW: f.w, maxLines: 3, lh: 1.08 }) : null
    if (head) y += paragraph(ctx, head, f.x, y, ink, 'left', 1.08) + SP[8]
    const rows = [['save', t.end.save], ['send', t.end.send], ['follow', t.end.follow(plan.handle)]]
    const figure = figureOf(c, [FS.lead, FS.body])
    const rowH = Math.min(FS.title * 2.6, (f.bottom - y - (figure ? paragraphH(figure) + SP[7] : 0)) / rows.length)
    const r = rowH * 0.34
    const labelW = f.w - r * 2 - SP[6]
    const fitAt = ([size, maxLines]) => rows.map(([, label]) => fit(ctx, weldIf(plan.lang, label), { sizes: [size], maxW: labelW, maxLines, maxH: rowH * 0.94, balanced: false }))
    // Every row on one line if a size holds them so, else on two.
    const tries = [[FS.title, 1], [FS.lead, 1], [FS.body, 1], [FS.title, 2], [FS.lead, 2], [FS.body, 2]]
    const labels = tries.map(fitAt).find(ls => ls.every(l => !l.cut && paragraphH(l) <= rowH * 0.94)) || fitAt([FS.body, 2])
    for (const [i, [kind]] of rows.entries()) {
      const cy = y + rowH / 2
      ctx.beginPath()
      ctx.arc(f.x + r, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = RING
      ctx.stroke()
      icon(ctx, kind, f.x + r, cy, r * 1.05, color)
      const lb = labels[i]
      paragraph(ctx, lb, f.x + r * 2 + SP[6], cy - paragraphH(lb) / 2, ink)
      y += rowH
    }
    if (figure) paragraph(ctx, figure, f.x, y + SP[7], ink2)
  },

  /** 終点: the train's own last word, on a panel, then the post's. */
  terminus(c) {
    const { ctx, p, f, ink, ink2 } = c
    const plan = c.plan
    const t = plan.t
    const st = plan.station
    const color = p.line[plan.line] || p.line.reading
    const cta = ctaOf(c, [FS.lead, FS.body])
    const ms = 92
    const below = (cta ? paragraphH(cta) + SP[7] : 0) + ms
    // The panel as tall as what it holds, the big 終点 giving way first.
    const pad = SP[7]
    const iw = f.w - pad * 2
    const jp = fit(ctx, '終点です。ご乗車ありがとうございました。', { weight: 500, fam: 'jp', sizes: [FS.title, FS.lead, FS.body], maxW: iw, maxLines: 2, balanced: false })
    const thanks = fit(ctx, weldIf(plan.lang, t.end.thanks(st.jp)), { weight: 500, sizes: [FS.lead, FS.body], maxW: iw, maxLines: 2, balanced: false })
    const rest = pad * 2 + FS.caption + SP[7] + SP[5] + paragraphH(jp) + SP[3] + paragraphH(thanks) + SP[6] + EDGE
    const room = f.h - below - SP[8]
    // The big 終点 takes what the words leave; where too little, it gives
    // way (the line under it says 終点 too).
    const fitBig = Math.min(FS.word, (room - rest) / 1.08 - SP[5])
    const big = fitBig >= FS.heading ? fitBig : 0
    const ph = Math.min(room, rest + (big ? big * 1.08 : -SP[5]))
    let y = f.y + Math.max(0, (f.h - ph - SP[8] - below) / 2)
    ctx.save()
    shadow(ctx, p.board)
    ctx.fillStyle = p.panel
    rrect(ctx, f.x, y, f.w, ph, R.panel)
    ctx.fill()
    ctx.restore()
    const ix = f.x + pad
    let iy = y + pad
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(ix + 10, iy + FS.caption * 0.62, 10, 0, Math.PI * 2)
    ctx.fill()
    caption(ctx, `${t.end.terminus} · ${st.jp}`, ix + 32, iy + FS.caption, p.onPanelSoft)
    iy += FS.caption + SP[7]
    if (big) {
      text(ctx, '終点', ix, iy + big * ASC, { f: font(900, big, 'serif'), color: p.onPanel })
      iy += big * 1.08 + SP[5]
    }
    iy += paragraph(ctx, jp, ix, iy, p.onPanel) + SP[3]
    iy += paragraph(ctx, thanks, ix, iy, p.onPanelSoft) + SP[6]
    ctx.fillStyle = color
    ctx.fillRect(ix, iy, SP[9], EDGE)
    y += ph + SP[8]
    if (cta) y += paragraph(ctx, cta, f.cx, y, ink2, 'center') + SP[7]
    brandRow(ctx, p, f.cx, y, ms, ink, plan.handle, f.w)
  },

  /** 駅名標: the source's own station plate, what its line teaches, and the mark. */
  plate(c) {
    const { ctx, p, f, ink, ink2 } = c
    const plan = c.plan
    const color = p.line[plan.line] || p.line.reading
    const figure = plan.figure ? fit(ctx, plan.figure, { sizes: [FS.heading, FS.title, FS.lead], maxW: f.w, maxLines: 3 }) : null
    const cta = c.cta ? fit(ctx, weldIf(plan.lang, c.cta), { weight: 500, sizes: [FS.title, FS.lead], maxW: f.w, maxLines: 2 }) : null
    const ms = 112
    const rest = SP[8] + (figure ? paragraphH(figure) + SP[6] : 0) + (cta ? paragraphH(cta) + SP[8] : 0) + ms
    // The plate takes what the words under it leave.
    const plateH = Math.max(f.h * 0.26, Math.min(f.h * 0.42, 500, f.h - rest))
    const total = plateH + rest
    let y = f.y + Math.max(0, (f.h - total) / 2)
    stationPlate(ctx, p, f.x, y, f.w, plateH, plan.station, color)
    y += plateH + SP[8]
    if (figure) y += paragraph(ctx, figure, f.cx, y, ink, 'center') + SP[6]
    if (cta) y += paragraph(ctx, cta, f.cx, y, ink2, 'center') + SP[8]
    // The mark, the name and the handle, on one line.
    brandRow(ctx, p, f.cx, y, ms, ink, plan.handle, f.w, FS.display * 0.62)
  },

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
    const section = KIND_JP[q.kind]?.[N3 ? 1 : 0]
    if (section) text(ctx, section, f.x + hw + SP[4] + 64 + SP[5], y + hs * 0.46 + FS.lead * 0.36, { f: font(500, FS.lead, 'jp'), color: ink2 })
    if (/^N\d$/.test(c.plan.level)) caption(ctx, c.plan.level, f.right, y + hs * 0.62, ink2, 'right')
    y += hs * 1.15 + SP[5]
  } else {
    y = title(c, head)
  }
  const n = q.choices.length
  // The answers: two by two for four, else one under the other (or side by
  // side when each is short): a lattice whose columns divide its content.
  const short = q.choices.every(x => (x.text || '').length <= 8 && !x.rows)
  // Four answers two by two, unless one is a sentence long.
  // Two columns only where every answer keeps to two lines at a readable size.
  const halfW = (f.w - 9) / 2 - SP[5] - 60 - SP[4] * 2
  // A Latin answer is never broken inside a word (insuffisan-ce): each of
  // its words fits the width whole, or the answers go one under the other.
  const wordsFit = (x, z, w) => (x.fam && x.fam !== 'latin') || !x.text || x.text.split(/\s+/).every(word => measure(ctx, word, font(700, z, 'latin')) <= w)
  const narrow = q.choices.some(x => x.rows ? x.rows.length > 6 : fit(ctx, x.text, { weight: 700, fam: x.fam || 'latin', sizes: [FS.lead], maxW: halfW, maxLines: 2, balanced: false }).cut || !wordsFit(x, FS.lead, halfW))
  const long = q.choices.some(x => (x.text || '').length > 34) || narrow
  const cols = n === 4 && !long ? 2 : short ? n : 1
  const rowsN = Math.ceil(n / cols)
  // Long answers on a row each take the room a large question would: the
  // question steps down a rung for them.
  const roomy = !(cols === 1 && q.choices.some(x => !x.rows && fit(ctx, x.text, { weight: 700, fam: x.fam || 'latin', sizes: [FS.body], maxW: f.w - SP[5] - 60 - SP[4] * 2, maxLines: 1, balanced: false }).cut))
  if (q.askJp) {
    const a = fit(ctx, q.askJp, { weight: 500, fam: 'jp', sizes: [FS.lead, FS.body], maxW: f.w, maxLines: 1, balanced: false })
    y += paragraph(ctx, a, f.x, y, ink)
  }
  if (q.ask && q.ask !== head) {
    const ask = fit(ctx, q.ask, { weight: q.askJp ? 500 : 700, sizes: q.askJp ? [FS.body, FS.sm] : roomy ? [FS.title, FS.lead, FS.body] : [FS.lead, FS.body], maxW: f.w, maxLines: 3, balanced: false })
    y += paragraph(ctx, ask, f.x, y, q.askJp ? ink2 : ink) + SP[7]
  }

  // The foot: the call to answer, or the answer explained.
  // The call to answer on one line where it can be, else on two.
  const ctaText = weldIf(lang, t.examCta(n))
  const ctaOne = revealed ? null : fit(ctx, ctaText, { sizes: [FS.title, FS.lead, FS.body], maxW: f.w, maxLines: 1 })
  const cta = revealed ? null : ctaOne.cut ? fit(ctx, ctaText, { sizes: [FS.title, FS.lead], maxW: f.w, maxLines: 2 }) : ctaOne
  const ex = q.explain || {}
  // The explanation keeps clear of the seal, and to a fifth of the slide.
  const exHead = revealed && ex.head ? fit(ctx, ex.head, { fam: 'serif', sizes: [FS.display * 0.7, FS.heading, FS.title, FS.lead], maxW: f.w - 170, maxLines: 1 }) : null
  let exSense = revealed && ex.sense ? fit(ctx, ex.sense, { sizes: [FS.title, FS.lead, FS.body], maxW: f.w - 170, maxLines: 2 }) : null
  let exWhy = revealed && ex.why ? fit(ctx, ex.why, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w - 170, maxH: f.h * 0.2, maxLines: 4, lh: 1.25, balanced: false }) : null
  const footOf = () => (cta ? paragraphH(cta)
    : Math.max(150, (exHead ? paragraphH(exHead) + SP[3] : 0) + (exSense ? paragraphH(exSense) : 0) + (exWhy ? paragraphH(exWhy, 1.25) + SP[3] : 0)))
  let foot = footOf()

  // The stem: on the answer, a dialogue's cue gives way to the task alone.
  // On the answer, the stem shown as it is answered (表記's word in kanji,
  // ★'s pieces in place), and a dialogue's cue gives way to the task alone.
  const st = revealed && q.stem?.after ? q.stem.after : q.stem?.cue && revealed ? { task: q.stem.task } : q.stem
  // The stem keeps room for a line of its own; the lattice takes the rest.
  // Where the answer's why would crowd it out, the why gives way: the
  // stem and the circled answer are the slide.
  // A quoted translation keeps the room it takes at the body rung: it is
  // the question, and is never cut (plan 200l).
  const quoteMin = st?.text ? paragraphH(fit(ctx, `“${st.text}”`, { sizes: [FS.sm], maxW: f.w, lh: 1.15 }), 1.15) : 0
  const stemMin = st ? (st.cue ? FS.display * 2.4 : st.rows ? FS.display * 1.5 : Math.max(FS.display, quoteMin)) : 0
  if (exWhy && f.bottom - y - SP[7] * 2 - foot - stemMin < rowsN * FS.body * 1.6) { exWhy = null; foot = footOf() }
  // Answers that are sentences take a taller row each.
  // Answers are measured in the script they are drawn in: kana runs
  // longer than kanji, and a row sized for one spills in the other.
  const answerScript = c.plan.script === 'kana' ? 'kana' : 'kanji'
  const answerLines = answerScript === 'kana' ? 4 : 3
  const oneLine = x => !x.rows || (layoutSentence(ctx, x.rows, { max: FS.title, min: FS.title, maxW: f.w - 140, maxLines: 1, script: answerScript, rules: false, gap: 0.04, fam: 'jp', weight: 500 })?.lines.length ?? 2) <= 1
  // A written answer's row holds it at a size on as many lines as it
  // takes there, three at most: the answers are what the slide asks to
  // read, so their room is kept before the sentence over them takes its own.
  const textW0 = (f.w - 3 * (cols + 1)) / cols - SP[5] - 60 - SP[4] * 2
  const texts = q.choices.filter(x => !x.rows)
  // A written answer keeps to three lines, a whole sentence's to `q.lines`
  // (a trap's readings, plan 200n).
  const maxAnswer = q.lines || 3
  const rowOf = (x, z) => z * (1.1 + (Math.min(maxAnswer, fit(ctx, x.text, { weight: x.fam === 'jp' ? 500 : 700, fam: x.fam || 'latin', sizes: [z], maxW: textW0, maxLines: 9, balanced: false }).lines.length) - 1) * 1.18) + SP[3] * 2
  const textRow = z => Math.max(0, ...texts.map(x => rowOf(x, z)))
  // One under the other, each written answer's row is as tall as it needs;
  // side by side, as tall as the tallest.
  const varRows = cols === 1 && texts.length === n
  const textGrid = z => Math.max(rowsN * FS.sm * 1.45, varRows ? texts.reduce((a, x) => a + rowOf(x, z), 0) : rowsN * textRow(z))
  // A sentence answer's row is as tall as its longest answer at the body
  // rung, on up to three lines: a long N1 sentence no longer spills.
  const sentRow = () => Math.max(FS.title * 2.4, ...q.choices.filter(x => x.rows).map(x => layoutSentence(ctx, x.rows, { max: FS.body, min: FS.body, maxW: f.w - 140 - SP[5], maxLines: answerLines, script: answerScript, rules: false, gap: 0.04, fam: 'jp', weight: 500 }).h + SP[3] * 2))
  const perRow = cols === 1 && q.choices.some(x => x.rows) ? (q.choices.every(oneLine) ? FS.title * 1.55 : sentRow()) : Math.max(FS.body * 1.6, textRow(FS.body))
  const sentences = cols === 1 && q.choices.some(x => x.rows)
  // As tall as its answers at the lead rung where the room allows.
  const gridPref = sentences ? rowsN * perRow : Math.max(rowsN * FS.body * 1.6, textGrid(FS.lead))
  let gridMin = sentences ? rowsN * perRow : Math.max(rowsN * FS.body * 1.6, textGrid(FS.body))
  // A sentence stem is measured first, in the room the lattice's least
  // leaves it; the lattice then takes what the sentence does not.
  let stemTr = st?.rows && st.tr ? fit(ctx, st.tr, { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w, maxLines: 2, balanced: false }) : null
  let trH = stemTr ? paragraphH(stemTr) + SP[3] : 0
  const stemAt = least => layoutSentence(ctx, st.rows, { max: FS.display * 1.1, min: least, maxW: f.w, maxLines: 4, maxH: f.bottom - y - SP[7] * 2 - foot - gridMin - trH, rules: !!(st.under || st.underLit), gap: 0.08, script: c.plan.script === 'kana' ? 'kana' : c.plan.script })
  let L = st?.rows ? stemAt(FS.lead) : null
  // A dialogue's cue and task, at the largest setting that leaves the
  // lattice its least; the cue's translation gives way last.
  const bw = f.w * 0.86
  const cueAt = ([max, trSize, taskSize], withTr) => {
    const iw = bw - SP[6] * 2
    const task = fit(ctx, st.task, { weight: 700, sizes: [taskSize], maxW: f.w, maxLines: 3, balanced: false })
    const ctr = withTr ? fit(ctx, st.cue.tr, { weight: 500, sizes: [trSize], maxW: iw, maxLines: 2, balanced: false }) : null
    const CL = layoutSentence(ctx, st.cue.rows, { max, min: Math.min(max, FS.body), maxW: iw, maxLines: 2, script: c.plan.script, rules: false, gap: 0.04 })
    const bh = FS.caption * 1.6 + CL.h + (ctr ? SP[2] + paragraphH(ctr) : 0) + SP[5] * 2
    return { task, ctr, L: CL, bh, h: bh + SP[4] + paragraphH(task) }
  }
  let cue = null
  if (st?.cue) {
    const compact = rowsN * (perRow > FS.title * 2 ? FS.title * 2.1 : FS.lead * 1.4)
    const max = f.bottom - y - SP[7] * 2 - foot - compact
    for (const withTr of [true, false]) {
      for (const step of [[FS.heading, FS.body, FS.title], [FS.title, FS.body, FS.lead], [FS.lead, FS.sm, FS.body], [FS.body, FS.sm, FS.sm]]) {
        cue = cueAt(step, withTr)
        if (cue.h <= max) break
      }
      if (cue.h <= max) break
    }
    // No bubble fits: the task alone, which says the situation too.
    if (cue.h > max) {
      const task = fit(ctx, st.task, { weight: 700, sizes: [FS.title, FS.lead, FS.body, FS.sm], maxW: f.w, maxLines: 5, maxH: Math.max(FS.sm * 1.2, max), balanced: false })
      cue = { task, alone: true, h: paragraphH(task) }
    }
  }
  // What the stem takes: a sentence as laid out, else its least.
  const stemH = () => (st?.rows ? L.h + trH : stemMin)
  const tooLong = () => stemH() > f.bottom - y - SP[7] * 2 - foot - gridMin
  if (!st?.cue && tooLong()) {
    // A sentence too long for the room the lattice leaves: the answer's why,
    // then its gloss, then the sentence's translation give way; on the
    // answer, whose answers were read on the slide before, they sit closer;
    // then the sentence steps down, and only then the answers.
    exWhy = null
    foot = footOf()
    if (tooLong() && exSense) { exSense = null; foot = footOf() }
    if (tooLong() && stemTr) { stemTr = null; trH = 0; L = stemAt(FS.lead) }
    if (tooLong() && revealed && texts.length) { gridMin = textGrid(FS.sm); if (st?.rows) L = stemAt(FS.lead) }
    if (tooLong() && st?.rows) L = stemAt(FS.body)
    if (tooLong() && st?.rows) L = stemAt(FS.sm)
  }
  const gridLeast = !st?.cue && tooLong() ? Math.max(rowsN * FS.sm * 1.45, f.bottom - y - SP[7] * 2 - foot - stemH()) : gridMin
  const need = st?.rows ? L.h + trH : st?.cue ? cue.h : stemMin
  const gridH = !st ? Math.min(f.bottom - y - SP[7] - foot, rowsN * 230)
    : st.cue ? Math.max(rowsN * (perRow > FS.title * 2 ? FS.title * 2.1 : FS.lead * 1.4), Math.min(gridMin, f.bottom - y - SP[7] * 2 - foot - need))
      : Math.max(gridLeast, Math.min(Math.max(f.w * 0.3, (f.bottom - y) * 0.36, gridPref), rowsN * 230, f.bottom - y - SP[7] * 2 - foot - need))
  const room = st ? f.bottom - y - SP[7] - gridH - SP[7] - foot : -SP[7]
  if (st?.rows) {
    const top = y + Math.max(0, (room - L.h - trH) / 2)
    drawSentence(ctx, L, f.x, top, 'left', u => ({
      ink, ruby: ink2,
      rule: (st.under && u.i === st.target) || (st.underLit && u.row.lit) ? (revealed ? p.line.exam : ink) : null,
      ruleW: revealed ? EDGE : 4,
    }))
    if (stemTr) paragraph(ctx, stemTr, f.x, top + L.h + SP[3], ink2)
  } else if (st?.specimen) {
    const z = Math.min([...st.specimen].length === 1 ? FS.glyph : FS.word, room * 0.9)
    const head = headLines(ctx, st.specimen, { maxW: f.w, maxSize: Math.max(z, FS.lead), minSize: FS.lead, maxLines: 2, maxH: room })
    drawHead(ctx, head, f.cx, y + Math.max(0, (room - headH(head)) / 2), ink, 'center')
  } else if (st?.emoji) {
    picture(ctx, st.emoji, f.cx, y + room / 2, Math.min(FS.glyph * 1.2, room * 0.8))
  } else if (st?.text) {
    const b = fit(ctx, `“${st.text}”`, { sizes: [FS.display, FS.heading, FS.title, FS.lead, FS.body, FS.sm], maxW: f.w, maxH: room + 1, lh: 1.15 })
    paragraph(ctx, b, f.x, y + Math.max(0, (room - paragraphH(b, 1.15)) / 2), ink, 'left', 1.15)
  } else if (st?.cue && cue.alone) {
    paragraph(ctx, cue.task, f.x, y + Math.max(0, (room - cue.h) / 2), p.line.grammar)
  } else if (st?.cue) {
    // What the other person said, and what the reader has to say.
    const { task, ctr, L: CL, bh } = cue
    let by = y + Math.max(0, (room - cue.h) / 2)
    ctx.fillStyle = c.dark ? p.card : p.surface
    rrect(ctx, f.x, by, bw, bh, R.panel)
    ctx.fill()
    if (!c.dark) { ctx.strokeStyle = p.surfaceLine; ctx.lineWidth = 2; rrect(ctx, f.x + 1, by + 1, bw - 2, bh - 2, R.panel); ctx.stroke() }
    caption(ctx, st.them || '', f.x + SP[6], by + SP[5] + FS.caption, ink2, 'left', FS.xs)
    drawSentence(ctx, CL, f.x + SP[6], by + SP[5] + FS.caption * 1.6, 'left', () => ({ ink, rule: null, ruby: ink2 }))
    if (ctr) paragraph(ctx, ctr, f.x + SP[6], by + SP[5] + FS.caption * 1.6 + CL.h + SP[2], ink2)
    by += bh + SP[4]
    paragraph(ctx, task, f.x, by, p.line.grammar)
  } else if (st?.task) {
    const task = fit(ctx, st.task, { weight: 700, sizes: [FS.title, FS.lead], maxW: f.w, maxLines: 2, balanced: false })
    paragraph(ctx, task, f.x, y + Math.max(0, (room - paragraphH(task)) / 2), p.line.grammar)
  }
  y += room + SP[7]

  const HL = 3
  const cw = (f.w - HL * (cols + 1)) / cols
  const chh = (gridH - HL * (rowsN + 1)) / rowsN
  // Rows one under the other share the lattice as their answers need it.
  // Sentence answers one under the other share it by their lines too.
  const sentLines = x => layoutSentence(ctx, x.rows, { max: FS.body, min: FS.body, maxW: f.w - 174, maxLines: answerLines + 1, script: answerScript, rules: false, gap: 0.04, fam: 'jp', weight: 500 })?.lines.length || 1
  const sentWeights = cols === 1 && q.choices.every(x => x.rows) && !q.choices.every(oneLine)
  const weights = varRows ? q.choices.map(x => rowOf(x, FS.body)) : sentWeights ? q.choices.map(x => sentLines(x) + 0.8) : null
  const total = weights ? weights.reduce((a, b) => a + b, 0) : 0
  const chOf = i => (weights ? (gridH - HL * (rowsN + 1)) * weights[i] / total : chh)
  const cyOf = i => (weights ? y + HL + q.choices.slice(0, i).reduce((a, _, j) => a + chOf(j) + HL, 0) : y + HL + Math.floor(i / cols) * (chh + HL))
  ctx.fillStyle = p.surfaceLine
  ctx.fillRect(f.x, y, f.w, gridH)
  // Every answer in one size: the largest at which all of them fit.
  const textW = cw - SP[5] - 60 - SP[4] - SP[4]
  const sizes = [FS.display * 0.62, FS.title, FS.lead, FS.body, FS.sm]
  const fitsAt = (ch, z, lines, i) => ch.rows || (wordsFit(ch, z, textW) && !fit(ctx, ch.text, { weight: ch.fam === 'jp' ? 500 : 700, fam: ch.fam || 'latin', sizes: [z], maxW: textW, maxH: chOf(i) - SP[3], maxLines: lines, balanced: false }).cut)
  // The largest size at which every answer keeps to one line, else two, else three.
  const sizeFor = (lines, least) => sizes.filter(z => z >= least).find(z => q.choices.every((ch, i) => fitsAt(ch, z, lines, i)))
  // A Japanese answer is one word or one phrase: on one line a rung
  // smaller rather than broken between its kana.
  const jpAnswers = q.choices.some(ch => !ch.rows && ch.fam === 'jp')
  const common = sizeFor(1, FS.title) || (jpAnswers ? sizeFor(1, FS.sm) : null) || sizeFor(2, FS.lead) || sizeFor(3, 0) || sizeFor(maxAnswer, 0) || FS.sm
  q.choices.forEach((choice, i) => {
    const cx = f.x + HL + (i % cols) * (cw + HL)
    const cy = cyOf(i)
    const chh = chOf(i)
    ctx.fillStyle = c.dark ? p.card : p.surface
    ctx.fillRect(cx, cy, cw, chh)
    const right = i === q.right
    const dim = revealed && !right
    const r = 30
    roundel(ctx, cx + SP[5] + r, cy + chh / 2, r, dim ? p.surfaceLine : p.line.exam, String(i + 1), { ink: dim ? ink2 : p.line.exam, size: FS.lead })
    const tx = cx + SP[5] + r * 2 + SP[4]
    const tw = cx + cw - SP[4] - tx
    if (choice.rows) {
      // No furigana in an answer: its ruby would crowd the row it sits in.
      const answerAt = (min, lines, pad) => layoutSentence(ctx, choice.rows, { max: FS.title, min, maxW: tw, maxLines: lines, maxH: chh - pad, script: answerScript, rules: false, gap: 0.04, fam: 'jp', weight: 500 })
      // A slide full of long answers (an N1 sentence in kana) sets the
      // one that would spill a rung smaller, rather than over its row.
      let L = answerAt(FS.caption, answerLines, SP[4])
      if (L.h > chh - SP[2]) L = answerAt(FS.xs, answerLines + 1, SP[2])
      drawSentence(ctx, L, tx, cy + (chh - L.h) / 2, 'left', () => ({ ink: dim ? ink2 : ink, rule: null, ruby: ink2 }))
    } else {
      const fam = choice.fam || 'latin'
      const b = fit(ctx, choice.text, { weight: fam === 'jp' ? 500 : 700, fam, sizes: [common], maxW: tw, maxH: chh - SP[3], maxLines: maxAnswer, balanced: false })
      paragraph(ctx, b, tx, cy + chh / 2 - paragraphH(b) / 2, dim ? ink2 : ink)
    }
    if (revealed && right) marked(ctx, p, cx + SP[5] + r, cy + chh / 2, r)
  })
  y += gridH + SP[7]
  if (cta) { paragraph(ctx, cta, f.x, y, ink); return }
  let ey = y
  if (exHead) ey += paragraph(ctx, exHead, f.x, ey, ink) + SP[3]
  if (exSense) ey += paragraph(ctx, exSense, f.x, ey, ink2)
  if (exWhy) paragraph(ctx, exWhy, f.x, ey + SP[3], ink2, 'left', 1.25)
  stamp(ctx, p, f.right - 66, y + Math.min(foot, 150) / 2 + 10, 62)
}

// ── Hooks: the first slide of a post ──────────────────────────
/** The thing the post opens on, measured, then drawn in a box. */
function hookContent(c, plan, maxW, maxH, fam, align, hook = plan.hook) {
  const { ctx, p, ink, ink2 } = c
  const h = hook
  if (h.kind === 'pair') {
    // 乗換: the two heads, “or” between them; one under the other when long.
    const orF = font(700, FS.title, 'latin')
    const orW = measure(ctx, ` ${h.or} `, orF)
    let size = FS.word
    const width = z => h.heads.reduce((a, x) => a + measure(ctx, x, font(700, z, fam)), 0) + orW * (h.heads.length - 1)
    while (size > FS.display && width(size) > maxW) size -= 4
    const inline = width(size) <= maxW
    // One under the other, each as large as the narrowest lets the rest be.
    const stacked = inline ? null : (() => {
      for (let z = FS.display * 1.2; z >= FS.title; z -= 4) {
        const heads = h.heads.map(x => headLines(ctx, x, { fam, maxW, maxSize: z, minSize: z, maxLines: 2 }))
        const H2 = heads.reduce((a, x) => a + headH(x), 0) + (heads.length - 1) * FS.title * 1.6
        if (heads.every(x => x.lines.length <= 2) && H2 <= maxH) return { heads, H: H2 }
      }
      const heads = h.heads.map(x => headLines(ctx, x, { fam, maxW, maxSize: FS.title, minSize: FS.title, maxLines: 3 }))
      return { heads, H: heads.reduce((a, x) => a + headH(x), 0) + (heads.length - 1) * FS.title * 1.6 }
    })()
    const H = inline ? size * 1.2 : stacked.H
    return {
      h: Math.min(H, maxH),
      draw(x, y) {
        const hf = font(700, size, fam)
        if (inline) {
          let at = x - width(size) / 2
          h.heads.forEach((head, i) => {
            if (i) { text(ctx, ` ${h.or} `, at, y + size * 0.62, { f: orF, color: ink2 }); at += orW }
            const w = text(ctx, head, at, y + size * ASC, { f: hf, color: ink })
            ctx.fillStyle = p.line[h.line] || p.line.grammar
            ctx.fillRect(at, y + size * 1.08, w, EDGE)
            at += w
          })
          return
        }
        let at = y
        stacked.heads.forEach((head, i) => {
          if (i) { text(ctx, h.or, x, at + FS.title * 0.9, { f: orF, color: ink2, align: 'center' }); at += FS.title * 1.6 }
          drawHead(ctx, head, x, at, ink, 'center')
          at += headH(head)
        })
      },
    }
  }
  if (h.kind === 'emojigrid') {
    // 単語帳: the theme's pictures, its word for itself, what the post is.
    const n = h.emoji.length
    const tb = fit(ctx, h.title, { sizes: [FS.heading, FS.title], maxW, maxLines: 2 })
    const hs = FS.display
    const fixed = hs * 1.1 + EDGE + SP[5] + paragraphH(tb) + SP[6]
    // As many columns as make the pictures largest: 8 sit four by two.
    const cellOf = k => Math.min(maxW / k, (maxH - fixed) / Math.ceil(n / k), FS.glyph * 1.1)
    const cols = [2, 3, 4].filter(k => k <= n).reduce((a, k) => (cellOf(k) > cellOf(a) ? k : a), Math.min(2, n))
    const rows = Math.ceil(n / cols)
    const cell = Math.max(FS.display, cellOf(cols))
    const gap = SP[3]
    return {
      h: cell * rows + fixed,
      draw(x, y) {
        h.emoji.forEach((e, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          // A last row short of the others is centred under them.
          const inRow = Math.min(cols, n - row * cols)
          const cx = x + (col - (inRow - 1) / 2) * cell
          const top = y + row * cell
          pictureCard(c, cx - cell / 2 + gap / 2, top + gap / 2, cell - gap, cell - gap)
          picture(ctx, e, cx, top + cell / 2, (cell - gap) * 0.62)
        })
        let at = y + cell * rows + SP[6]
        const hf = font(700, hs, fam)
        const w = text(ctx, h.head, x, at + hs * ASC, { f: hf, color: ink, align: 'center' })
        at += hs * 1.1
        ctx.fillStyle = p.line.vocab
        ctx.fillRect(x - Math.min(w, SP[9] * 2) / 2, at, Math.min(w, SP[9] * 2), EDGE)
        paragraph(ctx, tb, x, at + EDGE + SP[5], ink, 'center')
      },
    }
  }
  if (h.kind === 'kanjirow') {
    // 似た字: the set side by side, as large as the width lets them be.
    const n = h.chars.length
    const tb = fit(ctx, h.title, { sizes: [FS.heading, FS.title], maxW, maxLines: 3 })
    const gap = SP[5]
    const size = Math.max(FS.display, Math.min(FS.glyph, (maxW - gap * (n - 1)) / n, maxH - paragraphH(tb) - SP[8] - EDGE - SP[4]))
    return {
      h: size * 1.02 + SP[4] + EDGE + SP[8] + paragraphH(tb),
      draw(x, y) {
        const total = n * size + (n - 1) * gap
        h.chars.forEach((ch, i) => {
          const at = x - total / 2 + i * (size + gap)
          text(ctx, ch, at + size / 2, y + size * ASC, { f: font(700, size, 'serif'), color: ink, align: 'center' })
          ctx.fillStyle = p.line.kanji
          ctx.fillRect(at + size * 0.2, y + size * 1.02 + SP[4], size * 0.6, EDGE)
        })
        paragraph(ctx, tb, x, y + size * 1.02 + SP[4] + EDGE + SP[8], ink, 'center')
      },
    }
  }
  if (h.kind === 'place') {
    // 会話: where it happens, on a station plate, and what the post is.
    const pf = font(700, FS.display, 'serif')
    const pw = Math.min(maxW, measure(ctx, h.place, pf) + SP[8] * 2)
    const ph = FS.display * 1.6
    const tb = fit(ctx, h.title, { sizes: [FS.heading, FS.title], maxW, maxLines: 2 })
    return {
      h: ph + SP[8] + paragraphH(tb),
      draw(x, y) {
        const bx = x - pw / 2
        ctx.fillStyle = c.dark ? p.card : p.surface
        rrect(ctx, bx, y, pw, ph, R.plate)
        ctx.fill()
        ctx.strokeStyle = p.surfaceLine
        ctx.lineWidth = 2
        rrect(ctx, bx + 1, y + 1, pw - 2, ph - 2, R.plate)
        ctx.stroke()
        ctx.fillStyle = p.line[h.line] || p.line.grammar
        ctx.fillRect(bx, y + ph - EDGE * 1.4, pw, EDGE * 1.4)
        text(ctx, h.place, x, y + ph / 2 + FS.display * 0.36, { f: pf, color: ink, align: 'center' })
        paragraph(ctx, tb, x, y + ph + SP[8], ink, 'center')
      },
    }
  }
  if (h.kind === 'listhead') {
    // 一覧: what the list is about, large, and its title.
    const tb = fit(ctx, h.title, { sizes: [FS.display, FS.heading, FS.title], maxW, maxLines: 2 })
    const max = Math.min([...h.head].length <= 2 ? FS.glyph : FS.word, (maxH - paragraphH(tb) - SP[8] - EDGE) / 1.1)
    const head = headLines(ctx, h.head, { fam, maxW, maxSize: Math.max(max, FS.title), minSize: FS.title, maxLines: 2, maxH: maxH - paragraphH(tb) - SP[8] - EDGE })
    const hh = headH(head)
    return {
      h: hh + EDGE + SP[8] + paragraphH(tb),
      draw(x, y) {
        drawHead(ctx, head, x, y, ink, align)
        const w = Math.min(SP[9] * 2, Math.max(...head.lines.map(l => measure(ctx, l, head.f))))
        ctx.fillStyle = p.line[h.line] || p.line.vocab
        ctx.fillRect(align === 'center' ? x - w / 2 : x, y + hh, w, EDGE)
        paragraph(ctx, tb, x, y + hh + EDGE + SP[8], ink, align)
      },
    }
  }
  if (h.kind === 'sentence') {
    const L = layoutSentence(ctx, h.rows, { max: FS.word * 0.8, min: FS.title, maxW, maxH, script: plan.script, romaji: plan.showRomaji, fam, weight: 700, rules: c.rules !== false, gap: c.rules === false ? 0.08 : 0.3 })
    return { h: L.h, draw: (x, y) => drawSentence(ctx, L, x, y, align, u => ({ ink, rule: c.rules === false ? null : lineOf(p, u.row), romaji: ink2, ruby: ink2 })) }
  }
  if (h.kind === 'pattern') {
    const head = headLines(ctx, h.pattern, { fam, maxW, maxSize: FS.word * 0.85, minSize: FS.heading, maxLines: 3, maxH: maxH * 0.55 })
    const hh = headH(head)
    const L = h.rows.length ? layoutSentence(ctx, h.rows, { max: FS.display * 0.8, min: FS.lead, maxW, maxLines: 2, maxH: maxH - hh - EDGE - SP[8], script: plan.script, gap: 0.06 }) : null
    const H = hh + EDGE + SP[3] + (L ? SP[8] + L.h : 0)
    return {
      h: H,
      draw(x, y) {
        drawHead(ctx, head, x, y, ink, align)
        const w = Math.max(...head.lines.map(l => measure(ctx, l, head.f)))
        ctx.fillStyle = p.line.grammar
        ctx.fillRect(align === 'center' ? x - w / 2 : x, y + hh + SP[1], w, EDGE)
        if (L) drawSentence(ctx, L, x, y + hh + EDGE + SP[3] + SP[8], align, u => ({ ink: u.row.lit ? ink : ink2, rule: u.row.lit ? p.line.grammar : null, ruby: ink2 }))
      },
    }
  }
  if (h.kind === 'specimen') {
    const one = [...h.text].length === 1
    let size = Math.min(h.small ? FS.display * 1.2 : one ? FS.glyph * 1.25 : FS.word, maxH * 0.9)
    while (size > FS.title && measure(ctx, h.text, font(700, size, fam)) > maxW) size -= 4
    const b = h.small ? fit(ctx, h.text, { fam, sizes: [FS.display * 1.2, FS.display, FS.heading, FS.title], maxW, maxLines: 3 }) : null
    if (b) return { h: paragraphH(b), draw: (x, y) => paragraph(ctx, b, x, y, ink, align) }
    const head = headLines(ctx, h.text, { fam, maxW, maxSize: size, minSize: FS.heading, maxLines: 2, maxH: maxH * 0.9 })
    return { h: headH(head) + size * 0.02, draw: (x, y) => drawHead(ctx, head, x, y, ink, align) }
  }
  if (h.kind === 'prompt') {
    // What to say, in the reader's language (plan 200k: the shuffled tiles under it are gone).
    const b = fit(ctx, `“${h.text}”`, { sizes: [FS.display, FS.heading, FS.title], maxW, maxH, lh: 1.15 })
    return { h: paragraphH(b, 1.15), draw: (x, y) => paragraph(ctx, b, x, y, ink, align, 1.15) }
  }
  return { h: 0, draw() {} }
}

/** The level, in a ring of the source's line: N5, or あ / ア for a kana. */
function levelRing(ctx, p, plan, cx, cy, r, ink) {
  const label = plan.level === 'hiragana' ? 'あ' : plan.level === 'katakana' ? 'ア' : plan.level
  roundel(ctx, cx, cy, r, p.line[plan.line] || p.line.reading, label, { ink, size: FS.lead, fam: /^N/.test(label) ? 'latin' : 'jp' })
}
const promptOf = plan => (typeof plan.prompt === 'string' ? plan.prompt : plan.prompt.plates)

/** The first slide: the mark, the level, what the post opens on, the
 *  prompt, and the metal that says swipe. */
function opening(ctx, p, fr, plan, hook = plan.hook, prompt = promptOf(plan)) {
  ground(ctx, p, fr)
  masthead(ctx, p, fr)
  levelRing(ctx, p, plan, fr.right - 46, fr.y + 32, 46, p.ink)
  const c = { ctx, p, f: fr, ink: p.ink, ink2: p.ink2, dark: !p.paper }
  const pill = 44 * 2.7
  const top = fr.y + 64 + SP[8]
  const room = fr.bottom - pill - SP[8] - top
  let pb = fit(ctx, weldIf(plan.lang, prompt), { sizes: [FS.title, FS.lead], maxW: fr.w * 0.9, maxLines: 2 })
  let content = hookContent(c, plan, fr.w, room - paragraphH(pb) - SP[8], 'serif', 'center', hook)
  // Where the post's opening needs the room, the prompt gives way: the
  // metal under it already says swipe.
  if (content.h + SP[8] + paragraphH(pb) > room) {
    pb = null
    content = hookContent(c, plan, fr.w, room, 'serif', 'center', hook)
  }
  const total = content.h + (pb ? SP[8] + paragraphH(pb) : 0)
  let y = top + Math.max(0, (room - total) / 2)
  content.draw(fr.cx, y)
  y += content.h + SP[8]
  if (pb) paragraph(ctx, pb, fr.cx, y, p.ink2, 'center')
  metal(ctx, p, fr.cx, fr.bottom - pill, plan.t.next)
}

// ── How did you do? (plan 200l) ───────────────────────────────
/** A self-check a reader answers with a number in the comments: how much
 *  help they needed to read the sentence, from none to not yet. Four
 *  plates, one numbered choice each; never the app's own rating bar,
 *  whose verdicts belong to a review, not to a feed. */
function ratingSlide(ctx, p, fr, plan) {
  ground(ctx, p, fr)
  const t = plan.t
  const lang = plan.lang
  const head = fit(ctx, weldIf(lang, t.rate), { sizes: [FS.display, FS.heading, FS.title], maxW: fr.w, maxLines: 2 })
  const cta = fit(ctx, weldIf(lang, t.rateCta), { weight: 500, sizes: [FS.title, FS.lead], maxW: fr.w, maxLines: 2 })
  const n = t.selfCheck.length
  const gap = SP[3]
  const bubble = FS.display * 0.7
  const rest = paragraphH(head) + SP[7] + SP[7] + paragraphH(cta)
  // The plates take what the words leave, a readable row each.
  const rowH = Math.min(FS.title * 2.9, (fr.h - rest - bubble - SP[6] - gap * (n - 1)) / n)
  const total = rest + rowH * n + gap * (n - 1) + (rowH >= FS.title * 2.4 ? SP[6] + bubble : 0)
  let y = fr.y + Math.max(0, (fr.h - total) / 2)
  y += paragraph(ctx, head, fr.x, y, p.ink, 'left') + SP[7]
  const r = Math.min(34, rowH * 0.3)
  const labels = t.selfCheck.map(label => weldIf(lang, label))
  const lx = fr.x + SP[5] + r * 2 + SP[5]
  const jpF = font(500, FS.caption, 'jp')
  const jpW = Math.max(...SELF_CHECK_JP.map(x => measure(ctx, x, jpF)))
  // Every label in one size, the largest at which each keeps to a line.
  const labelW = fr.right - SP[5] - jpW - SP[5] - lx
  const size = [FS.title, FS.lead, FS.body].find(z => labels.every(l => !fit(ctx, l, { sizes: [z], maxW: labelW, maxLines: 1 }).cut)) || FS.body
  labels.forEach((label, i) => {
    const ry = y + i * (rowH + gap)
    const mid = ry + rowH / 2
    ctx.fillStyle = p.surface
    rrect(ctx, fr.x, ry, fr.w, rowH, R.plate)
    ctx.fill()
    ctx.strokeStyle = p.surfaceLine
    ctx.lineWidth = 2
    rrect(ctx, fr.x + 1, ry + 1, fr.w - 2, rowH - 2, R.plate)
    ctx.stroke()
    roundel(ctx, fr.x + SP[5] + r, mid, r, p.gold, String(i + 1), { ink: p.gold, size: r * 0.95 })
    const lb = fit(ctx, label, { sizes: [size], maxW: labelW, maxLines: 1 })
    text(ctx, lb.lines[0], lx, mid + lb.size * 0.36, { f: lb.f, color: p.ink })
    text(ctx, SELF_CHECK_JP[i], fr.right - SP[5], mid + FS.caption * 0.36, { f: jpF, color: p.ink2, align: 'right' })
  })
  y += rowH * n + gap * (n - 1) + SP[7]
  y += paragraph(ctx, cta, fr.x, y, p.ink2, 'left') + SP[6]
  if (fr.bottom - y >= bubble * 0.95) commentMark(ctx, p, fr.x, y, bubble)
}
// ── The directions and their decks ────────────────────────────
// The endings the studio offers, in the order it shows them.
export const ENDING_IDS = ['mark', 'map', 'pass', 'cta', 'terminus', 'plate']
/** One ending of a plan, for the studio's row of endings to pick from. */
export function endingSlide(id, type, plan, fmt, opts) {
  const fr = frame(fmt)
  const p = palette(opts.ground)
  const cta = { plates: plan.cta || plan.t.cta.plates, exam: plan.t.cta.exam(3), compare: plan.t.cta.compare, build: plan.t.cta.build, list: plan.t.cta.list, talk: plan.t.cta.talk, impostor: plan.t.cta.impostor }[type]
  return { key: `ending-${id}`, draw: ctx => { noShadow(ctx); KINDS.outro({ ctx, p, plan, ...surface(ctx, p, fr), cta, ending: id }) } }
}

// ── The carousel types and their decks ────────────────────────
export const TYPES = [
  { id: 'plates', jp: '駅名標' },
  { id: 'exam', jp: '模試' },
  { id: 'compare', jp: '乗換' },
  { id: 'build', jp: '組立' },
  { id: 'list', jp: '一覧' },
  { id: 'talk', jp: '会話' },
  { id: 'spelling', jp: '表記' },
  { id: 'impostor', jp: '仲間外れ' },
]
// What a type may leave out, and whether it is in by default.
export const TYPE_OPTIONS = {
  exam: [['cover', true], ['sheet', true]],
  list: [['recap', true]],
  spelling: [['sheet', true]],
}
/** Whether a plan can be drawn as a type: a question to ask, two things
 *  to tell apart, a sentence to build, a list, a scene. */
export function available(type, pl) {
  switch (type) {
    case 'exam': return pl.quizzes.length > 0
    case 'compare': return !!pl.compare
    case 'build': return !!pl.build
    case 'list': return !!pl.list
    case 'talk': return !!pl.talk
    case 'spelling': return !!pl.spelling?.length
    case 'impostor': return !!pl.impostor
    default: return true
  }
}

/** A passage's sentences, laid out and cut into pages that fit `f`. */
function passagePages(plan, s, fmt, f) {
  if (typeof document === 'undefined') return [s.sents]
  const ctx = document.createElement('canvas').getContext('2d')
  const top = FS.heading * 1.1 + SP[6]
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

/** The slides a type deals for a plan: [{ key, draw(ctx) }].
 *  `opts.picks` the questions picked for the item (else the first few),
 *  `opts.types[type]` the type's own options. */
export function deck(type, plan, fmt, opts) {
  const fr = frame(fmt)
  const p = palette(opts.ground)
  const t = plan.t
  const o = Object.fromEntries((TYPE_OPTIONS[type] || []).map(([k, d]) => [k, opts.types?.[type]?.[k] ?? d]))
  const per = fmt.id === 'story' ? 6 : 5
  const out = []
  // A key names the slide's file in the export: a second of a kind is numbered.
  const add = (key, fn) => {
    const n = out.filter(x => x.key === key || x.key.startsWith(`${key}~`)).length
    out.push({ key: n ? `${key}~${n + 1}` : key, fn })
  }
  const ctxOf = (ctx, f = fr) => ({ ctx, p, plan, ...surface(ctx, p, f) })
  const kind = (s, extra = {}) => ctx => KINDS[s.kind](ctxOf(ctx), { ...s, ...extra })
  // A spelling quiz is set as the paper sets its 表記 questions.
  const exam = type === 'exam' || type === 'spelling'
  let asked = 0
  const ask = (q, titles) => {
    if (!q) return
    asked += 1
    const n = asked
    add(`question-${n}`, ctx => quizSlide(ctxOf(ctx), q, false, exam ? 'exam' : titles[0], n))
    add(`answer-${n}`, ctx => quizSlide(ctxOf(ctx), q, true, exam ? 'exam' : titles[1], n))
  }
  const outro = cta => { if (plan.slides.some(s => s.kind === 'outro')) add('outro', ctx => KINDS.outro({ ...ctxOf(ctx, fr), cta, ending: opts.ending })) }
  const wordsPages = s => {
    const ps = pages(s.items, per)
    ps.forEach((list, i) => add(`words-${i + 1}`, ctx => wordsSlide('plates', ctx, p, fr, plan, s, list, i + 1, ps.length)))
  }
  const passage = s => {
    const ps = passagePages(plan, s, fmt, fr)
    ps.forEach((layouts, i) => add(`passage-${i + 1}`, kind(s, { layouts, page: i + 1, count: ps.length })))
  }
  // A mock exam's answers never give away a later question's (plan 200l).
  const qs = withoutGiveaways(picked(plan, opts.picks, exam ? 3 : 1))
  const numbered = list => (n, i) => (list.length > 1 ? `${n} ${i}` : n)

  switch (type) {
    case 'exam': {
      if (o.cover) add('cover', ctx => KINDS.cover(ctxOf(ctx, fr), { quizzes: qs }))
      if (plan.source === 'passage') plan.slides.filter(s => s.kind === 'passage').forEach(passage)
      qs.forEach(q => ask(q))
      if (o.sheet && qs.length) add('sheet', ctx => KINDS.sheet(ctxOf(ctx), { quizzes: qs }))
      outro(t.cta.exam(qs.length))
      break
    }
    case 'spelling': {
      // 表記 (plan 200l): the word and its kin heard in kana, each asked
      // how it is written, then the sheet.
      const sp = plan.spelling
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'listhead', head: '表記', title: t.spellingTitle(sp.length), line: 'vocab' }, t.spellingAsk))
      sp.forEach(q => ask(q))
      if (o.sheet && sp.length > 1) add('sheet', ctx => KINDS.sheet(ctxOf(ctx), { quizzes: sp }))
      outro(t.cta.exam(sp.length))
      break
    }
    case 'compare': {
      const cmp = plan.compare
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'pair', heads: cmp.sides.map(x => x.head), or: t.or, line: cmp.sides[0].line }, t.compareAsk))
      add('sides', kind({ kind: 'sides', sides: cmp.sides }))
      cmp.sides.forEach((x, i) => { if (x.ex) add(`with-${i + 1}`, kind({ kind: 'item', item: { kind: 'sentence', n: i + 1, rows: x.ex.rows, tr: x.ex.tr }, of: 0, title: t.withIt(x.head), line: x.line })) })
      if (cmp.diff || cmp.careful) add('difference', kind({ kind: 'difference', sides: cmp.sides, diff: cmp.diff, careful: cmp.careful }))
      ask(cmp.quiz, [t.quiz, t.answer])
      outro(t.cta.compare)
      break
    }
    case 'build': {
      const b = plan.build
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'prompt', text: b.translation }, t.buildAsk))
      b.steps.forEach((_, i) => add(`step-${i + 1}`, kind({ kind: 'step', build: b, n: i + 1 })))
      add('built', kind({ kind: 'answer', rows: b.rows, romaji: b.romaji, translation: b.translation, title: t.built }))
      outro(t.cta.build)
      break
    }
    case 'list': {
      const L = plan.list
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'listhead', head: L.head, title: L.title, line: L.line }, t.listAsk))
      L.items.forEach(it => add(`item-${it.n}`, kind({ kind: 'item', item: it, of: L.items.length, title: L.title, line: L.line })))
      if (o.recap) {
        if (L.items[0].kind === 'word') {
          wordsPages({ kind: 'words', title: t.recap, items: L.items.map(it => ({ n: it.n, t: it.head, reading: it.reading, ro: it.ro, main: it.main, sub: it.tag, line: L.line === 'kana' ? 'vocab' : L.line, kanji: /[㐀-鿿々]/.test(it.head), pos: it.tag })) })
        } else {
          add('recap', kind({ kind: 'examples', items: L.items.slice(0, 4), title: t.recap, line: L.line }))
        }
      }
      outro(t.cta.list)
      break
    }
    case 'talk': {
      const T = plan.talk
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'place', place: T.place, title: t.talkHook(T.place), line: plan.line }, t.talkAsk))
      T.lines.forEach((l, i) => add(`line-${i + 1}`, kind({ kind: 'line', line: l, prev: T.lines[i - 1], n: i + 1, of: T.lines.length, place: T.place, them: T.them })))
      ask(T.quiz, [t.sceneAsk, t.sceneAsk])
      outro(t.cta.talk)
      break
    }
    case 'impostor': {
      // 仲間外れ (plan 200m): rounds of six words, one not of the theme,
      // each asked, then answered.
      const I = plan.impostor
      const ask = t.modes.impostorAsk(I.name)
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'listhead', head: '仲間外れ', title: ask, line: 'vocab' }, t.modes.impostor))
      I.rounds.forEach((round, i) => [false, true].forEach(revealed => add(revealed ? `answer-${i + 1}` : `round-${i + 1}`, kind({ kind: 'oddone', round, revealed, n: i + 1, of: I.rounds.length, ask }))))
      outro(t.cta.impostor)
      break
    }
    default: {
      add('hook', ctx => opening(ctx, p, fr, plan))
      for (const s of plan.slides) {
        if (s.kind === 'outro') continue
        if (s.kind === 'rating') { add('rating', ctx => ratingSlide(ctx, p, fr, plan)); continue }
        if (s.kind === 'words') { wordsPages(s); continue }
        if (s.kind === 'passage') { passage(s); continue }
        if (s.kind === 'check') { qs.forEach((q, i) => ask(q, [numbered(qs)(t.question, i + 1), numbered(qs)(t.answer, i + 1)])); continue }
        if (s.kind === 'quiz') {
          const q = s.quiz
          add(s.revealed ? 'scene-answer' : 'scene-question', ctx => quizSlide(ctxOf(ctx), q, s.revealed, s.title, 1))
          continue
        }
        add(s.kind, kind(s))
      }
      outro(plan.cta || t.cta.plates)
    }
  }
  return out.map(sl => ({
    key: sl.key,
    draw: ctx => {
      noShadow(ctx)
      sl.fn(ctx)
    },
  }))
}
