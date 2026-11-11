import { Leave } from './Bar'
import { HudPass } from './Hud'
import { RunHelp } from './RunHelp'
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
// `keys` off (plan 126): the run's panels list the keys, so the way out
// prints no cap there. They list them behind `help`, a "?" in this row
// (RunHelp, from stores/runKeys), which a run on the panels turns on.
//
// 両端 -- doors at the ends, the place in the middle (2026-10-20, the
// owner's pick C of the canvas "Tsuji -- the run's head, centred"). The
// name used to start wherever the way out ended, so it stood off the
// screen's middle by however long "‹ Niveaux" or "‹ Pratique" was. Now
// the row is three: the way out at one end, what you can press at the
// other (the screen's `aside`, the "?", the pass), both ends growing
// alike so the name stands on the middle, and under the name everything
// that counts -- the sub, the remaining pill and the `tally` (a run's
// streak, RunStreak). The way out is its chevron alone, its place kept
// as its name and its tooltip, since a lone ‹ is what leaves a run on
// every phone; `leaveWord` prints the word for a way out that is not a
// way back (the first ride's Passer).
export function StageHead({ onLeave, leaveLabel, leaveWord = false, where, sub, remaining, tally, pass = true, onPass, aside, keys = true, help = false }) {
  const desk = useDesk()
  const lang = useLang()
  const held = useEscHeld()
  const esc = desk && !held && keys
  const counts = sub || remaining != null || tally
  return (
    <div className="stage__head">
      <span className="stage__end">
        <Leave onClick={onLeave} keys={esc ? 'Escape' : undefined} bare={!leaveWord} title={leaveWord ? undefined : leaveLabel}>
          {leaveWord ? leaveLabel : <span className="sr-only">{leaveLabel}</span>}
          {esc && <kbd className="desk-kbd" aria-hidden="true">{lang?.t.keyEscape}</kbd>}
        </Leave>
      </span>
      <LeaveKey onLeave={onLeave} />
      <span className="stage__where">
        <h1 className="stage__where-jp">{where}</h1>
        {counts && (
          <span className="stage__where-line">
            {sub && <span className="stage__where-latin">{sub}</span>}
            {remaining != null && <span className="today-remaining">{remaining}</span>}
            {tally}
          </span>
        )}
      </span>
      <span className="stage__end stage__end--end">
        {aside}
        {help && <RunHelp />}
        {pass && <HudPass onClick={onPass} />}
      </span>
    </div>
  )
}
