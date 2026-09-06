import { Leave } from './Bar'
import { HudPass } from './Hud'

// ── The head of a run (plan 068; used from plan 070) ──────────
// Both bars have left; this row is what a session keeps: the way out
// (‹ Gate, ‹ Kanji, ‹ Practice), where you are in two registers, the
// remaining count as a gold pill, and the same pocket pass the HUD
// shows — the balance a run is spending (plan 069).
//
// `aside` is a screen's own control in the row, before the pass — the
// writing-practice toggle a kanji session keeps (plan 070).
export function StageHead({ onLeave, leaveLabel, where, sub, remaining, pass = true, onPass, aside }) {
  return (
    <div className="stage__head">
      <Leave onClick={onLeave}>{leaveLabel}</Leave>
      <span className="stage__where">
        <h1 className="stage__where-jp">{where}</h1>
        {sub && <span className="stage__where-latin">{sub}</span>}
      </span>
      {remaining != null && <span className="today-remaining">{remaining}</span>}
      {aside}
      {pass && <HudPass onClick={onPass} />}
    </div>
  )
}
