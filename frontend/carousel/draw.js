// ── カルーセル — drawing (plan 200) ──────────────────────────────
// The primitives every slide is drawn with: the app's scale at a post's
// density, its palette in both grounds, its three faces, and the
// sentence laid out word by word with furigana, rules and romaji.
//
// The colours are the app's, read from landing/tokens.mjs (held equal to
// index.css by src/landing.test.js), never copied here. The sizes are the
// app's scale at the post's density: a rung's rem at K device pixels per
// CSS pixel, K being a 1080px post shown on a 400px phone.
import { DARK, LIGHT, SCALE } from '../landing/tokens.mjs'
import { MARK_INK, MARK_ROAD } from '../src/components/ui/markPaths.js'

// ── Scale ─────────────────────────────────────────────────────
export const K = 2.7
const rem = name => parseFloat(SCALE[name]) * 16 * K
const px = name => parseFloat(SCALE[name]) * K
const FS = {
  xs: rem('--fs-caption-xs'), caption: rem('--fs-caption'), sm: rem('--fs-sm'),
  body: rem('--fs-body'), lead: rem('--fs-lead'), title: rem('--fs-title'),
  heading: rem('--fs-heading'), display: rem('--fs-display'),
  word: rem('--fs-specimen-word'), glyph: rem('--fs-specimen-glyph'),
}
const SP = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, px(`--sp-${n}`)]))
const R = { plate: px('--r-plate'), card: px('--r-card'), panel: px('--r-panel'), identity: px('--r-identity') }
const TR = { term: parseFloat(SCALE['--tr-term']), caption: parseFloat(SCALE['--tr-caption']), reading: parseFloat(SCALE['--tr-reading']) }
const EDGE = 3 * K // a line's edge: a plate's stripe, a row's rail (DESIGN.md, 線)
const RING = 2.5 * K // a roundel's ring

// The two formats a feed takes. `safe` is the box the feed's own chrome
// leaves alone: TikTok lays its search bar over the top of a 9:16 post,
// its buttons down the right and the caption over the foot.
export const FORMATS = {
  post: { id: 'post', w: 1080, h: 1350, safe: { t: 104, r: 92, b: 112, l: 92 } },
  story: { id: 'story', w: 1080, h: 1920, safe: { t: 250, r: 120, b: 430, l: 120 } },
}

