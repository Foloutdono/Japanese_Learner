// ── 路線図の影 — the one-rail track ─────────────────────────────
// The ghost train's drawing, shared by the pass back (/profile) and,
// come phase F, the onboarding's 案内 scene. Pure and presentational:
// positions arrive as percentages, the judgement that produced them
// lives in domain/goalMath.js, and every word about the journey lives
// beside it in the caller — the track itself is aria-hidden decoration
// over that text, and now carries no text of its own but the stop
// names.
//
// Geometry rules (the 進捗が主役 round; the browser test pins each):
//  - An inner span insets the coordinate system, so no station label
//    or marker ever paints outside the panel.
//  - Your train rides ABOVE the rail and reaches it on a stem, so the
//    x it claims is exact and it never covers a stop. The promise is
//    not a second car on a second lane any more: it is a dashed
//    marker ACROSS the rail, which cannot collide with anything.
//  - Between the two, the stretch you owe is hatched in the state's
//    pigment — the shortfall as an area, not a bracket to measure.
//  - The rail and its done-fill run the span's width — stop-centre to
//    stop-centre, never past.
//
// What retired with the two lanes: the YOU/PLAN caption tags (a key
// the reader had to learn) and the day-bracket (a measuring
// instrument for a number the head above now prints in words).

const clamp = f => Math.min(Math.max(f, 0), 100)

// A gap under one percent of the line is noise, not a delay: at the
// sheet's width that is a hairline of hatching, which reads as dirt on
// the drawing. The head above it carries the exact backlog either way.
const OWED_MIN_PCT = 1

export function GhostTrack({ stations, youF, planF = null }) {
  const you = clamp(youF)
  const plan = planF == null ? null : clamp(planF)
  const owedW = plan == null ? 0 : Math.abs(you - plan)
  const showOwed = plan != null && owedW >= OWED_MIN_PCT

  return (
    <div className="jour-track" aria-hidden="true">
      <span className="jour-track__span">
        <span className="jour-track__rail" />
        <span className="jour-track__done" style={{ width: `${you}%` }} />
        {showOwed && (
          <span
            className="jour-track__owed"
            style={{ left: `${Math.min(you, plan)}%`, width: `${owedW}%` }}
          />
        )}
        {stations.map(st => (
          <span key={st.label} className="jour-track__station" style={{ left: `${clamp(st.pos)}%` }}>
            <i />
            <span className="jour-track__station-name" lang={st.jp ? 'ja' : undefined}>{st.label}</span>
          </span>
        ))}
        {/* The promise before your own train, so the train paints over
            it where the two stand together. */}
        {plan != null && <span className="jour-track__plan" style={{ left: `${plan}%` }} />}
        <span className="jour-track__you" style={{ left: `${you}%` }} />
      </span>
    </div>
  )
}
