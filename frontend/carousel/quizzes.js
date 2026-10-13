// ── カルーセル — the questions (plan 200c) ──────────────────────────
// Every question a carousel can ask about its item, in the forms the
// JLPT asks them (読み, 表記, 文脈, 文の組み立て, 読解) and in the app's
// own drills (a kana both ways, a kanji's meaning both ways, its
// strokes). The mock exam deals the ones the studio picks; the other
// carousels end on one where asked.
//
// A question has one right answer, and it is the content's own: the
// reading the furigana prints, the gloss the deck writes, the answer the
// catalogue's tour or the comprehension seed marks right. A wrong answer
// is dealt only where it cannot be right too: a reading that is not the
// word's, a spelling that is no word (carousel_bank.orthography), a
// meaning that shares no word with the right one, a translation of
// another sentence. Nothing is asked by blanking a particle out of a
// sentence, where a second particle could fit (CLAUDE.md, "A quiz
// question is one only understanding answers").
import { hasKanji, reading } from './draw.js'
import { EXAM_ASK_JP, formOf, tr, weldIf } from './strings.js'
import { deal, dealChoices, gloss, lineRomaji, readingMisses, seeded, shuffle, unpack } from './common.js'
import { lookalikesOf } from './explain.js'

// ── Meanings that cannot both be right ────────────────────────
const STOP = new Set(`the and for with from into onto than that this these those its it's one ones someone something thing
  things way sort kind very also not more most when what which who whom how about after before over under up out off
  etc les des une est sont pour par avec sur dans que qui quoi pas plus quelque chose quelqu faire etre ete aux
  ce cet cette ces son sa ses leur leurs du de la le un en au et ou ne`.split(/\s+/))
const termsOf = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w))
/** Whether two glosses could say the same thing: a word in common, or
 *  two words with one root (study / studying). */
export function overlaps(a, b) {
  const A = termsOf(a)
  const B = termsOf(b)
  if (!A.length || !B.length) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
  return A.some(x => B.some(y => x === y || (x.length >= 5 && y.length >= 5 && x.slice(0, 5) === y.slice(0, 5))))
}
/** `n` wrong meanings from `pool`, none of which shares a word with the
 *  right one (`against`, all its senses) or with each other. */
function distinctFrom(against, pool, n, seed) {
  const out = []
  for (const cand of shuffle([...new Set(pool)], seeded(seed))) {
    if (!cand || against.some(a => overlaps(a, cand)) || out.some(o => overlaps(o, cand))) continue
    out.push(cand)
    if (out.length === n) break
  }
  return out
}

/** Each question with an id unique in its plan and a label for the
 *  studio's chips, numbered where a kind comes twice (Lesson question 2). */
function withId(list, label) {
  const qs = list.filter(Boolean)
  const seen = {}
  const twice = k => qs.filter(q => q.kind === k).length > 1
  return qs.map((q, i) => {
    seen[q.kind] = (seen[q.kind] || 0) + 1
    const name = q.label || label(q)
    return { ...q, id: q.id || `${q.kind}-${i}`, label: !q.label && twice(q.kind) ? `${name} ${seen[q.kind]}` : name }
  })
}
const senses = (row, lang) => ((lang === 'fr' && row.fr?.length ? row.fr : row.en) || [])
// A meaning question deals glosses of the reader's language only: a word
// with no French gloss is neither its answer nor a wrong choice in French.
const ownGloss = (row, lang) => row?.[lang]?.[0] || ''

