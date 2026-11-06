// ── 速読 — the reading challenge (plan 247) ───────────────────────
// A comprehension text read as a 9:16 video over Today's print, in one
// of two ways: `scroll`, the whole text going slowly up the screen as a
// film's credits do, at one size, in ink on the print washed pale (the
// owner's own reference); `along`, the text standing while the app's
// reader says it, each word lit as it is said (the owner's pick D of four
// drawn). Before it the hook; after it one of its questions, asked and
// answered, and the way to the app. No music under it (plan 273): the
// reader's voice where it reads, the app's sounds. Since plan 260 the
// question is the maker's to choose (the first about what the text says
// unless chosen), its four answers dealt in a seeded order, so the right
// one stands at A, B, C or D alike across the bank. Since plan 266 the
// way to the app is the app's own reader, this text rolling up its card.
//
// Everything a viewer must read is set large, in ink on the washed print
// (scroll) or light on the darkened one (along), so it reads at every
// hour of the print. Since plan 309 the scroll's words may stand on a rim
// of the page's paper (halo.js), their readings in the text's own ink, and
// the read-along's panel is as dark as its hour needs, the voice's credit
// on it: each a dial of tune.js, at the look before until the owner turns it.
//
// Pure but for the canvas it draws on: `challengeTimeline` times the
// video (on the voice's own lengths and syllables where it is voiced,
// else on a close guess), `drawChallenge` draws any second of it.
import { FS, SP, R, METAL_H, RATING_INKS, FORMATS, address, alpha, drawSentence, fit, font, frame, layoutSentence, measure, mix, palette, reading, rrect, text } from './draw.js'
import { PRINT_SEASONS, printOf } from './app.js'
import { backdrop, canvasOf, discAt, discDrawn, liftAt } from './backdrop.js'
import { MASTHEAD, coverOn, drawCover, drawMasthead, glowMasthead } from './cover.js'
import { haloStrip } from './halo.js'
import { SCENERY_IDS, sceneryOf } from './sceneries.js'
import { seeded, shuffle, unpack } from './common.js'
import { SITE } from './strings.js'
import { tuneFlag, tuned } from './tune.js'
import { feedPosts } from './feeds.js'

