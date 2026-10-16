// ── 長編 — the long videos (plan 214) ─────────────────────────────
// Ten-minute 16:9 videos for YouTube: a vocabulary drill, a kanji
// drill, one grammar point explained whole, and a quiz, each also a 9:16
// short. Since plan 218 a long video is drawn as the screen over a
// train's door and a short as a station's name plate (see "Drawing"
// below). Every Japanese line is said by the app's voices; English or
// French is on the screen.
//
// The drills are "think, then reveal": a word alone for three seconds,
// then its reading said twice, its meaning and a sentence it is read
// in; a kanji's strokes drawn in their order, then its readings and two
// words, each said. The quiz deals the studio's own questions
// (quizzes.js: only understanding answers them), five seconds each on a
// ring, then the answer, why, and the sentence said.
//
// Three steps, all pure: `longPlan` picks what a video says (a level's
// part, a theme, a point or a hand-picked list: "pick per video"),
// `timeline` times it from how long each line takes to say (the voices
// are made and measured by backend/scripts/long_video_audio.py, so a
// reveal lands on its voice), and `drawLong` draws the frame at any
// second and returns a key that is the same for two frames that look
// the same, so the renderer (long/render.mjs) draws each still once.
import { K, alpha, drawSentence, fit, font, hasKanji, layoutSentence, mark, measure, noShadow, palette, paragraphH, roundel, rrect, text } from './draw.js'
import { weldIf } from './strings.js'
import { gloss, unpack } from './common.js'
import { plan as sourcePlan, itemsOf } from './sources.js'
import { particleLabel } from './explain.js'
import * as A from './app.js'

export const WIDE = { id: 'wide', w: 1920, h: 1080 }
// A short (plan 214): the same video standing, under a minute, for
// YouTube Shorts, Reels and TikTok; inside the feed's safe area, the
// story format's (draw.js FORMATS.story).
export const TALL = { id: 'tall', w: 1080, h: 1920, safe: { t: 250, r: 144, b: 430, l: 144 } }
export const SHORT = { vocab: 6, kanji: 4, quiz: 3, seconds: 59 }
// The site a description links to: landing/config.mjs's SITE_ORIGIN, which
// reads the disk and cannot load in the studio (a test holds the two equal).
export const LONG_SITE = 'https://japanese-learner-seven.vercel.app'
export const FPS = 30
export const KINDS = ['vocab', 'kanji', 'grammar', 'quiz']
// A part of a drill or a quiz: about ten minutes each (timeline's pace).
export const PART = { vocab: 48, kanji: 36, quiz: 40 }
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const SAY = {
  en: {
    title: {
      vocab: (lv, part) => `JLPT ${lv} vocabulary${part ? ` · part ${part}` : ''}`,
      theme: name => `Japanese vocabulary · ${name}`,
      kanji: (lv, part) => `JLPT ${lv} kanji${part ? ` · part ${part}` : ''}`,
      grammar: (lv, p) => `JLPT ${lv} grammar · ${p}`,
      quiz: (lv, part) => `JLPT ${lv} quiz${part ? ` · part ${part}` : ''}`,
    },
    count: { vocab: n => `${n} words`, kanji: n => `${n} kanji`, quiz: n => `${n} questions` },
    hook: {
      vocab: 'Read each word before it is revealed.',
      kanji: 'Watch the strokes, then read it.',
      grammar: 'One grammar point, from the start.',
      quiz: 'Five seconds a question. Keep score!',
    },
    how: {
      vocab: 'Say it out loud, then listen.',
      kanji: 'Every reading is said aloud.',
      grammar: 'Every sentence is said aloud.',
      quiz: 'Every answer is explained.',
    },
    next: 'Next', readIt: 'Read it…', on: 'ON', kun: 'KUN', strokes: n => `${n} stroke${n > 1 ? 's' : ''}`,
    rule: 'What it does', use: 'How it is used', example: 'Example', careful: 'Watch out', compare: 'Don’t mix it up', twist: 'A twist', scene: 'In a conversation', quizHead: 'Your turn', recap: 'Recap',
    score: (n, of) => n === of ? `That’s all ${of}. How many did you get?` : `Score check: ${n} down, ${of - n} to go.`,
    comment: 'Comment your score.',
    outro: 'Keep going on Tsuji', outroSub: 'The kana line, free for good · No ads, no trackers', depart: 'Depart',
    chapters: { intro: 'Intro', outro: 'Keep going', score: 'Score check', final: 'Your score' },
    voices: 'Voices: VOICEVOX Nemo.',
    study: 'Study with Tsuji:',
  },
  fr: {
    title: {
      vocab: (lv, part) => `Vocabulaire JLPT ${lv}${part ? ` · partie ${part}` : ''}`,
      theme: name => `Vocabulaire japonais · ${name}`,
      kanji: (lv, part) => `Kanji JLPT ${lv}${part ? ` · partie ${part}` : ''}`,
      grammar: (lv, p) => `Grammaire JLPT ${lv} · ${p}`,
      quiz: (lv, part) => `Quiz JLPT ${lv}${part ? ` · partie ${part}` : ''}`,
    },
    count: { vocab: n => `${n} mots`, kanji: n => `${n} kanji`, quiz: n => `${n} questions` },
    hook: {
      vocab: 'Lis chaque mot avant qu’il soit révélé.',
      kanji: 'Regarde les traits, puis lis-le.',
      grammar: 'Un point de grammaire, depuis le début.',
      quiz: 'Cinq secondes par question. Compte tes points !',
    },
    how: {
      vocab: 'Dis-le à voix haute, puis écoute.',
      kanji: 'Chaque lecture est dite à voix haute.',
      grammar: 'Chaque phrase est dite à voix haute.',
      quiz: 'Chaque réponse est expliquée.',
    },
    next: 'Prochain arrêt', readIt: 'Lis-le…', on: 'ON', kun: 'KUN', strokes: n => `${n} trait${n > 1 ? 's' : ''}`,
    rule: 'Ce qu’il fait', use: 'Comment l’employer', example: 'Exemple', careful: 'Attention', compare: 'À ne pas confondre', twist: 'Une variante', scene: 'En conversation', quizHead: 'À toi', recap: 'Récap',
    score: (n, of) => n === of ? `Les ${of} sont passées. Combien en as-tu ?` : `Point d’étape : ${n} faites, encore ${of - n}.`,
    comment: 'Donne ton score en commentaire.',
    outro: 'Continue sur Tsuji', outroSub: 'La ligne des kana, gratuite pour de bon · Sans pub, sans traqueur', depart: 'Embarquer',
    chapters: { intro: 'Intro', outro: 'La suite', score: 'Point d’étape', final: 'Ton score' },
    voices: 'Voix : VOICEVOX Nemo.',
    study: 'Apprendre avec Tsuji :',
  },
}
export const LONG_SAY = SAY

const LINE = { vocab: 'vocab', kanji: 'kanji', grammar: 'grammar', quiz: 'exam' }

// A seeded shuffle, so a video is the same each time it is made.
function seeded(str) {
  let s = 0
  for (const ch of str) s = (s * 31 + ch.codePointAt(0)) % 2147483647
  s = s || 7
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
export const shuffled = (list, seed) => {
  const r = seeded(String(seed))
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const joined = rows => rows.map(r => r.t).join('')
const kanaOf = row => (row.fu ? row.fu.map(([t, r]) => r || t).join('') : row.t)
// Harder levels have smaller numbers: N1 < N5.
const levelNo = lv => Number(String(lv || 'N5').slice(1)) || 5
// A particle said as it sounds: the topic は is "wa", the direction へ "e"
// (a lone syllable is the kana deck's recording, long_video_audio.py).
export const spoken = t => ({ は: 'わ', へ: 'え' })[t] ?? t
// A row nobody reads aloud alone: punctuation, the blank of a question.
const silent = row => row.k === 'punct' || /^[＿_]+$/.test(row.t)

// ── What a video says ─────────────────────────────────────────────
/** A video's plan. `banks` holds the bank files it may read, by name
 *  ('words-N5.json', 'N5.json', 'kanji-N5.json', 'grammar-N5.json',
 *  'themes.json'). Pick a level's `part` (1, 2, … in the deck's order;
 *  a quiz's part is a seeded deal), or a `theme`, or exact `ids`; a
 *  grammar video takes a `point`. */
export function longPlan(kind, banks, opts0 = {}) {
  const pl = planOf(kind, banks, opts0)
  return opts0.format === 'short' ? shorten(pl) : pl
}

/** A short: a few items, each said in fewer lines; a grammar point by its
 *  form, two examples and one question. timeline() paces it, fitShort()
 *  holds it under SHORT.seconds once its lines are measured. */
function shorten(pl) {
  const out = { ...pl, format: 'short' }
  if (pl.kind === 'vocab') out.items = pl.items.map(x => ({ ...x, ex: null }))
  if (pl.kind === 'kanji') out.items = pl.items.map(x => ({ ...x, on: x.on.slice(0, 1), kun: x.kun.slice(0, 1), words: x.words.slice(0, 1) }))
  if (pl.kind === 'grammar') {
    const title = pl.items.find(x => x.type === 'gtitle')
    const ex = pl.items.filter(x => x.type === 'gex').slice(0, 2).map((x, i, all) => ({ ...x, n: i + 1, of: all.length, chips: [] }))
    const q = pl.items.find(x => x.type === 'q' && !x.twist)
    out.items = [title, ...ex, ...(q ? [q] : [])].filter(Boolean)
  }
  return out
}

/** A short under its minute: its last items let go until it fits. */
export function fitShort(plan, dur = null, seconds = SHORT.seconds) {
  let pl = plan
  while (pl.items.length > 1 && timeline(pl, dur).seconds > seconds) pl = { ...pl, items: pl.items.slice(0, -1) }
  return pl
}

function planOf(kind, banks, { lang = 'en', level = 'N5', part = 1, theme = null, ids = null, count = null, point = null, format = 'long' } = {}) {
  const S = SAY[lang] || SAY.en
  const opts = { lang, script: 'kanji', slides: {}, types: {} }
  const base = { kind, lang, level, line: LINE[kind], part, ids: !!ids, theme: null }
  const n = count || (format === 'short' ? SHORT[kind] : PART[kind])
  const slice = list => (ids ? list : list.slice((part - 1) * n, part * n))
  if (kind === 'vocab') {
    let words
    let title
    if (theme) {
      const th = banks['themes.json'].themes[theme]
      if (!th) throw new Error(`no theme ${theme}`)
      words = th.words
      base.theme = th.name?.[lang] || th.name?.en || theme
      title = S.title.theme(base.theme)
    } else {
      words = banks[`words-${level}.json`].words
      title = S.title.vocab(level, ids ? 0 : part)
    }
    if (ids) words = ids.map(id => words.find(w => `${w.t}::${w.r}` === id || w.t === id)).filter(Boolean)
    const items = slice(words.filter(w => gloss(w, lang)[0])).map(w => wordItem(w, banks, lang, theme ? null : level))
    return { ...base, title, items }
  }
  if (kind === 'kanji') {
    const all = banks[`kanji-${level}.json`].kanji
    const chars = slice(ids || Object.keys(all).filter(c => all[c].s?.d?.length))
    const items = chars.filter(c => all[c]).map(c => kanjiItem(c, all[c], lang))
    return { ...base, title: S.title.kanji(level, ids ? 0 : part), items }
  }
  if (kind === 'grammar') {
    const data = banks[`grammar-${level}.json`]
    const L = data.lessons.find(x => x.p === point) || data.lessons[0]
    const pl = sourcePlan('lesson', data, L.p, opts, {})
    return { ...base, title: S.title.grammar(level, L.p), point: L.p, items: lessonItems(L, pl, banks, lang) }
  }
  if (kind === 'quiz') {
    const qs = quizDeal(banks, level, lang, opts, ids ? null : part, n, ids)
    return { ...base, title: S.title.quiz(level, ids ? 0 : part), items: qs.map(q => ({ type: 'q', q })) }
  }
  throw new Error(`no long video of kind ${kind}`)
}

// ── The studio's list (plan 214) ─────────────────────────────────
// The carousel studio offers the long videos as one of its sources: at a
// level, every video it can make, by an id the render command takes.
const QUIZ_SHARE = { sentence: 0.5, word: 0.3, kanji: 0.25 }
const LIST_KIND = { vocab: '語彙', kanji: '漢字', quiz: '試験', grammar: '文法', theme: '主題' }

/** The bank files a level's list reads. */
export const longListFiles = level => [`words-${level}.json`, `kanji-${level}.json`, `${level}.json`, `grammar-${level}.json`, 'themes.json']

/** The videos a level can make: its vocabulary and kanji parts, its
 *  quiz's parts, each grammar point, each theme. */
export function longItems(banks, level, lang = 'en') {
  const S = SAY[lang] || SAY.en
  const out = []
  const parts = (kind, list, name) => {
    const n = PART[kind]
    for (let p = 1; (p - 1) * n < list.length; p++) {
      const some = list.slice((p - 1) * n, p * n)
      out.push({ id: `${kind}:${p}`, kind, jp: `${LIST_KIND[kind]} ${p}`, sub: `${some.slice(0, 6).map(name).join('、')}…`, tag: S.count[kind](some.length) })
    }
  }
  parts('vocab', (banks[`words-${level}.json`]?.words || []).filter(w => gloss(w, lang)[0]), w => w.t)
  const kanji = banks[`kanji-${level}.json`]?.kanji || {}
  parts('kanji', Object.keys(kanji).filter(c => kanji[c].s?.d?.length), c => c)
  // A quiz part deals from its own slice of each list: as many parts as the shortest allows.
  const k = src => Math.ceil(PART.quiz * QUIZ_SHARE[src])
  const quizParts = Math.min(
    Math.floor((banks[`${level}.json`]?.sentences.length || 0) / k('sentence')),
    Math.floor((banks[`words-${level}.json`]?.words.length || 0) / k('word')),
    Math.floor(Object.keys(kanji).length / k('kanji')),
  )
  for (let p = 1; p <= quizParts; p++) out.push({ id: `quiz:${p}`, kind: 'quiz', jp: `${LIST_KIND.quiz} ${p}`, sub: S.title.quiz(level, p), tag: S.count.quiz(PART.quiz) })
  for (const L of banks[`grammar-${level}.json`]?.lessons || []) out.push({ id: `grammar:${L.p}`, kind: 'grammar', jp: L.p, sub: weldIf(lang, L[lang] || L.en), tag: LIST_KIND.grammar })
  for (const [key, th] of Object.entries(banks['themes.json']?.themes || {})) {
    out.push({ id: `theme:${key}`, kind: 'theme', jp: th.head?.t || key, sub: th.name?.[lang] || th.name?.en || key, tag: S.count.vocab(th.words.length) })
  }
  return out
}

/** What a list id asks of longPlan: its kind and its options. */
export function longPick(id, level, lang = 'en', format = 'long') {
  const [kind, rest] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)]
  if (kind === 'grammar') return { kind, opts: { lang, level, point: rest, format } }
  if (kind === 'theme') return { kind: 'vocab', opts: { lang, level, theme: rest, format } }
  const part = Number(rest) || 1
  // A drill's short starts where its long part starts: 語彙 3's short is that part's first six words.
  const short = format === 'short' && kind !== 'quiz' ? ((part - 1) * PART[kind]) / SHORT[kind] + 1 : part
  return { kind, opts: { lang, level, part: short, format } }
}

