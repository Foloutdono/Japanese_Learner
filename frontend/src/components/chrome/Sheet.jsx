import { createPortal } from 'react-dom'
import { useDialog } from '../../hooks/useDialog'
import { useSheetDrag } from '../../hooks/useSheetDrag'
import { useDesk } from '../../hooks/useDesk'
import { useLang } from '../../LangContext'
import { CrossIcon } from '../ui/Icons'

// ── The bottom sheet (plan 068) ───────────────────────────────
// A scrim and a panel rising from the bottom edge: the status sheet,
// the balance sheet, a deck picker, a confirm. Modal behaviour comes
// from hooks/useDialog — Escape closes, focus moves in and is trapped,
// and goes back to the opener on close — so a sheet is never an
// overlay a keyboard cannot leave. `sumi` is the pass's own material
// (the status sheet turns the pass over).
//
// The thumb's way out is hooks/useSheetDrag: a push back down the way
// it came. Escape is a key a phone has not got, and the scrim over a
// tall sheet is a sliver at the top of the screen — the far end of the
// reach from the hand that opened it. The handle is the AFFORDANCE for
// that gesture (it always was, and nothing answered it), but the drag
// is the whole panel's: aiming for a 36×4 bar is not what a thumb does.
//
// `over`: a sheet opened from inside another one (the offer, from the
// balance or the run-out) listens for Escape first and keeps it, so one
// Escape closes it alone -- not the balance too, nor, through the
// run-out's way out, the run under both (useDialog's `capture`; plan
// 123).
//
// Two for the desk, where a sheet is a dialog in the middle and the
// hands are on the keys (plan 123):
//   `initialFocus`  a selector for the control that takes the focus on
//                   opening -- a confirm's Cancel, the run-out's way
//                   back -- so an Enter held or pressed twice does not
//                   delete a deck. A phone lands on the first control.
//   `dismiss`       a ✕ for a sheet whose body holds no way out (the
//                   pass's back, the deck picker, a report, a new deck):
//                   the scrim was a mouse's only exit. Last in the tab
//                   order, drawn in the corner.
function Panel({ onClose, jp, cap, sumi, label, children, className, over = false, initialFocus = null, dismiss = false }) {
  const desk = useDesk()
  // Only the desk's ✕ reads it: a sheet can stand outside a language
  // provider (a hook's own test), and must not need one to open.
  const t = useLang()?.t
  const ref = useDialog(onClose, { capture: over, focus: desk && initialFocus ? initialFocus : 'first' })
  const drag = useSheetDrag(ref, onClose)
  const classes = ['sheet', sumi ? 'sheet--sumi' : '', drag.dragging ? 'sheet--dragging' : '', className]
    .filter(Boolean).join(' ')
  return (
    <div className="scrim" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? jp}
        className={classes}
        onClick={e => e.stopPropagation()}
      >
        <span className="sheet__handle" aria-hidden="true" />
        {(jp || cap) && (
          <div className="sheet__head">
            {jp && <span className="sheet__jp">{jp}</span>}
            {cap && <span className="sheet__cap">{cap}</span>}
          </div>
        )}
        {children}
        {desk && dismiss && (
          <button type="button" className="import-header__close desk-sheet__close" onClick={onClose} aria-label={t?.close} title={`${t?.close} (Esc)`}>
            <CrossIcon size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

export function Sheet({ open, ...rest }) {
  if (!open) return null
  return createPortal(<Panel {...rest} />, document.body)
}