// ── The questions a sentence of the bank can ask ──────────────
/** 読み: the reading of the sentence's kanji word. */
function readingQ(s, row, at, bank, lang, t) {
  if (!row || !hasKanji(row.t)) return null
  const near = readingMisses(row, bank.kanji)
  if (near.length < 3) return null
  // The word printed bare, whatever the script: its furigana is the
  // answer. So are the furigana of another word that shares one of its
  // kanji (入院 over 退院), printed bare too.
  const own = new Set([...row.t].filter(hasKanji))
  const bare = r => ({ t: r.t, k: r.k, ro: r.ro, ...(r.pos ? { pos: r.pos } : {}) })
  return {
    kind: 'reading', askJp: EXAM_ASK_JP.reading, ask: t.examAsk.reading,
    stem: { rows: s.rows.map((r, i) => (i === at || (r.fu && [...r.t].some(c => own.has(c))) ? bare(r) : r)), target: at, under: true,
      after: { rows: s.rows, target: at, under: true } },
    ...dealChoices(reading(row), shuffle(near, seeded(s.id)).slice(0, 3), s.id, 'jp'),
    explain: { head: `${row.t}\u3000${reading(row)}`, sense: weldIf(lang, gloss(row, lang)[0]) },
  }
}

/** 表記: the same word printed in kana, and how it is written. */
function orthographyQ(s, row, at, lang, t) {
  if (!row || !(s.hy?.length >= 3)) return null
  const kana = { t: reading(row), k: 'word', ro: row.ro }
  return {
    kind: 'orthography', askJp: EXAM_ASK_JP.orthography, ask: t.examAsk.orthography,
    stem: { rows: s.rows.map((r, i) => (i === at ? kana : r)), target: at, under: true, script: 'kanji',
      after: { rows: s.rows, target: at, under: true } },
    ...dealChoices(row.t, s.hy.slice(0, 3), `${s.id}-hy`, 'jp'),
    explain: { head: `${reading(row)}\u3000${row.t}`, sense: weldIf(lang, gloss(row, lang)[0]) },
  }
}

/** 文脈: what the sentence's word means, among words of its kind. */
function meaningQ(s, row, at, bank, lang, t) {
  if (!row || row.k !== 'word') return null
  const answer = ownGloss(row, lang)
  if (!answer) return null
  const pool = []
  for (const other of bank.sentences) {
    for (const r of other.rows) if (r.k === 'word' && r.pos === row.pos && r.t !== row.t && ownGloss(r, lang)) pool.push(ownGloss(r, lang))
  }
  const wrong = distinctFrom(senses(row, lang), pool, 3, `${s.id}-m`)
  if (wrong.length < 3) return null
  return {
    kind: 'meaning', askJp: EXAM_ASK_JP.meaning, ask: t.examAsk.meaning,
    stem: { rows: s.rows, target: at, under: true },
    ...dealChoices(weldIf(lang, answer), wrong.map(x => weldIf(lang, x)), `${s.id}-m`, 'latin'),
    explain: { head: `${row.t}\u3000${reading(row)}`, sense: weldIf(lang, answer) },
  }
}

/** What the sentence's point does, among the meanings of its level's other points. */
function grammarQ(s, bank, lang, t) {
  const pt = bank.points[s.p]
  const answer = pt && tr(pt, lang)
  if (!answer) return null
  const rows = s.rows.map(r => ((r.g || []).includes(s.p) ? { ...r, lit: true } : r))
  if (!rows.some(r => r.lit)) return null
  const pool = Object.entries(bank.points).filter(([p, v]) => p !== s.p && v.lv === s.lv).map(([, v]) => tr(v, lang))
  const wrong = distinctFrom([answer], pool, 3, `${s.id}-g`)
  if (wrong.length < 3) return null
  return {
    kind: 'grammar', ask: t.examAsk.grammar(s.p),
    stem: { rows, underLit: true },
    ...dealChoices(answer, wrong, `${s.id}-g`, 'latin'),
    explain: { head: s.p, sense: formOf(pt, lang), why: tr(pt.rule, lang) },
  }
}

/** Which translation is the sentence's: three other sentences' beside it. */
function translationOfQ(s, bank, lang, t) {
  const answer = weldIf(lang, s[lang] || s.en)
  const others = bank.sentences.filter(x => x.id !== s.id)
  const pool = [...others.filter(x => x.p === s.p), ...shuffle(others, seeded(`${s.id}-t`))]
    .map(x => weldIf(lang, x[lang] || x.en)).filter(x => x && x !== answer)
  const wrong = [...new Set(pool)].slice(0, 3)
  if (wrong.length < 3) return null
  return {
    kind: 'translation', ask: t.examAsk.translationOf,
    stem: { rows: s.rows },
    ...dealChoices(answer, wrong, `${s.id}-t`, 'latin'),
    explain: { sense: lineRomaji(s.rows) },
  }
}

