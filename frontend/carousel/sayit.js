// ── 言ってみて — say it in Japanese (plan 311, drawn for the canvas) ──────
// The reading challenge turned round: a sentence in the viewer's own
// language over the print, a countdown to say it in Japanese out loud,
// then the app's reader says it and it is written, word by word as it is
// said, with the same sentence in the other register beside it (polite
// where it is plain, plain where it is polite: the translation never says
// which, so either is right). Four or more sentences of a level, growing
// longer; the last is left to the comments, as the reading challenge's
// question is (plan 275). It ends on the app's own exercise of the same
// name (Translation, "Say it in Japanese": read, say it, the tutor).
//
// Drawn before it is built (CLAUDE.md, "A redesign is drawn before it is
// built"): four ways of helping the viewer while the countdown runs are
// drawn here for the owner to pick from, and nothing else in the studio
// reaches this file yet.
//   blank  白紙  the sentence alone: say it before the ring runs out.
//   clues  手掛  halfway through, its words come, each a card, in no order.
//   frame  骨組  its frame from the start: the particles and the endings
//                printed, a blank for each word with what it means under it.
//   steps  三段  all three in turn: the sentence alone, then its words,
//                then its frame; say it before the help comes.
//
// It stands on the reading bank (bank/N5.json …): each row carries its
// translation, its words with their furigana, romaji and senses, and the
// sentence in the other register (`v`, plain_polite.other_register's).
// It reuses the reading challenge's ground, look and timing (challenge.js):
// the print of the hour and its dials (`challenge.*` in tune.js), the
// read-along's panel, its words lit on the voice.
import { ASC, FORMATS, FS, METAL_H, R, SP, address, alpha, drawSentence, fit, font, frame, layoutSentence, measure, palette, paragraph, paragraphH, rrect, text } from './draw.js'
import { PRINT_SEASONS, printPlate } from './app.js'
import { backdrop } from './backdrop.js'
import { MASTHEAD, drawMasthead, glowMasthead } from './cover.js'
import { HOURS, alongPanel, chipShown, inksOf, moraeOf, wordTimes } from './challenge.js'
import { SCENERY_IDS } from './sceneries.js'
import { seeded, shuffle } from './common.js'
import { SITE } from './strings.js'

export const STYLES = ['blank', 'clues', 'frame', 'steps']
export const LOOKS = ['dark', 'paper']
// The cover, the video's first frame and its thumbnail (the owner's note
// on the first canvas: "I don't like how the first frame looks"): the
// reading challenge's title slip, or one of four drawn in its place.
//   slip      the reading challenge's cover, as first drawn
//   straight  直行  no cover: the first sentence from frame 0, the hook in its empty box
//   poster    大書  the first sentence large over the print, 日本語で？ under it
//   board     発車標  the five sentences as a departure board, the fifth ？？？
//   bubbles   吹き出し  the sentence in a bubble, an empty Japanese one answering it
export const COVERS = ['slip', 'straight', 'poster', 'board', 'bubbles']
// Readings over the kanji, and romaji under the words, where a learner of the level still needs them.
const RUBY = new Set(['N5', 'N4', 'N3'])
const ROMAJI = new Set(['N5', 'N4'])
// The voice slows for the first two levels, as a card's slow line does.
const SLOW = new Set(['N5', 'N4'])

// The beats, in seconds. A turn: the sentence comes in (`in`), the
// countdown (`think`; `steps` takes longer, its help in two stages), the
// voice a moment after it (`lead`), the sentence held once said (`hold`),
// the other register (`also`), and the turn going (`out`).
export const SY = {
  hook: 3.2, in: 0.7, think: 6, steps: 9, lead: 0.35, hold: 0.9, also: 2.4, out: 0.5,
  // The last sentence, left to the comments, held this long once the ring is out.
  ask: 3.6, cta: 6.5,
}
// When the help comes, as a share of the countdown.
const HELP = { clues: [0.5, null], steps: [1 / 3, 2 / 3], frame: [null, 0], blank: [null, null] }

const LIGHT = '#f3ecdf'
const GOLD = '#e6bd62'
const RUBY_INK = '#f1d08a'
const PAPER = palette('paper')
const SUMI = palette('sumi')
const HONYAKU = { dark: SUMI.line.honyaku }
const LOOK = {
  dark: { ground: 'sumi', ink: LIGHT, soft: alpha(LIGHT, 0.72), lit: GOLD, ruby: RUBY_INK, ring: GOLD, track: alpha(LIGHT, 0.22), card: 'rgba(243,236,223,0.08)', cardLine: alpha(LIGHT, 0.24), line: '#8da3e0', shadow: true },
}
/** The look a plan is drawn in: light on the darkened print (as read
 *  along), or the paper's inks on the print washed (as the scroll). */
function lookOf(plan) {
  if (plan.look !== 'paper') return LOOK.dark
  const T = inksOf(plan)
  return { ...T, ground: 'paper', lit: PAPER.line.honyaku, ruby: T.ruby, ring: PAPER.gold, card: alpha(PAPER.card, 0.9), cardLine: PAPER.surfaceLine, line: PAPER.line.honyaku, shadow: false }
}

const W = {
  en: {
    hook: 'Can you say it in Japanese?',
    title: 'Say it before the voice does',
    chip: (lv, n, s) => `JLPT ${lv} · ${n} sentences · ${s} s each`,
    ask: 'Say it in Japanese',
    out: 'Out loud',
    help: { clues: 'Help · its words', frame: 'Help · its frame' },
    also: { plain: 'Also right, among friends', polite: 'Also right, politely' },
    yours: ['Your turn', 'Write it in the comments', 'kana, kanji or romaji'],
    voice: 'Voice · VOICEVOX Nemo',
    cta: 'Now write it in the app',
    ctaLine: 'A reference answer, and the tutor’s read on yours',
    station: 'Say it in Japanese',
    stops: ['Read', 'Say it', 'Tutor'],
    verdict: 'Correct',
    reference: 'Reference',
    boardHook: 'Can you say these in Japanese?',
    inComments: 'in the comments',
    yourLang: 'In English',
  },
  fr: {
    hook: 'Tu sais le dire en japonais ?',
    title: 'Dis-le avant la voix',
    chip: (lv, n, s) => `JLPT ${lv} · ${n} phrases · ${s} s chacune`,
    ask: 'Dis-le en japonais',
    out: 'À voix haute',
    help: { clues: 'Aide · ses mots', frame: 'Aide · sa charpente' },
    also: { plain: 'Juste aussi, entre amis', polite: 'Juste aussi, poliment' },
    yours: ['À toi', 'Écris-la en commentaire', 'en kana, en kanji ou en romaji'],
    voice: 'Voix · VOICEVOX Nemo',
    cta: 'Maintenant, écris-la dans l’app',
    ctaLine: 'Une réponse de référence, et l’avis du tuteur sur la tienne',
    station: 'Dis-le en japonais',
    stops: ['Lis', 'Dis-le', 'Tuteur'],
    verdict: 'Correct',
    reference: 'Référence',
    boardHook: 'Tu sais les dire en japonais ?',
    inComments: 'en commentaire',
    yourLang: 'En français',
  },
}
const quoted = (lang, s) => (lang === 'fr' ? `« ${s} »` : `“${s}”`)
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
const clamp = x => Math.min(1, Math.max(0, x))
const smooth = x => { const k = clamp(x); return k * k * (3 - 2 * k) }

// ── The words a sentence is said with ──
const KANA = /^[ぁ-ゟ゠-ヿ]+$/u
/** A word in its dictionary form, as a clue gives it: a verb or an
 *  adjective said otherwise in the sentence (会います → 会う), its kanji
 *  read by what its reading has over its kana ending; any other word as
 *  the sentence writes it. */
