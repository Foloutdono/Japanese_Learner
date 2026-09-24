import { CheckIcon, CrossIcon } from '../ui/Icons'

// ── The tutor's review, at a glance ──
// A verdict, one line, then what worked and what to fix as rows a
// learner can tell apart without reading: a ✓ in the success pigment,
// a ✕ in the danger one, the fix under its issue in the quiet
// register, and the corrected sentence last when there is one. The
// shape is study/tutor_review.py's; this only draws it.
//
// Two runs draw it: 翻訳 (screens/TranslationRun.jsx), where it reads
// a translation attempt against a reference, and 作文
// (screens/CompositionRun.jsx, plan 124), where it reads a sentence
// the learner wrote from a grammar point and there is no reference at
// all. It lived inside TranslationRun until the second run needed it;
// a near-copy would have drifted inside two features (DESIGN.md,
// "What not to do").
//
// `meaning` is the one line only the second run asks for -- what the
// learner's sentence actually says, in their language -- and it is
// drawn only when the review carries it, so translation's reviews
// read exactly as they did.
const VERDICT_KEY = {
  correct: 'reviewCorrect', acceptable: 'reviewAcceptable',
  partial: 'reviewPartial', incorrect: 'reviewIncorrect',
}

export function TutorReview({ review, grammar, t }) {
  const verdict = VERDICT_KEY[review.verdict] ? review.verdict : 'partial'
  const good = review.good ?? []
  const fix = review.fix ?? []
  return (
    <div className="rvw">
      <div className="rvw__head">
        <span className={`type-badge rvw__verdict rvw__verdict--${verdict}`}>{t[VERDICT_KEY[verdict]]}</span>
        {grammar && typeof review.grammar_used === 'boolean' && (
          <span className="type-badge">
            <span lang="ja">{grammar}</span> · {review.grammar_used ? t.reviewGrammarUsed : t.reviewGrammarMissed}
          </span>
        )}
        {review.summary && <span className="rvw__summary">{review.summary}</span>}
      </div>
      {review.meaning && (
        <>
          <span className="prose__label">{t.reviewMeaning}</span>
          <span className="prose__en">{review.meaning}</span>
        </>
      )}
      {good.length > 0 && (
        <div className="rvw__list" aria-label={t.reviewGood}>
          {good.map((item, i) => (
            <div key={i} className="rvw__row">
              <span className="rvw__mark rvw__mark--ok" aria-hidden="true"><CheckIcon size={11} /></span>
              <span className="rvw__item">{item}</span>
            </div>
          ))}
        </div>
      )}
      {fix.length > 0 && (
        <div className="rvw__list" aria-label={t.reviewFix}>
          {fix.map((item, i) => (
            <div key={i} className="rvw__row">
              <span className="rvw__mark rvw__mark--x" aria-hidden="true"><CrossIcon size={11} /></span>
              <span className="rvw__item">{item.issue}</span>
              {item.fix && <span className="rvw__fix">{item.fix}</span>}
            </div>
          ))}
        </div>
      )}
      {review.better && (
        <>
          <span className="prose__label">{t.reviewBetter}</span>
          <Corrected
            parts={review.better_parts}
            text={review.better}
            romaji={review.better_romaji}
          />
        </>
      )}
    </div>
  )
}

// ── The corrected sentence, readable ──
// The learner's own sentence with the fixes applied, and until
// 2026-09-22 it was one bare line of Japanese: no readings on the
// kanji, no romaji, and no sign of which part of it was the fix. A
// learner who cannot read 新聞 cannot read the correction either, and
// one who can was left diffing two sentences by eye.
//
// So it is drawn the way every other sentence in the app is: furigana
// over the kanji, the romaji under the line, and what the tutor
// actually changed picked out in it. All three come from
// study/tutor_review.py (`better_parts`, `better_romaji`) -- the marks
// are a character diff against what the learner wrote, not a claim the
// model made about its own edits.
//
// `text` is the fallback: a backend that does not send the parts yet
// (the two deploy separately) prints exactly the line it used to.
export function Corrected({ parts, text, romaji }) {
  return (
    <div className="rvw__corrected">
      <span className="rvw__better" lang="ja">
        {parts?.length
          ? parts.map((part, i) => {
            const body = part.reading
              ? <ruby>{part.text}<rt>{part.reading}</rt></ruby>
              : part.text
            return part.highlight
              ? <mark key={i} className="rvw__fixed">{body}</mark>
              : <span key={i}>{body}</span>
          })
          : text}
      </span>
      {romaji && <span className="prose__romaji">{romaji}</span>}
    </div>
  )
}
