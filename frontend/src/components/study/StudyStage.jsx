import { useState } from 'react'
import { StageHead } from '../chrome/StageHead'
import { LevelBar } from '../chrome/LevelBar'
import { XpToast } from '../rewards/XpToast'
import { openBalance } from '../../stores/credits'
import { useDesk } from '../../hooks/useDesk'
import { useLang } from '../../LangContext'
import { EntryDockContext } from './entryDock'
import { RunPanelsContext } from './runPanels'
import { RunPanel } from './RunPanel'

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
// the desk, with a side, the run then stands on three panels (plan 126,
// `.desk-run--panels`): at the left the session panel (RunPanel — this
// run's figures, the level bar as a row of it, the deck's composition
// from `progress`, the remaining count, which leaves the head) over the
// run's own `panel` (the card panel, components/study/CardPanel.jsx);
// the card in the middle with its tiles framed under it; the card's
// details at the right (`side`). The elements under it print no key
// caps (RunPanelsContext — the card panel lists the keys), and no level
// strip docks on the floor. The six card runs pass it, and since plan
// 129 the five practice runs do too (reading, translation, dictation,
// composition, comprehension): their `panel` is the run's lines
// (components/study/RunLines.jsx), their `side` the sentence's
// breakdown, the lesson or the text, and `recordsLabel` names what the
// figures count. A browse and the rides pass none, and keep the side
// alone. A phone reads nothing of it. A run whose batch failed stands an empty column
// (side={null}, plan 123) and no panels beside its error; `done` is the
// run's end, and one that rated nothing keeps no three zeros either
// (RunRecords).
export function StudyStage({
  color, onLeave, leaveLabel, where, sub, remaining, pass = true, aside,
  toast, onToastDone, className = '', levelBar = true, side, sideLabel, records = false, done = false,
  panel = null, progress = null, recordsLabel = null, children,
}) {
  const desk = useDesk()
  const { t } = useLang()
  const split = desk && side !== undefined
  const panels = split && records && side !== null
  const classes = ['container', 'stage', className].filter(Boolean).join(' ')
  // 進級 (plans 142, 172): on the desk the level-up's card docks at the
  // top of a run's column rather than floating over it -- the left column
  // on three panels, whose level bar row it just topped off, else the
  // side. Held as state from the column's ref so the card is portalled
  // into the element that is actually standing.
  const [dock, setDock] = useState(null)
  return (
    <RunPanelsContext.Provider value={panels}>
    <div className={split ? `screen desk-run${panels ? ' desk-run--panels' : ''}` : 'screen'}>
      {toast !== undefined && <XpToast toast={toast} onDone={onToastDone} dock={split ? dock : null} />}
      {panels && (
        <aside className="desk-run__left" aria-label={t.deskRunLabel} ref={setDock}>
          <RunPanel remaining={remaining} progress={progress} done={done} label={recordsLabel} />
          {panel}
        </aside>
      )}
      <main id="main-content" className={classes} style={color ? { '--line-color': color } : undefined}>
        <EntryDockContext.Provider value={split}>
          <StageHead
            onLeave={onLeave} leaveLabel={leaveLabel}
            where={where} sub={sub} remaining={panels ? undefined : remaining}
            pass={pass} onPass={openBalance} aside={aside} keys={!panels}
          />
          {children}
        </EntryDockContext.Provider>
      </main>
      {/* The level bar, docked under whatever the stage docks (the
          rating bar, the field): the fare's home on a run, since the
          stage frame took the HUD away. See components/chrome/LevelBar.jsx.
          `levelBar={false}` is for the one phase that is bounded to the
          screen and can pay nothing — the comprehension passage. On the
          desk's panels the session panel draws it instead. */}
      {levelBar && !panels && <LevelBar />}
      {split && <RunSide label={sideLabel} color={color} ref={panels ? undefined : setDock}>{side}</RunSide>}
    </div>
    </RunPanelsContext.Provider>
  )
}

// The run's side column, and the line it is on (plan 115). It is the
// stage's sibling, not its child, so it does not inherit the stage's
// --line-color: what it holds (a breakdown's open rail, a word's
// underline) fell back to --accent, which is kana's vermillion, on
// every other line. It wears the run's colour itself; a docked
// dictionary entry keeps the dictionary's gold (.desk-entry). Exported
// for a run that is not a StudyStage — the exam runner draws its own.
// `ref` is the column's, for the level-up's pass to dock in (plan 142).
export function RunSide({ label, color, children, ref }) {
  return (
    <aside ref={ref} className="desk-run__side" aria-label={label} style={color ? { '--line-color': color } : undefined} data-guide="run.side">
      {children}
    </aside>
  )
}