function dictionaryForm(row) {
  const [lemma, kana] = row.lemma || []
  if (!lemma || !kana || !['verb', 'adjective'].includes(row.pos) || lemma === row.t) return { t: row.t, fu: row.fu || null }
  let n = 0
  while (n < lemma.length && n < kana.length && lemma.at(-1 - n) === kana.at(-1 - n) && KANA.test(lemma.at(-1 - n))) n++
  const stem = lemma.slice(0, lemma.length - n)
  const fu = KANA.test(stem) ? null : [[stem, kana.slice(0, kana.length - n)], ...(n ? [[lemma.slice(-n), '']] : [])]
  return { t: lemma, fu }
}
/** A sense cut to its first part, as a clue or a blank says it. */
const shortSense = s => (s || '').split(/[,;]/)[0].replace(/\s*\([^)]*\)\s*/g, ' ').trim()
/** Whether a row is a word the viewer must find, a clue and a blank: a
 *  word of the deck, but never the negative ない after a verb or an
 *  adjective (行きたく + ない), which is the form, not a word. */
function isClue(rows, i) {
  const r = rows[i]
  if (r.k !== 'word') return false
  if (r.t === 'ない' && i > 0 && ['verb', 'adjective'].includes(rows[i - 1].pos)) return false
  return !!(r.en?.length || r.fr?.length)
}

/** A video of sentences of the reading bank (`bank`, a level's file, as
 *  bank/N5.json): `ids` in their order, the last left to the comments
 *  unless `show`. */
export function sayitPlan(bank, ids, opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en'
  const style = STYLES.includes(opts.style) ? opts.style : 'steps'
  const look = LOOKS.includes(opts.look) ? opts.look : 'dark'
  const hour = HOURS.includes(opts.hour) ? opts.hour : 'day'
  const season = PRINT_SEASONS.includes(opts.season) ? opts.season : null
  const scenery = SCENERY_IDS.includes(opts.scenery) ? opts.scenery : 'bay'
  const cover = COVERS.includes(opts.cover) ? opts.cover : 'slip'
  const items = ids.map(id => {
    const s = bank.sentences.find(x => x.id === id)
    if (!s) throw new Error(`sayit: no sentence ${id}`)
    const clues = s.rows.map((r, i) => (isClue(s.rows, i) ? i : -1)).filter(i => i >= 0)
    return {
      id: s.id, rows: s.rows, jp: s.jp, tr: s[lang] || s.en, p: s.p,
      // The other register, where the sentence has one.
      v: s.v ? { to: s.v.to, rows: s.v.rows, into: s.v.into?.[0] || '' } : null,
      blanks: clues,
      // The clue cards, in an order of their own, never the sentence's.
      clues: shuffle(clues, seeded(`sayit|${s.id}`)).map(i => {
        const r = s.rows[i]
        return { i, ...dictionaryForm(r), ro: r.ro, sense: shortSense((r[lang] || r.en || [])[0]) }
      }),
    }
  })
  const lv = bank.level || items[0]?.id.split('.')[0] || 'N5'
  return {
    source: 'sayit', id: ids.join('+'), lang, lv, style, look, cover, hour, season, scenery, photo: null, items,
    hidden: opts.show !== true, tune: opts.tune || {},
    ruby: RUBY.has(lv), romaji: ROMAJI.has(lv), slow: SLOW.has(lv),
  }
}

/** The lines the reader says: each sentence revealed. */
export function sayitCues(plan) {
  return plan.items.filter((_, i) => !(plan.hidden && i === plan.items.length - 1)).map(it => ({ text: it.jp, who: 'reader', slow: plan.slow, marks: true }))
}

/** How long the countdown runs, in seconds. */
export const thinkOf = plan => (plan.style === 'steps' ? SY.steps : SY.think)
/** How long the cover holds before the first sentence: none when the video opens straight on it. */
export const hookOf = plan => (plan.cover === 'straight' ? 0 : SY.hook)

/** The video, timed. `voiced(cue)` gives a voiced line's { dur, marks }
 *  once the engine has said it; without it a line is timed on a guess. */
export function sayitTimeline(plan, voiced = null) {
  const segs = []
  const hookDur = hookOf(plan)
  const sfx = hookDur ? [{ at: 0.15, key: 'board-flap' }] : []
  const cues = []
  const turns = []
  let t = 0
  const seg = (key, start, dur) => segs.push({ key, start: +start.toFixed(3), dur: +dur.toFixed(3) })
  if (hookDur) seg('hook', 0, hookDur)
  t = hookDur
  const think = thinkOf(plan)
  const last = plan.items.length - 1
  let readingEnd = t
  plan.items.forEach((it, i) => {
    const start = t
    const ring = start + SY.in
    sfx.push({ at: +(start + 0.05).toFixed(3), key: 'card-transition', gain: 0.6 })
    for (let k = 0; k < think; k++) sfx.push({ at: +(ring + k).toFixed(3), key: 'click', gain: 0.35 })
    const [a, b] = HELP[plan.style]
    const help = [a, b].map(x => (x == null ? null : +(ring + x * think).toFixed(3)))
    const told = ring + think
    if (plan.hidden && i === last) {
      t = told + SY.ask
      turns.push({ i, start: +start.toFixed(3), ring: +ring.toFixed(3), help, told: +told.toFixed(3), hidden: true, end: +t.toFixed(3) })
      sfx.push({ at: +told.toFixed(3), key: 'card-transition' })
      return
    }
    const cue = { text: it.jp, who: 'reader', slow: plan.slow, marks: true }
    const v = voiced?.(cue)
    // A guess: the engine's pace, about 0.15 s a syllable (0.18 slowed), its pauses and pads.
    const guess = 0.25 + it.rows.reduce((n, r) => n + moraeOf(r), 0) * (plan.slow ? 0.18 : 0.15) + it.rows.filter(r => r.t === '、').length * 0.25
    const dur = v?.dur ?? guess
    const at = told + SY.lead
    cues.push({ ...cue, at: +at.toFixed(3) })
    const also = at + dur + SY.hold
    t = also + (it.v ? SY.also : 0) + SY.out
    turns.push({
      i, start: +start.toFixed(3), ring: +ring.toFixed(3), help, told: +told.toFixed(3), voice: +at.toFixed(3), dur: +dur.toFixed(3),
      words: wordTimes(it.rows, at, dur, v?.marks).map(x => +x.toFixed(3)), also: it.v ? +also.toFixed(3) : null, end: +t.toFixed(3),
    })
    readingEnd = t
  })
  // The ground's clock, as the reading challenge's: the sentences said are
  // its reading (the train crossing, the print raised); the one left to the
  // comments its question.
  seg('reading', hookDur, readingEnd - hookDur)
  segs.sort((a, b) => a.start - b.start)
  if (plan.hidden) seg('question', readingEnd, t - readingEnd)
  sfx.push({ at: +(t + 0.5).toFixed(3), key: 'platform-chime' })
  seg('cta', t, SY.cta)
  t += SY.cta
  return { seconds: +t.toFixed(3), segs, turns, cues, sfx, fps: 30, loudness: -16, chapters: segs.map(s => ({ at: s.start, title: s.key })) }
}

// ── Drawing ──────────────────────────────────────────────────────
const FMT = FORMATS.story
const fr = frame(FMT)
const UNDER = MASTHEAD.y + MASTHEAD.size
const TOP = UNDER + SP[7]
const PAD = SP[5]
// The panel the sentences stand on, as read along stands its text.
const FOOT = fr.bottom - FS.sm * 2.4
const COL = { x: fr.x + PAD, w: fr.w - PAD * 2 }
const SAY_Z = FS.title * 1.15

