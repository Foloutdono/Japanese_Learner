import { getSections } from '../../config/tabs'
import { stationFor } from '../../config/stations'
import { TRACKED_LINES, lineTotals } from '../../domain/lineProgress'

// ── The ride ledger — how far down each line you have ridden ────
// The map on the Learn tab draws the four SRS lines with a train on
// each; this is the same arithmetic as a ledger of figures, one cell
// per line: the roundel, the line's name, the cards mastered out of
// what the line can reach, and the distance travelled as a rail in the
// line's own pigment.
//
// The figure and the rail are ONE number: cards learned out of cards
// there are (lineTotals). They used to be two — the figure counted
// (card, mode) drills while the rail averaged the map's stop scores —
// so finishing N5 vocab and nothing else printed a rail at 20% beside
// a figure of 1,838 / 24,118, which is 7.6%. Same row, same line, two
// answers.
//
// It answers a different question from the map, deliberately: the map
// says which station you are at, this says how much of the content you
// know. Neither prints the other's number, so there is nothing for them
// to disagree about.

// ── The mark a cell names itself with ─────────────────────────
// The roundel in the section's pigment and the name in the learner's
// language (the interface speaks it; a section's name is chrome). The
// ledger's cells and the records' door to Statistics share it, so the
// two cannot drift — DESIGN.md's "use the component" rule.
export function LineMark({ section }) {
  return (
    <span className="pf-line__id">
      <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
      <span className="pf-line__names">
        <span className="pf-line__jp">{section.title}</span>
      </span>
    </span>
  )
}

export function LineLedger({ stats, t, navigate }) {
  const lines = getSections('learn', t).filter(s => TRACKED_LINES[s.path])
  if (!lines.length) return null

  return (
    <div className="pf-ledger">
      {lines.map(s => {
        const source = TRACKED_LINES[s.path]
        const { learned, total } = lineTotals(stats, source)
        const pct = total ? Math.round((learned / total) * 100) : 0
        return (
          <button
            type="button"
            key={s.path}
            className="pf-line"
            style={{ '--line-color': s.color }}
            onClick={() => navigate(s.path)}
          >
            <LineMark section={s} />
            <span className="pf-line__fig" aria-label={`${learned.toLocaleString()} ${t.mastered}`}>
              {learned.toLocaleString()}
              <span className="pf-line__of">/ {total.toLocaleString()}</span>
            </span>
            <span className="pf-line__track" aria-hidden="true">
              <span className="pf-line__done" style={{ width: `${pct}%` }} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
