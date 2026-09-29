import { CheckMark } from './icons'

// ── 机 — the key, and then the check, in one slot (plan 155) ─────
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
