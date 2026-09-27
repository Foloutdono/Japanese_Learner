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

// The line's last mora is held a beat longer: speakers and singers alike
// lengthen the end of a phrase.
const FINAL = 1
// How many measurements a track's pace or lead is read from, at least.
const ENOUGH = 8
// The share of a track's unmeasured lines at or under which its pace is
// read off their cues: a line's cue is its speech and some slack, never
// less, so the fullest lines are the closest to the speech's own pace.
const FULLEST = 0.4

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
// not measure: {secondsPerBeat, lead}, or null. The pace is the median
// of what its measured lines took a beat between two words measured;
// with too few of those, it is read off the cues of the lines with no
// measurement at all, the fullest of them. The lead is how long the
// track's subtitles come up before their first word is said, the median
// over the lines whose first word was measured, and never less than 0.
export function passageTiming(sentences) {
  const paces = []
  const leads = []
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
    if (cum[known[0][0]] === 0) leads.push(known[0][1] - s.cue_start)
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
  else if (loose.length >= ENOUGH) {
    const a = [...loose].sort((x, y) => x - y)
    secondsPerBeat = a[Math.floor(a.length * FULLEST)]
  }
  const lead = leads.length >= ENOUGH ? Math.max(0, median(leads)) : 0
  return secondsPerBeat || lead ? { secondsPerBeat, lead } : null
}

// {start, end, tokens: [{start, end, said}]} -- when the line and each
// of its words start and end -- or null for a Sentence with no cue
// times (a typed or photographed Passage) or no words.
//
// Between two anchors the words are spread by their beats. Before the
// first and after the last, `timing` (passageTiming, the whole track's)
// carries them at the track's own pace: a line whose first word was not
// measured starts that many beats before the first one that was, or
// after the track's lead where none was; a line whose end was not
// measured ends when its beats have been said, and the subtitle is held
// after -- where it used to be spread over the whole cue, the hold and
// the pause after it too. Without `timing`, the cue's own start and end.
export function tokenTimes(sentence, timing = null) {
  if (!timed(sentence)) return null
  const start = sentence.cue_start
  const end = sentence.cue_end
  const tokens = sentence.tokens
  const { n, cum } = beatLine(sentence)
  const pace = timing?.secondsPerBeat > 0 ? timing.secondsPerBeat : null
  const known = measured(sentence, n)

  const anchors = []
  const head = known[0]
  if (!head || cum[head[0]] > 0) {
    // A track whose subtitles are not known to come up early (a lead
    // of 0: none measured, or measured on time) starts the words with
    // the cue -- a recognised track's line starts at its first word.
    let t0 = start
    const lead = timing?.lead > 0 ? timing.lead : 0
    if (head && pace && lead) t0 = Math.max(start, head[1] - cum[head[0]] * pace)
    else if (!head && lead) t0 = start + Math.min(lead, (end - start) / 2)
    anchors.push([0, t0])
  }
  for (const [o, t] of known) {
    const prev = anchors[anchors.length - 1]
    if (prev && (o <= prev[0] || t <= prev[1])) continue
    anchors.push([o, t])
  }
  const tail = anchors[anchors.length - 1]
  if (tail[0] < n) {
    let said = end
    if (pace) said = Math.min(end, tail[1] + (cum[n] - cum[tail[0]]) * pace)
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