const layouts = new Map()
function layOf(ctx, plan, key, rows, o) {
  const k = `${plan.id}|${plan.lang}|${key}|${JSON.stringify(o)}`
  if (!layouts.has(k)) layouts.set(k, layoutSentence(ctx, rows, { fam: 'jp', weight: 700, rules: false, gap: 0.12, ...o }))
  return layouts.get(k)
}
/** Where each word of a laid-out sentence stands, as drawSentence puts it. */
function unitBoxes(L, x, y, align) {
  const out = []
  L.lines.forEach((line, li) => {
    const top = y + li * (L.lineH + L.lineGap)
    const lw = L.lineW(line)
    let at = align === 'center' ? x - lw / 2 : x
    const base = top + L.rubyH + L.size * ASC
    line.forEach((u, ui) => {
      if (ui) at += L.gap + u.extra
      const ux = at + u.lead
      out.push({ u, x: ux + u.ruleX, w: u.baseW, top, base, under: base + L.size * 0.12 + L.ruleGap + L.romH * 0.62 })
      at += u.span
    })
  })
  return out
}
/** The sentence, laid out once for the frame and the reveal alike, so the
 *  words fill the frame's blanks where they stand: under each word the
 *  room for the longer of its romaji and what it means. */
function sentenceLayout(ctx, plan, it) {
  const sense = r => shortSense((r[plan.lang] || r.en || [])[0])
  const romF = font(500, Math.max(SAY_Z * 0.3, FS.sm * 0.9), 'latin')
  const rows = it.rows.map((r, i) => {
    if (!it.blanks.includes(i)) return r
    const a = r.ro || ''
    const b = sense(r)
    return { ...r, ro: measure(ctx, b, romF) > measure(ctx, a, romF) ? b : a, own: a }
  })
  return layOf(ctx, plan, `say|${it.id}`, rows, { max: SAY_Z, min: FS.body, maxW: COL.w, maxLines: 3, script: plan.ruby ? 'furigana' : 'kanji', romaji: true })
}

function shade(ctx, on) {
  ctx.shadowColor = on ? 'rgba(0,0,0,0.55)' : 'transparent'
  ctx.shadowBlur = on ? 16 : 0
  ctx.shadowOffsetY = on ? 2 : 0
}
function block(ctx, T, str, y, { sizes, weight = 800, fam = 'latin', color = T.ink, maxLines = 3, lh = 1.15, k = 1, maxW = COL.w, x = fr.cx, align = 'center' } = {}) {
  const b = fit(ctx, str, { weight, fam, sizes, maxW, maxLines, lh })
  ctx.save()
  ctx.globalAlpha *= k
  shade(ctx, T.shadow)
  b.lines.forEach((l, i) => text(ctx, l, x, y + b.size * (0.85 + i * lh), { f: b.f, color, align }))
  ctx.restore()
  return y + b.size * lh * b.lines.length
}
function chip(ctx, T, label, x, y, { align = 'left', z = FS.sm } = {}) {
  const f = font(700, z, 'latin')
  const w = measure(ctx, label, f) + SP[5] * 2
  const h = z * 1.9
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
  ctx.fillStyle = T.ground === 'paper' ? PAPER.ink : 'rgba(16,14,19,0.62)'
  rrect(ctx, x0, y, w, h, h / 2)
  ctx.fill()
  text(ctx, label, x0 + SP[5], y + h / 2 + z * 0.36, { f, color: T.ground === 'paper' ? PAPER.bg : LIGHT })
  return h
}
function masthead(ctx, T, glow = 0) {
  if (!(glow > 0.001)) return drawMasthead(ctx, T.ink, T.ground === 'paper' ? PAPER.gold : GOLD)
  glowMasthead(ctx, Math.min(1, glow), T)
}
function panelOf(ctx, plan, T, P, k = 1) {
  if (T.ground === 'paper') return
  ctx.save()
  ctx.globalAlpha *= k
  ctx.fillStyle = `rgba(16,14,19,${alongPanel(plan, P)})`
  rrect(ctx, fr.x, TOP, fr.w, FOOT - TOP, R.card * 2)
  ctx.fill()
  ctx.restore()
}

/** Any second of the video. `P` is the hour's print (app.js loadPrint), or null. */
export function drawSayit(ctx, plan, tl, t, P = null) {
  const s = tl.segs.find(x => t < x.start + x.dur) ?? tl.segs.at(-1)
  const into = t - s.start
  const T = lookOf(plan)
  ctx.save()
  if (s.key === 'hook') hook(ctx, plan, tl, t, into, P, T)
  else if (s.key === 'cta') cta(ctx, plan, tl, t, into, P, T)
  else turnFrame(ctx, plan, tl, t, s.key, P, T)
  ctx.restore()
  return t
}

/** The hook's words, in the plan's language. */
export function hookWords(plan) {
  const S = W[plan.lang]
  return { hook: S.hook, title: S.title, chip: S.chip(plan.lv, plan.items.length, thinkOf(plan)) }
}
// The hook on the title slip's washi over the print in its colours (the
// reading challenge's cover, plan 309), its title in the translation's line.
const SLIP = { top: 500, foot: 940 }
function slip(ctx, words) {
  const x = Math.round(fr.x - SP[3])
  const w = Math.round(fr.w + SP[3] * 2)
  const hookB = fit(ctx, words.hook, { weight: 900, fam: 'serif', sizes: [FS.heading, FS.title], maxW: fr.w, maxLines: 2, lh: 1.08 })
  const titleB = fit(ctx, words.title, { weight: 700, fam: 'serif', sizes: [FS.title, FS.lead].filter(z => z <= hookB.size), maxW: fr.w, maxLines: 2, lh: 1.15 })
  const chipH = FS.body * 1.9
  const h = Math.ceil(SP[4] + paragraphH(hookB, 1.08) + SP[3] + paragraphH(titleB, 1.15) + SP[4] + chipH + SP[4])
  return { box: { x, y: SLIP.top, w, h }, hookB, titleB, chipH }
}
function drawSlip(ctx, words) {
  const { box, hookB, titleB } = slip(ctx, words)
  const { ink } = printPlate(ctx, PAPER, box.x, box.y, box.w, box.h, fr.w / 358)
  let y = box.y + SP[4]
  y += paragraph(ctx, hookB, fr.cx, y, ink, 'center', 1.08) + SP[3]
  y += paragraph(ctx, titleB, fr.cx, y, PAPER.line.honyaku, 'center', 1.15) + SP[4]
  const f = font(700, FS.body, 'latin')
  const w = measure(ctx, words.chip, f) + SP[5] * 2
  const h = FS.body * 1.9
  ctx.fillStyle = ink
  rrect(ctx, fr.cx - w / 2, y, w, h, h / 2)
  ctx.fill()
  text(ctx, words.chip, fr.cx, y + h / 2 + FS.body * 0.36, { f, color: '#f6f1e4', align: 'center' })
}
function hook(ctx, plan, tl, t, into, P, T) {
  const { laid } = backdrop(ctx, P, T, { dark: 0.5, hour: plan.hour, wash: 1, plan: coverPlan(plan), tl, t, seg: 'hook', cover: true })
  coverFg(ctx, plan, t, tl)
  masthead(ctx, T, 1 - laid)
}
/** What the cover lays over the print: its words and the parts that carry them. */
function coverFg(ctx, plan, t, tl) {
  if (plan.cover === 'poster') return posterCover(ctx, plan)
  if (plan.cover === 'board') return boardCover(ctx, plan, tl)
  if (plan.cover === 'bubbles') return bubblesCover(ctx, plan, t)
  drawSlip(ctx, hookWords(plan))
}

