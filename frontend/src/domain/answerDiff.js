// ── 照合 — an answer read against what it answers (plan 184) ──────────
// The practice card (the owner's pick A of the canvas "Tsuji — the
// practice cards") hands the learner their own answer back with the
// misses struck and the right word beside them, where the card had
// printed the answer whole and left "tchisai" against "sukoshi" for the
// learner to find. Two readings, one per kind of answer:
//
//   diffWords  -- a romaji answer (reading, dictation) against the
//                 sentence's romaji, word by word;
//   diffChars  -- a Japanese sentence (composition) against the tutor's
//                 corrected one, character by character, and
//                 correctionParts laying the corrected sentence's
//                 furigana over the result.
//
// Neither is a grade. The grade is the learner's (the rating bar, ADR
// 0013) and the figure beside the answer is the server's measure
// (study/dictation.measure_forms); this only says WHERE the answer
// parted from the sentence.

// The spelling choices, as study/romaji.fold makes them: what is a way
// of writing a sound goes, the sound stays. Kept in step with that
// module by hand; it is short and moves rarely.
const PARTICLE = { ha: 'wa', he: 'e', wo: 'o' }
const SPELLINGS = [
  ['sya', 'sha'], ['syu', 'shu'], ['syo', 'sho'],
  ['tya', 'cha'], ['tyu', 'chu'], ['tyo', 'cho'],
  ['zya', 'ja'], ['zyu', 'ju'], ['zyo', 'jo'],
  ['dya', 'ja'], ['dyu', 'ju'], ['dyo', 'jo'],
  ['jya', 'ja'], ['jyu', 'ju'], ['jyo', 'jo'],
  ['si', 'shi'], ['ti', 'chi'], ['tu', 'tsu'],
  ['zi', 'ji'], ['di', 'ji'], ['du', 'zu'],
  ['wo', 'o'],
]
// A long vowel left short is the commonest thing a beginner's ear
// drops, and the server's measure forgives it: here it is a NEAR miss,
// marked apart from a wrong word, its right spelling given.
const LONG = [['ou', 'o'], ['ei', 'e'], ['aa', 'a'], ['ii', 'i'], ['uu', 'u'], ['ee', 'e'], ['oo', 'o']]

// A macron is the long vowel spelled another way: ō is ou (or oo,
// which meets it below), not a short o.
const MACRON = { ā: 'aa', ī: 'ii', ū: 'uu', ē: 'ee', ō: 'ou', â: 'aa', î: 'ii', û: 'uu', ê: 'ee', ô: 'ou' }

function plainLetters(text) {
  return text.toLowerCase().replace(/[āīūēōâîûêô]/g, c => MACRON[c])
    .normalize('NFKD').replace(/\p{M}/gu, '')
}

// One word in the form two spellings of it meet in.
function foldWord(word) {
  const plain = plainLetters(word).replace(/[^a-z]/g, '')
  let letters = PARTICLE[plain] ?? plain
  for (const [from, to] of SPELLINGS) letters = letters.split(from).join(to)
  return letters
    .replace(/(?<![sc])hu/g, 'fu')
    .replace(/m(?=[bpm])/g, 'n')
    .replace(/n{2,}/g, 'n')
    // おお and おう are both written either way.
    .replace(/oo/g, 'ou')
}

function loosen(folded) {
  let letters = folded
  for (const [from, to] of LONG) letters = letters.split(from).join(to)
  return letters
}

// The words as typed: split on spaces and on any mark, Latin or
// Japanese, so "yasumimashou." and "yasumimashou" are one word.
export function romajiWords(text) {
  return (text ?? '').split(/[\s.,!?;:'"“”‘’()（）「」『』。、！？・…]+/u).filter(Boolean)
}

/** Whether an answer is written in the alphabet: letters, and none of
 *  them kana or kanji. A reading answered in kana is not marked at all
 *  -- its words would fold to nothing, and every one would read as a
 *  miss. */
export function isRomajiAnswer(text) {
  return /[a-z]/i.test(text ?? '') && !/[぀-ヿ㐀-鿿]/u.test(text ?? '')
}

// The longest common subsequence of two lists under `same`, as the
// pairs of indices it keeps, in order.
function commonPairs(a, b, same) {
  const n = a.length
  const m = b.length
  const len = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      len[i][j] = same(a[i], b[j]) ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1])
    }
  }
  const pairs = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (same(a[i], b[j])) { pairs.push([i, j]); i++; j++ }
    else if (len[i + 1][j] >= len[i][j + 1]) i++
    else j++
  }
  return pairs
}

