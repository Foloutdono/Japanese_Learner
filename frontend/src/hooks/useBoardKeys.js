import { useEffect } from 'react'
import { useDesk } from './useDesk'
import { dialogOpen } from '../lib/dialogOpen'
import { composing, pressedByPointer, trackPresses } from '../lib/keyGuards'
import { PICK_KEY_DIGIT } from '../domain/choiceKeys'

// ── 乗車 — the boarding's keys on the desk (plan 122) ─────────────
// A computer answered the boarding with the pointer alone: some fifty
// presses and clicks from the name to the pass. On the desk Enter goes
// on from wherever the learner is, pressing the screen's own Continue
// (the one control in the live car that names Enter,
// components/boarding/BoardFrame's `keys`) -- so it can do nothing
// Continue could not, and a disabled Continue refuses it the same way.
//
// Whose Enter it is:
//   - a field's: the name, the account's two fields -- they have their
//     own, and a composing input method's is its own;
//   - a control's: an answer not yet picked (Enter picks it), ‹, a link,
//     Continue itself -- all keep their native Enter;
//   - except an answer already picked, or one the pointer just pressed:
//     Chrome leaves the focus on a clicked button, and Enter there
//     pressed it again -- a line clicked off came back on. From those,
//     Enter goes on, the pick as it stands.
// A digit picks the answer that names it (P12, BoardOption's `pick`):
// a motive by its row, a level by its own number, the novice on 0 --
// on either keyboard row (domain/choiceKeys PICK_KEY_DIGIT). A pick
// that advances on a tap (the kana) advances on its digit.
// Nothing while a dialog is open or the arrival plays (its own key
// skips it), and never from the car that is leaving. No Esc: on the
// desk Esc means leave, and the boarding's way out signs the guest
// pass out -- ‹ stays a Tab away.
export function useBoardKeys(frameRef, { off = false } = {}) {
  const desk = useDesk()
  useEffect(() => {
    if (!desk || off) return undefined
    trackPresses()
    const onKey = e => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || composing(e) || dialogOpen()) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
      const car = frameRef.current?.querySelector('.brd__car:not(.brd__car--out)')
      if (!car) return
      const digit = PICK_KEY_DIGIT[e.key]
      if (digit !== undefined) {
        const pick = car.querySelector(`[aria-keyshortcuts~="${digit}"]`)
        if (!pick || pick.disabled) return
        e.preventDefault()
        pick.click()
        return
      }
      if (e.key !== 'Enter' || e.shiftKey) return
      const control = target?.closest('button, a[href], summary')
      if (control) {
        const picked = car.contains(control) && control.getAttribute('aria-pressed') === 'true'
        if (!picked && !pressedByPointer(control)) return
      }
      const go = car.querySelector('[aria-keyshortcuts~="Enter"]')
      if (!go || go.disabled) return
      e.preventDefault()
      go.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desk, off, frameRef])
}
