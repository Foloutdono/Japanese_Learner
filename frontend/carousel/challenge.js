// ── 速読 — the reading challenge (plan 247) ───────────────────────
// A comprehension text read as a 9:16 video over Today's print, in one
// of two ways: `crawl`, the whole text coming slowly up from the foot of
// the screen on a plane tipped away from the viewer, as a film's opening
// crawl does, read at its largest in the lower half and growing smaller
// as it goes up into the sky (the owner's own picture of it); `along`,
// the text standing while the app's reader says it, each word lit as it
// is said (the owner's pick D of four drawn). Before it the hook and three
// of its words; after it one of its questions, asked and answered, and the
// way to the app. Under it, a track of the owner's own music, or nothing.
//
// Everything a viewer must read is set large and light on the darkened
// sky or on a dark panel, so it reads at every hour of the print.
//
// Pure but for the canvas it draws on: `challengeTimeline` times the
// video (on the voice's own lengths and syllables where it is voiced,
// else on a close guess), `drawChallenge` draws any second of it.
import { FS, SP, R, METAL_H, RATING_INKS, FORMATS, address, alpha, drawSentence, fit, font, frame, layoutSentence, mark, measure, palette, reading, rrect, text } from './draw.js'
import { drawPrint } from './app.js'
import { unpack } from './common.js'
import { SITE } from './strings.js'

export const STYLES = ['crawl', 'along']
export const HOURS = ['dawn', 'day', 'dusk', 'night']
// A learner's pace at each level, in characters a minute: the crawl
// carries the text past the reading line at this pace.
export const CPM = { N5: 180, N4: 200, N3: 240, N2: 280, N1: 320 }
// Readings over the kanji where a learner of the level still needs them.
const RUBY = new Set(['N5', 'N4', 'N3'])
// The read-along voice slows for the first two levels, as a card's slow line does.
const SLOW = new Set(['N5', 'N4'])
// The video's beats, in seconds.
export const CH = {
  fps: 30, hook: 3.2, words: 5.5,
  // crawl: the first line comes up into the frame for INTO seconds before
  // the reading line, and the last is still read for OUT seconds after it.
  into: 2.5, out: 4,
  // along: the voice starts LEAD after its sentence is due, a GAP between two.
  lead: 0.35, gap: 0.3, turn: 0.35,
  ask: 2.2, count: 5, answer: 3.6, cta: 5.2,
}

const LIGHT = '#f3ecdf'
const GOLD = '#e6bd62'
const RUBY_INK = '#f1d08a'
const PANEL = 'rgba(16,14,19,0.62)'
const CORRECT = RATING_INKS['--rating-correct']

