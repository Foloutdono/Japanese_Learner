import { ChevronIcon } from '../ui/Icons'

// ── 対戦 — the small parts every duels screen draws (plan 276) ──────

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
