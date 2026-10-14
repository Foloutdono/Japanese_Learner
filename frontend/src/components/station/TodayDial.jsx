import { useId } from 'react'
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
export function TodayDial({ parts, fare = null, className = '', print = null, seal = null, style, children }) {
  if (print) return <PrintDial parts={parts} fare={fare} className={className} print={print} seal={seal} style={style}>{children}</PrintDial>
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

// ── 浮世絵 — the dial as the print's sun or moon (plan 205) ──────
// On the print of the hour (TodayPrint) the dial is the hour's disc:
// the red sun at dawn, the sun by day, the moon at dusk and at night,
// glowing on its sky. Round it the same two rings, drawn as the
// canvas drew them: the lines' arcs a halo just off the disc (glowing
// at dawn, dusk and night), the fare's ring outside them, dotted for
// what waits, solid as far as what boards. Drawn in the print's own
// units (`print.frame`: the disc's, the halo's and the fare's radii)
// so it stands on the print where the canvas put it, at the frame's
// scale (--tpr-u).
const MARIA = [[-0.56, -0.42, 0.2, 0.781], [-0.2, -0.66, 0.16, 0.7377], [0.52, -0.5, 0.15, 0.8627],
  [0.66, 0.34, 0.16, 0.7181], [-0.6, 0.48, 0.13, 0.834], [0.18, 0.72, 0.12, 0.7914]]

// ── 白文 — the day's seal as the disc (plan 206) ─────────────────
// The owner's pick G3 of the canvas (round 10): on a day with nothing
// left, the disc is the day's 駅スタンプ cut the other way, a disc of
// red with its rings and characters left in the paper, hung where the
// sun or the moon was. At dawn the sun is already red: the seal is cut
// into it, in the sun's own red under its own glow. Drawn in the
// seal's 192-unit box (components/dayclear/kit/Seal.jsx), its type the
// kit's rungs; its grain the canvas's, sparse voids where the ink did
// not take (the kit's #clrk-ink blots and its slots' finer voids both
// wash a disc this size pale).
const SEAL_GLOW = 0.42

function CutSeal({ id, mid, r, day, foot, fill }) {
  const s = (2 * r) / 192
  return (
    <g className="tdy-dial__seal" transform={`translate(${mid} ${mid}) rotate(-6) scale(${s}) translate(-96 -96)`} filter={`url(#${id}ink)`}>
      <filter id={`${id}ink`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -4 3.5" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
      <clipPath id={`${id}band`}><circle cx="96" cy="96" r="81" /></clipPath>
      <circle className="tdy-dial__seal-face" cx="96" cy="96" r="96" style={fill ? { fill } : undefined} />
      <circle className="tdy-dial__seal-cut" cx="96" cy="96" r="87" strokeWidth="3.2" />
      <circle className="tdy-dial__seal-cut" cx="96" cy="96" r="81.5" strokeWidth="1.2" />
      <path className="tdy-dial__seal-band" d="M0 127h192v1.5H0zM0 149.5h192v1.5H0z" clipPath={`url(#${id}band)`} />
      <text className="tdy-dial__seal-top" x="97.9" y="38.6" lang="ja">辻駅</text>
      <text className="tdy-dial__seal-day" x="96" y="85" lang="ja">{day}</text>
      <text className="tdy-dial__seal-foot" x="96.8" y="138.8">{foot}</text>
    </g>
  )
}

function PrintDial({ parts, fare, className, print, seal, style, children }) {
  const id = useId().replace(/[^\w-]/g, '')
  const { frame, disc } = print
  // The seal keeps the dawn sun's red and glow; at any other hour its own.
  const sun = disc.kind === 'sun_red'
  const [glowInk, glowOp] = seal && !sun ? ['var(--tpr-seal-glow)', SEAL_GLOW] : [disc.glow, disc.glowOp]
  const r = frame.disc
  const k = r / 80
  const glow = r + 70
  const size = 2 * glow
  const mid = glow
  const width = 3.4 * k
  const arcs = dialArcs(parts, { r: frame.halo, gap: (11 * frame.halo) / 101, cap: width / 2 })
  const c = 2 * Math.PI * frame.halo
  const turn = `rotate(-90 ${mid} ${mid})`
  const ring = (key, cls, len, start, w) => (
    <circle
      key={key}
      className={cls}
      cx={mid}
      cy={mid}
      r={frame.halo}
      style={{ strokeWidth: w }}
      strokeDasharray={len >= c ? undefined : `${len} ${c}`}
      strokeDashoffset={start ? -start : undefined}
      transform={turn}
    />
  )
  const paid = fare && fare.total > 0 && fare.rides < fare.total ? fareArc(fare.rides, fare.total, { r: frame.fare, size }) : null
  const fc = 2 * Math.PI * frame.fare
  return (
    <div className={`tdy-dial tdy-dial--print ${className}`.trim()} style={{ ...style, '--dial-units': size, '--dial-ring': (2 * (frame.fare + 4)) / size }}>
      {/* The glow on a sheet of its own, so its breath is the
          compositor's to draw and not a reason to draw the disc's blurs
          again every frame (plan 208). */}
      <svg className="tdy-dial__glow" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}g`} cx={mid} cy={mid} r={glow} gradientUnits="userSpaceOnUse">
            <stop offset={r / glow} style={{ stopColor: glowInk, stopOpacity: glowOp }} />
            <stop offset={(r + 24) / glow} style={{ stopColor: glowInk, stopOpacity: glowOp * 0.35 }} />
            <stop offset="1" style={{ stopColor: glowInk, stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <circle cx={mid} cy={mid} r={glow} fill={`url(#${id}g)`} />
      </svg>
      <svg
        className="tdy-dial__disc"
        viewBox={`0 0 ${size} ${size}`}
        focusable="false"
        role={seal ? 'img' : undefined}
        aria-label={seal?.label}
        aria-hidden={seal ? undefined : 'true'}
      >
        <defs>
          <radialGradient id={`${id}f`} cx="0.4" cy="0.36" r="0.72">
            <stop offset="0" stopColor={disc.fill[0]} />
            <stop offset="1" stopColor={disc.fill[1]} />
          </radialGradient>
          <clipPath id={`${id}c`}><circle cx={mid} cy={mid} r={r} /></clipPath>
          <filter id={`${id}h`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={4.5 * k} /></filter>
          <filter id={`${id}s`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={2.4 * k} /></filter>
        </defs>
        {disc.haloGlow > 0 && arcs.length > 0 && (
          <g className="tdy-dial__halo" style={{ '--ho': disc.haloGlow }} filter={`url(#${id}h)`}>
            {arcs.map(a => (
              <g key={a.key} style={{ '--lane-color': LINE_COLOR[a.key] ?? 'var(--text-secondary)' }}>
                {ring('glow', 'tdy-dial__arc', a.len, a.start, 13 * k)}
              </g>
            ))}
          </g>
        )}
        {seal
          ? <CutSeal id={id} mid={mid} r={r} day={seal.day} foot={seal.foot} fill={sun ? `url(#${id}f)` : null} />
          : <circle cx={mid} cy={mid} r={r} fill={`url(#${id}f)`} />}
        {disc.maria && !seal && (
          <g clipPath={`url(#${id}c)`} fill="#c9b68a" opacity="0.2" filter={`url(#${id}s)`}>
            {MARIA.map(([x, y, s, q]) => (
              <ellipse key={`${x}${y}`} cx={mid + x * r} cy={mid + y * r} rx={s * r} ry={s * r * q} />
            ))}
          </g>
        )}
      </svg>
      <svg className="tdy-dial__ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        {arcs.map(a => (
          <g key={a.key} style={{ '--lane-color': LINE_COLOR[a.key] ?? 'var(--text-secondary)' }}>
            {ring('all', `tdy-dial__arc${a.cut ? ' tdy-dial__arc--dim' : ''}`, a.len, a.start, width)}
            {a.cut && a.lit > 0 && ring('lit', 'tdy-dial__arc', a.litLen, a.start, width)}
          </g>
        ))}
        {paid && (
          <g className="tdy-dial__fare">
            <circle className="tdy-dial__fare-wait" cx={mid} cy={mid} r={frame.fare} style={{ strokeWidth: 1.6 * k, strokeDasharray: `0.01 ${6.2 * k}` }} />
            {paid.len > 0 && (
              <circle
                className="tdy-dial__fare-ride"
                cx={mid}
                cy={mid}
                r={frame.fare}
                strokeDasharray={`${paid.len} ${fc}`}
                style={{ strokeWidth: 1.25 * k }}
                transform={turn}
              />
            )}
            <circle className="tdy-dial__fare-end" cx={paid.x} cy={paid.y} r={2.4 * k} />
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
