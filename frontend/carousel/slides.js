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
// Every slide is written once and set on the station plates' ground; a
// route strip along the foot counts the stops, and the last slide is the
// source's own station plate (駅名標) with what its line teaches.
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
import { picked } from './sources.js'
import { seeded, shuffle } from './common.js'

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

// ── The station's own plate, and the strip that counts the stops ──
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

/** The stops of the post along its foot: passed, here, still to come. */
const STRIP = SP[7] + 18
function routeStrip(ctx, p, fr, at, total, color) {
  if (total < 2) return
  const y = fr.bottom - 14
  const x0 = fr.x + 16
  const x1 = fr.right - 16
  const xs = i => x0 + (x1 - x0) * (i / (total - 1))
  ctx.fillStyle = alpha(color, 0.3)
  ctx.fillRect(x0, y - EDGE / 2, x1 - x0, EDGE)
  ctx.fillStyle = color
  ctx.fillRect(x0, y - EDGE / 2, xs(at) - x0, EDGE)
  for (let i = 0; i < total; i++) {
    ctx.beginPath()
    if (i === at) {
      ctx.arc(xs(i), y, 15, 0, Math.PI * 2)
      ctx.fillStyle = p.bg
      ctx.fill()
      ctx.lineWidth = 6
      ctx.strokeStyle = color
      ctx.stroke()
    } else {
      ctx.arc(xs(i), y, 8, 0, Math.PI * 2)
      ctx.fillStyle = i < at ? color : p.bg
      ctx.fill()
      if (i > at) { ctx.lineWidth = 3; ctx.strokeStyle = alpha(color, 0.55); ctx.stroke() }
    }
  }
}

