import { useState } from 'react'
import { useLang } from '../../LangContext'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
import { LINE_COLOR } from '../../config/tabs'
import { beginDeparture } from '../../stores/departure'
import { playAnnouncement } from '../../lib/audio'
import { Chip } from '../chrome/Console'
import { Loading } from '../ui/Loading'
import { CheckIcon } from '../ui/Icons'
import { useCredits } from '../../stores/credits'
import { runFit, DAILY_REFILL } from '../../domain/credits'
import { laneTypeOf, laneWhere as whereOf, runPathFor, untilNext } from '../../domain/lanes'

// ── 改札 — the fare gate ─────────────────────────────────────
// The day's reviews as a card, first thing on Today: the count, the
// lanes, the fare, and the screen's one filled action. It grew out of
// the home strip and the departure board; since plan 070 it is also
// the run's picker — each lane is a switch, the run covers the lanes
// that are on, and the fare counts them. Everything on is the
// default, because the common case is "clear the day". Over the lanes,
// one switch per LINE, for the days when the answer is "just the
// kanji" and there are twenty lanes to say it in.
//
// Two manners carry over: nothing is rendered after the fetch failed
// (the screen owns up instead), and a cleared queue does not blank
// the card — "next review in 3 hours" is what makes an empty gate
// read as a finished day. The wait is drawn (plan 067): the card's
// name over the three dots until /api/today answers.
//
// Credits (plan 069): nothing at all while the balance covers the run,
// and when it does not, how much of it rides. The gate only CLOSES
// (the button disabled at zero) under enforcement; in shadow mode the
// line is information and the train leaves. A pass prints no notice.
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

// ── 不足のしらせ — the only thing the gate says about credits ──
// A fare line ran above this: Fare · n credits ———— Balance · n. The
// fare was the count the card already prints in figures three times
// its size, and the balance is on the HUD's pass, a thumb's width up
// the same screen — a rule drawn between two numbers that were both
// already on it. Owner's call.
//
// What is left says itself only when the two do not match, which is
// the one moment either is worth reading. `waits` is what makes it
// appear, not what it says.
function Shortfall({ due, credits, t, lang }) {
  const balance = credits && !credits.unlimited ? credits.balance : null
  if (balance == null) return null
  const { rides, waits } = runFit(due, balance)
  if (waits <= 0) return null
  return (
    <div className="gate-card__short" role="status">
      <span className="gate-card__short-mark" aria-hidden="true">!</span>
      <span>
        {balance === 0
          ? t.gateNoCredits(credits.dailyRefill ?? DAILY_REFILL, refillClock(credits.refillAt, lang))
          : t.gateShort(rides, due)}
      </span>
    </div>
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

// A line's own name, the same one its gate and its station carry.
const LINE_TITLE = {
  kana: t => t.kanaTitle,
  vocab: t => t.vocabTitle,
  kanji: t => t.kanjiTitle,
  grammar: t => t.grammarTitle,
  personal: t => t.decksTitle,
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

  // ── 路線ごと — the lines in today's queue, as switches ──
  // Twenty lanes is five taps to say "just the kanji" and fifteen to
  // say it the other way round. A line is the coarse choice the fine
  // switches under it are made of, so it gets its own switch: lit when
  // the WHOLE line rides, which makes the tap unambiguous both ways —
  // lit switches the line off, unlit switches all of it on. The figure
  // is what the line owes today, not what is chosen of it; the lit
  // state is where the choice is read.
  const lines = TYPE_ORDER
    .map(type => {
      const own = lanes.filter(l => laneTypeOf(l) === type)
      return { type, lanes: own, due: own.reduce((n, l) => n + l.due, 0), on: own.length > 0 && own.every(isOn) }
    })
    .filter(line => line.lanes.length > 0)

  function toggleLine(line) {
    setOff(prev => {
      const next = new Set(prev)
      for (const l of line.lanes) {
        if (line.on) next.add(l.id)
        else next.delete(l.id)
      }
      return next
    })
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

      {lines.length > 1 && (
        <div className="gate-card__lines" role="group" aria-label={t.todayLines}>
          {lines.map(line => (
            <Chip
              key={line.type}
              on={line.on}
              color={LINE_COLOR[line.type]}
              onClick={() => toggleLine(line)}
            >
              {LINE_TITLE[line.type]?.(t) ?? line.type}
              <span className="gate-card__linedue">{line.due}</span>
            </Chip>
          ))}
        </div>
      )}

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
              {/* Where over what, not beside it: at phone width
                  "Hiragana (de base)" and "Kana → romaji" on one line
                  ellipsised the mode away, and the mode is half of what
                  tells two lanes of the same deck apart. */}
              <span className="lane__names">
                <span className="lane__where">{whereOf(lane, t, kanaSetLabel)}</span>
                <span className="lane__mode">{modeLabel(t, lane.mode)}</span>
              </span>
              <span className="lane__due">{lane.due}</span>
            </button>
          )
        })}
      </div>

      <Shortfall due={due} credits={credits} t={t} lang={lang} />

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
