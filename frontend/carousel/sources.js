// ── カルーセル — what a carousel is drawn from (plan 200b) ───────────
// A carousel starts from one thing the app teaches: a sentence of the
// reading bank (read it, or say it: 読書 and 翻訳), a grammar lesson
// with its tour (文法), a word of the deck (単語), a kanji (漢字), a kana
// (かな) or a comprehension passage (理解). Each source here turns its
// item into a plan: the hook, the question the mock-exam direction asks,
// and the slides after it, each a `kind` slides.js knows how to draw.
// Pure: no canvas, no fetch, so the node tests read it directly.
import { hasKanji, reading } from './draw.js'
import { STRINGS, formOf, tr, weldIf } from './strings.js'
import { howItWorks, lookalikesOf, stacksIn } from './explain.js'

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

// The slides a source may leave out, with whether each is in by default.
export const OPTIONAL = {
  sentence: [['words', true], ['grammar', true], ['watch', true], ['yourturn', false], ['rating', true], ['outro', true]],
  translation: [['words', true], ['grammar', true], ['watch', false], ['yourturn', false], ['outro', true]],
  lesson: [['examples', true], ['scene', true], ['twist', true], ['watch', true], ['quiz', false], ['yourturn', true], ['outro', true]],
  word: [['parts', true], ['examples', true], ['strokes', true], ['yourturn', false], ['outro', true]],
  kanji: [['readings', true], ['words', true], ['strokes', true], ['yourturn', false], ['outro', true]],
  kana: [['strokes', true], ['lookalike', true], ['words', true], ['outro', true]],
  passage: [['second', false], ['outro', true]],
}
export const BONUS = new Set(['sentence', 'translation'])

// ── Small things ──────────────────────────────────────────────
/** A seeded pick, so an item's quiz deals the same order every time. */
export function seeded(seed) {
  let h = 2166136261
  for (const c of String(seed)) h = Math.imul(h ^ c.codePointAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}
export function shuffle(list, rand) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
/** A question's choices dealt in a seeded order, the right one tracked. */
function deal(right, wrong, seed) {
  const rand = seeded(seed)
  const all = shuffle([right, ...wrong], rand)
  return { choices: all, right: all.indexOf(right) }
}

const KINDS = { w: 'word', v: 'word', p: 'particle', c: 'copula' }
/** A lesson's packed row (carousel_bank.text_rows) as the row a slide sets. */
export const unpack = rows => rows.map(r => (r.length === 1
  ? { t: r[0], k: 'punct' }
  : { t: r[0], k: KINDS[r[1]] || 'word', ro: r[2], ...(r[1] === 'v' ? { pos: 'verb' } : {}), ...(r[3] ? { fu: r[3] } : {}), ...(r[4] ? { lit: true } : {}) }))

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

/** A word's gloss in the reader's language: [the sense, the senses after it]. */
export function gloss(row, lang) {
  const senses = (lang === 'fr' && row.fr?.length ? row.fr : row.en) || []
  return [senses[0] || '', senses.slice(1, 3).join(', ')]
}
const firstSense = lang => row => gloss(row, lang)[0]

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
    if (!r || [...text].length !== 1 || !kanji?.[text]) continue
    const k = kanji[text]
    for (const other of [...k.on.map(toHira), ...k.kun.map(([stem]) => stem)]) {
      if (other && other !== r) out.add(reading(row).replace(r, other))
    }
  }
  out.delete(answer)
  return [...out].filter(s => s && /^[ぁ-ゟー]+$/.test(s))
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
      const pt = points[pointOf(row)]
      main = pt ? tr(pt, lang) : t.pos[row.k]
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
      i, n: n + 1, t: row.t, reading: reading(row), ro: row.ro, main, sub,
      line: grammar ? 'grammar' : 'vocab', kanji: hasKanji(row.t),
      pos: t.pos[row.k === 'word' ? row.pos : row.k] || row.pos,
    }
  })
}