// A question's section as the paper names it: kana up to N4, kanji from N3.
const KIND_JP = {
  reading: ['かんじよみ', '漢字読み'], orthography: ['ひょうき', '表記'], meaning: ['いみ', '意味'], grammar: ['ぶんぽう', '文法'],
  translation: ['ほんやく', '翻訳'], say: ['ほんやく', '翻訳'], assembly: ['ぶんの くみたて', '文の組み立て'], scene: ['かいわ', '会話'],
  tour: ['ぶんぽう', '文法'], pointMeaning: ['いみ', '意味'], compare: ['いみ', '意味'], kanji: ['よみかた', '読み方'],
  kanjiMeaning: ['いみ', '意味'], kanjiReverse: ['かんじ', '漢字'], strokes: ['かくすう', '画数'], inWord: ['よみかた', '読み方'],
  kana: ['よみかた', '読み方'], kanaReverse: ['かな', 'かな'], twin: ['かな', 'かな'], passage: ['どっかい', '読解'], passageReading: ['よみかた', '読み方'],
}
const hasKanjiText = str => /[㐀-鿿々]/.test(str || '')

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
    let y = title(c, s.title || c.plan.t.terminus)
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

  /** 終点: the source's own station plate, what its line teaches, and the mark. */
  outro(c) {
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
    const nf = font(700, FS.display * 0.62, 'latin')
    const hf = font(700, FS.title, 'latin')
    const handle = plan.handle
    const nw = measure(ctx, 'Tsuji', nf)
    const hw = handle ? measure(ctx, handle, hf) + SP[7] : 0
    let x = f.cx - (ms + SP[5] + nw + hw) / 2
    mark(ctx, x, y, ms, ink, p.gold)
    x += ms + SP[5]
    text(ctx, 'Tsuji', x, y + ms / 2 + FS.display * 0.62 * 0.36, { f: nf, color: ink })
    if (handle) text(ctx, handle, x + nw + SP[7], y + ms / 2 + FS.title * 0.36, { f: hf, color: p.gold })
  },

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
    const tf = font(900, FS.display, 'serif')
    text(ctx, '模擬試験', ix, y + FS.display * ASC, { f: tf, color: ink })
    y += FS.display * 1.08 + SP[3]
    ctx.fillStyle = p.line.exam
    ctx.fillRect(ix, y, iw, EDGE)
    y += EDGE + SP[4]
    // The sections: もんだい1 かんじよみ — Reading.
    const nameH = FS.caption + SP[5] + 4
    const rowH = Math.min(FS.lead * 1.7, (top + boxH - SP[7] - nameH - SP[4] - y) / Math.max(1, s.quizzes.length))
    s.quizzes.forEach((q, n) => {
      const ry = y + n * rowH
      const lf = font(700, Math.min(FS.lead, rowH * 0.6), 'jp')
      const w = text(ctx, `${kanaOnly ? 'もんだい' : '問題'}${n + 1}`, ix, ry + rowH * 0.62, { f: lf, color: ink })
      const jp = KIND_JP[q.kind]?.[kanaOnly ? 0 : 1] || ''
      const w2 = jp ? SP[5] + text(ctx, jp, ix + w + SP[5], ry + rowH * 0.62, { f: font(500, Math.min(FS.lead, rowH * 0.6), 'jp'), color: ink }) : 0
      const lb = fit(ctx, q.label || '', { weight: 500, sizes: [Math.min(FS.body, rowH * 0.5), FS.sm, FS.caption], maxW: iw - w - w2 - SP[7], maxLines: 1, balanced: false })
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
      const label = fit(ctx, q.label || '', { weight: 500, sizes: [FS.body, FS.sm, FS.caption], maxW: f.w * 0.36, maxLines: 2, balanced: false })
      paragraph(ctx, label, f.x + SP[5] + bw + SP[5], mid - paragraphH(label) / 2, ink2)
      // ① ② ③ ④, the right one filled in.
      const k = q.choices.length
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
    // Each plate as tall as what it holds, the largest setting the row.
    const need = x => {
      const iw = cw - SP[6] * 2
      let size = across ? Math.min(FS.glyph, cw * 0.62, room * 0.3) : Math.min(FS.word * 0.7, room * 0.34)
      while (size > FS.title && measure(ctx, x.head, font(700, size, 'serif')) > iw) size -= 4
      const m = x.meaning ? paragraphH(fit(ctx, x.meaning, { sizes: [FS.heading, FS.title, FS.lead], maxW: iw, maxLines: 4, lh: 1.15 }), 1.15) + SP[3] : 0
      const fm = x.form ? FS.body * 2.4 : 0
      const sub = x.sub ? FS.title * 1.2 + SP[3] : 0
      const words = (x.words || []).length * (FS.title * 1.15 + FS.sm * 1.4 + SP[3])
      return SP[6] * 2 + size * 1.08 + SP[4] + sub + m + fm + words + EDGE * 1.4
    }
    const ch = Math.min(room, Math.max(...sides.map(need)))
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
      let size = across ? Math.min(FS.glyph, cw * 0.62, room * 0.3) : Math.min(FS.word * 0.7, room * 0.34)
      while (size > FS.title && measure(ctx, x.head, font(700, size, 'serif')) > iw) size -= 4
      text(ctx, x.head, across ? bx + cw / 2 : bx + pad, iy + size * ASC, { f: font(700, size, 'serif'), color: ink, align: across ? 'center' : 'left' })
      iy += size * 1.08 + SP[4]
      const ax = across ? bx + cw / 2 : bx + pad
      const align = across ? 'center' : 'left'
      if (x.sub) {
        text(ctx, x.sub, ax, iy + FS.title * 0.85, { f: font(700, FS.title, 'latin'), color, align })
        iy += FS.title * 1.2 + SP[3]
      }
      const left = by + ch - EDGE * 1.4 - SP[4] - iy
      if (x.meaning) {
        const m = fit(ctx, x.meaning, { sizes: [FS.heading, FS.title, FS.lead, FS.body], maxW: iw, maxH: left * (x.form ? 0.7 : 1), lh: 1.15 })
        iy += paragraph(ctx, m, ax, iy, ink, align, 1.15) + SP[3]
      }
      if (x.form) {
        const fb = fit(ctx, x.form, { weight: 500, sizes: [FS.body, FS.sm], maxW: iw, maxLines: 2, balanced: false })
        iy += paragraph(ctx, fb, ax, iy, ink2, align) + SP[3]
      }
      for (const w of x.words || []) {
        if (iy + FS.body * 2.6 > by + ch - EDGE * 1.4) break
        text(ctx, w.t, ax, iy + FS.title * 0.9, { f: font(700, FS.title, 'jp'), color: ink, align })
        iy += FS.title * 1.15
        const wb = fit(ctx, `${w.r} · ${w.main}`, { weight: 500, sizes: [FS.sm, FS.caption], maxW: iw, maxLines: 1, balanced: false })
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
    drawChunk(ctx, p, L, f.x, y, ink, ink2)
    y += L.h + SP[8]
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
    const how = st.line ? fit(ctx, st.line, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w, maxLines: 4, balanced: false }) : null
    // The whole sentence sets the size, so it grows the same on every step.
    const whole = layoutSentence(ctx, b.rows, { max: FS.display, min: FS.lead, maxW: f.w, maxLines: 3, maxH: Math.max(FS.display * 1.4, f.h * 0.3), script: c.plan.script, gap: 0.1 })
    const rows = b.rows.slice(0, st.upto)
    const L = layoutSentence(ctx, rows, { max: whole.size, min: whole.size, maxW: f.w, maxLines: 3, script: c.plan.script, gap: 0.1 })
    drawSentence(ctx, L, f.x, y, 'left', u => ({ ink: u.i >= st.from ? ink : ink2, rule: u.i >= st.from ? lineOf(p, u.row) : null, ruby: ink2 }))
    y += L.h + SP[8]
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(f.x, y - SP[5], f.w, 2)
    drawChunk(ctx, p, pieces, f.x, y + SP[3], ink, ink2)
    y += pieces.h + SP[6] + SP[3]
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
      const note = it.note ? fit(ctx, it.note, { weight: 700, sizes: [FS.body, FS.sm], maxW: f.w, maxLines: 2 }) : null
      const L = layoutSentence(ctx, it.rows, { max: FS.display * 1.1, min: FS.lead, maxW: f.w - SP[7], maxLines: 4, maxH: f.bottom - y - paragraphH(trB) - SP[6] - (note ? paragraphH(note) + SP[6] : 0) - SP[8], script: c.plan.script, gap: 0.08 })
      const h = L.h + SP[5] + paragraphH(trB)
      y += Math.max(0, (f.bottom - y - h - (note ? paragraphH(note) + SP[6] : 0)) * 0.42)
      if (note) { caption(ctx, note.lines[0], f.x, y + FS.caption, color); y += FS.caption + SP[6] }
      ctx.fillStyle = color
      rrect(ctx, f.x, y, EDGE, h, EDGE / 2)
      ctx.fill()
      drawSentence(ctx, L, f.x + SP[7], y, 'left', u => ({ ink, rule: u.row.lit ? color : null, ruby: ink2 }))
      paragraph(ctx, trB, f.x + SP[7], y + L.h + SP[5], ink2)
      return
    }
    // A word: its number on the line, the word with its reading, its sense.
    const row = { t: it.head, fu: it.fu || (hasKanjiText(it.head) ? [[it.head, it.reading]] : null), k: 'word', ro: it.ro }
    const main = fit(ctx, it.main || '', { sizes: [FS.display, FS.heading, FS.title], maxW: f.w, maxLines: 2 })
    const room = f.bottom - y - paragraphH(main) - FS.lead * 1.6 - SP[8] * 2
    const L = layoutSentence(ctx, [row], { max: FS.glyph, min: FS.display, maxW: f.w, maxLines: 1, maxH: room, script: 'furigana', rules: false })
    const total = L.h + FS.lead * 1.6 + SP[8] + paragraphH(main)
    y += Math.max(0, (f.bottom - y - total) / 2)
    drawSentence(ctx, L, f.cx, y, 'center', () => ({ ink, rule: null, ruby: ink2 }))
    y += L.h
    text(ctx, it.ro || '', f.cx, y + FS.lead * 1.1, { f: font(500, FS.lead, 'latin'), color: ink2, align: 'center' })
    y += FS.lead * 1.6 + SP[8]
    ctx.fillStyle = color
    ctx.fillRect(f.cx - SP[9] / 2, y - SP[6], SP[9], EDGE)
    paragraph(ctx, main, f.cx, y, ink, 'center')
    if (it.tag) caption(ctx, it.tag, f.cx, y0 + FS.caption, ink2, 'center')
  },

  /** 会話: one line of the scene, the line before it small above. */
  line(c, s) {
    const { ctx, p, f, ink, ink2 } = c
    const t = c.plan.t
    let y = title(c, s.place, f.y, `${s.n}/${s.of}`)
    const bubble = (l, maxH, big) => {
      const mine = l.who === 'me'
      const bw = f.w * (big ? 0.92 : 0.8)
      const trB = fit(ctx, l.tr, { weight: 500, sizes: big ? [FS.title, FS.lead, FS.body] : [FS.body, FS.sm], maxW: bw - SP[6] * 2, maxLines: big ? 3 : 2, balanced: false })
      const L = layoutSentence(ctx, l.rows, { max: big ? FS.display : FS.title, min: big ? FS.lead : FS.body, maxW: bw - SP[6] * 2, maxLines: big ? 4 : 2, maxH: maxH - paragraphH(trB) - SP[6] * 2 - FS.caption * 1.8, script: c.plan.script, rules: false, gap: 0.05 })
      const h = FS.caption * 1.8 + L.h + SP[4] + paragraphH(trB) + SP[6] * 2
      return { mine, bw, trB, L, h, who: mine ? t.you : s.them }
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
      caption(ctx, B.who, bx + SP[6], by + SP[6] + FS.caption, bInk2, 'left', FS.xs)
      drawSentence(ctx, B.L, bx + SP[6], by + SP[6] + FS.caption * 1.8, 'left', () => ({ ink: bInk, rule: null, ruby: bInk2 }))
      paragraph(ctx, B.trB, bx + SP[6], by + SP[6] + FS.caption * 1.8 + B.L.h + SP[4], bInk2)
    }
    const room = f.bottom - y
    const prev = s.prev ? bubble(s.prev, room * 0.3, false) : null
    if (prev) { drawBubble(prev, y, true); y += prev.h + SP[7] }
    const cur = bubble(s.line, f.bottom - y, true)
    drawBubble(cur, y + Math.max(0, (f.bottom - y - cur.h) * 0.3), false)
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
    const section = KIND_JP[q.kind]?.[N3 ? 1 : 0]
    if (section) text(ctx, section, f.x + hw + SP[4] + 64 + SP[5], y + hs * 0.46 + FS.lead * 0.36, { f: font(500, FS.lead, 'jp'), color: ink2 })
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
  // The explanation keeps clear of the seal, and to a fifth of the slide.
  const exHead = revealed && ex.head ? fit(ctx, ex.head, { fam: 'serif', sizes: [FS.display * 0.7, FS.heading, FS.title, FS.lead], maxW: f.w - 170, maxLines: 1 }) : null
  const exSense = revealed && ex.sense ? fit(ctx, ex.sense, { sizes: [FS.title, FS.lead, FS.body], maxW: f.w - 170, maxLines: 2 }) : null
  let exWhy = revealed && ex.why ? fit(ctx, ex.why, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: f.w - 170, maxH: f.h * 0.2, maxLines: 4, lh: 1.25, balanced: false }) : null
  const footOf = () => (cta ? paragraphH(cta)
    : Math.max(150, (exHead ? paragraphH(exHead) + SP[3] : 0) + (exSense ? paragraphH(exSense) : 0) + (exWhy ? paragraphH(exWhy, 1.25) + SP[3] : 0)))
  let foot = footOf()

  // The answers: two by two for four, else one under the other (or side by
  // side when each is short): a lattice whose columns divide its content.
  const short = q.choices.every(x => (x.text || '').length <= 8 && !x.rows)
  // Four answers two by two, unless one is a sentence long.
  // Two columns only where every answer keeps to two lines at a readable size.
  const halfW = (f.w - 9) / 2 - SP[5] - 60 - SP[4] * 2
  const narrow = q.choices.some(x => x.rows ? x.rows.length > 6 : fit(ctx, x.text, { weight: 700, fam: x.fam || 'latin', sizes: [FS.lead], maxW: halfW, maxLines: 2, balanced: false }).cut)
  const long = q.choices.some(x => (x.text || '').length > 34) || narrow
  const cols = n === 4 && !long ? 2 : short ? n : 1
  const rowsN = Math.ceil(n / cols)
  // The stem: on the answer, a dialogue's cue gives way to the task alone.
  // On the answer, the stem shown as it is answered (表記's word in kanji,
  // ★'s pieces in place), and a dialogue's cue gives way to the task alone.
  const st = revealed && q.stem?.after ? q.stem.after : q.stem?.cue && revealed ? { task: q.stem.task } : q.stem
  // The stem keeps room for a line of its own; the lattice takes the rest.
  // Where the answer's why would crowd it out, the why gives way: the
  // stem and the circled answer are the slide.
  const stemMin = st ? (st.rows || st.cue ? FS.display * 1.5 : FS.display) : 0
  if (exWhy && f.bottom - y - SP[7] * 2 - foot - stemMin < rowsN * FS.body * 1.6) { exWhy = null; foot = footOf() }
  // Answers that are sentences take a taller row each.
  const perRow = q.choices.some(x => x.rows) && cols === 1 ? FS.title * 2.6 : FS.body * 1.6
  const gridH = st
    ? Math.max(rowsN * perRow, Math.min(Math.max(f.w * 0.3, (f.bottom - y) * 0.36), rowsN * 200, f.bottom - y - SP[7] * 2 - foot - stemMin))
    : Math.min(f.bottom - y - SP[7] - foot, rowsN * 230)
  const room = st ? f.bottom - y - SP[7] - gridH - SP[7] - foot : -SP[7]
  if (st?.rows) {
    const blankless = st.rows
    const L = layoutSentence(ctx, blankless, { max: FS.display * 1.1, min: FS.lead, maxW: f.w, maxLines: 3, maxH: room - (st.tr ? FS.lead * 2.6 : 0), rules: !!(st.under || st.underLit), gap: 0.08, script: c.plan.script === 'kana' ? 'kana' : c.plan.script })
    const top = y + Math.max(0, (room - L.h - (st.tr ? FS.lead * 2.6 : 0)) / 2)
    drawSentence(ctx, L, f.x, top, 'left', u => ({
      ink, ruby: ink2,
      rule: (st.under && u.i === st.target) || (st.underLit && u.row.lit) ? (revealed ? p.line.exam : ink) : null,
      ruleW: revealed ? EDGE : 4,
    }))
    if (st.tr) paragraph(ctx, fit(ctx, st.tr, { weight: 500, sizes: [FS.lead, FS.body], maxW: f.w, maxLines: 2, balanced: false }), f.x, top + L.h + SP[3], ink2)
  } else if (st?.specimen) {
    const z = Math.min([...st.specimen].length === 1 ? FS.glyph : FS.word, room * 0.9)
    let size = z
    while (size > FS.heading && measure(ctx, st.specimen, font(700, size, 'serif')) > f.w) size -= 4
    text(ctx, st.specimen, f.cx, y + room / 2 + size * 0.36, { f: font(700, size, 'serif'), color: ink, align: 'center' })
  } else if (st?.text) {
    const b = fit(ctx, `“${st.text}”`, { sizes: [FS.display, FS.heading, FS.title, FS.lead, FS.body], maxW: f.w, maxH: room, lh: 1.15 })
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
  ctx.fillStyle = p.surfaceLine
  ctx.fillRect(f.x, y, f.w, gridH)
  // Every answer in one size: the largest at which all of them fit.
  const textW = cw - SP[5] - 60 - SP[4] - SP[4]
  const sizes = [FS.display * 0.62, FS.title, FS.lead, FS.body, FS.sm]
  const fitsAt = (ch, z, lines) => ch.rows || !fit(ctx, ch.text, { weight: ch.fam === 'jp' ? 500 : 700, fam: ch.fam || 'latin', sizes: [z], maxW: textW, maxH: chh - SP[4], maxLines: lines, balanced: false }).cut
  // The largest size at which every answer keeps to one line, else two, else three.
  const sizeFor = (lines, least) => sizes.filter(z => z >= least).find(z => q.choices.every(ch => fitsAt(ch, z, lines)))
  const common = sizeFor(1, FS.title) || sizeFor(2, FS.lead) || sizeFor(3, 0) || FS.sm
  q.choices.forEach((choice, i) => {
    const cx = f.x + HL + (i % cols) * (cw + HL)
    const cy = y + HL + Math.floor(i / cols) * (chh + HL)
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
      const L = layoutSentence(ctx, choice.rows, { max: FS.title, min: FS.caption, maxW: tw, maxLines: 2, maxH: chh - SP[3], script: c.plan.script === 'kana' ? 'kana' : 'kanji', rules: false, gap: 0.04, fam: 'jp', weight: 500 })
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
    if (!inline) {
      size = FS.display * 1.2
      while (size > FS.heading && h.heads.some(x => measure(ctx, x, font(700, size, fam)) > maxW)) size -= 4
    }
    const H = inline ? size * 1.2 : h.heads.length * size * 1.15 + (h.heads.length - 1) * FS.title * 1.6
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
        h.heads.forEach((head, i) => {
          if (i) { text(ctx, h.or, x, at + FS.title * 0.9, { f: orF, color: ink2, align: 'center' }); at += FS.title * 1.6 }
          text(ctx, head, x, at + size * ASC, { f: hf, color: ink, align: 'center' })
          at += size * 1.15
        })
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
    let size = Math.min([...h.head].length <= 2 ? FS.glyph : FS.word, (maxH - paragraphH(tb) - SP[8] - EDGE) / 1.1)
    while (size > FS.heading && measure(ctx, h.head, font(700, size, fam)) > maxW) size -= 4
    return {
      h: size * 1.1 + EDGE + SP[8] + paragraphH(tb),
      draw(x, y) {
        const w = text(ctx, h.head, x, y + size * ASC, { f: font(700, size, fam), color: ink, align })
        ctx.fillStyle = p.line[h.line] || p.line.vocab
        ctx.fillRect(align === 'center' ? x - Math.min(w, SP[9] * 2) / 2 : x, y + size * 1.06, Math.min(w, SP[9] * 2), EDGE)
        paragraph(ctx, tb, x, y + size * 1.1 + EDGE + SP[8], ink, align)
      },
    }
  }
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
    // The tiles as large as the room under the text allows.
    let ts = FS.title * 1.1
    let tf, pad, th, lines, tilesH
    for (;;) {
      tf = font(700, ts, 'jp')
      pad = Math.min(SP[5], ts * 0.6)
      th = ts + pad * 2
      const tiles = h.tiles.map(r => ({ t: r.t, w: measure(ctx, r.t, tf) + pad * 2, line: r.k === 'word' ? 'vocab' : 'grammar' }))
      lines = [[]]
      let lw = 0
      for (const tile of tiles) {
        if (lw + tile.w > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0 }
        lines[lines.length - 1].push(tile)
        lw += tile.w + SP[3]
      }
      tilesH = lines.length * th + (lines.length - 1) * SP[3]
      if (paragraphH(b, 1.15) + SP[8] + tilesH <= maxH || ts <= FS.body) break
      ts -= 4
    }
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
            text(ctx, tile.t, tx + pad, ty + th / 2 + ts * 0.36, { f: tf, color: ink })
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
  const pb = fit(ctx, weldIf(plan.lang, prompt), { sizes: [FS.title, FS.lead], maxW: fr.w * 0.9, maxLines: 2 })
  const content = hookContent(c, plan, fr.w, room - paragraphH(pb) - SP[8], 'serif', 'center', hook)
  const total = content.h + SP[8] + paragraphH(pb)
  let y = top + Math.max(0, (room - total) / 2)
  content.draw(fr.cx, y)
  y += content.h + SP[8]
  paragraph(ctx, pb, fr.cx, y, p.ink2, 'center')
  metal(ctx, p, fr.cx, fr.bottom - pill, plan.t.next)
}

// ── The rating bar (the app's own verdicts) ───────────────
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
// ── The carousel types and their decks ────────────────────────
export const TYPES = [
  { id: 'plates', jp: '駅名標' },
  { id: 'exam', jp: '模試' },
  { id: 'compare', jp: '乗換' },
  { id: 'build', jp: '組立' },
  { id: 'list', jp: '一覧' },
  { id: 'talk', jp: '会話' },
]
// What a type may leave out, and whether it is in by default.
export const TYPE_OPTIONS = {
  plates: [['line', true]],
  exam: [['cover', true], ['sheet', true]],
  compare: [['line', true]],
  build: [['line', true]],
  list: [['recap', true], ['line', true]],
  talk: [['line', true]],
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
  const strip = type !== 'exam' && o.line !== false
  const fc = strip ? { ...fr, h: fr.h - STRIP, bottom: fr.bottom - STRIP } : fr
  const per = fmt.id === 'story' ? 6 : 5
  const out = []
  // A key names the slide's file in the export: a second of a kind is numbered.
  const add = (key, fn, content = true) => {
    const n = out.filter(x => x.key === key || x.key.startsWith(`${key}~`)).length
    out.push({ key: n ? `${key}~${n + 1}` : key, fn, content })
  }
  const ctxOf = (ctx, f = fc) => ({ ctx, p, plan, ...surface(ctx, p, f) })
  const kind = (s, extra = {}) => ctx => KINDS[s.kind](ctxOf(ctx), { ...s, ...extra })
  const exam = type === 'exam'
  let asked = 0
  const ask = (q, titles) => {
    if (!q) return
    asked += 1
    const n = asked
    add(`question-${n}`, ctx => quizSlide(ctxOf(ctx), q, false, exam ? 'exam' : titles[0], n))
    add(`answer-${n}`, ctx => quizSlide(ctxOf(ctx), q, true, exam ? 'exam' : titles[1], n))
  }
  const outro = cta => { if (plan.slides.some(s => s.kind === 'outro')) add('outro', ctx => KINDS.outro({ ...ctxOf(ctx, fr), cta }), false) }
  const wordsPages = s => {
    const ps = pages(s.items, per)
    ps.forEach((list, i) => add(`words-${i + 1}`, ctx => wordsSlide('plates', ctx, p, fc, plan, s, list, i + 1, ps.length)))
  }
  const passage = s => {
    const ps = passagePages(plan, s, fmt, fc)
    ps.forEach((layouts, i) => add(`passage-${i + 1}`, kind(s, { layouts, page: i + 1, count: ps.length })))
  }
  const qs = picked(plan, opts.picks, exam ? 3 : 1)
  const numbered = list => (n, i) => (list.length > 1 ? `${n} ${i}` : n)

  switch (type) {
    case 'exam': {
      if (o.cover) add('cover', ctx => KINDS.cover(ctxOf(ctx, fr), { quizzes: qs }), false)
      if (plan.source === 'passage') plan.slides.filter(s => s.kind === 'passage').forEach(passage)
      qs.forEach(q => ask(q))
      if (o.sheet && qs.length) add('sheet', ctx => KINDS.sheet(ctxOf(ctx), { quizzes: qs }))
      outro(t.cta.exam(qs.length))
      break
    }
    case 'compare': {
      const cmp = plan.compare
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'pair', heads: cmp.sides.map(x => x.head), or: t.or, line: cmp.sides[0].line }, t.compareAsk), false)
      add('sides', kind({ kind: 'sides', sides: cmp.sides }))
      cmp.sides.forEach((x, i) => { if (x.ex) add(`with-${i + 1}`, kind({ kind: 'item', item: { kind: 'sentence', n: i + 1, rows: x.ex.rows, tr: x.ex.tr }, of: 0, title: t.withIt(x.head), line: x.line })) })
      if (cmp.diff || cmp.careful) add('difference', kind({ kind: 'difference', sides: cmp.sides, diff: cmp.diff, careful: cmp.careful }))
      ask(cmp.quiz, [t.quiz, t.answer])
      outro(t.cta.compare)
      break
    }
    case 'build': {
      const b = plan.build
      const tiles = shuffle(b.rows.filter(r => r.k !== 'punct'), seeded(`${plan.id}-build`))
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'prompt', text: b.translation, tiles }, t.buildAsk), false)
      b.steps.forEach((_, i) => add(`step-${i + 1}`, kind({ kind: 'step', build: b, n: i + 1 })))
      add('built', kind({ kind: 'answer', rows: b.rows, romaji: b.romaji, translation: b.translation, title: t.built }))
      outro(t.cta.build)
      break
    }
    case 'list': {
      const L = plan.list
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'listhead', head: L.head, title: L.title, line: L.line }, t.listAsk), false)
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
      add('hook', ctx => opening(ctx, p, fr, plan, { kind: 'place', place: T.place, title: t.talkHook(T.place), line: plan.line }, t.talkAsk), false)
      T.lines.forEach((l, i) => add(`line-${i + 1}`, kind({ kind: 'line', line: l, prev: T.lines[i - 1], n: i + 1, of: T.lines.length, place: T.place, them: T.them })))
      ask(T.quiz, [t.sceneAsk, t.sceneAsk])
      outro(t.cta.talk)
      break
    }
    default: {
      add('hook', ctx => opening(ctx, p, fr, plan), false)
      for (const s of plan.slides) {
        if (s.kind === 'outro') continue
        if (s.kind === 'rating') { add('rating', ctx => ratingSlide(ctx, p, fc, plan)); continue }
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
      outro(t.cta.plates)
    }
  }
  return out.map((sl, i) => ({
    key: sl.key,
    draw: ctx => {
      noShadow(ctx)
      sl.fn(ctx)
      if (strip && sl.content) { noShadow(ctx); routeStrip(ctx, p, fr, i, out.length, p.line[plan.line] || p.line.reading) }
    },
  }))
}