/** The bank files a video reads: a grammar point glosses its words from
 *  every level's deck, a word's sentence may be an easier level's. */
export function longFiles(id, level) {
  const { kind, opts } = longPick(id, level)
  const easier = LEVELS.slice(0, LEVELS.indexOf(level) + 1)
  if (opts.theme) return ['themes.json']
  if (kind === 'vocab') return [`words-${level}.json`, ...easier.map(lv => `${lv}.json`)]
  if (kind === 'kanji') return [`kanji-${level}.json`]
  if (kind === 'grammar') return [`grammar-${level}.json`, ...LEVELS.map(lv => `words-${lv}.json`)]
  return [`${level}.json`, `words-${level}.json`, `kanji-${level}.json`]
}

/** The command that makes the video, from frontend/. */
export function longCommand(id, level, lang = 'en', format = 'long') {
  const { kind, opts } = longPick(id, level, lang, format)
  const q = v => (/^[\w.-]+$/.test(v) ? v : `'${String(v).replace(/'/g, "'\\''")}'`)
  const args = [`--kind ${kind}`]
  if (opts.theme) args.push(`--theme ${q(opts.theme)}`)
  else args.push(`--level ${level}`)
  if (opts.point) args.push(`--point ${q(opts.point)}`)
  if (opts.part) args.push(`--part ${opts.part}`)
  args.push(`--lang ${lang}`)
  if (format === 'short') args.push('--format short')
  return `VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs ${args.join(' ')}`
}

/** A word, with the first sentence of the bank it is read in that asks nothing above the word's level. */
function wordItem(w, banks, lang, level) {
  const own = levelNo(level || 'N5')
  let ex = null
  for (const id of w.ex || []) {
    const s = banks[`${id.split('.')[0]}.json`]?.sentences.find(x => x.id === id)
    if (!s?.rows || [...s.jp].length > 30) continue
    if (level && s.rows.some(r => r.lv && levelNo(r.lv) < own)) continue
    // The word in it, underlined: as written, or conjugated (its dictionary form).
    const at = s.rows.findIndex(r => r.t === w.t || (r.lemma || []).includes(w.t))
    ex = { rows: s.rows, jp: s.jp, tr: weldIf(lang, s[lang] || s.en), at }
    break
  }
  const [first] = gloss(w, lang)
  return { t: w.t, r: w.r, ro: w.ro, gloss: weldIf(lang, first), ex }
}

function kanjiItem(c, k, lang) {
  const senses = k[lang]?.length ? k[lang] : k.en || []
  return {
    c, strokes: k.s,
    on: (k.on || []).slice(0, 2),
    kun: (k.kun || []).slice(0, 2).map(([a, b]) => [a, b || '']),
    meaning: weldIf(lang, senses.slice(0, 2).join(', ')),
    words: (k.words || []).filter(w => w.t !== c && (w[lang]?.length || w.en?.length)).slice(0, 2)
      .map(w => ({ t: w.t, r: w.r, gloss: weldIf(lang, (w[lang]?.length ? w[lang] : w.en)[0]) })),
  }
}

/** The deck's words by how they are written, for the breakdown's glosses,
 *  and by their kana where one N5 or N4 word alone is read so (ください
 *  is 下さい, まつ is 待つ; かみ is paper, a god and hair, so it is none of
 *  them, and the rarer words' kana, 舞う's まう, never stand in). */
function deckGlosses(banks, lang) {
  const out = new Map()
  const byKana = new Map()
  const verbs = new Map()
  for (const lv of LEVELS) {
    for (const w of banks[`words-${lv}.json`]?.words || []) {
      const [g] = gloss(w, lang)
      if (!g) continue
      if (!out.has(w.t)) out.set(w.t, [])
      out.get(w.t).push({ r: w.r, g })
      if (lv === 'N5' || lv === 'N4' || w.t === w.r) byKana.set(w.r, byKana.has(w.r) && byKana.get(w.r) !== g ? null : g)
    }
  }
  // A kana row stands for an easy word read so only when it is a verb the
  // tokenizer marked or a word of three kana or more: a short fragment,
  // the まつ of しゅうまつ, is no 待つ.
  for (const [kana, g] of byKana) if (g) verbs.set(kana, g)
  return { written: out, kana: verbs }
}
// A verb's dictionary forms from its て-form, た-form or ます-stem, the
// likeliest first: 読んで → 読む, 書いて → 書く, 言って → 言う.
const GODAN = { い: 'う', き: 'く', ぎ: 'ぐ', し: 'す', ち: 'つ', に: 'ぬ', び: 'ぶ', み: 'む', り: 'る' }
export function dictionaryForms(word) {
  const out = []
  // The conditional and the list run on the た-form: ふったら → ふった.
  const t = word.replace(/([ただ])[らり]$/, '$1')
  const stem = (s, ends) => ends.forEach(e => out.push(s + e))
  if (/(行|い)っ[てた]$/.test(t)) out.push(t.replace(/っ[てた]$/, 'く'))
  for (const [tail, ends] of [['んで', ['む', 'ぶ', 'ぬ']], ['んだ', ['む', 'ぶ', 'ぬ']], ['いて', ['く']], ['いた', ['く']], ['いで', ['ぐ']], ['いだ', ['ぐ']], ['って', ['う', 'つ', 'る']], ['った', ['う', 'つ', 'る']], ['して', ['す', 'する']], ['した', ['す', 'する']]]) {
    if (t.endsWith(tail) && t.length > tail.length) stem(t.slice(0, -tail.length), ends)
  }
  if (/[てた]$/.test(t)) out.push(`${t.slice(0, -1)}る`)
  const masu = t.replace(/(ます|ません|ました|ませんでした|ましょう|ませんか|たい|たくない|たかった)$/, '')
  if (masu === 'し') out.push('する')
  if (masu === 'き' || masu === '来') out.push('来る')
  if (masu !== t && masu) {
    out.push(`${masu}る`)
    const last = masu.slice(-1)
    if (GODAN[last]) out.push(masu.slice(0, -1) + GODAN[last])
  }
  if (t === '来て' || t === 'きて') out.unshift('来る')
  if (t === 'して' || t === 'し') out.unshift('する')
  return out
}

/** A chip's gloss: its first senses without their notes, "please" for
 *  "please (give me, please do)". */
export function shortGloss(g) {
  const parts = String(g || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*\.\.\.\s*/g, ' ').split(/,\s*/).map(x => x.trim()).filter(Boolean)
  let out = parts[0] || ''
  for (const x of parts.slice(1)) if (out.length + x.length + 2 <= 22) out += `, ${x}`; else break
  return out
}

/** One grammar point, whole: what it does and how it is used, every
 *  example cut word by word, the caution, its rival, the twists asked
 *  as questions, a conversation, the tour's questions, a recap. */
function lessonItems(L, pl, banks, lang) {
  const tr = o => weldIf(lang, o?.[lang] || o?.en || '')
  const form = lang === 'fr' && L.form_fr ? L.form_fr : L.form
  const meaning = weldIf(lang, L[lang] || L.en)
  const deck = deckGlosses(banks, lang)
  // A word's sense from the deck, as written or from its dictionary form;
  // a particle's from its role there (explain.js). None found, none shown.
  const glossOf = (rows, i) => {
    const r = rows[i]
    if (r.k === 'word') {
      // The entry read as the row is read, where one word is written two ways (行く: いく, ゆく).
      const kana = kanaOf(r)
      const pick = (form, readings) => {
        const all = deck.written.get(form)
        return all ? (all.find(e => readings.includes(e.r)) || all[0]).g : null
      }
      const own = pick(r.t, [kana])
      if (own) return own
      // A kana word between two kana words may be a word cut in two (しゅう まつ): left bare.
      const kanaWord = x => x?.k === 'word' && !hasKanji(x.t)
      const whole = [...r.t].length >= 3 && !kanaWord(rows[i - 1]) && !kanaWord(rows[i + 1])
      if (r.pos !== 'verb') return !hasKanji(r.t) && whole ? deck.kana.get(r.t) || '' : ''
      const readings = dictionaryForms(kana)
      for (const form of dictionaryForms(r.t)) {
        const g = pick(form, readings) ?? deck.kana.get(form)
        if (g) return g
      }
      return ''
    }
    // Only where the role holds there: から after a verb is no "from".
    return particleLabel(rows, i, lang) || ''
  }
  const chips = rows => rows.map((r, i) => [r, i]).filter(([r]) => !silent(r)).map(([r, i]) => ({
    t: r.t, ro: r.ro || '', kana: r.k === 'word' && hasKanji(r.t) ? kanaOf(r) : null, voice: r.k === 'word' ? kanaOf(r) : spoken(r.t),
    lit: !!r.lit, gloss: weldIf(lang, shortGloss(glossOf(rows, i))),
  }))
  const bullets = tr(L.use).split('\n').map(b => b.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean)
  const examples = [...(L.ex || []), ...(L.ex_more || [])].slice(0, 5)
  const items = [
    { type: 'gtitle', p: L.p, meaning, form },
    { type: 'grule', form, rule: tr(L.rule) },
  ]
  for (let i = 0; i < bullets.length; i += 3) items.push({ type: 'guse', bullets: bullets.slice(i, i + 3) })
  examples.forEach((e, i) => {
    const rows = unpack(e.rows)
    items.push({ type: 'gex', n: i + 1, of: examples.length, rows, tr: weldIf(lang, e[lang] || e.en), chips: chips(rows) })
  })
  if (L.careful) items.push({ type: 'gcareful', text: tr(L.careful) })
  if (L.compare) {
    const c = L.compare
    items.push({ type: 'gcompare', p: c.p, meaning: tr(c.meaning), note: tr(c), rows: c.ex ? unpack(c.ex.rows) : null, tr: c.ex ? tr(c.ex) : '' })
  }
  for (const tw of L.twists || []) {
    const right = tr(tw.choices[0])
    const choices = shuffled(tw.choices.map(tr), `${L.p}${tr(tw.notion)}`)
    items.push({
      type: 'q', twist: true,
      q: {
        kind: 'twist', ask: tr(tw.ask), notion: tr(tw.notion),
        stem: { rows: unpack(tw.rows), script: 'furigana', lit: true },
        choices: choices.map(text => ({ text, fam: 'latin' })), right: choices.indexOf(right),
        explain: { head: '', sense: tr(tw.tr), why: tr(tw.why) },
      },
    })
  }
  if (L.scene) {
    const sc = L.scene
    items.push({ type: 'gscene', place: sc.place, them: tr(sc.them), lines: sc.lines.map(l => ({ who: l.who, rows: unpack(l.rows), tr: weldIf(lang, l[lang] || l.en) })), note: tr(sc.note) })
  }
  for (const q of pl.quizzes.filter(x => x.kind === 'scene' || x.kind === 'tour')) items.push({ type: 'q', q })
  items.push({ type: 'grecap', p: L.p, meaning, form, rows: examples[0] ? unpack(examples[0].rows) : null, tr: examples[0] ? weldIf(lang, examples[0][lang] || examples[0].en) : '' })
  return items
}

// The quiz's kinds, by where they come from: each item asked once.
const QUIZ_KINDS = {
  sentence: ['reading', 'meaning', 'grammar', 'orthography'],
  word: ['meaning'],
  kanji: ['kanjiVocab', 'inWord', 'kanjiMeaning'],
}
/** The quiz's questions: the studio's own, four answers each, from the
 *  level's sentences, words and kanji, one per item, the kinds dealt in turn. */
function quizDeal(banks, level, lang, opts, part, n, ids) {
  const data = { sentence: banks[`${level}.json`], word: banks[`words-${level}.json`], kanji: banks[`kanji-${level}.json`] }
  const pool = []
  const take = (src, id) => {
    const pl = sourcePlan(src, data[src], id, opts, {})
    // A kanji asked in a word: a word of the video's level or easier, never 水準 in an N5 quiz.
    const easy = src === 'kanji' ? new Set((data.kanji.kanji[id]?.words || []).filter(w => levelNo(w.lv) >= levelNo(level)).map(w => w.t)) : null
    const fair = q => !easy || [...(q.stem?.specimen || '')].length < 2 || easy.has(q.stem.specimen)
    const qs = (pl?.quizzes || []).filter(q => QUIZ_KINDS[src].includes(q.kind) && q.choices.length === 4 && (q.stem?.rows || q.stem?.specimen) && fair(q))
    if (qs.length) pool.push(...shuffled(qs, id).slice(0, 1).map(q => ({ ...q, from: `${src}:${id}` })))
  }
  if (ids) {
    for (const id of ids) { const [src, key] = id.split(':'); take(src, key) }
    return pool
  }
  // Each part deals from its own slice of every list, so two parts never share an item.
  const share = { sentence: 0.5, word: 0.3, kanji: 0.25 }
  const lists = {
    sentence: data.sentence.sentences.map(x => x.id),
    word: itemsOf('word', data.word, lang).map(x => x.id),
    kanji: Object.keys(data.kanji.kanji),
  }
  for (const src of Object.keys(lists)) {
    const k = Math.ceil(n * share[src])
    for (const id of shuffled(lists[src], `quiz${level}${src}`).slice((part - 1) * k, part * k)) take(src, id)
  }
  const byKind = {}
  for (const q of shuffled(pool, `quiz${level}${part}`)) (byKind[q.kind] ||= []).push(q)
  const order = []
  const kinds = Object.keys(byKind).sort()
  const total = Math.min(n, pool.length)
  for (let i = 0; order.length < total; i++) { const l = byKind[kinds[i % kinds.length]]; if (l.length) order.push(l.shift()) }
  return order
}

