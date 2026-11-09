// ── 言ってみて — say it in Japanese (plan 311) ─────────────────────────
// The reading challenge turned round, built as the owner picked it on the
// canvas "Tsuji — Say it in Japanese" (round 1: D, the dark look, the fifth
// sentence left to the comments; round 2: the cover B). Five sentences of
// the reading bank, growing longer, each in the viewer's own language over
// the print, and a countdown to say it in Japanese out loud before the
// app's reader does. The countdown helps in three steps of the same
// length: the sentence alone, then its words, each a card in no order,
// then its frame (the particles and the endings printed, a blank for each
// word with what it means under it). Then the reader says it and it is
// written word by word as it is said, filling the frame's blanks where
// they stand, with the same sentence in the other register under it
// (plain where it is polite, polite where it is plain: a translation never
// says which, so either is right, plain_polite.other_register's, the
// module Construire judges by). The fifth is never said: the viewer
// writes it in the comments (as the reading challenge's answer, plan 275;
// `show` says it like the others). It ends on the app's own exercise of
// the same name, Translation ("Say it in Japanese": read, say it, the
// tutor).
//
// It opens on the poster (大書): the first sentence large over the print in
// its colours, an arrow down to 日本語で？ with its reading, the chip under
// it. The cut into the first sentence goes one thing at a time, never words
// over words: the cover's words leave, then the panel comes, then the
// sentence on it.
//
// It stands on the reading bank (bank/N5.json …): each row carries its
// translation, its words with their furigana, romaji and senses, and the
// other register (`v`). A level is dealt in parts of five (`sayitDeal`),
// one sentence from each fifth of the level's lengths, so a part climbs
// from short to long and its fifth, left to the comments, is its longest.
// It stands on the reading challenge's ground, as plan 309 recommends it
// (`PRINT_LOOK`, fixed: the look the owner picked was drawn on it), with
// the read-along's panel and its words lit on the voice's own syllables.
//
// Pure but for the canvas it draws on: `sayitTimeline` times the video
// (on the voice's own lengths and syllables where it is voiced, else on a
// close guess), `drawSayit` draws any second of it.
import { ASC, FORMATS, FS, METAL_H, R, SP, address, alpha, drawSentence, fit, font, frame, layoutSentence, measure, palette, paragraphH, rrect, text } from './draw.js'
import { PRINT_SEASONS } from './app.js'
import { backdrop } from './backdrop.js'
import { MASTHEAD, drawMasthead, glowMasthead } from './cover.js'
import { HOURS, alongPanel, chipShown, moraeOf, wordTimes } from './challenge.js'
import { SCENERY_IDS } from './sceneries.js'
import { seeded, shuffle } from './common.js'
import { SITE } from './strings.js'
import { tuneFlag, tuned } from './tune.js'
import { feedPosts } from './feeds.js'

/** Sentences in a video. */
export const PART = 5
// Readings over the kanji, and romaji under the words, where a learner of the level still needs them.
const RUBY = new Set(['N5', 'N4', 'N3'])
const ROMAJI = new Set(['N5', 'N4'])
// The voice slows for the first two levels, as a card's slow line does.
const SLOW = new Set(['N5', 'N4'])
/** What it stands on, always: the reading challenge's dials as plan 309
 *  recommends them, the look the owner picked was drawn on (the hook in
 *  colour, the print raised, the sun and moon, the train as the clock, the
 *  season's petals and August's fireworks, the panel set by the hour). */
export const PRINT_LOOK = {
  'challenge.cover': 1, 'challenge.lift': 1, 'challenge.disc': 1, 'challenge.train': 1,
  'challenge.falls': 1, 'challenge.bursts': 1, 'challenge.along': 1,
}

// The beats that are not the maker's to set: the sentence coming in, the
// voice's start after the ring, the turn going, the cover's words leaving.
const IN = 0.7
const LEAD = 0.35
const OUT = 0.5
const COVER_OUT = 0.35
/** A beat of the video, as tuned (tune.js `sayit.*`). */
const beat = (plan, key) => tuned(plan.tune, `sayit.${key}`)
/** How long the countdown runs: three steps of help, alike. */
export const thinkOf = plan => 3 * beat(plan, 'step')

