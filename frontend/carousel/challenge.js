// ── 速読 — the reading challenge (plan 247) ───────────────────────
// A comprehension text read as a 9:16 video over Today's print, in one
// of two ways: `scroll`, the whole text going slowly up the screen as a
// film's credits do, at one size, in ink on the print washed pale (the
// owner's own reference); `along`, the text standing while the app's
// reader says it, each word lit as it is said (the owner's pick D of four
// drawn). Before it the hook and three of its words; after it one of its
// questions, asked and answered, and the way to the app. Under it, a
// track of the owner's own music, or nothing.
//
// Everything a viewer must read is set large, in ink on the washed print
// (scroll) or light on the darkened one (along), so it reads at every
// hour of the print.
//
// Pure but for the canvas it draws on: `challengeTimeline` times the
// video (on the voice's own lengths and syllables where it is voiced,
// else on a close guess), `drawChallenge` draws any second of it.
import { FS, SP, R, METAL_H, RATING_INKS, FORMATS, address, alpha, drawSentence, fit, font, frame, layoutSentence, mark, measure, palette, reading, rrect, text } from './draw.js'
import { drawPrint } from './app.js'
import { unpack } from './common.js'
import { SITE } from './strings.js'

export const STYLES = ['scroll', 'along']
export const HOURS = ['dawn', 'day', 'dusk', 'night']
// A learner's pace at each level, in characters a minute: the scroll
// carries the text past the reading line at this pace (a notch under
// the first one, 180 to 320, which the owner found a little quick).
export const CPM = { N5: 150, N4: 165, N3: 200, N2: 230, N1: 265 }
// Readings over the kanji where a learner of the level still needs them.
const RUBY = new Set(['N5', 'N4', 'N3'])
// The read-along voice slows for the first two levels, as a card's slow line does.
const SLOW = new Set(['N5', 'N4'])
// The video's beats, in seconds.
export const CH = {
  hook: 3.2, words: 5.5,
  // scroll: the text comes in for INTO seconds before it moves, and the
  // last line is still read for OUT seconds after it passes the reading line.
  into: 1, out: 4,
  // along: the voice starts LEAD after its sentence is due, a GAP between two.
  lead: 0.35, gap: 0.3, turn: 0.35,
  ask: 2.2, count: 5, answer: 3.6, cta: 5.2,
}

const LIGHT = '#f3ecdf'
const GOLD = '#e6bd62'
const RUBY_INK = '#f1d08a'
const PANEL = 'rgba(16,14,19,0.62)'
const CORRECT = RATING_INKS['--rating-correct']
// The two looks: `along` light on the print darkened, `scroll` in the
// app's ink on the print washed with its paper (the owner's reference).
const PAPER = palette('paper')
const LOOK = {
  dark: {
    ground: 'sumi', ink: LIGHT, soft: alpha(LIGHT, 0.75), title: RUBY_INK, ruby: RUBY_INK, ring: GOLD, road: GOLD,
    panel: PANEL, edge: null, chip: PANEL, chipInk: LIGHT, shadow: true, track: alpha(LIGHT, 0.22), dot: alpha(LIGHT, 0.16),
  },
  paper: {
    ground: 'paper', ink: PAPER.ink, soft: PAPER.ink2, title: PAPER.line.rikai, ruby: PAPER.ink2, ring: PAPER.gold, road: PAPER.gold,
    panel: alpha(PAPER.card, 0.94), edge: PAPER.surfaceLine, chip: PAPER.ink, chipInk: PAPER.bg, shadow: false, track: alpha(PAPER.ink, 0.14), dot: alpha(PAPER.ink, 0.08),
  },
}
const lookOf = plan => (plan.style === 'scroll' ? LOOK.paper : LOOK.dark)

