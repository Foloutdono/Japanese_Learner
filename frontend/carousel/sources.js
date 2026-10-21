// ── カルーセル — what a carousel is drawn from (plans 229b, 229c) ────
// A carousel starts from one thing the app teaches: a sentence of the
// reading bank (read it, or say it: 読書 and 翻訳), a grammar lesson
// with its tour (文法), a word of the deck (単語), a kanji (漢字), a kana
// (かな) or a comprehension passage (理解). Each source here turns its
// item into a plan: the station plates' walk (`slides`, each a `kind`
// slides.js draws), the questions it can be asked (quizzes.js), and what
// each other carousel type needs where the item has it: two things to
// tell apart (`compare`), a sentence to build (`build`), a list
// (`list`), a conversation (`talk`). Pure: no canvas, no fetch, so the
// node tests read it directly.
import { hasKanji, reading } from './draw.js'
import { STRINGS, count, formOf, tr, weldIf } from './strings.js'
import { ROLES, clauseLabel, howItWorks, lookalikesOf, particleLabel, stacksIn } from './explain.js'
import { deal, firstSense, furiganaOf, gloss, lineRomaji, readingMisses, seeded, shuffle, unpack } from './common.js'
import {
  kanaQuizzes, kanjiQuizzes, lessonQuizzes, lookalikeQuizzes, overlaps, passageQuizzes, pictureQuizzes, sentenceQuizzes, spellingQuizzes,
  translationQuizzes, trapQuizzes, wordQuizzes,
} from './quizzes.js'
import { PROMO, STORIES, STORY_FILES, analysed, promoItems, promoPlan } from './promo.js'
import { echoItems, echoPlan } from './echo.js'
import { challengeItems } from './challenge.js'

export { gloss, lineRomaji, readingMisses, seeded, shuffle, unpack }

export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// Each source wears the pigment of the line the app teaches it on.
export const SOURCES = [
  { id: 'sentence', jp: '読書', line: 'reading', name: { en: 'Read a sentence', fr: 'Lire une phrase' }, file: lv => `${lv}.json` },
  { id: 'translation', jp: '翻訳', line: 'honyaku', name: { en: 'Translate', fr: 'Traduire' }, file: lv => `${lv}.json` },
  { id: 'lesson', jp: '文法', line: 'grammar', name: { en: 'Grammar lesson', fr: 'Leçon de grammaire' }, file: lv => `grammar-${lv}.json` },
  { id: 'word', jp: '単語', line: 'vocab', name: { en: 'Word', fr: 'Mot' }, file: lv => `words-${lv}.json` },
  { id: 'kanji', jp: '漢字', line: 'kanji', name: { en: 'Kanji', fr: 'Kanji' }, file: lv => `kanji-${lv}.json` },
  { id: 'kana', jp: 'かな', line: 'kana', name: { en: 'Kana', fr: 'Kana' }, file: () => 'kana.json', levels: ['hiragana', 'katakana'] },
  { id: 'passage', jp: '理解', line: 'rikai', name: { en: 'Compre\u00adhension', fr: 'Compré\u00adhension' }, file: () => 'comprehension.json', byLevel: true },
  // Plan 229m: a theme in pictures, kanji that look alike, a conversation
  // to answer, a trap the grammar lessons warn of. A theme, a set and a
  // conversation are picked from one list, not by level.
  { id: 'theme', jp: '単語帳', line: 'vocab', name: { en: 'Theme words', fr: 'Mots par thème' }, file: () => 'themes.json', noLevels: true },
  { id: 'lookalike', jp: '似た字', line: 'kanji', name: { en: 'Lookalike kanji', fr: 'Kanji jumeaux' }, file: () => 'lookalikes.json', noLevels: true },
  { id: 'dialogue', jp: '返事', line: 'grammar', name: { en: 'Your reply', fr: 'Ta réponse' }, file: () => 'dialogues.json', noLevels: true },
  { id: 'trap', jp: '落とし穴', line: 'grammar', name: { en: 'Traps', fr: 'Pièges' }, file: () => 'traps.json', byLevel: true },
  // Plan 254: Read it's own sentences, a noun, a particle and a verb (content/short.json).
  { id: 'short', jp: '短文', line: 'reading', name: { en: 'Short sentences', fr: 'Phrases courtes' }, file: () => 'short.json', noLevels: true },
  // Plan 231: the app itself, in five stories (promo.js); its "levels"
  // are the stories, each reading the file its pick comes from.
  { id: 'promo', jp: '宣伝', line: 'gold', name: { en: 'Promo stories', fr: 'Stories promo' }, file: story => STORY_FILES[story] || 'index.json', levels: STORIES, levelNames: PROMO.en.names },
  // Plan 232: a pictured word said over and over for ten seconds (echo.js).
  { id: 'echo', jp: '木霊', line: 'vocab', name: { en: 'Word echo', fr: 'Mot en écho' }, file: () => 'themes.json', noLevels: true },
  // The long videos (plan 233): a level's videos, drawn by long.js, made by long/render.mjs.
  { id: 'long', jp: '長編', line: 'exam', name: { en: 'Long video', fr: 'Vidéo longue' }, file: lv => `words-${lv}.json`, video: true },
  // Plan 252: a level's words, or a theme's, nine a short, as a card or a quiz (words.js).
  { id: 'words', jp: '語彙', line: 'vocab', name: { en: 'Word shorts', fr: 'Shorts de mots' }, file: lv => `words-${lv}.json`, video: true },
  // Plan 247: a comprehension text read as a 9:16 video, falling or read along (challenge.js).
  { id: 'challenge', jp: '速読', line: 'rikai', name: { en: 'Reading challenge', fr: 'Défi lecture' }, file: () => 'comprehension.json', byLevel: true, video: true },
  // Plan 270: each feature of the Practice tab, the app itself recorded doing one exercise (feature.js).
  { id: 'feature', jp: '実践', line: 'gold', name: { en: 'Feature videos', fr: 'Vidéos des fonctions' }, file: () => 'promo.json', noLevels: true, video: true },
]
export const sourceOf = id => SOURCES.find(s => s.id === id) ?? SOURCES[0]

// The station plates' slides a source may leave out, with whether each
// is in by default. `check` ends the walk on the questions picked.
export const OPTIONAL = {
  sentence: [['words', true], ['grammar', true], ['watch', true], ['more', false], ['check', false], ['yourturn', false], ['rating', false], ['outro', true]],
  translation: [['words', true], ['grammar', true], ['watch', false], ['more', false], ['check', false], ['yourturn', false], ['outro', true]],
  lesson: [['examples', true], ['scene', true], ['twist', true], ['usage', false], ['rival', false], ['watch', true], ['check', false], ['yourturn', true], ['outro', true]],
  word: [['parts', true], ['examples', true], ['family', false], ['strokes', true], ['check', false], ['yourturn', false], ['outro', true]],
  kanji: [['readings', true], ['words', true], ['strokes', true], ['check', false], ['yourturn', false], ['outro', true]],
  kana: [['strokes', true], ['lookalike', true], ['words', true], ['check', false], ['outro', true]],
  passage: [['vocab', false], ['check', true], ['outro', true]],
  theme: [['recap', true], ['check', false], ['outro', true]],
  lookalike: [['apart', true], ['check', true], ['outro', true]],
  dialogue: [['outro', true]],
  trap: [['pair', true], ['careful', true], ['outro', true]],
}
export const BONUS = new Set(['sentence', 'translation'])

// The stations the app's own map gives each source (config/stations.js):
// a code in its roundel, a reading over its name, and the stations either
// side of it on its line (config/tabs.js: 学習 runs かな 単語 漢字 文法
// 教材, 実践 runs 読書 理解 翻訳 書取 作文 模試, both out of 辻).
// `pig` is the station's own line pigment (config/tabs.js); 教材 has none.
const STATION = {
  tsuji: { jp: '辻', kana: 'つじ', code: 'TJ' },
  kana: { jp: 'かな', kana: 'かな', code: 'KN', pig: 'kana' },
  word: { jp: '単語', kana: 'たんご', code: 'TG', pig: 'vocab' },
  kanji: { jp: '漢字', kana: 'かんじ', code: 'KJ', pig: 'kanji' },
  lesson: { jp: '文法', kana: 'ぶんぽう', code: 'BP', pig: 'grammar' },
  decks: { jp: '教材', kana: 'きょうざい', code: 'KZ' },
  sentence: { jp: '読書', kana: 'どくしょ', code: 'DS', pig: 'reading' },
  passage: { jp: '理解', kana: 'りかい', code: 'RK', pig: 'rikai' },
  translation: { jp: '翻訳', kana: 'ほんやく', code: 'HY', pig: 'honyaku' },
  dictation: { jp: '書取', kana: 'かきとり', code: 'KT', pig: 'kakitori' },
  composition: { jp: '作文', kana: 'さくぶん', code: 'SB', pig: 'sakubun' },
  exam: { jp: '模試', kana: 'もし', code: 'MS', pig: 'exam' },
}
const LINES = [
  { key: 'learn', jp: '学習', stops: ['tsuji', 'kana', 'word', 'kanji', 'lesson', 'decks'] },
  { key: 'practice', jp: '実践', stops: ['tsuji', 'sentence', 'passage', 'translation', 'dictation', 'composition', 'exam'] },
]
// Plan 229m's modes stop at the station the app teaches them on: a
// theme's words at 単語, lookalike kanji at 漢字, a reply and a trap at 文法,
// a short sentence at 読書.
const ALIAS = { theme: 'word', lookalike: 'kanji', dialogue: 'lesson', trap: 'lesson', short: 'sentence' }
function stationOf(source, lang) {
  const id = ALIAS[source] || source
  const line = LINES.find(l => l.stops.includes(id))
  const at = line.stops.indexOf(id)
  return {
    ...STATION[id], name: sourceOf(id).name[lang].replace(/\u00ad/g, ''),
    prev: STATION[line.stops[at - 1]], next: STATION[line.stops[at + 1]], line: { key: line.key, jp: line.jp },
  }
}
/** The app's two lines out of 辻, every station on them, the source's lit:
 *  what the route-map ending draws. */
