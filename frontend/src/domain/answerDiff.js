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
  const gap = (gi, gj, ri, rj) => {
    const g = a.slice(gi, gj)
    const r = b.slice(ri, rj)
    if (!g.length && !r.length) return
    const gf = fa.slice(gi, gj).join('')
    const rf = fb.slice(ri, rj).join('')
    if (g.length && gf === rf) out.push({ kind: 'same', text: g.join(' ') })
    else if (g.length && r.length && loosen(gf) === loosen(rf)) out.push({ kind: 'near', given: g.join(' '), right: r.join(' ') })
    else if (!g.length) out.push({ kind: 'missing', right: r.join(' ') })
    else if (!r.length) out.push({ kind: 'extra', given: g.join(' ') })
    else out.push({ kind: 'miss', given: g.join(' '), right: r.join(' ') })
  }
  let i = 0
  let j = 0
  for (const [pi, pj] of pairs) {
    gap(i, pi, j, pj)
    out.push({ kind: 'same', text: a[pi] })
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