/** 文の組み立て: four pieces of the point in a row, and which goes in ★.
 *  Only where the four are the point's own pieces after the word it
 *  takes (話す・こと・が・できます), whose order the grammar fixes; a
 *  sentence's phrases (駅で・友だちに) can be said in more than one order. */
export function assemblyQ(rows, p, seed, lang, t, tr2 = '') {
  const own = rows.map((r, i) => ((r.g || []).includes(p) || r.lit ? i : -1)).filter(i => i >= 0)
  if (own.length < 3) return null
  for (let i = 1; i < own.length; i++) if (own[i] !== own[i - 1] + 1) return null
  const end = own[own.length - 1]
  const start = end - 3
  if (start < 0 || start < own[0] - 1) return null
  const piece = rows.slice(start, end + 1)
  if (piece.some(r => r.k === 'punct') || new Set(piece.map(r => r.t)).size < 4) return null
  if (piece[0].k !== 'word' && !own.includes(start)) return null
  const star = 2
  const blanks = piece.map((_, i) => ({ t: i === star ? '＿★＿' : '＿＿＿', k: 'blank', ro: '' }))
  const { choices, right } = deal(piece[star], piece.filter((_, i) => i !== star), `${seed}-a`)
  return {
    kind: 'assembly', askJp: EXAM_ASK_JP.assembly, ask: t.examAsk.assembly,
    stem: { rows: [...rows.slice(0, start), ...blanks, ...rows.slice(end + 1)], tr: tr2,
      after: { rows, target: start + star, under: true } },
    choices: choices.map(r => ({ text: r.t, fam: 'jp' })), right,
    explain: { head: piece.map(r => r.t).join(' '), sense: tr2 },
  }
}

export function sentenceQuizzes(s, bank, lang, t) {
  const at = s.fi ?? s.rows.findIndex(r => r.k === 'word')
  const row = s.rows[at]
  return withId([
    readingQ(s, row, at, bank, lang, t),
    orthographyQ(s, row, at, lang, t),
    meaningQ(s, row, at, bank, lang, t),
    grammarQ(s, bank, lang, t),
    assemblyQ(s.rows, s.p, s.id, lang, t, weldIf(lang, s[lang] || s.en)),
    translationOfQ(s, bank, lang, t),
  ], q => t.kinds[q.kind])
}

/** 翻訳: which sentence says it, then the sentence's own questions. */
export function translationQuizzes(s, bank, lang, t) {
  const translation = weldIf(lang, s[lang] || s.en)
  const others = bank.sentences.filter(x => x.id !== s.id)
  const rivals = [...others.filter(x => x.p === s.p), ...shuffle(others, seeded(s.id))].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3)
  const { choices, right } = deal(s, rivals, `${s.id}-tr`)
  const say = {
    kind: 'say', ask: t.examAsk.translation, stem: { text: translation },
    choices: choices.map(x => ({ rows: x.rows, fam: 'jp' })), right,
    explain: { sense: lineRomaji(s.rows) },
  }
  const at = s.fi ?? s.rows.findIndex(r => r.k === 'word')
  return withId([
    say,
    assemblyQ(s.rows, s.p, s.id, lang, t, translation),
    grammarQ(s, bank, lang, t),
    meaningQ(s, s.rows[at], at, bank, lang, t),
  ], q => t.kinds[q.kind])
}

