import { useLang } from '../../LangContext'
import { addDays, journeyPositions, nextStop, NOVICE_GOAL } from '../../domain/goalMath'
import { journeyStations } from './stations'
import { Train } from './GhostTrack'

// ── 定期券の裏 — the line alone, on the card's back (plan 174) ─────────
// The owner's pick C″ of the canvas "Tsuji — the three offers", page
// "The ghost train": the status sheet on a phone is the learner's card
// turned over, in its own material (domain/passCard's cardTier: white
// plastic and its band, charcoal, satin platinum), and on it only what
// the question "am I on course?" needs:
//
//   the head     how far ahead of the promise or behind it, in days,
//                signed and in the state's ink -- no word, the colour
//                and the sign carry it (the owner's cut of "en avance"
//                and "en retard") -- and the route, start → destination.
//   the line     the route's legs, your train riding them at the share
//                learned, the ghost of the promise dashed above the line
//                with its word ("promis"), the stretch between them
//                hatched in the state's ink; the stops named under the
//                line, the next one dated "~ 6 déc." and the terminus
//                with the arrival the pace kept delivers.
//   the foot     the card's band.
//
// Everything else the sheet used to print (the count, the percent, the
// two comparisons) went: the line already says how far, and the date
// under the terminus says when. The moves stay under the card, outside
// it (JourneyBody's JourneyMoves), because they act on it.
//
// Pure and presentational over the same journeyModel the HUD's plate
// reads, so the two can never disagree. The drawing is aria-hidden; the
// head is the card's text and the sheet's label names the verdict.

const clamp = f => Math.min(Math.max(f, 0), 100)
const OWED_MIN_PCT = 1
const CUT = 2

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

// The promise's train: the same body, drawn as a dashed outline with
// its windows faint, so it reads as the train that is not there.
function Ghost() {
  return (
    <svg className="jcard__svg" viewBox="-1 -1 48 17" focusable="false" aria-hidden="true">
      <path d="M1 2.5Q1 1 2.5 1H27C35 1 41.5 5 45 11.5Q45.8 13.5 43.5 13.5H2.5Q1 13.5 1 12Z" fill="none" strokeWidth="1.4" strokeDasharray="3 2.2" />
      <path d="M5 4H9V7H5ZM11 4H15V7H11ZM17 4H21V7H17ZM23 4H27V7H23Z" opacity="0.55" />
    </svg>
  )
}

export function JourneyCard({ status, model, now, volumes, summary, tier = 'free' }) {
  const { t, lang } = useLang()
  const loc = lang === 'fr' ? 'fr' : 'en'
  const full = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' })
  const short = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' })

  const start = status.goalStartLevel ?? summary?.jlptLevel ?? null
  const stations = journeyStations(volumes, start, status.goalLevel, status.itemsTotal)
  const { youF, planF } = journeyPositions(status, model, now)
  const you = clamp(youF)
  const plan = planF == null ? null : clamp(planF)
  const next = stations.length > 1 ? nextStop(stations, you) : null
  const owed = plan == null ? 0 : Math.abs(you - plan)

  // The head: the drift in days, signed (deltaDays is projected − planned,
  // so ahead is negative there and positive here), or the state's word
  // when there is no number to print.
  const signed = model.deltaDays && (model.status === 'ahead' || model.status === 'slightlyBehind' || model.status === 'delayed')
    ? t.jourDrift(-model.deltaDays)
    : t.jourStatus[model.status]
  const from = status.goalLevel === NOVICE_GOAL ? stations[0]?.label : start
  const to = stations.at(-1)?.label ?? status.goalLevel

  // When a stop comes, at the pace the last 14 days kept: the next one
  // short, the terminus in full (it is the arrival, and it carries its
  // year, as every arrival in the app does).
  function etaOf(st) {
    const left = (st.pos / 100) * status.itemsTotal - status.itemsDone
    if (left <= 0 || !(model.actualPerDay > 0)) return null
    return addDays(now, left / model.actualPerDay)
  }

  return (
    <div className={`jcard jcard--${tier}`}>
      <span className="jcard__grain" aria-hidden="true" />
      <div className="jcard__head">
        <span className="jcard__st"><i aria-hidden="true" />{signed}</span>
        {status.goalLevel && from && to && <span className="jcard__route">{t.jourRoute(from, to)}</span>}
      </div>
      <div className="jcard__line" aria-hidden="true">
        {legsOf(stations).map(({ a, b, last }) => {
          const cuts = CUT + (last ? 0 : CUT)
          const left = `calc(${a}% + ${CUT}px)`
          const width = `calc(${b - a}% - ${cuts}px)`
          return [
            <span key={`leg-${a}`} className="jcard__leg" style={{ left, width }} />,
            you > a && (
              <span
                key={`done-${a}`}
                className="jcard__done"
                style={{ left, width: you >= b ? width : `max(0px, calc(${you - a}% - ${CUT}px))` }}
              />
            ),
          ]
        })}
        {plan != null && owed >= OWED_MIN_PCT && (
          <span className="jcard__gap" style={{ left: `${Math.min(you, plan)}%`, width: `${owed}%` }} />
        )}
        {stations.map((st, i) => {
          const passed = st.pos <= you
          const last = i === stations.length - 1
          const eta = !passed && i > 0 && (st === next || last) ? (last ? model.projected ?? etaOf(st) : etaOf(st)) : null
          const state = passed ? ' jcard__stop--passed' : st === next ? ' jcard__stop--next' : ''
          const end = last ? ' jcard__stop--last' : i === 0 ? ' jcard__stop--first' : ''
          return (
            <span key={st.label} className={`jcard__stop${state}${end}`} style={{ left: `${clamp(st.pos)}%` }}>
              <b lang={st.jp ? 'ja' : undefined}>{st.label}</b>
              {eta && <small>{last ? full.format(eta) : `~ ${short.format(eta)}`}</small>}
            </span>
          )
        })}
        {plan != null && (
          <span className="jcard__car jcard__car--ghost" style={{ left: `${plan}%` }}>
            <Ghost />
            <i>{t.jourPromised}</i>
          </span>
        )}
        <span className="jcard__car jcard__car--you" style={{ left: `${you}%` }}>
          <Train className="jcard__svg" />
        </span>
      </div>
      <span className="jcard__foot" aria-hidden="true" />
    </div>
  )
}