function mapOf(source) {
  const at = ALIAS[source] || source
  return LINES.map(l => ({ key: l.key, jp: l.jp, stops: l.stops.slice(1).map(id => ({ ...STATION[id], here: id === at })) }))
}
/** What the last slide says about the source's line, from the bank's own figures. */
function figureOf(source, figures, t, lang) {
  if (!figures) return ''
  const f = t.figure
  switch (source) {
    case 'sentence':
    case 'short': return f.sentence(count(figures.sentences, lang))
    case 'translation': return f.translation(count(figures.sentences, lang))
    case 'lesson': return f.lesson(count(figures.points, lang))
    case 'word': return f.word(count(figures.words, lang))
    case 'kanji': return f.kanji(count(figures.kanji, lang))
    case 'kana': return f.kana(figures.hiragana, figures.katakana)
    case 'theme': return f.theme(count(figures.themeWords, lang), figures.themes)
    case 'lookalike': return f.lookalike()
    case 'dialogue': return f.dialogue()
    case 'trap': return f.trap(count(figures.traps, lang))
    default: return f.passage()
  }
}

// ── The parts every sentence-shaped source shares ────────────
// The kana words a pattern is built of, which carry no meaning of their
// own there (plan 234e): a formal noun (もの, こと, ため, わけ), or a verb
// or an adjective of the few a pattern leans on (する, なる, いう, いい).
// Any other word keeps its own gloss beside the pattern (とめられません
// of しかとめられません).
const PATTERN_VERBS = new Set(`する なる ある いる いう いく くる みる しまう おく いただく くださる もらう あげる
  くれる できる かまう いける すむ ならない いい よい ない ほしい`.split(/\s+/))
const grammatical = row => row.pos !== 'verb' && row.pos !== 'adjective' ? true
  : [row.t, ...(row.lemma || [])].some(w => PATTERN_VERBS.has(w))
function wordItems(s, points, lang, t) {
  const markers = new Set(s.gram.filter(g => g.kind === 'marker').map(g => g.p))
  const pointOf = row => {
    const g = row.g || []
    return g.find(p => p === row.t) ?? g.find(p => markers.has(p)) ?? g[0]
  }
  // A pattern a row shares with the row beside it (もの and の of ものの,
  // と and は of とは限らない): the row is a piece of it, whatever else is
  // written on it (plan 234e).
  const sharedOf = i => {
    const near = [s.rows[i - 1], s.rows[i + 1]].filter(r => r && r.k !== 'punct')
    return (s.rows[i].g || []).find(p => points[p] && p !== s.rows[i].t && near.some(r => (r.g || []).includes(p))) ?? null
  }
  const items = s.rows.map((row, i) => ({ row, i })).filter(({ row }) => row.k !== 'punct').map(({ row, i }) => {
    const grammar = row.k !== 'word'
    const shared = sharedOf(i)
    let main, sub
    if (grammar) {
      // Its own point here; the pattern it shares, where it is a piece of one, below.
      const p = pointOf(row)
      const pt = points[p]
      // A particle that is its own point (で, に) says what it does here,
      // in a word: the catalogue's general line is the lesson's, not a
      // breakdown's (plan 229l). One no point is written on says what the
      // sentence's shape settles, else nothing: never its part of speech
      // (plan 234e).
      const label = (!p || p === row.t) && particleLabel(s.rows, i, lang)
      main = label || (pt ? tr(pt, lang) : clauseLabel(s.rows, i, lang) || '')
      sub = label ? '' : formOf(pt, lang)
    } else {
      [main, sub] = gloss(row, lang)
      // A word the deck has no gloss for is glossed by the point written on it.
      const pt = !main && points[(row.g || []).find(q => points[q])]
      if (pt) [main, sub] = [pt[lang] || pt.en, formOf(pt, lang)]
      main = weldIf(lang, main)
      sub = weldIf(lang, sub)
    }
    return {
      i, j: i, t: row.t, reading: reading(row), ro: row.ro, main, sub, shared, fu: row.fu || [[row.t, '']],
      line: grammar ? 'grammar' : 'vocab', kanji: hasKanji(row.t),
      pos: t.pos[row.k === 'word' ? row.pos : row.k] || row.pos,
    }
  })
  // The pieces of one pattern the tokenizer cut apart (ので, とは, ものの,
  // になる) are one word of the breakdown, glossed once by the pattern:
  // never its line under each of them, nor の's "of" inside ものの. A word
  // written in kanji keeps its own gloss beside the pattern (直す of
  // 直すべきだ, 五台 of 五台も), and a run of words alone (して いない)
  // stays as it is: each word says what it means.
  const joins = it => it.shared && (it.line === 'grammar' || (!it.kanji && grammatical(s.rows[it.i])))
  const runs = []
  for (const it of items) {
    const last = runs.at(-1)
    if (last && joins(it) && joins(last[0]) && it.shared === last[0].shared && it.i === last.at(-1).j + 1) last.push(it)
    else runs.push([it])
  }
  const out = runs.flatMap(run => {
    if (run.length < 2 || run.every(x => x.line !== 'grammar')) return run
    const pt = points[run[0].shared]
    // Pieces of grammar run on (node, towa); a word stands apart (karato itte).
    const ro = run.reduce((a, x, k) => (!k ? x.ro || '' : x.line === 'grammar' && run[k - 1].line === 'grammar' ? a + (x.ro || '') : `${a} ${x.ro || ''}`), '')
    return [{
      ...run[0], j: run.at(-1).i, t: run.map(x => x.t).join(''), reading: run.map(x => x.reading).join(''), ro,
      fu: run.flatMap(x => x.fu), main: tr(pt, lang), sub: formOf(pt, lang), line: 'grammar', kanji: run.some(x => x.kanji),
    }]
  })
  return out.map((it, n) => {
    const rest = { ...it, n: n + 1 }
    delete rest.shared
    return rest
  })
}

function kanjiBonus(s, opts, kanjiMap) {
  const chars = [...new Set([...s.jp].filter(c => kanjiMap[c]?.s))]
  const focus = s.fi != null ? s.rows[s.fi] : null
  const char = (opts.kanji && chars.includes(opts.kanji) && opts.kanji)
    || [...(focus?.t || '')].find(c => chars.includes(c)) || chars[0] || null
  return { chars, char, k: char ? kanjiMap[char] : null }
}

function twistSlide(tw, lang, rowsOf) {
  if (!tw) return null
  if (tw.pair) return { kind: 'twist', notion: tr(tw.notion, lang), pair: tw.pair, why: tr(tw.why, lang) }
  if (tw.rows) return { kind: 'usage', notion: tr(tw.notion, lang), rows: rowsOf(tw.rows), tr: tr(tw.tr, lang), why: tr(tw.why, lang) }
  return null
}

/** The grammar of a sentence: the point at work, its stacked particles, the caution. */
function grammarSlides(s, bank, lang, on) {
  const pt = bank.points[s.p]
  const out = []
  if (on.grammar && pt) {
    const how = howItWorks(s.rows, s.p, tr(pt, lang), lang, firstSense(lang))
    out.push({ kind: 'point', pattern: s.p, pt, how, rows: s.rows })
  }
  if (on.grammar) for (const st of stacksIn(s.rows, lang, firstSense(lang)).slice(0, 2)) out.push({ kind: 'stack', st })
  if (on.watch && pt && (pt.careful || pt.compare)) out.push({ kind: 'watch', pattern: s.p, pt })
  return out
}

// ── What a funnel shows (plan 234) ───────────────────────────
// A conversion carousel (funnel.js) shows the analyser's tokens, the
// words one by one and a few key points besides the plan's questions:
// each point is a line the catalogue, the deck or the explainers already
// say, never one written here.
// A trap's caution often says its why again: then the why alone.
const wordsOf = x => new Set(String(x).toLowerCase().split(/[\s,.;:!?、。()「」“”]+/).filter(w => w.length > 1))
const alike = (a, b) => {
  const [x, y] = [wordsOf(a), wordsOf(b)]
  const shared = [...x].filter(w => y.has(w)).length
  return shared / Math.max(1, Math.min(x.size, y.size)) > 0.3
}
const KEYS = 3
// A key point and its kind (plan 234c): how a point works, what it means,
// its form, what to watch, what it is not to be confused with, a reading,
// a word, an example, a sound, a twin, why an answer is right. The slide
// shows each as what it is; a line of prose that says much what one before
// it said gives way to it (も: also, too. after its fuller how-it-works).
const PROSE = new Set(['use', 'mean', 'careful', 'contrast', 'why', 'note'])
function noted(pairs, lang) {
  const notes = []
  for (const [kind, raw] of pairs) {
    const text = raw ? weldIf(lang, String(raw).trim()) : ''
    if (!text || notes.some(n => n.text === text || (PROSE.has(kind) && PROSE.has(n.kind) && alike(n.text, text)))) continue
    notes.push({ kind, text })
    if (notes.length === KEYS) break
  }
  return { keys: notes.map(n => n.text), notes }
}
function sentenceKeys(s, data, lang) {
  const pt = data.points[s.p]
  const how = pt ? howItWorks(s.rows, s.p, tr(pt, lang), lang, firstSense(lang)) : null
  const stacks = stacksIn(s.rows, lang, firstSense(lang)).map(x => ['use', x.line])
  return noted([['use', how?.line], ...stacks, ['mean', pt && STRINGS[lang].keys.means(s.p, tr(pt, lang))], ['careful', tr(pt?.careful, lang)]], lang)
}
/** Rows the catalogue unpacked (a lesson's example), one by one: each
 *  word's first sense, each particle's role here, the point's meaning. */