/**
 * A romaji answer against the sentence's romaji, as segments in the
 * answer's order:
 *
 *   { kind: 'same', text }            a word as the learner wrote it
 *   { kind: 'near', given, right }    the same word, a long vowel short
 *   { kind: 'miss', given, right }    another word in its place
 *   { kind: 'missing', right }        a word the answer left out
 *   { kind: 'extra', given }          a word the sentence has not
 *
 * Each carries `ref`, the reference words it stands for as [from, to)
 * (empty for an added word), which refSpans places in the Japanese.
 *
 * Words run together or split apart ("kakanakerebanarimasen") are the
 * same answer and read as such. Null for an answer not in romaji.
 */
export function diffWords(given, reference) {
  if (!isRomajiAnswer(given)) return null
  const a = romajiWords(given)
  const b = romajiWords(reference)
  const fa = a.map(foldWord)
  const fb = b.map(foldWord)
  const pairs = commonPairs(fa, fb, (x, y) => x === y)
  const out = []
  const gap = (gi, gj, ri, rj, fine = true) => {
    const g = a.slice(gi, gj)
    const r = b.slice(ri, rj)
    if (!g.length && !r.length) return
    const gf = fa.slice(gi, gj).join('')
    const rf = fb.slice(ri, rj).join('')
    const ref = [ri, rj]
    if (g.length && gf === rf) out.push({ kind: 'same', text: g.join(' '), ref })
    else if (g.length && r.length && loosen(gf) === loosen(rf)) out.push({ kind: 'near', given: g.join(' '), right: r.join(' '), ref })
    else if (!g.length) out.push({ kind: 'missing', right: r.join(' '), ref })
    else if (!r.length) out.push({ kind: 'extra', given: g.join(' '), ref })
    else if (fine) {
      // Inside a stretch that parted: the words heard short first, so
      // "tchisai yasumimasho" is a wrong word and a near one, not one
      // miss two words long; then word for word where the counts agree.
      const near = commonPairs(fa.slice(gi, gj).map(loosen), fb.slice(ri, rj).map(loosen), (x, y) => x === y)
      let x = gi
      let y = ri
      for (const [pi, pj] of near) {
        gap(x, gi + pi, y, ri + pj, false)
        gap(gi + pi, gi + pi + 1, ri + pj, ri + pj + 1, false)
        x = gi + pi + 1
        y = ri + pj + 1
      }
      gap(x, gj, y, rj, false)
    } else if (g.length === r.length && g.length > 1) {
      for (let k = 0; k < g.length; k++) gap(gi + k, gi + k + 1, ri + k, ri + k + 1, false)
    } else out.push({ kind: 'miss', given: g.join(' '), right: r.join(' '), ref })
  }
  let i = 0
  let j = 0
  for (const [pi, pj] of pairs) {
    gap(i, pi, j, pj)
    out.push({ kind: 'same', text: a[pi], ref: [pj, pj + 1] })
    i = pi + 1
    j = pj + 1
  }
  gap(i, a.length, j, b.length)
  return out
}

/** How many of the segments are marked: misses, near misses, words left
 *  out and words added. */
export function markedCount(segments) {
  return (segments ?? []).filter(s => s.kind !== 'same').length
}

/**
 * A Japanese sentence against its corrected form, character by
 * character: runs of { kind: 'same' | 'del' | 'ins', text }, a struck
 * run immediately before the run that replaces it.
 */
export function diffChars(given, corrected) {
  const a = [...(given ?? '')]
  const b = [...(corrected ?? '')]
  const pairs = commonPairs(a, b, (x, y) => x === y)
  const out = []
  const push = (kind, text) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.text += text
    else out.push({ kind, text })
  }
  let i = 0
  let j = 0
  for (const [pi, pj] of [...pairs, [a.length, b.length]]) {
    push('del', a.slice(i, pi).join(''))
    push('ins', b.slice(j, pj).join(''))
    if (pi < a.length) push('same', a[pi])
    i = pi + 1
    j = pj + 1
  }
  return out
}

/** Whether a correction leaves most of what the learner wrote standing:
 *  a line rewritten end to end is no line corrected, and is not drawn
 *  as one. */
export function mostlyKept(given, corrected) {
  const kept = diffChars(given, corrected).filter(r => r.kind === 'same').reduce((n, r) => n + [...r.text].length, 0)
  return kept * 2 >= [...(given ?? '')].length
}

