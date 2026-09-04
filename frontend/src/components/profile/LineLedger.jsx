import { getNavLinks } from '../../config/navLinks'
import { stationFor } from '../../config/stations'
import { TRACKED_LINES, lineTotals } from '../../domain/lineProgress'

// ── 乗車記録 — how far down each line you have ridden ───────────
// The wall map on the home screen draws the four SRS lines with a
// train on each; this is the same arithmetic as a ledger of figures,
// one cell per line: the roundel, the line's name, the cards mastered
// out of what the line can reach, and the distance travelled as a rail
// in the line's own pigment.
//
// The figure and the rail are ONE number: cards learned out of cards
// there are (lineTotals). They used to be two — the figure counted
// (card, mode) drills while the rail averaged the wall map's stop
// scores — so finishing N5 vocab and nothing else printed a rail at
// 20% beside a figure of 1,838 / 24,118, which is 7.6%. Same row, same
// line, two answers.
//
// It answers a different question from the wall map, deliberately: the
// map says which station you are at, this says how much of the content
// you know. Neither prints the other's number, so there is nothing for
// them to disagree about.
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
            <span className="pf-line__id">
              <span className="pf-line__roundel" aria-hidden="true">{stationFor(s.path).code}</span>
              <span className="pf-line__names">
                <span className="pf-line__jp" lang="ja">
                  {s.icon}<span className="pf-line__sen" lang="ja">線</span>
                </span>
                <span className="pf-cap">{s.title}</span>
              </span>
            </span>
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