const LIGHT = '#f3ecdf'
const GOLD = '#e6bd62'
const RUBY_INK = '#f1d08a'
// The translation line's pigment, lit for the night it stands on.
const SKY = '#8da3e0'
const PAPER = palette('paper')
const SUMI = palette('sumi')
const LOOK = { ink: LIGHT, soft: alpha(LIGHT, 0.72), lit: GOLD, ruby: RUBY_INK, ring: GOLD, track: alpha(LIGHT, 0.22), card: 'rgba(243,236,223,0.08)', cardLine: alpha(LIGHT, 0.24), line: SKY, ground: 'sumi', shadow: true }

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
    part: (lv, p) => `JLPT ${lv} · part ${p}`,
    sentences: n => `${n} sentences`,
    chapters: { hook: 'Cover', turn: n => `Sentence ${n}`, last: n => `Sentence ${n}, in the comments`, cta: 'The app' },
    page: {
      title: (lv, first) => `Can you say it in Japanese? JLPT ${lv} speaking challenge: “${first}”`,
      body: s => `Say each sentence in Japanese, out loud, before the voice does. Its words come to help after ${s} seconds, its frame after ${2 * s}. Then the app’s reader says it, and the same sentence in the other register is right too.`,
      last: 'The fifth is yours: write it in the comments, in kana, kanji or romaji.',
      shown: 'The fifth is the hardest. Did you get it?',
      site: site => `More sentences to put into Japanese, each with a reference answer and the tutor’s read on yours, on Tsuji: ${site}`,
      app: 'More sentences to put into Japanese, each with a reference answer and the tutor’s read on yours, on Tsuji.',
      ask: 'How would you say the fifth? Write it in the comments.',
      askShown: 'How many did you get before the voice? Tell me in the comments.',
      credit: 'Voice: VOICEVOX Nemo.',
      tags: ['japanese', 'learnjapanese', 'speakjapanese', 'jlpt'],
    },
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
    part: (lv, p) => `JLPT ${lv} · partie ${p}`,
    sentences: n => `${n} phrases`,
    chapters: { hook: 'Couverture', turn: n => `Phrase ${n}`, last: n => `Phrase ${n}, en commentaire`, cta: 'L’app' },
    page: {
      title: (lv, first) => `Tu sais le dire en japonais ? Défi oral JLPT ${lv} : « ${first} »`,
      body: s => `Dis chaque phrase en japonais, à voix haute, avant la voix. Ses mots viennent t’aider au bout de ${String(s).replace('.', ',')} secondes, sa charpente au bout de ${String(2 * s).replace('.', ',')}. Puis la voix de l’app la dit, et la même phrase dans l’autre registre est juste aussi.`,
      last: 'La cinquième est pour toi : écris-la en commentaire, en kana, en kanji ou en romaji.',
      shown: 'La cinquième est la plus dure. Tu l’avais ?',
      site: site => `D’autres phrases à dire en japonais, chacune avec une réponse de référence et l’avis du tuteur sur la tienne, sur Tsuji : ${site}`,
      app: 'D’autres phrases à dire en japonais, chacune avec une réponse de référence et l’avis du tuteur sur la tienne, sur Tsuji.',
      ask: 'Comment dirais-tu la cinquième ? Écris-la en commentaire.',
      askShown: 'Combien en as-tu dit avant la voix ? Dis-le-moi en commentaire.',
      credit: 'Voix : VOICEVOX Nemo.',
      tags: ['japonais', 'apprendrelejaponais', 'parlerjaponais', 'jlpt'],
    },
  },
}
const quoted = (lang, s) => (lang === 'fr' ? `« ${s} »` : `“${s}”`)
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
const clamp = x => Math.min(1, Math.max(0, x))
const smooth = x => { const k = clamp(x); return k * k * (3 - 2 * k) }
const clock = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`.replace(/:60$/, ':59')

// ── The words a sentence is said with ──
const KANA = /^[ぁ-ゟ゠-ヿ]+$/u
/** A word in its dictionary form, as a clue gives it: a verb or an
 *  adjective said otherwise in the sentence (会います → 会う), its kanji
 *  read by what its reading has over its kana ending; any other word as
 *  the sentence writes it. */
export function dictionaryForm(row) {
  const [lemma, kana] = row.lemma || []
  if (!lemma || !kana || !['verb', 'adjective'].includes(row.pos) || lemma === row.t) return { t: row.t, fu: row.fu || null }
  let n = 0
  while (n < lemma.length && n < kana.length && lemma.at(-1 - n) === kana.at(-1 - n) && KANA.test(lemma.at(-1 - n))) n++
  const stem = lemma.slice(0, lemma.length - n)
  const fu = KANA.test(stem) ? null : [[stem, kana.slice(0, kana.length - n)], ...(n ? [[lemma.slice(-n), '']] : [])]
  return { t: lemma, fu }
}
/** A sense cut to its first part, as a clue or a blank says it. */
export const shortSense = s => String(s || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*\(.*$/, '').split(/[,;]/)[0].trim()
/** Whether a row is a word the viewer must find, a clue and a blank: a
 *  word of the deck with a sense, but never a piece of the pattern the
 *  sentence was written for (`point`: its ください, its causative's する,
 *  its ばいい's いい), unless it is the word the sentence is about (its
 *  `focus`, 運んで of 運んであげました); never the verb an honorific
 *  pattern says in its own shape (おかけ of お〜ください, whose deck
 *  sense is "to hang"); never the negative ない after a verb or an
 *  adjective (行きたく + ない), which is the form, not a word. */
export function isClue(rows, i, point = '', focus = '') {
  const r = rows[i]
  if (r.k !== 'word') return false
  if (!(r.en?.length && r.fr?.length)) return false
  if (r.t === 'ない' && i > 0 && ['verb', 'adjective'].includes(rows[i - 1].pos)) return false
  const own = focus && (r.t === focus || r.lemma?.[0] === focus || r.t.startsWith(focus))
  if (point && (r.g || []).includes(point) && !own) return false
  if (/^[おご]/.test(point) && r.pos === 'verb' && /^[おご]/.test(r.t) && !own) return false
  return true
}
const spoken = rows => rows.reduce((n, r) => n + moraeOf(r), 0)
/** The cards a sentence's help shows: CARDS of its words at most, the
 *  ones a viewer needs least (a pronoun, then a word of a lower level) left
 *  out first; its frame still blanks them all. A card's `rank` is how much
 *  it is needed, so the layout can leave out more the same way where even
 *  its smallest cards do not stand in the box (cluesLayout). */
const CARDS = 5
const EASE = { pronoun: 0, N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }
const rankOf = r => (r.pos === 'pronoun' ? EASE.pronoun : EASE[r.lv] ?? 6)
/** A deal of cards never in the sentence's own order: one that falls on it is turned by one. */
function unordered(order) {
  const same = order.length > 1 && order.every((v, i) => i === 0 || order[i - 1] < v)
  return same ? [...order.slice(1), order[0]] : order
}
function cardsOf(rows, blanks) {
  if (blanks.length <= CARDS) return blanks
  const kept = new Set([...blanks].sort((a, b) => rankOf(rows[b]) - rankOf(rows[a]) || a - b).slice(0, CARDS))
  return blanks.filter(i => kept.has(i))
}

// ── The deal ──
/** The sentences a level can ask: with a translation in both languages
 *  short enough to hold in mind and say in the countdown (SAYABLE
 *  characters, which leaves out a few of N2's and N1's longest), and at
 *  least one word to find. */
export const SAYABLE = 140
const askable = bank => (bank?.sentences || []).filter(s => s.en && s.fr && s.en.length <= SAYABLE && s.fr.length <= SAYABLE && s.rows.some((_, i) => isClue(s.rows, i, s.p, s.focus)))
/** A level's sentences in parts of five (PART): sorted by how long they are
 *  said, cut into five bands, part p taking the p-th of each band, so each
 *  climbs from short to long and its fifth is its longest. The same deal
 *  every time: sorted by length, then by id. */
export function sayitDeal(bank) {
  const all = askable(bank).map(s => ({ id: s.id, n: spoken(s.rows) })).sort((a, b) => a.n - b.n || a.id.localeCompare(b.id, 'en', { numeric: true }))
  const parts = Math.floor(all.length / PART)
  return Array.from({ length: parts }, (_, p) => Array.from({ length: PART }, (__, b) => all[b * parts + p].id))
}
/** The level's parts, as the studio lists them. */
export function sayitItems(bank, lang = 'en') {
  const S = W[lang === 'fr' ? 'fr' : 'en']
  const lv = bank?.level || 'N5'
  const byId = new Map((bank?.sentences || []).map(s => [s.id, s]))
  return sayitDeal(bank).map((ids, p) => ({
    id: `${lv}:${p + 1}`,
    jp: byId.get(ids[0]).jp,
    sub: ids.map(id => byId.get(id)[lang] || byId.get(id).en).join(' · '),
    tag: S.part(lv, p + 1),
  }))
}

/** A video: part `id` (`N5:3`) of a level's bank (bank/N5.json …), the first
 *  part where the id names none. `show`: the fifth said like the others,
 *  not left to the comments. */
export function sayitPlan(bank, id, opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en'
  const lv = bank.level
  const deal = sayitDeal(bank)
  const m = /^(N[1-5]):(\d+)$/.exec(String(id || ''))
  const p = m && m[1] === lv && Number(m[2]) >= 1 && Number(m[2]) <= deal.length ? Number(m[2]) : 1
  const byId = new Map(bank.sentences.map(s => [s.id, s]))
  const items = deal[p - 1].map(sid => {
    const s = byId.get(sid)
    const blanks = s.rows.map((_, i) => (isClue(s.rows, i, s.p, s.focus) ? i : -1)).filter(i => i >= 0)
    return {
      id: s.id, rows: s.rows, jp: s.jp, tr: s[lang] || s.en,
      // The other register, where the sentence has one.
      v: s.v ? { to: s.v.to, rows: s.v.rows, into: s.v.into?.[0] || '' } : null,
      blanks,
      // The clue cards, in an order of their own, never the sentence's (a
      // deal that falls on it is turned by one); five at most, a pronoun,
      // then the easiest words, left to the viewer first.
      clues: unordered(shuffle(cardsOf(s.rows, blanks), seeded(`sayit|${s.id}`))).map(i => {
        const r = s.rows[i]
        return { i, ...dictionaryForm(r), sense: shortSense((r[lang] || r.en)[0]), rank: rankOf(r) }
      }),
    }
  })
  return {
    source: 'sayit', id: `${lv}:${p}`, part: p, parts: deal.length, lang, lv, items,
    hour: HOURS.includes(opts.hour) ? opts.hour : 'day',
    season: PRINT_SEASONS.includes(opts.season) ? opts.season : null,
    scenery: SCENERY_IDS.includes(opts.scenery) ? opts.scenery : 'bay',
    photo: null,
    hidden: opts.show !== true,
    // The maker's beats, on the print as it was drawn.
    tune: { ...(opts.tune || {}), ...PRINT_LOOK },
    ruby: RUBY.has(lv), romaji: ROMAJI.has(lv), slow: SLOW.has(lv),
  }
}
/** What the print under it is loaded with (app.loadPrint). */
export const sayitPrintOpts = plan => ({ season: plan.season, scenery: plan.scenery, falls: true, bursts: true })

/** The lines the reader says: each sentence revealed. */
export function sayitCues(plan) {
  return plan.items.filter((_, i) => !(plan.hidden && i === plan.items.length - 1)).map(it => ({ text: it.jp, who: 'reader', slow: plan.slow, marks: true }))
}

/** The video, timed. `voiced(cue)` gives a voiced line's { dur, marks }
 *  once the engine has said it; without it a line is timed on a guess. */
export function sayitTimeline(plan, voiced = null) {
  const S = W[plan.lang]
  const segs = []
  const sfx = [{ at: 0.15, key: 'board-flap' }]
  const cues = []
  const turns = []
  const chapters = [{ at: 0, title: S.chapters.hook }]
  const seg = (key, start, dur) => segs.push({ key, start: +start.toFixed(3), dur: +dur.toFixed(3) })
  const hook = beat(plan, 'hook')
  const step = beat(plan, 'step')
  const think = thinkOf(plan)
  seg('hook', 0, hook)
  let t = hook
  let readingEnd = t
  const last = plan.items.length - 1
  plan.items.forEach((it, i) => {
    const start = t
    const ring = start + IN
    sfx.push({ at: +(start + 0.05).toFixed(3), key: 'card-transition', gain: 0.6 })
    for (let k = 0; k < think; k++) sfx.push({ at: +(ring + k).toFixed(3), key: 'click', gain: 0.35 })
    // The help, a step at a time: its words, then its frame.
    const help = [ring + step, ring + 2 * step].map(x => +x.toFixed(3))
    const told = ring + think
    if (plan.hidden && i === last) {
      t = told + beat(plan, 'ask')
      chapters.push({ at: +start.toFixed(3), title: S.chapters.last(i + 1) })
      turns.push({ i, start: +start.toFixed(3), ring: +ring.toFixed(3), help, told: +told.toFixed(3), hidden: true, end: +t.toFixed(3) })
      sfx.push({ at: +told.toFixed(3), key: 'card-transition' })
      return
    }
    const cue = { text: it.jp, who: 'reader', slow: plan.slow, marks: true }
    const v = voiced?.(cue)
    // A guess: the engine's pace, about 0.15 s a syllable (0.18 slowed), its pauses and pads.
    const guess = 0.25 + spoken(it.rows) * (plan.slow ? 0.18 : 0.15) + it.rows.filter(r => r.t === '、').length * 0.25
    const dur = v?.dur ?? guess
    const at = told + LEAD
    cues.push({ ...cue, at: +at.toFixed(3) })
    const also = at + dur + beat(plan, 'hold')
    t = also + (it.v ? beat(plan, 'also') : 0) + OUT
    chapters.push({ at: +start.toFixed(3), title: S.chapters.turn(i + 1) })
    turns.push({
      i, start: +start.toFixed(3), ring: +ring.toFixed(3), help, told: +told.toFixed(3), voice: +at.toFixed(3), dur: +dur.toFixed(3),
      words: wordTimes(it.rows, at, dur, v?.marks).map(x => +x.toFixed(3)), also: it.v ? +also.toFixed(3) : null, end: +t.toFixed(3),
    })
    readingEnd = t
  })
  // The ground's clock, as the reading challenge's: the sentences said are
  // its reading (the train crossing, the print raised); the one left to the
  // comments its question.
  seg('reading', hook, readingEnd - hook)
  if (plan.hidden) seg('question', readingEnd, t - readingEnd)
  sfx.push({ at: +(t + 0.5).toFixed(3), key: 'platform-chime' })
  chapters.push({ at: +t.toFixed(3), title: S.chapters.cta })
  seg('cta', t, beat(plan, 'cta'))
  t += beat(plan, 'cta')
  segs.sort((a, b) => a.start - b.start)
  return { seconds: +t.toFixed(3), segs, turns, cues, sfx, fps: 30, loudness: -16, chapters }
}

/** The command that makes it, from frontend/ (the voice engine running). */
export function sayitCommand(plan) {
  const season = plan.season ? ` --season ${plan.season}` : ''
  const scenery = plan.scenery !== 'bay' ? ` --scenery ${plan.scenery}` : ''
  const show = plan.hidden ? '' : ' --show'
  return `VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs --sayit ${plan.id} --hour ${plan.hour}${season}${scenery} --lang ${plan.lang}${show}${tuneFlag(plan.tune, 'sayit')}`
}
/** The file name a render gives it. */
export const sayitSlug = plan => ['sayit', plan.id.replace(':', '-').toLowerCase(), ...(plan.scenery !== 'bay' ? [plan.scenery] : []), ...(plan.season ? [plan.season] : []), plan.hour, plan.lang, ...(plan.hidden ? ['comment'] : [])].join('-')

/** The video's page: its title, its description, its tags, its posts. */
export function sayitPage(plan, tl, site) {
  const S = W[plan.lang].page
  const body = S.body(beat(plan, 'step'))
  const tags = [...S.tags, `jlpt${plan.lv.toLowerCase()}`, '日本語', '翻訳']
  const lines = [
    `JLPT ${plan.lv} · ${W[plan.lang].sentences(plan.items.length)} · ${clock(tl.seconds)}`,
    body,
    plan.hidden ? S.last : S.shown,
    S.site(site),
    S.credit,
    tags.map(x => `#${x}`).join(' '),
  ]
  const page = { title: S.title(plan.lv, plan.items[0].tr), description: lines.join('\n\n'), tags: tags.join(', ') }
  const feed = {
    hook: page.title, lines: [body], app: S.app, ask: plan.hidden ? S.ask : S.askShown, credits: [S.credit],
    ...(plan.hidden ? { reels: `📌 ${S.ask}` } : {}),
    hashtags: [S.tags[1], S.tags[2], S.tags[0], `jlpt${plan.lv.toLowerCase()}`, '日本語'],
  }
  return { ...page, feeds: feedPosts(page, feed, plan.lang) }
}

