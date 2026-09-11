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
//   stops — [{ key, code, name, hint?, hereLabel?, learned?, total?,
//            started?, startedLabel?, codeLang? }] — `hereLabel` is the
//            caption the stop the learner is at wears in place of its
//            hint, and `startedLabel` a second one beside it: how many
//            of the stop's cards have been met at all, which is the
//            figure the row's own (mastery) figure cannot move fast
//            enough to be. The caller formats both — this draws a
//            route, it does not speak a language — and the rule for
//            when the note shows is below, once, rather than in each
//            caller.
//   here  — the key of the learner's own stop (a landmark, never a
//           lock: every stop stays a plain button — docs/adr/0005).
//           Where it comes from is the caller's business: a declared
//           JLPT level for the graded lines, the figures themselves
//           for kana, which has no such thing.
//   onSelect(key)
export function RouteStops({ stops, here = null, onSelect }) {
  const hereIndex = stops.findIndex(s => s.key === here)
  return (
    <div className="route">
      {stops.map((stop, i) => {
        const past = hereIndex >= 0 && i < hereIndex
        const current = stop.key === here
        // The stop the learner is at wears its landmark in place of a
        // hint; every other stop wears the hint, if it has one.
        const caption = current
          ? <span className="route-stop__here">{stop.hereLabel}</span>
          : stop.hint ? <span className="route-stop__hint" lang={stop.hintLang}>{stop.hint}</span> : null
        const started = stop.startedLabel && (stop.started ?? 0) > (stop.learned ?? 0)
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
              {(caption || started) && (
                <span className="route-stop__caption">
                  {caption}
                  {/* Mastery takes three weeks to show, so the figure
                      at the end of the row reads 0 / 665 through a
                      fortnight of real work. This is what moves in the
                      meantime — and only while it has something of its
                      own to say: a stop nobody has opened, and one
                      whose every started card is mastered, both print
                      the figure and no note. */}
                  {started && <span className="route-stop__started">{stop.startedLabel}</span>}
                </span>
              )}
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