/**
 * diffChars' runs with the corrected sentence's furigana laid over them:
 * `parts` are study/tutor_review's `better_parts` ({ text, reading? }).
 * A run the learner kept or the tutor added carries the reading of every
 * part it holds whole; a part a run boundary cuts through is printed bare
 * rather than with half a reading. A struck run is the learner's own
 * text and has none. Returns [{ kind, parts: [{ text, reading? }] }].
 */
export function correctionParts(given, parts) {
  const corrected = (parts ?? []).map(p => p.text).join('')
  const runs = diffChars(given, corrected)
  // Where each furigana part starts in the corrected sentence.
  const spans = []
  let at = 0
  for (const p of parts ?? []) {
    spans.push({ start: at, end: at + [...p.text].length, part: p })
    at += [...p.text].length
  }
  const chars = [...corrected]
  let pos = 0
  return runs.map(run => {
    if (run.kind === 'del') return { kind: 'del', parts: [{ text: run.text }] }
    const len = [...run.text].length
    const start = pos
    const end = pos + len
    pos = end
    const pieces = []
    for (const s of spans) {
      if (s.end <= start || s.start >= end) continue
      const from = Math.max(s.start, start)
      const to = Math.min(s.end, end)
      const whole = from === s.start && to === s.end
      const text = chars.slice(from, to).join('')
      const last = pieces[pieces.length - 1]
      if (whole && s.part.reading) pieces.push({ text, reading: s.part.reading })
      else if (last && !last.reading) last.text += text
      else pieces.push({ text })
    }
    return { kind: run.kind, parts: pieces }
  })
}


// ── Where a word stands in the Japanese (plan 184, A1.3 and A2.2) ──
// The server sends the sentence's words (study/romaji.sentence_words):
// each with the characters it is written with, its reading and its
// romaji, and their texts spell the sentence back. The reference romaji
// a learner's answer is read against is those words spaced (reading,
// the ride) or the bank's own spelling (dictation, written by hand), so
// a reference word is placed by its LETTERS: the two romanizations
// folded and laid one over the other, and each reference word taken to
// the words its letters fall on.

// What a word is drawn without: a mark at either end is the sentence's,
// not the word's.
const EDGE_MARKS = /^[\s。、！？!?,.「」『』（）()・…〜ー]+|[\s。、！？!?,.「」『』（）()・…〜]+$/gu

/** A word's text or reading with the marks at its ends taken off. */
export function bareWord(text) {
  return (text ?? '').replace(EDGE_MARKS, '')
}

// [start, end) of a span with the marks at its ends left out of it.
function trimmed(sentence, start, end) {
  let s = start
  let e = end
  while (s < e && /[\s。、！？!?,.「」『』（）()・…]/u.test(sentence[s])) s++
  while (e > s && /[\s。、！？!?,.「」『』（）()・…]/u.test(sentence[e - 1])) e--
  return [s, e]
}

/**
 * Each reference word's place in the sentence: [{ start, end, words:
 * [first, last] }] in the reference's order, or null for a word whose
 * letters fall on none. Null overall when the words are missing, do not
 * spell a sentence, or line up with under half the reference's letters
 * -- a mark placed on a guess is a mark in the wrong place.
 */
export function refSpans(reference, words) {
  if (!words?.length) return null
  const b = romajiWords(reference).map(foldWord)
  const at = []
  let pos = 0
  for (const w of words) {
    at.push([pos, pos + w.text.length])
    pos += w.text.length
  }
  const R = []
  const rOwner = []
  b.forEach((f, j) => { for (const c of f) { R.push(c); rOwner.push(j) } })
  const W = []
  const wOwner = []
  words.forEach((w, k) => {
    for (const c of romajiWords(w.romaji).map(foldWord).join('')) { W.push(c); wOwner.push(k) }
  })
  if (!R.length || !W.length) return null
  let pairs
  if (R.join('') === W.join('')) pairs = R.map((_, k) => [k, k])
  else if (R.length * W.length > 200000) return null
  else pairs = commonPairs(R, W, (x, y) => x === y)
  if (pairs.length * 2 < Math.max(R.length, W.length)) return null
  // Letters each reference word lands on each word.
  const landed = b.map(() => new Map())
  for (const [ri, wi] of pairs) {
    const hits = landed[rOwner[ri]]
    hits.set(wOwner[wi], (hits.get(wOwner[wi]) ?? 0) + 1)
  }
  const letters = words.map(w => romajiWords(w.romaji).map(foldWord).join('').length)
  return landed.map(hits => {
    if (!hits.size) return null
    // The word most of its letters fall on, and any other most of whose
    // own letters it takes: a stray letter shared by chance is not a
    // word.
    const best = [...hits].sort((x, y) => y[1] - x[1])[0][0]
    const kept = [...hits].filter(([k, n]) => k === best || n * 2 >= letters[k]).map(([k]) => k)
    const first = Math.min(...kept)
    const last = Math.max(...kept)
    return { start: at[first][0], end: at[last][1], words: [first, last] }
  })
}

