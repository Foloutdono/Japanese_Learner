import { CheckIcon } from '../ui/Icons'

// ── The tutor's review, at a glance ──
// Two runs draw it: 翻訳 (screens/TranslationRun.jsx), where it reads
// a translation attempt against a reference, and 作文
// (screens/CompositionRun.jsx, plan 125), where it reads a sentence
// the learner wrote from a grammar point and there is no reference at
// all. The shape is study/tutor_review.py's; this only draws it.
//
// Since plan 184 (the practice card, the owner's pick A) it is drawn
// in three places rather than one block. The verdict stands at the end
// of the learner's answer well (translation) or leads the summary
// (composition): TutorVerdict. The corrected sentence is the learner's
// own line put right, so it stands with that line -- under the answer
// in the well (Corrected), or as the sentence itself, corrected in place
// (composition, PracticeCard's CorrectedInPlace). What is left here is
// the notes: one sentence saying why, what to fix numbered with its fix
// under it, and what was right as one quiet line, so the two fixes weigh
// more than the three things that were fine. Whether the point was used
// is the point's tag's check (PracticeCard's PointTag), and what the
// learner's sentence says is the line under it.
const VERDICT_KEY = {
  correct: 'reviewCorrect', acceptable: 'reviewAcceptable',
  partial: 'reviewPartial', incorrect: 'reviewIncorrect',
}

/** The tutor's verdict, as a badge in its state's ink. */
export function TutorVerdict({ review, t }) {
  const verdict = VERDICT_KEY[review?.verdict] ? review.verdict : 'partial'
  return <span className={`type-badge rvw__verdict rvw__verdict--${verdict}`}>{t[VERDICT_KEY[verdict]]}</span>
}

/** The notes: the summary (led by the verdict when `verdict`), the
 *  fixes numbered with what to write instead, and what worked. */
export function TutorReview({ review, t, verdict = false }) {
  const good = review.good ?? []
  const fix = review.fix ?? []
  return (
    <div className="rvw">
      {(verdict || review.summary) && (
        <div className="rvw__head">
          {verdict && <TutorVerdict review={review} t={t} />}
          {review.summary && <span className="rvw__summary">{review.summary}</span>}
        </div>
      )}
      {fix.length > 0 && (
        <ol className="rvw__fixes" aria-label={t.reviewFix}>
          {fix.map((item, i) => (
            <li key={i} className="rvw__row">
              <span className="rvw__n" aria-hidden="true">{i + 1}</span>
              <span className="rvw__item">{item.issue}</span>
              {item.fix && <span className="rvw__fix"><span aria-hidden="true">→ </span><span className="rvw__to">{item.fix}</span></span>}
            </li>
          ))}
        </ol>
      )}
      {good.length > 0 && (
        <ul className="rvw__right" aria-label={t.reviewGood}>
          {good.map((item, i) => (
            <li key={i} className="rvw__good"><CheckIcon size={11} className="rvw__tick" />{item}</li>
          ))}
        </ul>
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