/** The sentence's reading question (a kanji word's reading), or its meaning. */
function sentenceQuiz(s, bank, lang, t) {
  const rows = s.rows
  const focus = s.fi ?? rows.findIndex(r => r.k === 'word')
  const row = rows[focus]
  const near = row && hasKanji(row.t) ? readingMisses(row, bank.kanji) : []
  if (near.length >= 3) {
    const wrong = shuffle(near, seeded(s.id)).slice(0, 3)
    return {
      kind: 'reading', askJp: '＿＿の ことばは どう よみますか。', ask: t.examAsk.reading,
      stem: { rows, target: focus, under: true },
      ...dealChoices(reading(row), wrong, s.id, 'jp'),
      explain: { head: `${row.t}\u3000${reading(row)}`, sense: weldIf(lang, gloss(row, lang)[0]) },
    }
  }
  const answer = gloss(row, lang)[0]
  const pool = new Set()
  for (const other of bank.sentences) {
    for (const r of other.rows) if (r.k === 'word' && r.pos === row.pos && r.t !== row.t && r.en) pool.add(gloss(r, lang)[0])
  }
  pool.delete(answer)
  return {
    kind: 'meaning', askJp: '＿＿の ことばの いみは どれですか。', ask: t.examAsk.meaning,
    stem: { rows, target: focus, under: true },
    ...dealChoices(weldIf(lang, answer), shuffle([...pool], seeded(s.id)).slice(0, 3).map(x => weldIf(lang, x)), s.id, 'latin'),
    explain: { head: `${row.t}\u3000${reading(row)}`, sense: weldIf(lang, answer) },
  }
}
function dealChoices(right, wrong, seed, fam) {
  const { choices, right: at } = deal(right, wrong, seed)
  return { choices: choices.map(text => ({ text, fam })), right: at }
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
  }
}
const on = (source, opts) => Object.fromEntries((OPTIONAL[source] || []).map(([k, d]) => [k, opts.slides?.[source]?.[k] ?? d]))

// ── 読書, a sentence to read ──────────────────────────────────
function sentencePlan(data, s, opts) {
  const src = sourceOf('sentence')
  const p = base(src, s, opts, s.lv)
  const { t, lang } = p
  const o = on('sentence', opts)
  const translation = weldIf(lang, s[lang] || s.en)
  const romaji = lineRomaji(s.rows)
  const bonus = kanjiBonus(s, opts, data.kanji)
  const slides = []
  if (o.words) slides.push({ kind: 'words', items: wordItems(s, data.points, lang, t) })
  slides.push(...grammarSlides(s, data, lang, o))
  slides.push({ kind: 'answer', rows: s.rows, romaji, translation })
  if (opts.bonus === 'kanji' && bonus.k) slides.push({ kind: 'strokes', char: bonus.char, k: bonus.k })
  if (opts.bonus === 'twist') {
    const tw = data.points[s.p]?.twists?.[0]
    if (tw) slides.push({ kind: 'twist', notion: tr(tw.notion, lang), pair: tw.pair, why: tr(tw.why, lang) })
  }
  if (o.yourturn) slides.push({ kind: 'yourturn', text: t.turn.point(s.p), form: formOf(data.points[s.p], lang), model: { rows: s.rows, tr: translation } })
  if (o.rating) slides.push({ kind: 'rating' })
  if (o.outro) slides.push({ kind: 'outro' })
  return {
    ...p, kanjiChars: bonus.chars, kanjiChar: bonus.char,
    hook: { kind: 'sentence', rows: s.rows }, prompt: t.prompt.sentence,
    quiz: sentenceQuiz(s, data, lang, t), slides,
    caption: { jp: s.jp, romaji, tr: translation, ask: lang === 'fr' ? 'Tu l’as lue sans aide ?' : 'Could you read it without help?', tags: [`jlpt${s.lv.toLowerCase()}`], point: s.p },
  }
}