// A band of night across the frame behind light words over the print in
// its colours, thinning out above and below so no edge shows.
function nightBand(ctx, y0, y1, a = 0.62, feather = 120) {
  const top = y0 - feather
  const foot = y1 + feather
  const g = ctx.createLinearGradient(0, top, 0, foot)
  for (let i = 0; i <= 8; i++) {
    const k = (a * (1 - Math.cos((Math.PI * i) / 8))) / 2
    g.addColorStop((i * feather) / 8 / (foot - top), `rgba(12,10,22,${k.toFixed(3)})`)
    g.addColorStop(1 - (i * feather) / 8 / (foot - top), `rgba(12,10,22,${k.toFixed(3)})`)
  }
  ctx.fillStyle = g
  ctx.fillRect(0, top, FMT.w, foot - top)
}
// The light words of a cover, on the night they stand on.
function lightLines(ctx, b, y, color = LIGHT, lh = 1.12) {
  ctx.save()
  shade(ctx, true)
  b.lines.forEach((l, i) => text(ctx, l, fr.cx, y + b.size * (0.85 + i * lh), { f: b.f, color, align: 'center' }))
  ctx.restore()
  return y + b.size * lh * b.lines.length
}
function coverChip(ctx, label, y, { fill = 'rgba(16,14,19,0.78)', ink = LIGHT } = {}) {
  const f = font(700, FS.body, 'latin')
  const w = measure(ctx, label, f) + SP[5] * 2
  const h = FS.body * 1.9
  ctx.fillStyle = fill
  rrect(ctx, fr.cx - w / 2, y, w, h, h / 2)
  ctx.fill()
  text(ctx, label, fr.cx, y + h / 2 + FS.body * 0.36, { f, color: ink, align: 'center' })
  return y + h
}
// 日本語で？, its reading over it: what the cover asks for.
const JA_ROWS = [
  { t: '日本語', fu: [['日本語', 'にほんご']], k: 'word', pos: 'noun', ro: 'nihongo' },
  { t: 'で', k: 'particle', pos: 'particle', ro: 'de' },
  { t: '？', k: 'punct' },
]
const SKY = '#8da3e0'
// Where a cover's words start: under the hour's sun or moon, whose foot
// stands at y 482 under the hook (the slip stands at 500, cover.js).
const COVER_TOP = 510

// 大書 — the first sentence large over the print, 日本語で？ under it.
function posterCover(ctx, plan) {
  const S = W[plan.lang]
  const it = plan.items[0]
  const label = fit(ctx, S.hook.toLocaleUpperCase(plan.lang), { weight: 800, sizes: [FS.body, FS.sm], maxW: fr.w, maxLines: 2, lh: 1.2 })
  const big = fit(ctx, quoted(plan.lang, it.tr), { weight: 900, fam: 'serif', sizes: [FS.display, FS.display * 0.85, FS.heading], maxW: fr.w, maxLines: 3, lh: 1.04 })
  const ja = layOf(ctx, plan, 'cover-ja', JA_ROWS, { max: FS.heading, min: FS.title, maxW: fr.w, maxLines: 1, script: 'furigana' })
  const arrowH = 64
  const h = label.size * 1.2 * label.lines.length + SP[5] + big.size * 1.04 * big.lines.length + SP[4] + arrowH + SP[3] + ja.h + SP[6] + FS.body * 1.9
  const y0 = COVER_TOP
  nightBand(ctx, y0 - SP[2], y0 + h + SP[4], 0.6, 150)
  let y = lightLines(ctx, label, y0, RUBY_INK, 1.2) + SP[5]
  y = lightLines(ctx, big, y, LIGHT, 1.04) + SP[4]
  // The arrow down to the Japanese the viewer is asked for.
  ctx.save()
  shade(ctx, true)
  ctx.strokeStyle = SKY
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(fr.cx, y + 6)
  ctx.lineTo(fr.cx, y + arrowH - 8)
  ctx.moveTo(fr.cx - 18, y + arrowH - 26)
  ctx.lineTo(fr.cx, y + arrowH - 8)
  ctx.lineTo(fr.cx + 18, y + arrowH - 26)
  ctx.stroke()
  ctx.restore()
  y += arrowH + SP[3]
  ctx.save()
  shade(ctx, true)
  drawSentence(ctx, ja, fr.cx, y, 'center', () => ({ ink: SKY, rule: null, ruby: RUBY_INK }))
  ctx.restore()
  y += ja.h + SP[6]
  coverChip(ctx, hookWords(plan).chip, y)
}

// 発車標 — the five sentences as a departure board, a row a sentence, the
// fifth ？？？, left to the comments: the ride the video is.
function boardCover(ctx, plan, tl) {
  const S = W[plan.lang]
  const title = fit(ctx, S.boardHook, { weight: 900, fam: 'serif', sizes: [FS.heading, FS.title], maxW: fr.w, maxLines: 2, lh: 1.08 })
  const y0 = COVER_TOP
  const x = fr.x - SP[3]
  const w = fr.w + SP[3] * 2
  const pad = SP[4]
  const num = 30
  const tx = x + pad + num * 2 + SP[3]
  const right = x + w - pad
  // Each row departs when its sentence comes in the video, as a board's
  // time column says when a train leaves.
  const secF = font(700, FS.sm, 'latin')
  const at = i => {
    const s0 = tl?.turns?.[i]?.start ?? 0
    return `${Math.floor(s0 / 60)}:${String(Math.floor(s0 % 60)).padStart(2, '0')}`
  }
  const commentF = font(600, FS.caption, 'latin')
  const rows = plan.items.map((it, i) => {
    const last = plan.hidden && i === plan.items.length - 1
    const side = last ? measure(ctx, S.inComments, commentF) : measure(ctx, at(i), secF)
    const b = fit(ctx, last ? '？？？' : it.tr, { weight: last ? 900 : 700, fam: last ? 'jp' : 'serif', sizes: [FS.body, FS.sm], maxW: right - side - SP[4] - tx, maxLines: 2, lh: 1.15 })
    return { b, last, h: Math.max(num * 2 + SP[3], b.size * 1.15 * b.lines.length + SP[4] * 1.1) }
  })
  const headH = FS.title * 1.15 + SP[4] * 1.4
  const boardH = headH + rows.reduce((n, r) => n + r.h, 0)
  const boardY = y0 + paragraphH(title, 1.08) + SP[5]
  nightBand(ctx, y0 - SP[2], y0 + paragraphH(title, 1.08), 0.55, 120)
  lightLines(ctx, title, y0, LIGHT, 1.08)
  // The board, as Today's departure board stands over the shut gate.
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.34)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 24
  ctx.fillStyle = 'rgba(16,14,19,0.86)'
  rrect(ctx, x, boardY, w, boardH, R.panel)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = alpha(LIGHT, 0.2)
  ctx.lineWidth = 2
  rrect(ctx, x, boardY, w, boardH, R.panel)
  ctx.stroke()
  // Its head: the format's name, the level.
  const hy = boardY + SP[4] * 0.7 + FS.title * 0.88
  text(ctx, '言ってみて', x + pad, hy, { f: font(900, FS.title, 'serif'), color: LIGHT })
  text(ctx, `JLPT ${plan.lv}`, right, hy - FS.title * 0.12, { f: font(700, FS.sm, 'latin'), color: RUBY_INK, align: 'right' })
  let y = boardY + headH
  rows.forEach((r, i) => {
    ctx.fillStyle = alpha(LIGHT, 0.16)
    ctx.fillRect(x + 1, y, w - 2, 2)
    const cy = y + r.h / 2
    // The stop's number in its roundel, in the translation line's pigment.
    ctx.strokeStyle = r.last ? RUBY_INK : SKY
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(x + pad + num, cy, num - 3, 0, Math.PI * 2)
    ctx.stroke()
    text(ctx, String(i + 1), x + pad + num, cy + FS.sm * 0.36, { f: font(700, FS.sm, 'latin'), color: LIGHT, align: 'center' })
    const top = cy - (r.b.size * 1.15 * r.b.lines.length) / 2
    r.b.lines.forEach((l, j) => text(ctx, l, tx, top + r.b.size * (0.85 + j * 1.15), { f: r.b.f, color: r.last ? RUBY_INK : LIGHT }))
    if (r.last) text(ctx, S.inComments, right, cy + FS.caption * 0.36, { f: font(600, FS.caption, 'latin'), color: alpha(LIGHT, 0.72), align: 'right' })
    else text(ctx, at(i), right, cy + FS.sm * 0.36, { f: secF, color: alpha(LIGHT, 0.72), align: 'right' })
    y += r.h
  })
  // Under it, what the game is: each sentence before the voice, in its seconds.
  nightBand(ctx, y + SP[5], y + SP[5] + FS.lead * 1.3, 0.5, 110)
  lightLines(ctx, fit(ctx, `${S.title} · ${thinkOf(plan)} s`, { weight: 800, fam: 'serif', sizes: [FS.lead, FS.body], maxW: fr.w, maxLines: 1 }), y + SP[5], RUBY_INK)
}