function rowItems(rows, lang, t, p, meaning) {
  return rows.map((row, i) => ({ row, i })).filter(({ row }) => row.k !== 'punct').map(({ row, i }, n) => {
    const grammar = row.k !== 'word'
    const lit = (row.g || []).includes(p) || row.lit
    const main = grammar ? (lit && row.t !== p ? meaning : particleLabel(rows, i, lang) || (lit ? meaning : t.pos[row.k] || '')) : weldIf(lang, gloss(row, lang)[0] || (lit ? meaning : ''))
    return { i, n: n + 1, t: row.t, reading: reading(row), ro: row.ro, main, sub: '', line: grammar ? 'grammar' : 'vocab', kanji: hasKanji(row.t), pos: t.pos[row.k === 'word' ? row.pos : row.k] || row.pos || '' }
  })
}
/** The analyser's tokens for rows the catalogue lit for point `p`. */
const litToks = (rows, p) => rows.map(r => ({ t: r.t, fu: r.fu && hasKanji(r.t) ? reading(r) : '', k: r.k, point: (r.g || []).includes(p) || r.lit ? 1 : 0 }))
/** A sentence as kana, its punctuation kept. */
const kanaOf = rows => rows.map(r => (r.k === 'punct' ? r.t : reading(r))).join('')
const wordRowsOf = list => list.map((w, n) => ({ n: n + 1, t: w.t, reading: w.r || '', ro: w.ro || '', main: w.main, line: 'vocab' }))

function base(source, item, opts, level) {
  const t = STRINGS[opts.lang]
  return {
    source: source.id, line: source.line, lang: opts.lang, t, level,
    script: opts.script, showRomaji: opts.romaji, handle: opts.handle || '', id: item.id,
    station: stationOf(source.id, opts.lang), map: mapOf(source.id), figure: weldIf(opts.lang, figureOf(source.id, opts.figures, t, opts.lang)),
    compare: null, build: null, list: null, talk: null,
  }
}
const on = (source, opts) => Object.fromEntries((OPTIONAL[source] || []).map(([k, d]) => [k, opts.slides?.[source]?.[k] ?? d]))

// ── What the other carousel types are drawn from ──────────────
/** A sentence cut into the pieces it is said in: each word with what
 *  rides it (駅で, 友だちに, 会います。), six at most, the shortest
 *  neighbours merged first. */
export function chunksOf(rows) {
  const out = []
  rows.forEach((r, i) => {
    const last = out[out.length - 1]
    if (!last || (r.k === 'word' && last.some(j => rows[j].k === 'word'))) out.push([i])
    else last.push(i)
  })
  const len = c => c.reduce((a, j) => a + rows[j].t.length, 0)
  while (out.length > 6) {
    let best = 0
    for (let i = 1; i < out.length - 1; i++) if (len(out[i]) + len(out[i + 1]) < len(out[best]) + len(out[best + 1])) best = i
    out.splice(best, 2, [...out[best], ...out[best + 1]])
  }
  return out
}
/** Build it: the sentence piece by piece, each piece's words with what
 *  each does, and where the point is, the line that says it. */
