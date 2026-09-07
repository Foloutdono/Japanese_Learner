import { CheckMark } from './icons'

// ── One row, one choice (plan 075) ───────────────────────────────
// The canvas's `.brd-opt`: a leading icon or a line code, the label
// (with an optional tag beside it), a description under it, and the
// check that fills on selection. `aria-pressed` on every choice, as
// the motion sheet asks; the parent owns which one is on.
export function BoardOption({ on = false, onClick, icon = null, code = null, label, tag = null, desc = null, ...rest }) {
  return (
    <button type="button" className={`brd-opt${on ? ' brd-opt--on' : ''}`} aria-pressed={on} onClick={onClick} {...rest}>
      {icon && <span className="brd-opt__icon">{icon}</span>}
      {code != null && <span className="brd-opt__code">{code}</span>}
      <span className="brd-opt__names">
        <span className="brd-opt__label">
          {label}
          {tag && <span className="brd-tag">{tag}</span>}
        </span>
        {desc && <span className="brd-opt__desc">{desc}</span>}
      </span>
      <span className="brd-opt__check"><CheckMark /></span>
    </button>
  )
}
