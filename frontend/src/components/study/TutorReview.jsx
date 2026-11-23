import { CheckIcon } from '../ui/Icons'

// ── The tutor's review, at a glance ──
// Two runs draw it: 翻訳 (screens/TranslationRun.jsx), where it reads
// a translation attempt against a reference, and 作文
// (screens/CompositionRun.jsx, plan 125), where it reads a sentence
// the learner wrote from a grammar point and there is no reference at
// all. The shape is study/tutor_review.py's; this only draws it.
//
// Since plan 185 (the practice card, the owner's pick A) it is drawn
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
//
// Weighed (plan 330, the owner's pick C of the canvas "Translation
// review"): a translation's fixes carry a `severity`, and the notes lead
// with the weight. A real error is a card of its own, the change large
// (what the learner wrote struck, what to write after it); the ones that
// are only less natural (Japanese that was right) shrink to a line each,
// in the near ink. Each has a Détail button that asks the asking, whose
// thread is the answer (components/study/AskDetail.jsx): `onDetail(item,
// n)` is the caller's, `asked` the numbers already asked. A review whose
// fixes carry no severity (composition's) keeps the rows it always had.
const VERDICT_KEY = {
  correct: 'reviewCorrect', acceptable: 'reviewAcceptable',
  partial: 'reviewPartial', incorrect: 'reviewIncorrect',
}

/** The tutor's verdict, as a badge in its state's ink. */
export function TutorVerdict({ review, t }) {
  const verdict = VERDICT_KEY[review?.verdict] ? review.verdict : 'partial'
  return <span className={`type-badge rvw__verdict rvw__verdict--${verdict}`}>{t[VERDICT_KEY[verdict]]}</span>
}

/** What a fix changes, as the line of Japanese it is: what the learner
 *  wrote, then what to write. An error strikes what went; a natural one
 *  was right, so it is only shown. A word left out is +, one that goes is
 *  its own text alone. */
function Change({ item }) {
  const { given = '', fix = '' } = item
  const natural = item.severity === 'natural'
  if (given && fix) {
    return (
      <>
        {natural ? <span className="rvw-chg__was">{given}</span> : <s className="rvw-chg__was">{given}</s>}
        <span className="rvw-chg__arrow" aria-hidden="true">→</span>
        <span className="rvw-chg__to">{fix}</span>
      </>
    )
  }
  if (fix) return <span className="rvw-chg__to">+ {fix}</span>
  return natural ? <span className="rvw-chg__was">− {given}</span> : <s className="rvw-chg__was">{given}</s>
}

function DetailButton({ item, n, onDetail, asked, big = false, t }) {
  const done = asked?.has(n)
  const label = done ? t.reviewInChat : big ? t.reviewExplain : t.reviewDetail
  return (
    <button
      type="button"
      className={big ? 'rvw-btn rvw-btn--big' : 'rvw-btn'}
      onClick={() => onDetail(item, n)}
      disabled={done}
      aria-label={`${label} — ${n}`}
    >
      {label}{done ? ' ✓' : ' ›'}
    </button>
  )
}

/** The notes: the summary (led by the verdict when `verdict`), the
 *  fixes numbered with what to write instead, and what worked. */
export function TutorReview({ review, t, verdict = false, onDetail = null, asked = null }) {
  const good = review.good ?? []
  const fix = review.fix ?? []
  const weighed = fix.some(item => item.severity)
  return (
    <div className="rvw">
      {(verdict || review.summary) && (
        <div className="rvw__head">
          {verdict && <TutorVerdict review={review} t={t} />}
          {review.summary && <span className="rvw__summary">{review.summary}</span>}
        </div>
      )}
      {weighed && (
        <ol className="rvw-weighed" aria-label={t.reviewFix}>
          {fix.map((item, i) => {
            const n = i + 1
            if (item.severity === 'natural') {
              return (
                <li key={i} className="rvw-soft">
                  <span className="rvw__n rvw__n--near" aria-hidden="true">{n}</span>
                  <span className="rvw-soft__text">
                    <span className="sr-only">{t.reviewNatural}: </span>
                    <b className="rvw-soft__chg" lang="ja"><Change item={item} /></b>
                    <span className="rvw-soft__why">{item.issue}</span>
                  </span>
                  {onDetail && <DetailButton item={item} n={n} onDetail={onDetail} asked={asked} t={t} />}
                </li>
              )
            }
            return (
              <li key={i} className="rvw-big">
                <div className="rvw-big__top">
                  <span className="rvw__n" aria-hidden="true">{n}</span>
                  <span className="type-badge rvw__tag rvw__tag--error">{t.reviewFix}</span>
                </div>
                <div className="rvw-big__chg" lang="ja"><Change item={item} /></div>
                <p className="rvw-big__why">{item.issue}</p>
                {onDetail && <DetailButton item={item} n={n} onDetail={onDetail} asked={asked} big t={t} />}
              </li>
            )
          })}
        </ol>
      )}
      {!weighed && fix.length > 0 && (
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