// 吹き出し — the sentence said in the viewer's language, in a bubble, and a
// Japanese bubble answering it with nothing in it yet.
function bubblesCover(ctx, plan, t) {
  const S = W[plan.lang]
  const it = plan.items[0]
  const title = fit(ctx, S.hook, { weight: 900, fam: 'serif', sizes: [FS.heading, FS.title], maxW: fr.w, maxLines: 2, lh: 1.08 })
  const y0 = COVER_TOP
  nightBand(ctx, y0 - SP[2], y0 + paragraphH(title, 1.08), 0.55, 120)
  let y = lightLines(ctx, title, y0, LIGHT, 1.08) + SP[6]
  // Theirs, on washi, from the left.
  const pad = SP[5]
  const said = fit(ctx, it.tr, { weight: 800, fam: 'serif', sizes: [FS.display * 0.8, FS.heading, FS.title], maxW: fr.w * 0.9 - pad * 2, maxLines: 3, lh: 1.1 })
  const tag = fit(ctx, S.yourLang.toLocaleUpperCase(plan.lang), { weight: 800, sizes: [FS.caption], maxW: fr.w, maxLines: 1 })
  const w1 = Math.max(said.lines.reduce((m, l) => Math.max(m, measure(ctx, l, said.f)), 0), measure(ctx, tag.lines[0], tag.f)) + pad * 2
  const h1 = pad + tag.size * 1.3 + SP[2] + said.size * 1.1 * said.lines.length + pad * 0.8
  const x1 = fr.x - SP[3]
  bubble(ctx, x1, y, w1, h1, 'left', '#f6f1e4', null)
  text(ctx, tag.lines[0], x1 + pad, y + pad + tag.size * 0.85, { f: tag.f, color: PAPER.line.honyaku })
  said.lines.forEach((l, i) => text(ctx, l, x1 + pad, y + pad + tag.size * 1.3 + SP[2] + said.size * (0.85 + i * 1.1), { f: said.f, color: PAPER.ink }))
  y += h1 + 44 + SP[4]
  // Ours, on the night, from the right: 日本語 over it, nothing said yet.
  const w2 = Math.min(fr.w * 0.62, 460)
  const h2 = 200
  const x2 = fr.right + SP[3] - w2
  bubble(ctx, x2, y, w2, h2, 'right', 'rgba(16,14,19,0.88)', GOLD)
  text(ctx, '日本語', x2 + pad, y + pad + FS.caption * 0.85, { f: font(700, FS.caption, 'jp'), color: RUBY_INK })
  // Three dots, as a voice about to speak, then the question.
  const cy = y + h2 / 2 + 22
  for (let i = 0; i < 3; i++) {
    const a = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t * 0.9) - i * 0.9))
    ctx.fillStyle = alpha(LIGHT, a)
    ctx.beginPath()
    ctx.arc(x2 + pad + 22 + i * 44, cy, 13, 0, Math.PI * 2)
    ctx.fill()
  }
  text(ctx, '？', x2 + w2 - pad - 10, cy + FS.display * 0.36, { f: font(900, FS.display, 'jp'), color: GOLD, align: 'right' })
  y += h2 + 44 + SP[6]
  coverChip(ctx, hookWords(plan).chip, y)
}
// A speech bubble, its tail at the foot on its side.
function bubble(ctx, x, y, w, h, side, fill, edge) {
  const r = 34
  const tw = 46
  const th = 40
  const tx = side === 'left' ? x + 56 : x + w - 56
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 10
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  if (side === 'right') { ctx.lineTo(tx + tw / 2, y + h); ctx.lineTo(tx + tw / 2 + 6, y + h + th); ctx.lineTo(tx - tw / 2, y + h) }
  else { ctx.lineTo(tx + tw / 2, y + h); ctx.lineTo(tx - tw / 2 - 6, y + h + th); ctx.lineTo(tx - tw / 2, y + h) }
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()
  if (edge) {
    ctx.strokeStyle = edge
    ctx.lineWidth = 4
    ctx.stroke()
  }
}

// 直行 — no cover: in the first sentence's empty box, while nothing helps
// yet, the hook and the level, so its first frame is the game itself.
function hookInBox(ctx, plan, T, box, k) {
  const S = W[plan.lang]
  const title = fit(ctx, S.title, { weight: 900, fam: 'serif', sizes: [FS.heading, FS.title], maxW: box.w - SP[5] * 2, maxLines: 2, lh: 1.08 })
  const h = paragraphH(title, 1.08) + SP[5] + FS.body * 1.9
  let y = box.y + (box.h - h) / 2
  ctx.save()
  ctx.globalAlpha *= k
  title.lines.forEach((l, i) => text(ctx, l, fr.cx, y + title.size * (0.85 + i * 1.08), { f: title.f, color: RUBY_INK, align: 'center' }))
  y += paragraphH(title, 1.08) + SP[5]
  coverChip(ctx, hookWords(plan).chip, y, { fill: alpha(LIGHT, 0.12), ink: LIGHT })
  ctx.restore()
}
// The backdrop reads the reading challenge's dials; under the hook it is
// told the cover is on, as this format always opens on it.
const coverPlan = plan => ({ ...plan, tune: { ...plan.tune, 'challenge.cover': 1 } })

