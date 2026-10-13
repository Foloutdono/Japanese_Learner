// ── カルーセル — the carousel's slides (plan 200) ──────────────────
// One sentence of the reading bank, drawn as a photo carousel for a
// social feed: the sentence as a challenge, its words, its grammar
// point, the answer, a bonus, the mark. Drawn on canvas, so what the
// studio shows is the PNG it exports, pixel for pixel.
//
// Four directions, each the app's own idiom (DESIGN.md, "The idea"):
//   plates  駅名標  the station plates: a word is a stop on the line
//   board   発車標  the departure board: the words as departures
//   card    札      the study card, and the rating bar it ends on
//   exam    模試    the mock exam's question, its four answers, the stamp
//
// The colours are the app's, read from landing/tokens.mjs (held equal to
// index.css by src/landing.test.js), never copied here. The sizes are the
// app's scale at the post's density: a rung's rem at K device pixels per
// CSS pixel, K being a 1080px post shown on a 400px phone. A colour keeps
// its meaning: a word wears the vocabulary line's pigment, a particle or
// an ending the grammar line's, a kanji the kanji line's, the sentence
// the reading line's; the gold is the action (the metal) and nothing
// else.
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
    },
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
}
export const FONT_FACES = [
  ['serif', 600], ['serif', 700], ['serif', 900],
  ['jp', 400], ['jp', 500], ['jp', 700],
  ['latin', 500], ['latin', 700],
]
export const font = (weight, size, fam) => `${weight} ${Math.round(size * 10) / 10}px ${FAMILY[fam]}`
// Where a Japanese face's em box sits around its baseline (Noto's
// ascender and descender): a CJK glyph fills its em square.
const ASC = 0.88

// ── The words of the slides ───────────────────────────────────
export const STRINGS = {
  en: {
    prompt: { plates: 'Read it before the doors close.', board: 'Next departure. Can you read it?', card: 'Say it out loud, then swipe.' },
    next: 'Next stop',
    words: 'Stop by stop',
    transfer: 'Transfer',
    terminus: 'Terminus',
    write: 'Write it',
    strokes: n => (n === 1 ? '1 stroke' : `${n} strokes`),
    twist: 'Twist',
    rate: 'How did you do?',
    rateCta: 'Rate yourself in the comments',
    ratings: ['Wrong', 'Almost', 'Difficult', 'Correct'],
    examAsk: { reading: 'How do you read the underlined word?', particle: 'Which word goes in the gap?', meaning: 'What does the underlined word mean?' },
    examCta: 'Answer in the comments: 1, 2, 3 or 4',
    answer: 'Answer',
    outro: 'Learn Japanese, from your first kana to JLPT N1.',
    columns: ['', 'Word', 'Meaning'],
    departure: 'Departure',
    arrived: 'Arrived',
    pos: {
      noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', particle: 'particle',
      copula: 'copula', pronoun: 'pronoun', auxiliary: 'ending', adnominal: 'determiner',
      conjunction: 'conjunction', interjection: 'interjection', prefix: 'prefix', suffix: 'suffix',
    },
  },
  fr: {
    prompt: { plates: 'Lis-la avant la fermeture des portes.', board: 'Prochain départ. Tu sais la lire ?', card: 'Dis-la à voix haute, puis fais glisser.' },
    next: 'Prochain arrêt',
    words: 'Arrêt par arrêt',
    transfer: 'Correspondance',
    terminus: 'Terminus',
    write: 'Écris-le',
    strokes: n => (n === 1 ? '1 trait' : `${n} traits`),
    twist: 'Variante',
    rate: 'Alors, tu l’as lue ?',
    rateCta: 'Donne ta note en commentaire',
    ratings: ['Raté', 'Presque', 'Difficile', 'Correct'],
    examAsk: { reading: 'Comment se lit le mot souligné ?', particle: 'Quel mot va dans le blanc ?', meaning: 'Que veut dire le mot souligné ?' },
    examCta: 'Réponds en commentaire : 1, 2, 3 ou 4',
    answer: 'Réponse',
    outro: 'Apprendre le japonais, du premier kana au JLPT N1.',
    columns: ['', 'Mot', 'Sens'],
    departure: 'Départ',
    arrived: 'Arrivée',
    pos: {
      noun: 'nom', verb: 'verbe', adjective: 'adjectif', adverb: 'adverbe', particle: 'particule',
      copula: 'copule', pronoun: 'pronom', auxiliary: 'terminaison', adnominal: 'déterminant',
      conjunction: 'conjonction', interjection: 'interjection', prefix: 'préfixe', suffix: 'suffixe',
    },
  },
}
const RATINGS_JP = ['不正解', '惜しい', '難しい', '正解']
const EXAM_ASK_JP = {
  reading: '＿＿の ことばは どう よみますか。',
  particle: '（　）に 何を 入れますか。',
  meaning: '＿＿の ことばの いみは どれですか。',
}

/** French sets a space before : ; ! ? and inside « », and the line may
 *  not break there (DESIGN.md, "French punctuation does not start a line"). */
export function weld(text) {
  return String(text ?? '')
    .replace(/ ([:;!?»])/g, ' $1')
    .replace(/« /g, '« ')
}

// ── The model: what every direction draws from ─────────────────
const PARTICLES = {
  は: ['が', 'を', 'も'], が: ['は', 'を', 'に'], を: ['が', 'に', 'で'], に: ['で', 'へ', 'を'],
  で: ['に', 'を', 'へ'], へ: ['に', 'で', 'を'], と: ['や', 'も', 'に'], も: ['は', 'が', 'と'],
  の: ['が', 'を', 'に'], や: ['と', 'も', 'の'], か: ['ね', 'よ', 'の'], よ: ['ね', 'か', 'の'],
  ね: ['よ', 'か', 'の'], から: ['まで', 'より', 'で'], まで: ['から', 'までに', 'に'], より: ['から', 'ほど', 'まで'],
}

const reading = row => (row.fu ? row.fu.map(([t, r]) => r || t).join('') : row.t)
const hasKanji = text => /[㐀-鿿々]/.test(text)

/** A seeded pick, so a sentence's quiz deals the same four every time. */
function seeded(seed) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.codePointAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}
function shuffle(list, rand) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// The near-misses a learner actually writes for a reading (the exam's own
// distractors are cut the same way, study/exam_kanji_gen.py): a sound
// voiced or unvoiced, a long vowel added or dropped, a small っ or ゃゅょ
// added or dropped, another reading of one of its kanji.
const VOICE = Object.fromEntries('かが きぎ くぐ けげ こご さざ しじ すず せぜ そぞ ただ ちぢ つづ てで とど はば ひび ふぶ へべ ほぼ'
  .split(' ').flatMap(([a, b]) => [[a, b], [b, a]]))
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ' }
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))

export function readingMisses(row, kanji) {
  const answer = reading(row)
  const out = new Set()
  const chars = [...answer]
  chars.forEach((c, i) => {
    if (VOICE[c]) out.add([...chars.slice(0, i), VOICE[c], ...chars.slice(i + 1)].join(''))
    if (SMALL[c] && i > 0) out.add([...chars.slice(0, i), SMALL[c], ...chars.slice(i + 1)].join(''))
    if (c === 'う' && i > 0 && 'おこそとのほもよろごぞどぼぽょ'.includes(chars[i - 1])) out.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''))
    if (c === 'っ') out.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''))
    if ('こそとほ'.includes(c) && chars[i + 1] !== 'う' && i === chars.length - 1) out.add(answer + 'う')
    if ('かきくけこさしすせそたちつてとぱぴぷぺぽ'.includes(c) && i > 0 && chars[i - 1] !== 'っ' && chars[i - 1] !== 'ん') {
      out.add([...chars.slice(0, i), 'っ', ...chars.slice(i)].join(''))
    }
  })
  // Another reading of one of its kanji, in place of the one it takes here.
  for (const [text, r] of row.fu || []) {
    if (!r || [...text].length !== 1 || !kanji[text]) continue
    const k = kanji[text]
    for (const other of [...k.on.map(toHira), ...k.kun.map(([stem]) => stem)]) {
      if (other && other !== r) out.add(reading(row).replace(r, other))
    }
  }
  out.delete(answer)
  return [...out].filter(s => s && /^[ぁ-ゟー]+$/.test(s))
}