/**
 * The misses of an answer marked where they stand in the sentence: one
 * { start, end, kind } a span ('x' a wrong or missing word, 'near' a
 * long vowel left short), overlapping spans merged, the marks at a
 * span's ends left out. `segments` are diffWords', `spans` refSpans'.
 */
export function missMarks(sentence, segments, spans) {
  if (!segments || !spans) return []
  const marks = []
  for (const s of segments) {
    if (!['miss', 'near', 'missing'].includes(s.kind)) continue
    const placed = spans.slice(s.ref[0], s.ref[1]).filter(Boolean)
    if (!placed.length) continue
    const [start, end] = trimmed(sentence, Math.min(...placed.map(p => p.start)), Math.max(...placed.map(p => p.end)))
    if (start < end) marks.push({ start, end, kind: s.kind === 'near' ? 'near' : 'x' })
  }
  marks.sort((x, y) => x.start - y.start)
  const merged = []
  for (const m of marks) {
    const last = merged[merged.length - 1]
    if (last && m.start < last.end) {
      last.end = Math.max(last.end, m.end)
      if (m.kind === 'x') last.kind = 'x'
    } else merged.push({ ...m })
  }
  return merged
}

/**
 * The words an answer missed (a wrong word or one left out; a long
 * vowel left short is the word heard), each once, in the sentence's
 * order: the server's words, their ends' marks off, with where they
 * stand. Empty when every word was right, or none can be placed.
 */
export function missedWords(segments, spans, words) {
  if (!segments || !spans || !words?.length) return []
  const picked = new Set()
  for (const s of segments) {
    if (s.kind !== 'miss' && s.kind !== 'missing') continue
    for (const span of spans.slice(s.ref[0], s.ref[1])) {
      if (!span) continue
      for (let k = span.words[0]; k <= span.words[1]; k++) picked.add(k)
    }
  }
  const out = []
  let pos = 0
  words.forEach((w, k) => {
    const start = pos
    pos += w.text.length
    if (!picked.has(k)) return
    const text = bareWord(w.text)
    if (!text) return
    out.push({ text, kana: bareWord(w.kana), start, end: pos })
  })
  return out
}

/**
 * Furigana parts cut where the marks begin and end: runs of { mark,
 * parts }, `mark` the mark the run stands under (or null). A part with a
 * reading is never cut -- half a reading over half a kanji is no reading
 * -- and stands whole under any mark it touches.
 */
export function markParts(parts, marks) {
  const runs = []
  for (const piece of markPieces(parts, marks)) {
    const last = runs[runs.length - 1]
    if (last && last.mark === piece.mark) last.parts.push(piece.part)
    else runs.push({ mark: piece.mark, parts: [piece.part] })
  }
  return runs
}

/** markParts' pieces before they are grouped: [{ part, mark }], a part
 *  cut where a mark begins or ends (never through a reading). */
export function markPieces(parts, marks) {
  const markAt = (s, e) => (marks ?? []).find(m => m.start < e && m.end > s) ?? null
  const pieces = []
  let at = 0
  for (const p of parts ?? []) {
    const s = at
    const e = at + p.text.length
    at = e
    if (p.reading) {
      pieces.push({ part: p, mark: markAt(s, e) })
      continue
    }
    const cuts = [s, e, ...(marks ?? []).flatMap(m => [m.start, m.end]).filter(x => x > s && x < e)].sort((x, y) => x - y)
    for (let i = 0; i + 1 < cuts.length; i++) {
      if (cuts[i] === cuts[i + 1]) continue
      pieces.push({ part: { text: p.text.slice(cuts[i] - s, cuts[i + 1] - s) }, mark: markAt(cuts[i], cuts[i + 1]) })
    }
  }
  return pieces
}

