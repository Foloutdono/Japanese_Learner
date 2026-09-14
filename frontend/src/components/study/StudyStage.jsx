import { StageHead } from '../chrome/StageHead'
import { LevelBar } from '../chrome/LevelBar'
import { XpToast } from '../rewards/XpToast'
import { openBalance } from '../../stores/credits'

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
export function StudyStage({
  color, onLeave, leaveLabel, where, sub, remaining, pass = true, aside,
  toast, onToastDone, className = '', levelBar = true, children,
}) {
  const classes = ['container', 'stage', className].filter(Boolean).join(' ')
  return (
    <div className="screen">
      {toast !== undefined && <XpToast toast={toast} onDone={onToastDone} />}
      <main id="main-content" className={classes} style={color ? { '--line-color': color } : undefined}>
        <StageHead
          onLeave={onLeave} leaveLabel={leaveLabel}
          where={where} sub={sub} remaining={remaining}
          pass={pass} onPass={openBalance} aside={aside}
        />
        {children}
      </main>
      {/* The level bar, docked under whatever the stage docks (the
          rating bar, the field): the fare's home on a run, since the
          stage frame took the HUD away. See components/chrome/LevelBar.jsx.
          `levelBar={false}` is for the one phase that is bounded to the
          screen and can pay nothing — the comprehension passage. */}
      {levelBar && <LevelBar />}
    </div>
  )
}
