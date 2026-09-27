// ── 字幕の流れ — when each word of a subtitle is said ─────────────
// A video Sentence knows when it starts and ends (cue_start, cue_end)
// and, where its source said so, when some of its words start:
// `word_times`, [offset, seconds] with the offset a code-point offset
// into its text (backend/study/captions.py for a file's karaoke stamps,
// backend/study/word_timing.py for the recogniser's times lent to a
// hand-written line). Anchors are sparse, and a line with none is
// common, so every word between two anchors is placed by its length in
// morae: the beats of Japanese speech, which a word's reading counts
// and its letters do not (今日 is two letters and two beats, きょう
// three letters and the same two).
//
// Pure: the subtitle (SubtitleLine) asks which word is being said at a
// time, the clock (the player's poll, carried forward between polls)
// says what time it is.

// Small kana ride on the beat before them; っ, ん and ー are beats.
const SMALL = new Set(Array.from('ぁぃぅぇぉゃゅょゎゕゖァィゥェォャュョヮヵヶ'))
const KANA = /[ぁ-ゖァ-ヺー]/u
const KANJI = /[㐀-鿿豈-﫿々〆]/u
const LETTER = /[\p{L}\p{N}]/u
// A mark between words where a speaker breathes: half a beat of time.
const BREATH = /[\s、。，．,.!?！？…「」『』（）()〜~♪]/u
const PAUSE = 0.5

export function morae(s) {
  let n = 0
  for (const c of s ?? '') if (KANA.test(c) && !SMALL.has(c)) n += 1
  return n
}

// A word's length in beats: its reading's morae; without a reading,
// its kana, two beats a kanji, and half a beat a Latin letter or digit
// (a sung "What" is two). Zero for a word that is not said at all.
export function beatsOf(tok) {
  const read = morae(tok?.reading)
  if (read) return read
  let n = 0
  for (const c of Array.from(tok?.surface ?? '')) {
    if (KANA.test(c)) n += SMALL.has(c) ? 0 : 1
    else if (KANJI.test(c)) n += 2
    else if (LETTER.test(c)) n += 0.5
  }
  return n
}

// {start, end, tokens: [{start, end, said}]} -- when the line and each
// of its words start and end -- or null for a Sentence with no cue
// times (a typed or photographed Passage) or no words.
export function tokenTimes(sentence) {
  const start = sentence?.cue_start
  const end = sentence?.cue_end
  const tokens = sentence?.tokens ?? []
  if (start == null || end == null || !(end > start) || tokens.length === 0) return null

  const chars = Array.from(sentence.text ?? '')
  const n = chars.length
  const weight = new Array(n).fill(0)
  const covered = new Array(n).fill(false)
  for (const tok of tokens) {
    const width = Math.max(1, tok.end - tok.start)
    const each = beatsOf(tok) / width
    for (let i = tok.start; i < tok.end && i < n; i += 1) {
      weight[i] = each
      covered[i] = true
    }
  }
  chars.forEach((c, i) => { if (!covered[i] && BREATH.test(c)) weight[i] = PAUSE })
  const cum = [0]
  for (let i = 0; i < n; i += 1) cum.push(cum[i] + weight[i])

  // The anchors, in order in both offset and time and inside the line;
  // the line's own start and end where the source gave none there. An
  // anchor at the line's length is where its speech ends (the aligner
  // sets one): the words are said by then, the line held after.
  const anchors = [[0, start]]
  for (const [o, t] of sentence.word_times ?? []) {
    if (!(o >= 0 && o <= n && t >= start && t <= end)) continue
    const last = anchors[anchors.length - 1]
    if (o === 0) {
      if (anchors.length === 1) last[1] = t
      continue
    }
    if (o <= last[0] || t <= last[1]) continue
    anchors.push([o, t])
  }
  const last = anchors[anchors.length - 1]
  if (last[0] < n && end > last[1]) anchors.push([n, end])

  const timeAt = o => {
    let k = 0
    while (k < anchors.length - 1 && anchors[k + 1][0] < o) k += 1
    const [o0, t0] = anchors[k]
    const next = anchors[k + 1]
    if (!next || o <= o0) return t0
    const [o1, t1] = next
    const span = cum[o1] - cum[o0]
    const frac = span > 0 ? (cum[o] - cum[o0]) / span : (o - o0) / (o1 - o0)
    return t0 + (t1 - t0) * frac
  }

  return {
    start,
    end,
    tokens: tokens.map(tok => ({
      start: timeAt(tok.start),
      end: timeAt(Math.min(tok.end, n)),
      said: beatsOf(tok) > 0,
    })),
  }
}

// Which word is being said at `t`, and how far through it:
// {index, progress}, index -1 in the line before its first word, or
// null outside the line altogether.
export function sungAt(times, t) {
  if (!times || t == null || t < times.start || t >= times.end) return null
  let index = -1
  times.tokens.forEach((tok, i) => { if (tok.said && tok.start <= t) index = i })
  if (index === -1) return { index, progress: 0 }
  const tok = times.tokens[index]
  const progress = tok.end > tok.start ? Math.min(1, Math.max(0, (t - tok.start) / (tok.end - tok.start))) : 1
  return { index, progress }
}
