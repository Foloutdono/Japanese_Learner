import { useLang } from '../LangContext'
import { FlagIcon } from '../components/ui/Icons'

// ── Answer sheet ─────────────────────────────────────────────
// The numbered grid, named for the thing it stands in for: on a paper
// JLPT the answer sheet is what tells you at a glance what you still
// owe, and the paper itself is what lets you skip a hard question and
// come back to it.
//
// The runner had neither. It was strictly linear — Prev/Next only,
// with Finish appearing on the last question — so a learner who
// skipped question 3 had no way to find it again and no way to submit
// without walking to the end, and the only account of what was left
// blank was a "3 / 21 answered" string that named a count and not
// which ones.
//
// Plan 072 split it in two, the way the canvas draws it: the SHEET BAR
// docked on the stage's bottom edge (one chip per question, done and
// flagged in their own inks, the count, and Finish), and the grid
// itself in a bottom sheet the bar opens — on a phone the grid took
// the room the question needed.
//
// Presentational only — every piece of state is owned by ExamRunner,
// which is also what persists it into the draft.
export default function AnswerSheet({ questions, answers, flagged, index, onJump }) {
  const { t } = useLang()

  return (
    <div className="exam-sheet">
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

// ── The phone's sheet, by part (plan 171) ─────────────────────
// The owner's pick C6 of the canvas "Tsuji — the mock exam on the
// phone": the grid read the way the paper is printed, a row of chips per
// part under the part's name and what is answered of it, the count of
// what is left over the parts, and the way out of the paper at the foot
// -- Finish, or the first blank. The sheet bar this replaces drew a chip
// per question at 8px, too small to read, and the grid ignored the parts.
export function PartsSheet({ questions, answers, flagged, index, onJump, onFinish, onFirstBlank, busy }) {
  const { t } = useLang()
  const parts = []
  questions.forEach((q, i) => {
    let part = parts.find(p => p.id === q.mondaiId)
    if (!part) {
      part = { id: q.mondaiId, number: q.mondaiNumber, name: q.mondaiName, rows: [] }
      parts.push(part)
    }
    part.rows.push({ q, i })
  })
  const answered = questions.filter(q => answers[q.id] != null).length
  const blanks = questions.length - answered
  const flags = questions.filter(q => flagged.has(q.id)).length
  return (
    <div className="exam-parts">
      <p className="exam-parts__sum">
        <span>{t.examAnsweredOf(answered, questions.length)}</span>
        {blanks > 0 && <span>{t.examBlanks(blanks)}</span>}
        {flags > 0 && (
          <span className="exam-parts__flags">
            <FlagIcon size={13} filled />
            <b>{flags}</b>
          </span>
        )}
      </p>
      {parts.map(part => {
        const done = part.rows.filter(r => answers[r.q.id] != null).length
        return (
          <div key={part.id} className="exam-parts__part">
            <div className="exam-parts__head">
              <span className="exam-parts__jp" lang="ja">{part.name ?? t.examPart(part.number)}</span>
              {part.name && t.examMondai[part.name] && <span className="exam-parts__fr">{t.examMondai[part.name]}</span>}
              <span className="exam-parts__fig">{done} / {part.rows.length}</span>
            </div>
            <div className="exam-sheet__grid" role="group" aria-label={part.name ?? t.examPart(part.number)}>
              {part.rows.map(({ q, i }) => {
                const isAnswered = answers[q.id] != null
                const isFlagged = flagged.has(q.id)
                const cls = [
                  'exam-sheet__chip',
                  isAnswered && 'exam-sheet__chip--answered',
                  isFlagged && 'exam-sheet__chip--flagged',
                  i === index && 'exam-sheet__chip--current',
                ].filter(Boolean).join(' ')
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={cls}
                    onClick={() => onJump(i)}
                    aria-label={t.examSheetChip(q.number, isAnswered, isFlagged)}
                    aria-current={i === index ? 'true' : undefined}
                  >
                    {q.number}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <button type="button" className="btn-primary exam-parts__finish" onClick={onFinish} disabled={busy}>
        {busy ? t.examSubmitting : t.examFinishPaper}
      </button>
      {blanks > 0 && (
        <button type="button" className="btn-secondary" onClick={onFirstBlank}>
          {t.examReviewBlanks}
        </button>
      )}
    </div>
  )
}