// ── Colour ────────────────────────────────────────────────────
function rgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}
/** color-mix(in srgb, a p, b): the app's own mixes, resolved for canvas. */
export function mix(a, b, p) {
  const [x, y] = [rgb(a), rgb(b)]
  return '#' + x.map((v, i) => Math.round(v * p + y[i] * (1 - p)).toString(16).padStart(2, '0')).join('')
}
const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`

// index.css's verdict inks that tokens.mjs does not carry (the landing
// page has no rating bar): the same in both themes, held equal to
// index.css by src/carousel.test.js.
export const RATING_INKS = { '--rating-correct': '#22b89c' }

export function palette(ground) {
  const paper = ground === 'paper'
  const t = paper ? { ...DARK, ...LIGHT } : DARK
  const onPanel = t['--text-on-panel']
  return {
    paper,
    bg: t['--bg-main'],
    card: t['--bg-card'],
    panel: t['--bg-panel'],
    ink: t['--text-primary'],
    ink2: t['--text-secondary'],
    onPanel,
    onPanelSoft: t['--text-on-panel-soft'],
    onFill: t['--text-on-fill'],
    // Text on a line's band (a station plate's foot): the sumi theme's ink, light on every pigment.
    onLine: DARK['--text-primary'],
    // index.css's --surface and --surface-line, per theme
    surface: paper ? mix(t['--text-primary'], t['--bg-card'], 0.04) : t['--bg-panel'],
    surfaceLine: paper ? mix(t['--text-primary'], t['--border'], 0.15) : mix(onPanel, t['--bg-panel'], 0.13),
    panelLine: mix(onPanel, t['--bg-panel'], 0.13),
    gold: t['--accent2'],
    goldLit: t['--gate-gold-lit'],
    goldMid: t['--gate-gold'],
    stamp: t['--stamp-ink'],
    line: {
      vocab: t['--line-vocab'], grammar: t['--line-grammar'], kanji: t['--line-kanji'],
      reading: t['--line-reading'], exam: t['--line-exam'], kana: t['--line-kana'],
      honyaku: t['--line-honyaku'], rikai: t['--line-rikai'], sakubun: t['--line-sakubun'], kakitori: t['--line-kakitori'],
    },
    // The People family: what is the learner's own (their line in a scene).
    pass: t['--pass-ink'],
    // The simple bar, worst first, as the rating bar draws it.
    rating: [t['--rating-wrong'], t['--rust'], t['--warning'], RATING_INKS['--rating-correct']],
    hang: t['--elev-hang'] || DARK['--elev-hang'],
    board: t['--elev-board'] || DARK['--elev-board'],
  }
}

// ── Type ──────────────────────────────────────────────────────
const FAMILY = {
  serif: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
  jp: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif',
  latin: '"Space Grotesk", "Noto Sans JP", "Segoe UI", sans-serif',
  // A theme's pictures (plan 200m): the one colour face, drawn as it is.
  emoji: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
}
export const FONT_FACES = [
  ['serif', 600], ['serif', 700], ['serif', 900],
  ['jp', 400], ['jp', 500], ['jp', 700],
  ['latin', 500], ['latin', 700], ['emoji', 400],
]
export const font = (weight, size, fam) => `${weight} ${Math.round(size * 10) / 10}px ${FAMILY[fam]}`
// Where a Japanese face's em box sits around its baseline (Noto's
// ascender and descender): a CJK glyph fills its em square.
const ASC = 0.88

// ── The painter ───────────────────────────────────────────────
function shadow(ctx, spec) {
  const m = /(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(rgba?\([^)]+\))/.exec(spec || '')
  if (!m) return
  ctx.shadowOffsetX = +m[1] * K
  ctx.shadowOffsetY = +m[2] * K
  ctx.shadowBlur = +m[3] * K
  ctx.shadowColor = m[4]
}
function noShadow(ctx) {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2))
}

function measure(ctx, text, f, tr = 0) {
  ctx.font = f
  if (!tr) return ctx.measureText(text).width
  const size = parseFloat(/([\d.]+)px/.exec(f)[1])
  const chars = [...text]
  return chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + tr * size * (chars.length - 1)
}

/** One line of text. A tracked line is set letter by letter and measured
 *  without the space after its last letter, so it centres on its ink. */
function text(ctx, str, x, y, { f, color, align = 'left', tr = 0 }) {
  ctx.font = f
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  const w = measure(ctx, str, f, tr)
  let at = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  if (!tr) {
    ctx.textAlign = 'left'
    ctx.fillText(str, at, y)
    return w
  }
  const size = parseFloat(/([\d.]+)px/.exec(f)[1])
  ctx.textAlign = 'left'
  for (const c of str) {
    ctx.fillText(c, at, y)
    at += ctx.measureText(c).width + tr * size
  }
  return w
}

/** A caption: the app's one caption, uppercase, tracked, secondary ink. */
function caption(ctx, str, x, y, color, align = 'left', size = FS.caption) {
  return text(ctx, str.toLocaleUpperCase(), x, y, { f: font(700, size, 'latin'), color, align, tr: TR.caption })
}

// What may not start a line (closing marks, small kana, the long-vowel
// mark) and what may not end one (opening marks): 禁則, as a Japanese
// page breaks its lines.
const NO_START = /^[、。，．・：；？！」』）】〕］｝〉》ゝゞー々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ,.;:!?)\]}»…]/
const NO_END = /[「『（【〔［｛〈《([{«]$/
/** A word too wide for the line, cut between its characters where a line
 *  may break: Japanese has no spaces to wait for. */
function split(ctx, word, f, maxW) {
  const chars = [...word]
  const out = []
  let cur = ''
  for (const ch of chars) {
    const test = cur + ch
    if (!cur || measure(ctx, test, f) <= maxW) { cur = test; continue }
    if (NO_START.test(ch) || NO_END.test(cur)) {
      // っ may not start the next line: it takes the character before it along.
      if ([...cur].length > 1) { const keep = [...cur]; const last = keep.pop(); out.push(keep.join('')); cur = last + ch } else cur = test
      continue
    }
    out.push(cur)
    cur = ch
  }
  if (cur) out.push(cur)
  return out
}
function wrap(ctx, str, f, maxW) {
  const words = String(str).split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (!cur || measure(ctx, test, f) <= maxW) { cur = test; continue }
    lines.push(cur)
    cur = w
  }
  if (cur) lines.push(cur)
  // A line still too wide is one word too wide: cut it between characters.
  return lines.flatMap(l => (measure(ctx, l, f) > maxW ? split(ctx, l, f, maxW) : [l]))
}
/** text-wrap: balance, for a heading: the narrowest box that keeps the
 *  same number of lines. */
function balance(ctx, str, f, maxW) {
  const lines = wrap(ctx, str, f, maxW)
  if (lines.length < 2) return lines
  let lo = maxW * 0.4, hi = maxW
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2
    if (wrap(ctx, str, f, mid).length > lines.length) lo = mid
    else hi = mid
  }
  return wrap(ctx, str, f, hi)
}
/** The largest of `sizes` at which `str` sets in `maxLines` lines. */
function fit(ctx, str, { weight = 700, fam = 'latin', sizes, maxW, maxLines = 99, maxH = Infinity, lh = 1.18, balanced = true }) {
  for (const size of sizes) {
    const f = font(weight, size, fam)
    const lines = (balanced ? balance : wrap)(ctx, str, f, maxW)
    const h = size * (0.8 + (lines.length - 1) * lh + 0.3)
    if (lines.length <= maxLines && h <= maxH && lines.every(l => measure(ctx, l, f) <= maxW + 0.5)) return { size, f, lines }
  }
  const size = sizes[sizes.length - 1]
  const f = font(weight, size, fam)
  const lines = wrap(ctx, str, f, maxW)
  const room = Math.max(1, Math.min(maxLines, Math.floor((maxH / size - 1.1) / lh) + 1))
  if (lines.length > room) {
    const kept = lines.slice(0, room)
    let last = kept[room - 1]
    while (last.length > 1 && measure(ctx, `${last}…`, f) > maxW) last = last.slice(0, -1)
    kept[room - 1] = `${last.replace(/[\s,;:]+$/, '')}…`
    return { size, f, lines: kept, cut: true }
  }
  return { size, f, lines }
}
function paragraph(ctx, block, x, y, color, align = 'left', lh = 1.18) {
  block.lines.forEach((l, i) => text(ctx, l, x, y + block.size * (0.8 + i * lh), { f: block.f, color, align }))
  return block.size * (0.8 + (block.lines.length - 1) * lh + 0.3)
}
const paragraphH = (block, lh = 1.18) => block.size * (0.8 + (block.lines.length - 1) * lh + 0.3)

/** A roundel: a ring, unfilled, a figure or a glyph centred in it. */
function roundel(ctx, cx, cy, r, color, label, { ink, fam = 'latin', size, weight = 700 } = {}) {
  ctx.beginPath()
  ctx.arc(cx, cy, r - RING / 2, 0, Math.PI * 2)
  ctx.lineWidth = RING
  ctx.strokeStyle = color
  ctx.stroke()
  if (label == null) return
  const s = size ?? r * 0.82
  const f = font(weight, s, fam)
  ctx.font = f
  const m = ctx.measureText(label)
  // Centre the ink, not the line box: a figure's box is not its ink.
  const top = m.actualBoundingBoxAscent, bottom = m.actualBoundingBoxDescent
  text(ctx, label, cx, cy + (top - bottom) / 2, { f, color: ink ?? color, align: 'center' })
}

function mark(ctx, x, y, size, ink, road) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 1000, size / 1000)
  ctx.fillStyle = road
  ctx.fill(new Path2D(MARK_ROAD))
  ctx.fillStyle = ink
  ctx.fill(new Path2D(MARK_INK))
  ctx.restore()
}

/** The primary button, the metal: the gate's gold lit from the top, its
 *  label set smaller rather than wider than `maxW`. */
const METAL_H = 44 * K
function metal(ctx, p, cx, y, label, maxW = Infinity) {
  const widthAt = z => measure(ctx, label, font(700, z, 'latin')) + z * 0.9 + SP[4] + SP[7] * 2
  const size = [FS.lead, FS.body, FS.sm].find(z => widthAt(z) <= maxW) || FS.sm
  const f = font(700, size, 'latin')
  const arrow = size * 0.9
  const w = widthAt(size)
  const h = METAL_H
  const x = cx - w / 2
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, p.goldLit)
  g.addColorStop(1, p.goldMid)
  ctx.save()
  shadow(ctx, `0 4px 16px ${alpha(p.goldMid, 0.3)}`)
  rrect(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
  const tw = text(ctx, label, x + SP[7], y + h / 2 + size * 0.36, { f, color: p.onFill })
  chevron(ctx, x + SP[7] + tw + SP[4], y + h / 2, arrow, p.onFill)
  return h
}
function chevron(ctx, x, cy, w, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = w * 0.13
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x, cy)
  ctx.lineTo(x + w, cy)
  ctx.moveTo(x + w * 0.6, cy - w * 0.38)
  ctx.lineTo(x + w, cy)
  ctx.lineTo(x + w * 0.6, cy + w * 0.38)
  ctx.stroke()
  ctx.restore()
}

// ── The sentence, laid out ────────────────────────────────────
// Lines break only between words (a word is a row of the breakdown,
// its punctuation riding it), each word on its rule, furigana over the
// kanji the script asks for, romaji under the word.
// Furigana are set as the app sets them (ExampleSentence.jsx and its
// rules in index.css, plan 200h): one word's readings as one ruby, がく
// and せい joined over 学生 rather than spreading it into 学 生; a reading
// wider than its kanji leaning on the kana either side by half a reading
// character, where there IS kana on both sides (a lone kana between two
// readings leant on by the first only); two words' readings side by side
// kept apart; and never under the caption rung, where ご reads as こ.
// Kana, the long-vowel mark and full-width punctuation: what a reading may
// overhang. Not a kanji, and not Latin, whose letters are narrower.
const OVERHANGABLE = /^[\u3000-\u303f\u3041-\u30ff\uff01-\uff0f\uff1a-\uff20\uff5b-\uff65]$/u

function units(rows, { script, blank }) {
  const out = []
  let prefix = ''
  rows.forEach((row, i) => {
    if (row.k === 'punct') {
      if (/^[「『（(]$/.test(row.t) || !out.length) prefix += row.t
      else out[out.length - 1].punct += row.t
      return
    }
    let segs
    if (blank === i) segs = [['（　　）', '']]
    else if (script === 'kana') segs = [[reading(row), '']]
    else segs = (row.fu || [[row.t, '']]).map(([t, r]) => [t, script === 'furigana' ? r : ''])
    // One word's readings side by side are one ruby: がくせい over 学生.
    segs = segs.reduce((acc, [t, r]) => {
      const prev = acc[acc.length - 1]
      if (prev && prev[1] && r) acc[acc.length - 1] = [prev[0] + t, prev[1] + r]
      else acc.push([t, r])
      return acc
    }, [])
    out.push({ row, i, segs, prefix, punct: '', blank: blank === i })
    prefix = ''
  })
  if (prefix && out.length) out[out.length - 1].punct += prefix
  // Where a reading may lean on its neighbours: kana on both sides of it,
  // in its own word, and a lone kana claimed by one reading only.
  for (const u of out) {
    let claimed = -1
    u.over = u.segs.map(([, r], k) => {
      if (!r) return false
      const before = k ? u.segs[k - 1] : null
      const after = k + 1 < u.segs.length ? u.segs[k + 1] : null
      const left = before ? (before[1] ? null : [...before[0]].at(-1)) : [...u.prefix].at(-1)
      const right = after ? (after[1] ? null : [...after[0]][0]) : [...u.punct][0]
      const over = !!left && !!right && OVERHANGABLE.test(left) && OVERHANGABLE.test(right) && claimed !== k - 1
      if (over && after && [...after[0]].length === 1) claimed = k + 1
      return over
    })
  }
  return out
}

const RUBY_MIN = FS.caption

/** The words a line may not break between: a particle, the copula, a
 *  suffix or an ending rides on the word before it, as does the verb a
 *  て-form leans on (おくれて いる) and the second noun of a compound
 *  (鉄道 会社); punctuation ends a phrase, an opening bracket starts one. */
function joins(a, b) {
  if (a.punct || b.prefix) return false
  const r = b.row
  if (r.k === 'particle' || r.k === 'copula' || r.pos === 'suffix' || r.pos === 'auxiliary') return true
  if (r.pos === 'verb' && a.row.pos === 'verb' && /[てで]$/.test(a.row.t)) return true
  return r.pos === 'noun' && a.row.pos === 'noun'
}
function phrasesOf(list) {
  const out = []
  list.forEach((u, i) => {
    if (i && joins(list[i - 1], u)) out[out.length - 1].push(u)
    else out.push([u])
  })
  return out
}

function layoutSentence(ctx, rows, o) {
  const opts = { fam: 'serif', weight: 700, maxLines: 3, maxH: Infinity, gap: 0.3, rules: true, romaji: false, script: 'kanji', ...o }
  const list = units(rows, opts)
  const ruby = opts.script === 'furigana' && list.some(u => u.segs.some(([, r]) => r))
  const phrases = phrasesOf(list)
  // A phrase is kept whole at a size a little under the largest before
  // it is broken at the largest: おくれているね。 on one line rather than
  // おくれて over いるね。.
  const floor = Math.max(opts.min, opts.max * 0.72)
  for (const whole of [true, false]) {
    for (let size = opts.max; size >= (whole ? floor : opts.min); size -= 2) {
      const f = font(opts.weight, size, opts.fam)
      // Furigana at 0.4 of the word, never under the scale's smallest caption.
      const rs = Math.max(size * 0.4, RUBY_MIN)
      const rf = font(500, rs, 'jp')
      const romF = font(500, Math.max(size * 0.3, FS.sm * 0.9), 'latin')
      for (const u of list) {
        let x = measure(ctx, u.prefix, f)
        u.segX = u.segs.map(([t, r], k) => {
          const bw = measure(ctx, t, f)
          const rw = r ? measure(ctx, r, rf) : 0
          // A wider reading leans half a reading character into the kana
          // either side, where it may; the rest widens its kanji.
          const lean = u.over[k] ? Math.min(rs * 0.5, Math.max(0, rw - bw) / 2) : 0
          const seg = { t, r, x, w: Math.max(bw, rw - lean * 2), bw, rw }
          x += seg.w
          return seg
        })
        u.ruleX = measure(ctx, u.prefix, f)
        u.baseW = x - u.ruleX
        u.w = x + measure(ctx, u.punct, f)
        u.romW = opts.romaji ? measure(ctx, u.row.ro, romF) : 0
        u.pad = Math.max(0, (u.romW - u.baseW) / 2 - (u.w - u.ruleX - u.baseW))
        u.lead = Math.max(0, (u.romW - u.baseW) / 2 - u.ruleX)
        u.span = u.lead + u.w + u.pad
        // How far its first and last readings stand in from its edges.
        const rubies = u.segX.filter(sg => sg.r)
        u.rubyL = rubies.length ? u.lead + rubies[0].x + (rubies[0].w - rubies[0].rw) / 2 : Infinity
        u.rubyR = rubies.length ? u.span - (u.lead + rubies.at(-1).x + (rubies.at(-1).w + rubies.at(-1).rw) / 2) : Infinity
      }
      const gap = size * opts.gap
      // Two words' readings side by side keep a space between them, or
      // まいとし and かるいざわ run on as one reading.
      const apart = (a, b) => Math.max(0, SP[1] - (gap + a.rubyR + b.rubyL))
      const fits = list.every(u => u.span <= opts.maxW)
      const widthOf = us => us.reduce((w, u, i) => w + u.span + (i ? gap + apart(us[i - 1], u) : 0), 0)
      // A line breaks between phrases (文節), as the app's word-break:
      // auto-phrase breaks it; a phrase too wide for the line breaks
      // between its words.
      const pack = limit => {
        const out = [[]]
        let width = 0
        const place = u => {
          const line = out[out.length - 1]
          const extra = line.length ? apart(line[line.length - 1], u) : 0
          const add = (line.length ? gap + extra : 0) + u.span
          if (line.length && width + add > limit) { out.push([u]); width = u.span; u.extra = 0 }
          else { line.push(u); width += add; u.extra = extra }
        }
        for (const ph of phrases) {
          const line = out[out.length - 1]
          const w = widthOf(ph)
          const add = line.length ? gap + apart(line[line.length - 1], ph[0]) + w : w
          if (w > limit) ph.forEach(place)
          else if (line.length && width + add > limit) { out.push([]); width = 0; ph.forEach(place) }
          else ph.forEach(place)
        }
        return out
      }
      let lines = pack(opts.maxW)
      // The same lines, evened out (the app's text-wrap: balance): the
      // narrowest measure that still takes no more lines, so a sentence
      // never leaves ね。 alone on its last line.
      if (fits && lines.length > 1) {
        let lo = Math.max(...phrases.map(widthOf).filter(w => w <= opts.maxW), ...list.map(u => u.span)), hi = opts.maxW
        while (hi - lo > 2) {
          const mid = (lo + hi) / 2
          if (pack(mid).length <= lines.length) hi = mid
          else lo = mid
        }
        lines = pack(hi)
      }
      const last = !whole && size - 2 < opts.min
      if (whole && !phrases.every(ph => widthOf(ph) <= opts.maxW)) continue
      if (!fits && !last) continue
      if (lines.length > opts.maxLines && !last) continue
      const rubyH = ruby ? rs * 1.3 : 0
      // The room under the word: its rule's, or (`under`) as the caller sets it.
      const ruleGap = size * (opts.under ?? (opts.rules ? 0.22 : 0.12))
      const romH = opts.romaji ? Math.max(size * 0.3, FS.sm * 0.9) * 1.5 : 0
      const lineH = rubyH + size + ruleGap + romH
      const lineGap = size * 0.32
      if (lines.length * lineH + (lines.length - 1) * lineGap > opts.maxH && !last) continue
      return {
        ...opts, list, lines, size, f, rf, romF, gap, rubyH, ruleGap, romH, lineH, lineGap,
        h: lines.length * lineH + (lines.length - 1) * lineGap,
        lineW: line => line.reduce((w, u, i) => w + u.span + (i ? gap + u.extra : 0), 0),
      }
    }
  }
  return null
}

/** Draw a laid-out sentence with its top at `y`. `style(u)` returns the
 *  word's ink and its rule ({ ink, rule, ruleW, romaji }). */
function drawSentence(ctx, L, x, y, align, style) {
  L.lines.forEach((line, li) => {
    const top = y + li * (L.lineH + L.lineGap)
    const lw = L.lineW(line)
    let at = align === 'center' ? x - lw / 2 : x
    const base = top + L.rubyH + L.size * ASC
    line.forEach((u, ui) => {
      if (ui) at += L.gap + u.extra
      const st = style(u)
      const ux = at + u.lead
      if (u.prefix) text(ctx, u.prefix, ux, base, { f: L.f, color: st.ink })
      for (const seg of u.segX) {
        text(ctx, seg.t, ux + seg.x + (seg.w - seg.bw) / 2, base, { f: L.f, color: st.ink })
        if (seg.r) text(ctx, seg.r, ux + seg.x + seg.w / 2, top + L.rubyH * 0.78, { f: L.rf, color: st.ruby ?? st.ink, align: 'center' })
      }
      if (u.punct) text(ctx, u.punct, ux + u.ruleX + u.baseW, base, { f: L.f, color: st.ink })
      if (st.rule) {
        ctx.fillStyle = st.rule
        const rw = st.ruleW ?? EDGE
        rrect(ctx, ux + u.ruleX, base + L.size * 0.12 + L.ruleGap * 0.35, u.baseW, rw, rw / 2)
        ctx.fill()
      }
      if (L.romaji && st.romaji) {
        text(ctx, u.row.ro, ux + u.ruleX + u.baseW / 2, base + L.size * 0.12 + L.ruleGap + L.romH * 0.62, { f: L.romF, color: st.romaji, align: 'center' })
      }
      at += u.span
    })
  })
}

// The line a word belongs to: its pigment (DESIGN.md, one line one colour).
const lineOf = (p, row) => (row.k === 'word' ? p.line.vocab : p.line.grammar)

// ── Frames ────────────────────────────────────────────────────
function frame(fmt) {
  const { w, h, safe } = fmt
  return { W: w, H: h, x: safe.l, y: safe.t, w: w - safe.l - safe.r, h: h - safe.t - safe.b, cx: safe.l + (w - safe.l - safe.r) / 2, bottom: h - safe.b, right: w - safe.r }
}
function ground(ctx, p, fr) {
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, fr.W, fr.H)
}
/** The brand, at the head of a slide that opens or closes the post. */
function masthead(ctx, p, fr, ink = p.ink, sub = p.ink2) {
  const s = 64
  mark(ctx, fr.x, fr.y, s, ink, p.gold)
  caption(ctx, 'Tsuji', fr.x + s + SP[4], fr.y + s * 0.66, sub)
}
/** A slide's title: a name, set as a station prints its names. */
function heading(ctx, p, fr, str, y, color = p.ink) {
  // A long title steps down a rung rather than being cut (plan 200n).
  const b = fit(ctx, str, { sizes: [FS.heading, FS.display * 0.6, FS.title], maxW: fr.w, maxLines: 1 })
  text(ctx, b.lines[0], fr.x, y + b.size * 0.8, { f: b.f, color })
  return b.size * 1.1
}
function pageMark(ctx, p, fr, page, pages, y, color) {
  if (pages < 2) return
  text(ctx, `${page}/${pages}`, fr.right, y, { f: font(700, FS.lead, 'latin'), color, align: 'right' })
}

/** Split the words over slides, `per` at most to a slide, evenly. */
function pages(words, per) {
  const n = Math.ceil(words.length / per)
  const size = Math.ceil(words.length / n)
  return Array.from({ length: n }, (_, i) => words.slice(i * size, (i + 1) * size))
}

function strokeBox(ctx, k, x, y, size, upto, color, done, guide) {
  if (guide) {
    ctx.save()
    ctx.strokeStyle = guide
    ctx.lineWidth = Math.max(2, size / 140)
    ctx.setLineDash([size / 40, size / 40])
    ctx.beginPath()
    ctx.moveTo(x + size / 2, y); ctx.lineTo(x + size / 2, y + size)
    ctx.moveTo(x, y + size / 2); ctx.lineTo(x + size, y + size / 2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 109, size / 109)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3.4
  k.s.d.forEach((d, i) => {
    if (i > upto) return
    ctx.strokeStyle = i === upto ? color : done
    ctx.stroke(new Path2D(d))
  })
  ctx.restore()
}

/** The teacher's circle round the right answer's number, in the seal's ink. */
function marked(ctx, p, cx, cy, r) {
  ctx.save()
  ctx.strokeStyle = p.stamp
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r + 18, r + 12, -0.25, 0.15, Math.PI * 2 - 0.05)
  ctx.stroke()
  ctx.restore()
}

/** The 正解 stamp: the seal's ink in a ring, set at a slant. */
function stamp(ctx, p, cx, cy, r) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.21)
  ctx.globalAlpha = 0.9
  ctx.strokeStyle = p.stamp
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.arc(0, 0, r - 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(0, 0, r - 14, 0, Math.PI * 2)
  ctx.stroke()
  text(ctx, '正解', 0, r * 0.2, { f: font(900, r * 0.62, 'serif'), color: p.stamp, align: 'center' })
  ctx.restore()
}


export const reading = row => (row.fu ? row.fu.map(([t, r]) => r || t).join('') : row.t)
export const hasKanji = text => /[\u3400-\u9fff々]/.test(text)

export {
  FS, SP, R, TR, EDGE, RING, ASC, FAMILY, alpha, shadow, noShadow, rrect, measure, text, caption, wrap, balance, fit,
  paragraph, paragraphH, roundel, mark, metal, METAL_H, chevron, units, layoutSentence, drawSentence, lineOf, frame, ground,
  masthead, heading, pageMark, pages, strokeBox, marked, stamp,
}
