import { useLang } from '../../LangContext'
import { RHYTHMS, RECOMMENDED_RHYTHM, itemsForRhythm, rideAxis } from '../../domain/boarding'
import { serviceLabel } from '../onboarding/paces'
import { Emphasized } from '../ui/Emphasized'
import { BoardQuestion, Continue } from './BoardFrame'
import { useDesk } from '../../hooks/useDesk'
import { useBoxSize } from '../../hooks/useBoxWidth'
import { PickMark } from './BoardOption'

// ── 6 · the rhythm (plan 075) ────────────────────────────────────
// Minutes a day, and when each pace arrives. On a phone (plan 168, the
// owner's pick ① of A06) the four rhythms are four trains on a 発車標,
// each with its service, its minutes and the new items they hold, and
// its arrival at the goal; under the board, the first stop -- the kana,
// read by the day the pace picked reaches them. On the desk (plan 163)
// the rhythms are the four roads to the goal (RideRoads).
//
// `rides` is what each rhythm's ride comes to -- a { days, date } per
// rhythm, in RHYTHMS' order -- `stop` the goal it arrives at, `now` the
// day it leaves and `first` the kana's own stop at the pace picked
// ({ date }, or null for a reader of both scripts); each null until the
// volumes that price them have answered. Until then the desk keeps the
// four cards, and the phone's board prints no arrivals.
export default function RhythmStep({ value, onChange, onContinue, rides = null, stop = null, now = null, first = null }) {
  const { t } = useLang()
  // 机 (plan 122): 1-4 pick a rhythm.
  const desk = useDesk()
  const roads = desk && rides && now
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={roads ? t.brdRhythmHint : null}>{t.brdRhythmQ}</BoardQuestion>
        <div className="brd__stage">
          {roads ? <RideRoads value={value} onChange={onChange} rides={rides} stop={stop} now={now} /> : desk ? (
            <>
            <div className="brd-grid" role="group" aria-label={t.brdRhythmQ}>
              {RHYTHMS.map((min, i) => (
                <button
                  key={min}
                  type="button"
                  className={`brd-cell${value === min ? ' brd-cell--on' : ''}`}
                  aria-pressed={value === min}
                  onClick={() => onChange(min)}
                  aria-keyshortcuts={String(i + 1)}
                  data-rhythm={min}
                >
                  <PickMark digit={i + 1} corner />
                  {min === RECOMMENDED_RHYTHM && <span className="brd-tag">{t.onbPaceRecommended}</span>}
                  <span className="brd-cell__n">{min}</span>
                  <span className="brd-cell__u">{t.brdMinADay}</span>
                  <span className="brd-cell__sub">{t.brdNewItems(itemsForRhythm(min))}</span>
                </button>
              ))}
            </div>
            <p className="brd__hint">{t.brdChangeLater}</p>
            </>
          ) : <DepartureBoard value={value} onChange={onChange} rides={rides} stop={stop} first={first} />}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} data-action="continue" />
      </div>
    </>
  )
}