// ── A turn ──
function turnAt(tl, t) {
  return tl.turns.reduce((cur, x) => (t >= x.start ? x : cur), tl.turns[0])
}
function turnFrame(ctx, plan, tl, t, seg, P, T) {
  const S = W[plan.lang]
  const turn = turnAt(tl, t)
  const it = plan.items[turn.i]
  const segStart = tl.segs.find(x => x.key === seg)?.start ?? 0
  // With no cover the first frame is the game whole: the print already
  // raised and its night laid, the panel and the sentence there.
  const straight = plan.cover === 'straight'
  const tb = straight && seg === 'reading' ? Math.max(t, segStart + 2.4) : t
  const { laid } = backdrop(ctx, P, T, { dark: 0.42, hour: plan.hour, wash: 1, plan: coverPlan(plan), tl, t: tb, seg, cover: true })
  masthead(ctx, T, 1 - laid)
  // The cut after the cover, one thing at a time, never words over words:
  // the cover's words go (COVER_OUT), then the panel comes, then the turn on it.
  const cut = t - segStart
  const opening = turn.i === 0 && !straight && seg === 'reading'
  const first = opening ? ease((cut - COVER_OUT * 0.6) / 0.45) : 1
  panelOf(ctx, plan, T, P, first)
  // Each turn comes in and goes: the whole turn fades out over its last moment.
  const going = turn.hidden ? 1 : 1 - clamp((t - (turn.end - SY.out)) / SY.out)
  const coming = turn.i === 0 && straight ? 1 : opening ? ease((cut - COVER_OUT) / (SY.in - COVER_OUT * 0.5)) : ease((t - turn.start) / SY.in)
  ctx.save()
  ctx.globalAlpha *= first
  // The chip waits, as the reading challenge's does, for the sun or the moon to rise past it.
  const shown = turn.i === 0 ? chipShown(plan, tb - segStart, P) : 1
  if (shown > 0) {
    ctx.save()
    ctx.globalAlpha *= shown
    chip(ctx, T, `JLPT ${plan.lv} · ${turn.i + 1} / ${plan.items.length}`, fr.right, fr.y + 6, { align: 'right' })
    ctx.restore()
  }
  ctx.globalAlpha *= going
  // The sentence to say, in the viewer's language.
  let y = TOP + PAD
  y = block(ctx, T, S.ask.toLocaleUpperCase(plan.lang), y, { sizes: [FS.sm], weight: 700, color: T.ground === 'paper' ? PAPER.line.honyaku : RUBY_INK, maxLines: 1, k: coming })
  y += SP[3]
  y = block(ctx, T, quoted(plan.lang, it.tr), y, { sizes: [FS.heading, FS.title, FS.lead], weight: 700, fam: 'serif', maxLines: 4, lh: 1.12, k: coming })
  const zone = y + SP[5]
  const L = sentenceLayout(ctx, plan, it)
  // The foot: the voice's credit at the panel's foot, what to do over it,
  // the countdown over that; above it all the answer's box.
  const creditY = FOOT - SP[4]
  const labelY = creditY - FS.sm - SP[5]
  const ringY = labelY - FS.body * 0.85 - SP[3] - RING_R * 2
  const box = { x: COL.x - SP[2], y: zone, w: COL.w + SP[2] * 2, h: ringY - SP[5] - zone }
  const said = turn.voice != null && t >= turn.voice - 0.05
  // What helps, by the moment: none, the words (cards), the frame (blanks).
  const [atClues, atFrame] = turn.help
  const cluesK = atClues != null ? ease((t - atClues) / 0.5) * (atFrame != null ? 1 - ease((t - atFrame) / 0.4) : 1) : 0
  const frameK = atFrame != null ? ease((t - atFrame) / 0.5) : 0
  // The sentence stands where it is said, its other register under it once
  // the countdown has gone: the frame stands there too, so nothing moves
  // as its blanks are filled.
  const O = it.v ? otherLayout(ctx, plan, it) : null
  const whole = L.h + (O ? SP[6] + O.h : 0)
  const sayY = Math.max(box.y, Math.min(box.y + (labelY - box.y - whole) / 2, box.y + box.h - L.h))
  const boxK = turn.hidden ? coming : coming * (1 - clamp((t - turn.told) / 0.4))
  if (boxK > 0) answerBox(ctx, T, box, boxK)
  if (!turn.hidden || t < turn.told) {
    if (cluesK <= 0 && frameK <= 0 && !said && t < turn.told) {
      if (straight && turn.i === 0) hookInBox(ctx, plan, T, box, 1)
      else waiting(ctx, T, box, t, coming)
    }
    // The cover's words fade out over the first sentence's moment of coming in.
    if (straight && turn.i === 0 && atClues != null && t >= atClues && t < atClues + 0.4) hookInBox(ctx, plan, T, box, 1 - ease((t - atClues) / 0.4))
    if (cluesK > 0 && !said) clueCards(ctx, plan, T, it, box, cluesK * coming)
    if (frameK > 0 || said) sentence(ctx, plan, T, it, L, sayY, turn, t, frameK * coming)
    if (said && O && turn.also != null) other(ctx, plan, T, it, O, sayY + L.h + SP[6], ease((t - turn.also) / 0.5))
  }
  // The countdown, then the voice's credit where it reads.
  if (t < turn.told + 0.4) ring(ctx, plan, T, turn, t, ringY, labelY, 1 - clamp((t - turn.told) / 0.4), straight && turn.i === 0)
  if (turn.hidden && t >= turn.told) yours(ctx, plan, T, box, ease((t - turn.told) / 0.5))
  ctx.restore()
  if (opening && cut < COVER_OUT) {
    ctx.save()
    ctx.globalAlpha *= 1 - smooth(cut / COVER_OUT)
    coverFg(ctx, plan, t, tl)
    ctx.restore()
  }
  // The voice's credit, on the panel, as it comes.
  ctx.save()
  ctx.globalAlpha *= first
  text(ctx, S.voice, fr.cx, creditY, { f: font(600, FS.sm, 'latin'), color: T.ground === 'paper' ? alpha(PAPER.ink, 0.62) : alpha(LIGHT, 0.6), align: 'center' })
  ctx.restore()
}

// Where the answer goes: a dashed box, faint, while the countdown runs.
function answerBox(ctx, T, box, k) {
  ctx.save()
  ctx.globalAlpha *= k
  ctx.setLineDash([14, 12])
  ctx.lineWidth = 3
  ctx.strokeStyle = T.ground === 'paper' ? alpha(PAPER.ink, 0.22) : alpha(LIGHT, 0.2)
  rrect(ctx, box.x, box.y, box.w, box.h, R.card * 1.5)
  ctx.stroke()
  ctx.restore()
}
// Nothing yet: three dots, as a voice about to speak.
function waiting(ctx, T, box, t, k) {
  const cy = box.y + box.h / 2
  for (let i = 0; i < 3; i++) {
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t * 0.9) - i * 0.9))
    ctx.fillStyle = T.ground === 'paper' ? alpha(PAPER.ink, a * k) : alpha(LIGHT, a * k)
    ctx.beginPath()
    ctx.arc(fr.cx + (i - 1) * 34, cy, 9, 0, Math.PI * 2)
    ctx.fill()
  }
}

// The cover's words leave over this long, before the first sentence comes.
const COVER_OUT = 0.35
const RING_R = 50
function ring(ctx, plan, T, turn, t, y, labelY, k, whole = false) {
  const S = W[plan.lang]
  const think = thinkOf(plan)
  const left = Math.max(0, think - Math.max(0, t - turn.ring))
  ctx.save()
  // Whole from the first frame where the video opens on its first sentence.
  ctx.globalAlpha *= k * (whole ? 1 : ease((t - turn.ring + 0.3) / 0.5))
  ctx.lineWidth = 10
  ctx.strokeStyle = T.track
  ctx.beginPath()
  ctx.arc(fr.cx, y + RING_R, RING_R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = T.ring
  ctx.beginPath()
  ctx.arc(fr.cx, y + RING_R, RING_R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / think))
  ctx.stroke()
  text(ctx, String(Math.ceil(left) || ''), fr.cx, y + RING_R + FS.title * 0.34, { f: font(800, FS.title, 'latin'), color: T.ink, align: 'center' })
  // Under it what to do, or the help that has come.
  const [a, b] = turn.help
  const label = b != null && t >= b && plan.style !== 'frame' ? S.help.frame : a != null && t >= a ? S.help.clues : S.out
  const lf = fit(ctx, label, { weight: 700, sizes: [FS.body, FS.sm], maxW: COL.w, maxLines: 1 })
  shade(ctx, T.shadow)
  text(ctx, lf.lines[0], fr.cx, labelY, { f: lf.f, color: label === S.out ? T.ink : T.soft, align: 'center' })
  ctx.restore()
}

