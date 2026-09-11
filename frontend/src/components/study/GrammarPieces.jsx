import { MeaningDisplay } from './QuizComponents'
import { FuriganaParts } from './Readings'

// ── Shared grammar-card pieces ──────────────────────────────
// Used by GrammarScreen (a level/tier session) AND StudyScreen (a
// personal deck session) — a grammar-structure card is studied the
// same way regardless of which screen served it, so the two share one
// definition instead of drifting apart the way StudyScreen's own copy
// of this rendering already had before this file existed.

// A grammar pattern runs anywhere from one character to sixteen
// (〜はじめる／〜おわる／〜つづける) — CharDisplay's fixed-size, no-wrap
// treatment (built for a single kanji or a short vocab compound) just
// clips the long end of that range. This wraps instead, and shrinks
// as the pattern grows so a short rule still reads as a headline
// while a long one still fits the card.
export function GrammarRule({ text, size = 48 }) {
  const n = (text || '').length
  const scale = n <= 4 ? 1 : n <= 8 ? 0.8 : n <= 12 ? 0.62 : 0.5
  return (
    <div className="grammar-rule" style={{ '--rule-size': `${Math.round(size * scale)}px` }} lang="ja">
      {text}
    </div>
  )
}

// Rule + its structure line + what it means — the three things that
// together ARE the answer, in one block. Every mode on both screens
// reveals exactly this, so they share it rather than each assembling
// the same three elements in a slightly different order.
export function GrammarAnswer({ card, size = 44, divided = false }) {
  return (
    <div className={`grammar-answer${divided ? ' grammar-answer--divided' : ''}`}>
      <GrammarRule text={card.grammar} size={size} />
      {card.structure && <div className="grammar-structure">{card.structure}</div>}
      <MeaningDisplay meaning={card.meaning} size={24} />
    </div>
  )
}

// ── fill_in's sentence ───────────────────────────────────────
// The one element this mode asks its question with, and the one it
// carries onto the reveal as context. Both screens rendered it inline
// as a bare <div> three times each, which is how the same sentence came
// to sit at three different sizes depending on which hint was on.
//
// `echo` is the stepped-back copy under the flip: the rule below it is
// the answer and this is what the answer is ABOUT.
// `revealed` says the answer is already out, and only then does the
// translation print — on the front it would give the rule away in
// English ("only" in "I drank only water" IS だけ).
//
// Furigana rides on both faces. It gives nothing away — a reading names
// no rule — and without it the card quietly asks a kanji question
// instead of a grammar one. A card whose backend could not tokenize the
// sentence (see study/furigana.align_sentence) falls back to the plain
// text, which is what this always showed.
export function GrammarFillSentence({ card, echo = false, revealed = false }) {
  const sentence = card.fill_sentence
  if (!sentence?.jp) return null
  const parts = sentence.furigana?.length ? sentence.furigana : [{ text: sentence.jp }]
  return (
    <div className={`grammar-fill-sentence${echo ? ' grammar-fill-sentence--echo' : ''}`}>
      <div className="grammar-fill-sentence__jp" lang="ja">
        <FuriganaParts parts={parts} />
      </div>
      {revealed && sentence.en && (
        <div className="grammar-fill-sentence__en">{sentence.en}</div>
      )}
    </div>
  )
}