// ── A grammar lesson ──────────────────────────────────────────
export function lessonQuizzes(L, data, lang, t) {
  const meaning = tr(L, lang)
  const scene = L.scene
  const ask = scene?.ask
  const sceneQ = ask ? {
    kind: 'scene', ask: t.sceneAsk,
    stem: { cue: { who: ask.cue.who, rows: unpack(ask.cue.rows), tr: weldIf(lang, ask.cue[lang] || ask.cue.en) }, task: tr(ask.task, lang), them: tr(scene.them, lang) },
    ...(() => {
      const d = deal(0, ask.choices.map((_, i) => i).slice(1), `${L.p}-scene`)
      return { choices: d.choices.map(i => ({ rows: unpack(ask.choices[i]), fam: 'jp' })), right: d.right }
    })(),
    explain: { why: tr(ask.why, lang) },
  } : null
  const tour = (L.quiz || []).map((q, n) => {
    const d = deal(0, q.choices.map((_, i) => i).slice(1), `${L.p}-quiz-${n}`)
    return {
      kind: 'tour', id: `tour-${n}`, ask: tr(q.ask, lang),
      stem: q.rows ? { rows: unpack(q.rows), tr: q.kind === 'form' ? tr(q.tr, lang) : '' } : null,
      choices: d.choices.map(i => (typeof q.choices[i] === 'string' ? { text: q.choices[i], fam: 'jp' } : { text: tr(q.choices[i], lang), fam: 'latin' })),
      right: d.right,
      explain: { why: tr(q.why, lang), sense: q.kind === 'meaning' ? tr(q.tr, lang) : '' },
    }
  })
  const pool = (data.lessons || []).filter(x => x.p !== L.p).map(x => tr(x, lang))
  const wrong = distinctFrom([meaning, tr(L.compare?.meaning, lang)].filter(Boolean), pool, 3, `${L.p}-pm`)
  const pointQ = meaning && wrong.length === 3 ? {
    kind: 'pointMeaning', ask: t.examAsk.pointMeaning, stem: { specimen: L.p },
    ...dealChoices(meaning, wrong, `${L.p}-pm`, 'latin'),
    explain: { head: L.p, sense: formOf(L, lang) },
  } : null
  const first = L.ex?.[0]
  const build = first ? assemblyQ(unpack(first.rows), L.p, `${L.p}-ex`, lang, t, weldIf(lang, first[lang] || first.en)) : null
  return withId([sceneQ, ...tour, pointQ, build], q => t.kinds[q.kind])
}

// ── A word of the deck ────────────────────────────────────────
export function wordQuizzes(w, data, lang, t, index) {
  const row = { t: w.t, fu: w.fu }
  const [main] = gloss(w, lang)
  // The deck's other readings of the same written word are right too.
  const known = (data.words || []).filter(x => x.t === w.t && x.r !== w.r).map(x => x.r)
  const near = hasKanji(w.t) ? readingMisses(row, index, known) : []
  const head = `${w.t}\u3000${w.r}`
  const readingQ2 = near.length >= 3 ? {
    kind: 'reading', ask: t.examAsk.kana, stem: { specimen: w.t },
    ...dealChoices(w.r, shuffle(near, seeded(w.t)).slice(0, 3), w.t, 'jp'),
    explain: { head, sense: weldIf(lang, main) },
  } : null
  const ortho = w.hy?.length >= 3 ? {
    kind: 'orthography', ask: t.examAsk.writtenAs, stem: { specimen: w.r },
    ...dealChoices(w.t, w.hy.slice(0, 3), `${w.t}-hy`, 'jp'),
    explain: { head: `${w.r}\u3000${w.t}`, sense: weldIf(lang, main) },
  } : null
  const wrong = distinctFrom(senses(w, lang), data.words.filter(x => x.t !== w.t).map(x => ownGloss(x, lang)), 3, `${w.t}-m`)
  const meaning = ownGloss(w, lang) && wrong.length === 3 ? {
    kind: 'meaning', ask: t.examAsk.pointMeaning, stem: { specimen: w.t },
    ...dealChoices(weldIf(lang, main), wrong.map(x => weldIf(lang, x)), `${w.t}-m`, 'latin'),
    explain: { head, sense: weldIf(lang, main) },
  } : null
  return withId([readingQ2, ortho, meaning], q => t.kinds[q.kind])
}

