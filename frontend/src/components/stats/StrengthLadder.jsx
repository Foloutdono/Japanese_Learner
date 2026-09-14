import { useLang } from '../../LangContext'

// ── 強度 — the strength ladder (plan 085) ─────────────────
// How far ahead the scheduler has pushed the cards: five rungs, each
// as wide as its share, the ink deepening toward the far end. This is
// the one drawing that shows the SRS itself working — a healthy deck
// is a wave moving right over months, and a deck that never leaves the
// first two rungs is one being relearned forever. The count and the
// rung's reach sit under it; the bar itself carries no text.
const TINT = [18, 34, 55, 78, 100]

export function StrengthLadder({ rungs, total }) {
  const { t } = useLang()
  if (!total) return null
  const labels = t.reportRungs
  return (
    <div className="rep-ladder" role="img" aria-label={t.reportStrengthSummary(total)}>
      <div className="rep-ladder__bar" aria-hidden="true">
        {rungs.map(r => (
          <span
            key={r.key}
            className={`rep-ladder__rung${r.count === 0 ? ' rep-ladder__rung--empty' : ''}`}
            style={{ '--n': Math.max(r.count, 1), '--tint': `${TINT[r.index]}%` }}
          />
        ))}
      </div>
      <div className="rep-ladder__caps" aria-hidden="true">
        {rungs.map(r => (
          <span key={r.key} className="rep-ladder__cap" style={{ '--n': Math.max(r.count, 1) }}>
            <b>{r.count.toLocaleString()}</b>
            <span>{labels[r.index]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