export const STYLES = ['scroll', 'along']
export const HOURS = ['dawn', 'day', 'dusk', 'night']
// A learner's pace at each level, in characters a minute: the scroll
// carries the text past the reading line at this pace (two notches under
// the first one, 180 to 320, which the owner found quick, and then 150 to
// 265, still a bit quick).
export const CPM = { N5: 130, N4: 145, N3: 175, N2: 200, N1: 230 }
// Readings over the kanji where a learner of the level still needs them.
const RUBY = new Set(['N5', 'N4', 'N3'])
// The read-along voice slows for the first two levels, as a card's slow line does.
const SLOW = new Set(['N5', 'N4'])
// The video's beats, in seconds: the defaults; the tunable ones are read
// through `beat`, as the studio's Tune panel or `--tune` set them (plan 248).
export const CH = {
  hook: 3.2,
  // scroll: the text comes in for INTO seconds before it moves, and the
  // last line is still read for OUT seconds after it passes the reading line.
  into: 1, out: 4,
  // along: the voice starts LEAD after its sentence is due, a GAP between two.
  lead: 0.35, gap: 0.3, turn: 0.35,
  ask: 2.2, count: 5, answer: 3.6, cta: 6.5,
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
/** The paper look's inks as tuned (plan 309, `challenge.ruby`): the
 *  readings over the kanji from the soft ink (0, the look before) toward
 *  the text's own, as a Japanese book prints them. The soft labels and
 *  the countdown's track darken with them, at ×0.9 enough to read over
 *  the darkest of the night's print (4.5:1 and 1.8:1), the labels still
 *  lighter than the stops already reached. */
export function inksOf(plan) {
  const r = tuned(plan.tune, 'challenge.ruby')
  return { ...LOOK.paper, ruby: mix(PAPER.ink, PAPER.ink2, r), soft: mix(PAPER.ink, PAPER.ink2, 0.7 * r), track: alpha(PAPER.ink, +(0.14 + 0.24 * r).toFixed(3)) }
}
// A photo of the maker's own in place of the print (plan 276): read in
// the dark look over it, the paper's wash only where asked for.
export const PHOTO_LOOKS = ['dark', 'blur', 'paper']
/** The look a plan's words are drawn in: the paper's inks (the scroll,
 *  or a photo washed with paper), else light on the dark. */
export const lookOf = plan => (plan.photo ? (plan.photo.look === 'paper' ? inksOf(plan) : LOOK.dark) : plan.style === 'scroll' ? inksOf(plan) : LOOK.dark)

const W = {
  en: {
    hook: { scroll: 'Can you read this?', along: 'Read along. Can you keep up?' },
    sentences: n => `${n} sentences`,
    chars: n => `${n} characters`,
    comments: 'Answer in the comments',
    gotIt: 'Did you get it?',
    // Hidden (plan 275): the answer left to the comments.
    yours: ['A, B, C or D?', 'Write your answer in the comments'],
    askHidden: 'A, B, C or D? Write your answer in the comments.',
    // The way to the app (plan 266): the reader's card, then the run's stops.
    reader: 'Read it at your pace in the app',
    station: 'Reading comprehension',
    speed: v => `${v} char/s`,
    stops: n => ['Read', `${n} questions`, 'Breakdown'],
    voice: 'Voice · VOICEVOX Nemo',
    title: (lv, t) => `Can you read this Japanese text? JLPT ${lv} reading challenge: ${t}`,
    body: { scroll: 'Read the text as it scrolls up, then answer the question.', along: 'Read along with the voice, word by word, then answer the question.' },
    site: site => `More texts like this one, each with its questions, on Tsuji: ${site}`,
    app: 'More texts like this one, each with its questions, on Tsuji.',
    ask: 'Did you get it right? Tell me in the comments.',
    credit: 'Voice: VOICEVOX Nemo.',
    tags: ['japanese', 'learnjapanese', 'japanesereading', 'jlpt'],
  },
  fr: {
    hook: { scroll: 'Tu arrives à lire ça ?', along: 'Lis avec la voix. Tu suis ?' },
    sentences: n => `${n} phrases`,
    chars: n => `${n} caractères`,
    comments: 'Réponds en commentaire',
    gotIt: 'Tu avais trouvé ?',
    yours: ['A, B, C ou D ?', 'Écris ta réponse en commentaire'],
    askHidden: 'A, B, C ou D ? Écris ta réponse en commentaire.',
    reader: 'Lis-le à ton rythme dans l’app',
    station: 'Compréhension écrite',
    speed: v => `${v} car./s`,
    stops: n => ['Lire', `${n} questions`, 'Décomposition'],
    voice: 'Voix · VOICEVOX Nemo',
    title: (lv, t) => `Tu arrives à lire ce texte japonais ? Défi lecture JLPT ${lv} : ${t}`,
    body: { scroll: 'Lis le texte pendant qu’il défile, puis réponds à la question.', along: 'Lis avec la voix, mot à mot, puis réponds à la question.' },
    site: site => `D’autres textes comme celui-ci, avec leurs questions, sur Tsuji : ${site}`,
    app: 'D’autres textes comme celui-ci, avec leurs questions, sur Tsuji.',
    ask: 'Tu avais trouvé ? Dis-le-moi en commentaire.',
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
/** A beat of the video, as tuned (tune.js `challenge.*`). */
const beat = (plan, key) => tuned(plan.tune, `challenge.${key}`)
const clock = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`.replace(/:60$/, ':59')

/** The texts the challenge can read: every comprehension passage. */
export function challengeItems(data, lang = 'en') {
  return data.passages.map(P => ({ id: P.id, jp: P.title, sub: W[lang === 'fr' ? 'fr' : 'en'].chars(P.sents.map(unpack).reduce((n, rows) => n + charsOf(rows), 0)), tag: P.lv }))
}

/** The question a challenge asks unless one is chosen: the first about
 *  what the text says, never one about its grammar (1-based). */
const askedFirst = P => Math.max(0, P.questions.findIndex(q => q.type === 'comprehension')) + 1
/** A text's questions, to choose from (plan 260): each one's number
 *  (1-based, as `--question` takes it), its kind and what it asks. */
export function challengeQuestions(data, id, lang = 'en') {
  const P = data.passages.find(x => x.id === id) ?? data.passages[0]
  return P.questions.map((Q, i) => ({ n: i + 1, type: Q.type, ask: Q.question[lang] || Q.question.en, first: i + 1 === askedFirst(P) }))
}

/** A text's challenge: its sentences and one of its questions.
 *  `opts.question`: the question asked (1-based), the first about what
 *  the text says when left out or out of range. `opts.hide` (plan 275):
 *  the answer is never shown, the viewer asked for theirs in the comments. */
export function challengePlan(data, id, opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en'
  const P = data.passages.find(x => x.id === id) ?? data.passages[0]
  const style = STYLES.includes(opts.style) ? opts.style : 'scroll'
  // Day unless chosen, as the studio opens on it (plan 309; dusk before it).
  const hour = HOURS.includes(opts.hour) ? opts.hour : 'day'
  // The print's season, if chosen (plan 267); else the date's, as the app's gate.
  const season = PRINT_SEASONS.includes(opts.season) ? opts.season : null
  const sents = P.sents.map(unpack)
  const chosen = Number(opts.question)
  const qn = Number.isInteger(chosen) && chosen >= 1 && chosen <= P.questions.length ? chosen : askedFirst(P)
  const Q = P.questions[qn - 1]
  // Its answers dealt in an order seeded by the text and the question, the
  // same in both languages: the bank writes the right one first more often
  // than not, and a viewer would learn to answer A (plan 260).
  const order = shuffle(Q.options.en.map((_, i) => i), seeded(`${P.id}|${qn}`))
  const options = Q.options[lang] || Q.options.en
  const q = { n: qn, ask: Q.question[lang] || Q.question.en, choices: order.map(i => options[i]), right: order.indexOf(Q.correct) }
  return {
    source: 'challenge', id: P.id, lang, lv: P.lv, style, hour, season, title: P.title, sents, q, chosen: qn !== askedFirst(P), hidden: opts.hide !== false,
    photo: opts.photo ? { src: String(opts.photo), look: PHOTO_LOOKS.includes(opts.photoLook) ? opts.photoLook : 'dark' } : null,
    // The scenery it stands on (plan 309, sceneries.js): the bay unless
    // another is chosen; a photo stands where any print would.
    scenery: !opts.photo && SCENERY_IDS.includes(opts.scenery) ? opts.scenery : 'bay',
    chars: sents.reduce((n, rows) => n + charsOf(rows), 0), nq: P.questions.length, cpm: Math.round((CPM[P.lv] || CPM.N3) * tuned(opts.tune, 'challenge.pace')), tune: opts.tune || {}, ruby: RUBY.has(P.lv), slow: SLOW.has(P.lv),
  }
}

/** What the print under it is loaded with (app.loadPrint): its season,
 *  its scenery, and the parts of it the dials bring out (plan 309). */
export function challengePrintOpts(plan) {
  return { season: plan.season, scenery: plan.scenery, falls: tuned(plan.tune, 'challenge.falls') > 0, bursts: tuned(plan.tune, 'challenge.bursts') > 0 }
}

// The print a plan stands on, by its name: the one drawn (`P`, its B
// print read as its A), else the season's at the hour where a season is
// asked; none for the date's, which only the print drawn can say.
const printNamed = (plan, P) => (P?.name ? P.name.replace(/-b$/, '') : plan.season ? printOf(plan.season, plan.hour) : null)

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
  seg('hook', beat(plan, 'hook'))
  const from = t
  if (plan.style === 'scroll') {
    // The whole text past the reading line at the level's pace, a moment
    // for it to come in before and the last line's read after.
    t += beat(plan, 'into') + plan.chars / (plan.cpm / 60) + beat(plan, 'out')
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
      t = at + dur + beat(plan, 'gap')
    })
  }
  segs.push({ key: 'reading', start: +from.toFixed(3), dur: +(t - from).toFixed(3) })
  const qAt = t
  seg('question', beat(plan, 'ask') + beat(plan, 'count'))
  for (let k = 0; k < beat(plan, 'count'); k++) sfx.push({ at: +(qAt + beat(plan, 'ask') + k).toFixed(3), key: 'click', gain: 0.35 })
  // Hidden, nothing says which was right: the card's turn, not the right answer's chime.
  sfx.push({ at: +t.toFixed(3), key: plan.hidden ? 'card-transition' : 'correct' })
  seg('answer', beat(plan, 'answer'))
  sfx.push({ at: +(t + 0.5).toFixed(3), key: 'platform-chime' })
  // The two taps on the reader's card, heard as the app's buttons are (plan 266).
  const pace = ctaPace(beat(plan, 'cta'))
  for (const key of ['minus', 'furi']) sfx.push({ at: +(t + CTA[key] * pace).toFixed(3), key: 'click', gain: 0.5 })
  seg('cta', beat(plan, 'cta'))
  segs.sort((a, b) => a.start - b.start)
  const reading = +(segs.find(s => s.key === 'reading').dur).toFixed(1)
  return {
    seconds: +t.toFixed(3), segs, lines, cues, sfx, reading,
    // The scroll at sixty frames a second, so its slow climb glides; the one read along at thirty.
    fps: plan.style === 'scroll' ? 60 : 30,
    // A video read in silence (the scroll) is kept calmer than one read aloud.
    loudness: plan.style === 'along' ? -16 : -20,
    chapters: segs.map(s => ({ at: s.start, title: s.key })),
  }
}

/** The command that makes it, from frontend/ (the voice engine running for `along`). */
export function challengeCommand(plan) {
  const voice = plan.style === 'along' ? 'VOICEVOX_URL=http://localhost:50121 ' : ''
  // The question is named where it is not the one asked unless chosen (plan 260).
  const question = plan.chosen ? ` --question ${plan.q.n}` : ''
  // The print's season where one is chosen, else the day's the render runs on (plan 267).
  const season = plan.season ? ` --season ${plan.season}` : ''
  // The scenery where it is not the bay (plan 309).
  const scenery = plan.scenery && plan.scenery !== 'bay' ? ` --scenery ${plan.scenery}` : ''
  const hide = plan.hidden ? '' : ' --show'
  return `${voice}node carousel/long/render.mjs --challenge ${plan.id} --style ${plan.style} --hour ${plan.hour}${season}${scenery} --lang ${plan.lang}${question}${hide}${tuneFlag(plan.tune, 'challenge')}`
}

/** The video's page: its title, its description, its tags. */
export function challengePage(plan, tl, site) {
  const S = W[plan.lang]
  const tags = [...S.tags, `jlpt${plan.lv.toLowerCase()}`, '日本語', '読解']
  const credits = plan.style === 'along' ? [S.credit] : []
  const lines = [
    `${plan.title} · JLPT ${plan.lv} · ${S.sentences(plan.sents.length)} · ${clock(tl.reading)}`,
    S.body[plan.style],
    ...(plan.hidden ? [S.askHidden] : []),
    S.site(site),
    ...credits,
    tags.map(x => `#${x}`).join(' '),
  ]
  const page = { title: S.title(plan.lv, plan.title), description: lines.join('\n\n'), tags: tags.join(', ') }
  // The same video in Reels and on TikTok (plan 251), the comments asked for the answer.
  const feed = {
    hook: page.title, lines: [S.body[plan.style]], app: S.app, ask: plan.hidden ? S.askHidden : S.ask, credits,
    // Hidden, the answer is only in the comments: Instagram asks there too.
    ...(plan.hidden ? { reels: `📌 ${S.askHidden}` } : {}),
    hashtags: [S.tags[1], S.tags[0], S.tags[2], `jlpt${plan.lv.toLowerCase()}`, '日本語'],
  }
  return { ...page, feeds: feedPosts(page, feed, plan.lang) }
}

// ── Drawing ──────────────────────────────────────────────────────
const FMT = FORMATS.story
const fr = frame(FMT)
// The masthead's foot: what stands under it stands from there.
const UNDER = MASTHEAD.y + MASTHEAD.size
const TOP = UNDER + SP[7]
// Laid out once a plan and a size, on the context that draws them.
const layouts = new Map()
function layOf(ctx, plan, i, z, w, { maxLines = 6, min = FS.title, fam = 'serif' } = {}) {
  const key = `${plan.id}|${plan.lang}|${i}|${z}|${w}|${maxLines}|${min}|${fam}`
  if (!layouts.has(key)) layouts.set(key, layoutSentence(ctx, plan.sents[i], { max: z, min, maxW: w, maxLines, fam, script: plan.ruby ? 'furigana' : 'kanji', rules: false, gap: 0.02 }))
  return layouts.get(key)
}

// The masthead (cover.js, MASTHEAD). Over the print with the wash still to
// come (the moment after a cover, plan 309) it stands as the cover stands
// it (cover.js, glowMasthead), in the same ink: on a rim and a glow of the
// page's paper round the paper's ink, of night round the read-along's
// light ink, as strong as the wash still to come (`glow`, 1 − the share
// the backdrop has laid): none once the wash is in.
function masthead(ctx, T, glow = 0) {
  if (!(glow > 0.001)) return drawMasthead(ctx, T.ink, T.road)
  glowMasthead(ctx, Math.min(1, glow), T)
}
// Read along over the print raised (plan 309, challenge.lift), the
// masthead stands on the sky the print carries up, by day brighter than
// what stood there: its light ink fell to 4.0:1 at its worst on the
// river's spring day once the print was up (4.9 with it down). Raised, it
// keeps half its glow by day (its rim and shadow of night, glowMasthead),
// come in as the print rises, held from the cut where a cover hands it
// the whole glow: then 5.57 at its worst over every day print of the
// raised sceneries (the worst pixel within 2 px). At night the sky needs
// none.
const RAISED_GLOW = 0.5
/** The glow the masthead keeps over the print raised, at a moment (`seg`,
 *  `into` seconds in): none unless read along over a print, by day or at
 *  dawn or dusk, on a scenery raised with the dial on. */
export function raisedGlow(plan, T, seg, into) {
  const lift = tuned(plan.tune, 'challenge.lift')
  if (T.ground !== 'sumi' || plan.photo || plan.hour === 'night' || !sceneryOf(plan.scenery).lift || !(lift > 0)) return 0
  return RAISED_GLOW * (coverOn(plan) && seg === 'reading' ? 1 : liftAt(seg, into, lift))
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
  // Each part is told the video's own second too: what it stands on moves on that clock (plan 309).
  if (s.key === 'hook') hook(ctx, plan, tl, t, into, P, T)
  else if (s.key === 'reading') (plan.style === 'scroll' ? scroll : along)(ctx, plan, tl, t, P)
  else if (s.key === 'question') question(ctx, plan, tl, t, into, false, P, T)
  else if (s.key === 'answer') question(ctx, plan, tl, t, into, true, P, T)
  else cta(ctx, plan, tl, t, into, P, T, s.dur)
  ctx.restore()
}

/** The hook's words (plan 309): its line, the text's title, and the chip
 *  saying the level, the sentences and the reading's length. Written here
 *  once, in both languages, for the hook and for the cover (cover.js),
 *  which lays the same words on its plate. */
export function hookWords(plan, tl) {
  const S = W[plan.lang]
  return { hook: S.hook[plan.style], title: plan.title, chip: `JLPT ${plan.lv} · ${S.sentences(plan.sents.length)} · ${clock(tl.reading)}` }
}

// Read along with no cover, the hook's light lines and its gold title
// stand where the print's darkening has all but run out (plan 309,
// `challenge.along`): a band of night behind them, across the frame,
// thinning into the print above and below.
const BAND = { top: 540, foot: 1230, feather: 130, a: 0.72 }
// With the hour's sun or moon over the print (backdrop.js, discDrawn),
// its foot at y 482 under the hook (a scenery's own disc, 24 units under
// its middle at 150, carouselAlong.test.js reads it off their meta), the
// band thins in from under the disc rather than over its lower half,
// which it dulled: whole from 615, the hook's first line, from 583,
// standing in the last of its thinning (the brightest of the ground under
// the words measured as with no disc). Where none is drawn it stands
// where it always did.
const DISC_FOOT = 485
/** Whether the hook stands on that band: read along, over a print (a
 *  photo is darkened its own way), with no cover and the dial on. */
export const hookBand = plan => !coverOn(plan) && !plan.photo && plan.style === 'along' && tuned(plan.tune, 'challenge.along') > 0
/** The band's rows over the print `P` (the one drawn, or null): from
 *  `y0` to `y1`, whole from `top` to `foot`, thinning over `feather`
 *  either side, `a` its night at its whole. */
export function bandOf(plan, P = null) {
  const top = discDrawn(plan, P) ? DISC_FOOT + BAND.feather : BAND.top
  return { ...BAND, top, y0: top - BAND.feather, y1: BAND.foot + BAND.feather }
}
function nightBand(ctx, plan, P) {
  const { a: dark, feather, y0, y1 } = bandOf(plan, P)
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  // Eased in and out, so neither end of the band shows as a line.
  for (let i = 0; i <= 8; i++) {
    const a = (dark * (1 - Math.cos((Math.PI * i) / 8))) / 2
    g.addColorStop((i * feather) / 8 / (y1 - y0), `rgba(12,10,22,${a.toFixed(3)})`)
    g.addColorStop(1 - (i * feather) / 8 / (y1 - y0), `rgba(12,10,22,${a.toFixed(3)})`)
  }
  ctx.fillStyle = g
  ctx.fillRect(0, y0, FMT.w, y1 - y0)
}

function hook(ctx, plan, tl, t, into, P, T) {
  const words = hookWords(plan, tl)
  const cover = coverOn(plan)
  const { laid } = backdrop(ctx, P, T, { dark: 0.5, hour: plan.hour, wash: tuned(plan.tune, 'challenge.wash'), plan, tl, t, seg: 'hook', cover })
  if (hookBand(plan)) nightBand(ctx, plan, P)
  // Under the cover, the cover stands the masthead on its own paper
  // (cover.js): the hook's own, under it, is plain.
  masthead(ctx, T, cover ? 0 : 1 - laid)
  // In colour from the first frame (plan 309): the hook on the title slip's washi.
  if (cover) {
    drawCover(ctx, plan, tl, into, P, T, { laid, words })
    return
  }
  const k = ease(into / 0.6)
  let y = TOP + 90
  y = lines(ctx, T, words.hook, y, [FS.display * 0.95, FS.display * 0.75], { weight: 900, fam: 'serif', lh: 1.08, k })
  y += SP[6]
  y = lines(ctx, T, words.title, y, [FS.heading, FS.title], { weight: 700, fam: 'serif', color: T.title, maxLines: 2, k: ease((into - 0.3) / 0.6) })
  y += SP[6]
  ctx.save()
  ctx.globalAlpha *= ease((into - 0.6) / 0.6)
  chip(ctx, T, words.chip, fr.cx, y, { align: 'center', z: FS.body })
  ctx.restore()
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
export const SCROLL = { z: FS.title, head: UNDER + SP[6], foot: fr.bottom, fade: 140, read: fr.y + 640 }
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
// line by line, in the same places (backdrop.js, canvasOf).
const BLEED = SP[6]
let strip = null
let layer = null
function stripOf(ctx, plan, rows, length, T) {
  // Its inks and its rim are its own (plan 309): a strip written in
  // another ink, or with another rim (another width, another hour's ink,
  // halo.js), is written again. The rim is the paper's, round ink: light
  // words over a photo have none, and a photo washed with paper has no
  // hour (its wash is the same at every one): its rim is the day's.
  const halo = T.ground === 'paper' ? tuned(plan.tune, 'challenge.halo') : 0
  const hour = plan.photo ? 'day' : plan.hour
  const key = `${plan.id}|${plan.lang}|${T.ink}|${T.ruby}|${halo}|${hour}`
  if (strip?.key === key) return strip.c
  const c = canvasOf(Math.ceil(fr.w + BLEED * 2), Math.ceil(length + BLEED * 2))
  if (!c) return null
  const x = c.getContext('2d')
  let y = BLEED
  for (const row of rows) {
    drawSentence(x, row.L, c.width / 2, y, 'center', () => ({ ink: T.ink, rule: null, ruby: T.ruby }))
    y += row.h
  }
  // A rim of the page's paper round every glyph, grown from the strip.
  haloStrip(c, canvasOf, halo, hour)
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
// After a cover (plan 309) the text waits for the paper: it and its chip
// come in once the wash has begun to, this long into the reading.
const COVER_WAIT = 0.35
// With the hour's sun or moon over the print (plan 309: backdrop.js,
// discDrawn), the disc stands where the reading's chip comes at the cut,
// the cover on or off: the chip waits in either style until the disc is
// clear of its place, then comes in over CHIP_IN. With the print raised
// (challenge.lift) the disc rises through it, from under the hook to
// above the chip: the chip waits until the print is raised whole
// (RISEN, read off the lift itself, backdrop.js's liftAt). With the
// print left down the disc fades out from under it as the paper comes
// in: the chip waits until the disc is gone (FADED, read off the fade
// itself, backdrop.js's discAt). Where no disc is drawn (the dial off,
// the long view, August's night, the bay's spring night, a photo) it
// comes as it did.
/** The first moment into the reading at which `done` holds, to a tenth
 *  of a millisecond: `done` a curve of backdrop.js's, read off it. */
function first(done) {
  let lo = 0
  let hi = 8
  while (hi - lo > 1e-4) {
    const mid = (lo + hi) / 2
    if (done(mid)) hi = mid
    else lo = mid
  }
  return hi
}
export const RISEN = first(into => liftAt('reading', into, 1) >= 1)
export const FADED = first(into => discAt('reading', into, false) <= 0)
const CHIP_IN = 0.3
/** How much of the reading's chip shows `into` seconds into the reading,
 *  over the print `P` (the one drawn, or null): all of it, unless it
 *  waits for the sun or moon to rise past it or to fade from under it. */
export function chipShown(plan, into, P = null) {
  if (!discDrawn(plan, P)) return 1
  const raised = sceneryOf(P.scenery).lift && tuned(plan.tune, 'challenge.lift') > 0
  return ease((into - (raised ? RISEN : FADED)) / CHIP_IN)
}
function scroll(ctx, plan, tl, t, P) {
  const T = lookOf(plan)
  const { laid } = backdrop(ctx, P, T, { dark: 0.5, hour: plan.hour, wash: tuned(plan.tune, 'challenge.wash'), plan, tl, t, seg: 'reading', cover: false })
  masthead(ctx, T, 1 - laid)
  const seg = tl.segs.find(x => x.key === 'reading')
  const { rows, length } = scrollRows(ctx, plan)
  // One speed: the whole text past the reading line in its reading time.
  const speed = length / (plan.chars / (plan.cpm / 60))
  const off = speed * Math.max(0, t - seg.start - beat(plan, 'into'))
  const wait = coverOn(plan) ? COVER_WAIT : 0
  const k = ease((t - seg.start - wait) / 0.6)
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
  // The counter: whole from the reading's first frame, as it always came;
  // after a cover, with the text; and held while the disc rises past it
  // or fades from under it.
  const counter = () => chip(ctx, T, `JLPT ${plan.lv} · ${reading + 1} / ${plan.sents.length}`, fr.right, fr.y + 6, { align: 'right' })
  const shown = Math.min(wait ? k : 1, chipShown(plan, t - seg.start, P))
  if (shown >= 1) return counter()
  if (!(shown > 0)) return
  ctx.save()
  ctx.globalAlpha *= shown
  counter()
  ctx.restore()
}

// along: the text on one panel, each word gold once said, the word being
// said underlined; the panel turns to the next sentence when it would
// run past its foot.
const ALONG_Z = FS.title * 1.15
// How dark the panel is over the print at each hour (plan 309,
// `challenge.along`): enough that the brightest of the print through it
// (day's snow, the dawn sky, spring's hazy moon, August's fireworks)
// leaves the gold of the words said at 4.5:1 and the light ones at 7:1;
// never lighter than it was (0.62, every hour alike).
const PANEL_AT = { dawn: 0.74, day: 0.76, dusk: 0.7, night: 0.72, hanabi: 0.74 }
/** The read-along panel's darkness over the print `P` (the one drawn:
 *  its name; the plan's hour and season where none is); a photo, which
 *  has no hour, keeps the look before. */
export function alongPanel(plan, P = null) {
  if (!(tuned(plan.tune, 'challenge.along') > 0) || plan.photo) return 0.62
  // A B print (the date's, with no season asked) is its A print's hour.
  const fireworks = printNamed(plan, P) === 'summer-hanabi'
  return Math.max(0.62, (fireworks ? PANEL_AT.hanabi : PANEL_AT[plan.hour]) ?? 0.62)
}
/** Where the read-along's panel stands: its top and its foot, the foot of
 *  the text in it, and the voice's credit's line. With
 *  `challenge.along` (plan 309) the credit stands in the panel's foot,
 *  under the text, rather than under the panel on the print, where it
 *  was lost over a bright foreground; a sentence too tall for the room
 *  above it takes the credit's room while it is read (along). */
export function alongBox(plan) {
  const foot = fr.bottom - FS.sm * 2.4
  if (!(tuned(plan.tune, 'challenge.along') > 0)) return { top: TOP, foot, text: foot, credit: fr.bottom - FS.sm * 0.6 }
  const end = foot - FS.sm * 1.4
  // Its letters centred in the room between the text's foot and the panel's.
  return { top: TOP, foot, text: end, credit: (end - PAD * 0.5 + foot) / 2 + FS.sm * 0.36 }
}
function along(ctx, plan, tl, t, P) {
  const S = W[plan.lang]
  const T = LOOK.dark
  const { laid } = backdrop(ctx, P, T, { dark: 0.42, hour: plan.hour, wash: tuned(plan.tune, 'challenge.wash'), plan, tl, t, seg: 'reading', cover: false })
  const into = t - tl.segs.find(s => s.key === 'reading').start
  masthead(ctx, T, Math.max(1 - laid, raisedGlow(plan, T, 'reading', into)))
  const tw = fr.w - PAD * 2
  const { top, foot, text: end, credit } = alongBox(plan)
  // Where each sentence stands in the column, and where the column is turned to.
  const Ls = plan.sents.map((_, i) => layOf(ctx, plan, i, ALONG_Z, tw))
  // Never set under the title's size, a sentence too tall to stand whole
  // above the credit (eight lines with their readings) reaches into the
  // panel's foot while it is read, the credit giving way to it.
  const tall = Ls.map(L => end < foot && top + PAD + L.h > end - PAD * 0.5)
  const ys = []
  let y = 0
  for (const L of Ls) { ys.push(y); y += L.h + SP[5] }
  const room = end - top - PAD * 2
  const turns = [0]
  Ls.forEach((L, i) => { if (i) turns.push(ys[i] + L.h - turns[i - 1] > room ? ys[i] : turns[i - 1]) })
  const now = tl.lines.reduce((n, l, i) => (t >= l.at ? i : n), 0)
  const prev = turns[Math.max(0, now - 1)]
  const turning = now > 0 && turns[now] !== prev
  const k = turning ? ease((t - tl.lines[now].at) / CH.turn) : 1
  const off = prev + (turns[now] - prev) * k
  // The credit going as a tall sentence is turned to, back as it is turned from.
  const gone = (tall[now] ? k : 0) + (turning && tall[now - 1] ? 1 - k : 0)
  panel(ctx, T, fr.x, top, fr.w, foot - top, `rgba(16,14,19,${alongPanel(plan, P)})`)
  ctx.save()
  ctx.globalAlpha *= 1 - gone
  text(ctx, S.voice, fr.cx, credit, { f: font(600, FS.sm, 'latin'), color: alpha(LIGHT, 0.75), align: 'center' })
  ctx.restore()
  // The chip, unless it waits for the disc to rise past it or to fade from under it (chipShown).
  const shown = chipShown(plan, into, P)
  ctx.save()
  ctx.globalAlpha *= shown
  if (shown > 0) chip(ctx, T, `JLPT ${plan.lv} · ${now + 1} / ${tl.lines.length}`, fr.right, fr.y + 6, { align: 'right' })
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.rect(fr.x, top + PAD * 0.5, fr.w, foot - top - PAD)
  ctx.clip()
  Ls.forEach((L, i) => {
    const yy = top + PAD + ys[i] - off
    // Only a sentence whole on the panel: the next comes in when it is turned to.
    if (yy + L.h > (tall[i] ? foot : end) - PAD * 0.5 || yy + L.h < top) return
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

// The question, its four answers and the countdown under them, at the
// largest sizes at which the countdown (or "Did you get it?") still stands
// above the frame's foot and nothing is cut: four answers of three lines
// step the sizes down rather than push the countdown under the feed's
// buttons (plan 262).
const QUESTION_STEPS = [
  { ask: [FS.heading, FS.title, FS.lead, FS.body], answer: [FS.lead, FS.body, FS.sm], gap: SP[4], least: 116, pad: SP[6] },
  { ask: [FS.title, FS.lead, FS.body], answer: [FS.body, FS.sm], gap: SP[3], least: 104, pad: SP[6] },
  { ask: [FS.lead, FS.body], answer: [FS.sm, FS.caption], gap: SP[3], least: 96, pad: SP[6] },
  { ask: [FS.body, FS.sm], answer: [FS.caption], gap: SP[2], least: 88, pad: SP[4], askLines: 5 },
  // The longest (a quote and four answers of three lines, in French at N2):
  // a smaller ring, and the ask for the comments left to the post's caption.
  { ask: [FS.body, FS.sm, FS.caption], answer: [FS.caption], gap: SP[2], least: 88, pad: SP[4], askLines: 5, ring: 40, quiet: true },
  // Hidden, the comments' two lines take a step more, the last one smaller still.
  { ask: [FS.sm, FS.caption], answer: [FS.caption], gap: SP[2], least: 80, pad: SP[3], askLines: 5, ring: 40, quiet: true },
]
const RING = 54
const questionLayouts = new Map()
function questionLayout(ctx, plan) {
  const key = `${plan.id}|${plan.lang}|${plan.q.n}`
  if (questionLayouts.has(key)) return questionLayouts.get(key)
  let L = null
  for (const step of QUESTION_STEPS) {
    const ring = step.ring || RING
    const ask = fit(ctx, plan.q.ask, { weight: 800, fam: 'latin', sizes: step.ask, maxW: fr.w, maxLines: step.askLines || 4, lh: 1.15 })
    const answers = plan.q.choices.map(c => fit(ctx, c, { weight: 700, sizes: step.answer, maxW: fr.w - 150, maxLines: 3, lh: 1.15 }))
    const hs = answers.map(b => Math.max(step.least, b.size * 1.15 * b.lines.length + step.pad))
    // Each line takes the sizes its step gives the question's ask and answers, so it steps down with them.
    const yours = plan.hidden ? [
      { ...fit(ctx, W[plan.lang].yours[0], { weight: 800, sizes: step.ask, maxW: fr.w, maxLines: 1, lh: 1.15 }), sizes: step.ask },
      { ...fit(ctx, W[plan.lang].yours[1], { weight: 600, sizes: step.answer, maxW: fr.w, maxLines: 2, lh: 1.15 }), sizes: step.answer },
    ] : null
    // The countdown's ring stands under the answers until the answer, then the
    // comments' lines do: the foot is the taller of the two.
    const ringFoot = Math.max(ring * 2 + (step.quiet ? 0 : SP[4] + FS.body * 1.15), FS.title * 1.15)
    const foot = yours ? Math.max(ringFoot, yours[0].size * 1.15 + SP[2] + yours[1].size * 1.15 * yours[1].lines.length) : ringFoot
    const end = TOP + 30 + ask.size * 1.15 * ask.lines.length + SP[6] + hs.reduce((n, h) => n + h + step.gap, 0) + SP[6] + foot
    L = { ask, answers, hs, gap: step.gap, ring, quiet: !!step.quiet, askLines: step.askLines || 4, yours }
    // Whole, too: a question quoting a long sentence wraps only between phrases.
    if (end <= fr.bottom && !ask.cut && !answers.some(b => b.cut)) break
  }
  questionLayouts.set(key, L)
  return L
}
function question(ctx, plan, tl, t, into, answered, P, T) {
  const S = W[plan.lang]
  const seg = answered ? 'answer' : 'question'
  const { laid } = backdrop(ctx, P, T, { dark: 0.5, hour: plan.hour, wash: tuned(plan.tune, 'challenge.wash'), plan, tl, t, seg, cover: false })
  masthead(ctx, T, Math.max(1 - laid, raisedGlow(plan, T, seg, into)))
  const L = questionLayout(ctx, plan)
  let y = lines(ctx, T, plan.q.ask, TOP + 30, [L.ask.size], { maxLines: L.askLines }) + SP[6]
  plan.q.choices.forEach((c, i) => {
    const right = answered && !plan.hidden && i === plan.q.right
    const b = L.answers[i]
    const h = L.hs[i]
    const k = answered ? 1 : ease((into - 0.4 - i * 0.18) / 0.4)
    ctx.save()
    ctx.globalAlpha *= k * (answered && !plan.hidden && !right ? 0.45 : 1)
    panel(ctx, T, fr.x, y, fr.w, h, right ? CORRECT : T.panel)
    ctx.fillStyle = right ? '#10201f' : T.dot
    ctx.beginPath()
    ctx.arc(fr.x + 62, y + h / 2, 34, 0, Math.PI * 2)
    ctx.fill()
    text(ctx, 'ABCD'[i], fr.x + 62, y + h / 2 + 14, { f: font(800, FS.lead, 'latin'), color: right ? CORRECT : T.ink, align: 'center' })
    b.lines.forEach((l, j) => text(ctx, l, fr.x + 120, y + h / 2 + b.size * (0.36 + (j - (b.lines.length - 1) / 2) * 1.15), { f: b.f, color: right ? '#10201f' : T.ink }))
    ctx.restore()
    y += h + L.gap
  })
  y += SP[6]
  if (!answered) {
    // The seconds to answer, as the clicks count them (none when the countdown is tuned away).
    const count = beat(plan, 'count')
    const left = Math.max(0, count - Math.max(0, into - beat(plan, 'ask')))
    const r = L.ring
    ctx.strokeStyle = T.track
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(fr.cx, y + r, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = T.ring
    ctx.beginPath()
    ctx.arc(fr.cx, y + r, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (count ? left / count : 0))
    ctx.stroke()
    text(ctx, String(Math.ceil(left) || ''), fr.cx, y + r + 18 * (r / RING), { f: font(800, FS.heading * (r / RING), 'latin'), color: T.ink, align: 'center' })
    if (!L.quiet) lines(ctx, T, S.comments, y + r * 2 + SP[4], [FS.body], { weight: 600, maxLines: 1 })
  } else if (plan.hidden) {
    // The answer left to the viewer: the four letters asked, then the comments.
    const k = ease((into - 0.3) / 0.5)
    const end = lines(ctx, T, S.yours[0], y, L.yours[0].sizes, { weight: 800, maxLines: 1, k })
    lines(ctx, T, S.yours[1], end + SP[2], L.yours[1].sizes, { weight: 600, maxLines: 2, k: ease((into - 0.7) / 0.5) })
  } else {
    lines(ctx, T, S.gotIt, y, [FS.title, FS.lead], { weight: 700, maxLines: 1, k: ease((into - 0.4) / 0.5) })
  }
}

// ── The way to the app (plan 266) ──
// The app's reader (RollingPassage, plan 258) with the text just read
// rolling up its card: a tap on − slows it, a tap on ふ shows its
// furigana; under it the run's three stops, the reader's dot going along
// them. Its beats, in seconds into the card at its default length,
// squeezed when the card is tuned shorter.
export const CTA = { go: 0.9, minus: 2.2, furi: 3.2, rail: 4.2 }
const ctaPace = dur => Math.min(1, dur / CH.cta)
const RIKAI = PAPER.line.rikai
// The selection's gold, a chip switched on (.chip--on), in the paper theme.
const SEL = { wash: alpha(PAPER.gold, 0.15), line: alpha(PAPER.gold, 0.6), ink: mix(PAPER.gold, PAPER.ink, 0.5) }
const FLOOR = fr.bottom - METAL_H - SP[6]
const READER_Z = FS.body
// The roll's lines, laid out once a width and a script: a sentence an
// entry, centred and balanced, as .roll__line sets them.
const readerLays = new Map()
function readerLay(ctx, plan, w, script) {
  const key = `${plan.id}|${w}|${script}`
  if (!readerLays.has(key)) {
    const Ls = plan.sents.map(rows => layoutSentence(ctx, rows, { max: READER_Z, min: READER_Z * 0.8, maxW: w, maxLines: 6, fam: 'jp', weight: 500, script, rules: false, gap: 0.02 }))
    const tops = []
    let y = 0
    for (const L of Ls) { tops.push(y); y += L.h + SP[5] }
    readerLays.set(key, { Ls, tops, mids: Ls.map((L, i) => tops[i] + L.h / 2) })
  }
  return readerLays.get(key)
}
// How far the roll has gone, 0 to 1, at the app's pace: the text's
// characters over the speed, the speed as the taps set it.
function rolled(t, steps, chars) {
  let n = 0
  steps.forEach(([at, v], i) => {
    const end = i + 1 < steps.length ? steps[i + 1][0] : Infinity
    if (t > at) n += (Math.min(t, end) - at) * v
  })
  return n / chars
}
function drawRoll(ctx, plan, vx, vy, vw, vh, r, furi) {
  const c = canvasOf(Math.ceil(vw), Math.ceil(vh))
  if (!c) return
  const x = c.getContext('2d')
  // Furigana coming in: the two settings of the text, one fading into the other.
  for (const [script, a] of [['kanji', 1 - furi], ['furigana', furi]]) {
    if (a <= 0.001) continue
    const R0 = readerLay(ctx, plan, vw - SP[4] * 2, script)
    const at = R0.mids[0] + r * (R0.mids.at(-1) - R0.mids[0])
    let q = 0
    for (let i = 0; i < R0.mids.length - 1; i++) if (at >= R0.mids[i]) q = i + Math.min(1, (at - R0.mids[i]) / (R0.mids[i + 1] - R0.mids[i]))
    R0.Ls.forEach((L, i) => {
      const top = vh / 2 - at + R0.tops[i]
      if (top > vh || top + L.h < 0) return
      // Stepped back by its distance from the middle, as .roll__line's opacity.
      x.globalAlpha = a * Math.max(0.12, 1 - Math.min(3, Math.abs(i - q)) * 0.35)
      drawSentence(x, L, vw / 2, top, 'center', () => ({ ink: PAPER.ink, rule: null, ruby: PAPER.ink2 }))
    })
  }
  // The card's mask: its top and bottom quarters fading the lines out.
  x.globalAlpha = 1
  x.globalCompositeOperation = 'destination-in'
  const g = x.createLinearGradient(0, 0, 0, vh)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.24, '#000')
  g.addColorStop(0.76, '#000')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, vw, vh)
  ctx.drawImage(c, vx, vy)
}
// A tap: a finger's shade coming down, the chip pressed, a ring going out.
const pressOf = (into, at) => (at == null ? -1 : (into - at) / 0.55)
function readerChip(ctx, cx, cy, d, glyph, { on = false, press = -1 } = {}) {
  const near = press > -0.5 && press < 0 ? 1 + press * 2 : press >= 0 && press < 1 ? 1 - press : 0
  if (near > 0) {
    ctx.fillStyle = alpha(PAPER.ink, 0.16 * near)
    ctx.beginPath()
    ctx.arc(cx, cy, d * 0.62, 0, Math.PI * 2)
    ctx.fill()
  }
  if (press >= 0 && press < 1) {
    ctx.strokeStyle = alpha(PAPER.gold, 0.7 * (1 - press))
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(cx, cy, d / 2 + press * d * 0.55, 0, Math.PI * 2)
    ctx.stroke()
  }
  const r = (d / 2) * (press >= 0 && press < 0.5 ? 1 - 0.1 * Math.sin(Math.PI * press * 2) : 1)
  ctx.fillStyle = on ? SEL.wash : PAPER.surface
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = on ? SEL.line : PAPER.surfaceLine
  ctx.lineWidth = 2.5
  ctx.stroke()
  const ink = on ? SEL.ink : PAPER.ink2
  const u = d * 0.2
  ctx.fillStyle = ink
  if (glyph === 'pause') {
    rrect(ctx, cx - u * 0.75, cy - u, u * 0.5, u * 2, 2)
    ctx.fill()
    rrect(ctx, cx + u * 0.25, cy - u, u * 0.5, u * 2, 2)
    ctx.fill()
  } else if (glyph === 'ふ') {
    text(ctx, 'ふ', cx, cy + d * 0.15, { f: font(700, d * 0.42, 'jp'), color: ink, align: 'center' })
  } else {
    rrect(ctx, cx - u, cy - 2.5, u * 2, 5, 2.5)
    ctx.fill()
    if (glyph === '+') {
      rrect(ctx, cx - 2.5, cy - u, 5, u * 2, 2.5)
      ctx.fill()
    }
  }
}
// The comprehension's card, rolling: the lines, the row of controls
// (pause, − speed +, ふ, as .roll-ctl), the foot (the level, the station).
function readerCard(ctx, plan, box, into, beats) {
  const S = W[plan.lang]
  const footH = 60
  const d = 68
  ctx.save()
  ctx.shadowColor = 'rgba(40,30,15,0.2)'
  ctx.shadowBlur = 34
  ctx.shadowOffsetY = 12
  ctx.fillStyle = PAPER.card
  rrect(ctx, box.x, box.y, box.w, box.h, R.panel)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = PAPER.surfaceLine
  ctx.lineWidth = 2
  rrect(ctx, box.x, box.y, box.w, box.h, R.panel)
  ctx.stroke()
  const bodyH = box.h - footH
  const vh = bodyH - SP[3] * 2 - d - SP[4]
  const vw = box.w - SP[4] * 2
  // The speed the taps set: the app's default, then one step down.
  const steps = [[0, 3], [beats.minus, 2]]
  // The roll starts with the text's second sentence at its middle, one read above it.
  const start = readerLay(ctx, plan, vw - SP[4] * 2, 'kanji')
  const from = (start.mids[Math.min(1, start.mids.length - 1)] - start.mids[0]) / Math.max(1, start.mids.at(-1) - start.mids[0])
  const r = Math.min(1, from + rolled(Math.max(0, into - beats.go), steps.map(([at, v]) => [Math.max(0, at - beats.go), v]), plan.chars))
  drawRoll(ctx, plan, box.x + SP[4], box.y + SP[3], vw, vh, r, ease((into - beats.furi - 0.15) / 0.45))
  const speed = steps.filter(([at]) => into >= at).at(-1)[1]
  const vf = font(700, FS.caption, 'latin')
  const valueW = measure(ctx, S.speed(10), vf) * 1.12
  const total = d * 4 + SP[4] * 2 + SP[3] * 2 + valueW
  const cy = box.y + bodyH - SP[4] - d / 2
  let x = box.x + box.w / 2 - total / 2
  readerChip(ctx, x + d / 2, cy, d, 'pause')
  x += d + SP[4]
  readerChip(ctx, x + d / 2, cy, d, '−', { press: pressOf(into, beats.minus) })
  x += d + SP[3]
  // The speed just changed is lit a moment, as the eye goes to it.
  const lit = into >= beats.minus ? Math.max(0, 1 - (into - beats.minus) / 0.9) : 0
  ctx.save()
  ctx.translate(x + valueW / 2, cy)
  ctx.scale(1 + lit * 0.12, 1 + lit * 0.12)
  text(ctx, S.speed(speed), 0, FS.caption * 0.36, { f: vf, color: lit > 0 ? mix(SEL.ink, PAPER.ink2, lit) : PAPER.ink2, align: 'center' })
  ctx.restore()
  x += valueW + SP[3]
  readerChip(ctx, x + d / 2, cy, d, '+')
  x += d + SP[4]
  readerChip(ctx, x + d / 2, cy, d, 'ふ', { on: into >= beats.furi, press: pressOf(into, beats.furi) })
  const fy = box.y + bodyH
  ctx.fillStyle = PAPER.surfaceLine
  ctx.fillRect(box.x, fy, box.w, 2)
  const ff = font(500, FS.caption, 'latin')
  text(ctx, plan.lv, box.x + SP[5], fy + footH / 2 + FS.caption * 0.36, { f: ff, color: PAPER.ink2 })
  text(ctx, S.station, box.x + box.w - SP[5], fy + footH / 2 + FS.caption * 0.36, { f: ff, color: PAPER.ink2, align: 'right' })
}
function cta(ctx, plan, tl, t, into, P, T, dur = CH.cta) {
  const S = W[plan.lang]
  const pace = ctaPace(dur)
  const beats = Object.fromEntries(Object.entries(CTA).map(([k, v]) => [k, v * pace]))
  const { laid } = backdrop(ctx, P, T, { dark: 0.62, hour: plan.hour, wash: tuned(plan.tune, 'challenge.wash'), plan, tl, t, seg: 'cta', cover: false })
  masthead(ctx, T, Math.max(1 - laid, raisedGlow(plan, T, 'cta', into)))
  let y = UNDER + SP[5]
  y = lines(ctx, T, S.reader, y, [FS.heading, FS.title], { weight: 900, fam: 'serif', maxLines: 2, lh: 1.08, k: ease(into / 0.6) })
  y += SP[4]
  // The run's three stops, named as the app names them: the roll, the questions, the breakdown.
  const labels = S.stops(plan.nq)
  const railY = FLOOR - (34 + SP[3] + FS.body * 1.2)
  const k = ease((into - 0.3) / 0.6)
  ctx.save()
  ctx.globalAlpha *= k
  ctx.translate(0, (1 - k) * 30)
  readerCard(ctx, plan, { x: fr.x, y, w: fr.w, h: railY - SP[5] - y }, into, beats)
  ctx.restore()
  // The line drawn in, then lit stop by stop as the reader's dot goes along it.
  const xs = [1, 3, 5].map(m => fr.x + (fr.w * m) / 6)
  const cy = railY + 17
  const drawIn = ease((into - beats.go - 0.1) / 0.9)
  const go = ease((into - beats.rail) / (1.4 * pace))
  ctx.save()
  ctx.globalAlpha *= ease((into - beats.go) / 0.4)
  ctx.fillStyle = alpha(RIKAI, 0.25)
  rrect(ctx, xs[0], cy - 5, (xs[2] - xs[0]) * drawIn, 10, 5)
  ctx.fill()
  ctx.fillStyle = RIKAI
  rrect(ctx, xs[0], cy - 5, (xs[2] - xs[0]) * go, 10, 5)
  ctx.fill()
  // With the readings in the text's own ink (plan 309, challenge.ruby), the
  // stops still ahead are set in a soft ink all but as dark as the ink of
  // the one reached (inksOf: the night's paper leaves them no lighter one
  // that reads), and in the line's rikai a stop reached would not read on
  // it: those ahead are set a weight lighter instead, the face's 500 to its
  // 700, so the stop reached stands apart in its weight as in its dot.
  const ahead = T.ground === 'paper' && tuned(plan.tune, 'challenge.ruby') > 0
  labels.forEach((label, i) => {
    const on = i === 0 || go >= i / 2 - 0.01
    ctx.save()
    ctx.globalAlpha *= ease((into - beats.go - 0.1 - i * 0.25) / 0.4)
    ctx.fillStyle = on ? RIKAI : PAPER.bg
    ctx.beginPath()
    ctx.arc(xs[i], cy, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = RIKAI
    ctx.lineWidth = 6
    ctx.stroke()
    const b = fit(ctx, label, { weight: 700, sizes: [FS.body, FS.sm, FS.caption], maxW: fr.w / 3 - SP[1], maxLines: 1 })
    const f = !on && ahead ? font(500, b.size, 'latin') : b.f
    text(ctx, b.lines[0], xs[i], cy + 17 + SP[3] + b.size * 0.85, { f, color: on ? T.ink : T.soft, align: 'center' })
    ctx.restore()
  })
  ctx.fillStyle = PAPER.gold
  ctx.beginPath()
  ctx.arc(xs[0] + (xs[2] - xs[0]) * go, cy, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // The way to the app, the call to action's address bar (plan 245).
  const kb = ease((into - 0.5) / 0.6)
  ctx.save()
  ctx.globalAlpha *= kb
  address(ctx, palette(T.ground), fr.x, fr.bottom - METAL_H + (1 - kb) * 30, fr.w, SITE)
  ctx.restore()
}