// ── When everything happens ───────────────────────────────────────
const GAP = 0.7 // between a line said and the next
/** The time to read a line on the screen. */
export const READ = s => Math.max(2.5, 1 + [...String(s || '')].length * 0.06)
/** A line's length where it was not measured: ~0.14s a kana. */
const guess = text => 0.35 + [...text].length * 0.14
/** The key a measured line is filed under (long_video_audio.py writes the same). */
export const cueKey = c => `${c.who}|${c.slow ? 'slow' : ''}|${c.text}`
/** What a question's sentence says once it is answered: its blank filled with the right answer. */
export function answered(q) {
  const right = q.choices[q.right]
  if (q.stem?.cue) return right?.rows ? joined(right.rows) : null
  if (q.stem?.rows) {
    const s = joined(q.stem.rows)
    if (!/[＿_]/.test(s)) return s
    const fill = right?.rows ? joined(right.rows) : right?.fam === 'jp' || /[ぁ-んァ-ン一-龯]/.test(right?.text || '') ? right.text : null
    return fill ? s.replace(/[＿_]+/, fill).replace(/[＿_]/g, '') : null
  }
  if (q.stem?.specimen) {
    // A word asked by its meaning, or a kanji: its word is what is said.
    const head = q.explain?.head || ''
    const jp = head.split(/[\s\u3000]+/).find(x => /[ぁ-んァ-ン]/.test(x) && !hasKanji(x))
    return jp || (hasKanji(q.stem.specimen) ? null : q.stem.specimen)
  }
  if (right?.fam === 'jp' || right?.rows) return right.rows ? joined(right.rows) : right.text
  return null
}

/** The video, timed. `dur(cue)` is how long a line takes to say
 *  (long_video_audio.py measures it), else a guess. Returns { seconds,
 *  segs, cues (what is said, by whom, when), sfx (the app's sounds),
 *  chapters, of (the stations on the line) }. */
export function timeline(plan, dur = null) {
  const segs = []
  const cues = []
  const sfx = []
  const chapters = []
  const S = SAY[plan.lang] || SAY.en
  let at = 0
  const seg = (type, length, data, marks = {}, n = 0) => { segs.push({ type, start: +at.toFixed(3), dur: +length.toFixed(3), data, marks, n }); at += length }
  const say = (start, text, who = 'reader', slow = false) => {
    const c = { at: +start.toFixed(3), text, who, ...(slow ? { slow } : {}) }
    cues.push(c)
    return dur?.(c) ?? guess(text) * (slow ? 1.2 : 1)
  }
  const fx = (t, key, gain) => sfx.push({ at: +t.toFixed(3), key, ...(gain != null ? { gain } : {}) })
  const of = plan.items.length
  const short = plan.format === 'short'
  chapters.push({ at: 0, title: S.chapters.intro })
  fx(0.3, 'board-flap')
  seg('intro', short ? 2.5 : 5.5, {})
  plan.items.forEach((it, i) => {
    const start = at
    const n = i + 1
    const drill = plan.kind === 'vocab' || plan.kind === 'kanji'
    if (drill && i % 5 === 0) {
      const names = plan.items.slice(i, i + 5).map(x => x.t || x.c).join(', ')
      chapters.push({ at: start, title: `${n}–${Math.min(of, i + 5)} · ${names}` })
    }
    if (plan.kind === 'quiz' && i % 5 === 0) chapters.push({ at: start, title: `${S.quizHead} ${n}${n < of ? `–${Math.min(of, i + 5)}` : ''}` })
    if (plan.kind === 'grammar') {
      const asked = it.type === 'q' && !it.twist ? plan.items.slice(0, i + 1).filter(x => x.type === 'q' && !x.twist).length : 0
      chapters.push({ at: start, title: asked ? `${S.quizHead} ${asked}` : grammarChapter(it, S) })
    }
    fx(start + 0.1, 'card-transition', 0.8)
    if (plan.kind === 'vocab') {
      // Three seconds alone (two in a short), the reading said twice, the meaning, a sentence.
      const think = short ? 2 : 3
      let u = think + 0.2
      fx(start + think, 'card-flip', 0.6)
      u += say(start + u, it.r) + GAP
      u += say(start + u, it.r) + 0.4
      const marks = { think, meaning: u }
      u += 1.6
      if (it.ex) {
        marks.ex = u
        u += 0.5
        u += say(start + u, it.ex.jp) + 2.6
      } else u += short ? 1.2 : 3.0
      seg('vocab', u, it, marks, n)
    } else if (plan.kind === 'kanji') {
      // The strokes in their order, the meaning, the readings, two words.
      const per = short ? 0.35 : 0.5
      const strokeAt = 0.5
      let u = strokeAt + it.strokes.d.length * per + 0.5
      const marks = { strokeAt, per, meaning: u }
      fx(start + u, 'card-flip', 0.6)
      u += 1.2
      marks.on = u
      for (const r of it.on) u += say(start + u, r) + GAP
      if (!it.on.length) u += 0.6
      marks.kun = u
      for (const [stem, oku] of it.kun) u += say(start + u, stem + oku) + GAP
      if (!it.kun.length) u += 0.6
      marks.words = []
      for (const w of it.words) { marks.words.push(u); u += 0.3 + say(start + u + 0.3, w.r) + 1.4 }
      seg('kanji', u + (short ? 0.3 : 0.8), it, marks, n)
    } else if (it.type === 'q') {
      const q = it.q
      const show = 1.2 + Math.min(3, READ(q.ask) * 0.3)
      const count = 5
      for (let k = 0; k < count; k++) fx(start + show + k, 'click', 0.35)
      const reveal = show + count
      fx(start + reveal, 'correct')
      const answer = reveal + 1.4
      let u = answer + 0.4
      const line = answered(q)
      if (line) u += say(start + u, line) + GAP
      const e = q.explain || {}
      u = Math.max(u + 0.8, answer + READ(`${e.sense || ''} ${e.why || ''}`) * 0.8 + 1)
      seg('q', u, it, { show, count, reveal, answer }, n)
      if (plan.kind === 'quiz' && !short && (n % 10 === 0 || n === of)) {
        chapters.push({ at, title: n === of ? S.chapters.final : S.chapters.score })
        fx(at + 0.2, 'board-flap')
        seg('score', n === of ? 6 : 4.5, { n, of }, {}, n)
      }
    } else if (it.type === 'gex') {
      // Said at its pace, then slower, then cut word by word, each word said.
      let u = 0.8
      u += say(start + u, joined(it.rows)) + GAP
      if (!short) u += say(start + u, joined(it.rows), 'reader', true) + GAP
      const chipAt = []
      for (const c of it.chips) {
        chipAt.push(u)
        u += c.voice ? Math.max(1.0, say(start + u + 0.15, c.voice) + 0.45) : 0.8
      }
      seg('gex', u + (short ? READ(it.tr) * 0.5 : 2.2), it, { chipAt }, n)
    } else if (it.type === 'gcompare' || it.type === 'grecap') {
      const lead = it.type === 'grecap' ? 2.2 : READ(`${it.meaning} ${it.note}`) * 0.7 + 1
      let u = lead + 0.5
      if (it.rows) u += say(start + u, joined(it.rows)) + GAP
      seg(it.type, Math.max(u + READ(it.tr) * 0.6, 6), it, { lead }, n)
    } else if (it.type === 'guse') {
      // A bullet at a time, the Japanese in it said.
      const at2 = []
      let u = 0.8
      for (const b of it.bullets) {
        at2.push(u)
        let v = 0.4
        for (const jp of b.match(/[ぁ-んァ-ン一-龯々ー〜]{2,}/g) || []) v += say(start + u + v, jp.replace(/〜/g, '')) + 0.4
        u += Math.max(READ(b), v) + 0.6
      }
      seg('guse', u + 0.8, it, { at: at2 }, n)
    } else if (it.type === 'gscene') {
      let u = 1.4
      const lines = []
      for (const l of it.lines) { lines.push(u); u += say(start + u, joined(l.rows), l.who === 'me' ? 'me' : 'them') + 0.9 + READ(l.tr) * 0.25 }
      const note = u
      seg('gscene', u + READ(it.note) * 0.8 + 0.6, it, { lines, note }, n)
    } else {
      const body = it.rule || it.text || it.meaning || ''
      seg(it.type, short ? 4 : Math.max(it.type === 'gtitle' ? 6 : 4, READ(body) + 1.5), it, {}, n)
    }
  })
  chapters.push({ at, title: S.chapters.outro })
  fx(at + 0.3, 'platform-chime')
  seg('outro', short ? 4 : 8, {})
  return { seconds: +at.toFixed(3), segs, cues, sfx, chapters, kind: plan.kind, of }
}

function grammarChapter(it, S) {
  switch (it.type) {
    case 'gtitle': return it.p
    case 'grule': return S.rule
    case 'guse': return S.use
    case 'gex': return `${S.example} ${it.n}`
    case 'gcareful': return S.careful
    case 'gcompare': return `${S.compare}: ${it.p}`
    case 'gscene': return S.scene
    case 'grecap': return S.recap
    default: return it.twist ? `${S.twist}: ${it.q.notion}` : S.quizHead
  }
}

const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
/** YouTube's chapters: "m:ss Title" a line, the first at 0:00, none shorter than ten seconds. */
export function chapterText(tl) {
  const out = []
  for (const c of tl.chapters) {
    const last = out[out.length - 1]
    // Too close to the one before: the later title takes the earlier's place.
    if (last && c.at - last.at < 10) last.title = c.title
    else out.push({ ...c })
  }
  return out.map(c => `${mmss(c.at)} ${c.title}`).join('\n')
}