// ── 翻訳, the same sentence to say ────────────────────────────
function translationPlan(data, s, opts) {
  const src = sourceOf('translation')
  const p = base(src, s, opts, s.lv)
  const { t, lang } = p
  const o = on('translation', opts)
  const translation = weldIf(lang, s[lang] || s.en)
  const romaji = lineRomaji(s.rows)
  const bonus = kanjiBonus(s, opts, data.kanji)
  // The words to build it from, as tiles, in a seeded disorder.
  const tiles = shuffle(s.rows.filter(r => r.k !== 'punct'), seeded(`${s.id}-tiles`))
  const others = data.sentences.filter(x => x.id !== s.id)
  const rivals = [...others.filter(x => x.p === s.p), ...shuffle(others, seeded(s.id))].filter((x, i, a) => a.indexOf(x) === i).slice(0, 2)
  const { choices, right } = deal(s, rivals, `${s.id}-tr`)
  const slides = [{ kind: 'answer', rows: s.rows, romaji, translation, title: t.answer }]
  if (o.words) slides.push({ kind: 'words', items: wordItems(s, data.points, lang, t) })
  slides.push(...grammarSlides(s, data, lang, o))
  if (opts.bonus === 'kanji' && bonus.k) slides.push({ kind: 'strokes', char: bonus.char, k: bonus.k })
  if (opts.bonus === 'twist') {
    const tw = data.points[s.p]?.twists?.[0]
    if (tw) slides.push({ kind: 'twist', notion: tr(tw.notion, lang), pair: tw.pair, why: tr(tw.why, lang) })
  }
  if (o.yourturn) slides.push({ kind: 'yourturn', text: t.turn.point(s.p), form: formOf(data.points[s.p], lang), model: { rows: s.rows, tr: translation } })
  if (o.outro) slides.push({ kind: 'outro' })
  return {
    ...p, kanjiChars: bonus.chars, kanjiChar: bonus.char,
    hook: { kind: 'prompt', text: translation, tiles }, prompt: t.prompt.translation,
    quiz: {
      kind: 'translation', ask: t.examAsk.translation, stem: { text: translation },
      choices: choices.map(x => ({ rows: x.rows, fam: 'jp' })), right,
      explain: { head: s.jp, sense: romaji },
    },
    slides,
    caption: { jp: translation, romaji: '', tr: '', ask: t.turn.translation, tags: [`jlpt${s.lv.toLowerCase()}`], point: s.p, answerJp: s.jp },
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
  const ask = scene?.ask
  const sceneQuiz = ask ? {
    kind: 'scene', ask: t.sceneAsk,
    stem: { cue: { who: ask.cue.who, rows: unpack(ask.cue.rows), tr: weldIf(lang, ask.cue[lang] || ask.cue.en) }, task: tr(ask.task, lang), them: tr(scene.them, lang) },
    ...(() => {
      const d = deal(0, [1, 2].slice(0, ask.choices.length - 1), `${L.p}-scene`)
      return { choices: d.choices.map(i => ({ rows: unpack(ask.choices[i]), fam: 'jp' })), right: d.right }
    })(),
    explain: { why: tr(ask.why, lang) },
  } : null
  const tourQuiz = (L.quiz || []).map((q, n) => {
    const d = deal(0, q.choices.map((_, i) => i).slice(1), `${L.p}-quiz-${n}`)
    return {
      kind: 'tour', ask: tr(q.ask, lang),
      stem: q.rows ? { rows: unpack(q.rows), tr: q.kind === 'form' ? tr(q.tr, lang) : '' } : null,
      choices: d.choices.map(i => (typeof q.choices[i] === 'string' ? { text: q.choices[i], fam: 'jp' } : { text: tr(q.choices[i], lang), fam: 'latin' })),
      right: d.right,
      explain: { why: tr(q.why, lang), sense: q.kind === 'meaning' ? tr(q.tr, lang) : '' },
    }
  })
  const slides = [{ kind: 'lesson', pattern: L.p, pt: L, how }]
  if (o.examples && ex.length) slides.push({ kind: 'examples', items: ex })
  if (o.scene && scene) {
    slides.push({
      kind: 'scene', place: scene.place, them: tr(scene.them, lang), note: tr(scene.note, lang),
      lines: scene.lines.map(l => ({ who: l.who, rows: unpack(l.rows), tr: weldIf(lang, l[lang] || l.en) })),
    })
    if (sceneQuiz) slides.push({ kind: 'quiz', quiz: sceneQuiz, revealed: false, title: t.sceneAsk, skipOnExam: true }, { kind: 'quiz', quiz: sceneQuiz, revealed: true, title: t.sceneAsk })
  }
  if (o.twist) {
    const tw = twistSlide(L.twists?.[0], lang, unpack)
    if (tw) slides.push(tw)
  }
  if (o.watch && (L.careful || L.compare)) slides.push({ kind: 'watch', pattern: L.p, pt: L })
  if (o.quiz && tourQuiz[0]) slides.push({ kind: 'quiz', quiz: tourQuiz[0], revealed: false, title: t.quiz }, { kind: 'quiz', quiz: tourQuiz[0], revealed: true, title: t.quiz })
  if (o.yourturn) slides.push({ kind: 'yourturn', text: t.turn.point(L.p), form: formOf(L, lang), model: ex[1] || first })
  if (o.outro) slides.push({ kind: 'outro' })
  return {
    ...p, hook: { kind: 'pattern', pattern: L.p, rows: first?.rows || [], meaning }, prompt: t.prompt.lesson,
    quiz: sceneQuiz || tourQuiz[0] || null, slides,
    caption: { jp: L.p, romaji: '', tr: meaning, ask: t.turn.point(L.p), tags: [`jlpt${L.lv.toLowerCase()}`], point: L.p },
  }
}

// ── 単語, a word of the deck ───────────────────────────────────
function wordPlan(data, w, opts, deps) {
  const src = sourceOf('word')
  const p = base(src, { id: w.t }, opts, data.level)
  const { t, lang } = p
  const o = on('word', opts)
  const index = deps.index?.kanji || {}
  const [main, sub] = gloss(w, lang)
  const row = { t: w.t, fu: w.fu }
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
  if (o.examples) {
    const items = (w.ex || []).map(id => deps.sentences?.[id]).filter(Boolean).map(s => ({
      rows: s.rows.map(r => ((r.t === w.t || r.lemma?.[0] === w.t) ? { ...r, lit: true } : r)),
      tr: weldIf(lang, s[lang] || s.en),
    }))
    if (items.length) slides.push({ kind: 'examples', items, title: t.inSentence, line: 'vocab' })
  }
  const strokeChar = chars.find(c => deps.strokes?.[c]?.s)
  if (o.strokes && strokeChar) slides.push({ kind: 'strokes', char: strokeChar, k: deps.strokes[strokeChar] })
  if (o.yourturn) slides.push({ kind: 'yourturn', text: t.turn.word(w.t) })
  if (o.outro) slides.push({ kind: 'outro' })
  const near = hasKanji(w.t) ? readingMisses(row, index) : []
  const quiz = near.length >= 3 ? {
    kind: 'reading', ask: t.examAsk.kana, stem: { specimen: w.t },
    ...dealChoices(w.r, shuffle(near, seeded(w.t)).slice(0, 3), w.t, 'jp'),
    explain: { head: `${w.t}\u3000${w.r}`, sense: weldIf(lang, main) },
  } : {
    kind: 'meaning', ask: t.examAsk.meaning, stem: { specimen: w.t },
    ...dealChoices(weldIf(lang, main), shuffle(data.words.filter(x => x.t !== w.t).map(x => gloss(x, lang)[0]).filter(Boolean), seeded(w.t)).slice(0, 3).map(x => weldIf(lang, x)), w.t, 'latin'),
    explain: { head: `${w.t}\u3000${w.r}`, sense: weldIf(lang, main) },
  }
  return {
    ...p, hook: { kind: 'specimen', text: w.t }, prompt: t.prompt.word, quiz, slides,
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
  if (o.yourturn) slides.push({ kind: 'yourturn', text: t.turn.kanji(c) })
  if (o.outro) slides.push({ kind: 'outro' })
  const own = new Set([...k.on, ...k.kun.map(([a, b]) => a + b)])
  const right = k.on[0] || (k.kun[0] && k.kun[0][0] + k.kun[0][1])
  const pool = Object.entries(data.kanji).filter(([x]) => x !== c).map(([, v]) => v.on[0]).filter(r => r && !own.has(r))
  const wrong = [...new Set(shuffle(pool, seeded(c)))].slice(0, 3)
  return {
    ...p, hook: { kind: 'specimen', text: c }, prompt: t.prompt.kanji,
    quiz: right ? {
      kind: 'kanji', ask: t.examAsk.kanji, stem: { specimen: c },
      ...dealChoices(right, wrong, c, 'jp'), explain: { head: c, sense: meaning },
    } : null,
    slides,
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
  if (o.outro) slides.push({ kind: 'outro' })
  const same = data.kana.filter(x => x.set === card.set && x.ro !== card.ro)
  const near = [...(group?.set || []).map(k => byKana[k]?.ro), ...shuffle(same.filter(x => x.group === card.group).map(x => x.ro), seeded(card.k)), ...shuffle(same.map(x => x.ro), seeded(card.k))]
  const wrong = [...new Set(near.filter(r => r && r !== card.ro))].slice(0, 3)
  return {
    ...p, hook: { kind: 'specimen', text: card.k }, prompt: t.prompt.kana,
    quiz: { kind: 'kana', ask: t.examAsk.kana, stem: { specimen: card.k }, ...dealChoices(card.ro, wrong, card.k, 'latin'), explain: { head: `${card.k}\u3000${card.ro}`, sense: card.twin ? `${t.otherScript[card.set]}: ${card.twin}` : '' } },
    slides,
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
  const quizOf = (q, n) => ({
    kind: 'passage', ask: weldIf(lang, q.question[lang] || q.question.en), stem: null,
    ...(() => {
      const opts2 = q.options[lang] || q.options.en
      const d = deal(q.correct, opts2.map((_, i) => i).filter(i => i !== q.correct), `${P.id}-${n}`)
      return { choices: d.choices.map(i => ({ text: weldIf(lang, opts2[i]), fam: 'latin' })), right: d.right }
    })(),
    explain: {},
  })
  const qs = (P.questions || []).slice(0, o.second ? 2 : 1).map(quizOf)
  const slides = [{ kind: 'passage', sents, title: P.title }]
  qs.forEach((q, n) => slides.push(
    { kind: 'quiz', quiz: q, revealed: false, title: `${t.question} ${n + 1}` },
    { kind: 'quiz', quiz: q, revealed: true, title: `${t.answer} ${n + 1}` },
  ))
  if (o.outro) slides.push({ kind: 'outro' })
  return {
    ...p, hook: { kind: 'specimen', text: P.title, small: true }, prompt: t.prompt.passage,
    quiz: null, slides,
    caption: { jp: P.title, romaji: '', tr: qs[0]?.ask || '', ask: t.prompt.passage, tags: [`jlpt${P.lv.toLowerCase()}`, 'reading'] },
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
      return data.words.map(w => ({ id: w.t, jp: w.t, sub: (pick(w) || [])[0] || '', tag: w.r }))
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
  const w = data.words.find(x => x.t === id)
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
      return wordPlan(data, data.words.find(w => w.t === id) ?? data.words[0], opts, deps)
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

/** Every Japanese and Latin character a plan may set, for the font loader. */
export function sampleText(pl) {
  const parts = [JSON.stringify(pl.t), JSON.stringify(pl.slides), JSON.stringify(pl.hook), JSON.stringify(pl.quiz || {}),
    pl.handle, 'Tsuji問題もんだい正解0123456789/·（　）＿→＋＝…']
  return [...new Set(parts.join(''))].join('')
}
