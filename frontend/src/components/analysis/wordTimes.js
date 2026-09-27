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
// Where a line's source measured nothing, or not its start or its end,
// the whole track says how its lines are timed (passageTiming): its
// pace, and how early its subtitles come up.
//
// Pure: the subtitle (SubtitleLine) asks which word is being said at a
// time, and the playhead (playhead.js) says what time it is.

// Small kana ride on the beat before them; っ, ん and ー are beats.
const SMALL = new Set(Array.from('ぁぃぅぇぉゃゅょゎゕゖァィゥェォャュョヮヵヶ'))
const KANA = /[ぁ-ゖァ-ヺー]/u
const KANJI = /[㐀-鿿豈-﫿々〆]/u
const LETTER = /[\p{L}\p{N}]/u
// A mark between words where a speaker breathes: two beats of time.
const BREATH = /[\s、。，．,.!?！？…「」『』（）()〜~♪]/u
const PAUSE = 2

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

// The line's last mora is held half a beat longer: speakers and singers
// alike lengthen the end of a phrase.
//
// These two were set on real timing (2026-09-27): every word's start in
// JSUT's 4,400 read sentences (sarulab-speech/jsut-label) and in the
// 50 sung songs of the Kiritan database (r9y9/kiritan_singing), each
// line placed by its beats between its first sound and its last. A
// breath lasts about two beats, spoken or sung, and the last mora half
// a beat more: the word lit is the word said 78% of the time in speech
// and 49% in song, from 68% and 46% with half a beat and one.
const FINAL = 0.5
// How many measurements a track's pace or habit is read from, at least.
const ENOUGH = 8
// A line's cue is taken for its speech unless it runs more than this
// many times what its words take at the track's pace: then it is held
// through a pause its words do not fill.
const HELD = 4
// A track slower than this a beat is sung (speech runs 0.09 to 0.15 s a
// beat on YouTube's tracks, songs 0.17 to 0.36).
const SUNG = 0.16

// The beats before each code point of a line: cum[o], cum[0] = 0. A mark
// between two said words is a breath, whether or not the tokenizer made
// a token of it (it makes one of 、 。 and the full-width space, and
// until 2026-09-27 those counted nothing: no line breathed there);
// the marks before the first word and after the last count nothing.
function beatLine(sentence) {
  const chars = Array.from(sentence.text ?? '')
  const n = chars.length
  const weight = new Array(n).fill(0)
  for (const tok of sentence.tokens ?? []) {
    const width = Math.max(1, tok.end - tok.start)
    const each = beatsOf(tok) / width
    for (let i = tok.start; i < tok.end && i < n; i += 1) weight[i] = each
  }
  let first = -1
  let last = -1
  weight.forEach((w, i) => {
    if (w > 0) {
      if (first === -1) first = i
      last = i
    }
  })
  for (let i = first + 1; i < last; i += 1) if (weight[i] === 0 && BREATH.test(chars[i])) weight[i] = PAUSE
  if (last !== -1) weight[last] += FINAL
  const cum = [0]
  for (let i = 0; i < n; i += 1) cum.push(cum[i] + weight[i])
  return { n, cum }
}

// The anchors a line's source measured: in order in both offset and
// time, and inside the line.
function measured(sentence, n) {
  const out = []
  for (const [o, t] of sentence.word_times ?? []) {
    if (!(o >= 0 && o <= n && t >= sentence.cue_start && t <= sentence.cue_end)) continue
    const prev = out[out.length - 1]
    if (prev && (o <= prev[0] || t <= prev[1])) continue
    out.push([o, t])
  }
  return out
}

function timed(s) {
  return s && s.cue_start != null && s.cue_end != null && s.cue_end > s.cue_start && (s.tokens?.length ?? 0) > 0
}

function median(xs) {
  const a = [...xs].sort((x, y) => x - y)
  return a[Math.floor(a.length / 2)]
}

// What a whole track says about its lines' timing, for the lines it did
// not measure: {secondsPerBeat, overrun}, or null.
//
// The pace is the median of what its measured lines took a beat between
// two words measured; with too few of those, what its lines' cues give a
// beat, the median line's.
//
// The overrun is how far past its speech the track's cues run, as a
// share of the speech: the median over the lines measured from their
// first word to their speech's end, and never less than 1 -- a
// transcript's cues run on. Not for a sung track: a singer holds a
// line's last note past the last word the recogniser times, so its end
// is measured early and its cue, which does hug the singing, would read
// as running on.
export function passageTiming(sentences) {
  const paces = []
  const overruns = []
  const loose = []
  for (const s of sentences ?? []) {
    if (!timed(s)) continue
    const { n, cum } = beatLine(s)
    if (!(cum[n] > 0)) continue
    const known = measured(s, n)
    if (known.length === 0) {
      loose.push((s.cue_end - s.cue_start) / cum[n])
      continue
    }
    const [first, last] = [known[0], known[known.length - 1]]
    if (cum[first[0]] === 0 && last[0] >= n && last[1] > first[1]) {
      overruns.push((s.cue_end - first[1]) / (last[1] - first[1]))
    }
    for (let k = 1; k < known.length; k += 1) {
      const [oa, ta] = known[k - 1]
      const [ob, tb] = known[k]
      // An anchor at the line's length is where its speech ends, the
      // held last word and all: not a word's start.
      if (ob >= n) continue
      const beats = cum[ob] - cum[oa]
      if (beats >= 1) paces.push((tb - ta) / beats)
    }
  }
  let secondsPerBeat = null
  if (paces.length >= ENOUGH) secondsPerBeat = median(paces)
  else if (loose.length >= ENOUGH) secondsPerBeat = median(loose)
  const spoken = secondsPerBeat !== null && secondsPerBeat < SUNG
  const overrun = spoken && overruns.length >= ENOUGH ? Math.max(1, median(overruns)) : null
  return secondsPerBeat || overrun ? { secondsPerBeat, overrun } : null
}

// {start, end, tokens: [{start, end, said}]} -- when the line and each
// of its words start and end -- or null for a Sentence with no cue
// times (a typed or photographed Passage) or no words.
//
// Between two anchors the words are spread by their beats, from the
// cue's start where the first word was not measured. Where the end was
// not, the cue says it, as far as the whole track's cues run past their
// speech (`timing`, passageTiming); unless its words would take a
// quarter of that at the track's pace, and it is held through a pause:
// then they are said at the pace, and the subtitle held after. Set on
// YouTube's own tracks, 2026-09-27: lyric cues hug their singing, and a
// pace carried over a line said it early.
export function tokenTimes(sentence, timing = null) {
  if (!timed(sentence)) return null
  const start = sentence.cue_start
  const end = sentence.cue_end
  const tokens = sentence.tokens
  const { n, cum } = beatLine(sentence)
  const pace = timing?.secondsPerBeat > 0 ? timing.secondsPerBeat : null
  const overrun = timing?.overrun > 1 ? timing.overrun : 1
  const known = measured(sentence, n)

  const anchors = []
  const head = known[0]
  if (!head || cum[head[0]] > 0) anchors.push([0, start])
  for (const [o, t] of known) {
    const prev = anchors[anchors.length - 1]
    if (prev && (o <= prev[0] || t <= prev[1])) continue
    anchors.push([o, t])
  }
  const tail = anchors[anchors.length - 1]
  if (tail[0] < n) {
    let said = tail[1] + (end - tail[1]) / overrun
    const paced = pace ? tail[1] + (cum[n] - cum[tail[0]]) * pace : Infinity
    if (said - tail[1] > HELD * (paced - tail[1])) said = paced
    if (said > tail[1]) anchors.push([n, said])
  }

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