const W = {
  en: {
    hook: { scroll: 'Can you read this?', along: 'Read along. Can you keep up?' },
    sentences: n => `${n} sentences`,
    chars: n => `${n} characters`,
    words: 'Three words first',
    comments: 'Answer in the comments',
    gotIt: 'Did you get it?',
    more: 'Texts like this one, N5 to N1, each with its questions',
    free: 'Free · in your browser',
    voice: 'Voice · VOICEVOX Nemo',
    title: (lv, t) => `Can you read this Japanese text? JLPT ${lv} reading challenge: ${t}`,
    body: { scroll: 'Read the text as it scrolls up, then answer the question.', along: 'Read along with the voice, word by word, then answer the question.' },
    site: site => `More texts like this one, each with its questions, on Tsuji: ${site}`,
    credit: 'Voice: VOICEVOX Nemo.',
    tags: ['japanese', 'learnjapanese', 'japanesereading', 'jlpt'],
  },
  fr: {
    hook: { scroll: 'Tu arrives à lire ça ?', along: 'Lis avec la voix. Tu suis ?' },
    sentences: n => `${n} phrases`,
    chars: n => `${n} caractères`,
    words: 'D’abord, trois mots',
    comments: 'Réponds en commentaire',
    gotIt: 'Tu avais trouvé ?',
    more: 'Des textes comme celui-ci, du N5 au N1, avec leurs questions',
    free: 'Gratuit · dans ton navigateur',
    voice: 'Voix · VOICEVOX Nemo',
    title: (lv, t) => `Tu arrives à lire ce texte japonais ? Défi lecture JLPT ${lv} : ${t}`,
    body: { scroll: 'Lis le texte pendant qu’il défile, puis réponds à la question.', along: 'Lis avec la voix, mot à mot, puis réponds à la question.' },
    site: site => `D’autres textes comme celui-ci, avec leurs questions, sur Tsuji : ${site}`,
    credit: 'Voix : VOICEVOX Nemo.',
    tags: ['japonais', 'apprendrelejaponais', 'lecturejaponaise', 'jlpt'],
  },
}

