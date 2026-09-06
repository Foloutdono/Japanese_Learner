import { useState } from 'react'
import { useLang } from '../../LangContext'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
import { LINE_COLOR } from '../../config/tabs'
import { beginDeparture } from '../../stores/departure'
import { playAnnouncement } from '../../lib/audio'
import { Loading } from '../ui/Loading'
import { CheckIcon } from '../ui/Icons'
import { useCredits } from '../../stores/credits'
import { fareFor, runFit, DAILY_REFILL } from '../../domain/credits'
import { laneTypeOf, laneWhere as whereOf, runPathFor, untilNext } from '../../domain/lanes'

// ── 改札 — the fare gate ─────────────────────────────────────
// The day's reviews as a card, first thing on Today: the count, the
// lanes, the fare, and the screen's one filled action. It grew out of
// the home strip and the departure board; since plan 070 it is also
// the run's picker — each lane is a switch, the run covers the lanes
// that are on, and the fare counts them. Everything on is the
// default, because the common case is "clear the day".
//
// Two manners carry over: nothing is rendered after the fetch failed
// (the screen owns up instead), and a cleared queue does not blank
// the card — "next review in 3 hours" is what makes an empty gate
// read as a finished day. The wait is drawn (plan 067): the card's
// name over the three dots until /api/today answers.
//
// The fare (plan 069): Fare · n credits · Balance, and when the
// balance is short, how many ride today and how many wait. The gate
// only CLOSES (the button disabled at zero) under enforcement; in
// shadow mode the line is information and the train leaves. A pass
// prints no balance and no notice.
//
// Departing: the ticket-gate cutscene (stores/departure) and then
// /today/run, carrying the chosen lanes in the query — omitted when
// every lane is on, since an empty `lanes` already means the whole
// queue on the backend and the run's session key must not churn.

/** "00:00" — the next refill, on the learner's clock. */
function refillClock(iso, lang) {
  if (!iso) return '00:00'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '00:00'
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)
}

function Fare({ due, credits, t, lang }) {
  if (!credits) return null
  const balance = credits.unlimited ? null : credits.balance
  const fare = fareFor(due)
  const { rides, waits } = runFit(due, balance)
  return (
    <>
      <div className="gate-card__fare">
        <span>{t.fareLabel}</span>
        <b>{fare}</b>
        <span>{t.creditsUnit}</span>
        <span className="gate-card__fare-sep" aria-hidden="true" />
        <span>{t.balanceLabel}</span>
        <b className="fare-gold">{balance == null ? '∞' : balance}</b>
      </div>
      {balance != null && waits > 0 && (
        <div className="gate-card__short" role="status">
          <span className="gate-card__short-mark" aria-hidden="true">!</span>
          <span>
            {balance === 0
              ? t.gateNoCredits(credits.dailyRefill ?? DAILY_REFILL, refillClock(credits.refillAt, lang))
              : t.gateShort(rides, due, waits)}
          </span>
        </div>
      )}
    </>
  )
}

// Grouped by type, in the lines' order, because the rail pigment is
// what tells one lane from another and the backend's order interleaves
// them. Stable, so the backend's urgency order within a type survives.
const TYPE_ORDER = ['kana', 'vocab', 'kanji', 'grammar', 'personal']
function orderLanes(lanes) {
  const rank = l => { const i = TYPE_ORDER.indexOf(laneTypeOf(l)); return i < 0 ? TYPE_ORDER.length : i }
  return [...lanes].sort((a, b) => rank(a) - rank(b))
}

export default function GateCard({ today, failed }) {
  const { t, lang } = useLang()
  const credits = useCredits()
  // The lanes switched OFF, by id. Kept as the exceptions rather than
  // the choice so a refetched lane list (a review landed elsewhere)
  // keeps the learner's own switches and every new lane arrives on.
  const [off, setOff] = useState(() => new Set())

  if (failed) return null
  if (!today) {
    return (
      <div className="gate-card gate-card--waiting" aria-busy="true">
        <div className="gate-card__head">
          <span className="gate-card__title">{t.fareGate}</span>
        </div>
        <Loading tight />
      </div>
    )
  }

  const total = today.total ?? 0
  const when = untilNext(today.next_due, lang)

  if (total === 0) {
    return (
      <div className="gate-card gate-card--clear">
        <div className="gate-card__head">
          <span className="gate-card__title">{t.fareGate}</span>
        </div>
        <span className="gate-card__clear">{t.todayNothingDueShort}</span>
        {when && <span className="gate-card__when">{t.todayNextReview(when)}</span>}
      </div>
    )
  }

  const lanes = orderLanes(today.lanes ?? [])
  const isOn = lane => !off.has(lane.id)
  const due = lanes.filter(isOn).reduce((n, l) => n + l.due, 0)
  const allOn = lanes.every(isOn)

  function toggle(id) {
    setOff(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function togglePick() {
    setOff(allOn ? new Set(lanes.map(l => l.id)) : new Set())
  }

  // Closed only under enforcement, and only at zero: the gate never
  // blocks in shadow mode (plan 069). Nothing chosen is not a run.
  const closed = Boolean(credits?.enforced && !credits.unlimited && credits.balance === 0)

  // Same tap the board rows used to make: the announcement, then the
  // gate. /today has no clip in public/sounds/announcements, so
  // playAnnouncement plays the jingle alone and degrades exactly the
  // way it is built to. The section is Today's, with the run's path.
  function depart() {
    playAnnouncement('today')
    beginDeparture({ ...sectionFor('/today', t), path: runPathFor(lanes, off) })
  }

  return (
    <div className="gate-card">
      <div className="gate-card__head">
        <span className="gate-card__title">{t.fareGate}</span>
        <span className="gate-card__figure">
          <span className="gate-card__count">{due}</span>
          <span className="gate-card__unit">{t.dueUnit}</span>
        </span>
      </div>

      {lanes.length > 1 && (
        <button type="button" className="gate-card__pick" onClick={togglePick}>
          {allOn ? t.todaySelectNone : t.todaySelectAll}
        </button>
      )}

      <div className="gate-card__lanes">
        {lanes.map(lane => {
          const on = isOn(lane)
          return (
            <button
              key={lane.id}
              type="button"
              className={`lane${on ? '' : ' lane--off'}`}
              style={{ '--lane-color': LINE_COLOR[laneTypeOf(lane)] }}
              aria-pressed={on}
              onClick={() => toggle(lane.id)}
            >
              <span className="lane__tick" aria-hidden="true">{on && <CheckIcon size={11} />}</span>
              <span className="lane__where">{whereOf(lane, t, kanaSetLabel)}</span>
              <span className="lane__mode">{modeLabel(t, lane.mode)}</span>
              <span className="lane__due">{lane.due}</span>
            </button>
          )
        })}
      </div>

      <Fare due={due} credits={credits} t={t} lang={lang} />

      <button
        type="button"
        className="btn-depart"
        onClick={depart}
        aria-label={t.todayDue(due)}
        disabled={closed || due === 0}
      >
        <span className="btn-depart__jp">{t.depart}</span>
        <span className="btn-depart__go" aria-hidden="true">▶</span>
      </button>
    </div>
  )
}