const W = {
  en: {
    hook: { crawl: 'Can you read this?', along: 'Read along. Can you keep up?' },
    sentences: n => `${n} sentences`,
    chars: n => `${n} characters`,
    words: 'Three words first',
    comments: 'Answer in the comments',
    gotIt: 'Did you get it?',
    more: 'Texts like this one, N5 to N1, each with its questions',
    free: 'Free · in your browser',
    voice: 'Voice · VOICEVOX Nemo',
    title: (lv, t) => `Can you read this Japanese text? JLPT ${lv} reading challenge: ${t}`,
    body: { crawl: 'Read the text as it scrolls up, then answer the question.', along: 'Read along with the voice, word by word, then answer the question.' },
    site: site => `More texts like this one, each with its questions, on Tsuji: ${site}`,
    credit: 'Voice: VOICEVOX Nemo.',
    tags: ['japanese', 'learnjapanese', 'japanesereading', 'jlpt'],
  },
  fr: {
    hook: { crawl: 'Tu arrives à lire ça ?', along: 'Lis avec la voix. Tu suis ?' },
    sentences: n => `${n} phrases`,
    chars: n => `${n} caractères`,
    words: 'D’abord, trois mots',
    comments: 'Réponds en commentaire',
    gotIt: 'Tu avais trouvé ?',
    more: 'Des textes comme celui-ci, du N5 au N1, avec leurs questions',
    free: 'Gratuit · dans ton navigateur',
    voice: 'Voix · VOICEVOX Nemo',
    title: (lv, t) => `Tu arrives à lire ce texte japonais ? Défi lecture JLPT ${lv} : ${t}`,
    body: { crawl: 'Lis le texte pendant qu’il défile, puis réponds à la question.', along: 'Lis avec la voix, mot à mot, puis réponds à la question.' },
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
  const style = STYLES.includes(opts.style) ? opts.style : 'crawl'
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
  if (plan.style === 'crawl') {
    // The whole text past the reading line at the level's pace, the first
    // line's way up to it before and the last line's read after.
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
function layOf(ctx, plan, i, z, w, { maxLines = 6, min = FS.title } = {}) {
  const key = `${plan.id}|${plan.lang}|${i}|${z}|${w}|${maxLines}|${min}`
  if (!layouts.has(key)) layouts.set(key, layoutSentence(ctx, plan.sents[i], { max: z, min, maxW: w, maxLines, script: plan.ruby ? 'furigana' : 'kanji', rules: false, gap: 0.02 }))
  return layouts.get(key)
}

function sky(ctx, P, dark = 0.5) {
  if (P) drawPrint(ctx, P, 0, 0, FMT.w / P.scene.w, { W: FMT.w, H: FMT.h })
  else { ctx.fillStyle = '#17151a'; ctx.fillRect(0, 0, FMT.w, FMT.h) }
  // The sky darkened where the words go, so they read at every hour.
  const g = ctx.createLinearGradient(0, 0, 0, FMT.h * 0.72)
  g.addColorStop(0, `rgba(12,10,22,${dark})`)
  g.addColorStop(0.7, `rgba(12,10,22,${dark * 0.6})`)
  g.addColorStop(1, 'rgba(12,10,22,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, FMT.w, FMT.h * 0.72)
}

function masthead(ctx) {
  mark(ctx, fr.x, fr.y, 64, LIGHT, GOLD)
  text(ctx, 'TSUJI', fr.x + 64 + SP[4], fr.y + 64 * 0.66, { f: font(700, FS.caption, 'latin'), color: LIGHT })
}
function chip(ctx, label, x, y, { align = 'left', z = FS.sm, fill = PANEL, ink = LIGHT } = {}) {
  const f = font(700, z, 'latin')
  const w = measure(ctx, label, f) + SP[5] * 2
  const h = z * 1.9
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
  ctx.fillStyle = fill
  rrect(ctx, x0, y, w, h, h / 2)
  ctx.fill()
  text(ctx, label, x0 + SP[5], y + h / 2 + z * 0.36, { f, color: ink })
  return h
}
const shade = (ctx, on) => { ctx.shadowColor = on ? 'rgba(0,0,0,0.55)' : 'transparent'; ctx.shadowBlur = on ? 16 : 0; ctx.shadowOffsetY = on ? 2 : 0 }
function lines(ctx, str, y, sizes, { weight = 800, fam = 'latin', color = LIGHT, maxLines = 3, lh = 1.15, k = 1 } = {}) {
  const b = fit(ctx, str, { weight, fam, sizes, maxW: fr.w, maxLines, lh })
  ctx.save()
  ctx.globalAlpha *= k
  shade(ctx, true)
  b.lines.forEach((l, i) => text(ctx, l, fr.cx, y + (1 - k) * 18 + b.size * (0.85 + i * lh), { f: b.f, color, align: 'center' }))
  ctx.restore()
  return y + b.size * lh * b.lines.length
}
const panel = (ctx, x, y, w, h, fill = PANEL) => { ctx.fillStyle = fill; rrect(ctx, x, y, w, h, R.card * 2); ctx.fill() }

/** Any second of the video. `P` is the hour's print (app.js loadPrint), or null. */
export function drawChallenge(ctx, plan, tl, t, P = null) {
  const s = tl.segs.find(x => t < x.start + x.dur) ?? tl.segs.at(-1)
  const into = t - s.start
  ctx.save()
  if (s.key === 'hook') hook(ctx, plan, tl, into, P)
  else if (s.key === 'words') words(ctx, plan, into, P)
  else if (s.key === 'reading') (plan.style === 'crawl' ? crawl : along)(ctx, plan, tl, t, P)
  else if (s.key === 'question') question(ctx, plan, into, false, P)
  else if (s.key === 'answer') question(ctx, plan, into, true, P)
  else cta(ctx, plan, into, P)
  ctx.restore()
}

function hook(ctx, plan, tl, into, P) {
  const S = W[plan.lang]
  sky(ctx, P)
  masthead(ctx)
  const k = ease(into / 0.6)
  let y = TOP + 90
  y = lines(ctx, S.hook[plan.style], y, [FS.display * 0.95, FS.display * 0.75], { weight: 900, fam: 'serif', lh: 1.08, k })
  y += SP[6]
  y = lines(ctx, plan.title, y, [FS.heading, FS.title], { weight: 700, fam: 'serif', color: RUBY_INK, maxLines: 2, k: ease((into - 0.3) / 0.6) })
  y += SP[6]
  ctx.save()
  ctx.globalAlpha *= ease((into - 0.6) / 0.6)
  chip(ctx, `JLPT ${plan.lv} · ${S.sentences(plan.sents.length)} · ${clock(tl.reading)}`, fr.cx, y, { align: 'center', z: FS.body })
  ctx.restore()
}

function words(ctx, plan, into, P) {
  const S = W[plan.lang]
  sky(ctx, P)
  masthead(ctx)
  let y = lines(ctx, S.words, TOP + 40, [FS.heading, FS.title]) + SP[6]
  const h = 168
  plan.words.forEach((w, i) => {
    const k = ease((into - 0.3 - i * 0.35) / 0.5)
    ctx.save()
    ctx.globalAlpha *= k
    panel(ctx, fr.x, y + (1 - k) * 20, fr.w, h)
    text(ctx, w.r, fr.x + SP[5], y + 52, { f: font(500, FS.body, 'jp'), color: RUBY_INK })
    const tb = fit(ctx, w.t, { weight: 700, fam: 'serif', sizes: [FS.display * 0.68, FS.heading], maxW: fr.w * 0.5, maxLines: 1 })
    text(ctx, tb.lines[0], fr.x + SP[5], y + 136, { f: tb.f, color: LIGHT })
    const gb = fit(ctx, w.gloss, { weight: 600, sizes: [FS.lead, FS.body, FS.sm], maxW: fr.w * 0.44, maxLines: 2, lh: 1.15 })
    gb.lines.forEach((l, j) => text(ctx, l, fr.right - SP[5], y + h / 2 + gb.size * (0.36 + (j - (gb.lines.length - 1) / 2) * 1.15), { f: gb.f, color: LIGHT, align: 'right' }))
    ctx.restore()
    y += h + SP[5]
  })
}

const PAD = SP[5]

// crawl: the text on a plane tipped away from the viewer. A line comes up
// from the foot of the screen at its largest, is read in the lower half
// (the reading line, READ), and grows smaller and fainter as it climbs
// into the sky. Its size at a height is in proportion to that height's
// distance from the vanishing line, its letters a little flattened
// (ASPECT), and the plane moves at one speed, so a line slows as it
// recedes, as a film's opening crawl does.
export const CRAWL = {
  z: FS.heading, title: FS.display * 0.8, aspect: 0.88,
  enter: FMT.h, ref: fr.bottom, vanish: fr.y - 420, fade: fr.y + 90,
  read: fr.bottom - 200, clear: fr.y + 520,
}
const SPAN = CRAWL.ref - CRAWL.vanish
const yAt = u => CRAWL.vanish + (CRAWL.enter - CRAWL.vanish) * Math.exp(-CRAWL.aspect * u / SPAN)
const uAt = y => (SPAN / CRAWL.aspect) * Math.log((CRAWL.enter - CRAWL.vanish) / (y - CRAWL.vanish))
const scaleAt = y => (y - CRAWL.vanish) / SPAN
const TEXT_INK = RUBY_INK
// The crawl's rows, laid out once: the title, then each sentence's lines.
const rowsOf = new Map()
function crawlRows(ctx, plan) {
  const key = `${plan.id}|${plan.lang}`
  if (rowsOf.has(key)) return rowsOf.get(key)
  const tb = fit(ctx, plan.title, { weight: 900, fam: 'serif', sizes: [CRAWL.title, FS.display * 0.6], maxW: fr.w, maxLines: 2, lh: 1.1 })
  const rows = tb.lines.map(l => ({ title: l, f: tb.f, size: tb.size, h: tb.size * 1.1 }))
  rows[rows.length - 1].h += SP[8]
  plan.sents.forEach((rows0, i) => {
    // Every sentence at the one size, on as many lines as it takes.
    const L = layOf(ctx, plan, i, CRAWL.z, fr.w, { maxLines: 12, min: CRAWL.z })
    L.lines.forEach((line, li) => rows.push({ i, L: { ...L, lines: [line] }, h: L.lineH + L.lineGap + (li === L.lines.length - 1 ? SP[6] : 0) }))
  })
  const out = { rows, length: rows.reduce((n, r) => n + r.h, 0) }
  rowsOf.set(key, out)
  return out
}
function crawl(ctx, plan, tl, t, P) {
  sky(ctx, P, 0.62)
  // The whole sky darkened, the text's ground from its foot to its top.
  ctx.fillStyle = 'rgba(10,8,18,0.5)'
  ctx.fillRect(0, 0, FMT.w, FMT.h)
  masthead(ctx)
  const seg = tl.segs.find(x => x.key === 'reading')
  const { rows, length } = crawlRows(ctx, plan)
  // From the title just under the frame's foot to the last line past the
  // clear line, at one speed over the reading's length.
  const u0 = uAt(CRAWL.ref + 40)
  const u1 = uAt(CRAWL.clear) + length
  const U = u0 + (u1 - u0) * Math.min(1, Math.max(0, (t - seg.start) / seg.dur))
  let p = 0
  let reading = null
  for (const row of rows) {
    const u = U - p
    p += row.h
    if (u < 0) break
    const y = yAt(u)
    // The sentence at the reading line: the lowest one that has reached it.
    if (row.L && y <= CRAWL.read) reading = row.i
    if (y < CRAWL.fade - 40) continue
    const k = scaleAt(y)
    // Faint where it comes up from the foot and where it leaves into the sky.
    const a = Math.min(1, (CRAWL.enter - y) / (CRAWL.enter - CRAWL.ref)) * Math.min(1, (y - CRAWL.fade) / 260)
    if (a <= 0.01) continue
    ctx.save()
    ctx.globalAlpha *= a
    ctx.translate(fr.cx, y)
    ctx.scale(k, k * CRAWL.aspect)
    shade(ctx, true)
    if (row.title) text(ctx, row.title, 0, row.size * 0.85, { f: row.f, color: GOLD, align: 'center' })
    else drawSentence(ctx, row.L, 0, 0, 'center', () => ({ ink: TEXT_INK, rule: null, ruby: alpha(LIGHT, 0.9) }))
    ctx.restore()
  }
  const at = reading ?? 0
  chip(ctx, `JLPT ${plan.lv} · ${Math.min(plan.sents.length, at + 1)} / ${plan.sents.length}`, fr.right, fr.y + 6, { align: 'right' })
}

// along: the text on one panel, each word gold once said, the word being
// said underlined; the panel turns to the next sentence when it would
// run past its foot.
const ALONG_Z = FS.title * 1.15
function along(ctx, plan, tl, t, P) {
  const S = W[plan.lang]
  sky(ctx, P, 0.42)
  masthead(ctx)
  const tw = fr.w - PAD * 2
  const top = TOP
  const foot = fr.bottom - FS.sm * 2.4
  panel(ctx, fr.x, top, fr.w, foot - top)
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
  chip(ctx, `JLPT ${plan.lv} · ${now + 1} / ${tl.lines.length}`, fr.right, fr.y + 6, { align: 'right' })
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

function question(ctx, plan, into, answered, P) {
  const S = W[plan.lang]
  sky(ctx, P, 0.5)
  masthead(ctx)
  let y = lines(ctx, plan.q.ask, TOP + 30, [FS.heading, FS.title, FS.lead, FS.body], { maxLines: 4 }) + SP[6]
  plan.q.choices.forEach((c, i) => {
    const right = answered && i === plan.q.right
    const b = fit(ctx, c, { weight: 700, sizes: [FS.lead, FS.body, FS.sm], maxW: fr.w - 150, maxLines: 3, lh: 1.15 })
    const h = Math.max(116, b.size * 1.15 * b.lines.length + SP[6])
    const k = answered ? 1 : ease((into - 0.4 - i * 0.18) / 0.4)
    ctx.save()
    ctx.globalAlpha *= k * (answered && !right ? 0.45 : 1)
    panel(ctx, fr.x, y, fr.w, h, right ? CORRECT : PANEL)
    ctx.fillStyle = right ? '#10201f' : alpha(LIGHT, 0.16)
    ctx.beginPath()
    ctx.arc(fr.x + 62, y + h / 2, 34, 0, Math.PI * 2)
    ctx.fill()
    text(ctx, 'ABCD'[i], fr.x + 62, y + h / 2 + 14, { f: font(800, FS.lead, 'latin'), color: right ? CORRECT : LIGHT, align: 'center' })
    b.lines.forEach((l, j) => text(ctx, l, fr.x + 120, y + h / 2 + b.size * (0.36 + (j - (b.lines.length - 1) / 2) * 1.15), { f: b.f, color: right ? '#10201f' : LIGHT }))
    ctx.restore()
    y += h + SP[4]
  })
  y += SP[6]
  if (!answered) {
    // Five seconds to answer, as the clicks count them.
    const left = Math.max(0, CH.count - Math.max(0, into - CH.ask))
    const r = 54
    ctx.strokeStyle = alpha(LIGHT, 0.22)
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(fr.cx, y + r, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = GOLD
    ctx.beginPath()
    ctx.arc(fr.cx, y + r, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / CH.count))
    ctx.stroke()
    text(ctx, String(Math.ceil(left) || ''), fr.cx, y + r + 18, { f: font(800, FS.heading, 'latin'), color: LIGHT, align: 'center' })
    lines(ctx, S.comments, y + r * 2 + SP[4], [FS.body], { weight: 600, maxLines: 1 })
  } else {
    lines(ctx, S.gotIt, y, [FS.title, FS.lead], { weight: 700, maxLines: 1, k: ease((into - 0.4) / 0.5) })
  }
}

function cta(ctx, plan, into, P) {
  const S = W[plan.lang]
  sky(ctx, P, 0.62)
  masthead(ctx)
  let y = TOP + 70
  y = lines(ctx, plan.title, y, [FS.display * 0.8, FS.heading], { weight: 900, fam: 'serif', maxLines: 2, lh: 1.08, k: ease(into / 0.6) })
  y += SP[6]
  y = lines(ctx, S.more, y, [FS.heading, FS.title], { weight: 700, maxLines: 3, k: ease((into - 0.3) / 0.6) })
  y += SP[7]
  ctx.save()
  ctx.globalAlpha *= ease((into - 0.6) / 0.6)
  chip(ctx, S.free, fr.cx, y, { align: 'center', z: FS.body })
  ctx.restore()
  // The way to the app, the call to action's address bar (plan 245).
  const k = ease((into - 0.5) / 0.6)
  ctx.save()
  ctx.globalAlpha *= k
  address(ctx, palette('sumi'), fr.x, fr.bottom - METAL_H + (1 - k) * 30, fr.w, SITE)
  ctx.restore()
}
