import { useEffect } from 'react'
import { useDesk } from '../../hooks/useDesk'
import { dialogOpen } from '../../lib/dialogOpen'
import { useDeparture } from '../../stores/departure'

// ── 机 — the two keys a session begins and ends on (plan 114) ───────
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
  return /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(el.tagName)
}

// Enter takes a screen's one filled action: the end of a run
// (DoneMessage, Today's cleared screen), the gate card's departure.
export function EnterKey({ onEnter, disabled = false }) {
  const desk = useDesk()
  useEffect(() => {
    if (!desk || disabled || !onEnter) return undefined
    const onKey = e => {
      if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (ownKey(e.target) || dialogOpen()) return
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
      if (e.key !== 'Escape' || e.repeat) return
      if (dialogOpen() || document.documentElement.hasAttribute('data-levelup')) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return
      setTimeout(() => { if (!e.defaultPrevented) onLeave() }, 0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desk, onLeave])
  return null
}
