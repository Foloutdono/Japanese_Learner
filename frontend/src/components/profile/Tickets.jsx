import { useState } from 'react'

// ── 記念乗車券 — badges as commemorative tickets ──────────────
// A badge used to be a gold medallion in a tile grid, which is the one
// object on the profile that could have come from any app. A station
// hands out 記念乗車券: a small card ticket with the occasion printed on
// it, punched once it has been used. So each badge is a ticket now —
// the glyph on the stub, the name on the body, a punch hole once it is
// earned — and a locked one carries its progress instead of a hole.
//
// Tapping a ticket turns it over to read what it is for (t.badgeReq),
// because "7 / 10" only means something once you know what is being
// counted. One open at a time; tapping again turns it back.
//
// The tally cell leads the row so a partly-empty collection still
// reads as a row of things with a count, not as a grid with holes in
// it (the badge grid's old auto-fit problem).
export function Tickets({ badges, t }) {
  const [open, setOpen] = useState(null)
  if (!badges?.length) return null

  const punched = badges.filter(b => b.unlocked).length

  return (
    <div className="tix">
      <div className="tix__tally">
        <span className="fig__v">
          {punched}<span className="fig__u">/ {badges.length}</span>
        </span>
        <span className="fig__l">{t.punched}</span>
      </div>

      {badges.map(b => {
        const name = t.badgeName?.[b.id] ?? b.label ?? b.id
        const req = t.badgeReq?.[b.id]
        const locked = !b.unlocked
        const pct = b.target ? Math.round((b.progress / b.target) * 100) : 0
        const isOpen = open === b.id
        return (
          <button
            key={b.id}
            type="button"
            className={`tkt${locked ? ' tkt--locked' : ''}${isOpen ? ' tkt--open' : ''}`}
            aria-expanded={isOpen}
            onClick={() => setOpen(isOpen ? null : b.id)}
          >
            <span className="tkt__stub" lang="ja" aria-hidden="true">{b.glyph}</span>
            <span className="tkt__body">
              <span className="tkt__name">{name}</span>
              {locked && typeof b.target === 'number' && (
                <span className="tkt__prog">
                  <span className="tkt__track" aria-hidden="true">
                    <span className="tkt__fill" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="tkt__count">
                    {b.progress.toLocaleString()} / {b.target.toLocaleString()}
                  </span>
                </span>
              )}
              {req && <span className="tkt__req">{req}</span>}
            </span>
            {!locked && <span className="tkt__punch" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
