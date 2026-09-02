// ── 路線図の影 — the two-lane track ─────────────────────────────
// The ghost train's drawing, shared by the pass back (/profile) and,
// come phase F, the onboarding's 案内 scene. Pure and presentational:
// positions arrive as percentages, the judgement that produced them
// lives in domain/goalMath.js, and the words live beside it in the
// caller — the track itself is aria-hidden decoration over that text.
//
// Geometry rules (plan 063, mockup round IV.1 — the browser test pins
// each one):
//  - An inner span insets the coordinate system 14px, so no station
//    label, car or bracket ever paints outside the panel.
//  - Your train rides ABOVE the rail, the plan-car on its own lane
//    BELOW it: the same x can never collide.
//  - The rail and its done-fill run the span's width — stop-center to
//    stop-center, never past.
//  - The day-bracket centres its label when wide, hangs it off the
//    right end when narrow, and off the LEFT end when narrow near the
//    right edge.

const clamp = f => Math.min(Math.max(f, 0), 100)

export function GhostTrack({
  stations,
  youF,
  planF = null,
  gapDeltaDays = null,
  gapLabel = null,
  youLabel = 'YOU',
  planLabel = 'PLAN',
}) {
  const you = clamp(youF)
  const plan = planF == null ? null : clamp(planF)
  const gapW = plan == null ? 0 : Math.abs(you - plan)
  const minF = plan == null ? 0 : Math.min(you, plan)
  // A bracket under three days (or three percent) measures noise, not
  // a delay — the foot sentence still carries the exact number.
  const showGap = plan != null && gapDeltaDays != null
    && gapW >= 3 && Math.abs(gapDeltaDays) >= 3
  const tight = gapW < 12
  const leftHang = tight && minF + gapW > 80

  return (
    <div className="jour-track" aria-hidden="true">
      <span className="jour-track__span">
        <span className="jour-track__rail" />
        <span className="jour-track__done" style={{ width: `${you}%` }} />
        {stations.map(st => (
          <span key={st.label} className="jour-track__station" style={{ left: `${clamp(st.pos)}%` }}>
            <i />
            <span className="jour-track__station-name" lang={st.jp ? 'ja' : undefined}>{st.label}</span>
          </span>
        ))}
        <span className="jour-track__you" style={{ left: `${you}%` }}>
          <span className="jour-track__tag">{youLabel}</span>
          <i />
        </span>
        {plan != null && (
          <span className="jour-track__plan" style={{ left: `${plan}%` }}>
            <i />
            <span className="jour-track__tag">{planLabel}</span>
          </span>
        )}
        {showGap && (
          <span
            className={[
              'jour-track__gap',
              tight && 'jour-track__gap--tight',
              leftHang && 'jour-track__gap--left',
            ].filter(Boolean).join(' ')}
            style={{ left: `${minF}%`, width: `${gapW}%` }}
          >
            <b>{gapLabel}</b>
          </span>
        )}
      </span>
    </div>
  )
}
