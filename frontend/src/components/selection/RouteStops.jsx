import { playUi } from '../../lib/audio'

// ── 路線図 — the stops of a line (plan 071) ──────────────────
// The station page: a line's stops as the canvas draws them, one rail
// down the left with a marker per stop, the stops you have passed
// filled, the one you are at ringed and captioned "You are here", and
// on every row the code, the name, and how much of it is learned.
//
// A route, not a list, because that is what these are: an ordered
// line you travel from one end of. The JLPT levels walk N5 → N1; the
// kana sets walk the order the app teaches them.
//
// Props:
//   stops — [{ key, code, name, hint?, learned?, total?, codeLang? }]
//   here  — the key of the learner's own stop (a landmark, never a
//           lock: every stop stays a plain button — docs/adr/0005)
//   onSelect(key)
export function RouteStops({ stops, here = null, onSelect }) {
  const hereIndex = stops.findIndex(s => s.key === here)
  return (
    <div className="route">
      {stops.map((stop, i) => {
        const past = hereIndex >= 0 && i < hereIndex
        const current = stop.key === here
        const classes = [
          'route-stop',
          i === 0 ? 'route-stop--first' : '',
          i === stops.length - 1 ? 'route-stop--last' : '',
          past ? 'route-stop--past' : '',
          current ? 'route-stop--current' : '',
        ].filter(Boolean).join(' ')
        return (
          <button
            key={stop.key}
            type="button"
            className={classes}
            aria-current={current ? 'location' : undefined}
            onClick={() => { playUi('click-mode-selection'); onSelect(stop.key) }}
          >
            {/* The rail, drawn per stop so the ends can be capped — a
                line that runs off the top of the first station reads
                as "there is more up there". */}
            <span className="route-stop__rail" aria-hidden="true" />
            <span className="route-stop__marker" aria-hidden="true" />
            <span className="route-stop__code" lang={stop.codeLang}>{stop.code}</span>
            <span className="route-stop__names">
              <span className="route-stop__jp">{stop.name}</span>
              {current
                ? <span className="route-stop__here">{stop.hereLabel}</span>
                : stop.hint && <span className="route-stop__hint" lang={stop.hintLang}>{stop.hint}</span>}
            </span>
            {stop.total > 0 && (
              <span className="route-stop__fig"><b>{stop.learned ?? 0}</b>/ {stop.total}</span>
            )}
            <span className="route-stop__go" aria-hidden="true">▶</span>
          </button>
        )
      })}
    </div>
  )
}