const PUNCT = /^[\p{P}\p{S}\s]+$/u
const sentenceText = rows => rows.map(r => r.t).join('')
const charsOf = rows => rows.filter(r => r.k !== 'punct').reduce((n, r) => n + [...r.t].length, 0)
const SMALL = new Set([...'ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ'])
/** A word's syllables (morae) as it is read: small ゃ joins the kana before it. */
export const moraeOf = row => (row.k === 'punct' || PUNCT.test(row.t) ? 0 : [...reading(row)].filter(c => !SMALL.has(c)).length)
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
const clock = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`.replace(/:60$/, ':59')

/** The texts the challenge can read: every comprehension passage. */
export function challengeItems(data, lang = 'en') {
  return data.passages.map(P => ({ id: P.id, jp: P.title, sub: W[lang === 'fr' ? 'fr' : 'en'].chars(P.sents.map(unpack).reduce((n, rows) => n + charsOf(rows), 0)), tag: P.lv }))
}

/** A text's challenge: its sentences, three of its words, one question.
 *  `opts.music`: the track laid under it (a file's path or name), or none. */
export function challengePlan(data, id, opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en'
  const P = data.passages.find(x => x.id === id) ?? data.passages[0]
  const style = STYLES.includes(opts.style) ? opts.style : 'scroll'
  const hour = HOURS.includes(opts.hour) ? opts.hour : 'dusk'
  const sents = P.sents.map(unpack)
  // Three words of its level the text writes in kanji, in the order it meets them.
  const text = P.sents.map(s => s.map(t => t[0]).join('')).join('')
  const kanji = w => /[\u3400-\u9fff]/.test(w.t)
  const ranked = [...P.words.filter(w => kanji(w) && w.lv === P.lv), ...P.words.filter(w => kanji(w) && w.lv !== P.lv), ...P.words.filter(w => !kanji(w))]
  const words = [...new Map(ranked.map(w => [w.t, w])).values()].slice(0, 3)
    .sort((a, b) => text.indexOf(a.t) - text.indexOf(b.t))
    .map(w => ({ t: w.t, r: w.r, gloss: (w[lang] || w.en || [])[0] || '' }))
  // The question about what the text says, never about its grammar.
  const Q = P.questions.find(q => q.type === 'comprehension') ?? P.questions[0]
  const q = { ask: Q.question[lang] || Q.question.en, choices: Q.options[lang] || Q.options.en, right: Q.correct }
  return {
    source: 'challenge', id: P.id, lang, lv: P.lv, style, hour, title: P.title, sents, words, q, music: opts.music || null,
    chars: sents.reduce((n, rows) => n + charsOf(rows), 0), cpm: CPM[P.lv] || CPM.N3, ruby: RUBY.has(P.lv), slow: SLOW.has(P.lv),
  }
}

/** The lines the reader says: one a sentence, read along. */
export function challengeCues(plan) {
  return plan.style === 'along' ? plan.sents.map(rows => ({ text: sentenceText(rows), who: 'reader', slow: plan.slow, marks: true })) : []
}
export const cueKey = c => `${c.who}|${c.slow ? 'slow' : ''}|${c.text}`

/** When each word of a sentence is said, from `at` (the voice's start):
 *  on the engine's own syllables where they count as the text's, else
 *  in proportion to each word's syllables. */
export function wordTimes(rows, at, dur, marks = null) {
  const counts = rows.map(moraeOf)
  const total = counts.reduce((a, b) => a + b, 0)
  const said = (marks || []).filter(m => !m.p)
  const out = []
  let n = 0
  rows.forEach((row, i) => {
    if (said.length === total && total) out.push(at + (said[Math.min(n, said.length - 1)].t))
    else out.push(at + 0.1 + (dur - 0.2) * (total ? n / total : i / rows.length))
    n += counts[i]
  })
  return out
}

/** The video, timed. `voiced(cue)` gives a voiced line's { dur, marks }
 *  (render.mjs, after the engine has said it); without it a line is
 *  timed on a guess at the reader's pace. */
export function challengeTimeline(plan, voiced = null) {
  const segs = []
  const sfx = [{ at: 0.15, key: 'board-flap' }]
  const cues = []
  const lines = []
  let t = 0
  const seg = (key, dur) => { segs.push({ key, start: +t.toFixed(3), dur: +dur.toFixed(3) }); t += dur }
  seg('hook', CH.hook)
  seg('words', CH.words)
  const from = t
  if (plan.style === 'scroll') {
    // The whole text past the reading line at the level's pace, a moment
    // for it to come in before and the last line's read after.
    t += CH.into + plan.chars / (plan.cpm / 60) + CH.out
  } else {
    plan.sents.forEach((rows, i) => {
      const cue = { text: sentenceText(rows), who: 'reader', slow: plan.slow, marks: true }
      const v = voiced?.(cue)
      // A guess: the engine's pace, about 0.15 s a syllable (0.18 slowed), its pauses and pads.
      const guess = 0.25 + rows.reduce((n, r) => n + moraeOf(r), 0) * (plan.slow ? 0.18 : 0.15) + rows.filter(r => r.t === '、').length * 0.25
      const dur = v?.dur ?? guess
      const at = t + CH.lead
      cues.push({ ...cue, at: +at.toFixed(3) })
      lines.push({ i, at: +t.toFixed(3), voice: +at.toFixed(3), dur: +dur.toFixed(3), words: wordTimes(rows, at, dur, v?.marks).map(x => +x.toFixed(3)) })
      t = at + dur + CH.gap
    })
  }
  segs.push({ key: 'reading', start: +from.toFixed(3), dur: +(t - from).toFixed(3) })
  const qAt = t
  seg('question', CH.ask + CH.count)
  for (let k = 0; k < CH.count; k++) sfx.push({ at: +(qAt + CH.ask + k).toFixed(3), key: 'click', gain: 0.35 })
  sfx.push({ at: +t.toFixed(3), key: 'correct' })
  seg('answer', CH.answer)
  sfx.push({ at: +(t + 0.5).toFixed(3), key: 'platform-chime' })
  seg('cta', CH.cta)
  segs.sort((a, b) => a.start - b.start)
  const reading = +(segs.find(s => s.key === 'reading').dur).toFixed(1)
  return {
    seconds: +t.toFixed(3), segs, lines, cues, sfx, reading,
    // The scroll at sixty frames a second, so its slow climb glides; the one read along at thirty.
    fps: plan.style === 'scroll' ? 60 : 30,
    // The owner's music under it, if any: a video read in silence is kept calm.
    bed: plan.music ? { src: plan.music } : null, loudness: plan.music || plan.style === 'along' ? -16 : -20,
    chapters: segs.map(s => ({ at: s.start, title: s.key })),
  }
}

/** The command that makes it, from frontend/ (the voice engine running for `along`). */
export function challengeCommand(plan) {
  const voice = plan.style === 'along' ? 'VOICEVOX_URL=http://localhost:50121 ' : ''
  const music = plan.music ? ` --music "${plan.music}"` : ''
  return `${voice}node carousel/long/render.mjs --challenge ${plan.id} --style ${plan.style} --hour ${plan.hour} --lang ${plan.lang}${music}`
}

/** The video's page: its title, its description, its tags. */
export function challengePage(plan, tl, site) {
  const S = W[plan.lang]
  const tags = [...S.tags, `jlpt${plan.lv.toLowerCase()}`, '日本語', '読解']
  const lines = [
    `${plan.title} · JLPT ${plan.lv} · ${S.sentences(plan.sents.length)} · ${clock(tl.reading)}`,
    S.body[plan.style],
    S.site(site),
    plan.style === 'along' ? S.credit : null,
    tags.map(x => `#${x}`).join(' '),
  ].filter(Boolean)
  return { title: S.title(plan.lv, plan.title), description: lines.join('\n\n'), tags: tags.join(', ') }
}