// Its words, each on a card: the word in its dictionary form over what it
// means, in an order of their own, centred in the answer's box.
function cluesLayout(ctx, plan, it) {
  const pad = SP[3]
  const cards = it.clues.map(c => {
    const L = layOf(ctx, plan, `clue|${it.id}|${c.i}`, [{ t: c.t, fu: c.fu || undefined, k: 'word', ro: c.ro }], { max: FS.title, min: FS.body, maxW: COL.w - pad * 2, maxLines: 1, script: plan.ruby ? 'furigana' : 'kanji', fam: 'jp' })
    const sb = fit(ctx, c.sense, { weight: 600, sizes: [FS.sm, FS.caption], maxW: COL.w - pad * 2, maxLines: 1 })
    const w = Math.max(L.lineW(L.lines[0]), measure(ctx, sb.lines[0], sb.f)) + pad * 2
    return { c, L, sb, w, h: L.h + SP[2] + sb.size * 1.2 + pad * 2 }
  })
  // In rows, as many a row as the column holds, each row centred.
  const rows = [[]]
  let used = 0
  for (const card of cards) {
    if (rows.at(-1).length && used + SP[3] + card.w > COL.w) { rows.push([]); used = 0 }
    used += (rows.at(-1).length ? SP[3] : 0) + card.w
    rows.at(-1).push(card)
  }
  const hs = rows.map(row => Math.max(...row.map(c => c.h)))
  return { rows, hs, h: hs.reduce((n, h) => n + h, 0) + SP[3] * (rows.length - 1), pad, n: cards.length }
}
function clueCards(ctx, plan, T, it, box, k) {
  const C = cluesLayout(ctx, plan, it)
  let yy = box.y + (box.h - C.h) / 2
  let n = 0
  C.rows.forEach((row, ri) => {
    const rw = row.reduce((s, c, i) => s + c.w + (i ? SP[3] : 0), 0)
    const h = C.hs[ri]
    let x = fr.cx - rw / 2
    for (const card of row) {
      const kk = ease(k * (1 + 0.15 * C.n) - n * 0.15)
      ctx.save()
      ctx.globalAlpha *= kk
      ctx.translate(0, (1 - kk) * 16)
      ctx.fillStyle = T.card
      rrect(ctx, x, yy, card.w, h, R.card)
      ctx.fill()
      ctx.strokeStyle = T.cardLine
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = T.line
      rrect(ctx, x + R.card, yy, card.w - R.card * 2, 5, 2.5)
      ctx.fill()
      drawSentence(ctx, card.L, x + card.w / 2, yy + C.pad, 'center', () => ({ ink: T.ink, rule: null, ruby: T.ruby }))
      text(ctx, card.sb.lines[0], x + card.w / 2, yy + C.pad + card.L.h + SP[2] + card.sb.size * 0.9, { f: card.sb.f, color: T.soft, align: 'center' })
      ctx.restore()
      x += card.w + SP[3]
      n++
    }
    yy += h + SP[3]
  })
}

// The sentence: as its frame (the particles and the endings, a blank for
// each word with what it means under it), filled word by word as the
// voice says it; the word being said gold and ruled, as read along.
function sentence(ctx, plan, T, it, L, y, turn, t, frameK) {
  const said = turn.voice != null && t >= turn.voice - 0.05
  const boxes = unitBoxes(L, fr.cx, y, 'center')
  const sense = r => shortSense((r[plan.lang] || r.en || [])[0])
  const romF = L.romF
  const when = i => (said ? turn.words[i] : Infinity)
  const next = i => {
    const w = turn.words
    if (!w) return Infinity
    return w.find((x, j) => j > i && x > w[i]) ?? turn.voice + turn.dur
  }
  // Each word's own moment: before it is said, a blank (or nothing, with no
  // frame); while it is said, gold and ruled; once said, in the ink.
  drawSentence(ctx, L, fr.cx, y, 'center', u => {
    const blank = it.blanks.includes(u.i)
    const at = when(u.i)
    const k = clamp((t - at) / 0.15)
    const saying = t >= at && t < next(u.i)
    const shown = blank ? k : Math.max(k, frameK)
    const ink = saying ? T.lit : T.ink
    return {
      ink: alphaOf(ink, shown),
      ruby: alphaOf(saying ? T.lit : T.ruby, blank ? k : shown),
      rule: saying ? T.lit : blank && frameK > 0 && k < 1 ? alphaOf(T.soft, frameK * (1 - k)) : null,
      ruleW: saying ? 6 : 4,
    }
  })
  // Under each word: what it means while it is a blank, its romaji once said.
  for (const b of boxes) {
    const r = b.u.row
    const blank = it.blanks.includes(b.u.i)
    const at = when(b.u.i)
    const k = clamp((t - at) / 0.15)
    const ro = r.own ?? r.ro
    // A blank keeps the stop that ends its sentence: the frame shows where it ends.
    if (blank && frameK > 0 && k < 1 && b.u.punct) {
      ctx.save()
      ctx.globalAlpha *= frameK * (1 - k)
      text(ctx, b.u.punct, b.x + b.w, b.base, { f: L.f, color: T.ink })
      ctx.restore()
    }
    if (blank && frameK > 0 && k < 0.5) {
      ctx.save()
      ctx.globalAlpha *= frameK * (1 - k * 2)
      text(ctx, sense(r), b.x + b.w / 2, b.under, { f: romF, color: T.soft, align: 'center' })
      ctx.restore()
    }
    const rk = blank && frameK > 0 ? clamp(k * 2 - 1) : k
    if (plan.romaji && rk > 0 && ro) {
      ctx.save()
      ctx.globalAlpha *= rk
      text(ctx, ro, b.x + b.w / 2, b.under, { f: romF, color: T.soft, align: 'center' })
      ctx.restore()
    }
  }
}
// A colour given as #rrggbb or rgba(), its alpha multiplied by `a`.
function alphaOf(c, a) {
  if (c.startsWith('#')) return alpha(c, a)
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return c
  const [r, g, b, a0 = 1] = m[1].split(',').map(Number)
  return `rgba(${r},${g},${b},${+(a0 * a).toFixed(3)})`
}

// The other register: the same sentence said the other way, the part
// that changed lit.
function otherLayout(ctx, plan, it) {
  const S = W[plan.lang]
  const label = fit(ctx, S.also[it.v.to] || S.also.plain, { weight: 700, sizes: [FS.sm], maxW: COL.w, maxLines: 1 })
  const L = layOf(ctx, plan, `other|${it.id}`, it.v.rows, { max: FS.lead, min: FS.body, maxW: COL.w, maxLines: 2, script: plan.ruby ? 'furigana' : 'kanji' })
  return { label, L, h: label.size * 1.15 + SP[2] + L.h }
}
function other(ctx, plan, T, it, O, y, k) {
  if (!(k > 0)) return
  ctx.save()
  ctx.globalAlpha *= k
  ctx.translate(0, (1 - k) * 14)
  shade(ctx, T.shadow)
  text(ctx, O.label.lines[0], fr.cx, y + O.label.size * 0.85, { f: O.label.f, color: T.soft, align: 'center' })
  const changed = new Set(it.v.rows.map((r, i) => (it.v.into && r.t === it.v.into ? i : -1)).filter(i => i >= 0))
  drawSentence(ctx, O.L, fr.cx, y + O.label.size * 1.15 + SP[2], 'center', u => ({ ink: changed.has(u.i) ? T.lit : T.ink, ruby: T.ruby, rule: changed.has(u.i) ? T.lit : null, ruleW: 4 }))
  ctx.restore()
}

// The last sentence, left to the comments, in the answer's box.
function yours(ctx, plan, T, box, k) {
  const S = W[plan.lang]
  const top = fit(ctx, S.yours[0], { weight: 800, sizes: [FS.title], maxW: COL.w, maxLines: 1 })
  const big = fit(ctx, S.yours[1], { weight: 900, fam: 'serif', sizes: [FS.heading, FS.title], maxW: COL.w, maxLines: 2, lh: 1.08 })
  const low = fit(ctx, S.yours[2], { weight: 600, sizes: [FS.body, FS.sm], maxW: COL.w, maxLines: 1 })
  const h = top.size * 1.15 + SP[3] + big.size * 1.08 * big.lines.length + SP[3] + low.size * 1.15
  let y = box.y + (box.h - h) / 2
  y = block(ctx, T, S.yours[0], y, { sizes: [top.size], weight: 800, color: T.ground === 'paper' ? PAPER.line.honyaku : RUBY_INK, maxLines: 1, k })
  y = block(ctx, T, S.yours[1], y + SP[3], { sizes: [big.size], weight: 900, fam: 'serif', maxLines: 2, lh: 1.08, k: ease(k * 1.4 - 0.2) })
  block(ctx, T, S.yours[2], y + SP[3], { sizes: [low.size], weight: 600, color: T.soft, maxLines: 1, k: ease(k * 1.4 - 0.4) })
}

