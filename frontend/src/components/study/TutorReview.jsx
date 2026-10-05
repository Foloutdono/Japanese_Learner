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
// own line put right, so it IS that line, corrected in place, the right
// word written small over the struck one (PracticeCard's
// CorrectedInPlace: the composed sentence, or a translation answered in
// Japanese the tutor kept most of). What is left here is
// the notes: one sentence saying why, what to fix numbered, and what was
// right as one quiet line, so the two fixes weigh more than the three
// things that were fine. Whether the point was used is the point's tag's
// check (PracticeCard's PointTag), and what the learner's sentence says
// is the line under it.
//
// A fix leads with the correction, in Japanese, and the reason is under
// it (the owner's A1.4): what to write is what the learner will keep.
// Its number is the one the sentence carries on the words it is about
// (PracticeCard's SentenceLead and CorrectedInPlace, A1.3).
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
              {item.fix && <span className="rvw__to" lang="ja">{item.fix}</span>}
              <span className={item.fix ? 'rvw__why' : 'rvw__item'}>{item.issue}</span>
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
