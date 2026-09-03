import { getNavLinks } from '../../config/navLinks'
import { stationFor } from '../../config/stations'
import { TRACKED_LINES, lineStops, lineTotals, stopsTravelled } from '../../domain/lineProgress'

// ── 乗車記録 — how far down each line you have ridden ───────────
// The wall map on the home screen draws the four SRS lines with a
// train on each; this is the same arithmetic as a ledger of figures,
// one cell per line: the roundel, the line's name, the cards mastered
// out of what the line can reach, and the distance travelled as a rail
// in the line's own pigment.
//
// The count is in the 段位 plaque's unit (mastered card-mode pairs, see
// lineTotals) so the four cells and the rank can be added up against
// each other; the rail is the wall map's stop arithmetic, so the
// profile and the home screen agree on how far along a line you are.
//
// The one place on the profile where a line pigment appears — as a
// ring and a rail on a cell that IS that section, which is what the
// pigment is for. Nothing about the learner wears it.
export function LineLedger({ stats, t, navigate }) {
  const lines = getNavLinks(t).filter(s => TRACKED_LINES[s.path])
  if (!lines.length) return null

  return (
    <div className="pf-ledger">
      {lines.map(s => {
        const source = TRACKED_LINES[s.path]
        const { mastered, total } = lineTotals(stats, source)
        const stops = lineStops(stats, source)
        const pct = Math.round((stopsTravelled(stops) / Math.max(1, stops.length)) * 100)
        return (
          <button
            type="button"
            key={s.path}
            className="pf-line"
            style={{ '--line-color': s.color }}
            onClick={() => navigate(s.path)}
          >
            <span className="pf-line__id">
              <span className="pf-line__roundel" aria-hidden="true">{stationFor(s.path).code}</span>
              <span className="pf-line__names">
                <span className="pf-line__jp" lang="ja">
                  {s.icon}<span className="pf-line__sen" lang="ja">線</span>
                </span>
                <span className="pf-cap">{s.title}</span>
              </span>
            </span>
            <span className="pf-line__fig" aria-label={`${mastered.toLocaleString()} ${t.mastered}`}>
              {mastered.toLocaleString()}
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
