import { createPortal } from 'react-dom'
import { useDialog } from '../../hooks/useDialog'
import { useSheetDrag } from '../../hooks/useSheetDrag'

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
function Panel({ onClose, jp, cap, sumi, label, children, className }) {
  const ref = useDialog(onClose)
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
      </div>
    </div>
  )
}

export function Sheet({ open, ...rest }) {
  if (!open) return null
  return createPortal(<Panel {...rest} />, document.body)
}