function buildOf(rows, translation, how, p, lang, glossOf, pointLabel = () => '') {
  const chunks = chunksOf(rows)
  if (chunks.length < 2) return null
  // A particle that is a piece of a longer pattern (the の and で of ので)
  // is that pattern, labelled by its meaning, never a possessive.
  const patternOf = r => (r.k === 'word' ? null : (r.g || []).find(x => x !== r.t && !ROLES[x]) || (r.lit && p !== r.t && !ROLES[p] ? p : null))
  // A label short enough to stand under its piece.
  // A gloss to its first sense; a long one cut at a word, never inside one
  // ("asking to be given someth…": plan 248), and only past 32 letters.
  const short = s => {
    const head = String(s || '').split(/[,;:(]/)[0].trim()
    if (head.length <= 32) return head
    const cut = head.slice(0, 32).replace(/\s+\S*$/, '').replace(/[\s,.;:–-]+$/, '')
    return `${cut || head.slice(0, 31)}…`
  }
  const steps = chunks.map(c => {
    const items = []
    for (const j of c) {
      const r = rows[j]
      if (r.k === 'punct') continue
      const pat = patternOf(r)
      const last = items[items.length - 1]
      if (pat && last?.pat === pat) { last.t += r.t; continue }
      const label = r.k === 'word' ? glossOf(r) : pat ? pointLabel(pat) : ROLES[r.t]?.label?.[lang] || ''
      items.push({ t: r.t, label: short(label), line: r.k === 'word' ? 'vocab' : 'grammar', lit: true, pat })
    }
    const point = c.some(j => (rows[j].g || []).includes(p) || rows[j].lit)
    return { upto: c[c.length - 1] + 1, from: c[0], items, line: point && how ? how.line : '' }
  })
  return { rows, translation, steps, romaji: lineRomaji(rows) }
}
/** This or that: a point and the point it is confused with. */
function compareOfPoint(p, pt, own, lang) {
  const cmp = pt?.compare
  if (!cmp?.meaning || !cmp.p) return null
  const a = { head: p, meaning: tr(pt, lang), form: formOf(pt, lang), ex: own, line: 'grammar' }
  const b = {
    head: cmp.p, meaning: tr(cmp.meaning, lang), form: lang === 'fr' ? cmp.form_fr || '' : cmp.form || '',
    ex: cmp.ex ? { rows: unpack(cmp.ex.rows), tr: weldIf(lang, cmp.ex[lang] || cmp.ex.en) } : null, line: 'grammar',
  }
  if (overlaps(a.meaning, b.meaning) || a.meaning === b.meaning) return null
  return { sides: [a, b], diff: tr(cmp, lang), careful: tr(pt.careful, lang) }
}
/** The question a "this or that" ends on: what the second one means, the
 *  first one's meaning among the wrong answers. */
function compareQuiz(cmp, pool, seed, t) {
  const [a, b] = cmp.sides
  const wrong = []
  for (const m of shuffle([...new Set(pool)], seeded(seed))) {
    if (!m || [a.meaning, b.meaning, ...wrong].some(x => overlaps(x, m))) continue
    wrong.push(m)
    if (wrong.length === 2) break
  }
  if (wrong.length < 2) return null
  const all = shuffle([b.meaning, a.meaning, ...wrong], seeded(`${seed}-c`))
  return {
    kind: 'compare', id: 'compare', label: t.kinds.pointMeaning, ask: t.examAsk.pointMeaning, stem: { specimen: b.head },
    choices: all.map(text => ({ text, fam: 'latin' })), right: all.indexOf(b.meaning),
    explain: { head: b.head, sense: b.form, why: cmp.diff },
  }
}
const wordItem = (w, lang, n) => ({ kind: 'word', n, head: w.t, reading: w.r, ro: w.ro, fu: w.fu, main: weldIf(lang, gloss(w, lang)[0]), tag: w.lv || '' })

// ── 読書, a sentence to read ──────────────────────────────────
function sentenceParts(data, s, opts, p) {
  const { t, lang } = p
  const translation = weldIf(lang, s[lang] || s.en)
  const pt = data.points[s.p]
  const how = pt ? howItWorks(s.rows, s.p, tr(pt, lang), lang, firstSense(lang)) : null
  const same = [s, ...data.sentences.filter(x => x.p === s.p && x.id !== s.id)].slice(0, 5)
  return {
    translation,
    romaji: lineRomaji(s.rows),
    bonus: kanjiBonus(s, opts, data.kanji),
    compare: compareOfPoint(s.p, pt, { rows: s.rows.map(r => ((r.g || []).includes(s.p) ? { ...r, lit: true } : r)), tr: translation }, lang),
    build: buildOf(s.rows, translation, how, s.p, lang, r => gloss(r, lang)[0], q => tr(data.points[q], lang)),
    list: same.length >= 3 ? {
      title: t.listTitle.sentences(same.length, s.p), head: s.p, line: 'grammar',
      items: same.map((x, n) => ({ kind: 'sentence', n: n + 1, rows: x.rows.map(r => ((r.g || []).includes(s.p) ? { ...r, lit: true } : r)), tr: weldIf(lang, x[lang] || x.en) })),
    } : null,
    more: same.slice(1, 4).map(x => ({ rows: x.rows.map(r => ((r.g || []).includes(s.p) ? { ...r, lit: true } : r)), tr: weldIf(lang, x[lang] || x.en) })),
  }
}
function closing(slides, o, t, p, extra = {}) {
  if (o.yourturn && extra.yourturn) slides.push(extra.yourturn)
  if (o.check) slides.push({ kind: 'check' })
  if (o.rating) slides.push({ kind: 'rating' })
  if (o.outro) slides.push({ kind: 'outro' })
  return slides
}

function sentenceFunnel(data, s, x, { t, lang }) {
  return {
    rows: s.rows, translation: x.translation, romaji: x.romaji, ...analysed(s, data, lang),
    breakdown: wordItems(s, data.points, lang, t), examples: x.more, ...sentenceKeys(s, data, lang),
    strokes: x.bonus.k ? { char: x.bonus.char, k: x.bonus.k } : null,
    // Read it's bonus, the sentence said the other way (plan 254).
    version: s.v || null,
  }
}

function sentencePlan(data, s, opts) {
  const src = sourceOf('sentence')
  const p = base(src, s, opts, s.lv)
  const { t, lang } = p
  const o = on('sentence', opts)
  const x = sentenceParts(data, s, opts, p)
  const slides = []
  if (o.words) slides.push({ kind: 'words', items: wordItems(s, data.points, lang, t) })
  slides.push(...grammarSlides(s, data, lang, o))
  if (o.more && x.more.length) slides.push({ kind: 'examples', items: x.more, title: t.listTitle.sentences(x.more.length, s.p).replace(/^\d+ /, '') })
  slides.push({ kind: 'answer', rows: s.rows, romaji: x.romaji, translation: x.translation })
  if (opts.bonus === 'kanji' && x.bonus.k) slides.push({ kind: 'strokes', char: x.bonus.char, k: x.bonus.k })
  if (opts.bonus === 'twist') {
    const tw = data.points[s.p]?.twists?.[0]
    if (tw) slides.push({ kind: 'twist', notion: tr(tw.notion, lang), pair: tw.pair, why: tr(tw.why, lang) })
  }
  closing(slides, o, t, p, { yourturn: { kind: 'yourturn', text: t.turn.point(s.p), form: formOf(data.points[s.p], lang), model: { rows: s.rows, tr: x.translation } } })
  const quizzes = sentenceQuizzes(s, data, lang, t)
  const compare = x.compare ? { ...x.compare, quiz: compareQuiz(x.compare, Object.values(data.points).map(v => tr(v, lang)), s.id, t) } : null
  return {
    ...p, kanjiChars: x.bonus.chars, kanjiChar: x.bonus.char,
    hook: { kind: 'sentence', rows: s.rows }, prompt: t.prompt.sentence,
    quizzes, quiz: quizzes[0] || null, slides, compare, build: x.build, list: x.list,
    funnel: sentenceFunnel(data, s, x, p),
    caption: { jp: s.jp, kana: kanaOf(s.rows), romaji: x.romaji, tr: x.translation, ask: lang === 'fr' ? 'Tu l’as lue sans aide ?' : 'Could you read it without help?', tags: [`jlpt${s.lv.toLowerCase()}`], point: s.p },
  }
}

// ── 短文, Read it's own sentences (plan 254) ──────────────────
// A noun, a particle and a verb or adjective, read in kana unless the
// studio asks for the kanji's furigana: the words glossed from the deck
// (the sense the sentence means, content/short.json's pick), the
// particle by its role here, and the sentence said politely.
function shortPlan(data, s, opts) {
  const src = sourceOf('short')
  const p = base(src, s, { ...opts, script: opts.script === 'furigana' ? 'furigana' : 'kana' }, s.lv)
  const { t, lang } = p
  const translation = weldIf(lang, s[lang] || s.en)
  const breakdown = s.rows.map((row, i) => ({ row, i })).filter(({ row }) => row.k !== 'punct').map(({ row, i }, n) => {
    const [main, sub] = row[`g${lang}`] || row.gen || ['', '']
    return {
      i, j: i, n: n + 1, t: row.t, reading: reading(row), ro: row.ro, main: weldIf(lang, main), sub: weldIf(lang, sub), fu: row.fu || [[row.t, '']],
      line: row.k === 'word' ? 'vocab' : 'grammar', kanji: hasKanji(row.t), pos: t.pos[row.k === 'word' ? row.pos : row.k] || row.pos || '',
    }
  })
  const romaji = lineRomaji(s.rows)
  return {
    ...p, emoji: s.e,
    hook: { kind: 'sentence', rows: s.rows }, prompt: t.prompt.sentence,
    quizzes: [], quiz: null, slides: [],
    funnel: { rows: s.rows, translation, romaji, breakdown, lit: s.lit ? weldIf(lang, tr(s.lit, lang)) : '', version: s.v },
    caption: { jp: s.jp, kana: kanaOf(s.rows), romaji, tr: translation, ask: t.modes.read, tags: ['jlptn5'] },
  }
}

// ── 翻訳, the same sentence to say ────────────────────────────
function translationPlan(data, s, opts) {
  const src = sourceOf('translation')
  const p = base(src, s, opts, s.lv)
  const { t, lang } = p
  const o = on('translation', opts)
  const x = sentenceParts(data, s, opts, p)
  // The words to build it from, as tiles, in a seeded disorder.
  const tiles = shuffle(s.rows.filter(r => r.k !== 'punct'), seeded(`${s.id}-tiles`))
  const slides = [{ kind: 'answer', rows: s.rows, romaji: x.romaji, translation: x.translation, title: t.answer }]
  if (o.words) slides.push({ kind: 'words', items: wordItems(s, data.points, lang, t) })
  slides.push(...grammarSlides(s, data, lang, o))
  if (o.more && x.more.length) slides.push({ kind: 'examples', items: x.more, title: t.listTitle.sentences(x.more.length, s.p).replace(/^\d+ /, '') })
  if (opts.bonus === 'kanji' && x.bonus.k) slides.push({ kind: 'strokes', char: x.bonus.char, k: x.bonus.k })
  if (opts.bonus === 'twist') {
    const tw = data.points[s.p]?.twists?.[0]
    if (tw) slides.push({ kind: 'twist', notion: tr(tw.notion, lang), pair: tw.pair, why: tr(tw.why, lang) })
  }
  closing(slides, o, t, p, { yourturn: { kind: 'yourturn', text: t.turn.point(s.p), form: formOf(data.points[s.p], lang), model: { rows: s.rows, tr: x.translation } } })
  const quizzes = translationQuizzes(s, data, lang, t)
  const compare = x.compare ? { ...x.compare, quiz: compareQuiz(x.compare, Object.values(data.points).map(v => tr(v, lang)), s.id, t) } : null
  return {
    ...p, kanjiChars: x.bonus.chars, kanjiChar: x.bonus.char,
    hook: { kind: 'prompt', text: x.translation, tiles }, prompt: t.prompt.translation,
    quizzes, quiz: quizzes[0] || null, slides, compare, build: x.build, list: x.list,
    funnel: sentenceFunnel(data, s, x, p),
    caption: { jp: x.translation, romaji: '', tr: '', ask: t.turn.translation, tags: [`jlpt${s.lv.toLowerCase()}`], point: s.p, answerJp: s.jp },
  }
}

// ── 文法, a grammar lesson and its tour ───────────────────────
function lessonPlan(data, L, opts) {
  const src = sourceOf('lesson')
  const p = base(src, { id: L.p }, opts, L.lv)
  const { t, lang } = p
  const o = on('lesson', opts)
  const meaning = tr(L, lang)
  const ex = (L.ex || []).map(e => ({ rows: unpack(e.rows), tr: weldIf(lang, e[lang] || e.en) }))
  const first = ex[0]
  const how = first ? howItWorks(first.rows, L.p, meaning, lang, () => '') : null
  const scene = L.scene
  const quizzes = lessonQuizzes(L, data, lang, t)
  const sceneQuiz = quizzes.find(q => q.kind === 'scene') || null
  const twists = (L.twists || []).map(tw => twistSlide(tw, lang, unpack)).filter(Boolean)
  const usages = (L.twists || []).filter(tw => tw.rows).map(tw => ({ rows: unpack(tw.rows), tr: tr(tw.tr, lang), note: tr(tw.notion, lang) }))
  const sceneSlide = scene ? {
    kind: 'scene', place: scene.place, them: tr(scene.them, lang), note: tr(scene.note, lang),
    lines: scene.lines.map(l => ({ who: l.who, rows: unpack(l.rows), tr: weldIf(lang, l[lang] || l.en) })),
  } : null
  const compare = compareOfPoint(L.p, L, first, lang)
  const slides = [{ kind: 'lesson', pattern: L.p, pt: L, how }]
  if (o.examples && ex.length) slides.push({ kind: 'examples', items: ex })
  if (o.scene && sceneSlide) {
    slides.push(sceneSlide)
    if (sceneQuiz) slides.push({ kind: 'quiz', quiz: sceneQuiz, revealed: false, title: t.sceneAsk }, { kind: 'quiz', quiz: sceneQuiz, revealed: true, title: t.sceneAsk })
  }
  if (o.twist && twists[0]) slides.push(twists[0])
  if (o.usage && twists[1]) slides.push(twists[1])
  if (o.rival && compare?.sides[1].ex) slides.push({ kind: 'examples', items: [compare.sides[1].ex], title: t.withIt(compare.sides[1].head), line: 'grammar' })
  if (o.watch && (L.careful || L.compare)) slides.push({ kind: 'watch', pattern: L.p, pt: L })
  closing(slides, o, t, p, { yourturn: { kind: 'yourturn', text: t.turn.point(L.p), form: formOf(L, lang), model: ex[1] || first } })
  const sentences = [...ex, ...usages].slice(0, 5)
  const form = formOf(L, lang)
  const funnel = {
    rows: first?.rows || [], translation: first?.tr || '', romaji: first ? lineRomaji(first.rows) : '',
    toks: first ? litToks(first.rows, L.p) : [],
    points: [{ n: 1, pattern: L.p.split('／')[0], level: L.lv, gloss: meaning, parts: (first?.rows || []).filter(r => (r.g || []).includes(L.p)).map(r => [r.t, 1]) }],
    breakdown: first ? rowItems(first.rows, lang, t, L.p, meaning) : [],
    examples: [...ex.slice(1), ...usages].slice(0, 3),
    point: { pattern: L.p, meaning, form },
    ...noted([['use', how?.line], ['mean', t.keys.means(L.p, meaning)], ['form', form && t.keys.form(form)], ['careful', tr(L.careful, lang)], ['contrast', compare?.diff]], lang),
  }
  return {
    ...p, hook: { kind: 'pattern', pattern: L.p, rows: first?.rows || [], meaning }, prompt: t.prompt.lesson, funnel,
    quizzes, quiz: quizzes[0] || null, slides,
    compare: compare ? { ...compare, quiz: compareQuiz(compare, data.lessons.map(x => tr(x, lang)), L.p, t) || sceneQuiz } : null,
    build: first ? buildOf(first.rows, first.tr, how, L.p, lang, () => '', q => (q === L.p ? meaning : '')) : null,
    list: sentences.length >= 3 ? {
      title: t.listTitle.sentences(sentences.length, L.p), head: L.p, line: 'grammar',
      items: sentences.map((x, n) => ({ kind: 'sentence', n: n + 1, rows: x.rows, tr: x.tr, note: x.note || '' })),
    } : null,
    talk: sceneSlide && sceneSlide.lines.length >= 2 ? { ...sceneSlide, quiz: sceneQuiz, why: sceneQuiz?.explain?.why || '' } : null,
    caption: { jp: L.p, romaji: '', tr: meaning, ask: t.turn.point(L.p), tags: [`jlpt${L.lv.toLowerCase()}`], point: L.p },
  }
}

// ── 単語, a word of the deck ───────────────────────────────────
/** A deck word's id: its written form, and its reading where another
 *  entry is written the same (一日 ついたち, 一日 いちにち: plan 229l). */
export function wordId(data, w) {
  return wordIds(data).ids.get(w)
}
const wordOf = (data, id) => wordIds(data).byId.get(id)
// Counted once per file: a deck has thousands of words.
const WORD_IDS = new WeakMap()
function wordIds(data) {
  if (!WORD_IDS.has(data)) {
    const count = {}
    for (const w of data.words) count[w.t] = (count[w.t] || 0) + 1
    const ids = new Map(data.words.map(w => [w, count[w.t] > 1 ? `${w.t}（${w.r}）` : w.t]))
    WORD_IDS.set(data, { ids, byId: new Map([...ids].map(([w, id]) => [id, w])) })
  }
  return WORD_IDS.get(data)
}
function wordPlan(data, w, opts, deps) {
  const src = sourceOf('word')
  const p = base(src, { id: wordId(data, w) }, opts, data.level)
  const { t, lang } = p
  const o = on('word', opts)
  const index = deps.index?.kanji || {}
  const [main, sub] = gloss(w, lang)
  const slides = [{ kind: 'reveal', text: w.t, fu: w.fu, reading: w.r, romaji: w.ro, main: weldIf(lang, main), sub: weldIf(lang, sub), level: data.level }]
  const chars = [...w.t].filter(c => index[c])
  // A compound's kanji, one by one (学校: 学 + 校); a one-kanji word is its kanji.
  if (o.parts && chars.length > 1) {
    const readingIn = c => (w.fu || []).find(([seg]) => seg === c)?.[1] || ''
    slides.push({
      kind: 'words', title: t.parts, line: 'kanji',
      items: chars.map((c, n) => ({ n: n + 1, t: c, reading: readingIn(c), ro: '', main: weldIf(lang, (lang === 'fr' && index[c].fr?.length ? index[c].fr : index[c].en).slice(0, 2).join(', ')), sub: index[c].lv, line: 'kanji', kanji: !!readingIn(c), pos: index[c].lv })),
    })
  }
  const exItems = (w.ex || []).map(id => deps.sentences?.[id]).filter(Boolean).map(s => ({
    rows: s.rows.map(r => ((r.t === w.t || r.lemma?.[0] === w.t) ? { ...r, lit: true } : r)),
    tr: weldIf(lang, s[lang] || s.en),
  }))
  if (o.examples && exItems.length) slides.push({ kind: 'examples', items: exItems, title: t.inSentence, line: 'vocab' })
  // Other words written with its first kanji: the family it opens.
  const famChar = chars.find(c => deps.strokes?.[c]?.words?.some(x => x.t !== w.t))
  const family = famChar ? [w, ...deps.strokes[famChar].words.filter(x => x.t !== w.t)].slice(0, 5) : []
  if (o.family && family.length > 1) {
    slides.push({
      kind: 'words', title: t.listTitle.words(family.length, famChar), line: 'vocab',
      items: family.map((x, n) => ({ n: n + 1, t: x.t, reading: x.r, ro: x.ro, main: weldIf(lang, gloss(x, lang)[0]), sub: x.lv || '', line: 'vocab', kanji: true, pos: x.lv || '' })),
    })
  }
  const strokeChar = chars.find(c => deps.strokes?.[c]?.s)
  if (o.strokes && strokeChar) slides.push({ kind: 'strokes', char: strokeChar, k: deps.strokes[strokeChar] })
  closing(slides, o, t, p, { yourturn: { kind: 'yourturn', text: t.turn.word(w.t) } })
  // The words that share its kanji: its level's first, then its family's,
  // none far above it (購買, N1, for 買う, N5).
  const rank = x => Number(String(x || 'N0').slice(1))
  const near = x => !x.lv || rank(x.lv) >= rank(data.level) - 2
  const kin = [...data.words.filter(x => x.t !== w.t && [...x.t].some(c => chars.includes(c))), ...family.slice(1).filter(x => near(x) && !data.words.some(y => y.t === x.t))]
  const quizzes = wordQuizzes(w, data, lang, t, index, kin)
  const spelling = spellingQuizzes(w, data, lang, t)
  const meaningOf = c => weldIf(lang, (lang === 'fr' && index[c].fr?.length ? index[c].fr : index[c].en)[0] || '')
  const ex0 = exItems[0]
  const funnel = {
    word: { t: w.t, fu: w.fu, reading: w.r, ro: w.ro, main: weldIf(lang, main), sub: weldIf(lang, sub), level: data.level },
    examples: exItems.slice(0, 3),
    words: wordRowsOf(family.slice(1, 5).map(x => ({ ...x, main: weldIf(lang, gloss(x, lang)[0]) }))),
    ...noted([
      ['reading', w.t !== w.r && t.keys.reads(w.t, w.r, w.ro)],
      ['mean', main && t.keys.means(w.t, [main, sub].filter(Boolean).join('; '))],
      chars.length > 1 ? ['parts', t.keys.parts(chars.map(c => `${c} (${meaningOf(c)})`).join(' + '))] : ['example', ex0 && t.keys.example(ex0.rows.map(r => r.t).join(''), ex0.tr)],
    ], lang),
    strokes: strokeChar ? { char: strokeChar, k: deps.strokes[strokeChar] } : null,
  }
  return {
    ...p, hook: { kind: 'specimen', text: w.t }, prompt: t.prompt.word, quizzes, quiz: quizzes[0] || null, slides, funnel,
    spelling: spelling.length ? spelling : null,
    list: family.length >= 3 ? { title: t.listTitle.words(family.length, famChar), head: famChar, line: 'vocab', items: family.map((x, n) => wordItem(x, lang, n + 1)) } : null,
    caption: { jp: `${w.t}（${w.r}）`, romaji: w.ro, tr: weldIf(lang, main), ask: t.prompt.word, tags: [`jlpt${data.level.toLowerCase()}`, 'vocabulary'] },
  }
}

// ── 漢字, a kanji ─────────────────────────────────────────────
function kanjiPlan(data, c, opts) {
  const src = sourceOf('kanji')
  const k = data.kanji[c]
  const p = base(src, { id: c }, opts, data.level)
  const { t, lang } = p
  const o = on('kanji', opts)
  const meaning = weldIf(lang, ((lang === 'fr' && k.fr?.length ? k.fr : k.en) || []).slice(0, 3).join(', '))
  const slides = []
  if (o.readings) slides.push({ kind: 'readings', char: c, on: k.on, kun: k.kun, meaning, level: k.lv })
  if (o.words && k.words?.length) {
    slides.push({
      kind: 'words', title: t.inWords,
      items: k.words.map((w, n) => ({ n: n + 1, t: w.t, reading: w.r, ro: w.ro, main: weldIf(lang, gloss(w, lang)[0]), sub: w.lv, line: 'vocab', kanji: true, pos: w.lv })),
    })
  }
  if (o.strokes && k.s) slides.push({ kind: 'strokes', char: c, k })
  closing(slides, o, t, p, { yourturn: { kind: 'yourturn', text: t.turn.kanji(c) } })
  const quizzes = kanjiQuizzes(c, data, lang, t)
  const kw = (k.words || []).map(w => ({ ...w, main: weldIf(lang, gloss(w, lang)[0]) }))
  // A word the kanji makes with others says more than the kanji alone.
  const shown = kw.find(w => w.t !== c) || kw[0]
  const funnel = {
    kanji: { c, on: k.on || [], kun: (k.kun || []).map(([a, b]) => a + b), meaning, level: k.lv },
    words: wordRowsOf(kw.slice(0, 4)),
    ...noted([
      ['reading', k.on?.length && t.keys.on(k.on.slice(0, 3).join('、'))],
      ['reading', k.kun?.length && t.keys.kun(k.kun.slice(0, 3).map(([a, b]) => a + b).join('、'))],
      ['word', shown && t.keys.inWord(shown.t, shown.r, shown.main)],
    ], lang),
    strokes: k.s ? { char: c, k } : null,
  }
  return {
    ...p, hook: { kind: 'specimen', text: c }, prompt: t.prompt.kanji, quizzes, quiz: quizzes[0] || null, slides, funnel,
    list: (k.words || []).length >= 3 ? { title: t.listTitle.words(k.words.length, c), head: c, line: 'kanji', items: k.words.map((w, n) => wordItem(w, lang, n + 1)) } : null,
    caption: { jp: c, romaji: '', tr: meaning, ask: t.prompt.kanji, tags: [`jlpt${data.level.toLowerCase()}`, 'kanji'] },
  }
}

// ── かな, a kana ──────────────────────────────────────────────
function kanaPlan(data, card, opts) {
  const src = sourceOf('kana')
  const p = base(src, { id: card.k }, opts, card.set)
  const { t, lang } = p
  const o = on('kana', opts)
  const byKana = Object.fromEntries(data.kana.map(x => [x.k, x]))
  const group = lookalikesOf(card.k)
  const slides = [{ kind: 'kanareveal', k: card.k, ro: card.ro, twin: card.twin, set: card.set }]
  if (o.strokes && card.s) slides.push({ kind: 'strokes', char: card.k, k: { s: card.s, on: [], kun: [], en: [], fr: [] }, kana: true })
  if (o.lookalike && group) {
    slides.push({ kind: 'lookalike', items: group.set.map(k => ({ k, ro: byKana[k]?.ro || '', s: byKana[k]?.s })), tip: tr(group.tip, lang), here: card.k })
  }
  if (o.words && card.words?.length) {
    slides.push({
      kind: 'words', title: t.inWords,
      items: card.words.map((w, n) => ({ n: n + 1, t: w.t, reading: w.r, ro: w.ro, main: weldIf(lang, gloss(w, lang)[0]), sub: '', line: 'vocab', kanji: hasKanji(w.t), pos: '' })),
    })
  }
  closing(slides, o, t, p)
  const quizzes = kanaQuizzes(card, data, lang, t)
  // This or that: the kana it is mistaken for, side by side.
  const compare = group ? {
    sides: group.set.filter(k => byKana[k]).slice(0, 3).map(k => ({
      head: k, sub: byKana[k].ro, line: 'kana', here: k === card.k,
      words: (byKana[k].words || []).slice(0, 2).map(w => ({ t: w.t, r: w.r, main: weldIf(lang, gloss(w, lang)[0]) })),
    })),
    diff: tr(group.tip, lang), careful: '',
    quiz: quizzes.find(q => q.kind === 'kanaReverse') || null,
  } : null
  const funnel = {
    kana: { k: card.k, ro: card.ro, twin: card.twin, set: card.set },
    words: wordRowsOf((card.words || []).slice(0, 4).map(w => ({ ...w, main: weldIf(lang, gloss(w, lang)[0]) }))),
    lookalike: group ? group.set.filter(k => byKana[k]).map(k => ({ k, ro: byKana[k].ro })) : null,
    ...noted([
      ['sound', t.keys.sound(card.k, card.ro)], ['twin', card.twin && t.keys.twin(card.set, card.twin)], ['contrast', group && tr(group.tip, lang)],
      ['word', card.words?.[0] && t.keys.inWord(card.words[0].t, card.words[0].r, gloss(card.words[0], lang)[0])],
    ], lang),
    strokes: card.s ? { char: card.k, k: { s: card.s } } : null,
  }
  return {
    ...p, hook: { kind: 'specimen', text: card.k }, prompt: t.prompt.kana, quizzes, quiz: quizzes[0] || null, slides, funnel,
    compare: compare && compare.sides.length >= 2 ? compare : null,
    list: (card.words || []).length >= 3 ? { title: t.listTitle.kana(card.words.length, card.k), head: card.k, line: 'kana', items: card.words.map((w, n) => wordItem(w, lang, n + 1)) } : null,
    caption: { jp: card.k, romaji: card.ro, tr: '', ask: t.prompt.kana, tags: [card.set] },
  }
}

// ── 理解, a passage to understand ──────────────────────────────
function passagePlan(data, P, opts) {
  const src = sourceOf('passage')
  const p = base(src, P, opts, P.lv)
  const { t, lang } = p
  const o = on('passage', opts)
  const sents = P.sents.map(unpack)
  const words = (P.words || []).map((w, n) => wordItem(w, lang, n + 1))
  const slides = []
  if (o.vocab && words.length) {
    slides.push({ kind: 'words', title: t.listTitle.passage(words.length), line: 'vocab',
      items: words.map(w => ({ n: w.n, t: w.head, reading: w.reading, ro: w.ro, main: w.main, sub: w.tag, line: 'vocab', kanji: true, pos: w.tag })) })
  }
  slides.push({ kind: 'passage', sents, title: P.title })
  closing(slides, o, t, p)
  const quizzes = passageQuizzes(P, lang, t)
  const funnel = {
    title: P.title, sents,
    words: wordRowsOf(words.slice(0, 4).map(w => ({ t: w.head, r: w.reading, ro: w.ro, main: w.main }))),
    ...noted(words.slice(0, KEYS).map(w => ['word', t.keys.means(`${w.head} (${w.reading})`, w.main)]), lang),
  }
  return {
    ...p, hook: { kind: 'specimen', text: P.title, small: true }, prompt: t.prompt.passage, funnel,
    quizzes, quiz: quizzes[0] || null, slides,
    list: words.length >= 3 ? { title: t.listTitle.passage(words.length), head: P.title, line: 'vocab', items: words } : null,
    caption: { jp: P.title, romaji: '', tr: quizzes[0]?.ask || '', ask: t.prompt.passage, tags: [`jlpt${P.lv.toLowerCase()}`, 'reading'] },
  }
}

// ── 単語帳, a theme in pictures (plan 229m) ──────────────────────
// A theme's words, easiest first, the ones the app has a picture for,
// eight at most to a post.
const PICTURES = 8
/** A theme's pictured words cut into posts, evenly (plan 229n): nine
 *  pictures are posts of five and four, never of eight and one. */
function themeParts(th) {
  const pics = th.words.filter(w => w.t !== th.head.t && w.e)
  // Cut evenly: k posts of n/k each, never a short last one dropped (plan 248).
  const k = Math.max(1, Math.ceil(pics.length / PICTURES))
  return Array.from({ length: k }, (_, i) => pics.slice(Math.round((i * pics.length) / k), Math.round(((i + 1) * pics.length) / k))).filter(x => x.length >= 4)
}
/** A theme's item id: its key, and `~2`, `~3` … for its later posts. */
export const themePartOf = id => {
  const [key, n] = String(id).split('~')
  return { key, part: Number(n || 1) }
}
const rankOf = lv => Number(String(lv || 'N0').slice(1))
/** The theme a round of 仲間外れ takes its impostor from: one no word
 *  of the theme could be mistaken for. */
const IMPOSTOR_FROM = {
  fruits: 'vegetables', vegetables: 'fruits', body_parts: 'clothing', buildings: 'vehicles', travel: 'body_parts',
  jobs: 'animals', dishes: 'drinks', animals: 'plants_trees', colors: 'weather', clothing: 'tools', weather: 'colors',
  emotions: 'body_parts', nature: 'buildings', vehicles: 'buildings', technology: 'plants_trees', sports: 'music',
  music: 'sports', office_supplies: 'drinks', shopping_money: 'weather', insects_bugs: 'birds', birds: 'insects_bugs',
  seafood: 'birds', drinks: 'dishes', tools: 'clothing', medical: 'holidays_events', plants_trees: 'animals',
  household_items: 'animals', holidays_events: 'weather',
  kitchen_items: 'animals', furniture: 'insects_bugs', rooms: 'seafood', shapes: 'animals', materials: 'emotions', family: 'tools',
}
// Words more than one theme can claim (a tomato is a fruit to a
// botanist, a heart is a body part and a feeling): never in a round.
const EITHER = new Set(['tomato', 'cucumber', 'eggplant', 'green pepper', 'pumpkin', 'corn', 'avocado', 'zucchini', 'okra', 'chestnut', 'soup', 'miso soup', 'rainbow', 'heart'])
const ROUNDS = 3
const pictureOf = (w, lang) => ({ t: w.t, r: w.r, ro: w.ro, fu: furiganaOf(w.t, w.r), main: weldIf(lang, gloss(w, lang)[0]), e: w.e || '', lv: w.lv || '' })

/** 仲間外れ: rounds of five words of the theme and one from another;
 *  each of a theme's posts deals its own (`seed`). */
function impostorOf(data, key, lang, t, seed = key, pictured = false) {
  const th = data.themes[key]
  const other = data.themes[IMPOSTOR_FROM[key]]
  if (!other) return null
  // A round drawn as pictures (plan 234) deals pictured words only.
  const plain = w => ['basic', 'medium'].includes(w.band) && !(w.en || []).some(g => EITHER.has(g)) && (!pictured || w.e)
  const mine = th.words.filter(w => w.t !== th.head.t && plain(w))
  const own = new Set(th.words.map(w => w.t))
  const senses = th.words.flatMap(w => w.en || [])
  const theirs = other.words.filter(w => w.t !== other.head.t && plain(w) && !own.has(w.t) && !(w.en || []).some(g => senses.some(h => overlaps(g, h))))
  const rounds = Math.min(ROUNDS, Math.floor(mine.length / 5), theirs.length)
  if (!rounds) return null
  const five = shuffle(mine, seeded(`${seed}-five`))
  const odd = shuffle(theirs, seeded(`${seed}-odd`))
  const name = th.name[lang] || th.name.en
  const otherName = other.name[lang] || other.name.en
  return {
    name, other: otherName,
    rounds: Array.from({ length: rounds }, (_, r) => {
      const imp = odd[r]
      const words = shuffle([...five.slice(r * 5, r * 5 + 5), imp], seeded(`${seed}-round-${r}`)).map(w => pictureOf(w, lang))
      const at = words.findIndex(w => w.t === imp.t)
      return { words, at, why: weldIf(lang, t.modes.impostorWhy(imp.t, words[at].main, otherName)) }
    }),
  }
}

function themePlan(data, id, opts) {
  const src = sourceOf('theme')
  const { key, part } = themePartOf(id)
  const th = data.themes[key]
  const lang = opts.lang
  const parts = themeParts(th)
  const items = (parts[part - 1] || parts[0]).map(w => pictureOf(w, lang))
  // Its level is the hardest of the words it shows.
  const lvs = items.map(w => w.lv).filter(Boolean)
  const p = base(src, { id }, opts, lvs.length ? `N${Math.min(...lvs.map(rankOf))}` : 'N5')
  const { t } = p
  const o = on('theme', opts)
  // A theme of several posts names each by its number: Fruits (2).
  const name = parts.length > 1 ? `${th.name[lang] || th.name.en} (${part})` : th.name[lang] || th.name.en
  const slides = items.map((w, i) => ({ kind: 'picture', w, n: i + 1, of: items.length, title: name }))
  if (o.recap && items.length > 1) slides.push({ kind: 'picturegrid', items, title: t.recap })
  closing(slides, o, t, p)
  const quizzes = pictureQuizzes(items, id, lang, t)
  const headRo = th.words.find(w => w.t === th.head.t)?.ro || ''
  const funnel = {
    pictures: items,
    // The impostor's rounds again, of pictured words alone: the funnel draws them as pictures.
    impostor: impostorOf(data, key, lang, t, id, true),
    ...noted(items.slice(0, KEYS).map(w => ['word', t.keys.means(`${w.e} ${w.t}${hasKanji(w.t) ? ` (${w.r})` : ''}`, w.main)]), lang),
  }
  return {
    ...p, cta: t.cta.theme, funnel,
    hook: { kind: 'emojigrid', emoji: items.slice(0, 9).map(w => w.e), head: th.head.t, reading: th.head.r, title: t.modes.themeHook(name, items.length) },
    prompt: t.prompt.theme, quizzes, quiz: quizzes[0] || null, slides,
    impostor: impostorOf(data, key, lang, t, id),
    caption: { jp: `${th.head.t}（${th.head.r}）`, romaji: headRo, tr: name, ask: t.prompt.theme, tags: ['vocabulary', key.replace(/_/g, '')], name, count: items.length },
  }
}

// ── 似た字, kanji that look alike (plan 229m) ─────────────────────
function lookalikePlan(data, set, opts) {
  const src = sourceOf('lookalike')
  const p = base(src, set, opts, set.lv)
  const { t, lang } = p
  const o = on('lookalike', opts)
  const chars = set.chars.map(k => ({
    c: k.c, lv: k.lv, on: k.on, kun: k.kun,
    // A dictionary's “radical (no. 12)” is no sense a learner reads.
    meaning: weldIf(lang, ((lang === 'fr' && k.fr?.length ? k.fr : k.en) || []).filter(m => !/radical|clé \(n/i.test(m)).slice(0, 2).join(', ')),
    note: tr(k.note, lang),
    word: k.word ? { t: k.word.t, r: k.word.r, fu: furiganaOf(k.word.t, k.word.r), main: weldIf(lang, gloss(k.word, lang)[0]) } : null,
  }))
  const slides = chars.map((k, i) => ({ kind: 'lookchar', k, all: chars.map(x => x.c), n: i + 1, of: chars.length }))
  if (o.apart) slides.push({ kind: 'apart', chars })
  closing(slides, o, t, p)
  const quizzes = lookalikeQuizzes(set, lang, t)
  const heads = chars.map(k => k.c).join(' ')
  const funnel = {
    chars,
    // A word each kanji writes, within the set's level (plan 248): the suite's detail.
    words: chars.filter(k => k.word).length > 1 ? wordRowsOf(chars.filter(k => k.word).map(k => ({ t: k.word.t, r: k.word.r, main: k.word.main }))) : [],
    ...noted(chars.map(k => ['mean', k.note && t.keys.means(k.c, k.note)]), lang),
  }
  return {
    ...p, cta: t.cta.lookalike, funnel,
    hook: { kind: 'kanjirow', chars: chars.map(k => k.c), title: t.modes.lookalikeHook(chars.length) },
    prompt: t.prompt.lookalike, quizzes, quiz: quizzes[0] || null, slides,
    caption: { jp: heads, romaji: '', tr: chars.map(k => `${k.c} ${k.meaning.split(',')[0]}`).join(' · '), ask: t.prompt.lookalike, tags: [`jlpt${set.lv.toLowerCase()}`, 'kanji'], name: heads },
  }
}

// ── 返事, a conversation to answer (plan 229m) ────────────────────
// Each turn asks the reader what to answer, then shows the answer. Every
// line is set with its furigana and its romaji: a beginner reads them all.
function dialoguePlan(data, d, opts) {
  const src = sourceOf('dialogue')
  const p = base(src, d, opts, d.lv)
  const { t, lang } = p
  const o = on('dialogue', opts)
  const place = tr(d.place, lang)
  const them = tr(d.them, lang)
  const turns = d.turns.map((tu, i) => {
    const dealt = deal(tu.right, tu.choices.map((_, k) => k).filter(k => k !== tu.right), `${d.id}-${i}`)
    return {
      them: { rows: unpack(tu.them.rows), tr: tr(tu.them, lang) },
      choices: dealt.choices.map(k => unpack(tu.choices[k])), right: dealt.right,
      reply: tr(tu.reply, lang), why: tr(tu.why, lang),
    }
  })
  // Romaji under every word for a beginner's conversation (N5, N4); a
  // later level's is read with its furigana alone (plan 229n).
  const romaji = ['N5', 'N4'].includes(d.lv)
  const slides = turns.flatMap((turn, i) => [false, true].map(revealed => ({ kind: 'turn', turn, n: i + 1, of: turns.length, revealed, place, them, romaji })))
  closing(slides, o, t, p)
  // Its key points: the shortest whys, in the order said (a 会話 scene has
  // up to six, an N1 one long; a carousel's own conversation has three, all kept).
  const shortest = turns.map((tu, i) => [i, tu.why.length]).sort((a, b) => a[1] - b[1]).slice(0, KEYS).map(([i]) => i).sort((a, b) => a - b)
  const funnel = { turns, place, them, romaji, ...noted(shortest.map(i => ['use', turns[i].why]), lang) }
  return {
    ...p, cta: t.cta.dialogue, funnel, kaiwa: !!d.kaiwa,
    hook: { kind: 'place', place: d.place.jp, title: `${place} · ${t.modes.dialogueHook}`, line: 'grammar' },
    prompt: t.prompt.dialogue, quizzes: [], quiz: null, slides,
    caption: { jp: d.place.jp, romaji: '', tr: place, ask: t.prompt.dialogue, tags: [`jlpt${d.lv.toLowerCase()}`, 'conversation'], name: place },
  }
}

// ── 落とし穴, a trap the lessons warn of (plan 229m) ──────────────
function trapPlan(data, x, opts) {
  const src = sourceOf('trap')
  const p = base(src, x, opts, x.lv)
  const { t, lang } = p
  const o = on('trap', opts)
  const notion = tr(x.notion, lang)
  // The point's other traps follow it in a mock exam.
  const quizzes = trapQuizzes([x, ...data.traps.filter(y => y.p === x.p && y.id !== x.id)], lang, t)
  const q = quizzes[0]
  const slides = [false, true].map(revealed => ({ kind: 'quiz', quiz: q, revealed, title: t.modes.trapTitle }))
  if (o.pair && x.pair) slides.push({ kind: 'twist', notion, pair: x.pair, why: '' })
  if (o.careful && x.careful) slides.push({ kind: 'watch', pattern: x.p, pt: { careful: x.careful } })
  closing(slides, o, t, p)
  const why = q?.explain?.why
  const careful = tr(x.careful, lang)
  const funnel = { notion, pair: x.pair || null, ...noted([['why', why], ['careful', careful]], lang) }
  return {
    ...p, cta: t.cta.trap, funnel,
    hook: { kind: 'listhead', head: x.p, title: notion, line: 'grammar' },
    prompt: t.prompt.trap, quizzes, quiz: q, slides,
    caption: { jp: x.p, romaji: '', tr: notion, ask: t.prompt.trap, tags: [`jlpt${x.lv.toLowerCase()}`, 'grammar'], point: x.p, name: x.p },
  }
}

// ── The picker's lists, and the plan for a chosen item ────────
/** The items a source's file offers: [{ id, jp, sub, tag }]. */
export function itemsOf(sourceId, data, lang, filter) {
  const pick = x => (lang === 'fr' && x.fr ? x.fr : x.en)
  switch (sourceId) {
    case 'sentence':
    case 'translation':
      return data.sentences.map(s => ({ id: s.id, jp: s.jp, sub: s[lang] || s.en, tag: s.p }))
    case 'lesson':
      return data.lessons.map(L => ({ id: L.p, jp: L.p, sub: pick(L), tag: L.lv }))
    case 'word':
      return data.words.map(w => ({ id: wordId(data, w), jp: w.t, sub: (pick(w) || [])[0] || '', tag: w.r }))
    case 'kanji':
      return Object.entries(data.kanji).map(([c, k]) => ({ id: c, jp: c, sub: (pick(k) || []).slice(0, 2).join(', '), tag: k.on[0] || (k.kun[0] || []).join('') }))
    case 'kana':
      return data.kana.filter(k => !filter || k.set === filter).map(k => ({ id: k.k, jp: k.k, sub: k.ro, tag: k.twin || '' }))
    case 'passage':
      return data.passages.map(P => ({ id: P.id, jp: P.title, sub: P.grammar.join('　'), tag: P.lv }))
    case 'challenge':
      return challengeItems(data, lang)
    case 'theme':
      // A post of a theme is drawn with four pictures at least.
      return Object.entries(data.themes).flatMap(([key, th]) => {
        const parts = themeParts(th)
        const name = th.name[lang] || th.name.en
        return parts.map((_, i) => ({ id: i ? `${key}~${i + 1}` : key, jp: th.head.t, sub: parts.length > 1 ? `${name} · ${i + 1}/${parts.length}` : name, tag: th.head.r }))
      })
    case 'lookalike':
      return data.sets.map(x => ({ id: x.id, jp: x.chars.map(k => k.c).join(' '), sub: x.chars.map(k => (pick(k) || [])[0]).join(' · '), tag: x.lv }))
    case 'dialogue':
      // The 会話 station's own scenes beside the carousel's (plan 268), named as the station's.
      return data.dialogues.map(d => ({ id: d.id, jp: d.place.jp, sub: tr(d.place, lang), tag: d.kaiwa ? `${d.lv} · 会話` : d.lv }))
    case 'trap':
      return data.traps.map(x => ({ id: x.id, jp: x.p, sub: tr(x.notion, lang), tag: x.lv }))
    case 'short':
      return data.sentences.map(s => ({ id: s.id, jp: s.jp, sub: s[lang] || s.en, tag: s.e }))
    case 'promo':
      return promoItems(filter || 'pitch', data, lang)
    case 'echo':
      return echoItems(data, lang)
    default:
      return []
  }
}

/** What else a word's carousel reads: its example sentences' levels and its kanji's. */
export function depsOf(sourceId, data, id) {
  if (sourceId !== 'word') return { levels: [], chars: [] }
  const w = wordOf(data, id)
  if (!w) return { levels: [], chars: [] }
  return { levels: [...new Set((w.ex || []).map(x => x.split('.')[0]))], chars: [...w.t] }
}

export function plan(sourceId, data, id, opts, deps = {}) {
  switch (sourceId) {
    case 'sentence': {
      const s = data.sentences.find(x => x.id === id) ?? data.sentences[0]
      return sentencePlan(data, s, opts)
    }
    case 'translation': {
      const s = data.sentences.find(x => x.id === id) ?? data.sentences[0]
      return translationPlan(data, s, opts)
    }
    case 'lesson':
      return lessonPlan(data, data.lessons.find(L => L.p === id) ?? data.lessons[0], opts)
    case 'word':
      return wordPlan(data, wordOf(data, id) ?? data.words[0], opts, deps)
    case 'kanji':
      return kanjiPlan(data, data.kanji[id] ? id : Object.keys(data.kanji)[0], opts)
    case 'kana':
      return kanaPlan(data, data.kana.find(k => k.k === id) ?? data.kana[0], opts)
    case 'passage':
      return passagePlan(data, data.passages.find(P => P.id === id) ?? data.passages[0], opts)
    case 'theme':
      return themePlan(data, data.themes[themePartOf(id).key] ? id : itemsOf('theme', data, opts.lang)[0].id, opts)
    case 'lookalike':
      return lookalikePlan(data, data.sets.find(x => x.id === id) ?? data.sets[0], opts)
    case 'dialogue':
      return dialoguePlan(data, data.dialogues.find(d => d.id === id) ?? data.dialogues[0], opts)
    case 'trap':
      return trapPlan(data, data.traps.find(x => x.id === id) ?? data.traps[0], opts)
    case 'short':
      return shortPlan(data, data.sentences.find(x => x.id === id) ?? data.sentences[0], opts)
    case 'promo':
      return promoPlan(opts.story || 'pitch', data, id, opts)
    case 'echo':
      return echoPlan(data, id, opts)
    default:
      return null
  }
}

// A carousel asks six questions at most: a mock exam's cover, its twelve
// question slides, the sheet and the last slide keep under a feed's
// twenty, and the cover and the sheet keep a readable row each (plan 229l).
export const MAX_QUESTIONS = 6
/** The questions a carousel asks: the ones the studio picked for the
 *  item, in the plan's order, else its first `n`; six at most. */
export function picked(pl, picks, n) {
  const chosen = picks?.length ? pl.quizzes.filter(q => picks.includes(q.id)) : []
  return (chosen.length ? chosen : pl.quizzes.slice(0, n)).slice(0, MAX_QUESTIONS)
}

// ── The post's title (plan 229l) ──────────────────────────────
// A feed asks for a title over the caption (TikTok's, 90 characters at
// most): one hook per source and type, in the post's language, naming
// the item and its level. Only the item's own text is cut, never the hook.
export const TITLE_MAX = 90
const TITLES = {
  en: {
    sentence: (c, lv) => `Can you read this ${lv} sentence without help?`,
    translation: c => `How do you say “${c.jp}” in Japanese?`,
    lesson: (c, lv) => `${c.jp} explained in its own sentences · ${lv} grammar`,
    word: (c, lv) => `Can you read ${c.word}? A word every ${lv} learner needs`,
    kanji: (c, lv) => `${c.jp}: its readings and its words · ${lv} kanji`,
    kana: c => `${c.jp} in real words · learn ${c.set}`,
    passage: (c, lv) => `${lv} reading: can you follow “${c.jp}”?`,
    exam: (c, lv, n) => `${c.kana ? 'Kana quiz' : `${lv} mock exam`}: ${n} question${n > 1 ? 's' : ''} on ${c.head}. Your score?`,
    compare: (c, lv, n, a, b) => `${a} or ${b}? Never mix them up again`,
    build: c => `Build the sentence: ${c.head}`,
    list: (c, lv, n) => (c.sentences ? `${n} sentences with ${c.head}` : c.from ? `${n} words from “${c.head}”` : `${n} words with ${c.head}`),
    talk: c => `${c.head} in a real conversation`,
    spelling: (c, lv) => `How do you write ${c.reading} in kanji? ${lv} spelling quiz`,
    theme: c => `${c.jp} in Japanese: ${c.count} words to know, in pictures`,
    lookalike: c => `${c.jp}: can you tell these kanji apart?`,
    dialogue: c => `${c.jp}: what would you answer in Japanese?`,
    trap: (c, lv) => `A ${lv} grammar trap with ${c.jp}: will you fall for it?`,
    impostor: c => `Find the impostor: which word is not in “${c.jp}”?`,
    short: () => 'Can you read this? A tiny Japanese reading challenge',
  },
  fr: {
    sentence: (c, lv) => `Tu sais lire cette phrase ${lv} sans aide ?`,
    translation: c => `Comment dit-on « ${c.jp} » en japonais ?`,
    lesson: (c, lv) => `${c.jp} expliqué dans ses phrases · grammaire ${lv}`,
    word: (c, lv) => `Tu sais lire ${c.word} ? Un mot du ${lv} à connaître`,
    kanji: (c, lv) => `${c.jp} : ses lectures et ses mots · kanji ${lv}`,
    kana: c => `${c.jp} dans de vrais mots · apprends les ${c.set}`,
    passage: (c, lv) => `Lecture ${lv} : tu suis « ${c.jp} » ?`,
    exam: (c, lv, n) => `${c.kana ? 'Quiz kana' : `Mini examen ${lv}`} : ${n} question${n > 1 ? 's' : ''} sur ${c.head}. Ton score ?`,
    compare: (c, lv, n, a, b) => `${a} ou ${b} ? Ne les confonds plus`,
    build: c => `Construis la phrase : ${c.head}`,
    list: (c, lv, n) => (c.sentences ? `${n} phrases avec ${c.head}` : c.from ? `${n} mots de « ${c.head} »` : `${n} mots avec ${c.head}`),
    talk: c => `${c.head} dans une vraie conversation`,
    spelling: (c, lv) => `Comment s’écrit ${c.reading} en kanji ? Quiz ${lv}`,
    theme: c => `${c.jp} en japonais : ${c.count} mots à connaître, en images`,
    lookalike: c => `${c.jp} : sauras-tu distinguer ces kanji ?`,
    dialogue: c => `${c.jp} : que répondrais-tu en japonais ?`,
    trap: (c, lv) => `Un piège de grammaire ${lv} avec ${c.jp} : vas-tu tomber dedans ?`,
    impostor: c => `Trouve l’intrus : quel mot n’est pas dans « ${c.jp} » ?`,
    short: () => 'Tu sais lire ça ? Un petit défi de lecture en japonais',
  },
}
/** The title of a plan posted as `type` asking `n` questions. */
export function titleOf(pl, type, n = 3) {
  // A promo story names itself (promo.js), cut to the feed's limit.
  if (pl.source === 'promo' || pl.source === 'echo') return [...pl.title].slice(0, TITLE_MAX).join('')
  const say = TITLES[pl.lang] || TITLES.en
  const c = pl.caption
  const lv = /^N\d$/.test(pl.level) ? `JLPT ${pl.level}` : 'JLPT'
  // The item as a title names it: a word bare, a sentence its point.
  const head = c.name || { sentence: c.point, translation: c.point, lesson: c.jp, word: c.jp.replace(/（.*/, ''), passage: c.jp }[pl.source] || c.jp
  const sides = pl.compare?.sides?.map(x => x.head) || []
  const make = item => {
    const v = { ...c, jp: item, word: item, head: pl.source === 'translation' ? c.point || head : item, set: c.tags[0] || 'kana' }
    if (type === 'exam') return say.exam({ head: v.head, kana: pl.source === 'kana' }, lv, n)
    if (type === 'compare' && sides.length >= 2) return say.compare(v, lv, n, sides[0], sides[1])
    if (type === 'build') return say.build({ head: v.head })
    if (type === 'list' && pl.list) {
      const sentences = ['sentence', 'translation', 'lesson'].includes(pl.source)
      return say.list({ head: sentences ? v.head : pl.list.head || v.head, sentences, from: pl.source === 'passage' }, lv, pl.list.items.length)
    }
    if (type === 'talk') return say.talk({ head: v.head })
    if (type === 'impostor') return say.impostor(v)
    // Never the kanji it asks for: the word heard in kana.
    if (type === 'spelling') return say.spelling({ reading: /（(.+)）/.exec(c.jp)?.[1] || item }, lv)
    return say[pl.source](v, lv)
  }
  // The item's text is what gives way, to fit the feed's limit.
  const own = { sentence: head, translation: c.jp, word: head, passage: c.jp }[pl.source] ?? head
  let item = own
  let out = make(item)
  while ([...out].length > TITLE_MAX && [...item].length > 4) {
    item = `${[...item].slice(0, [...item].length - 2).join('').trimEnd()}…`.replace(/……$/, '…')
    out = make(item)
  }
  return [...out].slice(0, TITLE_MAX).join('')
}

/** Every Japanese and Latin character a plan may set, for the font loader. */
// The conversion carousel's own glyphs (funnel.js, plan 234): its
// pictures' emoji, its bands' and its schemas' kanji, the kana table's rows.
const KANA_ROWS = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'
const FUNNEL_GLYPHS = `💡🌱🔖📖🎧⏱️🔁✍️💬🔤📋▶️📷🔔🙂🙋🔊✏️📰🌐🔍🌅🖌️🧩🧑‍🏫問答かな単語漢字文法日本語解詳要点次模試語彙文法読解聴解字写真ō${KANA_ROWS}${[...KANA_ROWS].map(c => String.fromCharCode(c.charCodeAt(0) + 0x60)).join('')}`
export function sampleText(pl) {
  const parts = [JSON.stringify(pl.t), JSON.stringify(pl.slides), JSON.stringify(pl.hook), JSON.stringify(pl.quizzes || []),
    JSON.stringify([pl.compare, pl.build, pl.list, pl.talk, pl.station, pl.figure, pl.impostor, pl.funnel]), FUNNEL_GLYPHS,
    pl.handle, 'Tsuji問題もんだい正解解答0123456789/·（　）＿★→＋＝…',
    // A promo story's words, its functions' text with them, and the print's slip.
    ...(pl.promo ? [JSON.stringify(pl.promo), ...Object.values(pl.P).map(v => (typeof v === 'function' ? String(v) : JSON.stringify(v))), '一二三四五六七八九十月日曙帰帆落雁秋月仮語漢文辻≈½'] : []),
    ...(pl.echo ? [JSON.stringify(pl.echo)] : [])]
  return [...new Set(parts.join(''))].join('')
}