// ── 発車標 — four trains on the board (plan 168) ───────────────────
// A row a rhythm, as a departure board prints a train: its service (the
// board's own names, components/onboarding/paces.js), the minutes a day
// with the new items they hold, and where it arrives and when. The one
// picked is lit in the gate's gold.
function DepartureBoard({ value, onChange, rides, stop, first }) {
  const { t, lang } = useLang()
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
  const goal = stop && stop !== 'novice' ? stop : null
  return (
    <>
      <div className="brd-trains" role="group" aria-label={t.brdRhythmQ}>
        <p className="brd-trains__cols brd-trains__head" aria-hidden="true">
          <span>{t.brdTermService}</span>
          <span>{t.brdADay}</span>
          <span>{goal ? t.brdArriveAt(goal) : t.statusArrival}</span>
        </p>
        {RHYTHMS.map((min, i) => {
          const ride = rides?.[i]
          return (
            <button
              key={min}
              type="button"
              className="brd-trains__cols brd-train"
              aria-pressed={value === min}
              onClick={() => onChange(min)}
              data-rhythm={min}
            >
              <span className="brd-train__svc">
                <span className="brd-train__jp" lang="ja">{serviceLabel(min).jp}</span>
                <span className="brd-train__name">{t.brdRhythmName[min]}</span>
                {min === RECOMMENDED_RHYTHM && <span className="brd-train__tag">{t.onbPaceRecommended}</span>}
              </span>
              <span className="brd-train__min">
                <span className="brd-train__fig"><b>{min}</b>min</span>
                <span className="brd-train__new">{t.brdNewItems(itemsForRhythm(min))}</span>
              </span>
              <span className="brd-train__arr">
                {ride && (
                  <>
                    <span className="brd-train__date">{date.format(ride.date)}</span>
                    <span className="brd-train__days">{t.brdRideDays(ride.days)}</span>
                  </>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {first && <p className="brd-trains__first"><Emphasized text={t.brdFirstStop(first.date)} /></p>}
    </>
  )
}

// ── 辻 — four roads from today (plan 163) ────────────────────────
// The owner's D06 on the desk: the rhythms as four roads out of today on
// one calendar, each as long as its ride -- the shorter the road, the
// sooner the stop -- the stop in its ring at the road's end and its
// month and days beside it; the rhythm picked lies on a gold band. The
// calendar is the box's own (useBoxSize): today at the services' edge,
// the latest arrival where its date still has room, a mark a month
// between (domain/boarding rideAxis).
const HEAD = 48     // the calendar's captions and months, over the roads
const SERVICE = 300 // the rhythms' own column, left of today
const ARRIVE = 150  // past the latest arrival: its ring and its date
const ROW = 116     // a road's row, at the drawing's height
const NAMED = 44    // the least room a month's name is given

function RideRoads({ value, onChange, rides, stop, now }) {
  const { t, lang } = useLang()
  const [boxRef, size] = useBoxSize(true)
  const last = rides.reduce((a, ride) => (ride.date > a ? ride.date : a), rides[0].date)
  const picked = RHYTHMS.indexOf(value)
  const goal = stop === 'novice' ? 'あ' : stop
  const monthYear = new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' })
  let calendar = null
  if (size) {
    const row = Math.max(0, Math.min(ROW, (size.height - HEAD) / RHYTHMS.length))
    const axis = rideAxis(now, last, lang)
    const x0 = SERVICE
    const x1 = Math.max(x0 + 1, size.width - ARRIVE)
    const x = at => x0 + at * (x1 - x0)
    const foot = HEAD + RHYTHMS.length * row
    // A month named where its name has room from the one before it.
    let lastNamed = x0
    const named = axis.marks.filter(m => {
      const room = x(m.mid) - lastNamed >= NAMED && x(m.mid) <= x1 + NAMED / 2
      if (room) lastNamed = x(m.mid)
      return room
    })
    calendar = { row, axis, x0, x, foot, named }
  }
  const c = calendar
  return (
    <div ref={boxRef} className="desk-brd__rides" role="group" aria-label={t.brdRhythmQ}>
      {c && (
        <>
          <svg className="desk-brd__ride-map" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
            {picked >= 0 && (
              <rect className="desk-brd__ride-band" x="0" y={HEAD + picked * c.row} width={size.width} height={c.row} rx="6" />
            )}
            {c.axis.marks.map(m => (
              <line
                key={m.at}
                className={`desk-brd__ride-grid${m.jan ? ' desk-brd__ride-grid--jan' : ''}`}
                x1={c.x(m.at)} y1={HEAD - 8} x2={c.x(m.at)} y2={c.foot}
              />
            ))}
            <line className="desk-brd__ride-today" x1={c.x0} y1={HEAD - 26} x2={c.x0} y2={c.foot} />
            {rides.map((ride, i) => {
              const y = HEAD + (i + 0.5) * c.row
              const end = c.x(c.axis.at(ride.date))
              const on = i === picked
              return (
                <g key={RHYTHMS[i]} className={on ? 'desk-brd__ride-line--on' : undefined}>
                  <line className="desk-brd__ride-road" x1={c.x0} y1={y} x2={end} y2={y} />
                  <circle className="desk-brd__ride-start" cx={c.x0} cy={y} r="6" />
                  <circle className="desk-brd__ride-stn" cx={end} cy={y} r={on ? 24 : 21} />
                  <text className={`desk-brd__ride-code${stop === 'novice' ? ' desk-brd__ride-code--jp' : ''}`} x={end} y={y}>{goal}</text>
                </g>
              )
            })}
          </svg>
          <span className="desk-brd__ride-cap desk-brd__ride-cap--today" style={{ '--x': c.x0 }}>{t.nudgeWhen.today}</span>
          {c.axis.marks.filter(m => m.year).map(m => (
            <span key={m.year} className="desk-brd__ride-cap" style={{ '--x': c.x(m.at) }}>{m.year}</span>
          ))}
          {c.named.map(m => (
            <span key={m.at} className="desk-brd__ride-month" style={{ '--x': c.x(m.mid) }}>{m.label}</span>
          ))}
          {RHYTHMS.map((min, i) => (
            <button
              key={min}
              type="button"
              className="desk-brd__ride"
              // Plain numbers, placed by the sheet: the row's top and
              // height, and where its road ends.
              style={{ '--y': HEAD + i * c.row, '--h': c.row, '--end': c.x(c.axis.at(rides[i].date)) }}
              aria-pressed={value === min}
              aria-keyshortcuts={String(i + 1)}
              onClick={() => onChange(min)}
              data-rhythm={min}
            >
              <span className="desk-brd__ride-svc">
                <PickMark digit={i + 1} />
                <span className="desk-brd__ride-txt">
                  <span className="desk-brd__ride-min">
                    {min} min
                    <small className="desk-brd__ride-unit">{t.brdADay}</small>
                  </span>
                  <span className="desk-brd__ride-name">
                    {t.brdRhythmName[min]}
                    {min === RECOMMENDED_RHYTHM && <span className="brd-tag">{t.onbPaceRecommended}</span>}
                  </span>
                </span>
              </span>
              <span className="desk-brd__ride-arr">
                <b className="desk-brd__ride-when">{monthYear.format(rides[i].date)}</b>
                <span className="desk-brd__ride-days">{t.brdRideDays(rides[i].days)}</span>
              </span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
