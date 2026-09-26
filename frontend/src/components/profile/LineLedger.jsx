import { getSections } from '../../config/tabs'
import { stationFor } from '../../config/stations'
import { TRACKED_LINES, lineTotals, lineStops, deckItems } from '../../domain/lineProgress'
import { SplitRow } from '../selection/SplitRow'
import { useDesk } from '../../hooks/useDesk'

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
//
// A row a line since plan 143 (the owner's pick A of the profile
// canvas): the roundel, the name over its rail, the figure at the end.
// It was a lattice of cells, four across, two, one, where "Vocabulary
// JLPT" wrapped in a half-width cell and dropped its figure a line below
// its neighbour's. The rows share one set of columns (a subgrid in
// index.css), so every rail starts and ends where the others do.
//
// On the desk the row has the width to say where on the line the
// learning is: the one rail becomes a rail per stop (a kana set, a JLPT
// level), each filled with that stop's own learned / total and named
// under it, the stop being ridden in full ink. Same arithmetic as the
// figure, cut by stop (deckItems), so the stops add up to the figure.

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

// Each stop of a line with what has been learned of it, and the one
// being ridden: the first the learner has not finished.
function stopsOf(stats, source) {
  const stops = lineStops(stats, source).map(stop => {
    const { learned, total } = deckItems(stats, source, stop.key)
    return { ...stop, pct: total ? Math.round((learned / total) * 100) : 0, done: total > 0 && learned >= total }
  })
  const riding = stops.find(stop => !stop.done)
  return stops.map(stop => ({ ...stop, here: stop === riding }))
}

// A line is a place: on the desk (plan 123) its row is a link.
export function LineLedger({ stats, t, navigate }) {
  const desk = useDesk()
  const lines = getSections('learn', t).filter(s => TRACKED_LINES[s.path])
  if (!lines.length) return null

  return (
    <div className="pf-ledger" data-guide="profile.ledger">
      {lines.map(s => {
        const source = TRACKED_LINES[s.path]
        const { learned, total } = lineTotals(stats, source)
        const pct = total ? Math.round((learned / total) * 100) : 0
        return (
          <SplitRow
            key={s.path}
            to={desk ? s.path : undefined}
            push
            className="pf-line"
            style={{ '--line-color': s.color }}
            onClick={() => { if (!desk) navigate(s.path) }}
          >
            <LineMark section={s} />
            {desk ? (
              <span className="pf-line__stops" aria-hidden="true">
                {stopsOf(stats, source).map(stop => (
                  <span key={stop.key} className={`pf-line__stop${stop.here ? ' pf-line__stop--here' : ''}`}>
                    <span className="pf-line__track"><span className="pf-line__done" style={{ width: `${stop.pct}%` }} /></span>
                    <span className={`pf-line__stop-name${stop.jp ? ' pf-line__stop-name--jp' : ''}`} lang={stop.jp ? 'ja' : undefined}>{stop.label}</span>
                  </span>
                ))}
              </span>
            ) : (
              <span className="pf-line__track" aria-hidden="true">
                <span className="pf-line__done" style={{ width: `${pct}%` }} />
              </span>
            )}
            <span className="pf-line__fig" aria-label={`${learned.toLocaleString()} ${t.mastered}`}>
              {learned.toLocaleString()}
              <span className="pf-line__of">/ {total.toLocaleString()}</span>
            </span>
          </SplitRow>
        )
      })}
    </div>
  )
}