// ── Drawing ──────────────────────────────────────────────────────
const FMT = FORMATS.story
const fr = frame(FMT)
const UNDER = MASTHEAD.y + MASTHEAD.size
// The panel the sentences stand on, as read along stands its text, from a
// step under the masthead's row to the safe area's foot: a turn holds the
// sentence to say, the answer's box, the countdown and the voice's credit.
const TOP = UNDER + SP[5]
const FOOT = fr.bottom - FS.sm * 1.2
const PAD = SP[5]
const COL = { x: fr.x + PAD, w: fr.w - PAD * 2 }
const SAY_Z = FS.title * 1.15
const RING_R = 44
// The sentence to say, as large as it stands on few lines: the heading's
// size on two lines at most, the title's on three, the lead's on four.
const PROMPT = [[FS.heading, 2], [FS.title, 3], [FS.lead, 4], [FS.body, 5], [FS.sm, 6]]
// Japanese is never set under this on the panel (the reply videos' floor, READABLE).
const JP_MIN = FS.sm
// Where the cover's words start: under the hour's sun or moon, whose foot
// stands at y 482 under the hook (the slip stands at 500, cover.js).
const COVER_TOP = 510

const layouts = new Map()
function layOf(ctx, plan, key, rows, o) {
  const k = `${plan.lang}|${key}|${JSON.stringify(o)}`
  if (!layouts.has(k)) layouts.set(k, layoutSentence(ctx, rows, { fam: 'jp', weight: 700, rules: false, gap: 0.12, ...o }))
  return layouts.get(k)
}
/** Where each word of a laid-out sentence stands, as drawSentence puts it. */
function unitBoxes(L, x, y) {
  const out = []
  L.lines.forEach((line, li) => {
    const top = y + li * (L.lineH + L.lineGap)
    let at = x - L.lineW(line) / 2
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

// ── A turn's layout, worked out once a sentence ──
const SENSE = (plan, r) => shortSense((r[plan.lang] || r.en || [])[0])
/** The sentence, laid out once for the frame and the reveal alike, so the
 *  words fill the frame's blanks where they stand: under each word the
 *  room for the longer of its romaji and what it means, as large as `maxH`
 *  holds it, never under JP_MIN. A sentence too long to stand so (at N3
 *  and up, a long one) is laid out without that room: its frame's blanks
 *  stand bare, their meanings having been on the cards a step before, and
 *  its romaji go, as they do at N3 and up (`glossed` says which). */
function sentenceLayout(ctx, plan, it, maxH) {
  const romF = font(500, Math.max(SAY_Z * 0.3, FS.sm * 0.9), 'latin')
  const rows = it.rows.map((r, i) => {
    if (!it.blanks.includes(i)) return r
    const a = r.ro || ''
    const b = SENSE(plan, r)
    return { ...r, ro: measure(ctx, b, romF) > measure(ctx, a, romF) ? b : a, own: a }
  })
  const opts = { max: SAY_Z, min: JP_MIN, maxW: COL.w, maxLines: 6, maxH, script: plan.ruby ? 'furigana' : 'kanji' }
  const L = layOf(ctx, plan, `say|${it.id}|${Math.round(maxH)}`, rows, { ...opts, romaji: true })
  if (L.h <= maxH) return { ...L, glossed: true }
  return { ...layOf(ctx, plan, `say|${it.id}|${Math.round(maxH)}|bare`, rows, { ...opts, romaji: false }), glossed: false }
}
/** The other register: its label, the sentence said the other way. */
function otherLayout(ctx, plan, it) {
  const S = W[plan.lang]
  const label = fit(ctx, S.also[it.v.to] || S.also.plain, { weight: 700, sizes: [FS.sm], maxW: COL.w, maxLines: 1 })
  const L = layOf(ctx, plan, `other|${it.id}`, it.v.rows, { max: FS.lead, min: JP_MIN, maxW: COL.w, maxLines: 2, script: 'kanji' })
  return { label, L, h: label.size * 1.15 + SP[2] + L.h }
}
/** Its words, each on a card: the word in its dictionary form over what it
 *  means, rows of them as many as the column holds, each row centred; a
 *  size down at a time until they stand in the box. */
// The cards' steps: the word's size, its sense's sizes and lines, the card's padding.
const CLUE_STEPS = [
  { wz: FS.lead, sz: [FS.sm, FS.caption], lines: 2, pad: SP[3], gap: SP[2] },
  { wz: FS.body, sz: [FS.caption], lines: 2, pad: SP[3], gap: SP[2] },
  { wz: JP_MIN, sz: [FS.caption], lines: 2, pad: SP[2], gap: SP[1] },
  { wz: JP_MIN, sz: [FS.caption], lines: 1, pad: SP[2], gap: SP[1] },
]
function cluesLayout(ctx, plan, it, room, clues = it.clues) {
  let out = null
  for (const { wz, sz, lines, pad, gap } of CLUE_STEPS) {
    // A third of the column for a card's sense, so three stand in a row.
    const third = (COL.w - SP[3] * 2) / 3 - pad * 2
    const cards = clues.map(c => {
      const L = layOf(ctx, plan, `clue|${it.id}|${c.i}|${wz}`, [{ t: c.t, fu: c.fu || undefined, k: 'word' }], { max: wz, min: JP_MIN, maxW: COL.w - pad * 2, maxLines: 1, script: plan.ruby ? 'furigana' : 'kanji' })
      const sb = fit(ctx, c.sense, { weight: 600, sizes: sz, maxW: Math.max(third, L.lineW(L.lines[0])), maxLines: lines, lh: 1.15 })
      const w = Math.max(L.lineW(L.lines[0]), ...sb.lines.map(l => measure(ctx, l, sb.f))) + pad * 2
      return { c, L, sb, w, gap, h: L.h + gap + sb.size * 1.15 * sb.lines.length + pad * 2 }
    })
    const rows = [[]]
    let used = 0
    for (const card of cards) {
      if (rows.at(-1).length && used + SP[3] + card.w > COL.w) { rows.push([]); used = 0 }
      used += (rows.at(-1).length ? SP[3] : 0) + card.w
      rows.at(-1).push(card)
    }
    const hs = rows.map(row => Math.max(...row.map(c => c.h)))
    out = { rows, hs, h: hs.reduce((n, x) => n + x, 0) + SP[3] * (rows.length - 1), pad, n: cards.length }
    if (out.h <= room) return out
  }
  // Not even its smallest cards stand in the box: the one needed least goes, down to three.
  if (clues.length <= 3) return out
  const least = clues.reduce((m, c) => (c.rank < m.rank || (c.rank === m.rank && c.i > m.i) ? c : m), clues[0])
  return cluesLayout(ctx, plan, it, room, clues.filter(c => c !== least))
}
/** A turn laid out: the sentence to say, the answer's box, the countdown
 *  under it, and the sentence and its other register standing where the
 *  frame stood, so nothing moves as its blanks are filled. */
const turnLays = new Map()
export function turnLayout(ctx, plan, it) {
  const key = `${plan.lang}|${it.id}`
  if (turnLays.has(key)) return turnLays.get(key)
  const S = W[plan.lang]
  const label = fit(ctx, S.ask.toLocaleUpperCase(plan.lang), { weight: 700, sizes: [FS.sm], maxW: COL.w, maxLines: 1 })
  let prompt = null
  for (const [z, n] of PROMPT) {
    prompt = fit(ctx, quoted(plan.lang, it.tr), { weight: 700, fam: 'serif', sizes: [z], maxW: COL.w, maxLines: n, lh: 1.12 })
    if (!prompt.cut) break
  }
  const promptY = TOP + PAD + label.size * 1.15 + SP[3]
  const zone = promptY + prompt.size * 1.12 * prompt.lines.length + SP[5]
  // The foot: the voice's credit at the panel's foot, what to do over it,
  // the countdown over that; above it all the answer's box.
  const creditY = FOOT - SP[3]
  const labelY = creditY - FS.sm - SP[4]
  const ringY = labelY - FS.body * 0.85 - SP[2] - RING_R * 2
  const box = { x: COL.x - SP[2], y: zone, w: COL.w + SP[2] * 2, h: ringY - SP[4] - zone }
  const O = it.v ? otherLayout(ctx, plan, it) : null
  // The sentence as large as the box holds its frame, and the reveal's room
  // (down to the countdown's label, gone by then) it and its other register.
  const room = creditY - FS.sm - SP[3] - zone
  const L = sentenceLayout(ctx, plan, it, Math.min(box.h, room - (O ? SP[5] + O.h : 0)))
  const whole = L.h + (O ? SP[5] + O.h : 0)
  const sayY = Math.max(box.y, Math.min(box.y + (room - whole) / 2, box.y + box.h - L.h))
  const C = cluesLayout(ctx, plan, it, box.h - SP[3] * 2)
  const out = { label, prompt, promptY, zone, box, creditY, labelY, ringY, room, O, L, sayY, C }
  turnLays.set(key, out)
  return out
}

function shade(ctx, on = true) {
  ctx.shadowColor = on ? 'rgba(0,0,0,0.55)' : 'transparent'
  ctx.shadowBlur = on ? 16 : 0
  ctx.shadowOffsetY = on ? 2 : 0
}
function lines(ctx, b, y, color, lh = 1.15, x = fr.cx) {
  ctx.save()
  shade(ctx)
  b.lines.forEach((l, i) => text(ctx, l, x, y + b.size * (0.85 + i * lh), { f: b.f, color, align: 'center' }))
  ctx.restore()
  return y + b.size * lh * b.lines.length
}
function chip(ctx, label, x, y, { z = FS.sm, fill = 'rgba(16,14,19,0.62)', align = 'right', maxW = fr.w } = {}) {
  const b = fit(ctx, label, { weight: 700, sizes: [z, FS.sm, FS.caption].filter(v => v <= z), maxW: maxW - SP[5] * 2, maxLines: 1 })
  const w = measure(ctx, b.lines[0], b.f) + SP[5] * 2
  const h = z * 1.9
  const x0 = align === 'right' ? x - w : x - w / 2
  ctx.fillStyle = fill
  rrect(ctx, x0, y, w, h, h / 2)
  ctx.fill()
  text(ctx, b.lines[0], x0 + SP[5], y + h / 2 + b.size * 0.36, { f: b.f, color: LIGHT })
  return y + h
}
function masthead(ctx, glow = 0) {
  if (!(glow > 0.001)) return drawMasthead(ctx, LIGHT, GOLD)
  glowMasthead(ctx, Math.min(1, glow), LOOK)
}

/** Any second of the video. `P` is the hour's print (app.js loadPrint), or null. */
export function drawSayit(ctx, plan, tl, t, P = null) {
  const s = tl.segs.find(x => t < x.start + x.dur) ?? tl.segs.at(-1)
  const into = t - s.start
  ctx.save()
  if (s.key === 'hook') hook(ctx, plan, tl, t, P)
  else if (s.key === 'cta') cta(ctx, plan, tl, t, into, P)
  else turnFrame(ctx, plan, tl, t, s.key, P)
  ctx.restore()
  return t
}
/** The moment its thumbnail is taken: the cover, whole from its first frame. */
export const sayitStillAt = () => 0.5

/** The hook's words, in the plan's language. */
export function hookWords(plan) {
  const S = W[plan.lang]
  return { hook: S.hook, title: S.title, chip: S.chip(plan.lv, plan.items.length, thinkOf(plan)) }
}
function hook(ctx, plan, tl, t, P) {
  const { laid } = backdrop(ctx, P, LOOK, { dark: 0.5, hour: plan.hour, wash: 1, plan, tl, t, seg: 'hook', cover: true })
  poster(ctx, plan)
  masthead(ctx, 1 - laid)
}

// A band of night across the frame behind light words over the print in
// its colours, thinning out above and below so no edge shows.
function nightBand(ctx, y0, y1, a = 0.6, feather = 150) {
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
// 日本語で？, its reading over it: what the cover asks for.
const JA_ROWS = [
  { t: '日本語', fu: [['日本語', 'にほんご']], k: 'word', pos: 'noun', ro: 'nihongo' },
  { t: 'で', k: 'particle', pos: 'particle', ro: 'de' },
  { t: '？', k: 'punct' },
]
const ARROW_H = 64
/** The poster laid out: the hook as a label, the first sentence large, the
 *  arrow, 日本語で？ and the chip, the sentence a size down at a time until
 *  the whole stands inside the safe area. */
const posters = new Map()
export function posterLayout(ctx, plan) {
  const key = `${plan.lang}|${plan.id}`
  if (posters.has(key)) return posters.get(key)
  const S = W[plan.lang]
  const ja = layOf(ctx, plan, 'cover-ja', JA_ROWS, { max: FS.heading, min: FS.title, maxW: fr.w, maxLines: 1, script: 'furigana' })
  const chipH = FS.body * 1.9
  const label = fit(ctx, S.hook.toLocaleUpperCase(plan.lang), { weight: 800, sizes: [FS.body, FS.sm], maxW: fr.w, maxLines: 2, lh: 1.2 })
  let out = null
  for (const [sizes, n] of [[[FS.display, FS.display * 0.85], 4], [[FS.heading], 4], [[FS.title], 5], [[FS.lead], 6], [[FS.body], 7]]) {
    const big = fit(ctx, quoted(plan.lang, plan.items[0].tr), { weight: 900, fam: 'serif', sizes, maxW: fr.w, maxLines: n, lh: 1.04 })
    const h = paragraphH(label, 1.2) + SP[5] + paragraphH(big, 1.04) + SP[4] + ARROW_H + SP[3] + ja.h + SP[6] + chipH
    out = { label, big, ja, h }
    if (!big.cut && COVER_TOP + h <= fr.bottom - SP[6]) break
  }
  posters.set(key, out)
  return out
}
// 大書 — the first sentence large over the print, 日本語で？ under it.
function poster(ctx, plan) {
  const { label, big, ja, h } = posterLayout(ctx, plan)
  const y0 = COVER_TOP
  nightBand(ctx, y0 - SP[2], y0 + h + SP[4])
  let y = lines(ctx, label, y0, RUBY_INK, 1.2) + SP[5]
  y = lines(ctx, big, y, LIGHT, 1.04) + SP[4]
  // The arrow down to the Japanese the viewer is asked for.
  ctx.save()
  shade(ctx)
  ctx.strokeStyle = SKY
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(fr.cx, y + 6)
  ctx.lineTo(fr.cx, y + ARROW_H - 8)
  ctx.moveTo(fr.cx - 18, y + ARROW_H - 26)
  ctx.lineTo(fr.cx, y + ARROW_H - 8)
  ctx.lineTo(fr.cx + 18, y + ARROW_H - 26)
  ctx.stroke()
  ctx.restore()
  y += ARROW_H + SP[3]
  ctx.save()
  shade(ctx)
  drawSentence(ctx, ja, fr.cx, y, 'center', () => ({ ink: SKY, rule: null, ruby: RUBY_INK }))
  ctx.restore()
  y += ja.h + SP[6]
  chip(ctx, hookWords(plan).chip, fr.cx, y, { z: FS.body, fill: 'rgba(16,14,19,0.78)', align: 'center' })
}

// ── A turn ──
function turnAt(tl, t) {
  return tl.turns.reduce((cur, x) => (t >= x.start ? x : cur), tl.turns[0])
}
function turnFrame(ctx, plan, tl, t, seg, P) {
  const S = W[plan.lang]
  const turn = turnAt(tl, t)
  const it = plan.items[turn.i]
  const segStart = tl.segs.find(x => x.key === seg)?.start ?? 0
  const { laid } = backdrop(ctx, P, LOOK, { dark: 0.42, hour: plan.hour, wash: 1, plan, tl, t, seg, cover: true })
  masthead(ctx, 1 - laid)
  // The cut after the cover, one thing at a time, never words over words:
  // the cover's words go (COVER_OUT), then the panel comes, then the turn on it.
  const cut = t - segStart
  const opening = turn.i === 0 && seg === 'reading'
  const first = opening ? ease((cut - COVER_OUT * 0.6) / 0.45) : 1
  ctx.save()
  ctx.globalAlpha *= first
  ctx.fillStyle = `rgba(16,14,19,${alongPanel(plan, P)})`
  rrect(ctx, fr.x, TOP, fr.w, FOOT - TOP, R.card * 2)
  ctx.fill()
  ctx.restore()
  // Each turn comes in and goes: the whole turn fades out over its last moment.
  const going = turn.hidden ? 1 : 1 - clamp((t - (turn.end - OUT)) / OUT)
  const coming = opening ? ease((cut - COVER_OUT) / (IN - COVER_OUT * 0.5)) : ease((t - turn.start) / IN)
  const lay = turnLayout(ctx, plan, it)
  const { box, L, O, sayY } = lay
  ctx.save()
  ctx.globalAlpha *= first
  // The chip waits, as the reading challenge's does, for the sun or the moon to rise past it.
  const shown = turn.i === 0 ? chipShown(plan, t - segStart, P) : 1
  if (shown > 0) {
    ctx.save()
    ctx.globalAlpha *= shown
    chip(ctx, `JLPT ${plan.lv} · ${turn.i + 1} / ${plan.items.length}`, fr.right, fr.y + 6)
    ctx.restore()
  }
  ctx.globalAlpha *= going
  // The sentence to say, in the viewer's language.
  ctx.save()
  ctx.globalAlpha *= coming
  lines(ctx, lay.label, TOP + PAD, RUBY_INK)
  lines(ctx, lay.prompt, lay.promptY, LIGHT, 1.12)
  ctx.restore()
  const said = turn.voice != null && t >= turn.voice - 0.05
  // What helps, by the moment: nothing, then its words (cards), then its frame (blanks).
  const [atClues, atFrame] = turn.help
  const cluesK = ease((t - atClues) / 0.5) * (1 - ease((t - atFrame) / 0.4))
  const frameK = ease((t - atFrame) / 0.5)
  const boxK = turn.hidden ? coming : coming * (1 - clamp((t - turn.told) / 0.4))
  if (boxK > 0) answerBox(ctx, box, boxK)
  if (!turn.hidden || t < turn.told) {
    if (t < atClues && !said) waiting(ctx, box, t, coming)
    if (cluesK > 0 && !said) clueCards(ctx, lay, cluesK * coming)
    if (frameK > 0 || said) sentence(ctx, plan, it, L, sayY, turn, t, frameK * coming)
    if (said && O && turn.also != null) other(ctx, it, O, sayY + L.h + SP[5], ease((t - turn.also) / 0.5))
  }
  // The countdown, then the voice's credit where it reads.
  if (t < turn.told + 0.4) ring(ctx, plan, turn, t, lay, 1 - clamp((t - turn.told) / 0.4))
  if (turn.hidden && t >= turn.told) yours(ctx, plan, box, ease((t - turn.told) / 0.5))
  ctx.restore()
  if (opening && cut < COVER_OUT) {
    ctx.save()
    ctx.globalAlpha *= 1 - smooth(cut / COVER_OUT)
    poster(ctx, plan)
    ctx.restore()
  }
  // The voice's credit, on the panel, as it comes.
  ctx.save()
  ctx.globalAlpha *= first
  text(ctx, S.voice, fr.cx, lay.creditY, { f: font(600, FS.sm, 'latin'), color: alpha(LIGHT, 0.6), align: 'center' })
  ctx.restore()
}

// Where the answer goes: a dashed box, faint, while the countdown runs.
function answerBox(ctx, box, k) {
  ctx.save()
  ctx.globalAlpha *= k
  ctx.setLineDash([14, 12])
  ctx.lineWidth = 3
  ctx.strokeStyle = alpha(LIGHT, 0.2)
  rrect(ctx, box.x, box.y, box.w, box.h, R.card * 1.5)
  ctx.stroke()
  ctx.restore()
}
// Nothing yet: three dots, as a voice about to speak.
function waiting(ctx, box, t, k) {
  const cy = box.y + box.h / 2
  for (let i = 0; i < 3; i++) {
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t * 0.9) - i * 0.9))
    ctx.fillStyle = alpha(LIGHT, a * k)
    ctx.beginPath()
    ctx.arc(fr.cx + (i - 1) * 34, cy, 9, 0, Math.PI * 2)
    ctx.fill()
  }
}
function ring(ctx, plan, turn, t, lay, k) {
  const S = W[plan.lang]
  const think = thinkOf(plan)
  const left = Math.max(0, think - Math.max(0, t - turn.ring))
  const y = lay.ringY
  ctx.save()
  ctx.globalAlpha *= k * ease((t - turn.ring + 0.3) / 0.5)
  ctx.lineWidth = 10
  ctx.strokeStyle = LOOK.track
  ctx.beginPath()
  ctx.arc(fr.cx, y + RING_R, RING_R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = LOOK.ring
  ctx.beginPath()
  ctx.arc(fr.cx, y + RING_R, RING_R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / think))
  ctx.stroke()
  text(ctx, String(Math.ceil(left) || ''), fr.cx, y + RING_R + FS.title * 0.34, { f: font(800, FS.title, 'latin'), color: LIGHT, align: 'center' })
  // Under it what to do, or the help that has come.
  const [a, b] = turn.help
  const label = t >= b ? S.help.frame : t >= a ? S.help.clues : S.out
  const lf = fit(ctx, label, { weight: 700, sizes: [FS.body, FS.sm], maxW: COL.w, maxLines: 1 })
  shade(ctx)
  text(ctx, lf.lines[0], fr.cx, lay.labelY, { f: lf.f, color: label === S.out ? LIGHT : LOOK.soft, align: 'center' })
  ctx.restore()
}

function clueCards(ctx, lay, k) {
  const { C, box } = lay
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
      ctx.fillStyle = LOOK.card
      rrect(ctx, x, yy, card.w, h, R.card)
      ctx.fill()
      ctx.strokeStyle = LOOK.cardLine
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = LOOK.line
      rrect(ctx, x + R.card, yy, card.w - R.card * 2, 5, 2.5)
      ctx.fill()
      drawSentence(ctx, card.L, x + card.w / 2, yy + C.pad, 'center', () => ({ ink: LIGHT, rule: null, ruby: RUBY_INK }))
      card.sb.lines.forEach((l, j) => text(ctx, l, x + card.w / 2, yy + C.pad + card.L.h + card.gap + card.sb.size * (0.9 + j * 1.15), { f: card.sb.f, color: LOOK.soft, align: 'center' }))
      ctx.restore()
      x += card.w + SP[3]
      n++
    }
    yy += h + SP[3]
  })
}

