// ── カルーセル — what a carousel is drawn from (plans 200b, 200c) ────
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
import { ROLES, howItWorks, lookalikesOf, particleLabel, stacksIn } from './explain.js'
import { firstSense, gloss, lineRomaji, readingMisses, seeded, shuffle, unpack } from './common.js'
import {
  kanaQuizzes, kanjiQuizzes, lessonQuizzes, overlaps, passageQuizzes, sentenceQuizzes, spellingQuizzes, translationQuizzes, wordQuizzes,
} from './quizzes.js'

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
  { id: 'passage', jp: '理解', line: 'rikai', name: { en: 'Compre\u00adhension', fr: 'Compré\u00adhension' }, file: () => 'comprehension.json' },
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
function stationOf(source, lang) {
  const line = LINES.find(l => l.stops.includes(source))
  const at = line.stops.indexOf(source)
  return {
    ...STATION[source], name: sourceOf(source).name[lang].replace(/\u00ad/g, ''),
    prev: STATION[line.stops[at - 1]], next: STATION[line.stops[at + 1]], line: { key: line.key, jp: line.jp },
  }
}
/** The app's two lines out of 辻, every station on them, the source's lit:
 *  what the route-map ending draws. */
function mapOf(source) {
  return LINES.map(l => ({ key: l.key, jp: l.jp, stops: l.stops.slice(1).map(id => ({ ...STATION[id], here: id === source })) }))
}
/** What the last slide says about the source's line, from the bank's own figures. */
function figureOf(source, figures, t, lang) {
  if (!figures) return ''
  const f = t.figure
  switch (source) {
    case 'sentence': return f.sentence(count(figures.sentences, lang))
    case 'translation': return f.translation(count(figures.sentences, lang))
    case 'lesson': return f.lesson(count(figures.points, lang))
    case 'word': return f.word(count(figures.words, lang))
    case 'kanji': return f.kanji(count(figures.kanji, lang))
    case 'kana': return f.kana(figures.hiragana, figures.katakana)
    default: return f.passage()
  }
}

// ── The parts every sentence-shaped source shares ────────────
function wordItems(s, points, lang, t) {
  const markers = new Set(s.gram.filter(g => g.kind === 'marker').map(g => g.p))
  const pointOf = row => {
    const g = row.g || []
    return g.find(p => p === row.t) ?? g.find(p => markers.has(p)) ?? g[0]
  }
  return s.rows.map((row, i) => ({ row, i })).filter(({ row }) => row.k !== 'punct').map(({ row, i }, n) => {
    const grammar = row.k !== 'word'
    let main, sub
    if (grammar) {
      const p = pointOf(row)
      const pt = points[p]
      // A particle that is its own point (で, に) says what it does here,
      // in a word: the catalogue's general line is the lesson's, not a
      // breakdown's (plan 200l).
      const label = (!p || p === row.t) && particleLabel(s.rows, i, lang)
      main = label || (pt ? tr(pt, lang) : t.pos[row.k])
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
      i, n: n + 1, t: row.t, reading: reading(row), ro: row.ro, main, sub,
      line: grammar ? 'grammar' : 'vocab', kanji: hasKanji(row.t),
      pos: t.pos[row.k === 'word' ? row.pos : row.k] || row.pos,
    }
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
  const short = s => {
    const head = String(s || '').split(/[,;:(]/)[0].trim()
    return head.length > 26 ? `${head.slice(0, 25).trim()}…` : head
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
    caption: { jp: s.jp, romaji: x.romaji, tr: x.translation, ask: lang === 'fr' ? 'Tu l’as lue sans aide ?' : 'Could you read it without help?', tags: [`jlpt${s.lv.toLowerCase()}`], point: s.p },
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
  return {
    ...p, hook: { kind: 'pattern', pattern: L.p, rows: first?.rows || [], meaning }, prompt: t.prompt.lesson,
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
 *  entry is written the same (一日 ついたち, 一日 いちにち: plan 200l). */
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
  return {
    ...p, hook: { kind: 'specimen', text: w.t }, prompt: t.prompt.word, quizzes, quiz: quizzes[0] || null, slides,
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
  return {
    ...p, hook: { kind: 'specimen', text: c }, prompt: t.prompt.kanji, quizzes, quiz: quizzes[0] || null, slides,
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
  return {
    ...p, hook: { kind: 'specimen', text: card.k }, prompt: t.prompt.kana, quizzes, quiz: quizzes[0] || null, slides,
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
  return {
    ...p, hook: { kind: 'specimen', text: P.title, small: true }, prompt: t.prompt.passage,
    quizzes, quiz: quizzes[0] || null, slides,
    list: words.length >= 3 ? { title: t.listTitle.passage(words.length), head: P.title, line: 'vocab', items: words } : null,
    caption: { jp: P.title, romaji: '', tr: quizzes[0]?.ask || '', ask: t.prompt.passage, tags: [`jlpt${P.lv.toLowerCase()}`, 'reading'] },
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
    default:
      return null
  }
}

// A carousel asks six questions at most: a mock exam's cover, its twelve
// question slides, the sheet and the last slide keep under a feed's
// twenty, and the cover and the sheet keep a readable row each (plan 200l).
export const MAX_QUESTIONS = 6
/** The questions a carousel asks: the ones the studio picked for the
 *  item, in the plan's order, else its first `n`; six at most. */
export function picked(pl, picks, n) {
  const chosen = picks?.length ? pl.quizzes.filter(q => picks.includes(q.id)) : []
  return (chosen.length ? chosen : pl.quizzes.slice(0, n)).slice(0, MAX_QUESTIONS)
}

// ── The post's title (plan 200l) ──────────────────────────────
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
  },
}
/** The title of a plan posted as `type` asking `n` questions. */
export function titleOf(pl, type, n = 3) {
  const say = TITLES[pl.lang] || TITLES.en
  const c = pl.caption
  const lv = /^N\d$/.test(pl.level) ? `JLPT ${pl.level}` : 'JLPT'
  // The item as a title names it: a word bare, a sentence its point.
  const head = { sentence: c.point, translation: c.point, lesson: c.jp, word: c.jp.replace(/（.*/, ''), passage: c.jp }[pl.source] || c.jp
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
export function sampleText(pl) {
  const parts = [JSON.stringify(pl.t), JSON.stringify(pl.slides), JSON.stringify(pl.hook), JSON.stringify(pl.quizzes || []),
    JSON.stringify([pl.compare, pl.build, pl.list, pl.talk, pl.station, pl.figure]),
    pl.handle, 'Tsuji問題もんだい正解解答0123456789/·（　）＿★→＋＝…']
  return [...new Set(parts.join(''))].join('')
}