// ── The way to the app: its own exercise of the same name ──
function cta(ctx, plan, tl, t, into, P, T) {
  const S = W[plan.lang]
  const { laid } = backdrop(ctx, P, T, { dark: 0.62, hour: plan.hour, wash: 1, plan: coverPlan(plan), tl, t, seg: 'cta', cover: true })
  masthead(ctx, T, 1 - laid)
  let y = UNDER + SP[5]
  y = block(ctx, T, S.cta, y, { sizes: [FS.heading, FS.title, FS.lead], weight: 900, fam: 'serif', maxLines: 1, lh: 1.08, k: ease(into / 0.6) })
  y = block(ctx, T, S.ctaLine, y + SP[3], { sizes: [FS.body, FS.sm], weight: 600, color: T.soft, maxLines: 2, k: ease((into - 0.2) / 0.6) })
  y += SP[5]
  // The exercise as the app runs it, on its card: the sentence, the Japanese
  // typed, the tutor's verdict and the reference.
  const it = plan.items[0]
  const railY = fr.bottom - METAL_H - SP[6] - (34 + SP[3] + FS.body * 1.2)
  const box = { x: fr.x, y, w: fr.w, h: railY - SP[5] - y }
  const k = ease((into - 0.3) / 0.6)
  ctx.save()
  ctx.globalAlpha *= k
  ctx.translate(0, (1 - k) * 30)
  appCard(ctx, plan, it, box, into)
  ctx.restore()
  // The run's three stops, lit as the exercise goes.
  const ink = PAPER.line.honyaku
  const xs = [1, 3, 5].map(m => fr.x + (fr.w * m) / 6)
  const cy = railY + 17
  const go = ease((into - 1.0) / 3.2)
  ctx.save()
  ctx.globalAlpha *= ease((into - 0.9) / 0.4)
  if (T.ground !== 'paper') {
    ctx.fillStyle = 'rgba(16,14,19,0.66)'
    rrect(ctx, fr.x, railY - SP[4], fr.w, 34 + SP[3] + FS.body * 1.2 + SP[4] * 2, R.card * 2)
    ctx.fill()
  }
  ctx.fillStyle = alpha(ink, 0.3)
  rrect(ctx, xs[0], cy - 5, xs[2] - xs[0], 10, 5)
  ctx.fill()
  ctx.fillStyle = T.ground === 'paper' ? ink : HONYAKU.dark
  rrect(ctx, xs[0], cy - 5, (xs[2] - xs[0]) * go, 10, 5)
  ctx.fill()
  S.stops.forEach((label, i) => {
    const on = go >= i / 2 - 0.01
    ctx.fillStyle = on ? (T.ground === 'paper' ? ink : HONYAKU.dark) : T.ground === 'paper' ? PAPER.bg : '#17151a'
    ctx.beginPath()
    ctx.arc(xs[i], cy, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = T.ground === 'paper' ? ink : HONYAKU.dark
    ctx.lineWidth = 6
    ctx.stroke()
    text(ctx, label, xs[i], cy + 17 + SP[3] + FS.body * 0.85, { f: font(on ? 700 : 500, FS.body, 'latin'), color: on ? T.ink : T.soft, align: 'center' })
  })
  ctx.restore()
  const kb = ease((into - 0.5) / 0.6)
  ctx.save()
  ctx.globalAlpha *= kb
  address(ctx, palette(T.ground === 'paper' ? 'paper' : 'sumi'), fr.x, fr.bottom - METAL_H + (1 - kb) * 30, fr.w, SITE)
  ctx.restore()
}
function appCard(ctx, plan, it, box, into) {
  const S = W[plan.lang]
  const p = PAPER
  ctx.save()
  ctx.shadowColor = 'rgba(40,30,15,0.2)'
  ctx.shadowBlur = 34
  ctx.shadowOffsetY = 12
  ctx.fillStyle = p.card
  rrect(ctx, box.x, box.y, box.w, box.h, R.panel)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = p.surfaceLine
  ctx.lineWidth = 2
  rrect(ctx, box.x, box.y, box.w, box.h, R.panel)
  ctx.stroke()
  const x = box.x + SP[5]
  const w = box.w - SP[5] * 2
  let y = box.y + SP[4]
  // The station's name, in its line.
  text(ctx, `翻訳 · ${S.station}`, x, y + FS.caption * 0.85, { f: font(700, FS.caption, 'latin'), color: p.line.honyaku })
  y += FS.caption * 1.2 + SP[3]
  const q = fit(ctx, quoted(plan.lang, it.tr), { weight: 700, fam: 'serif', sizes: [FS.lead, FS.body], maxW: w, maxLines: 3, lh: 1.15 })
  q.lines.forEach((l, i) => text(ctx, l, x, y + q.size * (0.85 + i * 1.15), { f: q.f, color: p.ink }))
  y += q.size * 1.15 * q.lines.length + SP[4]
  // The field, the Japanese typed into it a character at a time.
  const fieldH = FS.lead * 1.8
  ctx.fillStyle = p.surface
  rrect(ctx, x, y, w, fieldH, R.card)
  ctx.fill()
  ctx.strokeStyle = alpha(p.gold, 0.7)
  ctx.lineWidth = 3
  ctx.stroke()
  const chars = [...it.jp]
  const typed = chars.slice(0, Math.floor(clamp((into - 1.1) / 1.8) * chars.length)).join('')
  const jf = font(700, FS.lead, 'jp')
  const tw = text(ctx, typed, x + SP[4], y + fieldH / 2 + FS.lead * 0.36, { f: jf, color: p.ink })
  if (Math.floor(into * 2) % 2 === 0 || typed.length < chars.length) {
    ctx.fillStyle = p.gold
    ctx.fillRect(x + SP[4] + (tw || measure(ctx, typed, jf)) + 4, y + fieldH / 2 - FS.lead * 0.55, 4, FS.lead * 1.1)
  }
  y += fieldH + SP[4]
  // The tutor's verdict, then the reference.
  const vk = ease((into - 3.2) / 0.4)
  if (vk > 0) {
    ctx.save()
    ctx.globalAlpha *= vk
    const vf = font(700, FS.body, 'latin')
    const label = `✓  ${S.verdict}`
    const vw = measure(ctx, label, vf) + SP[5] * 2
    const vh = FS.body * 1.9
    ctx.fillStyle = alpha(p.success || '#4d7639', 0.14)
    rrect(ctx, x, y, vw, vh, vh / 2)
    ctx.fill()
    text(ctx, label, x + SP[5], y + vh / 2 + FS.body * 0.36, { f: vf, color: p.success || '#4d7639' })
    // The reference under it, whole.
    y += vh + SP[3]
    const rf = font(700, FS.caption, 'latin')
    text(ctx, S.reference, x, y + FS.caption * 0.85, { f: rf, color: p.ink2 })
    y += FS.caption * 1.25
    const jb = fit(ctx, it.jp, { weight: 500, fam: 'jp', sizes: [FS.body, FS.sm, FS.caption], maxW: w, maxLines: 2 })
    jb.lines.forEach((l, i) => text(ctx, l, x, y + jb.size * (0.9 + i * 1.2), { f: jb.f, color: p.ink }))
    ctx.restore()
  }
}
