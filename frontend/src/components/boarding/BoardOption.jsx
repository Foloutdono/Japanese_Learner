import { CheckMark } from './icons'
import { useDesk } from '../../hooks/useDesk'

// ── One row, one choice (plan 075) ───────────────────────────────
// The canvas's `.brd-opt`: a leading icon or a line code, the label
// (with an optional tag beside it), a description under it, and the
// check that fills on selection. `aria-pressed` on every choice, as
// the motion sheet asks; the parent owns which one is on.
//
// `pick` is the desk's (plan 122): the digit that picks this row
// (hooks/useBoardKeys), named and printed -- since plan 154 in the
// check's own slot (PickMark).
export function BoardOption({ on = false, onClick, icon = null, code = null, label, tag = null, desc = null, pick = null, ...rest }) {
  const desk = useDesk()
  const key = desk && pick != null ? String(pick) : null
  return (
    <button type="button" className={`brd-opt${on ? ' brd-opt--on' : ''}`} aria-pressed={on} onClick={onClick} aria-keyshortcuts={key ?? undefined} {...rest}>
      {icon && <span className="brd-opt__icon">{icon}</span>}
      {code != null && <span className="brd-opt__code">{code}</span>}
      <span className="brd-opt__names">
        <span className="brd-opt__label">
          {label}
          {tag && <span className="brd-tag">{tag}</span>}
        </span>
        {desc && <span className="brd-opt__desc">{desc}</span>}
      </span>
      {key
        ? <PickMark digit={key} />
        : <span className="brd-opt__check"><CheckMark /></span>}
    </button>
  )
}

// ── 机 — the key, and then the check, in one slot (plan 154) ─────
// Every answer on the desk printed its digit AND drew its check: a row
// carried a keycap beside an empty ring, a tile its keycap in whichever
// corner its own layout left free (top left on a rhythm, top right on a
// kana, the foot of a station, whose check stood in the top right), so
// no two questions put the key in the same place. Now one slot says
// both, the one a pick is read from: the digit at rest, turning over to
// the gold check once the answer is picked -- the trailing slot of a row,
// the top right corner of a tile or a station (`corner`). It reads its
// state off the answer's own aria-pressed (the 机 section of index.css),
// so it needs none of its own. Decoration: the key is the answer's
// aria-keyshortcuts, the pick its aria-pressed.
export function PickMark({ digit, corner = false }) {
  return (
    <span className={`desk-brd__mark${corner ? ' desk-brd__mark--corner' : ''}`} aria-hidden="true">
      <kbd className="desk-kbd desk-brd__key">{digit}</kbd>
      <CheckMark className="svg desk-brd__tick" />
    </span>
  )
}
