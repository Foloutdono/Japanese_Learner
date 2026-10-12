import { LINE_COLOR } from '../../config/tabs'
import { DIAL, dialArcs, fareArc } from '../../domain/dial'

// ── 一目 — the day's dial (plan 199) ────────────────────────────
// The owner's pick A2 of the canvas "Tsuji — Today at a glance": the
// run as a ring round its count and its minutes. One arc a line, in its
// pigment (an edge, never a fill); a shorter run lights the share it
// takes of each and dims the rest. Inside it, when the balance cannot
// pay for the whole run, a thinner ring in the ambient ink: solid as
// far as what boards, dashed for what waits, a dot where the one turns
// into the other. The figures stand in the middle (`children`), and
// the ring is decoration to a screen reader: the legend under it
// (FareKey, LineKeys) says the same in words.
//
//   parts  [{ key, n, lit }]: a line's cards and the run's share of them
//   fare   { rides, total } while some of the run waits, else null
export function TodayDial({ parts, fare = null, className = '', children }) {
  const arcs = dialArcs(parts)
  const mid = DIAL.size / 2
  const c = 2 * Math.PI * DIAL.r
  const turn = `rotate(-90 ${mid} ${mid})`
  const ring = (key, cls, len, start = 0) => (
    <circle
      key={key}
      className={cls}
      cx={mid}
      cy={mid}
      r={DIAL.r}
      strokeDasharray={len >= c ? undefined : `${len} ${c}`}
      strokeDashoffset={start ? -start : undefined}
      transform={turn}
    />
  )
  const paid = fare && fare.total > 0 && fare.rides < fare.total ? fareArc(fare.rides, fare.total) : null

  return (
    <div className={`tdy-dial ${className}`.trim()}>
      <svg className="tdy-dial__ring" viewBox={`0 0 ${DIAL.size} ${DIAL.size}`} aria-hidden="true" focusable="false">
        {arcs.length === 0 && <circle className="tdy-dial__track" cx={mid} cy={mid} r={DIAL.r} />}
        {arcs.map(a => (
          <g key={a.key} style={{ '--lane-color': LINE_COLOR[a.key] ?? 'var(--text-secondary)' }}>
            {ring('all', `tdy-dial__arc${a.cut ? ' tdy-dial__arc--dim' : ''}`, a.len, a.start)}
            {a.cut && a.lit > 0 && ring('lit', 'tdy-dial__arc', a.litLen, a.start)}
          </g>
        ))}
        {paid && (
          <g className="tdy-dial__fare">
            <circle className="tdy-dial__fare-wait" cx={mid} cy={mid} r={DIAL.fareR} />
            {paid.len > 0 && (
              <circle
                className="tdy-dial__fare-ride"
                cx={mid}
                cy={mid}
                r={DIAL.fareR}
                strokeDasharray={`${paid.len} ${paid.c}`}
                transform={turn}
              />
            )}
            <circle className="tdy-dial__fare-end" cx={paid.x} cy={paid.y} r="3.5" />
          </g>
        )}
      </svg>
      <div className="tdy-dial__c">{children}</div>
    </div>
  )
}

/** What boards and what waits, said under the dial while the balance
 *  is short: the two rings' marks beside the two figures. */
export function FareKey({ rides, waits, clock, t }) {
  return (
    <p className="tdy-key tdy-key--fare" role="status">
      <span className="tdy-key__item">
        <i className="tdy-key__ride" aria-hidden="true" />
        <b>{rides}</b> {t.gateRides}
      </span>
      <span className="tdy-key__item">
        <i className="tdy-key__wait" aria-hidden="true" />
        <b>{waits}</b> {t.gateWaits(clock)}
      </span>
    </p>
  )
}

/** Each line's share of the run: its ring in the line's pigment and its
 *  figure, with its name where `named` (the desk has the room). */
export function LineKeys({ mix, titles, named = false, label }) {
  return (
    <ul className="tdy-key tdy-key--lines" aria-label={label}>
      {mix.map(part => (
        <li key={part.type} className="tdy-key__item" style={{ '--lane-color': LINE_COLOR[part.type] }}>
          <i className="tdy-key__ring" aria-hidden="true" />
          <span className={named ? undefined : 'sr-only'}>{titles[part.type]}</span>
          <b>{part.n}</b>
        </li>
      ))}
    </ul>
  )
}
