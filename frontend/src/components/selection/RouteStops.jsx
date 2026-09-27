import { playUi } from '../../lib/audio'
import { useListWalk, WALK_KEYS } from '../../hooks/useListWalk'
import { SplitRow } from './SplitRow'

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
//           lock: every stop stays a plain button, or on the desk a
//           plain link — docs/adr/0005).
//           Where it comes from is the caller's business: a declared
//           JLPT level for the graded lines, the figures themselves
//           for kana, which has no such thing.
//   onSelect(key)
//   selected — the stop whose platforms stand beside the route, in the
//           desk's station split (plan 114, StationSplit): it is the
//           page, so it is marked as one (`aria-current="page"`, and
//           the Settings list's own selection). Only the desk passes it.
//   linkTo(key) — the URL a stop opens, in the split (plan 117): the
//           stops are then links (SplitRow) that replace the page, so
//           one can be opened in a new tab, and `onSelect` is not
//           called. Only the desk passes it; without it a stop is the
//           button it always was.
//
//   stop.note — a line of the stop's own for its caption (plan 158): a
//           practice station's record at the grade ("24 phrases · 83 %
//           justes"), after "you are here" where the stop is the
//           learner's. The caller formats it, as it does the labels.
//
//   figured — the desk's line split (plan 137): each stop also prints
//           its `sample` (the first things it teaches, joined) and a bar
//           of its make-up — learned in the line's pigment, met but not
//           learned in half of it, the Learn plate's own bar — so the
//           stops can share the column's height with something to say.
//           Only the desk passes it.
//
// In the split the route is also walked by key (hooks/useListWalk,
// plan 115): one tab stop, the open one, and ↑/↓/Home/End along it.
export function RouteStops({ stops, here = null, selected = null, onSelect, linkTo = null, figured = false }) {
  const hereIndex = stops.findIndex(s => s.key === here)
  const walked = selected != null
  const onWalk = useListWalk(walked)
  const tabStop = walked && stops.some(s => s.key === selected) ? selected : stops[0]?.key
  return (
    <div className="route" onKeyDown={onWalk} aria-keyshortcuts={walked ? WALK_KEYS : undefined}>
      {stops.map((stop, i) => {
        const past = hereIndex >= 0 && i < hereIndex
        const current = stop.key === here
        // The stop the learner is at wears its landmark in place of a
        // hint; every other stop wears the hint, if it has one.
        const caption = current
          ? <span className="route-stop__here">{stop.hereLabel}</span>
          : stop.hint ? <span className="route-stop__hint" lang={stop.hintLang}>{stop.hint}</span> : null
        const started = stop.startedLabel && (stop.started ?? 0) > (stop.learned ?? 0)
        const open = selected != null && stop.key === selected
        const classes = [
          'route-stop',
          i === 0 ? 'route-stop--first' : '',
          i === stops.length - 1 ? 'route-stop--last' : '',
          past ? 'route-stop--past' : '',
          current ? 'route-stop--current' : '',
          open ? 'desk-stop--open' : '',
        ].filter(Boolean).join(' ')
        return (
          <SplitRow
            key={stop.key}
            to={linkTo?.(stop.key)}
            className={classes}
            aria-current={open ? 'page' : current ? 'location' : undefined}
            tabIndex={walked ? (stop.key === tabStop ? 0 : -1) : undefined}
            onClick={() => { playUi('click-mode-selection'); if (!linkTo) onSelect(stop.key) }}
          >
            {/* The rail, drawn per stop so the ends can be capped — a
                line that runs off the top of the first station reads
                as "there is more up there". */}
            <span className="route-stop__rail" aria-hidden="true" />
            <span className="route-stop__marker" aria-hidden="true" />
            {stop.code && <span className="route-stop__code" lang={stop.codeLang}>{stop.code}</span>}
            <span className="route-stop__names">
              <span className="route-stop__jp">{stop.name}</span>
              {(caption || started || stop.note) && (
                <span className="route-stop__caption">
                  {caption}
                  {stop.note && <span className="route-stop__note">{stop.note}</span>}
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
            {figured && stop.sample && (
              <span className="desk-stop__sample" lang="ja" aria-hidden="true">{stop.sample}</span>
            )}
            {figured && stop.total > 0 && (
              <span className="desk-line__bar desk-stop__bar" aria-hidden="true">
                <i className="desk-line__met" style={{ width: share(stop.started ?? 0, stop.total) }} />
                <i className="desk-line__learned" style={{ width: share(stop.learned ?? 0, stop.total) }} />
              </span>
            )}
            {stop.total > 0 && (
              <span className="route-stop__fig"><b>{stop.learned ?? 0}</b>/ {stop.total}</span>
            )}
            <span className="route-stop__go" aria-hidden="true">▶</span>
          </SplitRow>
        )
      })}
    </div>
  )
}

// components/station/LinePlate.jsx's own measure: a share of the whole,
// to a tenth of a percent, never past it.
const share = (n, total) => `${total > 0 ? Math.round(Math.min(1, n / total) * 1000) / 10 : 0}%`