function quizOf(s, bank, lang) {
  const rand = seeded(s.id)
  const rows = s.rows
  const particle = rows.findIndex(r => r.k === 'particle' && r.t === s.p && PARTICLES[r.t])
  let type, target, answer, misses
  if (particle >= 0) {
    type = 'particle'; target = particle; answer = rows[particle].t; misses = PARTICLES[answer]
  } else {
    const focus = s.fi ?? rows.findIndex(r => r.k === 'word')
    const row = rows[focus]
    const near = row && hasKanji(row.t) ? readingMisses(row, bank.kanji) : []
    if (near.length >= 3) {
      type = 'reading'; target = focus; answer = reading(row); misses = shuffle(near, rand).slice(0, 3)
    } else {
      type = 'meaning'; target = focus; answer = gloss(row, lang)[0]
      const pool = new Set()
      for (const other of bank.sentences) {
        for (const r of other.rows) {
          if (r.k === 'word' && r.pos === row.pos && r.t !== row.t && r.en) pool.add(gloss(r, lang)[0])
        }
      }
      pool.delete(answer)
      misses = shuffle([...pool], rand).slice(0, 3)
    }
  }
  const choices = shuffle([answer, ...misses.slice(0, 3)], rand)
  return { type, target, answer, choices, right: choices.indexOf(answer) }
}

/** A word's gloss in the reader's language: [the sense, the senses after it]. */
function gloss(row, lang) {
  const senses = (lang === 'fr' && row.fr) || row.en || []
  return [senses[0] || '', senses.slice(1, 3).join(', ')]
}

function rowPoint(row, s) {
  const markers = new Set(s.gram.filter(g => g.kind === 'marker').map(g => g.p))
  const g = row.g || []
  return g.find(p => p === row.t) ?? g.find(p => markers.has(p)) ?? g[0]
}

export function model(bank, s, opts) {
  const lang = opts.lang
  const t = STRINGS[lang]
  const points = bank.points
  const words = s.rows.map((row, i) => ({ row, i })).filter(({ row }) => row.k !== 'punct').map(({ row, i }) => {
    const grammarRow = row.k !== 'word'
    let main, sub
    if (grammarRow) {
      const pt = points[rowPoint(row, s)]
      main = pt ? weldIf(lang, pt[lang] || pt.en) : t.pos[row.k]
      sub = formOf(pt, lang)
    } else {
      [main, sub] = gloss(row, lang)
      // A word the deck has no gloss for is glossed by the point written on it.
      const pt = !main && points[(row.g || []).find(q => points[q])]
      if (pt) [main, sub] = [pt[lang] || pt.en, formOf(pt, lang)]
      main = weldIf(lang, main)
      sub = weldIf(lang, sub)
    }
    return {
      i, row, main, sub, grammar: grammarRow,
      reading: reading(row),
      pos: t.pos[row.k === 'word' ? row.pos : row.k] || row.pos,
      carriesPoint: !grammarRow && (row.g || []).includes(s.p),
    }
  })
  const kanjiChars = [...new Set([...s.jp].filter(c => bank.kanji[c]?.s))]
  const focus = s.fi != null ? s.rows[s.fi] : null
  const kanjiChar = (opts.kanji && kanjiChars.includes(opts.kanji) && opts.kanji)
    || [...(focus?.t || '')].find(c => kanjiChars.includes(c))
    || kanjiChars[0] || null
  const point = points[s.p] || null
  return {
    s, lang, t, words, point,
    translation: weldIf(lang, s[lang] || s.en),
    romaji: lineRomaji(s.rows),
    kanjiChars,
    kanjiChar,
    kanji: kanjiChar ? bank.kanji[kanjiChar] : null,
    twist: point?.twists?.[0] || null,
    quiz: quizOf(s, bank, lang),
    script: opts.script,
    showRomaji: opts.romaji,
    handle: opts.handle || '',
  }
}
const weldIf = (lang, text) => (lang === 'fr' ? weld(text) : text)
/** A point's form in the reader's language, or none: the catalogue writes
 *  it in English, and carousel_bank.py turns the French over where it can. */
const formOf = (pt, lang) => (lang === 'fr' ? pt?.form_fr : pt?.form) || ''

const PUNCT_ROMAJI = { '。': '.', '、': ',', '？': '?', '！': '!', '「': '“', '」': '”', '『': '“', '』': '”', '・': ' ', '…': '…' }
/** The sentence in romaji, word by word as the slides cut it. */
export function lineRomaji(rows) {
  let out = ''
  for (const row of rows) {
    if (row.k === 'punct') {
      const p = PUNCT_ROMAJI[row.t] ?? ''
      out += p === '“' ? ` ${p}` : p
    } else {
      out += (out && !out.endsWith('“') ? ' ' : '') + row.ro
    }
  }
  return out.trim().replace(/^./, c => c.toUpperCase())
}

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

