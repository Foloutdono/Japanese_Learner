import { useContext, useEffect } from 'react'
import { useDesk } from '../../hooks/useDesk'
import { RunPanelsContext } from '../study/runPanels'
import { dialogOpen } from '../../lib/dialogOpen'
import { useDeparture } from '../../stores/departure'
import { guideHeld } from '../../stores/guide'
import { composing, pressedByPointer, trackPresses } from '../../lib/keyGuards'

// ── 机 — the two keys a session begins and ends on (plan 115) ───────
// A whole session from Today used to need the pointer twice: to depart
// from the gate card, and to leave the run at its end. On the desk,
// Enter departs and Esc leaves. Both render nothing and listen only on
// the desk; a phone never meets them.
//
// Neither takes a key that is someone else's: not from a field, not
// under a dialog, and Enter not on a focused button or link, which
// Enter already activates.

function ownKey(el) {
  if (!el || el === document.body || el === document.documentElement) return false
  if (el.isContentEditable) return true
  // A control that has the focus only because the pointer pressed it
  // (Chrome focuses a clicked button) does not own Enter: a learner who
  // clicks a lane off and presses Enter means to depart, and the lane's
  // own Enter pressed it again and turned it back on (plan 123).
  if (pressedByPointer(el)) return false
  return /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(el.tagName)
}


// Enter takes a screen's one filled action: the end of a run
// (DoneMessage, Today's cleared screen), the gate card's departure.
export function EnterKey({ onEnter, disabled = false }) {
  const desk = useDesk()
  useEffect(() => {
    if (!desk || disabled || !onEnter) return undefined
    trackPresses()
    const onKey = e => {
      if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (composing(e) || ownKey(e.target) || dialogOpen()) return
      e.preventDefault()
      onEnter()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desk, disabled, onEnter])
  return null
}

// Enter departs from Today's gate card (components/station/GateCard).
// Not while a departure is already under way.
export function DepartKey({ onDepart, disabled = false }) {
  const departing = useDeparture()
  return <EnterKey onEnter={onDepart} disabled={disabled || Boolean(departing)} />
}

// Esc leaves a run the way its ‹ does (components/chrome/StageHead,
// the exam's own head). Not under a dialog or the level-up board, and
// not when another Esc on the page has already been spent — a docked
// entry closing (components/analysis/SideLookup) prevents the default,
// and that is only known once the event has been through every
// listener, so the decision waits for it.
export function LeaveKey({ onLeave }) {
  const desk = useDesk()
  useEffect(() => {
    if (!desk || !onLeave) return undefined
    const onKey = e => {
      if (e.key !== 'Escape' || e.repeat || composing(e)) return
      // Not under a dialog or the level board, and not while the 改札
      // still plays over the first ride (guideHeld): its Esc skips the
      // cutscene, and used to decline the whole ride too (plan 123).
      if (dialogOpen() || guideHeld() || document.documentElement.hasAttribute('data-levelup')) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return
      setTimeout(() => { if (!e.defaultPrevented) onLeave() }, 0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desk, onLeave])
  return null
}

// A key cap printed on the control it presses (plan 113), on the desk
// only -- and not on a run's panels (plan 126), whose left column lists
// the keys instead. Rendered inside the run, so it reads the panels'
// context where the run's own component (outside the stage) cannot.
export function KeyCap({ children }) {
  const desk = useDesk()
  const panels = useContext(RunPanelsContext)
  if (!desk || panels) return null
  return <kbd className="desk-kbd" aria-hidden="true">{children}</kbd>
}
