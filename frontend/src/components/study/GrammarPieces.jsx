import { MeaningDisplay } from './QuizComponents'
import { FuriganaParts } from './Readings'
import { joinRuns } from '../../domain/rubyRuns'
import { ExampleSentence } from '../dictionary/ExampleSentence'

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
//
// `parts` is the pattern's furigana (the card's `grammar_furigana`,
// from the catalogue's own reading -- study/grammar_examples.
// pattern_furigana): 中 read なか over 〜の中で. Always on, never a
// hint: a reading names no rule, the same call fill_in's sentence
// makes below. A pattern with no kanji, or a written card's own rule,
// has no reading and prints as text.
export function GrammarRule({ text, parts, size = 48 }) {
  const n = (text || '').length
  const scale = n <= 4 ? 1 : n <= 8 ? 0.8 : n <= 12 ? 0.62 : 0.5
  return (
    <div className={`grammar-rule${hasReading(parts) ? ' grammar-rule--ruby' : ''}`}
         style={{ '--rule-size': `${Math.round(size * scale)}px` }} lang="ja">
      <GrammarPattern text={text} parts={parts} />
    </div>
  )
}

// The pattern as text, or as ruby when it has a reading: what
// GrammarRule sets as a headline, the fast review as its card, an
// option as its row.
export function GrammarPattern({ text, parts }) {
  return hasReading(parts) ? <FuriganaParts parts={parts} /> : text
}

// The formation line under the rule ("group + の中で"), read the same
// way: `parts` is the card's `structure_furigana`, from the catalogue's
// `structure_reading` (or, on a written card, the rule's reading or the
// tokenizer's). A run's readings joined into one, so a small line's
// kanji are not pushed apart by readings wider than they are.
export function GrammarStructure({ text, parts }) {
  if (!text) return null
  return (
    <div className="grammar-structure">
      <GrammarPattern text={text} parts={joinRuns(parts)} />
    </div>
  )
}

// An option that is a pattern -- fill_in's and b2f's choices, the
// contrast drill's rivals -- read as the rule is: `readings` is the
// card's `choices_furigana`, keyed by pattern. Every pattern option sits
// on the same ruby-ready line, with a reading or without, so the rows of
// one question stay one height.
export function GrammarChoice({ text, readings }) {
  return (
    <span className="grammar-choice" lang="ja">
      <GrammarPattern text={text} parts={readings?.[text]} />
    </span>
  )
}

function hasReading(parts) {
  return Boolean(parts?.some(part => part.reading))
}

// Rule + its structure line + what it means — the three things that
// together ARE the answer, in one block. Every mode on both screens
// reveals exactly this, so they share it rather than each assembling
// the same three elements in a slightly different order.
export function GrammarAnswer({ card, size = 44, divided = false }) {
  return (
    <div className={`grammar-answer${divided ? ' grammar-answer--divided' : ''}`}>
      <GrammarRule text={card.grammar} parts={card.grammar_furigana} size={size} />
      <GrammarStructure text={card.structure} parts={card.structure_furigana} />
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
// text, which is what this always showed. The translation is `tr`, in
// the learner's language (plan 087).
export function GrammarFillSentence({ card, echo = false, revealed = false }) {
  const sentence = card.fill_sentence
  if (!sentence?.jp) return null
  const parts = sentence.furigana?.length ? sentence.furigana : [{ text: sentence.jp }]
  const translation = sentence.tr ?? sentence.en
  return (
    <div className={`grammar-fill-sentence${echo ? ' grammar-fill-sentence--echo' : ''}`}>
      <div className="grammar-fill-sentence__jp" lang="ja">
        <FuriganaParts parts={parts} />
      </div>
      {revealed && translation && (
        <div className="grammar-fill-sentence__en">{translation}</div>
      )}
    </div>
  )
}

// ── contrast's sentence (plan 087) ───────────────────────────
// The pattern blanked out of one of its own sentences; the rivals are
// the choices under the card. Until the answer is out the gap stays a
// gap and the translation stays hidden, for the reason fill_in hides
// its own; once it is, the gap prints the pattern back in the line's
// ink and the translation under it.
export function GrammarContrastSentence({ card, revealed = false, t }) {
  const c = card.contrast
  if (!c?.jp) return null
  // The answer printed back into the gap carries the rule's furigana.
  const answer = <GrammarPattern text={c.answer ?? card.grammar} parts={card.grammar_furigana} />
  const segments = (c.furigana?.length ? c.furigana : [{ text: c.jp }]).map(seg => (
    seg.blank ? { ...seg, answer } : seg
  ))
  return (
    <div className="grammar-fill-sentence grammar-contrast">
      <ExampleSentence ex={{ jp: c.jp, tr: c.tr, segments }} showTr={revealed} revealed={revealed} blankLabel={t?.glBlank} />
    </div>
  )
}