// ── A kanji ───────────────────────────────────────────────────
export function kanjiQuizzes(c, data, lang, t) {
  const k = data.kanji[c]
  const meaningOf = v => weldIf(lang, ((lang === 'fr' && v.fr?.length ? v.fr : v.en) || []).slice(0, 2).join(', '))
  const meaning = meaningOf(k)
  const all = senses(k, lang)
  const others = Object.entries(data.kanji).filter(([x]) => x !== c)
  const own = new Set([...k.on, ...k.kun.map(([a, b]) => a + b)])
  // An on'yomi among on'yomi; a kanji with none, a kun'yomi among kun'yomi,
  // so the script never gives the answer away.
  const kunOf = v => v.kun[0] && v.kun[0][0] + v.kun[0][1]
  const right = k.on[0] || kunOf(k)
  const readingOf = k.on[0] ? v => v.on[0] : kunOf
  const readings = [...new Set(shuffle(others.map(([, v]) => readingOf(v)).filter(r => r && !own.has(r)), seeded(c)))].slice(0, 3)
  const readingQ2 = right && readings.length === 3 ? {
    kind: 'kanji', ask: t.examAsk.kanji, stem: { specimen: c },
    ...dealChoices(right, readings, c, 'jp'), explain: { head: c, sense: meaning },
  } : null
  const wrongM = distinctFrom(all, others.map(([, v]) => meaningOf(v)), 3, `${c}-m`)
  const meaningQ2 = meaning && wrongM.length === 3 ? {
    kind: 'kanjiMeaning', ask: t.examAsk.kanjiMeaning, stem: { specimen: c },
    ...dealChoices(meaning, wrongM, `${c}-m`, 'latin'), explain: { head: `${c}\u3000${right || ''}`, sense: meaning },
  } : null
  // Its kun'yomi too, where it has an on'yomi asked above: a kun'yomi
  // among other kanji's kun'yomi (plan 200l).
  const kun = kunOf(k)
  const kuns = [...new Set(shuffle(others.map(([, v]) => kunOf(v)).filter(r => r && !own.has(r) && r !== kun), seeded(`${c}-k`)))].slice(0, 3)
  const kunQ = k.on[0] && kun && kuns.length === 3 ? {
    kind: 'kanjiKun', ask: t.examAsk.kanjiKun, stem: { specimen: c },
    ...dealChoices(kun, kuns, `${c}-k`, 'jp'), explain: { head: `${c}\u3000${kun}`, sense: meaning },
  } : null
  const n = k.s?.d?.length
  const strokes = n ? {
    kind: 'strokes', ask: t.examAsk.strokes, stem: { specimen: c },
    ...dealChoices(String(n), [n - 1, n + 1, n + 2].filter(x => x > 0).map(String).concat(n === 1 ? ['4'] : []).slice(0, 3), `${c}-s`, 'latin'),
    explain: { head: `${c}\u3000${n}`, sense: meaning },
  } : null
  // Its words, the ones of its own level or under first, then the
  // nearest above: an N5 kanji is asked 買い物 before 購買.
  const rank = x => Number((x.lv || 'N0').slice(1))
  const kr = rank(k)
  // A word far above the kanji is not asked (購買, N1, for 買, N5).
  const byLevel = [...(k.words || [])].filter(x => !k.lv || rank(x) >= kr - 2).sort((a, b) => {
    const ea = rank(a) >= kr
    const eb = rank(b) >= kr
    return ea !== eb ? eb - ea : ea ? 0 : rank(b) - rank(a)
  })
  // Words written with it, and how each reads: three at most.
  const knownOf = x => (k.words || []).filter(y => y.t === x.t && y.r !== x.r).map(y => y.r)
  const missesOf = x => readingMisses({ t: x.t, fu: [[x.t, x.r]] }, null, knownOf(x))
  // A choice is a word's first sense, to its first comma: “commerce”.
  const glossOf = x => (((lang === 'fr' && x.fr?.length ? x.fr : x.en) || [])[0] || '').split(/[,;(]/)[0].trim()
  const readable = byLevel.filter(x => x.t.length > 1 && missesOf(x).length >= 3)
  // Two senses alike, word for word or whole (“I” is no word overlaps counts).
  const alike = (a, b) => overlaps(a, b) || a.trim().toLowerCase() === b.trim().toLowerCase()
  // Never the kanji alone (私 is the word 私), nor a word meaning only what it means.
  const askable = byLevel.filter(x => x.t !== c && glossOf(x) && !((lang === 'fr' && x.fr?.length ? x.fr : x.en) || []).some(a => all.some(b => alike(a, b))))
  // A word asked one way is not asked the other: its reading would give
  // away its meaning, and its meaning its reading. The meaning questions
  // take the words the reading questions cannot use first.
  const vocabWords = [...askable.filter(x => !readable.includes(x)), ...askable.filter(x => readable.includes(x))].slice(0, 2)
  const inWords = readable.filter(x => !vocabWords.includes(x)).slice(0, 3).map((w, i) => ({
    kind: 'inWord', ask: t.examAsk.inWord, stem: { specimen: w.t },
    ...dealChoices(w.r, shuffle(missesOf(w), seeded(`${c}-w${i || ''}`)).slice(0, 3), `${c}-w${i || ''}`, 'jp'),
    explain: { head: `${w.t}\u3000${w.r}`, sense: weldIf(lang, gloss(w, lang)[0]) },
  }))
  // Which of these is a word written with it (買: 買い物 "shopping",
  // 売買 "trade"): never the word that only says the kanji's own meaning
  // (買う "to buy"), which the kanji's meaning would answer. The wrong
  // ones are words written without it, first those that share the right
  // word's other kanji (物 of 買い物); none means what a word written
  // with it means, so no second answer is right (plan 200l).
  const sensesOf = x => (lang === 'fr' && x.fr?.length ? x.fr : x.en) || []
  const deck = [...new Map(Object.values(data.kanji).flatMap(v => v.words || []).map(x => [`${x.t}|${x.r}`, x])).values()]
  const withIt = deck.filter(x => x.t.includes(c))
  const taken = withIt.flatMap(sensesOf)
  const vocab = vocabWords.map((w, i) => {
    const right = glossOf(w)
    const partners = new Set([...w.t].filter(x => x !== c && /[\u3400-\u9fff]/.test(x)))
    const pool = shuffle(deck.filter(x => !x.t.includes(c) && glossOf(x)), seeded(`${c}-v${i}`))
    const traps = pool.filter(x => [...x.t].some(y => partners.has(y)))
    const wrong = []
    for (const x of [...traps, ...pool]) {
      const g = glossOf(x)
      if (wrong.includes(g) || alike(g, right) || taken.some(a => alike(a, g)) || all.some(a => alike(a, g)) || wrong.some(a => alike(a, g))) continue
      wrong.push(g)
      if (wrong.length === 3) break
    }
    return wrong.length === 3 ? {
      kind: 'kanjiVocab', ask: t.examAsk.kanjiVocab, stem: { specimen: c },
      ...dealChoices(weldIf(lang, right), wrong.map(x => weldIf(lang, x)), `${c}-v${i}`, 'latin'),
      explain: { head: `${w.t}\u3000${w.r}`, sense: weldIf(lang, right) },
    } : null
  })
  // The readings and the words first: a mock exam asks the first three.
  return withId([readingQ2, vocab[0], inWords[0], kunQ, vocab[1], inWords[1], inWords[2], meaningQ2, strokes], q => t.kinds[q.kind])
}

// ── A kana ────────────────────────────────────────────────────
export function kanaQuizzes(card, data, lang, t) {
  const byKana = Object.fromEntries(data.kana.map(x => [x.k, x]))
  const group = lookalikesOf(card.k)
  const same = data.kana.filter(x => x.set === card.set && x.ro !== card.ro)
  const near = [...(group?.set || []).map(k => byKana[k]?.ro), ...shuffle(same.filter(x => x.group === card.group).map(x => x.ro), seeded(card.k)), ...shuffle(same.map(x => x.ro), seeded(card.k))]
  const wrong = [...new Set(near.filter(r => r && r !== card.ro))].slice(0, 3)
  const sound = {
    kind: 'kana', ask: t.examAsk.kana, stem: { specimen: card.k },
    ...dealChoices(card.ro, wrong, card.k, 'latin'),
    explain: { head: `${card.k}\u3000${card.ro}`, sense: card.twin ? `${t.otherScript[card.set]}: ${card.twin}` : '' },
  }
  // The other way round: its sound, and the kana it is mistaken for.
  const kanaOf = ro => same.find(x => x.ro === ro)?.k
  const lookalike = (group?.set || []).filter(k => k !== card.k && byKana[k]?.set === card.set && byKana[k]?.ro !== card.ro)
  const rivals = [...new Set([...lookalike, ...wrong.map(kanaOf)].filter(Boolean))].slice(0, 3)
  const reverse = rivals.length === 3 ? {
    kind: 'kanaReverse', ask: t.examAsk.kanaReverse, stem: { text: card.ro },
    ...dealChoices(card.k, rivals, `${card.k}-r`, 'serif'),
    explain: { head: `${card.ro}\u3000${card.k}`, sense: '' },
  } : null
  // Its twin in the other script, among that script's lookalikes of it.
  const twinCard = card.twin && byKana[card.twin]
  const twinGroup = twinCard ? (lookalikesOf(card.twin)?.set || []).filter(k => k !== card.twin) : []
  const twinSame = twinCard ? data.kana.filter(x => x.set === twinCard.set && x.k !== card.twin && x.ro !== card.ro) : []
  const twinWrong = [...new Set([...twinGroup, ...shuffle(twinSame.filter(x => x.group === twinCard?.group).map(x => x.k), seeded(`${card.k}-t`)), ...shuffle(twinSame.map(x => x.k), seeded(`${card.k}-t`))])].slice(0, 3)
  const twin = twinCard && twinWrong.length === 3 ? {
    kind: 'twin', ask: t.examAsk.twin[card.set], stem: { specimen: card.k },
    ...dealChoices(card.twin, twinWrong, `${card.k}-t`, 'serif'),
    explain: { head: `${card.k}\u3000${card.twin}`, sense: card.ro },
  } : null
  return withId([sound, reverse, twin], q => t.kinds[q.kind])
}

// ── A comprehension passage ───────────────────────────────────
/** Every question the seed writes (what happened, what a word means,
 *  what a form does here), then the reading of the passage's own words. */
export function passageQuizzes(P, lang, t) {
  const seedQs = (P.questions || []).map((q, n) => {
    const options = q.options[lang] || q.options.en
    const d = deal(q.correct, options.map((_, i) => i).filter(i => i !== q.correct), `${P.id}-${n}`)
    return {
      kind: 'passage', id: `q${n + 1}`, type: q.type || 'comprehension',
      ask: weldIf(lang, q.question[lang] || q.question.en), stem: null,
      choices: d.choices.map(i => ({ text: weldIf(lang, options[i]), fam: 'latin' })), right: d.right,
      explain: {},
      label: `${t.question} ${n + 1} · ${t.passageTypes[q.type] || t.passageTypes.comprehension}`,
    }
  })
  const words = (P.words || []).map(w => {
    const near = readingMisses({ t: w.t, fu: w.fu || [[w.t, w.r]] })
    if (near.length < 3) return null
    return {
      kind: 'passageReading', id: `r-${w.t}`, ask: t.examAsk.passageReading, stem: { specimen: w.t },
      ...dealChoices(w.r, shuffle(near, seeded(`${P.id}-${w.t}`)).slice(0, 3), `${P.id}-${w.t}`, 'jp'),
      explain: { head: `${w.t}\u3000${w.r}`, sense: weldIf(lang, gloss(w, lang)[0]) },
      label: `${t.kinds.passageReading} · ${w.t}`,
    }
  }).filter(Boolean).slice(0, 4)
  return withId([...seedQs, ...words], q => t.kinds[q.kind])
}