// A colour given as #rrggbb or rgba(), its alpha multiplied by `a`.
function alphaOf(c, a) {
  if (c.startsWith('#')) return alpha(c, a)
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return c
  const [r, g, b, a0 = 1] = m[1].split(',').map(Number)
  return `rgba(${r},${g},${b},${+(a0 * a).toFixed(3)})`
}
// The sentence: as its frame (the particles and the endings, a blank for
// each word with what it means under it), filled word by word as the
// voice says it; the word being said gold and ruled, as read along.
function sentence(ctx, plan, it, L, y, turn, t, frameK) {
  const said = turn.voice != null && t >= turn.voice - 0.05
  const when = i => (said ? turn.words[i] : Infinity)
  const next = i => turn.words.find((x, j) => j > i && x > turn.words[i]) ?? turn.voice + turn.dur
  // Each word's own moment: before it is said, a blank; while it is said,
  // gold and ruled; once said, in the ink.
  drawSentence(ctx, L, fr.cx, y, 'center', u => {
    const blank = it.blanks.includes(u.i)
    const at = when(u.i)
    const k = clamp((t - at) / 0.15)
    const saying = t >= at && t < next(u.i)
    const shown = blank ? k : Math.max(k, frameK)
    return {
      ink: alphaOf(saying ? LOOK.lit : LIGHT, shown),
      ruby: alphaOf(saying ? LOOK.lit : RUBY_INK, blank ? k : shown),
      rule: saying ? LOOK.lit : blank && frameK > 0 && k < 1 ? alphaOf(LOOK.soft, frameK * (1 - k)) : null,
      ruleW: saying ? 6 : 4,
    }
  })
  // Under each word: what it means while it is a blank, its romaji once said.
  for (const b of unitBoxes(L, fr.cx, y)) {
    const r = b.u.row
    const blank = it.blanks.includes(b.u.i)
    const k = clamp((t - when(b.u.i)) / 0.15)
    const ro = r.own ?? r.ro
    // A blank keeps the stop that ends its sentence: the frame shows where it ends.
    if (blank && frameK > 0 && k < 1 && b.u.punct) {
      ctx.save()
      ctx.globalAlpha *= frameK * (1 - k)
      text(ctx, b.u.punct, b.x + b.w, b.base, { f: L.f, color: LIGHT })
      ctx.restore()
    }
    if (!L.glossed) continue
    if (blank && frameK > 0 && k < 0.5) {
      ctx.save()
      ctx.globalAlpha *= frameK * (1 - k * 2)
      text(ctx, SENSE(plan, r), b.x + b.w / 2, b.under, { f: L.romF, color: LOOK.soft, align: 'center' })
      ctx.restore()
    }
    const rk = blank && frameK > 0 ? clamp(k * 2 - 1) : k
    if (plan.romaji && rk > 0 && ro) {
      ctx.save()
      ctx.globalAlpha *= rk
      text(ctx, ro, b.x + b.w / 2, b.under, { f: L.romF, color: LOOK.soft, align: 'center' })
      ctx.restore()
    }
  }
}

