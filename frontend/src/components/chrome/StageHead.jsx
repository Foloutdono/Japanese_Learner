import { Leave } from './Bar'
import { HudPass } from './Hud'
import { LeaveKey } from './DeskKeys'
import { useDesk } from '../../hooks/useDesk'
import { useLang } from '../../LangContext'
import { useEscHeld } from '../../stores/escHold'

// ── The head of a run (plan 068; used from plan 070) ──────────
// Both bars have left; this row is what a session keeps: the way out
// (‹ Gate, ‹ Kanji, ‹ Practice), where you are in two registers, the
// remaining count as a gold pill, and the same pocket pass the HUD
// shows — the balance, inside the run (plan 069).
//
// `aside` is a screen's own control in the row, before the pass — the
// writing-practice toggle a kanji session keeps (plan 070).
//
// `pass` is on by default, and a run that spends nothing still keeps
// it: the stage frame takes the HUD away, so this row is the only
// place inside a run where the balance can be read and the sheet
// reached. The fast review is the case that says so — a browse rates
// nothing and is charged nothing, and it shows the pass anyway,
// because a learner deciding what to do next is exactly who wants to
// see what is left. It comes off only where the surface is a whole
// mode outside the fare: the practice sessions and the exam runner
// (docs/design/mobile/README.md).
//
// On the desk Esc takes the way out too (plan 115, DeskKeys), its cap
// printed on it -- unless a door in the run's side holds the key
// (stores/escHold, plan 123), when the cap goes: it said "leave" while
// Esc closed the entry.
export function StageHead({ onLeave, leaveLabel, where, sub, remaining, pass = true, onPass, aside }) {
  const desk = useDesk()
  const lang = useLang()
  const held = useEscHeld()
  const esc = desk && !held
  return (
    <div className="stage__head">
      <Leave onClick={onLeave} keys={esc ? 'Escape' : undefined}>
        {leaveLabel}
        {esc && <kbd className="desk-kbd" aria-hidden="true">{lang?.t.keyEscape}</kbd>}
      </Leave>
      <LeaveKey onLeave={onLeave} />
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
