import { ChevronIcon } from '../ui/Icons'

// ── 対戦 — the small parts every duels screen draws (plan 279) ──────

/** The duel's verdict as a word in its state's ink. */
export function Verdict({ outcome, t }) {
  const word = outcome === 'win' ? t.pvpWin : outcome === 'loss' ? t.pvpLoss : t.pvpDraw
  return <span className={`pvp-verdict pvp-verdict--${outcome}`}>{word}</span>
}

/** The Elo a duel moved, signed, or « ami » for a friendly one. */
export function EloMove({ elo, t }) {
  if (elo == null) return <span className="pvp-elo-move">{t.pvpFriendTag}</span>
  return <span className={`pvp-elo-move pvp-elo-move--${elo >= 0 ? 'up' : 'down'}`}>{elo >= 0 ? `+${elo}` : `−${-elo}`}</span>
}

/** The last twenty ratings as a line, its ends the lowest and highest. */
export function Trend({ points, width = 120, height = 32, label }) {
  if (!points?.length) return null
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const span = Math.max(1, hi - lo)
  const step = width / Math.max(1, points.length - 1)
  const d = points.map((p, i) => `${(i * step).toFixed(1)},${(height - 2 - ((p - lo) / span) * (height - 4)).toFixed(1)}`).join(' ')
  return (
    <svg className="pvp-trend" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polyline className="pvp-trend__line" points={d} />
    </svg>
  )
}

// The curve's drawing box, in the SVG's own units: it stretches to the
// card's width at its own height (index.css), so the desk's wider card
// draws a longer line rather than a taller one; the strokes keep their
// width (non-scaling-stroke), and the dot is a stroke's round cap, which
// stays round where a circle would stretch.
const CURVE_W = 320
const CURVE_H = 72

/** The Elo over the last twenty ranked duels, the placement's start
 *  dashed under the line and the last duel a dot. */
export function EloCurve({ trend, start, label }) {
  if (!trend?.length) return null
  const all = start != null ? [...trend, start] : trend
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max(8, (hi - lo) * 0.15)
  const min = lo - pad
  const span = hi + pad - min
  const x = i => (trend.length === 1 ? CURVE_W : (i / (trend.length - 1)) * CURVE_W)
  const y = v => CURVE_H - ((v - min) / span) * CURVE_H
  const line = trend.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  return (
    <svg className="pvp-curve__svg" viewBox={`-4 -4 ${CURVE_W + 8} ${CURVE_H + 8}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {start != null && <line className="pvp-curve__start" x1="0" x2={CURVE_W} y1={y(start)} y2={y(start)} />}
      <polyline className="pvp-curve__line" points={line} />
      <line className="pvp-curve__dot" x1={x(trend.length - 1)} y1={y(trend[trend.length - 1])} x2={x(trend.length - 1)} y2={y(trend[trend.length - 1])} />
    </svg>
  )
}

/** A door in the holder's shape: roundel, name, figure, chevron. */
export function DoorRow({ glyph, name, sub, figure, onClick }) {
  return (
    <div className="records records--one">
      <button type="button" className="record record--door" style={{ '--line-color': 'var(--pass-ink)' }} onClick={onClick}>
        <span className="pf-line__id">
          <span className="pf-line__roundel" aria-hidden="true" lang="ja">{glyph}</span>
          <span className="pf-line__names">
            <span className="pf-line__jp">{name}</span>
            {sub && <span className="pvp-door__waiting">{sub}</span>}
          </span>
        </span>
        {figure != null && <span className="record__value record__value--door">{figure}</span>}
        <ChevronIcon direction="right" size={15} className="record__chev" />
      </button>
    </div>
  )
}