// The other register: the same sentence said the other way, the part
// that changed lit.
function other(ctx, it, O, y, k) {
  if (!(k > 0)) return
  ctx.save()
  ctx.globalAlpha *= k
  ctx.translate(0, (1 - k) * 14)
  shade(ctx)
  text(ctx, O.label.lines[0], fr.cx, y + O.label.size * 0.85, { f: O.label.f, color: LOOK.soft, align: 'center' })
  const changed = new Set(it.v.rows.map((r, i) => (it.v.into && r.t === it.v.into ? i : -1)).filter(i => i >= 0))
  drawSentence(ctx, O.L, fr.cx, y + O.label.size * 1.15 + SP[2], 'center', u => ({ ink: changed.has(u.i) ? LOOK.lit : LIGHT, ruby: RUBY_INK, rule: changed.has(u.i) ? LOOK.lit : null, ruleW: 4 }))
  ctx.restore()
}

// The last sentence, left to the comments, in the answer's box: its three
// lines as large as the box holds them.
const YOURS = [[[FS.title], [FS.heading, FS.title], [FS.body, FS.sm]], [[FS.lead], [FS.title, FS.lead], [FS.sm]], [[FS.body], [FS.lead, FS.body], [FS.caption]]]
export function yoursLayout(ctx, plan, box) {
  const S = W[plan.lang]
  let out = null
  for (const [top, big, low] of YOURS) {
    const a = fit(ctx, S.yours[0], { weight: 800, sizes: top, maxW: COL.w, maxLines: 1 })
    const b = fit(ctx, S.yours[1], { weight: 900, fam: 'serif', sizes: big, maxW: COL.w, maxLines: 2, lh: 1.08 })
    const c = fit(ctx, S.yours[2], { weight: 600, sizes: low, maxW: COL.w, maxLines: 1 })
    out = { a, b, c, h: a.size * 1.15 + SP[3] + b.size * 1.08 * b.lines.length + SP[3] + c.size * 1.15 }
    if (out.h <= box.h - SP[3] * 2) break
  }
  return out
}
function yours(ctx, plan, box, k) {
  const { a, b, c, h } = yoursLayout(ctx, plan, box)
  let y = box.y + (box.h - h) / 2
  ctx.save()
  ctx.globalAlpha *= k
  y = lines(ctx, a, y, RUBY_INK) + SP[3]
  y = lines(ctx, b, y, LIGHT, 1.08) + SP[3]
  lines(ctx, c, y, LOOK.soft)
  ctx.restore()
}

