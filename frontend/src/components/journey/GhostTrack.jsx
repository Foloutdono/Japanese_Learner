import { useLang } from '../../LangContext'
import { addDays, nextStop } from '../../domain/goalMath'

// ── 路線図の影 — the ghost train's line ─────────────────────────────
// One drawing, two grounds: the card's back on a phone (JourneyCard.jsx,
// in the card's material) and the desk's journey body (JourneyBody.jsx,
// the status sheet and Today's panel, on the panel's sumi) -- the
// owner's pick C″ of the canvas "Tsuji — the three offers", page "The
// ghost train", drawn on the desk too since it was built for the phone.
// The inks are the ground's: --jc-ink (the run behind you and your
// train), --jc-line (the legs ahead), --jc-soft (the stops ahead) and
// --jc-st (the stretch owed), set by .jcard--* and by .jour-track.
//
//  - The line is cut into its legs, one per level. A stop is the cut at
//    the end of the leg it names, its name under the line, the next one
//    dated "~ 6 déc." and the terminus with the arrival the pace kept
//    delivers.
//  - Your train is a Shinkansen in profile, its NOSE at your position.
//  - Before the journey starts it waits on a siding left of 発 -- the
//    line's inset is a train's length -- and once it has left, the
//    siding is behind it and fills with the run, as the legs do.
//  - The promise is the same train as a dashed outline, the train that
//    is not there, and the stretch between the two is hatched in the
//    state's ink. It carries no word ("promis" went: it clipped at the
//    card's edge, and the head over the line already says how far).
//
// Pure and presentational over journeyPositions' percentages; aria-
// hidden, since the head and the sheet's label say what it draws.

const clamp = f => Math.min(Math.max(f, 0), 100)

// A gap under one percent of the line is noise, not a delay.
const OWED_MIN_PCT = 1

// Half the cut a stop makes in the line, in px.
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
// (evenodd), not paint, so it reads on whatever the line is drawn on.
export function Train({ className = 'jline__svg' }) {
  return (
    <svg className={className} viewBox="0 0 46 15" focusable="false" aria-hidden="true">
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

// The promise's train: the same body, drawn as a dashed outline with
// its windows faint.
function Ghost() {
  return (
    <svg className="jline__svg" viewBox="-1 -1 48 17" focusable="false" aria-hidden="true">
      <path d="M1 2.5Q1 1 2.5 1H27C35 1 41.5 5 45 11.5Q45.8 13.5 43.5 13.5H2.5Q1 13.5 1 12Z" fill="none" strokeWidth="1.4" strokeDasharray="3 2.2" />
      <path d="M5 4H9V7H5ZM11 4H15V7H11ZM17 4H21V7H17ZM23 4H27V7H23Z" opacity="0.55" />
    </svg>
  )
}

/**
 * The line. `stations` and the two positions as journeyPositions gives
 * them; `status`, `model` and `now` date the next stop and the terminus
 * at the pace the last 14 days kept (none without them).
 */
export function JourneyLine({ stations, youF, planF = null, status = null, model = null, now = null }) {
  const { lang } = useLang()
  const loc = lang === 'fr' ? 'fr' : 'en'
  const full = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' })
  const short = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' })
  const you = clamp(youF)
  const plan = planF == null ? null : clamp(planF)
  const owed = plan == null ? 0 : Math.abs(you - plan)
  const next = stations.length > 1 ? nextStop(stations, you) : null

  function etaOf(st) {
    if (!status || !model || !now) return null
    const left = (st.pos / 100) * status.itemsTotal - status.itemsDone
    if (left <= 0 || !(model.actualPerDay > 0)) return null
    return addDays(now, left / model.actualPerDay)
  }

  return (
    <div className="jline" aria-hidden="true">
      <span className="jline__span">
        <span className={`jline__siding${you > 0 ? ' jline__siding--done' : ''}`} />
        {legsOf(stations).map(({ a, b, last }) => {
          const cuts = CUT + (last ? 0 : CUT)
          const left = `calc(${a}% + ${CUT}px)`
          const width = `calc(${b - a}% - ${cuts}px)`
          return [
            <span key={`leg-${a}`} className="jline__leg" style={{ left, width }} />,
            // The run behind you, cut where the leg is: it ends at the
            // nose, never inside a cut.
            you > a && (
              <span
                key={`done-${a}`}
                className="jline__done"
                style={{ left, width: you >= b ? width : `max(0px, calc(${you - a}% - ${CUT}px))` }}
              />
            ),
          ]
        })}
        {plan != null && owed >= OWED_MIN_PCT && (
          <span className="jline__gap" style={{ left: `${Math.min(you, plan)}%`, width: `${owed}%` }} />
        )}
        {stations.map((st, i) => {
          const passed = st.pos <= you
          const last = i === stations.length - 1
          const eta = !passed && i > 0 && (st === next || last) ? (last ? model?.projected ?? etaOf(st) : etaOf(st)) : null
          const state = passed ? ' jline__stop--passed' : st === next ? ' jline__stop--next' : ''
          const end = last && i > 0 ? ' jline__stop--last' : i === 0 ? ' jline__stop--first' : ''
          return (
            <span key={st.label} className={`jline__stop${state}${end}`} style={{ left: `${clamp(st.pos)}%` }}>
              <b lang={st.jp ? 'ja' : undefined}>{st.label}</b>
              {eta && <small>{last ? full.format(eta) : `~ ${short.format(eta)}`}</small>}
            </span>
          )
        })}
        {plan != null && (
          <span className="jline__car jline__car--ghost" style={{ left: `${plan}%` }}>
            <Ghost />
          </span>
        )}
        <span className="jline__car jline__car--you" style={{ left: `${you}%` }}>
          <Train />
        </span>
      </span>
    </div>
  )
}

/** The line on the desk's journey body, on the panel's sumi. */
export function GhostTrack(props) {
  return (
    <div className="jour-track">
      <JourneyLine {...props} />
    </div>
  )
}