// ── The video's page on YouTube ───────────────────────────────────
// Its title is what a learner types (the level, the kind, how many), its
// description says what the video does and how to use it, its chapters,
// what the app is (only what it does today: the deck's figures are the
// bank's own) and every credit its sound owes: the voices' VOICEVOX
// Nemo, and 波音リツ when a lone syllable is the kana deck's recording.
const LONE = /^[ぁ-んァ-ン][ゃゅょャュョ]?$/
const PAGE = {
  en: {
    title: {
      vocab: (lv, n, part, theme) => theme ? `Japanese vocabulary: ${theme} · ${n} words to hear and repeat` : `${n} JLPT ${lv} Japanese words · Hear them, repeat them, read them${part ? ` (part ${part})` : ''}`,
      kanji: (lv, n, part) => `${n} JLPT ${lv} kanji · Stroke order, readings and words${part ? ` (part ${part})` : ''}`,
      quiz: (lv, n, part) => `JLPT ${lv} Japanese quiz · ${n} questions, 5 seconds each${part ? ` (part ${part})` : ''}`,
      grammar: (lv, p, meaning) => `${p} (“${meaning}”) explained · JLPT ${lv} Japanese grammar`,
    },
    lead: {
      vocab: (lv, n, theme) => `${n} ${theme ? `words about ${theme.toLowerCase()}` : `words from the JLPT ${lv} list`}, one at a time. Read each one before it is revealed, then hear it said aloud.`,
      kanji: (lv, n) => `${n} kanji from the JLPT ${lv} list, each drawn stroke by stroke, then its meaning, its readings and two words that use it, all said aloud.`,
      quiz: (lv, n) => `${n} questions from the JLPT ${lv} level: readings, meanings, kanji and grammar in real sentences. Five seconds each, then the answer and why.`,
      grammar: (lv, p, meaning) => `Everything about ${p}, one of the JLPT ${lv} grammar points: what it means (“${meaning}”), how to build it, and how it sounds in real sentences.`,
    },
    howHead: 'How it works', useHead: 'Get the most out of it', chapHead: 'Chapters', appHead: 'Keep going with Tsuji', creditHead: 'Credits',
    how: {
      vocab: ex => ['The word appears alone: read it before the three lamps go out.', 'Its reading is said twice: say it with the voice.', ex.all ? 'Then its meaning, and a sentence it is used in, said aloud.' : ex.some ? `Then its meaning, and for ${ex.some} of them a sentence it is used in, said aloud.` : 'Then its meaning.'],
      kanji: ['Watch the strokes in their order: try to guess the kanji before its meaning appears.', 'Its ON and KUN readings are said one by one.', 'Two everyday words show it at work.'],
      quiz: ['Read the question and pick your answer before the ring empties.', 'The right answer is shown with the reason, and the sentence is said.', 'Keep count: there is a score check every ten questions.'],
    },
    grammarParts: n => [`What it does and how to build it`, `How it is used`, `${n.ex} example sentences, each said twice and cut word by word`, n.careful && 'The mistake to avoid', n.compare && `Not to be confused with ${n.compare}`, n.twists && `${n.twists} twist${n.twists > 1 ? 's' : ''}: test your understanding`, n.scene && 'A short conversation', n.quiz && `${n.quiz} question${n.quiz > 1 ? 's' : ''} to check yourself`, 'A recap'].filter(Boolean),
    use: { vocab: 'Say every word out loud before you hear it. Come back in two or three days: what you still know then is what you have learned.', kanji: 'Trace each kanji with your finger as it is drawn. Come back in two or three days and pause on each one before it is revealed.', quiz: 'Pause if you need more time. Tell us your score in the comments!', grammar: 'Pause on each example and say it aloud before the voice does. Then try the questions without looking back.' },
    app: (f, site) => `Tsuji is a Japanese app built on spaced repetition: ${f.words} words, ${f.kanji} kanji and ${f.points} grammar points, from N5 to N1, each brought back just before you would forget it. The kana line is free for good, with no ads and no trackers.\n${site}`,
    credits: kana => [`Voices: VOICEVOX Nemo.`, kana && 'Kana voice: 波音リツ (Canon).', 'Music: made for Tsuji.'].filter(Boolean).join(' '),
    tags: (lv, kind) => ['learn Japanese', 'Japanese', `JLPT ${lv}`, 'JLPT', `${lv} ${({ vocab: 'vocabulary', kanji: 'kanji', quiz: 'quiz', grammar: 'grammar' })[kind]}`, ({ vocab: 'Japanese vocabulary', kanji: 'kanji stroke order', quiz: 'Japanese quiz', grammar: 'Japanese grammar' })[kind], 'Japanese for beginners', 'nihongo', '日本語'],
    hashtags: lv => lv ? `#LearnJapanese #Japanese #JLPT #JLPT${lv} #日本語` : '#LearnJapanese #Japanese #JapaneseVocabulary #日本語',
  },
  fr: {
    title: {
      vocab: (lv, n, part, theme) => theme ? `Vocabulaire japonais : ${theme} · ${n} mots à écouter et répéter` : `${n} mots de japonais du JLPT ${lv} · Écoute, répète, lis${part ? ` (partie ${part})` : ''}`,
      kanji: (lv, n, part) => `${n} kanji du JLPT ${lv} · Ordre des traits, lectures et mots${part ? ` (partie ${part})` : ''}`,
      quiz: (lv, n, part) => `Quiz de japonais JLPT ${lv} · ${n} questions, 5 secondes chacune${part ? ` (partie ${part})` : ''}`,
      grammar: (lv, p, meaning) => `${p} (« ${meaning} ») expliqué · Grammaire japonaise JLPT ${lv}`,
    },
    lead: {
      vocab: (lv, n, theme) => `${n} ${theme ? `mots sur le thème ${theme.toLowerCase()}` : `mots de la liste du JLPT ${lv}`}, un par un. Lis chacun avant qu’il soit révélé, puis écoute-le prononcé.`,
      kanji: (lv, n) => `${n} kanji de la liste du JLPT ${lv}, chacun tracé trait par trait, puis son sens, ses lectures et deux mots qui l’emploient, le tout dit à voix haute.`,
      quiz: (lv, n) => `${n} questions du niveau JLPT ${lv} : lectures, sens, kanji et grammaire dans de vraies phrases. Cinq secondes chacune, puis la réponse et pourquoi.`,
      grammar: (lv, p, meaning) => `Tout sur ${p}, un point de grammaire du JLPT ${lv} : ce qu’il veut dire (« ${meaning} »), comment le former, et comment il sonne dans de vraies phrases.`,
    },
    howHead: 'Comment ça marche', useHead: 'Pour en tirer le meilleur', chapHead: 'Chapitres', appHead: 'Continue avec Tsuji', creditHead: 'Crédits',
    how: {
      vocab: ex => ['Le mot apparaît seul : lis-le avant que les trois lampes s’éteignent.', 'Sa lecture est dite deux fois : répète-la avec la voix.', ex.all ? 'Puis son sens, et une phrase qui l’emploie, dite à voix haute.' : ex.some ? `Puis son sens et, pour ${ex.some} d’entre eux, une phrase qui l’emploie, dite à voix haute.` : 'Puis son sens.'],
      kanji: ['Regarde les traits dans leur ordre : devine le kanji avant que son sens apparaisse.', 'Ses lectures ON et KUN sont dites une à une.', 'Deux mots du quotidien le montrent à l’œuvre.'],
      quiz: ['Lis la question et choisis ta réponse avant que l’anneau se vide.', 'La bonne réponse s’affiche avec la raison, et la phrase est dite.', 'Compte tes points : un point d’étape toutes les dix questions.'],
    },
    grammarParts: n => [`Ce qu’il fait et comment le former`, `Comment l’employer`, `${n.ex} phrases d’exemple, dites deux fois et découpées mot à mot`, n.careful && 'L’erreur à éviter', n.compare && `À ne pas confondre avec ${n.compare}`, n.twists && `${n.twists} variante${n.twists > 1 ? 's' : ''} pour tester ta compréhension`, n.scene && 'Une courte conversation', n.quiz && `${n.quiz} question${n.quiz > 1 ? 's' : ''} pour vérifier`, 'Un récap'].filter(Boolean),
    use: { vocab: 'Dis chaque mot à voix haute avant de l’entendre. Reviens dans deux ou trois jours : ce que tu sais encore, tu l’as appris.', kanji: 'Trace chaque kanji du doigt pendant qu’il se dessine. Reviens dans deux ou trois jours et mets pause avant chaque révélation.', quiz: 'Mets pause s’il te faut plus de temps. Donne ton score en commentaire !', grammar: 'Mets pause sur chaque exemple et dis-le avant la voix. Puis réponds aux questions sans revenir en arrière.' },
    app: (f, site) => `Tsuji est une appli de japonais fondée sur la répétition espacée : ${f.words} mots, ${f.kanji} kanji et ${f.points} points de grammaire, du N5 au N1, chacun ramené juste avant que tu l’oublies. La ligne des kana est gratuite pour de bon, sans pub et sans traqueur.\n${site}`,
    credits: kana => [`Voix : VOICEVOX Nemo.`, kana && 'Voix des kana : 波音リツ (Canon).', 'Musique : faite pour Tsuji.'].filter(Boolean).join(' '),
    tags: (lv, kind) => ['apprendre le japonais', 'japonais', `JLPT ${lv}`, 'JLPT', `${({ vocab: 'vocabulaire', kanji: 'kanji', quiz: 'quiz', grammar: 'grammaire' })[kind]} ${lv}`, ({ vocab: 'vocabulaire japonais', kanji: 'ordre des traits kanji', quiz: 'quiz japonais', grammar: 'grammaire japonaise' })[kind], 'japonais débutant', 'nihongo', '日本語'],
    hashtags: lv => lv ? `#ApprendreLeJaponais #Japonais #JLPT #JLPT${lv} #日本語` : '#ApprendreLeJaponais #Japonais #VocabulaireJaponais #日本語',
  },
}
export const LONG_PAGE = PAGE

// A short's page: a title to stop the scroll, a line, the app, the credits.
const SHORT_PAGE = {
  en: {
    title: {
      vocab: (lv, n, theme) => theme ? `${n} Japanese words: ${theme} #shorts` : `${n} JLPT ${lv} Japanese words in under a minute #shorts`,
      kanji: (lv, n) => `${n} JLPT ${lv} kanji in under a minute #shorts`,
      quiz: (lv, n) => `JLPT ${lv} quiz: ${n} questions, 5 seconds each #shorts`,
      grammar: (lv, p, meaning) => `${p} (“${meaning}”) in under a minute · JLPT ${lv} #shorts`,
    },
    lead: { vocab: 'Read each word before it is revealed, then say it with the voice.', kanji: 'Watch the strokes, then read it.', quiz: 'Five seconds a question. How many did you get?', grammar: 'One grammar point: its form, two examples, one question.' },
    app: (f, site) => `Keep going on Tsuji: ${f.words} words, ${f.kanji} kanji and ${f.points} grammar points with spaced repetition. No ads, no trackers.\n${site}`,
    hashtags: lv => `#Shorts #LearnJapanese #Japanese${lv ? ` #JLPT${lv}` : ''} #日本語`,
  },
  fr: {
    title: {
      vocab: (lv, n, theme) => theme ? `${n} mots de japonais : ${theme} #shorts` : `${n} mots de japonais du JLPT ${lv} en moins d’une minute #shorts`,
      kanji: (lv, n) => `${n} kanji du JLPT ${lv} en moins d’une minute #shorts`,
      quiz: (lv, n) => `Quiz JLPT ${lv} : ${n} questions, 5 secondes chacune #shorts`,
      grammar: (lv, p, meaning) => `${p} (« ${meaning} ») en moins d’une minute · JLPT ${lv} #shorts`,
    },
    lead: { vocab: 'Lis chaque mot avant qu’il soit révélé, puis répète-le avec la voix.', kanji: 'Regarde les traits, puis lis-le.', quiz: 'Cinq secondes par question. Combien en as-tu ?', grammar: 'Un point de grammaire : sa forme, deux exemples, une question.' },
    app: (f, site) => `Continue sur Tsuji : ${f.words} mots, ${f.kanji} kanji et ${f.points} points de grammaire en répétition espacée. Sans pub, sans traqueur.\n${site}`,
    hashtags: lv => `#Shorts #ApprendreLeJaponais #Japonais${lv ? ` #JLPT${lv}` : ''} #日本語`,
  },
}

/** The video's title, description and tags. `figures` is the bank's
 *  index.json figures: the app's deck, as the description counts it. */
export function describe(plan, tl, site, figures = null) {
  if (plan.format === 'short') return describeShort(plan, tl, site, figures)
  const P = PAGE[plan.lang] || PAGE.en
  const n = plan.items.length
  const part = plan.part && !plan.ids && !plan.theme ? plan.part : 0
  const lv = plan.level
  const first = plan.items[0] || {}
  const theme = plan.theme
  const title = plan.kind === 'grammar' ? P.title.grammar(lv, plan.point, first.meaning) : P.title[plan.kind](lv, n, part, theme)
  const lead = plan.kind === 'grammar' ? P.lead.grammar(lv, plan.point, first.meaning) : P.lead[plan.kind](lv, n, theme)
  let how
  if (plan.kind === 'grammar') {
    const count = type => plan.items.filter(x => x.type === type).length
    how = P.grammarParts({
      ex: count('gex'), careful: count('gcareful'), compare: plan.items.find(x => x.type === 'gcompare')?.p,
      twists: plan.items.filter(x => x.twist).length, scene: count('gscene'), quiz: plan.items.filter(x => x.type === 'q' && !x.twist).length,
    })
  } else if (plan.kind === 'vocab') {
    const some = plan.items.filter(x => x.ex).length
    how = P.how.vocab({ all: some === n, some })
  } else how = P.how[plan.kind]
  const kana = tl.cues.some(c => LONE.test(c.text))
  const fmt = x => Number(x).toLocaleString(plan.lang === 'fr' ? 'fr-FR' : 'en-US')
  const deck = figures ? { words: fmt(figures.words), kanji: fmt(figures.kanji), points: fmt(figures.points) } : null
  const body = [
    lead, '',
    `▸ ${P.howHead}`, ...how.map(x => `• ${x}`), '',
    `▸ ${P.useHead}`, P.use[plan.kind], '',
    `▸ ${P.chapHead}`, chapterText(tl), '',
    ...(deck ? [`▸ ${P.appHead}`, P.app(deck, site), ''] : [site, '']),
    `▸ ${P.creditHead}`, P.credits(kana), '',
    theme ? P.hashtags(null) : P.hashtags(lv),
  ]
  // A theme's words span the levels: no level is named for it.
  const tags = [...new Set(P.tags(lv, plan.kind).filter(t => !theme || !/JLPT|N\d/.test(t)))].join(', ')
  return { title, description: body.join('\n'), tags }
}

function describeShort(plan, tl, site, figures) {
  const P = SHORT_PAGE[plan.lang] || SHORT_PAGE.en
  const lv = plan.level
  const n = plan.items.length
  const meaning = plan.items[0]?.meaning
  const title = plan.kind === 'grammar' ? P.title.grammar(lv, plan.point, meaning) : P.title[plan.kind](lv, n, plan.theme)
  const fmt = x => Number(x).toLocaleString(plan.lang === 'fr' ? 'fr-FR' : 'en-US')
  const kana = tl.cues.some(c => LONE.test(c.text))
  const body = [
    P.lead[plan.kind], '',
    figures ? P.app({ words: fmt(figures.words), kanji: fmt(figures.kanji), points: fmt(figures.points) }, site) : site, '',
    (PAGE[plan.lang] || PAGE.en).credits(kana), '',
    P.hashtags(plan.theme ? null : lv),
  ]
  const tags = [...new Set((PAGE[plan.lang] || PAGE.en).tags(lv, plan.kind).filter(t => !plan.theme || !/JLPT|N\d/.test(t)))].concat('shorts').join(', ')
  return { title, description: body.join('\n'), tags }
}

// ── Drawing ───────────────────────────────────────────────────────
// The look is plan 218's, the owner's two picks from the canvas "Tsuji —
// video look, new directions":
//
// - The long video is the screen over a train's door (C, 車内案内): a
//   sumi band across the top saying what comes next (the next word, the
//   section, the question asked) beside the station's number, the line's
//   pigment under it as the way along (a question's five seconds while
//   they run), and the washi screen below. A drill's word is set as large
//   as its column takes, the route of words down the side: the stops
//   passed in grey, this one ringed, the next ahead on the line.
// - The short is the station's name plate (A, 駅名標) on the sumi wall:
//   the word is the station's name, the plate's band in the line's
//   pigment carries the word before and the word after (a question's ask,
//   an example's number), the station's number in its corner.
const W = WIDE.w
const H = WIDE.h
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
const BAND = 124 // the door screen's sumi band
const STRIPE = 12 // the line's pigment under it
// The pass's metal on a sumi band, in either ground.
const SUMI = palette('sumi')
const PAPER = palette('paper')

// A stroke's length, for drawing it on: the browser's own measure.
const lengths = new Map()
let probe = null
function strokeLength(d) {
  if (lengths.has(d)) return lengths.get(d)
  let len = 0
  try {
    if (!probe && typeof document !== 'undefined') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.style.cssText = 'position:absolute;width:0;height:0'
      probe = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      svg.append(probe)
      document.body.append(svg)
    }
    if (probe) { probe.setAttribute('d', d); len = probe.getTotalLength() }
  } catch { len = 0 }
  lengths.set(d, len)
  return len
}