// ── The way to the app: its own exercise of the same name ──
/** The sentence the app's card is typed with: of the ones said, the
 *  shortest written both ways, so the card shows a sentence whole. */
const cardItem = plan => plan.items.filter((_, i) => !(plan.hidden && i === plan.items.length - 1)).reduce((m, it) => (it.tr.length + it.jp.length * 2 < m.tr.length + m.jp.length * 2 ? it : m))
// The rail of the run's three stops, over the address bar.
const RAIL_Y = fr.bottom - METAL_H - SP[6] - (34 + SP[3] + FS.body * 1.2)
/** Where the way to the app stands: its title, its line, and the app's card
 *  between them and the rail of its three stops. */
export function ctaLayout(ctx, plan) {
  const S = W[plan.lang]
  const title = fit(ctx, S.cta, { weight: 900, fam: 'serif', sizes: [FS.heading, FS.title, FS.lead], maxW: COL.w, maxLines: 1, lh: 1.08 })
  const top = UNDER + SP[5]
  let out = null
  // Its line on two lines, or one, or none where a long sentence needs the card's room.
  for (const [sizes, n] of [[[FS.body, FS.sm], 2], [[FS.sm], 1], [null, 0]]) {
    const line = sizes ? fit(ctx, S.ctaLine, { weight: 600, sizes, maxW: COL.w, maxLines: n, lh: 1.15 }) : null
    if (line?.cut) continue
    const y = top + title.size * 1.08 + SP[3] + (line ? line.size * 1.15 * line.lines.length : 0) + SP[5]
    const box = { x: fr.x, y, w: fr.w, h: RAIL_Y - SP[5] - y }
    out = { title, line, top, box, card: appCardLayout(ctx, plan, cardItem(plan), box) }
    if (out.card.h <= box.h) break
  }
  return out
}
function cta(ctx, plan, tl, t, into, P) {
  const S = W[plan.lang]
  const { laid } = backdrop(ctx, P, LOOK, { dark: 0.62, hour: plan.hour, wash: 1, plan, tl, t, seg: 'cta', cover: true })
  masthead(ctx, 1 - laid)
  const lay = ctaLayout(ctx, plan)
  ctx.save()
  ctx.globalAlpha *= ease(into / 0.6)
  lines(ctx, lay.title, lay.top, LIGHT, 1.08)
  ctx.restore()
  if (lay.line) {
    ctx.save()
    ctx.globalAlpha *= ease((into - 0.2) / 0.6)
    lines(ctx, lay.line, lay.top + lay.title.size * 1.08 + SP[3], LOOK.soft)
    ctx.restore()
  }
  // The exercise as the app runs it, on its card: the sentence, the Japanese
  // typed, the tutor's verdict and the reference.
  const it = cardItem(plan)
  const railY = RAIL_Y
  const box = lay.box
  const k = ease((into - 0.3) / 0.6)
  ctx.save()
  ctx.globalAlpha *= k
  ctx.translate(0, (1 - k) * 30)
  appCard(ctx, plan, it, box, into)
  ctx.restore()
  // The run's three stops, lit as the exercise goes, on a night of their own.
  const ink = SUMI.line.honyaku
  const xs = [1, 3, 5].map(m => fr.x + (fr.w * m) / 6)
  const cy = railY + 17
  const go = ease((into - 1.0) / 3.2)
  ctx.save()
  ctx.globalAlpha *= ease((into - 0.9) / 0.4)
  ctx.fillStyle = 'rgba(16,14,19,0.66)'
  rrect(ctx, fr.x, railY - SP[4], fr.w, 34 + SP[3] + FS.body * 1.2 + SP[4] * 2, R.card * 2)
  ctx.fill()
  ctx.fillStyle = alpha(ink, 0.3)
  rrect(ctx, xs[0], cy - 5, xs[2] - xs[0], 10, 5)
  ctx.fill()
  ctx.fillStyle = ink
  rrect(ctx, xs[0], cy - 5, (xs[2] - xs[0]) * go, 10, 5)
  ctx.fill()
  S.stops.forEach((label, i) => {
    const on = go >= i / 2 - 0.01
    ctx.fillStyle = on ? ink : '#17151a'
    ctx.beginPath()
    ctx.arc(xs[i], cy, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.lineWidth = 6
    ctx.stroke()
    const b = fit(ctx, label, { weight: on ? 700 : 500, sizes: [FS.body, FS.sm, FS.caption], maxW: fr.w / 3 - SP[1], maxLines: 1 })
    text(ctx, b.lines[0], xs[i], cy + 17 + SP[3] + b.size * 0.85, { f: b.f, color: on ? LIGHT : LOOK.soft, align: 'center' })
  })
  ctx.restore()
  const kb = ease((into - 0.5) / 0.6)
  ctx.save()
  ctx.globalAlpha *= kb
  address(ctx, SUMI, fr.x, fr.bottom - METAL_H + (1 - kb) * 30, fr.w, SITE)
  ctx.restore()
}
// The card's steps: the sentence's sizes and lines, the reference's, the field's height.
const CARD_STEPS = [
  { q: [FS.lead], qn: 3, ref: [FS.body], rn: 2, field: FS.lead, vz: FS.body, pad: SP[4] },
  { q: [FS.body], qn: 3, ref: [FS.body, FS.sm], rn: 3, field: FS.body, vz: FS.body, pad: SP[4] },
  { q: [FS.sm], qn: 5, ref: [FS.sm], rn: 3, field: FS.sm, vz: FS.sm, pad: SP[3] },
]
/** The app's card laid out in its box: its sentence, its field, the
 *  verdict and the reference, a size down at a time until they stand in
 *  it, the Japanese never under JP_MIN. */
export function appCardLayout(ctx, plan, it, box) {
  const S = W[plan.lang]
  const w = box.w - SP[5] * 2
  let out = null
  for (const st of CARD_STEPS) {
    const q = fit(ctx, quoted(plan.lang, it.tr), { weight: 700, fam: 'serif', sizes: st.q, maxW: w, maxLines: st.qn, lh: 1.15 })
    const ref = fit(ctx, it.jp, { weight: 500, fam: 'jp', sizes: st.ref, maxW: w, maxLines: st.rn, lh: 1.2 })
    const fieldH = st.field * 1.8
    const h = st.pad + FS.sm * 1.2 + SP[3] + q.size * 1.15 * q.lines.length + st.pad + fieldH + st.pad + st.vz * 1.9 + SP[3] + FS.caption * 1.25 + ref.size * 1.2 * ref.lines.length + st.pad
    out = { q, ref, field: st.field, fieldH, vz: st.vz, pad: st.pad, w, h, label: `翻訳 · ${S.station}` }
    if (h <= box.h && !q.cut && !ref.cut) break
  }
  return out
}
function appCard(ctx, plan, it, box, into) {
  const S = W[plan.lang]
  const p = PAPER
  const C = appCardLayout(ctx, plan, it, box)
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
  const w = C.w
  let y = box.y + C.pad
  // The station's name, in its line.
  text(ctx, C.label, x, y + FS.sm * 0.85, { f: font(700, FS.sm, 'latin'), color: p.line.honyaku })
  y += FS.sm * 1.2 + SP[3]
  C.q.lines.forEach((l, i) => text(ctx, l, x, y + C.q.size * (0.85 + i * 1.15), { f: C.q.f, color: p.ink }))
  y += C.q.size * 1.15 * C.q.lines.length + C.pad
  // The field, the Japanese typed into it a character at a time; a line
  // longer than the field shows its end, as a field scrolls to its caret.
  ctx.fillStyle = p.surface
  rrect(ctx, x, y, w, C.fieldH, R.card)
  ctx.fill()
  ctx.strokeStyle = alpha(p.gold, 0.7)
  ctx.lineWidth = 3
  ctx.stroke()
  const chars = [...it.jp]
  const count = Math.floor(clamp((into - 1.1) / 1.8) * chars.length)
  const jf = font(700, C.field, 'jp')
  const inner = w - SP[4] * 2 - 8
  let from = 0
  while (from < count && measure(ctx, chars.slice(from, count).join(''), jf) > inner) from++
  const typed = chars.slice(from, count).join('')
  const tw = measure(ctx, typed, jf)
  const tx = x + SP[4]
  text(ctx, typed, tx, y + C.fieldH / 2 + C.field * 0.36, { f: jf, color: p.ink })
  if (Math.floor(into * 2) % 2 === 0 || count < chars.length) {
    ctx.fillStyle = p.gold
    ctx.fillRect(tx + tw + 4, y + C.fieldH / 2 - C.field * 0.55, 4, C.field * 1.1)
  }
  y += C.fieldH + C.pad
  // The tutor's verdict, then the reference under it, whole.
  const vk = ease((into - 3.2) / 0.4)
  if (vk > 0) {
    ctx.save()
    ctx.globalAlpha *= vk
    const vf = font(700, C.vz, 'latin')
    const label = `✓  ${S.verdict}`
    const vw = measure(ctx, label, vf) + SP[5] * 2
    const vh = C.vz * 1.9
    ctx.fillStyle = alpha(p.success, 0.14)
    rrect(ctx, x, y, vw, vh, vh / 2)
    ctx.fill()
    text(ctx, label, x + SP[5], y + vh / 2 + C.vz * 0.36, { f: vf, color: p.success })
    y += vh + SP[3]
    text(ctx, S.reference, x, y + FS.caption * 0.85, { f: font(700, FS.caption, 'latin'), color: p.ink2 })
    y += FS.caption * 1.25
    C.ref.lines.forEach((l, i) => text(ctx, l, x, y + C.ref.size * (0.9 + i * 1.2), { f: C.ref.f, color: p.ink }))
    ctx.restore()
  }
}