// ── The sentence set as phrases (plan 184) ──
// The lead is set large and centred, and the browser broke it wherever
// a CJK line may break -- between any two characters, 買いまし|た。 --
// because its phrase detection does not see across the rubies the parts
// are drawn as. So the sentence is set as phrases, each one unbreakable
// (`.pcard-unit`): a word's kanji joined under one reading (the parts
// are one kanji each: 勉 べん + 強 きょう are 勉強 べんきょう, as the
// dictionary's examples join them), and a phrase opening at each kanji
// that follows kana, the kana after it -- okurigana, particles, the
// verb's endings -- riding with it: 九時に | 駅で | 会いましょう。.

/** Neighbouring pieces of one word, both read and under the same mark,
 *  as one: { part: { text, reading, word }, mark }. */
export function joinWords(pieces) {
  const out = []
  for (const piece of pieces) {
    const prev = out[out.length - 1]
    const a = prev?.part
    const b = piece.part
    if (a && b && a.reading && b.reading && a.word != null && a.word === b.word && prev.mark === piece.mark) {
      out[out.length - 1] = { ...prev, part: { ...a, text: a.text + b.text, reading: a.reading + b.reading } }
    } else out.push(piece)
  }
  return out
}

/** Pieces grouped into phrases: a new one at a read piece (a kanji)
 *  after one that is not, every other piece riding with the phrase
 *  before it. `read` says whether a piece is a kanji's. */
export function phrases(pieces, read = piece => Boolean(piece.part?.reading)) {
  const out = []
  pieces.forEach((piece, i) => {
    if (!out.length || (read(piece) && !read(pieces[i - 1]))) out.push([piece])
    else out[out.length - 1].push(piece)
  })
  return out
}

// ── The tutor's fixes, placed (plan 184, A1.3) ──
// The tutor names the Japanese it is talking about in 「 」, in the
// issue (what the learner wrote) and in the fix (what to write instead):
// study/tutor_review's prompt asks for exactly that. So a fix is placed
// by its quotes, never by asking the model where.

// The Japanese a note quotes, each without a reading in brackets after
// it (「十本（じゅっぽん）」 is 十本).
export function quoted(note) {
  return [...(note ?? '').matchAll(/「([^」]+)」/g)]
    .map(m => m[1].split(/[（(]/)[0].trim())
    .filter(Boolean)
}

/**
 * Where each fix stands in `sentence`, as { start, end, n } (n its
 * number, from 1): the first of its quotes, the fix's before the
 * issue's, found in the sentence and clear of an earlier fix's place. A
 * quote that is most of the sentence says nothing about where, and a fix
 * with no quote found has no place; its number stays on its row.
 */
export function fixMarks(sentence, fixes) {
  const taken = []
  ;(fixes ?? []).forEach((f, i) => {
    for (const frag of [...quoted(f.fix), ...quoted(f.issue)]) {
      if (frag.length * 10 > sentence.length * 6) continue
      let found = null
      for (let at = sentence.indexOf(frag); at >= 0; at = sentence.indexOf(frag, at + 1)) {
        if (!taken.some(t => t.start < at + frag.length && t.end > at)) { found = at; break }
      }
      if (found != null) {
        taken.push({ start: found, end: found + frag.length, n: i + 1, kind: 'x' })
        return
      }
    }
  })
  return taken.sort((x, y) => x.start - y.start)
}

/**
 * correctionParts' runs, the struck and the written grouped: [{ kind:
 * 'same', parts } | { kind: 'fix', del, ins, n }], `del` the text the
 * learner wrote that went (or ''), `ins` the parts the tutor put in (or
 * []), `n` the number of the fix that names it -- the fix whose quotes
 * hold what went in or what was taken out -- or null.
 */
export function correctionFixes(given, parts, fixes) {
  const out = []
  for (const run of correctionParts(given, parts)) {
    const last = out[out.length - 1]
    if (run.kind === 'same') { out.push({ kind: 'same', parts: run.parts }); continue }
    const fix = last?.kind === 'fix' ? last : { kind: 'fix', del: '', ins: [], n: null }
    if (fix !== last) out.push(fix)
    if (run.kind === 'del') fix.del += run.parts.map(p => p.text).join('')
    else fix.ins.push(...run.parts)
  }
  const used = new Set()
  for (const f of out) {
    if (f.kind !== 'fix') continue
    const ins = f.ins.map(p => p.text).join('')
    const i = (fixes ?? []).findIndex((note, k) => !used.has(k) && (
      (ins && quoted(note.fix).some(q => q.includes(ins)))
      || (f.del && quoted(note.issue).some(q => q.includes(f.del)))
    ))
    if (i >= 0) { used.add(i); f.n = i + 1 }
  }
  return out
}
