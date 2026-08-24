import { useLang } from '../LangContext'
import { FlagIcon } from '../components/ui/Icons'

// ── Answer sheet ─────────────────────────────────────────────
// The numbered grid under the question, named for the thing it stands
// in for: on a paper JLPT the answer sheet is what tells you at a
// glance what you still owe, and the paper itself is what lets you
// skip a hard question and come back to it.
//
// The runner had neither. It was strictly linear — Prev/Next only,
// with Finish appearing on the last question — so a learner who
// skipped question 3 had no way to find it again and no way to submit
// without walking to the end, and the only account of what was left
// blank was a "3 / 21 answered" string that named a count and not
// which ones. This replaces that string (and the redundant "4 / 21"
// position counter beside the timer): both facts are in the grid, and
// stated per question rather than in aggregate.
//
// Presentational only — every piece of state is owned by ExamRunner,
// which is also what persists it into the draft.
export default function AnswerSheet({ questions, answers, flagged, index, onJump }) {
  const { t } = useLang()

  return (
    <div className="exam-sheet">
      <div className="exam-sheet__head">
        <span className="exam-sheet__title">{t.examSheetTitle}</span>
        {/* A legend, because three chip states drawn in fill and outline
            are not self-evident on first sight — and the flag state in
            particular has no other explanation anywhere on screen. */}
        <span className="exam-sheet__legend">
          <span className="exam-sheet__legend-item">
            <span className="exam-sheet__swatch exam-sheet__swatch--answered" aria-hidden="true" />
            {t.examAnswered}
          </span>
          <span className="exam-sheet__legend-item">
            <span className="exam-sheet__swatch" aria-hidden="true" />
            {t.examSheetBlank}
          </span>
          <span className="exam-sheet__legend-item">
            <FlagIcon size={12} filled className="exam-sheet__legend-flag" />
            {t.examSheetFlagged}
          </span>
        </span>
      </div>

      <div className="exam-sheet__grid" role="group" aria-label={t.examSheetTitle}>
        {questions.map((q, i) => {
          const isAnswered = answers[q.id] != null
          const isFlagged = flagged.has(q.id)
          const isCurrent = i === index
          const cls = [
            'exam-sheet__chip',
            isAnswered && 'exam-sheet__chip--answered',
            isFlagged && 'exam-sheet__chip--flagged',
            isCurrent && 'exam-sheet__chip--current',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={q.id}
              type="button"
              className={cls}
              onClick={() => onJump(i)}
              // The fill/outline/corner-mark distinction is invisible to
              // a screen reader, so each chip says its own state rather
              // than announcing a bare number four times over.
              aria-label={t.examSheetChip(q.number, isAnswered, isFlagged)}
              aria-current={isCurrent ? 'true' : undefined}
            >
              {q.number}
            </button>
          )
        })}
      </div>
    </div>
  )
}
