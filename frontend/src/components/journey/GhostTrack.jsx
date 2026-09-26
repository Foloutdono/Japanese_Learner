import { nextStop } from '../../domain/goalMath'

// ── 路線図の影 — the one-rail track ─────────────────────────────
// The ghost train's drawing, shared by the pass back (/profile) and,
// come phase F, the onboarding's 案内 scene. Pure and presentational:
// positions arrive as percentages, the judgement that produced them
// lives in domain/goalMath.js, and every word about the journey lives
// beside it in the caller — the track itself is aria-hidden decoration
// over that text, and now carries no text of its own but the stop
// names.
//
// The 区間・新幹線 round (2026-09-25, the owner's pick of drawn
// options: the legs of one, the train of another):
//  - The line is cut into its legs, one per level. A stop is the cut at
//    the end of the leg it names, with its name under the line — no dot,
//    no stripe — so where it falls is read off the line itself.
//  - Your train is a Shinkansen in profile riding the legs, its NOSE at
//    your position: the x it claims is exact, and it stands above the
//    line and the names, so it never hides a stop.
//  - Before the journey starts the train waits on a siding left of 発,
//    which is why the inner span is inset by a train's length on the
//    left.
//  - The run behind you fills leg by leg and ends exactly at the nose;
//    once the train has left 発 the siding it waited on is behind it
//    too and fills with the run; the leg being ridden is drawn a shade brighter than the ones ahead.
//  - The promise is a dashed marker ACROSS the line, and the stretch
//    you owe it (or it owes you) is hatched in the state's pigment.
//  - Stop names: passed in the state's ink, the next one in full ink,
//    the rest soft. Level names are Latin figures, so they take the
//    display face; 発 and かな keep the Japanese one.
//
// What retired with the round: the hollow dot per stop (every stop
// looked the same, passed or next or last), and the car on a stem.

const clamp = f => Math.min(Math.max(f, 0), 100)

// A gap under one percent of the line is noise, not a delay: at the
// sheet's width that is a hairline of hatching, which reads as dirt on
// the drawing. The head above it carries the exact backlog either way.
const OWED_MIN_PCT = 1

// Half the cut a stop makes in the line, in px: each leg stops this
// short of the stop on either side. The terminus has no leg after it,
// so the last leg runs to it.
const CUT = 2

// The legs between consecutive stops. A line with no destination yet
// (a lone 発) is one leg across; two stops at one position make no
// leg between them.
function legsOf(stations) {
  if (stations.length < 2) return [{ a: 0, b: 100, last: true }]
  const legs = []
  for (let i = 1; i < stations.length; i++) {
    const a = clamp(stations[i - 1].pos)
    const b = clamp(stations[i].pos)
    if (b > a) legs.push({ a, b, last: i === stations.length - 1 })
  }
  return legs
}

// The train, facing the destination. Its windows and stripe are holes
// (evenodd), not paint, so it reads on whatever the track is drawn on.
function Train() {
  return (
    <svg className="jour-track__train" viewBox="0 0 46 15" focusable="false">
      <path
        fillRule="evenodd"
        d="M1 2.5Q1 1 2.5 1H27C35 1 41.5 5 45 11.5Q45.8 13.5 43.5 13.5H2.5Q1 13.5 1 12Z
           M5 4H9V7H5ZM11 4H15V7H11ZM17 4H21V7H17ZM23 4H27V7H23Z
           M30 4H33.5C36 4.6 38 6 39.3 7.5H30Z
           M2.5 9.8H42.5V10.8H2.5Z"
      />
    </svg>
  )
}

export function GhostTrack({ stations, youF, planF = null }) {
  const you = clamp(youF)
  const plan = planF == null ? null : clamp(planF)
  const owedW = plan == null ? 0 : Math.abs(you - plan)
  const showOwed = plan != null && owedW >= OWED_MIN_PCT
  const next = nextStop(stations, you)

  return (
    <div className="jour-track" aria-hidden="true">
      <span className="jour-track__span">
        <span className={`jour-track__siding${you > 0 ? ' jour-track__siding--done' : ''}`} />
        {legsOf(stations).map(({ a, b, last }) => {
          const cuts = CUT + (last ? 0 : CUT)
          const left = `calc(${a}% + ${CUT}px)`
          const full = `calc(${b - a}% - ${cuts}px)`
          const riding = you > a && you < b
          return [
            <span
              key={`leg-${a}`}
              className={`jour-track__leg${riding ? ' jour-track__leg--now' : ''}`}
              style={{ left, width: full }}
            />,
            // The run behind you, cut where the leg is: it ends at the
            // nose, never inside a cut.
            you > a && (
              <span
                key={`done-${a}`}
                className="jour-track__done"
                style={{ left, width: you >= b ? full : `max(0px, calc(${you - a}% - ${CUT}px))` }}
              />
            ),
          ]
        })}
        {showOwed && (
          <span
            className="jour-track__owed"
            style={{ left: `${Math.min(you, plan)}%`, width: `${owedW}%` }}
          />
        )}
        {stations.map(st => {
          const state = st.pos <= you ? ' jour-track__station--passed' : st === next ? ' jour-track__station--next' : ''
          return (
            <span key={st.label} className={`jour-track__station${state}`} style={{ left: `${clamp(st.pos)}%` }}>
              <span
                className={`jour-track__station-name${st.jp ? ' jour-track__station-name--jp' : ''}`}
                lang={st.jp ? 'ja' : undefined}
              >
                {st.label}
              </span>
            </span>
          )
        })}
        {/* The promise before your own train, so the train paints over
            it where the two stand together. */}
        {plan != null && <span className="jour-track__plan" style={{ left: `${plan}%` }} />}
        <span className="jour-track__you" style={{ left: `${you}%` }}>
          <Train />
        </span>
      </span>
    </div>
  )
}
