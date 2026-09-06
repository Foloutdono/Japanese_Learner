import { createPortal } from 'react-dom'
import { useDialog } from '../../hooks/useDialog'

// ── The bottom sheet (plan 068) ───────────────────────────────
// A scrim and a panel rising from the bottom edge: the status sheet,
// the balance sheet, a deck picker, a confirm. Modal behaviour comes
// from hooks/useDialog — Escape closes, focus moves in and is trapped,
// and goes back to the opener on close — so a sheet is never an
// overlay a keyboard cannot leave. `sumi` is the pass's own material
// (the status sheet turns the pass over).
function Panel({ onClose, jp, cap, sumi, label, children, className }) {
  const ref = useDialog(onClose)
  const classes = ['sheet', sumi ? 'sheet--sumi' : '', className].filter(Boolean).join(' ')
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