function wrap(ctx, str, f, maxW) {
  const words = String(str).split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (!cur || measure(ctx, test, f) <= maxW) cur = test
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines
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

/** The primary button, the metal: the gate's gold lit from the top. */
function metal(ctx, p, cx, y, label) {
  const f = font(700, FS.lead, 'latin')
  const arrow = FS.lead * 0.9
  const w = measure(ctx, label, f) + arrow + SP[4] + SP[7] * 2
  const h = 44 * K
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
  const tw = text(ctx, label, x + SP[7], y + h / 2 + FS.lead * 0.36, { f, color: p.onFill })
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
function units(m, { script, blank }) {
  const out = []
  let prefix = ''
  m.s.rows.forEach((row, i) => {
    if (row.k === 'punct') {
      if (/^[「『（(]$/.test(row.t) || !out.length) prefix += row.t
      else out[out.length - 1].punct += row.t
      return
    }
    let segs
    if (blank === i) segs = [['（　　）', '']]
    else if (script === 'kana') segs = [[reading(row), '']]
    else segs = (row.fu || [[row.t, '']]).map(([t, r]) => [t, script === 'furigana' ? r : ''])
    out.push({ row, i, segs, prefix, punct: '', blank: blank === i })
    prefix = ''
  })
  if (prefix && out.length) out[out.length - 1].punct += prefix
  return out
}

function layoutSentence(ctx, m, o) {
  const opts = { fam: 'serif', weight: 700, maxLines: 3, maxH: Infinity, gap: 0.3, rules: true, romaji: false, script: m.script, ...o }
  const list = units(m, opts)
  const ruby = opts.script === 'furigana' && list.some(u => u.segs.some(([, r]) => r))
  for (let size = opts.max; size >= opts.min; size -= 2) {
    const f = font(opts.weight, size, opts.fam)
    const rf = font(500, size * 0.4, 'jp')
    const romF = font(500, Math.max(size * 0.3, FS.sm * 0.9), 'latin')
    for (const u of list) {
      let x = measure(ctx, u.prefix, f)
      u.segX = u.segs.map(([t, r]) => {
        const bw = measure(ctx, t, f)
        const rw = r ? measure(ctx, r, rf) : 0
        const seg = { t, r, x, w: Math.max(bw, rw), bw }
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
    }
    const gap = size * opts.gap
    const lines = [[]]
    let width = 0
    let fits = true
    for (const u of list) {
      if (u.span > opts.maxW) { fits = false; break }
      const line = lines[lines.length - 1]
      const add = (line.length ? gap : 0) + u.span
      if (line.length && width + add > opts.maxW) { lines.push([u]); width = u.span }
      else { line.push(u); width += add }
    }
    const last = size - 2 < opts.min
    if (!fits && !last) continue
    if (lines.length > opts.maxLines && !last) continue
    const rubyH = ruby ? size * 0.4 * 1.3 : 0
    const ruleGap = opts.rules ? size * 0.22 : size * 0.12
    const romH = opts.romaji ? Math.max(size * 0.3, FS.sm * 0.9) * 1.5 : 0
    const lineH = rubyH + size + ruleGap + romH
    const lineGap = size * 0.32
    if (lines.length * lineH + (lines.length - 1) * lineGap > opts.maxH && !last) continue
    return {
      ...opts, list, lines, size, f, rf, romF, gap, rubyH, ruleGap, romH, lineH, lineGap,
      h: lines.length * lineH + (lines.length - 1) * lineGap,
      lineW: line => line.reduce((w, u, i) => w + u.span + (i ? gap : 0), 0),
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
    for (const u of line) {
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
      at += u.span + L.gap
    }
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
  const b = fit(ctx, str, { sizes: [FS.heading, FS.display * 0.6], maxW: fr.w, maxLines: 1 })
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

// ── Shared slides: the strokes, the twist, the mark ───────────
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

function kanjiSlide(ctx, m, p, fr, { title, ink = p.ink, ink2 = p.ink2, cell = p.surfaceLine, panel = null }) {
  const k = m.kanji
  let y = fr.y
  y += heading(ctx, p, fr, title, y, ink) + SP[6]
  const n = k.s.d.length
  // The character, every stroke numbered where KanjiVG sets its number.
  const big = Math.min(fr.w * 0.52, fr.h * 0.4)
  ctx.save()
  ctx.translate(fr.x, y)
  ctx.scale(big / 109, big / 109)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3.2
  ctx.strokeStyle = ink
  k.s.d.forEach(d => ctx.stroke(new Path2D(d)))
  ctx.restore()
  if (k.s.n.length === n) {
    const nf = font(700, Math.max(big * 0.065, FS.xs), 'latin')
    k.s.n.forEach(([nx, ny], i) => text(ctx, String(i + 1), fr.x + nx * big / 109, y + ny * big / 109, { f: nf, color: p.line.kanji }))
  }
  // Beside it: the count, its readings, its meaning.
  const ix = fr.x + big + SP[7]
  const iw = fr.right - ix
  let iy = y + SP[3]
  const figF = font(700, FS.display * 1.1, 'latin')
  ctx.font = figF
  text(ctx, String(n), ix, iy + FS.display * 0.9, { f: figF, color: p.line.kanji })
  iy += FS.display * 1.05
  caption(ctx, m.t.strokes(n).replace(/^\d+\s*/, ''), ix, iy + FS.caption, ink2)
  iy += FS.caption + SP[6]
  const rf = font(500, FS.title, 'jp')
  for (const on of k.on.slice(0, 1)) {
    if (iy > y + big) break
    text(ctx, on, ix, iy + FS.title * 0.9, { f: rf, color: ink, tr: TR.term })
    iy += FS.title * 1.35
  }
  for (const [stem, oku] of k.kun.slice(0, 1)) {
    if (iy > y + big) break
    const w = text(ctx, stem, ix, iy + FS.title * 0.9, { f: rf, color: ink, tr: TR.term })
    if (oku) text(ctx, oku, ix + w + TR.term * FS.title, iy + FS.title * 0.9, { f: rf, color: ink2, tr: TR.term })
    iy += FS.title * 1.35
  }
  iy += SP[3]
  const meaning = ((m.lang === 'fr' && k.fr.length ? k.fr : k.en) || []).slice(0, 2).join(', ')
  // The meaning in what is left beside the character, never over the grid.
  const left = y + big - iy
  if (meaning && left >= FS.lead * 1.1) {
    const b = fit(ctx, weldIf(m.lang, meaning), { sizes: [FS.title, FS.lead, FS.body], maxW: iw, maxLines: 2, maxH: left, balanced: false })
    paragraph(ctx, b, ix, iy, ink)
  }
  y += big + SP[7]
  // The order, one box a stroke, as a practice sheet prints it.
  const room = fr.bottom - y
  const cols = n <= 8 ? n : n <= 16 ? Math.ceil(n / 2) : Math.ceil(n / 3)
  const rows = Math.ceil(n / cols)
  const gap = SP[2]
  const size = Math.min((fr.w - gap * (cols - 1)) / cols, (room - gap * (rows - 1)) / rows, fr.w / 5)
  const gridW = cols * size + (cols - 1) * gap
  const gx = fr.x + (fr.w - gridW) / 2
  for (let i = 0; i < n; i++) {
    const cx = gx + (i % cols) * (size + gap)
    const cy = y + Math.floor(i / cols) * (size + gap)
    ctx.save()
    if (panel) { ctx.fillStyle = panel; rrect(ctx, cx, cy, size, size, R.card); ctx.fill() }
    ctx.strokeStyle = cell
    ctx.lineWidth = 2
    rrect(ctx, cx + 1, cy + 1, size - 2, size - 2, R.card)
    ctx.stroke()
    ctx.restore()
    strokeBox(ctx, k, cx + size * 0.08, cy + size * 0.08, size * 0.84, i, p.line.kanji, ink2, null)
  }
}

function twistSlide(ctx, m, p, fr, { title, ink = p.ink, ink2 = p.ink2, card = null }) {
  const tw = m.twist
  let y = fr.y
  y += heading(ctx, p, fr, title, y, ink) + SP[4]
  const notion = weldIf(m.lang, tw.notion[m.lang] || tw.notion.en || '')
  caption(ctx, notion, fr.x, y + FS.caption, p.line.grammar)
  y += FS.caption + SP[8]
  const forms = tw.pair
  const sizes = [FS.word, FS.display * 1.4, FS.display * 1.2, FS.display, FS.heading]
  let size = sizes[sizes.length - 1]
  for (const s of sizes) {
    if (forms.every(f => measure(ctx, f, font(700, s, 'serif')) <= fr.w)) { size = s; break }
  }
  const f = font(700, size, 'serif')
  const block = forms.length * size * 1.15 + size * 0.9
  let fy = y
  if (card) { ctx.fillStyle = card; rrect(ctx, fr.x - SP[6], y - SP[5], fr.w + SP[6] * 2, block + SP[5] * 2, R.panel); ctx.fill() }
  text(ctx, forms[0], fr.x, fy + size * ASC, { f, color: ink2 })
  fy += size * 1.15
  // The turn from one to the other: the grammar line's arrow, down.
  ctx.save()
  ctx.translate(fr.x + size * 0.45, fy + size * 0.1)
  ctx.rotate(Math.PI / 2)
  chevron(ctx, 0, 0, size * 0.6, p.line.grammar)
  ctx.restore()
  fy += size * 0.9
  text(ctx, forms[1], fr.x, fy + size * ASC, { f, color: ink })
  y = fy + size * 1.15 + SP[7]
  const why = weldIf(m.lang, tw.why[m.lang] || tw.why.en || '')
  if (why) {
    const b = fit(ctx, why, { weight: 500, sizes: [FS.title, FS.lead, FS.body], maxW: fr.w, maxLines: Math.max(2, Math.floor((fr.bottom - y) / (FS.lead * 1.3))), balanced: false })
    paragraph(ctx, b, fr.x, y, ink2, 'left', 1.3)
  }
}

function outroSlide(ctx, m, p, fr, ink = p.ink, ink2 = p.ink2) {
  const size = Math.min(fr.w * 0.42, fr.h * 0.3)
  const nameF = font(700, FS.display, 'latin')
  const line = fit(ctx, m.t.outro, { sizes: [FS.heading, FS.title], maxW: fr.w * 0.9, maxLines: 3 })
  const total = size + SP[7] + FS.display + SP[6] + paragraphH(line) + (m.handle ? SP[7] + FS.title : 0)
  let y = fr.y + (fr.h - total) / 2
  mark(ctx, fr.cx - size / 2, y, size, ink, p.gold)
  y += size + SP[7]
  text(ctx, 'Tsuji', fr.cx, y + FS.display * 0.8, { f: nameF, color: ink, align: 'center' })
  y += FS.display + SP[6]
  y += paragraph(ctx, line, fr.cx, y, ink2, 'center')
  if (m.handle) text(ctx, m.handle, fr.cx, y + SP[7] + FS.title * 0.8, { f: font(700, FS.title, 'latin'), color: p.gold, align: 'center' })
}

// ── A · 駅名標, the station plates ─────────────────────────────
const plates = {
  hook(ctx, m, p, fr) {
    ground(ctx, p, fr)
    masthead(ctx, p, fr)
    roundel(ctx, fr.right - 46, fr.y + 32, 46, p.line.reading, m.s.lv, { ink: p.ink, size: FS.lead })
    const pill = 44 * K
    const top = fr.y + 64 + SP[8]
    const room = fr.bottom - pill - SP[8] - top
    const prompt = fit(ctx, m.t.prompt.plates, { sizes: [FS.title, FS.lead], maxW: fr.w * 0.9, maxLines: 2 })
    const L = layoutSentence(ctx, m, { max: FS.word * 0.8, min: FS.title, maxW: fr.w, maxH: room - paragraphH(prompt) - SP[8], romaji: m.showRomaji })
    const total = L.h + SP[8] + paragraphH(prompt)
    let y = top + Math.max(0, (room - total) / 2)
    drawSentence(ctx, L, fr.cx, y, 'center', u => ({ ink: p.ink, rule: lineOf(p, u.row), romaji: p.ink2, ruby: p.ink2 }))
    y += L.h + SP[8]
    paragraph(ctx, prompt, fr.cx, y, p.ink2, 'center')
    metal(ctx, p, fr.cx, fr.bottom - pill, m.t.next)
  },
  words(ctx, m, p, fr, list, page, pages_) {
    ground(ctx, p, fr)
    let y = fr.y
    y += heading(ctx, p, fr, m.t.words, y)
    pageMark(ctx, p, fr, page, pages_, fr.y + FS.heading * 0.8, p.ink2)
    y += SP[6]
    const gap = SP[4]
    const h = Math.min((fr.bottom - y - gap * (list.length - 1)) / list.length, 250)
    for (const w of list) {
      plate(ctx, m, p, fr.x, y, fr.w, h, w)
      y += h + gap
    }
  },
  grammar(ctx, m, p, fr) {
    ground(ctx, p, fr)
    transferSlide(ctx, m, p, fr, { ink: p.ink, ink2: p.ink2 })
  },
  answer(ctx, m, p, fr) {
    ground(ctx, p, fr)
    terminusSlide(ctx, m, p, fr, { ink: p.ink, ink2: p.ink2 })
  },
  kanji(ctx, m, p, fr) {
    ground(ctx, p, fr)
    kanjiSlide(ctx, m, p, fr, { title: m.t.write })
  },
  twist(ctx, m, p, fr) {
    ground(ctx, p, fr)
    twistSlide(ctx, m, p, fr, { title: m.t.twist })
  },
  outro(ctx, m, p, fr) {
    ground(ctx, p, fr)
    outroSlide(ctx, m, p, fr)
  },
}

/** One word as a hanging 駅名標: its number in a ring, its reading spaced
 *  over its name, its romaji under it, its sense on the right, the line's
 *  stripe along its foot. */
function plate(ctx, m, p, x, y, w, h, word) {
  const color = word.grammar ? p.line.grammar : p.line.vocab
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
  // The stop's number.
  const r = Math.min(40, h * 0.17)
  roundel(ctx, x + pad + r, mid, r, color, String(m.words.indexOf(word) + 1), { ink: color, size: r * 0.95 })
  // The name, its reading spaced over it, its romaji under it.
  const nx = x + pad + r * 2 + SP[5]
  const leftW = w * 0.5 - (nx - x)
  const showReading = hasKanji(word.row.t)
  const rSize = FS.caption
  const above = showReading ? rSize * 1.15 : 0
  const below = FS.sm * 1.15
  let size = Math.min(ih - above - below, FS.display * 0.95)
  while (size > FS.lead && measure(ctx, word.row.t, font(700, size, 'serif')) > leftW) size -= 2
  let by = mid - (above + size + below) / 2
  if (showReading) {
    text(ctx, word.reading, nx, by + rSize * 0.92, { f: font(500, rSize, 'jp'), color: p.ink2, tr: TR.reading })
    by += above
  }
  text(ctx, word.row.t, nx, by + size * ASC, { f: font(700, size, 'serif'), color: p.ink })
  text(ctx, word.row.ro, nx, by + size + FS.sm * 0.95, { f: font(500, FS.sm, 'latin'), color: p.ink2 })
  // The sense, on the right, as large as the plate holds it.
  const rx = x + w - pad
  const rw = w * 0.46 - pad
  senseBlock(ctx, word, rx, mid, rw, ih, p.ink, p.ink2)
}

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

/** 乗換, the grammar point: where the sentence changes lines. Its
 *  pattern, what it means, its form, the catalogue's rule, and the
 *  sentence with the point's words lit when the slide still has room for
 *  it (it has been read twice already; the rule has not). */
function transferSlide(ctx, m, p, fr, { ink, ink2, board = false }) {
  const pt = m.point
  let y = fr.y
  if (!board) y += heading(ctx, p, fr, m.t.transfer, y, ink) + SP[6]
  else { caption(ctx, m.t.transfer, fr.x, y + FS.caption, ink2); y += FS.caption + SP[7] }
  const pattern = m.s.p
  const short = [...pattern].length <= 2
  const meaningText = weldIf(m.lang, pt?.[m.lang] || pt?.en || '')
  // The pattern: a single marker in the grammar line's ring, a longer
  // pattern on the line's rule.
  let ps = short ? FS.display * 1.3 : FS.display * 1.1
  const pf = () => font(700, ps, 'serif')
  while (ps > FS.heading && measure(ctx, pattern, pf()) > fr.w * (short ? 0.4 : 1)) ps -= 4
  const r = ps * 0.75
  const mx = short ? fr.x + r * 2 + SP[7] : fr.x
  const meaning = fit(ctx, meaningText, { sizes: [FS.heading, FS.title, FS.lead], maxW: fr.right - mx, maxLines: 3 })
  const headH = short ? Math.max(r * 2, paragraphH(meaning)) : ps * 1.02 + EDGE + SP[6] + paragraphH(meaning)
  const form = formOf(pt, m.lang)
  const formH = form ? FS.lead * 2 : 0
  const room = fr.bottom - y - headH - SP[7] - (form ? formH + SP[7] : 0)
  const rule = pt?.rule?.[m.lang] || pt?.rule?.en
  const ruleB = rule && room > FS.body * 2.4
    ? fit(ctx, weldIf(m.lang, rule), { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: fr.w, maxH: room, lh: 1.32, balanced: false })
    : null
  const ruleH = ruleB ? paragraphH(ruleB, 1.32) : 0
  const left = room - ruleH - (ruleB ? SP[7] : 0)
  let L = left >= FS.lead * 1.5
    ? layoutSentence(ctx, m, { max: FS.display * 0.85, min: FS.lead, maxW: fr.w, maxLines: 3, maxH: left, romaji: false })
    : null
  if (L && L.h > left) L = null
  const used = headH + SP[7] + (form ? formH + SP[7] : 0) + (L ? L.h + SP[7] : 0) + ruleH
  y += Math.max(0, (fr.bottom - y - used) * 0.3)

  if (short) {
    roundel(ctx, fr.x + r, y + headH / 2, r, p.line.grammar, pattern, { ink, fam: 'serif', size: ps })
    paragraph(ctx, meaning, mx, y + headH / 2 - paragraphH(meaning) / 2, ink)
  } else {
    text(ctx, pattern, fr.x, y + ps * ASC, { f: pf(), color: ink })
    ctx.fillStyle = p.line.grammar
    ctx.fillRect(fr.x, y + ps * 1.02, Math.min(measure(ctx, pattern, pf()), fr.w), EDGE)
    paragraph(ctx, meaning, fr.x, y + ps * 1.02 + EDGE + SP[6], ink)
  }
  y += headH + SP[7]
  // Its form, as a pill: a ring, never a fill.
  if (form) {
    const fb = fit(ctx, form, { sizes: [FS.lead, FS.body, FS.sm], maxW: fr.w - SP[6] * 2, maxLines: 1, balanced: false })
    const fw = measure(ctx, fb.lines[0], fb.f) + SP[6] * 2
    ctx.strokeStyle = p.line.grammar
    ctx.lineWidth = RING
    rrect(ctx, fr.x + RING / 2, y + RING / 2, fw - RING, formH - RING, formH / 2)
    ctx.stroke()
    text(ctx, fb.lines[0], fr.x + SP[6], y + formH / 2 + fb.size * 0.36, { f: fb.f, color: ink })
    y += formH + SP[7]
  }
  // The sentence, the point's words lit and the rest set back.
  if (L) {
    const lit = new Set(m.s.rows.map((row, i) => ((row.g || []).includes(m.s.p) ? i : -1)).filter(i => i >= 0))
    drawSentence(ctx, L, fr.x, y, 'left', u => ({ ink: lit.has(u.i) ? ink : ink2, rule: lit.has(u.i) ? p.line.grammar : null, ruby: ink2 }))
    y += L.h + SP[7]
  }
  if (ruleB) paragraph(ctx, ruleB, fr.x, y, ink2, 'left', 1.32)
}

/** 終点, the answer: what the sentence says, then the sentence read and
 *  its romaji in the room the translation leaves. The translation is the
 *  payoff of the post, so it is set first and never cut. */
function terminusSlide(ctx, m, p, fr, { ink, ink2, board = false }) {
  let y = fr.y
  if (!board) y += heading(ctx, p, fr, m.t.terminus, y, ink) + SP[7]
  else { caption(ctx, m.t.arrived, fr.x, y + FS.caption, ink2); y += FS.caption + SP[7] }
  const room = fr.bottom - y
  const tr = fit(ctx, m.translation, { sizes: [FS.display, FS.display * 0.85, FS.heading, FS.title, FS.lead], maxW: fr.w, maxH: room * 0.42, lh: 1.1 })
  const ro = fit(ctx, m.romaji, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: fr.w, maxH: room * 0.2, balanced: false })
  const between = SP[5] + SP[8] + EDGE + SP[8]
  const L = layoutSentence(ctx, m, { max: FS.display * 1.05, min: FS.body, maxW: fr.w, maxLines: 4, maxH: room - paragraphH(tr, 1.1) - paragraphH(ro) - between, script: m.script === 'kana' ? 'kana' : 'furigana', romaji: false })
  const total = L.h + paragraphH(ro) + between + paragraphH(tr, 1.1)
  y += Math.max(0, (room - total) * 0.35)
  drawSentence(ctx, L, fr.x, y, 'left', u => ({ ink, rule: lineOf(p, u.row), ruby: ink2 }))
  y += L.h + SP[5]
  y += paragraph(ctx, ro, fr.x, y, ink2)
  y += SP[8]
  ctx.fillStyle = p.line.reading
  ctx.fillRect(fr.x, y, SP[9], EDGE)
  y += EDGE + SP[8]
  paragraph(ctx, tr, fr.x, y, ink, 'left', 1.1)
}

// ── B · 発車標, the departure board ────────────────────────────
// A sumi board hung on the ground, in either theme: the app's boards are
// the panel's ink on paper too.
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
const inBoard = (bx, by, bw, bh, padX = SP[7], padY = SP[7]) => ({
  x: bx + padX, y: by + padY, w: bw - padX * 2, h: bh - padY * 2, cx: bx + bw / 2, right: bx + bw - padX, bottom: by + bh - padY, W: bw, H: bh,
})

const board = {
  hook(ctx, m, p, fr) {
    ground(ctx, p, fr)
    masthead(ctx, p, fr)
    const pill = 44 * K
    const top = fr.y + 64 + SP[7]
    const bh = fr.bottom - pill - SP[8] - top
    boardPanel(ctx, p, fr.x, top, fr.w, bh)
    const hh = boardHead(ctx, p, fr.x, top, fr.w, m.t.departure, m.s.lv)
    const inner = inBoard(fr.x, top + hh, fr.w, bh - hh)
    const prompt = fit(ctx, m.t.prompt.board, { weight: 500, sizes: [FS.title, FS.lead], maxW: inner.w, maxLines: 2 })
    const L = layoutSentence(ctx, m, { max: FS.word * 0.75, min: FS.title, maxW: inner.w, maxH: inner.h - paragraphH(prompt) - SP[8], fam: 'jp', weight: 700, romaji: m.showRomaji })
    const total = L.h + SP[8] + paragraphH(prompt)
    let y = inner.y + Math.max(0, (inner.h - total) / 2)
    drawSentence(ctx, L, inner.cx, y, 'center', u => ({ ink: p.onPanel, rule: lineOf(p, u.row), romaji: p.onPanelSoft, ruby: p.onPanelSoft }))
    y += L.h + SP[8]
    paragraph(ctx, prompt, inner.cx, y, p.onPanelSoft, 'center')
    metal(ctx, p, fr.cx, fr.bottom - pill, m.t.next)
  },
  words(ctx, m, p, fr, list, page, pages_) {
    ground(ctx, p, fr)
    boardPanel(ctx, p, fr.x, fr.y, fr.w, fr.h)
    const hh = boardHead(ctx, p, fr.x, fr.y, fr.w, m.t.words, pages_ > 1 ? `${page}/${pages_}` : '')
    const cols = boardCols(fr)
    const capY = fr.y + hh + SP[5] + FS.xs
    m.t.columns.forEach((c, i) => c && caption(ctx, c, cols[i], capY, p.onPanelSoft, i === 2 ? 'right' : 'left', FS.xs))
    let y = capY + SP[4]
    const rowH = Math.min((fr.bottom - SP[5] - y) / list.length, 230)
    for (const w of list) {
      departure(ctx, m, p, fr, cols, y, rowH, w)
      y += rowH
    }
  },
  grammar(ctx, m, p, fr) {
    ground(ctx, p, fr)
    boardPanel(ctx, p, fr.x, fr.y, fr.w, fr.h)
    transferSlide(ctx, m, p, inBoard(fr.x, fr.y, fr.w, fr.h), { ink: p.onPanel, ink2: p.onPanelSoft, board: true })
  },
  answer(ctx, m, p, fr) {
    ground(ctx, p, fr)
    boardPanel(ctx, p, fr.x, fr.y, fr.w, fr.h)
    terminusSlide(ctx, m, p, inBoard(fr.x, fr.y, fr.w, fr.h), { ink: p.onPanel, ink2: p.onPanelSoft, board: true })
  },
  kanji(ctx, m, p, fr) {
    ground(ctx, p, fr)
    boardPanel(ctx, p, fr.x, fr.y, fr.w, fr.h)
    kanjiSlide(ctx, m, p, inBoard(fr.x, fr.y, fr.w, fr.h), { title: m.t.write, ink: p.onPanel, ink2: p.onPanelSoft, cell: p.panelLine })
  },
  twist(ctx, m, p, fr) {
    ground(ctx, p, fr)
    boardPanel(ctx, p, fr.x, fr.y, fr.w, fr.h)
    twistSlide(ctx, m, p, inBoard(fr.x, fr.y, fr.w, fr.h), { title: m.t.twist, ink: p.onPanel, ink2: p.onPanelSoft })
  },
  outro(ctx, m, p, fr) {
    ground(ctx, p, fr)
    outroSlide(ctx, m, p, fr)
  },
}

function boardCols(fr) {
  const x = fr.x + EDGE + SP[6]
  return [x, x + 96, fr.right - SP[6]]
}

/** One word as a departure: its number in the metal's figure, the word
 *  over its type and its reading, its sense where the destination goes. */
function departure(ctx, m, p, fr, cols, y, h, word) {
  const color = word.grammar ? p.line.grammar : p.line.vocab
  const mid = y + h / 2
  ctx.fillStyle = p.panelLine
  ctx.fillRect(fr.x, y, fr.w, 2)
  ctx.fillStyle = color
  ctx.fillRect(fr.x, y + SP[3], EDGE, h - SP[3] * 2)
  const n = m.words.indexOf(word) + 1
  text(ctx, String(n).padStart(2, '0'), cols[0], mid + FS.title * 0.36, { f: font(700, FS.title, 'latin'), color: p.gold })
  // The word, and under it its type in a ring of its line, then its reading.
  const ww = (cols[2] - cols[1]) * 0.5
  let size = Math.min(h * 0.36, FS.display * 0.8)
  while (size > FS.title && measure(ctx, word.row.t, font(700, size, 'jp')) > ww) size -= 2
  const tf = font(700, FS.xs, 'latin')
  const label = word.pos.toLocaleUpperCase()
  const tw = measure(ctx, label, tf, TR.caption) + SP[4] * 2
  const th = FS.xs * 1.9
  const block = size + SP[3] + th
  const wy = mid - block / 2
  text(ctx, word.row.t, cols[1], wy + size * ASC, { f: font(700, size, 'jp'), color: p.onPanel })
  const ty = wy + size + SP[3]
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  rrect(ctx, cols[1], ty, tw, th, R.card)
  ctx.stroke()
  text(ctx, label, cols[1] + tw / 2, ty + th / 2 + FS.xs * 0.36, { f: tf, color: p.onPanel, align: 'center', tr: TR.caption })
  const sub = hasKanji(word.row.t) ? word.reading : word.row.ro
  const subF = fit(ctx, sub, { weight: 500, sizes: [FS.sm, FS.caption, FS.xs], maxW: ww - tw - SP[4], maxLines: 1, balanced: false })
  text(ctx, subF.lines[0], cols[1] + tw + SP[4], ty + th / 2 + subF.size * 0.36, { f: subF.f, color: p.onPanelSoft })
  // The sense, where the destination goes.
  senseBlock(ctx, word, cols[2], mid, (cols[2] - cols[1]) * 0.46, h - SP[3] * 2, p.onPanel, p.onPanelSoft)
}

// ── C · 札, the study card ─────────────────────────────────────
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

const card = {
  hook(ctx, m, p, fr) {
    ground(ctx, p, fr)
    masthead(ctx, p, fr)
    const { ink, ink2 } = cardInk(p)
    const pill = 44 * K
    const prompt = fit(ctx, m.t.prompt.card, { sizes: [FS.title, FS.lead], maxW: fr.w * 0.9, maxLines: 2 })
    const top = fr.y + 64 + SP[7]
    const ch = fr.bottom - pill - SP[7] - paragraphH(prompt) - SP[7] - top
    studyCard(ctx, p, fr.x, top, fr.w, ch, p.line.reading)
    caption(ctx, `${m.s.lv}`, fr.x + SP[6], top + SP[6] + FS.caption, ink2)
    const inner = inBoard(fr.x, top, fr.w, ch, SP[7], SP[9])
    const L = layoutSentence(ctx, m, { max: FS.word * 0.8, min: FS.title, maxW: inner.w, maxH: inner.h, rules: false, gap: 0.08, romaji: m.showRomaji })
    drawSentence(ctx, L, inner.cx, inner.y + (inner.h - L.h) / 2, 'center', () => ({ ink, rule: null, romaji: ink2, ruby: ink2 }))
    paragraph(ctx, prompt, fr.cx, top + ch + SP[7], p.ink, 'center')
    metal(ctx, p, fr.cx, fr.bottom - pill, m.t.next)
  },
  words(ctx, m, p, fr, list, page, pages_) {
    ground(ctx, p, fr)
    const { ink, ink2 } = cardInk(p)
    studyCard(ctx, p, fr.x, fr.y, fr.w, fr.h, p.line.reading)
    const inner = inBoard(fr.x, fr.y, fr.w, fr.h, SP[7], SP[7])
    let y = inner.y
    // The card's back: the sentence it asked, small, then its words.
    const L = layoutSentence(ctx, m, { max: FS.display * 0.7, min: FS.lead, maxW: inner.w, maxLines: 2, script: m.script === 'kana' ? 'kana' : 'furigana', rules: false, gap: 0.06 })
    drawSentence(ctx, L, inner.x, y, 'left', () => ({ ink: ink2, rule: null, ruby: ink2 }))
    y += L.h + SP[6]
    pageMark(ctx, p, inner, page, pages_, inner.y + FS.lead * 0.8, ink2)
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(inner.x, y, inner.w, 2)
    y += SP[5]
    const rowH = Math.min((inner.bottom - y) / list.length, 220)
    for (const w of list) {
      cardRow(ctx, m, p, inner, y, rowH, w, ink, ink2)
      y += rowH
    }
  },
  grammar(ctx, m, p, fr) {
    ground(ctx, p, fr)
    const { ink, ink2 } = cardInk(p)
    studyCard(ctx, p, fr.x, fr.y, fr.w, fr.h, p.line.grammar)
    transferSlide(ctx, m, p, inBoard(fr.x, fr.y, fr.w, fr.h), { ink, ink2 })
  },
  answer(ctx, m, p, fr) {
    ground(ctx, p, fr)
    const { ink, ink2 } = cardInk(p)
    studyCard(ctx, p, fr.x, fr.y, fr.w, fr.h, p.line.reading)
    terminusSlide(ctx, m, p, inBoard(fr.x, fr.y, fr.w, fr.h), { ink, ink2 })
  },
  kanji(ctx, m, p, fr) {
    ground(ctx, p, fr)
    const { ink, ink2 } = cardInk(p)
    studyCard(ctx, p, fr.x, fr.y, fr.w, fr.h, p.line.kanji)
    kanjiSlide(ctx, m, p, inBoard(fr.x, fr.y, fr.w, fr.h), { title: m.t.write, ink, ink2 })
  },
  twist(ctx, m, p, fr) {
    ground(ctx, p, fr)
    const { ink, ink2 } = cardInk(p)
    studyCard(ctx, p, fr.x, fr.y, fr.w, fr.h, p.line.grammar)
    twistSlide(ctx, m, p, inBoard(fr.x, fr.y, fr.w, fr.h), { title: m.t.twist, ink, ink2 })
  },
  rating(ctx, m, p, fr) {
    ground(ctx, p, fr)
    const title = fit(ctx, m.t.rate, { sizes: [FS.display, FS.heading], maxW: fr.w, maxLines: 2 })
    const barH = 120 * K * 0.62
    const cta = fit(ctx, m.t.rateCta, { weight: 500, sizes: [FS.title, FS.lead], maxW: fr.w, maxLines: 2 })
    const total = paragraphH(title) + SP[8] + barH + SP[8] + paragraphH(cta) + SP[6] + FS.display
    let y = fr.y + (fr.h - total) / 2
    y += paragraph(ctx, title, fr.cx, y, p.ink, 'center') + SP[8]
    ratingBar(ctx, m, p, fr.x, y, fr.w, barH)
    y += barH + SP[8]
    y += paragraph(ctx, cta, fr.cx, y, p.ink2, 'center') + SP[6]
    ctx.save()
    ctx.translate(fr.cx, y)
    ctx.rotate(Math.PI / 2)
    chevron(ctx, 0, 0, FS.display * 0.6, p.gold)
    ctx.restore()
  },
  outro(ctx, m, p, fr) {
    ground(ctx, p, fr)
    outroSlide(ctx, m, p, fr)
  },
}

/** A row of the card's back: the word's line as a rail down its left. */
function cardRow(ctx, m, p, inner, y, h, word, ink, ink2) {
  const color = word.grammar ? p.line.grammar : p.line.vocab
  const mid = y + h / 2
  ctx.fillStyle = color
  rrect(ctx, inner.x, y + h * 0.16, EDGE, h * 0.68, EDGE / 2)
  ctx.fill()
  const x = inner.x + EDGE + SP[6]
  const ww = inner.w * 0.5
  let size = Math.min(h * 0.38, FS.display * 0.85)
  while (size > FS.title && measure(ctx, word.row.t, font(700, size, 'serif')) > ww) size -= 2
  const sub = hasKanji(word.row.t) ? `${word.reading} · ${word.row.ro}` : word.row.ro
  const block = size + SP[2] + FS.sm
  text(ctx, word.row.t, x, mid - block / 2 + size * ASC, { f: font(700, size, 'serif'), color: ink })
  text(ctx, sub, x, mid + block / 2 - FS.sm * 0.15, { f: font(500, FS.sm, 'latin'), color: ink2 })
  senseBlock(ctx, word, inner.right, mid, inner.w * 0.44, h - SP[2], ink, ink2)
}

/** The rating bar as the run docks it: sumi, four keys worst first, each
 *  its verdict's ink in the dot over its word. */
function ratingBar(ctx, m, p, x, y, w, h) {
  ctx.fillStyle = p.panel
  rrect(ctx, x, y, w, h, R.panel)
  ctx.fill()
  const n = 4
  const bw = w / n
  for (let i = 0; i < n; i++) {
    const bx = x + i * bw
    if (i) { ctx.fillStyle = p.panelLine; ctx.fillRect(bx, y + SP[4], 2, h - SP[4] * 2) }
    const cx = bx + bw / 2
    ctx.fillStyle = p.rating[i]
    ctx.beginPath()
    ctx.arc(cx, y + h * 0.27, 13, 0, Math.PI * 2)
    ctx.fill()
    const lf = fit(ctx, m.t.ratings[i], { sizes: [FS.lead, FS.body, FS.sm], maxW: bw - SP[3] * 2, maxLines: 1 })
    text(ctx, lf.lines[0], cx, y + h * 0.62, { f: lf.f, color: p.onPanel, align: 'center' })
    text(ctx, RATINGS_JP[i], cx, y + h * 0.86, { f: font(500, FS.caption, 'jp'), color: p.onPanelSoft, align: 'center' })
  }
}

// ── D · 模試, the mock exam ────────────────────────────────────
const exam = {
  hook(ctx, m, p, fr) {
    ground(ctx, p, fr)
    examQuestion(ctx, m, p, fr, false)
  },
  reveal(ctx, m, p, fr) {
    ground(ctx, p, fr)
    examQuestion(ctx, m, p, fr, true)
  },
  words(ctx, m, p, fr, list, page, pages_) {
    ground(ctx, p, fr)
    let y = fr.y
    y += heading(ctx, p, fr, m.t.words, y)
    pageMark(ctx, p, fr, page, pages_, fr.y + FS.heading * 0.8, p.ink2)
    y += SP[6]
    // The hairline lattice: the gap is the hairline.
    const rowH = Math.min((fr.bottom - y) / list.length, 230)
    const h = rowH * list.length
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(fr.x, y, fr.w, h)
    list.forEach((w, i) => {
      const ry = y + i * rowH
      ctx.fillStyle = p.surface
      ctx.fillRect(fr.x + 2, ry + 2, fr.w - 4, rowH - (i === list.length - 1 ? 4 : 2))
      latticeRow(ctx, m, p, fr, ry, rowH, w)
    })
  },
  grammar(ctx, m, p, fr) {
    ground(ctx, p, fr)
    transferSlide(ctx, m, p, fr, { ink: p.ink, ink2: p.ink2 })
  },
  answer(ctx, m, p, fr) {
    ground(ctx, p, fr)
    terminusSlide(ctx, m, p, fr, { ink: p.ink, ink2: p.ink2 })
  },
  kanji(ctx, m, p, fr) {
    ground(ctx, p, fr)
    kanjiSlide(ctx, m, p, fr, { title: m.t.write })
  },
  twist(ctx, m, p, fr) {
    ground(ctx, p, fr)
    twistSlide(ctx, m, p, fr, { title: m.t.twist })
  },
  outro(ctx, m, p, fr) {
    ground(ctx, p, fr)
    outroSlide(ctx, m, p, fr)
  },
}

function latticeRow(ctx, m, p, fr, y, h, word) {
  const color = word.grammar ? p.line.grammar : p.line.vocab
  const mid = y + h / 2
  const x = fr.x + SP[6]
  const n = m.words.indexOf(word) + 1
  roundel(ctx, x + 34, mid, 34, color, String(n), { ink: color, size: FS.lead })
  const wx = x + 68 + SP[5]
  let size = Math.min(h * 0.38, FS.display * 0.8)
  while (size > FS.title && measure(ctx, word.row.t, font(700, size, 'serif')) > fr.w * 0.4) size -= 2
  const sub = hasKanji(word.row.t) ? `${word.reading} · ${word.row.ro}` : word.row.ro
  const block = size + SP[2] + FS.sm
  text(ctx, word.row.t, wx, mid - block / 2 + size * ASC, { f: font(700, size, 'serif'), color: p.ink })
  text(ctx, sub, wx, mid + block / 2 - FS.sm * 0.15, { f: font(500, FS.sm, 'latin'), color: p.ink2 })
  senseBlock(ctx, word, fr.right - SP[6], mid, fr.w * 0.4, h - SP[4], p.ink, p.ink2)
}

/** The question as the paper sets it: もんだい, the instruction, the
 *  sentence with its word underlined (or its gap), four answers in a
 *  hairline lattice; revealed, the right one under the stamp. */
function examQuestion(ctx, m, p, fr, revealed) {
  const q = m.quiz
  const N3 = ['N3', 'N2', 'N1'].includes(m.s.lv)
  let y = fr.y
  // The paper's own head: もんだい at N5 and N4, 問題 above, as the JLPT prints it.
  const hs = FS.title * 1.1
  const hf = font(700, hs, 'serif')
  const hw = text(ctx, N3 ? '問題' : 'もんだい', fr.x, y + hs * ASC, { f: hf, color: p.ink })
  roundel(ctx, fr.x + hw + SP[4] + 32, y + hs * 0.46, 32, p.line.exam, '1', { ink: p.line.exam, size: FS.lead })
  caption(ctx, m.s.lv, fr.right, y + hs * 0.62, p.ink2, 'right')
  y += hs * 1.15 + SP[5]
  const askJp = fit(ctx, EXAM_ASK_JP[q.type], { weight: 500, fam: 'jp', sizes: [FS.lead, FS.body], maxW: fr.w, maxLines: 1, balanced: false })
  y += paragraph(ctx, askJp, fr.x, y, p.ink)
  const ask = fit(ctx, weldIf(m.lang, m.t.examAsk[q.type]), { weight: 500, sizes: [FS.body, FS.sm], maxW: fr.w, maxLines: 2, balanced: false })
  y += paragraph(ctx, ask, fr.x, y, p.ink2) + SP[7]
  // What the foot needs: the call to answer, or the answer explained.
  const cta = revealed ? null : fit(ctx, weldIf(m.lang, m.t.examCta), { sizes: [FS.title, FS.lead], maxW: fr.w, maxLines: 2 })
  const explain = revealed ? explanation(ctx, m, p, fr) : null
  const foot = cta ? paragraphH(cta) : explain.h
  // Four answers get a fixed share; the sentence takes what is left.
  const gridH = Math.max(fr.w * 0.34, Math.min(fr.w * 0.5, (fr.bottom - y) * 0.36))
  const room = fr.bottom - y - SP[7] - gridH - SP[7] - foot
  const L = layoutSentence(ctx, m, {
    max: FS.display * 1.1, min: FS.lead, maxW: fr.w, maxLines: 3, maxH: room, rules: true, gap: 0.08,
    blank: q.type === 'particle' && !revealed ? q.target : undefined,
  })
  y += Math.max(0, (room - L.h) / 2)
  drawSentence(ctx, L, fr.x, y, 'left', u => ({
    ink: p.ink, ruby: p.ink2,
    rule: u.i === q.target ? (revealed ? p.line.exam : q.type !== 'particle' ? p.ink : null) : null,
    ruleW: revealed ? EDGE : 4,
  }))
  y += L.h + Math.max(0, (room - L.h) / 2) + SP[7]
  // Four answers, two by two, the hairline between them.
  const HL = 3
  const cw = (fr.w - HL * 3) / 2
  const chh = (gridH - HL * 3) / 2
  ctx.fillStyle = p.surfaceLine
  ctx.fillRect(fr.x, y, fr.w, gridH)
  q.choices.forEach((c, i) => {
    const cx = fr.x + HL + (i % 2) * (cw + HL)
    const cy = y + HL + Math.floor(i / 2) * (chh + HL)
    ctx.fillStyle = p.surface
    ctx.fillRect(cx, cy, cw, chh)
    const right = i === q.right
    const dim = revealed && !right
    const r = 34
    roundel(ctx, cx + SP[5] + r, cy + chh / 2, r, dim ? p.surfaceLine : p.line.exam, String(i + 1), { ink: dim ? p.ink2 : p.line.exam, size: FS.lead })
    const tx = cx + SP[5] + r * 2 + SP[5]
    const tw = cx + cw - SP[4] - tx
    const fam = q.type === 'meaning' ? 'latin' : 'jp'
    const b = fit(ctx, q.type === 'meaning' ? weldIf(m.lang, c) : c, { weight: fam === 'jp' ? 500 : 700, fam, sizes: [FS.display * 0.62, FS.title, FS.lead, FS.body, FS.sm], maxW: tw, maxH: chh - SP[4], maxLines: 2, balanced: false })
    paragraph(ctx, b, tx, cy + chh / 2 - paragraphH(b) / 2, dim ? p.ink2 : p.ink)
    if (revealed && right) marked(ctx, p, cx + SP[5] + r, cy + chh / 2, r)
  })
  y += gridH + SP[7]
  if (cta) paragraph(ctx, cta, fr.x, y, p.ink)
  else explain.draw(y)
}

/** Under the revealed answer: the word, its reading and its sense. */
function explanation(ctx, m, p, fr) {
  const q = m.quiz
  const row = m.s.rows[q.target]
  const word = m.words.find(w => w.i === q.target)
  const sense = word ? word.main : ''
  const jp = q.type === 'particle' ? row.t : `${row.t}\u3000${reading(row)}`
  const b = fit(ctx, sense, { sizes: [FS.title, FS.lead], maxW: fr.w - 160, maxLines: 2 })
  const h = FS.display * 0.75 + SP[3] + paragraphH(b)
  return {
    h,
    draw(y) {
      text(ctx, jp, fr.x, y + FS.display * 0.62, { f: font(700, FS.display * 0.7, 'serif'), color: p.ink })
      paragraph(ctx, b, fr.x, y + FS.display * 0.75 + SP[3], p.ink2)
      stamp(ctx, p, fr.right - 66, y + h / 2, 66)
    },
  }
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

// ── The directions and their decks ────────────────────────────
export const DIRECTIONS = [
  { id: 'plates', jp: '駅名標', name: { en: 'Station plates', fr: 'Plaques de gare' }, draw: plates },
  { id: 'board', jp: '発車標', name: { en: 'Departure board', fr: 'Tableau des départs' }, draw: board },
  { id: 'card', jp: '札', name: { en: 'Study card', fr: 'Carte d’étude' }, draw: card },
  { id: 'exam', jp: '模試', name: { en: 'Mock exam', fr: 'Examen blanc' }, draw: exam },
]

/** The slides a direction deals for a sentence: [{ key, draw(ctx) }]. */
export function deck(direction, m, fmt, opts) {
  const d = DIRECTIONS.find(x => x.id === direction) ?? DIRECTIONS[0]
  const D = d.draw
  const fr = frame(fmt)
  const p = palette(opts.ground)
  const per = fmt.id === 'story' ? 6 : 5
  const slides = []
  const add = (key, fn) => slides.push({ key, draw: ctx => { noShadow(ctx); fn(ctx) } })
  add('hook', ctx => D.hook(ctx, m, p, fr))
  if (D.reveal) add('reveal', ctx => D.reveal(ctx, m, p, fr))
  if (opts.slides.words) {
    const ps = pages(m.words, per)
    ps.forEach((list, i) => add(`words-${i + 1}`, ctx => D.words(ctx, m, p, fr, list, i + 1, ps.length)))
  }
  if (opts.slides.grammar && m.point) add('grammar', ctx => D.grammar(ctx, m, p, fr))
  add('answer', ctx => D.answer(ctx, m, p, fr))
  if (opts.bonus === 'kanji' && m.kanji?.s) add('kanji', ctx => D.kanji(ctx, m, p, fr))
  if (opts.bonus === 'twist' && m.twist) add('twist', ctx => D.twist(ctx, m, p, fr))
  if (D.rating && opts.slides.rating) add('rating', ctx => D.rating(ctx, m, p, fr))
  if (opts.slides.outro) add('outro', ctx => D.outro(ctx, m, p, fr))
  return slides
}

/** Every string a deck may set, for the font loader to ask for. */
export function sampleText(m) {
  const t = m.t
  const parts = [m.s.jp, m.translation, m.romaji, Object.values(t.prompt).join(''), t.next, t.words, t.transfer, t.terminus,
    t.write, t.twist, t.rate, t.rateCta, t.ratings.join(''), RATINGS_JP.join(''), Object.values(EXAM_ASK_JP).join(''),
    Object.values(t.examAsk).join(''), t.examCta, t.outro, t.columns.join(''), t.departure, t.arrived, Object.values(t.pos).join(''),
    '問題もんだい正解0123456789/·（　）＿', m.handle, 'Tsuji']
  for (const w of m.words) parts.push(w.main, w.sub, w.reading, w.row.t, w.row.ro)
  for (const r of m.s.rows) for (const [, rd] of r.fu || []) parts.push(rd)
  if (m.point) parts.push(m.s.p, m.point.form, m.point[m.lang] || m.point.en, m.point.rule?.[m.lang] || '', m.point.rule?.en || '')
  if (m.twist) parts.push(...m.twist.pair, m.twist.notion[m.lang] || '', m.twist.why[m.lang] || '')
  if (m.kanji) parts.push(m.kanjiChar, ...m.kanji.on, ...m.kanji.kun.flat(), ...m.kanji.en, ...m.kanji.fr)
  parts.push(...m.quiz.choices)
  return [...new Set(parts.join(''))].join('')
}
