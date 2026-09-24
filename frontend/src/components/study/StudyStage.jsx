import { StageHead } from '../chrome/StageHead'
import { LevelBar } from '../chrome/LevelBar'
import { XpToast } from '../rewards/XpToast'
import { openBalance } from '../../stores/credits'
import { useDesk } from '../../hooks/useDesk'
import { EntryDockContext } from './entryDock'

// ── The run's frame (plan 070) ────────────────────────────────
// The canvas's <main class="stage">: both bars have left, the head
// row is what a session keeps (‹ the way out, where you are, the
// remaining count, the pocket pass), and everything a screen puts
// inside — the progress hairline, the assist toggles, the card, the
// answer widget, the rating bar — stacks under it in one column. On
// a phone the card grows to fill the column and the rating bar docks
// on the bottom edge (index.css, the ≤768px block on .stage).
//
// A frame, deliberately, not a session: the six study screens keep
// their own useCardSession/useReviewGates wiring and per-mode logic
// (this plan re-skins the stage, not the session), and hand this
// component the head's words and the toast. Kana/Vocab/Kanji/Grammar/
// Study leave to their mode picker; Today leaves to the gate.
//
// `side` is the desk's column beside the card (plan 114): the session
// panel on a card run (components/study/SessionPanel.jsx), the sentence
// breakdown on a graded practice run. Drawn only on the desk, where the
// stage makes room for it on the right (index.css, the 机 block); a
// phone never renders it, and a run that passes none gets the phone's
// single column centred on the desk as before. Inside a stage with a
// side, a revealed card docks its dictionary entry there (entryDock).
//
// `records` says the run rates and keeps a tally (stores/runTally): on
// the desk, with a side, its floor is then the console (plan 122) — the
// rating tiles' row fixed above the level bar, the bar holding this
// run's three figures beside the fare, and the card growing to it. The
// six card runs pass it; a browse, a practice run and the rides do not,
// and keep the strip. A phone reads nothing of it.
export function StudyStage({
  color, onLeave, leaveLabel, where, sub, remaining, pass = true, aside,
  toast, onToastDone, className = '', levelBar = true, side, sideLabel, records = false, children,
}) {
  const desk = useDesk()
  const split = desk && side !== undefined
  const figures = split && records
  const classes = ['container', 'stage', className].filter(Boolean).join(' ')
  return (
    <div className={split ? `screen desk-run${figures ? ' desk-run--console' : ''}` : 'screen'}>
      {toast !== undefined && <XpToast toast={toast} onDone={onToastDone} />}
      <main id="main-content" className={classes} style={color ? { '--line-color': color } : undefined}>
        <EntryDockContext.Provider value={split}>
          <StageHead
            onLeave={onLeave} leaveLabel={leaveLabel}
            where={where} sub={sub} remaining={remaining}
            pass={pass} onPass={openBalance} aside={aside}
          />
          {children}
        </EntryDockContext.Provider>
      </main>
      {/* The level bar, docked under whatever the stage docks (the
          rating bar, the field): the fare's home on a run, since the
          stage frame took the HUD away. See components/chrome/LevelBar.jsx.
          `levelBar={false}` is for the one phase that is bounded to the
          screen and can pay nothing — the comprehension passage. */}
      {levelBar && <LevelBar records={figures} />}
      {split && <RunSide label={sideLabel} color={color}>{side}</RunSide>}
    </div>
  )
}

// The run's side column, and the line it is on (plan 115). It is the
// stage's sibling, not its child, so it does not inherit the stage's
// --line-color: what it holds (a breakdown's open rail, a word's
// underline) fell back to --accent, which is kana's vermillion, on
// every other line. It wears the run's colour itself; a docked
// dictionary entry keeps the dictionary's gold (.desk-entry). Exported
// for a run that is not a StudyStage — the exam runner draws its own.
export function RunSide({ label, color, children }) {
  return (
    <aside className="desk-run__side" aria-label={label} style={color ? { '--line-color': color } : undefined}>
      {children}
    </aside>
  )
}