/** Where a frame stands: its segment, the second into it, and the two
 *  helpers every part is drawn with (`k`, a part's share of the way in,
 *  kept in the frame's key while it moves; `fade`, a part drawn at it). */
function begin(ctx, plan, tl, t, w, h, ground) {
  const p = palette(ground)
  const S = SAY[plan.lang] || SAY.en
  const line = p.line[plan.line] || p.gold
  let i = tl.segs.findIndex(s => t < s.start + s.dur)
  if (i < 0) i = tl.segs.length - 1
  const sg = tl.segs[i]
  const u = t - sg.start
  const state = [i]
  const k = (from, len = 0.35) => {
    const raw = ease((u - from) / len)
    const v = raw <= 0 ? 0 : raw >= 1 ? 1 : Math.round(raw * 15) / 15
    state.push(v)
    return v
  }
  const fade = (v, fn) => {
    if (v <= 0) return
    ctx.save()
    ctx.globalAlpha *= v
    ctx.translate(0, (1 - v) * 16)
    fn()
    ctx.restore()
  }
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, w, h)
  return { p, S, line, sg, u, state, k, fade, d: sg.data, m: sg.marks }
}

/** The pieces both formats are drawn from: a card, a sentence, a paragraph, a pill. */
function tools(ctx, p, line) {
  const card = (x, y, w, h, edge = p.surfaceLine, width = 2) => {
    ctx.fillStyle = p.card
    rrect(ctx, x, y, w, h, 24)
    ctx.fill()
    ctx.strokeStyle = edge
    ctx.lineWidth = width
    rrect(ctx, x + width / 2, y + width / 2, w - width, h - width, 24)
    ctx.stroke()
  }
  const sentence = (rows, x, y, { max = 72, min = 36, maxW = 1600, maxLines = 2, script = 'furigana', lit = null, under = -1, align = 'center', ink = p.ink, ruby = p.ink2 } = {}) => {
    const L = layoutSentence(ctx, rows, { max, min, maxW, maxLines, script, rules: false, gap: 0.06, fam: 'jp', weight: 700 })
    if (!L) return 0
    drawSentence(ctx, L, x, y, align, ui => ({ ink, ruby, rule: (lit && ui.row.lit) || (under >= 0 && ui.i === under) ? lit || ink : null, ruleW: 7 }))
    return L.h
  }
  const para = (str, x, y, maxW, sizes, color, align = 'left', weight = 500, maxLines = 4) => {
    if (!str) return 0
    const b = fit(ctx, str, { weight, sizes, maxW, maxLines, balanced: align === 'center', fam: 'latin' })
    b.lines.forEach((l, j) => text(ctx, l, x, y + b.size * (0.8 + j * 1.22), { f: b.f, color, align }))
    return paragraphH(b, 1.22)
  }
  const pill = (str, x, y, size, align = 'left', maxW = 1680) => {
    const f = font(700, size, 'jp')
    const w = Math.min(maxW, measure(ctx, str, f) + size * 1.6)
    const x0 = align === 'center' ? x - w / 2 : x
    ctx.fillStyle = line
    rrect(ctx, x0, y, w, size * 1.9, size * 0.95)
    ctx.fill()
    const b = fit(ctx, str, { weight: 700, sizes: [size, size * 0.85, size * 0.72], maxW: w - size, maxLines: 1, fam: 'jp', balanced: false })
    text(ctx, b.lines[0], x0 + w / 2, y + size * 1.3, { f: b.f, color: p.onLine, align: 'center' })
  }
  return { card, sentence, para, pill }
}

// ── The parts of a station ──
/** The station's number, as a plate prints it: a square ringed in the
 *  line's pigment, the level (or Q) over the number. */
function numBox(ctx, x, y, s, line, label, n, face, ink) {
  const bw = s * 0.1
  const r = s * 0.16
  ctx.fillStyle = face
  rrect(ctx, x, y, s, s, r)
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = bw
  rrect(ctx, x + bw / 2, y + bw / 2, s - bw, s - bw, r - bw / 2)
  ctx.stroke()
  const num = String(n).padStart(2, '0')
  const nf = font(700, s * (num.length > 2 ? 0.3 : 0.38), 'latin')
  if (label) {
    text(ctx, label, x + s / 2, y + s * 0.4, { f: font(700, s * 0.2, 'latin'), color: ink, align: 'center' })
    text(ctx, num, x + s / 2, y + s * 0.78, { f: nf, color: ink, align: 'center' })
  } else text(ctx, num, x + s / 2, y + s * 0.64, { f: nf, color: ink, align: 'center' })
}

/** A plate's pointer to the station before (-1) or after (1). */
function pointer(ctx, x, cy, s, dir, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = s * 0.24
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x - dir * s * 0.25, cy - s * 0.42)
  ctx.lineTo(x + dir * s * 0.25, cy)
  ctx.lineTo(x - dir * s * 0.25, cy + s * 0.42)
  ctx.stroke()
  ctx.restore()
}

/** Text as large as its box takes, from `size` down: a word, a glyph. */
function sized(ctx, str, weight, size, fam, maxW) {
  const f = font(weight, size, fam)
  return Math.min(size, size * maxW / Math.max(1, measure(ctx, str, f)))
}
const famOf = str => (hasKanji(str) ? 'serif' : 'jp')

/** A gloss and its note: "to appear, to leave (to go/come out by itself)"
 *  is a meaning and, under it, what the parentheses add. */
function glossParts(g) {
  const m = /^(.+?)\s*(\([^()]+\))$/.exec(g || '')
  return m ? [m[1], m[2]] : [g || '', '']
}

/** The circle of five seconds that empties, its figure in it. */
function countdown(ctx, cx, cy, r, track, line, ink, share, left) {
  ctx.lineWidth = r * 0.2
  ctx.strokeStyle = track
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 7)
  ctx.stroke()
  ctx.strokeStyle = line
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share)
  ctx.stroke()
  ctx.lineCap = 'butt'
  text(ctx, String(Math.ceil(left)), cx, cy + r * 0.34, { f: font(700, r * 0.95, 'latin'), color: ink, align: 'center' })
}

/** A kanji's strokes drawn on in their order, numbered, in a box of side `s` at (x, y). */
function strokesIn(ctx, d, m, u, k, x, y, s, ink, line) {
  const kz = s / 109
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(kz, kz)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  d.strokes.d.forEach((path, j) => {
    const from = m.strokeAt + j * m.per
    const v = k(from, m.per * 0.85)
    const shape = new Path2D(path)
    ctx.lineWidth = 4.5
    ctx.strokeStyle = alpha(ink, 0.09)
    ctx.stroke(shape)
    if (v <= 0) return
    const len = strokeLength(path)
    ctx.strokeStyle = u < from + m.per ? line : ink
    if (len && v < 1) { ctx.setLineDash([len, len + 10]); ctx.lineDashOffset = len * (1 - v) }
    ctx.globalAlpha = len ? 1 : v
    ctx.stroke(shape)
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    const [nx, ny] = d.strokes.n[j] || [0, 0]
    ctx.fillStyle = line
    ctx.font = font(700, 6.5, 'latin')
    ctx.fillText(String(j + 1), nx, ny)
  })
  ctx.restore()
}

/** A practice sheet's guides through a box: the cross, dashed. */
function guides(ctx, x, y, s, ink) {
  ctx.save()
  ctx.setLineDash([10, 12])
  ctx.strokeStyle = alpha(ink, 0.1)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + s / 2, y + 20); ctx.lineTo(x + s / 2, y + s - 20); ctx.moveTo(x + 20, y + s / 2); ctx.lineTo(x + s - 20, y + s / 2)
  ctx.stroke()
  ctx.restore()
}

// ── The long video: the door screen ──
/** The band across the top, and the stripe under it. On the left what is
 *  next (a drill's word), the section, or the question; the station's
 *  number; on the right the video's name and the mark. */
function door(ctx, p, line, plan, sg, S, { next = false, head = null, fill = 1 }) {
  ctx.fillStyle = p.panel
  ctx.fillRect(0, 0, W, BAND)
  ctx.fillStyle = alpha(line, 0.28)
  ctx.fillRect(0, BAND, W, STRIPE)
  ctx.fillStyle = line
  ctx.fillRect(0, BAND, W * Math.max(0, Math.min(1, fill)), STRIPE)
  const nf = font(700, 22, 'latin')
  const tw = measure(ctx, 'TSUJI', nf, 0.3)
  text(ctx, 'TSUJI', W - 56 - tw, 78, { f: nf, color: p.onPanelSoft, tr: 0.3 })
  const mx = W - 56 - tw - 18 - 58
  mark(ctx, mx, 32, 58, p.onPanel, SUMI.gold)
  let x = 56
  if (next) {
    const a = text(ctx, S.next, x, 62, { f: font(700, 32, 'latin'), color: p.onPanel })
    const b = text(ctx, 'つぎは', x, 98, { f: font(500, 22, 'jp'), color: p.onPanelSoft })
    x += Math.max(a, b) + 28
  }
  if (sg.n) {
    const label = sg.type === 'q' || sg.type === 'score' ? 'Q' : plan.theme ? '' : plan.level
    numBox(ctx, x, 20, 84, line, label, sg.n, p.bg, p.ink)
    x += 84 + 30
  }
  const room = mx - 48 - x
  if (head) {
    const b = fit(ctx, head, { weight: 700, sizes: [40, 34, 30, 27], maxW: room, maxLines: 2, fam: 'latin', balanced: false })
    const top = BAND / 2 - (b.lines.length * b.size * 1.16) / 2
    b.lines.forEach((l, j) => text(ctx, l, x, top + b.size * (0.86 + j * 1.16), { f: b.f, color: p.onPanel }))
  } else if (plan.title) {
    const b = fit(ctx, plan.title, { weight: 700, sizes: [26, 22], maxW: room, maxLines: 1, fam: 'latin', balanced: false })
    text(ctx, b.lines[0], mx - 40, 78, { f: b.f, color: p.onPanelSoft, align: 'right' })
  }
}

/** The route down the screen's side: the stops passed in grey, this one
 *  ringed, the next ones ahead on the line, five at most. */
function route(ctx, p, line, names, n, x, y0) {
  const of = names.length
  const from = Math.max(0, Math.min(n - 3, of - 5))
  const rows = names.slice(from, from + 5).map((t, j) => ({ t, i: from + j + 1 }))
  const hs = rows.map(r => (r.i === n ? 150 : 104))
  const ys = []
  let y = y0
  for (const h of hs) { ys.push(y + h / 2); y += h }
  const dx = x + 22
  const cur = Math.max(0, rows.findIndex(r => r.i === n))
  ctx.fillStyle = p.surfaceLine
  ctx.fillRect(dx - 3, ys[0], 6, ys[cur] - ys[0])
  ctx.fillStyle = line
  ctx.fillRect(dx - 3, ys[cur], 6, ys[ys.length - 1] - ys[cur])
  const maxW = W - 80 - (x + 74)
  rows.forEach((r, j) => {
    const at = ys[j]
    ctx.beginPath()
    if (r.i < n) {
      ctx.arc(dx, at, 12, 0, 7)
      ctx.fillStyle = p.surfaceLine
      ctx.fill()
    } else {
      ctx.arc(dx, at, r.i === n ? 21 : 13, 0, 7)
      ctx.fillStyle = p.bg
      ctx.fill()
      ctx.lineWidth = r.i === n ? 10 : 5
      ctx.strokeStyle = line
      ctx.stroke()
    }
    const big = r.i === n
    const z = sized(ctx, r.t, big ? 900 : 500, big ? 64 : 44, big ? famOf(r.t) : 'jp', maxW)
    text(ctx, r.t, x + 74, at + z * 0.36, { f: font(big ? 900 : 500, z, big ? famOf(r.t) : 'jp'), color: r.i < n ? p.ink2 : p.ink })
  })
  text(ctx, `${n} / ${of}`, x + 74, y + 34, { f: font(700, 26, 'latin'), color: p.ink2 })
}

const ROUTE_X = 1352 // where the route stands, right of the column's rule
const COL_RULE = 1280

/** The frame at second `t`, and its key: two frames with the same key
 *  are the same picture. A short is drawn standing (drawTall). */