// ── Drawing ──────────────────────────────────────────────────────
const FMT = FORMATS.story
const fr = frame(FMT)
const TOP = fr.y + 64 + SP[7]
// Laid out once a plan and a size, on the context that draws them.
const layouts = new Map()
function layOf(ctx, plan, i, z, w, { maxLines = 6, min = FS.title, fam = 'serif' } = {}) {
  const key = `${plan.id}|${plan.lang}|${i}|${z}|${w}|${maxLines}|${min}|${fam}`
  if (!layouts.has(key)) layouts.set(key, layoutSentence(ctx, plan.sents[i], { max: z, min, maxW: w, maxLines, fam, script: plan.ruby ? 'furigana' : 'kanji', rules: false, gap: 0.02 }))
  return layouts.get(key)
}

// The hour's print under it: darkened where the words go (`dark`), or
// washed whole with the app's paper, the words in ink over it.
function backdrop(ctx, P, T, dark = 0.5, hour = 'day') {
  if (P) drawPrint(ctx, P, 0, 0, FMT.w / P.scene.w, { W: FMT.w, H: FMT.h })
  else { ctx.fillStyle = T.ground === 'paper' ? PAPER.card : '#17151a'; ctx.fillRect(0, 0, FMT.w, FMT.h) }
  if (T.ground === 'paper') {
    ctx.fillStyle = alpha(PAPER.bg, WASH[hour] ?? WASH.day)
    ctx.fillRect(0, 0, FMT.w, FMT.h)
    return
  }
  // The sky darkened where the words go, so they read at every hour.
  const g = ctx.createLinearGradient(0, 0, 0, FMT.h * 0.72)
  g.addColorStop(0, `rgba(12,10,22,${dark})`)
  g.addColorStop(0.7, `rgba(12,10,22,${dark * 0.6})`)
  g.addColorStop(1, 'rgba(12,10,22,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, FMT.w, FMT.h * 0.72)
}
// How much of the paper lies over the print at each hour: the picture
// is still there, the ink reads over all of it, and the page stays
// paper, never the grey a dark sky washed thin would leave.
const WASH = { dawn: 0.72, day: 0.72, dusk: 0.82, night: 0.88 }

function masthead(ctx, T) {
  mark(ctx, fr.x, fr.y, 64, T.ink, T.road)
  text(ctx, 'TSUJI', fr.x + 64 + SP[4], fr.y + 64 * 0.66, { f: font(700, FS.caption, 'latin'), color: T.ink })
}
function chip(ctx, T, label, x, y, { align = 'left', z = FS.sm } = {}) {
  const f = font(700, z, 'latin')
  const w = measure(ctx, label, f) + SP[5] * 2
  const h = z * 1.9
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
  ctx.fillStyle = T.chip
  rrect(ctx, x0, y, w, h, h / 2)
  ctx.fill()
  text(ctx, label, x0 + SP[5], y + h / 2 + z * 0.36, { f, color: T.chipInk })
  return h
}
const shade = (ctx, on) => { ctx.shadowColor = on ? 'rgba(0,0,0,0.55)' : 'transparent'; ctx.shadowBlur = on ? 16 : 0; ctx.shadowOffsetY = on ? 2 : 0 }
function lines(ctx, T, str, y, sizes, { weight = 800, fam = 'latin', color = T.ink, maxLines = 3, lh = 1.15, k = 1 } = {}) {
  const b = fit(ctx, str, { weight, fam, sizes, maxW: fr.w, maxLines, lh })
  ctx.save()
  ctx.globalAlpha *= k
  shade(ctx, T.shadow)
  b.lines.forEach((l, i) => text(ctx, l, fr.cx, y + (1 - k) * 18 + b.size * (0.85 + i * lh), { f: b.f, color, align: 'center' }))
  ctx.restore()
  return y + b.size * lh * b.lines.length
}
function panel(ctx, T, x, y, w, h, fill = T.panel) {
  ctx.fillStyle = fill
  rrect(ctx, x, y, w, h, R.card * 2)
  ctx.fill()
  if (T.edge && fill === T.panel) {
    ctx.strokeStyle = T.edge
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

/** Any second of the video. `P` is the hour's print (app.js loadPrint), or null. */
export function drawChallenge(ctx, plan, tl, t, P = null) {
  const s = tl.segs.find(x => t < x.start + x.dur) ?? tl.segs.at(-1)
  const into = t - s.start
  const T = lookOf(plan)
  ctx.save()
  if (s.key === 'hook') hook(ctx, plan, tl, into, P, T)
  else if (s.key === 'words') words(ctx, plan, into, P, T)
  else if (s.key === 'reading') (plan.style === 'scroll' ? scroll : along)(ctx, plan, tl, t, P)
  else if (s.key === 'question') question(ctx, plan, into, false, P, T)
  else if (s.key === 'answer') question(ctx, plan, into, true, P, T)
  else cta(ctx, plan, into, P, T)
  ctx.restore()
}

function hook(ctx, plan, tl, into, P, T) {
  const S = W[plan.lang]
  backdrop(ctx, P, T, 0.5, plan.hour)
  masthead(ctx, T)
  const k = ease(into / 0.6)
  let y = TOP + 90
  y = lines(ctx, T, S.hook[plan.style], y, [FS.display * 0.95, FS.display * 0.75], { weight: 900, fam: 'serif', lh: 1.08, k })
  y += SP[6]
  y = lines(ctx, T, plan.title, y, [FS.heading, FS.title], { weight: 700, fam: 'serif', color: T.title, maxLines: 2, k: ease((into - 0.3) / 0.6) })
  y += SP[6]
  ctx.save()
  ctx.globalAlpha *= ease((into - 0.6) / 0.6)
  chip(ctx, T, `JLPT ${plan.lv} · ${S.sentences(plan.sents.length)} · ${clock(tl.reading)}`, fr.cx, y, { align: 'center', z: FS.body })
  ctx.restore()
}

function words(ctx, plan, into, P, T) {
  const S = W[plan.lang]
  backdrop(ctx, P, T, 0.5, plan.hour)
  masthead(ctx, T)
  let y = lines(ctx, T, S.words, TOP + 40, [FS.heading, FS.title]) + SP[6]
  const h = 168
  plan.words.forEach((w, i) => {
    const k = ease((into - 0.3 - i * 0.35) / 0.5)
    ctx.save()
    ctx.globalAlpha *= k
    panel(ctx, T, fr.x, y + (1 - k) * 20, fr.w, h)
    text(ctx, w.r, fr.x + SP[5], y + 52, { f: font(500, FS.body, 'jp'), color: T.title })
    const tb = fit(ctx, w.t, { weight: 700, fam: 'serif', sizes: [FS.display * 0.68, FS.heading], maxW: fr.w * 0.5, maxLines: 1 })
    text(ctx, tb.lines[0], fr.x + SP[5], y + 136, { f: tb.f, color: T.ink })
    const gb = fit(ctx, w.gloss, { weight: 600, sizes: [FS.lead, FS.body, FS.sm], maxW: fr.w * 0.44, maxLines: 2, lh: 1.15 })
    gb.lines.forEach((l, j) => text(ctx, l, fr.right - SP[5], y + h / 2 + gb.size * (0.36 + (j - (gb.lines.length - 1) / 2) * 1.15), { f: gb.f, color: T.ink, align: 'right' }))
    ctx.restore()
    y += h + SP[5]
  })
}

const PAD = SP[5]

// scroll: the text going slowly up the screen, as a film's credits do
// (the owner's reference): at one size, in ink on the washed print, on
// short airy lines broken between phrases, each sentence on a line of
// its own. (The reference also leaves a space between phrases; the
// bank's words are not cut surely enough for that: としょかん written
// in kana comes out as はと・しょ・か・ん.) It comes in with its first line at the
// reading line (READ) and moves at one speed, the whole text past that
// line in the time a learner of its level reads it; it fades under the
// masthead (HEAD) and at the frame's foot (FOOT).
export const SCROLL = { z: FS.title, head: fr.y + 64 + SP[6], foot: fr.bottom, fade: 140, read: fr.y + 640 }
// The scroll's rows, laid out once: each sentence's lines, a pause between two sentences.
const rowsOf = new Map()
function scrollRows(ctx, plan) {
  const key = `${plan.id}|${plan.lang}`
  if (rowsOf.has(key)) return rowsOf.get(key)
  const rows = []
  plan.sents.forEach((_, i) => {
    // Every sentence at the one size, on as many lines as it takes.
    const L = layOf(ctx, plan, i, SCROLL.z, fr.w, { maxLines: 12, min: SCROLL.z, fam: 'jp' })
    L.lines.forEach((line, li) => rows.push({ i, L: { ...L, lines: [line] }, h: L.lineH + SCROLL.z * 0.7 + (li === L.lines.length - 1 ? SCROLL.z * 0.6 : 0) }))
  })
  const out = { rows, length: rows.reduce((n, r) => n + r.h, 0) }
  rowsOf.set(key, out)
  return out
}
// The text is drawn once, on a strip of its own, and each frame lays the
// strip where the text has come to: text drawn straight on the frame is
// set on whole pixels, so a line climbing 1.5 px a frame steps by one
// pixel, then two, and shakes; an image is laid between pixels, and
// glides. Where there is no canvas to draw it on (the tests), it is drawn
// line by line, in the same places.
const canvasOf = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h)
  : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : null)
const BLEED = SP[6]
let strip = null
let layer = null
function stripOf(ctx, plan, rows, length, T) {
  const key = `${plan.id}|${plan.lang}`
  if (strip?.key === key) return strip.c
  const c = canvasOf(Math.ceil(fr.w + BLEED * 2), Math.ceil(length + BLEED * 2))
  if (!c) return null
  const x = c.getContext('2d')
  let y = BLEED
  for (const row of rows) {
    drawSentence(x, row.L, c.width / 2, y, 'center', () => ({ ink: T.ink, rule: null, ruby: T.ruby }))
    y += row.h
  }
  strip = { key, c }
  return c
}
// Faint where the text comes up from the foot and where it goes under the masthead.
function fades(x) {
  const g = x.createLinearGradient(0, SCROLL.head, 0, SCROLL.foot + SCROLL.fade)
  const at = y => (y - SCROLL.head) / (SCROLL.foot + SCROLL.fade - SCROLL.head)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(at(SCROLL.head + SCROLL.fade), 'rgba(0,0,0,1)')
  g.addColorStop(at(SCROLL.foot), 'rgba(0,0,0,1)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  return g
}
function scroll(ctx, plan, tl, t, P) {
  const T = LOOK.paper
  backdrop(ctx, P, T, 0.5, plan.hour)
  masthead(ctx, T)
  const seg = tl.segs.find(x => x.key === 'reading')
  const { rows, length } = scrollRows(ctx, plan)
  // One speed: the whole text past the reading line in its reading time.
  const speed = length / (plan.chars / (plan.cpm / 60))
  const off = speed * Math.max(0, t - seg.start - CH.into)
  const k = ease((t - seg.start) / 0.6)
  const top = SCROLL.read - off
  // The sentence at the reading line: the last one to have reached it.
  let reading = 0
  let y = top
  for (const row of rows) {
    if (y <= SCROLL.read + 1) reading = row.i
    y += row.h
  }
  const c = stripOf(ctx, plan, rows, length, T)
  if (!layer && c) layer = canvasOf(FMT.w, FMT.h)
  if (c && layer) {
    // The strip on a layer the frame's size, faded at its head and foot, then laid on the frame.
    const x = layer.getContext('2d')
    x.globalCompositeOperation = 'source-over'
    x.clearRect(0, 0, FMT.w, FMT.h)
    x.drawImage(c, fr.cx - c.width / 2, top - BLEED)
    x.globalCompositeOperation = 'destination-in'
    x.fillStyle = fades(x)
    x.fillRect(0, 0, FMT.w, FMT.h)
    ctx.save()
    ctx.globalAlpha *= k
    ctx.drawImage(layer, 0, 0)
    ctx.restore()
  } else {
    y = top
    for (const row of rows) {
      const mid = y + row.L.lineH / 2
      const a = Math.min(1, (mid - SCROLL.head) / SCROLL.fade, (SCROLL.foot + SCROLL.fade - mid) / SCROLL.fade)
      if (a > 0.01) {
        ctx.save()
        ctx.globalAlpha *= a * k
        drawSentence(ctx, row.L, fr.cx, y, 'center', () => ({ ink: T.ink, rule: null, ruby: T.ruby }))
        ctx.restore()
      }
      y += row.h
    }
  }
  chip(ctx, T, `JLPT ${plan.lv} · ${reading + 1} / ${plan.sents.length}`, fr.right, fr.y + 6, { align: 'right' })
}

// along: the text on one panel, each word gold once said, the word being
// said underlined; the panel turns to the next sentence when it would
// run past its foot.
const ALONG_Z = FS.title * 1.15
function along(ctx, plan, tl, t, P) {
  const S = W[plan.lang]
  const T = LOOK.dark
  backdrop(ctx, P, T, 0.42)
  masthead(ctx, T)
  const tw = fr.w - PAD * 2
  const top = TOP
  const foot = fr.bottom - FS.sm * 2.4
  panel(ctx, T, fr.x, top, fr.w, foot - top)
  text(ctx, S.voice, fr.cx, fr.bottom - FS.sm * 0.6, { f: font(600, FS.sm, 'latin'), color: alpha(LIGHT, 0.75), align: 'center' })
  // Where each sentence stands in the column, and where the column is turned to.
  const Ls = plan.sents.map((_, i) => layOf(ctx, plan, i, ALONG_Z, tw))
  const ys = []
  let y = 0
  for (const L of Ls) { ys.push(y); y += L.h + SP[5] }
  const room = foot - top - PAD * 2
  const turns = [0]
  Ls.forEach((L, i) => { if (i) turns.push(ys[i] + L.h - turns[i - 1] > room ? ys[i] : turns[i - 1]) })
  const now = tl.lines.reduce((n, l, i) => (t >= l.at ? i : n), 0)
  chip(ctx, T, `JLPT ${plan.lv} · ${now + 1} / ${tl.lines.length}`, fr.right, fr.y + 6, { align: 'right' })
  const prev = turns[Math.max(0, now - 1)]
  const k = now && turns[now] !== prev ? ease((t - tl.lines[now].at) / CH.turn) : 1
  const off = prev + (turns[now] - prev) * k
  ctx.save()
  ctx.beginPath()
  ctx.rect(fr.x, top + PAD * 0.5, fr.w, foot - top - PAD)
  ctx.clip()
  Ls.forEach((L, i) => {
    const yy = top + PAD + ys[i] - off
    // Only a sentence whole on the panel: the next comes in when it is turned to.
    if (yy + L.h > foot - PAD * 0.5 || yy + L.h < top) return
    const line = tl.lines[i]
    const rows = plan.sents[i]
    drawSentence(ctx, L, fr.x + PAD, yy, 'left', u => {
      const n = Math.max(0, rows.indexOf(u.row))
      const said = t >= line.words[n]
      // Being said until the next word starts, or the voice stops.
      const next = line.words.find((x, j) => j > n && x > line.words[n]) ?? line.voice + line.dur
      const saying = said && t < next
      return { ink: said ? GOLD : LIGHT, rule: saying ? GOLD : null, ruleW: 6, ruby: said ? GOLD : alpha(RUBY_INK, 0.85) }
    })
  })
  ctx.restore()
}

function question(ctx, plan, into, answered, P, T) {
  const S = W[plan.lang]
  backdrop(ctx, P, T, 0.5, plan.hour)
  masthead(ctx, T)
  let y = lines(ctx, T, plan.q.ask, TOP + 30, [FS.heading, FS.title, FS.lead, FS.body], { maxLines: 4 }) + SP[6]
  plan.q.choices.forEach((c, i) => {
    const right = answered && i === plan.q.right
    const b = fit(ctx, c, { weight: 700, sizes: [FS.lead, FS.body, FS.sm], maxW: fr.w - 150, maxLines: 3, lh: 1.15 })
    const h = Math.max(116, b.size * 1.15 * b.lines.length + SP[6])
    const k = answered ? 1 : ease((into - 0.4 - i * 0.18) / 0.4)
    ctx.save()
    ctx.globalAlpha *= k * (answered && !right ? 0.45 : 1)
    panel(ctx, T, fr.x, y, fr.w, h, right ? CORRECT : T.panel)
    ctx.fillStyle = right ? '#10201f' : T.dot
    ctx.beginPath()
    ctx.arc(fr.x + 62, y + h / 2, 34, 0, Math.PI * 2)
    ctx.fill()
    text(ctx, 'ABCD'[i], fr.x + 62, y + h / 2 + 14, { f: font(800, FS.lead, 'latin'), color: right ? CORRECT : T.ink, align: 'center' })
    b.lines.forEach((l, j) => text(ctx, l, fr.x + 120, y + h / 2 + b.size * (0.36 + (j - (b.lines.length - 1) / 2) * 1.15), { f: b.f, color: right ? '#10201f' : T.ink }))
    ctx.restore()
    y += h + SP[4]
  })
  y += SP[6]
  if (!answered) {
    // Five seconds to answer, as the clicks count them.
    const left = Math.max(0, CH.count - Math.max(0, into - CH.ask))
    const r = 54
    ctx.strokeStyle = T.track
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(fr.cx, y + r, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = T.ring
    ctx.beginPath()
    ctx.arc(fr.cx, y + r, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / CH.count))
    ctx.stroke()
    text(ctx, String(Math.ceil(left) || ''), fr.cx, y + r + 18, { f: font(800, FS.heading, 'latin'), color: T.ink, align: 'center' })
    lines(ctx, T, S.comments, y + r * 2 + SP[4], [FS.body], { weight: 600, maxLines: 1 })
  } else {
    lines(ctx, T, S.gotIt, y, [FS.title, FS.lead], { weight: 700, maxLines: 1, k: ease((into - 0.4) / 0.5) })
  }
}

function cta(ctx, plan, into, P, T) {
  const S = W[plan.lang]
  backdrop(ctx, P, T, 0.62, plan.hour)
  masthead(ctx, T)
  let y = TOP + 70
  y = lines(ctx, T, plan.title, y, [FS.display * 0.8, FS.heading], { weight: 900, fam: 'serif', maxLines: 2, lh: 1.08, k: ease(into / 0.6) })
  y += SP[6]
  y = lines(ctx, T, S.more, y, [FS.heading, FS.title], { weight: 700, maxLines: 3, k: ease((into - 0.3) / 0.6) })
  y += SP[7]
  ctx.save()
  ctx.globalAlpha *= ease((into - 0.6) / 0.6)
  chip(ctx, T, S.free, fr.cx, y, { align: 'center', z: FS.body })
  ctx.restore()
  // The way to the app, the call to action's address bar (plan 245).
  const k = ease((into - 0.5) / 0.6)
  ctx.save()
  ctx.globalAlpha *= k
  address(ctx, palette(T.ground), fr.x, fr.bottom - METAL_H + (1 - k) * 30, fr.w, SITE)
  ctx.restore()
}
