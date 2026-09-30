import { useLang } from '../../LangContext'
import { BoardQuestion, Continue } from '../boarding/BoardFrame'
import { INTRO_CELLS, INTRO_RUBY } from '../../domain/nyumon'

// ── 入門 — one screen of the introduction (plan 170) ─────────────
// The boarding's own frame, not a copy of it: the question over its
// drawing (BoardQuestion -- centred on a phone with the drawing as one
// block, at the paper's top-left corner on the desk), the drawing in a
// stage, and the foot with the gate at its last row and the quiet way
// out over it (plan 168's rule; on the desk the way out stands at the
// frame's top-right corner instead, screens/RideIntro.jsx). A screen
// file is only its own drawing.
export function IntroPage({ step, title, hint = null, onContinue, label = null, skip = null, children }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={hint}>{title}</BoardQuestion>
        <div className={`brd__stage nyu-stage nyu-stage--${step}`}>{children}</div>
      </div>
      <div className="brd__foot">
        {skip}
        <Continue keys label={label ?? t.onbContinue} onClick={onContinue} data-action="continue" />
      </div>
    </>
  )
}

/** The sentence's runs: consecutive characters of one script, so a lit
    script's underline runs unbroken under a word (コーヒー is one run,
    not four cells each restarting its dashes). */
function runsOf(cells) {
  const runs = []
  for (const cell of cells) {
    const last = runs[runs.length - 1]
    if (last && last.script === cell.script && cell.script !== 'kanji') last.text += cell.ch
    else runs.push({ script: cell.script, text: cell.ch })
  }
  return runs
}
const RUNS = runsOf(INTRO_CELLS)

/** 駅でコーヒーを飲みます。 with the scripts `lit` names drawn in full
    ink over their pigment's underline -- solid under hiragana, dashed
    under katakana, so the two kana are told apart without colour -- and
    the others dimmed. `ruby` prints each kanji's reading over it. */
export function IntroSentence({ lit, ruby = false, className = '' }) {
  return (
    <p className={`nyu-sent${className ? ` ${className}` : ''}`} lang="ja">
      {RUNS.map((run, i) => {
        if (!run.script) return <span key={i} className="nyu-run nyu-run--punct">{run.text}</span>
        const on = lit.includes(run.script)
        const cls = `nyu-run nyu-run--${run.script} ${on ? 'nyu-run--on' : 'nyu-run--off'}`
        if (ruby && run.script === 'kanji' && INTRO_RUBY[run.text]) {
          return (
            <ruby key={i} className={cls}>
              {run.text}
              <rt>{INTRO_RUBY[run.text]}</rt>
            </ruby>
          )
        }
        return <span key={i} className={cls}>{run.text}</span>
      })}
    </p>
  )
}