export function drawLong(ctx, plan, tl, t) {
  if (plan.format === 'short') return drawTall(ctx, plan, tl, t)
  const { p, S, line, sg, u, state, k, fade, d, m } = begin(ctx, plan, tl, t, W, H, 'paper')
  const { card, sentence, para, pill } = tools(ctx, p, line)
  // The stripe: the way along the video, or a question's seconds while they run.
  let fill = sg.n ? sg.n / tl.of : 1
  if (sg.type === 'q' && u >= m.show && u < m.reveal) fill = Math.round(Math.max(0, (m.reveal - u) / m.count) * 90) / 90
  const heads = {
    grule: S.rule, guse: S.use, gcareful: S.careful, gcompare: S.compare, grecap: S.recap,
    gex: d && `${S.example} ${d.n} / ${d.of}`, gscene: d && `${S.scene} · ${d.place}`,
    score: d && (d.n === d.of ? S.chapters.final : S.chapters.score),
    q: d?.q?.ask,
  }
  door(ctx, p, line, plan, sg, S, { next: sg.type === 'vocab' || sg.type === 'kanji', head: heads[sg.type] || null, fill })
  switch (sg.type) {
    case 'intro': {
      fade(k(0.2, 0.6), () => mark(ctx, W / 2 - 90, 220, 180, p.ink, p.gold))
      fade(k(0.6, 0.6), () => para(plan.title, W / 2, 500, 1600, [96, 84, 72], p.ink, 'center', 700, 2))
      const count = S.count[plan.kind]
      if (count) fade(k(0.9, 0.6), () => para(count(plan.items.length), W / 2, 640, 1400, [48], p.ink2, 'center', 500, 1))
      fade(k(1.6, 0.6), () => para(S.hook[plan.kind], W / 2, 780, 1500, [52, 44], line, 'center', 700, 1))
      fade(k(2.2, 0.6), () => para(S.how[plan.kind], W / 2, 860, 1500, [40, 36], p.ink2, 'center', 500, 1))
      break
    }
    case 'outro': {
      fade(k(0.2, 0.6), () => mark(ctx, W / 2 - 90, 200, 180, p.ink, p.gold))
      fade(k(0.6, 0.6), () => para(S.outro, W / 2, 460, 1500, [88, 76], p.ink, 'center', 700, 1))
      fade(k(1.0, 0.6), () => para(S.outroSub, W / 2, 590, 1500, [44, 38], p.ink2, 'center', 500, 1))
      if (plan.kind === 'quiz') fade(k(1.3, 0.6), () => para(S.comment, W / 2, 670, 1500, [44, 38], line, 'center', 700, 1))
      fade(k(1.8, 0.6), () => {
        const bw = 760
        A.departButton(ctx, p, W / 2 - bw / 2, 780, bw, 2, S.depart)
      })
      break
    }
    case 'vocab': drawWord(ctx, p, S, line, plan, sg, d, m, u, k, fade, sentence, para, state); break
    case 'kanji': drawKanji(ctx, p, S, line, plan, sg, d, m, u, k, fade, para); break
    case 'gtitle': case 'grecap': {
      const top = sg.type === 'grecap' ? 200 : 330
      fade(k(0.1, 0.5), () => {
        const b = fit(ctx, d.p, { weight: 900, sizes: [180, 150, 120, 96, 80], maxW: 1680, maxLines: 1, fam: 'serif', balanced: false })
        text(ctx, b.lines[0], W / 2, top + b.size * 0.9, { f: b.f, color: p.ink, align: 'center' })
      })
      fade(k(0.6, 0.5), () => para(d.meaning, W / 2, top + 230, 1600, [56, 48, 40], p.ink2, 'center', 500, 2))
      fade(k(1.1, 0.5), () => pill(d.form, W / 2, top + 370, 44, 'center'))
      if (sg.type === 'grecap' && d.rows) fade(k(m.lead, 0.4), () => {
        ctx.fillStyle = p.card
        ctx.fillRect(0, 860, W, H - 860)
        ctx.fillStyle = p.surfaceLine
        ctx.fillRect(0, 860, W, 2)
        const h = sentence(d.rows, W / 2, 884, { max: 60, maxLines: 1, lit: line })
        para(d.tr, W / 2, 894 + h, 1600, [36, 32], p.ink2, 'center', 500, 1)
      })
      break
    }
    case 'grule': {
      fade(k(0.3, 0.4), () => pill(d.form, 120, 200, 48))
      fade(k(0.8, 0.5), () => para(d.rule, 120, 360, 1680, [60, 54, 48, 42, 38], p.ink, 'left', 500, 9))
      break
    }
    case 'gcareful': {
      fade(k(0.5, 0.5), () => para(d.text, 120, 220, 1680, [64, 56, 48, 42, 38], p.ink, 'left', 500, 11))
      break
    }
    case 'guse': {
      let y = 220
      d.bullets.forEach((b, j) => {
        const v = k(m.at[j], 0.4)
        const bk = fit(ctx, b, { weight: 500, sizes: [50, 44, 40, 36], maxW: 1600, maxLines: 3, fam: 'latin', balanced: false })
        const top = y
        fade(v, () => {
          ctx.fillStyle = line
          ctx.beginPath()
          ctx.arc(136, top + bk.size * 0.5, 10, 0, 7)
          ctx.fill()
          bk.lines.forEach((l, li) => text(ctx, l, 180, top + bk.size * (0.8 + li * 1.22), { f: bk.f, color: p.ink }))
        })
        y += paragraphH(bk, 1.22) + 50
      })
      break
    }
    case 'gex': {
      fade(k(0.2, 0.4), () => {
        card(120, 190, 1680, 330)
        const h = sentence(d.rows, W / 2, 225, { max: 84, min: 48, maxW: 1560, maxLines: 1, lit: line })
        para(d.tr, W / 2, 245 + h, 1560, [46, 40, 34], p.ink2, 'center', 500, 2)
      })
      drawChips(ctx, p, line, d.chips, m.chipAt, k, fade, 570)
      break
    }
    case 'gcompare': {
      fade(k(0.3, 0.4), () => { text(ctx, d.p, 120, 300, { f: font(900, 96, 'serif'), color: p.ink }); para(d.meaning, 120, 340, 1680, [44, 38], p.ink2, 'left', 500, 1) })
      fade(k(1.0, 0.4), () => para(d.note, 120, 430, 1680, [44, 38, 34], p.ink, 'left', 500, 3))
      if (d.rows) fade(k(m.lead, 0.4), () => {
        card(120, 660, 1680, 250)
        const h = sentence(d.rows, W / 2, 690, { max: 64, maxW: 1560, maxLines: 1, lit: line })
        para(d.tr, W / 2, 705 + h, 1560, [40, 34], p.ink2, 'center', 500, 1)
      })
      break
    }
    case 'gscene': {
      fade(k(0.3, 0.4), () => para(d.them, 120, 170, 1680, [36, 32], p.ink2, 'left', 500, 1))
      // A bubble a line, as many as fit above the note; the earlier ones go up.
      const lay = d.lines.map(l => layoutSentence(ctx, l.rows, { max: 52, min: 34, maxW: 1100, maxLines: 1, script: 'furigana', rules: false, gap: 0.06, fam: 'jp', weight: 700 }))
      const bh = Math.max(...lay.map(L => L.h)) + 70
      const fitIn = Math.max(1, Math.floor((900 - 230) / (bh + 14)))
      const said = m.lines.filter(x => u >= x).length
      const from = Math.max(0, said - fitIn)
      state.push(`s${from}`)
      d.lines.slice(from, from + fitIn).forEach((l, j) => fade(k(m.lines[from + j], 0.35), () => {
        const me = l.who === 'me'
        const y = 230 + j * (bh + 14)
        const L = lay[from + j]
        const tb = fit(ctx, l.tr, { weight: 500, sizes: [30, 26], maxW: 1100, maxLines: 1, fam: 'latin', balanced: false })
        const bw = Math.max(L.lineW(L.lines[0]), measure(ctx, tb.lines[0], tb.f)) + 80
        const x = me ? W - 120 - bw : 120
        ctx.fillStyle = me ? alpha(line, 0.2) : p.card
        rrect(ctx, x, y, bw, bh, 28)
        ctx.fill()
        drawSentence(ctx, L, x + 40, y + 16, 'left', ui => ({ ink: p.ink, ruby: p.ink2, rule: ui.row.lit ? line : null, ruleW: 6 }))
        text(ctx, tb.lines[0], x + 40, y + bh - 22, { f: tb.f, color: p.ink2 })
      }))
      if (d.note) fade(k(m.note, 0.4), () => para(d.note, 120, 960 - 2 * 44, 1500, [36, 32], p.ink, 'left', 500, 2))
      break
    }
    case 'q': drawQuestion(ctx, p, line, S, d, m, u, k, fade, sentence, para, card, state); break
    case 'score': {
      fade(k(0.1, 0.5), () => para(S.score(d.n, d.of), W / 2, 330, 1600, [84, 72, 60], p.ink, 'center', 700, 2))
      fade(k(0.6, 0.5), () => para(`${d.n} / ${d.of}`, W / 2, 580, 800, [120], line, 'center', 700, 1))
      if (d.n === d.of) fade(k(1.2, 0.5), () => para(S.comment, W / 2, 790, 1400, [48, 40], p.ink2, 'center', 500, 1))
      break
    }
    default:
  }
  return state.join(',')
}

/** A word: alone for three seconds, then its reading, its meaning and a
 *  sentence; the route of the part's words down the side. */
function drawWord(ctx, p, S, line, plan, sg, d, m, u, k, fade, sentence, para, state) {
  const X = 96
  const COL = COL_RULE - X - 64
  const kanji = hasKanji(d.t)
  const z = sized(ctx, d.t, 900, 300, famOf(d.t), COL)
  fade(k(0.1, 0.3), () => text(ctx, d.t, X - z * 0.03, 540, { f: font(900, z, famOf(d.t)), color: p.ink }))
  if (u < m.think) {
    // Read it… and the seconds left to try, as three lamps going out.
    const left = Math.max(0, Math.ceil(m.think - u))
    state.push(`L${left}`)
    fade(k(0.1, 0.3), () => {
      const w = text(ctx, S.readIt, X, 626, { f: font(500, 36, 'latin'), color: p.ink2 })
      for (let j = 0; j < 3; j++) {
        ctx.beginPath()
        ctx.arc(X + w + 40 + j * 36, 614, 10, 0, 7)
        ctx.fillStyle = j < left ? line : p.surfaceLine
        ctx.fill()
      }
    })
  }
  fade(k(m.think, 0.3), () => {
    if (kanji) text(ctx, d.r, X + 6, 228, { f: font(500, 48, 'jp'), color: p.ink2, tr: 0.3 })
    text(ctx, d.ro.toUpperCase(), X + 6, 626, { f: font(500, 34, 'latin'), color: p.ink2, tr: 0.24 })
  })
  const [main, note] = glossParts(d.gloss)
  fade(k(m.meaning, 0.35), () => {
    const h = para(main, X, 668, COL, [72, 62, 54, 46], p.ink, 'left', 700, 2)
    para(note, X, 668 + h + 2, COL, [34, 30], p.ink2, 'left', 500, 1)
  })
  ctx.fillStyle = p.surfaceLine
  ctx.fillRect(COL_RULE, 176, 2, 680)
  route(ctx, p, line, plan.items.map(x => x.t), sg.n, ROUTE_X, 190)
  if (d.ex && m.ex != null) fade(k(m.ex, 0.4), () => {
    ctx.fillStyle = p.card
    ctx.fillRect(0, 900, W, H - 900)
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(0, 900, W, 2)
    const h = sentence(d.ex.rows, X, 922, { max: 54, min: 34, maxW: W - 2 * X, maxLines: 1, under: d.ex.at ?? -1, lit: line, align: 'left' })
    para(d.ex.tr, X, 930 + h, W - 2 * X, [32, 28], p.ink2, 'left', 500, 1)
  })
}

/** A kanji: its strokes drawn on in their order, its meaning, its
 *  readings, two words; the route of the part's kanji down the side. */
function drawKanji(ctx, p, S, line, plan, sg, d, m, u, k, fade, para) {
  const n = d.strokes.d.length
  const bx = 96
  const by = 180
  const bs = 690
  fade(k(0, 0.3), () => {
    ctx.fillStyle = p.card
    rrect(ctx, bx, by, bs, bs, 24)
    ctx.fill()
    ctx.strokeStyle = p.surfaceLine
    ctx.lineWidth = 2
    rrect(ctx, bx + 1, by + 1, bs - 2, bs - 2, 24)
    ctx.stroke()
    guides(ctx, bx, by, bs, p.ink)
  })
  strokesIn(ctx, d, m, u, k, bx + 35, by + 35, bs - 70, p.ink, line)
  const x = bx + bs + 64
  const cw = COL_RULE - x - 48
  const mh = fit(ctx, d.meaning, { weight: 700, sizes: [72, 60, 52, 44], maxW: cw, maxLines: 2, fam: 'latin', balanced: false })
  fade(k(m.meaning, 0.35), () => para(d.meaning, x, 190, cw, [72, 60, 52, 44], p.ink, 'left', 700, 2))
  let y = 190 + paragraphH(mh, 1.22) + 40
  const reading = (label, top, parts, v) => fade(v, () => {
    text(ctx, label, x, top + 26, { f: font(700, 26, 'latin'), color: line, tr: 0.2 })
    const str = parts.length ? parts.map(([a, b]) => a + b).join('、') : '—'
    const f = font(700, sized(ctx, str, 700, 52, 'jp', cw), 'jp')
    let kx = x
    if (!parts.length) { text(ctx, str, x, top + 92, { f, color: p.ink2 }); return }
    parts.forEach(([a, b], j) => {
      if (j) kx += text(ctx, '、', kx, top + 92, { f, color: p.ink2 })
      kx += text(ctx, a, kx, top + 92, { f, color: p.ink })
      if (b) kx += text(ctx, b, kx, top + 92, { f, color: p.ink2 })
    })
  })
  reading(S.on, y, d.on.map(r => [r, '']), k(m.on, 0.3))
  y += 130
  reading(S.kun, y, d.kun, k(m.kun, 0.3))
  y += 150
  fade(k(m.meaning, 0.3), () => text(ctx, S.strokes(n), x, y + 20, { f: font(500, 30, 'latin'), color: p.ink2 }))
  ctx.fillStyle = p.surfaceLine
  ctx.fillRect(COL_RULE, 176, 2, 694)
  route(ctx, p, line, plan.items.map(x2 => x2.c), sg.n, ROUTE_X, 190)
  // The words, side by side in the band along the foot, as a word's sentence is.
  if (d.words.length) fade(k(m.words[0], 0.35), () => {
    ctx.fillStyle = p.card
    ctx.fillRect(0, 900, W, H - 900)
    ctx.fillStyle = p.surfaceLine
    ctx.fillRect(0, 900, W, 2)
  })
  const ww = (W - 2 * bx - 64) / 2
  d.words.forEach((w, j) => fade(k(m.words[j], 0.35), () => {
    const wx = bx + j * (ww + 64)
    const tw = text(ctx, w.t, wx, 972, { f: font(700, sized(ctx, w.t, 700, 56, 'jp', ww * 0.55), 'jp'), color: p.ink })
    text(ctx, w.r, wx + tw + 20, 972, { f: font(500, sized(ctx, w.r, 500, 32, 'jp', ww - tw - 20), 'jp'), color: p.ink2 })
    para(w.gloss, wx, 994, ww, [30, 26], p.ink2, 'left', 500, 1)
  }))
}

