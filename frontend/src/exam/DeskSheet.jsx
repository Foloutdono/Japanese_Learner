import { Link } from 'react-router-dom'
import { useLang } from '../LangContext'
import { FlagIcon } from '../components/ui/Icons'

// ── 机 — the answer sheet (解答用紙, plan 200) ────────────────────
// The owner's mix of the canvas "Tsuji — the mock exam on the desk",
// direction A: the booklet on the left, and in the run's side the
// sheet a JLPT desk has beside it -- a row per question under its
// part's name, the question's ovals in a row, filled in the pencil's
// ink as the answer is given. It replaces the chips grid (plan 115),
// which said whether a question was answered but not with what.
//
// The rows of a part read down two columns, as the printed sheet's do.
// A part with three spoken answers (発話表現, 即時応答) has three ovals.
//
// Three readings of one drawing:
//   MarkSheet   the run's: an oval answers its question and opens it,
//               the number opens it; the open row lit, a flagged row
//               flagged, a blank one owed while the hand-in asks.
//   MarkSheet `blank`, the cover's: the sheet on the desk before the
//               clock, nothing on it to press.
//   MarkedSheet the result's: the sheet marked -- the right oval filled
//               in the verdict's green, a wrong pick struck, the answer
//               a blank owed ringed -- each row a link to its question.

/** Questions in the parts they belong to, in the paper's order. */
function sheetParts(questions) {
  const parts = []
  questions.forEach((q, i) => {
    let part = parts.find(p => p.id === q.mondaiId)
    if (!part) {
      part = { id: q.mondaiId, number: q.mondaiNumber, name: q.mondaiName ?? null, rows: [] }
      parts.push(part)
    }
    part.rows.push({ q, i })
  })
  return parts
}

const choicesOf = q => q.choices ?? q.pieces ?? []

/** A bubble's digit in a box of its own, so it can be centred on its
 *  ink (`text-box`, which a bare text node in a flex box escapes). */
export function Figure({ n }) {
  return <span className="desk-bubble-fig">{n}</span>
}

function PartHead({ part, fig, named = false }) {
  const { t } = useLang()
  const fr = named && part.name ? t.examMondai[part.name] : null
  return (
    <div className="desk-mark__head">
      <span className="desk-mark__no" lang="ja">問題{part.number}</span>
      <span className="desk-mark__jp" lang="ja">{part.name ?? t.examPart(part.number)}</span>
      {fr && <span className="desk-mark__fr">{fr}</span>}
      <span className="desk-mark__fig">{fig}</span>
    </div>
  )
}

/**
 * questions — the paper's flattened questions
 * answers, flagged, index — the runner's state
 * onJump(i), onMark(i, choiceId) — the run's; absent on the cover
 * blank — the cover's sheet: nothing filled, nothing to press
 * owe — the hand-in is asking: the blank rows are owed
 */
export function MarkSheet({ questions, answers = {}, flagged = new Set(), index = -1, onJump, onMark, blank = false, owe = false }) {
  const { t } = useLang()
  const parts = sheetParts(questions)
  return (
    <div className="desk-marksheet" aria-hidden={blank || undefined}>
      {parts.map(part => {
        const here = part.rows.some(r => r.i === index)
        const done = part.rows.filter(r => answers[r.q.id] != null).length
        return (
          <section
            key={part.id}
            className={here ? 'desk-mark desk-mark--here' : 'desk-mark'}
            aria-label={part.name ?? t.examPart(part.number)}
          >
            <PartHead part={part} fig={`${done} / ${part.rows.length}`} />
            <div className="desk-mark__rows" style={{ '--rows': Math.ceil(part.rows.length / 2) }}>
              {part.rows.map(({ q, i }) => {
                const given = answers[q.id] ?? null
                const isFlagged = flagged.has(q.id)
                const cls = [
                  'desk-mark-row',
                  i === index && 'desk-mark-row--here',
                  owe && given == null && 'desk-mark-row--owe',
                ].filter(Boolean).join(' ')
                if (blank) {
                  return (
                    <div key={q.id} className={cls}>
                      <span className="desk-mark-row__n">{q.number}</span>
                      {choicesOf(q).map((c, k) => <span key={c.id} className="desk-oval"><Figure n={k + 1} /></span>)}
                    </div>
                  )
                }
                return (
                  <div
                    key={q.id}
                    className={cls}
                    role="group"
                    aria-label={t.examSheetRow(q.number, given != null)}
                    aria-current={i === index ? 'true' : undefined}
                  >
                    <button
                      type="button"
                      className="desk-mark-row__n"
                      onClick={() => onJump(i)}
                      aria-label={t.examSheetChip(q.number, given != null, isFlagged)}
                    >
                      {q.number}
                    </button>
                    {choicesOf(q).map((c, k) => {
                      const on = given === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={on ? 'desk-oval desk-oval--on' : 'desk-oval'}
                          role="radio"
                          aria-checked={on}
                          tabIndex={-1}
                          aria-label={t.examOval(q.number, k + 1)}
                          onClick={() => onMark(i, c.id)}
                        >
                          <Figure n={k + 1} />
                        </button>
                      )
                    })}
                    {isFlagged && <FlagIcon size={12} filled className="desk-mark-row__flag" />}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/**
 * groups — ExamResult's parts: [{key, number, name, correct, rows: [{id, q, given, isCorrect}]}]
 * openId — the question open beside the sheet
 * rowTo(id) — the URL of a row's question (plan 117)
 * navState — the router state that rides with it
 * onOpen() — the click's sound
 */
export function MarkedSheet({ groups, openId, rowTo, navState, onOpen }) {
  const { t } = useLang()
  return (
    <div className="desk-marksheet desk-marksheet--marked">
      {groups.map(group => {
        const part = { number: group.number, name: group.name ?? null }
        const low = group.correct / group.rows.length < 0.6
        return (
          <section key={group.key} className="desk-mark" aria-label={part.name ?? t.examPart(part.number)}>
            <PartHead part={part} named fig={<span className={low ? 'desk-mark__low' : undefined}>{group.correct} / {group.rows.length}</span>} />
            <div className="desk-mark__rows" style={{ '--rows': Math.ceil(group.rows.length / 2) }}>
              {group.rows.map(r => {
                const open = r.id === openId
                const state = r.isCorrect ? 'ok' : r.given == null ? 'blank' : 'x'
                const cls = [
                  'desk-mark-row',
                  open && 'desk-mark-row--here',
                  state === 'blank' && 'desk-mark-row--owe',
                ].filter(Boolean).join(' ')
                return (
                  <Link
                    key={r.id}
                    replace
                    to={rowTo(r.id)}
                    state={navState}
                    className={cls}
                    onClick={onOpen}
                    aria-current={open ? 'page' : undefined}
                    tabIndex={open ? 0 : -1}
                    aria-label={t.examSheetResult(r.q.number, state)}
                  >
                    <span className="desk-mark-row__n">{r.q.number}</span>
                    {choicesOf(r.q).map((c, k) => {
                      const oval = c.id === r.q.answer
                        ? (r.isCorrect ? 'desk-oval desk-oval--got' : 'desk-oval desk-oval--right')
                        : c.id === r.given ? 'desk-oval desk-oval--x' : 'desk-oval'
                      return <span key={c.id} className={oval}><Figure n={k + 1} /></span>
                    })}
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
