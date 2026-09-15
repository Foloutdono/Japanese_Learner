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
// read for the word examples that still say so.

export function SenseNumeral({ number, className = '' }) {
  return (
    <span className={`dict-sense__n ${className}`.trim()}>
      {number}
    </span>
  )
}

export function ExampleSentence({ ex, senseNumber, showTr = true, revealed = false, blankLabel }) {
  const translation = ex.tr ?? ex.en
  return (
    <div className="dict-ex">
      {senseNumber != null && <SenseNumeral number={senseNumber} className="dict-ex__n" />}
      <div className="dict-ex__jp" lang="ja">
        {ex.segments?.length > 0
          ? ex.segments.map((seg, j) => {
              // Each segment (a word, a kanji compound, a kana run) is
              // its own non-breaking unit — the line can wrap between
              // segments but never inside one, so a word never gets
              // split with a single trailing kanji/kana stranded alone
              // on the next line. Already split per kanji by the
              // backend (content/vocab_extras.py's _expand_furigana),
              // so this renders the segment as-is.
              if (seg.blank) {
                return revealed
                  ? <mark key={j} className="dict-ex__hl dict-ex__seg gl-blank--revealed">{seg.answer ?? seg.text}</mark>
                  : <span key={j} className="dict-ex__seg gl-blank" aria-label={blankLabel}>{seg.text}</span>
              }
              const content = seg.reading
                ? <ruby>{seg.text}<rt>{seg.reading}</rt></ruby>
                : seg.text
              return seg.highlight
                ? <mark key={j} className="dict-ex__hl dict-ex__seg">{content}</mark>
                : <span key={j} className="dict-ex__seg">{content}</span>
            })
          : ex.jp}
      </div>
      {showTr && translation && <div className="dict-ex__tr">{translation}</div>}
    </div>
  )
}