/** An example cut word by word: each word, its romaji and what it does. */
function drawChips(ctx, p, line, chips, at, k, fade, y0) {
  const pad = 26
  const fits = scale => {
    const ft = font(700, 52 * scale, 'jp')
    const fk = font(500, 24 * scale, 'jp')
    const fo = font(500, 26 * scale, 'latin')
    const fg = font(500, 26 * scale, 'latin')
    const rows = [[]]
    let x = 0
    for (const c of chips) {
      const g = c.gloss
      const w = Math.max(measure(ctx, c.t, ft), measure(ctx, c.ro, fo), measure(ctx, g, fg), c.kana ? measure(ctx, c.kana, fk) : 0) + pad * 2
      if (x + w > 1680 && rows[rows.length - 1].length) { rows.push([]); x = 0 }
      rows[rows.length - 1].push({ c, g, w, x })
      x += w + 16
    }
    return { rows, ft, fk, fo, fg, h: 170 * scale, scale }
  }
  // As large as the room under the example takes: one row of chips grows.
  let L = fits(1.3)
  if (L.rows.length > 1) L = fits(1)
  if (L.rows.length > 2) L = fits(0.82)
  if (L.rows.length > 2) L = fits(0.68)
  let idx = 0
  L.rows.forEach((row, ri) => {
    const rw = row.reduce((a, b) => a + b.w, 0) + 16 * (row.length - 1)
    const x0 = W / 2 - rw / 2
    const y = y0 + ri * (L.h + 16)
    for (const { c, g, w, x } of row) {
      const v = k(at[idx++], 0.3)
      fade(v, () => {
        ctx.fillStyle = c.lit ? alpha(line, 0.2) : p.card
        rrect(ctx, x0 + x, y, w, L.h, 18)
        ctx.fill()
        const cx = x0 + x + w / 2
        const s = L.scale
        if (c.kana) text(ctx, c.kana, cx, y + 34 * s, { f: L.fk, color: p.ink2, align: 'center' })
        text(ctx, c.t, cx, y + 88 * s, { f: L.ft, color: p.ink, align: 'center' })
        text(ctx, c.ro, cx, y + 122 * s, { f: L.fo, color: p.ink2, align: 'center' })
        text(ctx, g, cx, y + 154 * s, { f: L.fg, color: line, align: 'center' })
      })
    }
  })
}

const choiceText = c => c.text ?? joined(c.rows || [])
const choiceFam = c => (c.rows || c.fam === 'jp' ? 'jp' : 'latin')

/** The sentence a question shows: once answered, as it really is, with
 *  its readings and its blank filled. */
function shownStem(q, done) {
  const stem = q.stem
  let shown = done && stem.after ? stem.after : stem
  const fill = q.choices[q.right]
  const gap = shown.rows.findIndex(r => /^[＿_]+$/.test(r.t))
  if (done && gap >= 0 && (fill.rows || /[ぁ-んァ-ン一-龯]/.test(fill.text || ''))) {
    const rows = shown.rows.filter((r, i) => i <= gap || !/^[＿_]+$/.test(r.t))
    rows.splice(gap, 1, ...(fill.rows ? fill.rows.map(r => ({ ...r, lit: true })) : [{ t: fill.text, k: 'word', lit: true }]))
    shown = { rows }
  }
  return shown
}

/** A question: the ask in the band, the stem on the left, the answers
 *  down the right, five seconds draining from the stripe and a ring, then
 *  the answer and why. */
function drawQuestion(ctx, p, line, S, it, m, u, k, fade, sentence, para, card, state) {
  const q = it.q
  const revealed = u >= m.reveal
  const done = u >= m.answer
  state.push(done ? 'A' : revealed ? 'R' : '')
  const LX = 96
  const LW = 900
  const lc = LX + LW / 2
  const RX = 1096
  const RW = W - 96 - RX
  if (it.twist) fade(k(0, 0.3), () => text(ctx, `${S.twist} · ${q.notion}`.toUpperCase(), LX, 206, { f: font(700, 28, 'latin'), color: line, tr: 0.14 }))
  // The stem: a word as a specimen, a sentence (its word underlined, never its
  // reading, which some questions ask), or what the other person said.
  const stem = q.stem || {}
  const mid = 520
  if (stem.specimen) {
    fade(k(0.2, 0.35), () => {
      const sp = stem.specimen
      const z = sized(ctx, sp, 900, 300, famOf(sp), LW)
      text(ctx, sp, lc, mid + z * 0.34, { f: font(900, z, famOf(sp)), color: p.ink, align: 'center' })
    })
  } else if (stem.rows) {
    const shown = shownStem(q, done)
    const o = { max: 80, min: 44, maxW: LW, maxLines: 3, script: done ? 'furigana' : stem.script || 'kanji' }
    const L = layoutSentence(ctx, shown.rows, { ...o, rules: false, gap: 0.06, fam: 'jp', weight: 700 })
    const top = mid - (L?.h || 100) / 2
    fade(k(0.2, 0.35), () => sentence(shown.rows, lc, top, { ...o, under: shown.under ? shown.target : -1, lit: stem.lit || stem.underLit || shown !== stem ? line : null }))
  } else if (stem.cue) {
    const L = layoutSentence(ctx, stem.cue.rows, { max: 56, min: 34, maxW: LW - 80, maxLines: 2, script: 'furigana', rules: false, gap: 0.06, fam: 'jp', weight: 700 })
    const bh = L.h + 90
    const top = mid - bh / 2 - (stem.task ? 40 : 0)
    fade(k(0.2, 0.35), () => {
      ctx.fillStyle = p.card
      rrect(ctx, LX, top, LW, bh, 28)
      ctx.fill()
      drawSentence(ctx, L, LX + 40, top + 20, 'left', () => ({ ink: p.ink, ruby: p.ink2 }))
      para(stem.cue.tr, LX + 40, top + L.h + 30, LW - 80, [30, 26], p.ink2, 'left', 500, 1)
    })
    if (stem.task) fade(k(0.3, 0.35), () => para(stem.task, LX, top + bh + 30, LW, [34, 30], p.ink, 'left', 500, 2))
  }
  ctx.fillStyle = p.surfaceLine
  ctx.fillRect(RX - 40, 176, 2, 860)
  const n = q.choices.length
  if (!done) {
    const ch = Math.min(176, (1040 - 190 - 18 * (n - 1)) / n)
    q.choices.forEach((c, j) => fade(k(0.5 + j * 0.12, 0.3), () => {
      const cy = 190 + j * (ch + 18)
      const right = j === q.right
      ctx.save()
      if (revealed && !right) ctx.globalAlpha *= 0.35
      card(RX, cy, RW, ch, revealed && right ? p.gold : p.surfaceLine, revealed && right ? 6 : 2)
      roundel(ctx, RX + 58, cy + ch / 2, 30, line, String(j + 1), { ink: p.ink, size: 28 })
      const sizes = choiceFam(c) === 'jp' ? [56, 48, 42, 36] : [44, 38, 32, 28]
      let b = fit(ctx, choiceText(c), { weight: 700, sizes, maxW: RW - 140, maxLines: 1, fam: choiceFam(c), balanced: false })
      if (b.cut) b = fit(ctx, choiceText(c), { weight: 700, sizes, maxW: RW - 140, maxLines: 2, fam: choiceFam(c), balanced: false })
      const bh = paragraphH(b, 1.12)
      b.lines.forEach((l, li) => text(ctx, l, RX + 112, cy + ch / 2 - bh / 2 + b.size * (0.84 + li * 1.12), { f: b.f, color: p.ink }))
      ctx.restore()
    }))
    if (!revealed && u >= m.show) {
      const left = m.reveal - u
      const share = Math.max(0, left / m.count)
      state.push(Math.round(share * 90))
      countdown(ctx, lc, 930, 54, alpha(line, 0.2), line, p.ink, share, left)
    }
  } else {
    // The answer alone, and why.
    const e = q.explain || {}
    fade(k(m.answer, 0.35), () => {
      const c = q.choices[q.right]
      card(RX, 190, RW, 150, p.gold, 6)
      roundel(ctx, RX + 58, 265, 30, line, String(q.right + 1), { ink: p.ink, size: 28 })
      const b = fit(ctx, choiceText(c), { weight: 700, sizes: [56, 48, 40, 34, 30], maxW: RW - 140, maxLines: 2, fam: choiceFam(c), balanced: false })
      const bh = paragraphH(b, 1.12)
      b.lines.forEach((l, li) => text(ctx, l, RX + 112, 265 - bh / 2 + b.size * (0.84 + li * 1.12), { f: b.f, color: p.ink }))
    })
    fade(k(m.answer + 0.4, 0.4), () => {
      let ey = 390
      const first = [e.head, e.sense].filter(Boolean).join(' — ')
      if (first) ey += para(first, RX, ey, RW, [40, 36, 32], p.ink, 'left', 700, 3) + 16
      if (e.why) para(e.why, RX, ey, RW, [34, 30, 28, 26], p.ink2, 'left', 500, Math.max(1, Math.floor((1040 - ey) / 36)))
    })
  }
}

// ── A short: the station plate (plan 214, drawn as plan 218's pick) ──
// The plate stands on the sumi wall inside the feed's safe area
// (TALL.safe): the masthead and the line of stations at the top, the
// plate in the middle, its meaning or its answers under it, nothing under
// the caption and the buttons a feed lays over the foot.
const TW = TALL.w
const TH = TALL.h
const TX = TALL.safe.l
const TWIDE = TW - TALL.safe.l - TALL.safe.r
const PLATE_Y = 430
const PLATE_BAND = 100
const WORD_H = 640 // a word's plate, its face

/** The plate's elevation, --elev-hang ("0 10px 26px rgba(…)": its first
 *  length unitless, which draw.js's shadow() does not read). */
function hang(ctx) {
  const m = /^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)px\s+([\d.]+)px\s+(rgba?\([^)]+\))/.exec(SUMI.hang || '')
  if (!m) return
  ctx.shadowOffsetX = +m[1] * K
  ctx.shadowOffsetY = +m[2] * K
  ctx.shadowBlur = +m[3] * K
  ctx.shadowColor = m[4]
}

/** A plate: its face, the band at its foot in the line's pigment, the
 *  station's number in its corner. `band` draws the band's contents. */
function plate(ctx, line, y, h, { bandH = PLATE_BAND, box = null, band = null } = {}) {
  ctx.save()
  hang(ctx)
  ctx.fillStyle = PAPER.bg
  rrect(ctx, TX, y, TWIDE, h + bandH, 14)
  ctx.fill()
  noShadow(ctx)
  rrect(ctx, TX, y, TWIDE, h + bandH, 14)
  ctx.clip()
  ctx.fillStyle = line
  ctx.fillRect(TX, y + h, TWIDE, bandH)
  ctx.restore()
  if (box) numBox(ctx, TX + 28, y + 28, 100, line, box[0], box[1], PAPER.bg, PAPER.ink)
  band?.(y + h, bandH)
}

/** The band's two neighbours: the station before on the left, after on the right. */
function neighbours(ctx, p, names, n, by, bh) {
  const cy = by + bh / 2
  const f = name => font(700, sized(ctx, name, 700, 40, 'jp', TWIDE / 2 - 110), 'jp')
  const prev = names[n - 2]
  const next = names[n]
  if (prev) {
    pointer(ctx, TX + 44, cy, 30, -1, p.onLine)
    text(ctx, prev, TX + 76, cy + 15, { f: f(prev), color: p.onLine })
  }
  if (next) {
    pointer(ctx, TX + TWIDE - 44, cy, 30, 1, p.onLine)
    text(ctx, next, TX + TWIDE - 76, cy + 15, { f: f(next), color: p.onLine, align: 'right' })
  }
}

/** A line of the band, centred: an ask, an example's number. */
function bandText(ctx, p, str, by, bh, sizes = [40, 34, 30]) {
  const b = fit(ctx, str, { weight: 700, sizes, maxW: TWIDE - 80, maxLines: 2, fam: 'latin', balanced: true })
  const top = by + bh / 2 - (b.lines.length * b.size * 1.16) / 2
  b.lines.forEach((l, j) => text(ctx, l, TW / 2, top + b.size * (0.86 + j * 1.16), { f: b.f, color: p.onLine, align: 'center' }))
}

