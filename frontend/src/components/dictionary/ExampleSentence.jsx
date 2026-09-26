// ── One example sentence, everywhere one is printed ────────────
// Furigana'd Japanese with the headword or the pattern picked out in
// the entry's ink, over its translation. It was private to the
// dictionary's plate; the grammar lesson prints the same object in the
// run's gate, the station's sheet and the dictionary alike (plan 087),
// so it lives on its own now and the three cannot drift apart.
//
// `segments` are the backend's furigana parts, {text, reading?,
// highlight?, blank?}: `highlight` is the pattern (or the headword)
// picked out; `blank` is the contrast drill's gap, the pattern taken
// out of its own sentence (study/grammar_examples.py). `revealed`
// prints the gap's text back, marked — the answer, once it is out.
// `showTr` holds the translation back: the lesson's toggle, and the
// drill until the answer is out ("only" in "I drank only water" IS
// だけ). The translation is `tr`, in the learner's language; `en` is
// read for the word examples that still say so. `tag` is a word set
// beside the sentence: the lesson's register, where a sentence departs
// from its point's (plan 146).
//
// The backend's parts are one kanji each (vocab_extras._expand_furigana),
// and a reading is wider than its kanji: がく over 学 and せい over 生
// spread 学生 into 学 生, a word printed as two. Neighbouring parts of
// ONE word -- the backend says which with `word` -- that are marked
// alike are set as one ruby here: 学生 under がくせい. Two words never
// are, even side by side: 毎年 and 軽井沢 joined put まいとしかるいざわ
// over five kanji, a reading no one could divide, and a part without
// `word` stays on its own.
//
// A reading may overhang the kana either side (index.css,
// .dict-ex__ruby--over), as a printed book sets it -- only where there
// IS kana on both sides (`over`): overhanging a kanji, or another
// word's reading, is two readings colliding, and overhanging one side
// only would pull the reading off its word's centre.
//
// Two words' rubies side by side (`abuts`) keep a space between their
// readings (.dict-ex__ruby--abuts), so まいとし and かるいざわ read as
// two.
//
// A part that is only closing punctuation rides on the part before it
// (`tail`): 。 alone on a line is a line opening on a full stop, which
// Japanese never sets, and the backend cuts it off where the pattern's
// highlight ends.
const CLOSING = /^[、。，．！？」』）〕】]+$/
// Kana, the long-vowel mark and full-width punctuation: what a reading
// may overhang. Not a kanji, and not Latin, whose letters are narrower.
const OVERHANGABLE = /^[\u3000-\u303f\u3041-\u30ff\uff01-\uff0f\uff1a-\uff20\uff5b-\uff65]$/u

function wordRuby(segments) {
  const out = []
  for (const seg of segments ?? []) {
    const prev = out[out.length - 1]
    if (prev && !prev.blank && !seg.blank && !seg.reading && !seg.highlight && CLOSING.test(seg.text)) {
      out[out.length - 1] = { ...prev, tail: (prev.tail ?? '') + seg.text }
    } else if (
      prev && prev.reading && seg.reading && !prev.tail && !prev.blank && !seg.blank
      && prev.word != null && prev.word === seg.word
      && !!prev.highlight === !!seg.highlight
    ) {
      out[out.length - 1] = { ...prev, text: prev.text + seg.text, reading: prev.reading + seg.reading }
    } else {
      out.push(seg)
    }
  }
  return out.map((seg, i) => (seg.reading
    ? { ...seg, over: overhangs(out[i - 1], seg, out[i + 1]), abuts: abuts(seg, out[i + 1]) }
    : seg))
}

// Whether the ruby `seg` is followed straight away by another word's
// ruby: 毎年軽井沢, two words whose readings would otherwise run on as
// まいとしかるいざわ with nothing to say where one ends.
function abuts(seg, after) {
  return !seg.tail && !!after && !after.blank && !!after.reading
}

// Whether the ruby `seg` has kana against it on both sides.
function overhangs(before, seg, after) {
  const plain = s => s && !s.blank && !s.reading
  const left = plain(before) ? [...before.text].at(-1) : null
  const right = seg.tail ? seg.tail[0] : plain(after) ? [...after.text][0] : null
  return !!left && !!right && OVERHANGABLE.test(left) && OVERHANGABLE.test(right)
}

export function SenseNumeral({ number, className = '' }) {
  return (
    <span className={`dict-sense__n ${className}`.trim()}>
      {number}
    </span>
  )
}

export function ExampleSentence({ ex, senseNumber, showTr = true, revealed = false, blankLabel, tag }) {
  const translation = ex.tr ?? ex.en
  const segments = wordRuby(ex.segments)
  return (
    <div className="dict-ex">
      {senseNumber != null && <SenseNumeral number={senseNumber} className="dict-ex__n" />}
      <div className="dict-ex__jp" lang="ja">
        {segments.length > 0
          ? segments.map((seg, j) => {
              // Each segment (a word, a kanji compound, a kana run) is
              // its own non-breaking unit — the line can wrap between
              // segments but never inside one, so a word never gets
              // split with a single trailing kanji/kana stranded alone
              // on the next line. One kanji each from the backend,
              // a word's run joined by wordRuby above.
              if (seg.blank) {
                return revealed
                  ? <mark key={j} className="dict-ex__hl dict-ex__seg gl-blank--revealed">{seg.answer ?? seg.text}</mark>
                  : <span key={j} className="dict-ex__seg gl-blank" aria-label={blankLabel}>{seg.text}</span>
              }
              const content = seg.reading
                ? <ruby className={[seg.over && 'dict-ex__ruby--over', seg.abuts && 'dict-ex__ruby--abuts'].filter(Boolean).join(' ') || undefined}>{seg.text}<rt>{seg.reading}</rt></ruby>
                : seg.text
              if (seg.tail) {
                return (
                  <span key={j} className="dict-ex__seg">
                    {seg.highlight ? <mark className="dict-ex__hl">{content}</mark> : content}{seg.tail}
                  </span>
                )
              }
              return seg.highlight
                ? <mark key={j} className="dict-ex__hl dict-ex__seg">{content}</mark>
                : <span key={j} className="dict-ex__seg">{content}</span>
            })
          : ex.jp}
      </div>
      {tag && <span className="dict-ex__tag">{tag}</span>}
      {showTr && translation && <div className="dict-ex__tr">{translation}</div>}
    </div>
  )
}