/** The frame of a short at second `t`, and its key. */
function drawTall(ctx, plan, tl, t) {
  const { p, S, line, sg, u, state, k, fade, d, m } = begin(ctx, plan, tl, t, TW, TH, 'sumi')
  const { card, sentence, para } = tools(ctx, p, line)
  const cx = TW / 2
  const box = sg.n ? [sg.type === 'q' ? 'Q' : plan.theme ? '' : plan.level, sg.n] : null
  if (sg.type !== 'intro' && sg.type !== 'outro') {
    mark(ctx, TX, 250, 56, p.ink, p.gold)
    text(ctx, 'TSUJI', TX + 70, 292, { f: font(700, 24, 'latin'), color: p.ink2, tr: 0.3 })
    if (sg.n) {
      text(ctx, `${sg.n} / ${tl.of}`, TW - TALL.safe.r, 292, { f: font(700, 30, 'latin'), color: p.ink2, align: 'right' })
      // The line of stations, under the masthead.
      const y = 352
      const x0 = TX
      const x1 = TW - TALL.safe.r
      ctx.fillStyle = alpha(line, 0.25)
      ctx.fillRect(x0, y - 4, x1 - x0, 8)
      ctx.fillStyle = line
      ctx.fillRect(x0, y - 4, (x1 - x0) * (sg.n - 0.5) / tl.of, 8)
      for (let j = 0; j < tl.of; j++) {
        ctx.beginPath()
        ctx.arc(x0 + (x1 - x0) * (j + 0.5) / tl.of, y, j === sg.n - 1 ? 16 : 9, 0, 7)
        ctx.fillStyle = j < sg.n ? line : p.surfaceLine
        ctx.fill()
      }
    }
  }
  switch (sg.type) {
    case 'intro': {
      fade(k(0.1, 0.4), () => mark(ctx, cx - 70, 300, 140, p.ink, p.gold))
      fade(k(0.3, 0.4), () => plate(ctx, line, 520, 420, {
        bandH: 140,
        band: (by, bh) => bandText(ctx, p, S.hook[plan.kind], by, bh, [42, 36, 32]),
      }))
      fade(k(0.3, 0.4), () => {
        const b = fit(ctx, plan.title, { weight: 700, sizes: [84, 72, 62, 54], maxW: TWIDE - 100, maxLines: 3, fam: 'latin', balanced: true })
        const top = 520 + 210 - paragraphH(b, 1.18) / 2
        b.lines.forEach((l, j) => text(ctx, l, cx, top + b.size * (0.8 + j * 1.18), { f: b.f, color: PAPER.ink, align: 'center' }))
      })
      break
    }
    case 'outro': {
      fade(k(0.1, 0.4), () => mark(ctx, cx - 80, 440, 160, p.ink, p.gold))
      fade(k(0.3, 0.4), () => para(S.outro, cx, 700, TWIDE, [76, 64], p.ink, 'center', 700, 2))
      fade(k(0.6, 0.4), () => para(S.outroSub, cx, 900, TWIDE, [40, 34], p.ink2, 'center', 500, 3))
      if (plan.kind === 'quiz') fade(k(0.8, 0.4), () => para(S.comment, cx, 1060, TWIDE, [44, 38], p.gold, 'center', 700, 2))
      fade(k(1.0, 0.4), () => A.departButton(ctx, p, cx - 330, 1200, 660, 2, S.depart))
      break
    }
    case 'vocab': {
      const kanji = hasKanji(d.t)
      const names = plan.items.map(x => x.t)
      fade(k(0, 0.3), () => plate(ctx, line, PLATE_Y, WORD_H, { box, band: (by, bh) => neighbours(ctx, p, names, sg.n, by, bh) }))
      const z = sized(ctx, d.t, 900, 290, famOf(d.t), TWIDE - 120)
      fade(k(0.1, 0.3), () => text(ctx, d.t, cx, PLATE_Y + 450 + z * 0.1, { f: font(900, z, famOf(d.t)), color: PAPER.ink, align: 'center' }))
      if (u < m.think) {
        const left = Math.max(0, Math.ceil(m.think - u))
        state.push(`L${left}`)
        fade(k(0.1, 0.3), () => {
          const w = measure(ctx, S.readIt, font(500, 38, 'latin'))
          text(ctx, S.readIt, cx - 40, PLATE_Y + 580, { f: font(500, 38, 'latin'), color: PAPER.ink2, align: 'center' })
          for (let j = 0; j < 2; j++) {
            ctx.beginPath()
            ctx.arc(cx - 40 + w / 2 + 34 + j * 32, PLATE_Y + 568, 10, 0, 7)
            ctx.fillStyle = j < left ? line : PAPER.surfaceLine
            ctx.fill()
          }
        })
      }
      fade(k(m.think, 0.3), () => {
        if (kanji) text(ctx, d.r, cx, PLATE_Y + 140, { f: font(500, 52, 'jp'), color: PAPER.ink2, align: 'center', tr: 0.3 })
        text(ctx, d.ro.toUpperCase(), cx, PLATE_Y + 580, { f: font(500, 38, 'latin'), color: PAPER.ink2, align: 'center', tr: 0.24 })
      })
      const [main, note] = glossParts(d.gloss)
      fade(k(m.meaning, 0.35), () => {
        const h = para(main, cx, PLATE_Y + WORD_H + PLATE_BAND + 60, TWIDE, [72, 62, 54, 46], p.ink, 'center', 700, 2)
        para(note, cx, PLATE_Y + WORD_H + PLATE_BAND + 66 + h, TWIDE, [36, 32], p.ink2, 'center', 500, 2)
      })
      break
    }
    case 'kanji': {
      const n = d.strokes.d.length
      const names = plan.items.map(x => x.c)
      const bodyH = 600
      fade(k(0, 0.3), () => {
        plate(ctx, line, PLATE_Y, bodyH, { box, band: (by, bh) => neighbours(ctx, p, names, sg.n, by, bh) })
        guides(ctx, cx - 250, PLATE_Y + 40, 500, PAPER.ink)
      })
      strokesIn(ctx, d, m, u, k, cx - 250, PLATE_Y + 40, 500, PAPER.ink, line)
      fade(k(m.meaning, 0.35), () => text(ctx, S.strokes(n), cx, PLATE_Y + bodyH - 22, { f: font(500, 28, 'latin'), color: PAPER.ink2, align: 'center' }))
      const y0 = PLATE_Y + bodyH + PLATE_BAND
      fade(k(m.meaning, 0.35), () => para(d.meaning, cx, y0 + 36, TWIDE, [64, 54, 46], p.ink, 'center', 700, 1))
      const reading = (label, y, parts, v) => fade(v, () => {
        const str = parts.length ? parts.map(([a, b]) => a + b).join('、') : '—'
        const lf = font(700, 26, 'latin')
        const lw = measure(ctx, label, lf, 0.2) + 24
        const z = sized(ctx, str, 700, 52, 'jp', TWIDE - lw)
        const f = font(700, z, 'jp')
        const x = cx - (lw + measure(ctx, str, f)) / 2
        text(ctx, label, x, y - 6, { f: lf, color: line, tr: 0.2 })
        text(ctx, str, x + lw, y, { f, color: p.ink })
      })
      reading(S.on, y0 + 170, d.on.map(r => [r, '']), k(m.on, 0.3))
      reading(S.kun, y0 + 235, d.kun, k(m.kun, 0.3))
      d.words.forEach((w, j) => fade(k(m.words[j], 0.35), () => {
        para(`${w.t}  ${w.r}`, cx, y0 + 268, TWIDE, [46, 40], p.ink, 'center', 700, 1)
        para(w.gloss, cx, y0 + 326, TWIDE, [32, 28], p.ink2, 'center', 500, 1)
      }))
      break
    }
    case 'gtitle': {
      // On one line where any size holds it: a point cut in two reads as two words.
      const one = fit(ctx, d.p, { weight: 900, sizes: [150, 120, 96, 80, 64], maxW: TWIDE - 100, maxLines: 1, fam: 'serif', balanced: false })
      const b = one.cut ? fit(ctx, d.p, { weight: 900, sizes: [96, 80, 64], maxW: TWIDE - 100, maxLines: 2, fam: 'serif', balanced: true }) : one
      const bodyH = Math.max(380, paragraphH(b, 1.1) + 200)
      fade(k(0, 0.3), () => plate(ctx, line, PLATE_Y + 60, bodyH, {
        box,
        bandH: 120,
        band: (by, bh) => bandText(ctx, p, d.form, by, bh, [40, 34, 30]),
      }))
      fade(k(0.1, 0.4), () => {
        const top = PLATE_Y + 60 + bodyH / 2 + 30 - paragraphH(b, 1.1) / 2
        b.lines.forEach((l, j) => text(ctx, l, cx, top + b.size * (0.8 + j * 1.1), { f: b.f, color: PAPER.ink, align: 'center' }))
      })
      fade(k(0.5, 0.4), () => para(d.meaning, cx, PLATE_Y + 60 + bodyH + 120 + 70, TWIDE, [56, 48, 40], p.ink, 'center', 700, 3))
      break
    }
    case 'gex': {
      const o = { max: 76, min: 44, maxW: TWIDE - 100, maxLines: 3 }
      const L = layoutSentence(ctx, d.rows, { ...o, script: 'furigana', rules: false, gap: 0.06, fam: 'jp', weight: 700 })
      const bodyH = (L?.h || 120) + 240
      fade(k(0, 0.3), () => plate(ctx, line, PLATE_Y + 40, bodyH, { box, band: (by, bh) => bandText(ctx, p, `${S.example} ${d.n} / ${d.of}`, by, bh) }))
      fade(k(0.2, 0.4), () => sentence(d.rows, cx, PLATE_Y + 40 + 150, { ...o, lit: line, ink: PAPER.ink, ruby: PAPER.ink2 }))
      fade(k(0.4, 0.4), () => para(d.tr, cx, PLATE_Y + 40 + bodyH + PLATE_BAND + 60, TWIDE, [46, 40, 34], p.ink2, 'center', 500, 3))
      break
    }
    case 'q': drawTallQuestion(ctx, p, line, S, d, m, u, k, fade, sentence, para, card, state, box); break
    default:
  }
  return state.join(',')
}

/** A question standing: the stem on the plate, the ask on its band, the
 *  answers one a line under it, five seconds on a ring in the plate's
 *  corner, then the answer and why. */
function drawTallQuestion(ctx, p, line, S, it, m, u, k, fade, sentence, para, card, state, box) {
  const q = it.q
  const cx = TW / 2
  const revealed = u >= m.reveal
  const done = u >= m.answer
  state.push(done ? 'A' : revealed ? 'R' : '')
  const askB = fit(ctx, q.ask, { weight: 700, sizes: [40, 34, 30], maxW: TWIDE - 80, maxLines: 2, fam: 'latin', balanced: true })
  const bandH = askB.lines.length > 1 ? 130 : 100
  // The stem on the plate's face: a word as a specimen, a sentence, or what the other person said.
  const stem = q.stem || {}
  let bodyH = 320
  let drawStem = () => {}
  if (stem.specimen) {
    const sp = stem.specimen
    const z = sized(ctx, sp, 900, 220, famOf(sp), TWIDE - 280)
    drawStem = top => text(ctx, sp, cx, top + 160 + z * 0.36, { f: font(900, z, famOf(sp)), color: PAPER.ink, align: 'center' })
  } else if (stem.rows) {
    const shown = shownStem(q, done)
    const o = { max: 64, min: 38, maxW: TWIDE - 80, maxLines: 3, script: done ? 'furigana' : stem.script || 'kanji' }
    const L = layoutSentence(ctx, shown.rows, { ...o, rules: false, gap: 0.06, fam: 'jp', weight: 700 })
    bodyH = Math.max(300, (L?.h || 100) + 190)
    drawStem = top => sentence(shown.rows, cx, top + 150, { ...o, under: shown.under ? shown.target : -1, lit: stem.lit || stem.underLit || shown !== stem ? line : null, ink: PAPER.ink, ruby: PAPER.ink2 })
  } else if (stem.cue) {
    const L = layoutSentence(ctx, stem.cue.rows, { max: 48, min: 34, maxW: TWIDE - 80, maxLines: 2, script: 'furigana', rules: false, gap: 0.06, fam: 'jp', weight: 700 })
    bodyH = L.h + 220
    drawStem = top => {
      drawSentence(ctx, L, cx, top + 150, 'center', () => ({ ink: PAPER.ink, ruby: PAPER.ink2 }))
      para(stem.cue.tr, cx, top + 160 + L.h, TWIDE - 80, [30, 26], PAPER.ink2, 'center', 500, 1)
    }
  }
  const top = PLATE_Y
  fade(k(0, 0.3), () => plate(ctx, line, top, bodyH, { box, bandH, band: (by, bh) => bandText(ctx, p, q.ask, by, bh) }))
  fade(k(0.2, 0.35), () => drawStem(top))
  const n = q.choices.length
  let y = top + bodyH + bandH + 40
  if (!done) {
    if (!revealed && u >= m.show) {
      const left = m.reveal - u
      const share = Math.max(0, left / m.count)
      state.push(Math.round(share * 90))
      countdown(ctx, TX + TWIDE - 78, top + 78, 48, PAPER.surfaceLine, line, PAPER.ink, share, left)
    }
    const ch = Math.max(84, Math.min(120, (1480 - y - 14 * (n - 1)) / n))
    q.choices.forEach((c, j) => fade(k(0.5 + j * 0.12, 0.3), () => {
      const cy = y + j * (ch + 14)
      const right = j === q.right
      ctx.save()
      if (revealed && !right) ctx.globalAlpha *= 0.35
      card(TX, cy, TWIDE, ch, revealed && right ? p.gold : p.surfaceLine, revealed && right ? 6 : 2)
      roundel(ctx, TX + 52, cy + ch / 2, 28, line, String(j + 1), { ink: p.ink, size: 26 })
      let b = fit(ctx, choiceText(c), { weight: 700, sizes: [48, 42, 36, 30], maxW: TWIDE - 130, maxLines: 1, fam: choiceFam(c), balanced: false })
      if (b.cut) b = fit(ctx, choiceText(c), { weight: 700, sizes: [36, 30, 26], maxW: TWIDE - 130, maxLines: 2, fam: choiceFam(c), balanced: false })
      const bh = paragraphH(b, 1.12)
      b.lines.forEach((l, li) => text(ctx, l, TX + 100, cy + ch / 2 - bh / 2 + b.size * (0.84 + li * 1.12), { f: b.f, color: p.ink }))
      ctx.restore()
    }))
  } else {
    const e = q.explain || {}
    fade(k(m.answer, 0.35), () => {
      const c = q.choices[q.right]
      card(TX, y, TWIDE, 120, p.gold, 6)
      roundel(ctx, TX + 52, y + 60, 28, line, String(q.right + 1), { ink: p.ink, size: 26 })
      const b = fit(ctx, choiceText(c), { weight: 700, sizes: [52, 44, 38, 32, 28], maxW: TWIDE - 130, maxLines: 1, fam: choiceFam(c), balanced: false })
      text(ctx, b.lines[0], TX + 100, y + 60 + b.size * 0.36, { f: b.f, color: p.ink })
    })
    fade(k(m.answer + 0.4, 0.4), () => {
      let ey = y + 160
      const first = [e.head, e.sense].filter(Boolean).join(' — ')
      if (first) ey += para(first, TX, ey, TWIDE, [42, 38, 34], p.gold, 'left', 700, 3) + 14
      if (e.why) para(e.why, TX, ey, TWIDE, [36, 32, 28], p.ink2, 'left', 500, Math.max(1, Math.floor((1480 - ey) / 38)))
    })
  }
}
