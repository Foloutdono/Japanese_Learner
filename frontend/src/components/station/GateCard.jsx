import { useState, useEffect } from 'react'
import { useLang } from '../../LangContext'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
import { LINE_COLOR } from '../../config/tabs'
import { beginDeparture } from '../../stores/departure'
import { playAnnouncement } from '../../lib/audio'
import { Chip, Seg } from '../chrome/Console'
import { DepartKey } from '../chrome/DeskKeys'
import { useDesk } from '../../hooks/useDesk'
import { Loading } from '../ui/Loading'
import { CheckIcon, HourglassIcon } from '../ui/Icons'
import { useCredits } from '../../stores/credits'
import { publishLeft } from '../../stores/gateRun'
import { runFit, isFreeLane, DAILY_REFILL, refillClock, showsCap, CAP } from '../../domain/credits'
import { laneTypeOf, laneWhere as whereOf, runPathFor, untilNext, splitTake, laneCount, TAKE_STEPS } from '../../domain/lanes'

// ── 改札 — the fare gate ─────────────────────────────────────
// The day's reviews as a card, first thing on Today: the count, the
// lanes, the fare, and the screen's one filled action. It grew out of
// the home strip and the departure board; since plan 070 it is also
// the run's picker — each lane is a switch, the run covers the lanes
// that are on, and the fare counts them. Everything on is the
// default, because the common case is "clear the day". Over the lanes,
// one switch per LINE, for the days when the answer is "just the
// kanji" and there are twenty lanes to say it in — which is also what
// retired the all/none link that used to sit between the two: a row of
// line switches IS the coarse control it was standing in for.
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
// 無料 — the kana lanes ride free (domain/credits.js), which the card
// has to be right about twice: they are marked on the row, and they
// are counted out of what the balance has to cover. A gate closed on
// a day of nothing but kana would be charging for the one line that
// does not cost anything.
//
// Departing: the ticket-gate cutscene (stores/departure) and then
// /today/run, carrying the chosen lanes in the query — omitted when
// every lane is on, since an empty `lanes` already means the whole
// queue on the backend and the run's session key must not churn.

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
function Shortfall({ due, free, credits, t, lang }) {
  const balance = credits && !credits.unlimited ? credits.balance : null
  if (balance == null) return null
  const { rides, waits } = runFit(due, balance, free)
  if (waits <= 0) return null
  return (
    <div className="gate-card__short" role="status">
      <span className="gate-card__short-mark" aria-hidden="true">!</span>
      <span>
        {/* On what RIDES, not on the balance: an empty balance with
            kana in the run still departs, and "no credits left" over a
            train that is about to leave with twelve cards on it is the
            wrong sentence. The two figures are the right one whenever
            anything at all is riding. */}
        {rides === 0
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
  const desk = useDesk()
  const credits = useCredits()
  // The lanes switched OFF, by id. Kept as the exceptions rather than
  // the choice so a refetched lane list (a review landed elsewhere)
  // keeps the learner's own switches and every new lane arrives on.
  const [off, setOff] = useState(() => new Set())
  // 区間 (plan 135): the desk's run length, null for the whole choice.
  // Remembered across visits: a learner who rides fifty a day picks it
  // once. Never read on a phone, whose gate has no such control.
  const [take, setTakeState] = useState(readTake)
  function setTake(next) {
    setTakeState(next)
    writeTake(next)
  }

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
  // What a lane puts in the run: the reviews it owes and, since plan
  // 098, the day's ration of new cards the server drew for it against
  // the pace. Two figures on the row, one in every sum -- a new card
  // is a card the run serves and the fare prices, like any other.
  const count = lane => (lane.due ?? 0) + (lane.new ?? 0)
  const due = lanes.filter(isOn).reduce((n, l) => n + count(l), 0)
  // The head's unit is honest about what the figure is: "due" while
  // any of it is owed, "new" when the whole run is the day's ration
  // (a first day, or a day with nothing yet to review).
  const owed = lanes.filter(isOn).reduce((n, l) => n + (l.due ?? 0), 0)
  const unit = owed === 0 && due > 0 ? t.newUnit : t.dueUnit
  // Of the chosen reviews, the ones that cost nothing. A pass is not
  // asked: nothing costs anything on one, so nothing is worth marking
  // free either — the tag would be on every row and say nothing.
  const metered = Boolean(credits && !credits.unlimited)
  const free = metered ? lanes.filter(l => isOn(l) && isFreeLane(l)).reduce((n, l) => n + count(l), 0) : 0
  function toggle(id) {
    setOff(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
      return { type, lanes: own, due: own.reduce((n, l) => n + count(l), 0), on: own.length > 0 && own.every(isOn) }
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

  // Closed only under enforcement, and only at zero WITH nothing free
  // in the run: the gate never blocks in shadow mode (plan 069), and
  // it must never block a run the balance is not being asked to pay
  // for. Nothing chosen is not a run.
  const closed = Boolean(credits?.enforced && !credits.unlimited && credits.balance === 0 && free === 0)

  // Same tap the board rows used to make: the announcement, then the
  // gate. /today has no clip in public/sounds/announcements, so
  // playAnnouncement plays the jingle alone and degrades exactly the
  // way it is built to. The section is Today's, with the run's path.
  function depart() {
    playAnnouncement('today')
    beginDeparture({ ...sectionFor('/today', t), path: runPathFor(lanes, off) })
  }

  if (desk) {
    return (
      <DeskGate
        today={today} lines={lines} isOn={isOn} off={off}
        toggle={toggle} toggleLine={toggleLine} take={take} setTake={setTake}
        credits={credits} metered={metered} enforced={Boolean(credits?.enforced)} t={t} lang={lang}
      />
    )
  }

  return (
    <div className="gate-card" data-guide="today.gate">
      <div className="gate-card__head">
        <span className="gate-card__title">{t.fareGate}</span>
        <span className="gate-card__figure">
          <span className="gate-card__count">{due}</span>
          <span className="gate-card__unit">{unit}</span>
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
              {metered && isFreeLane(lane) && (
                <span className="lane__free">{t.freeFare}</span>
              )}
              {/* 新規 — the day's ration in this lane, apart from the
                  reviews: the figure on the right is what the lane
                  puts in the run, this says how much of it is new. */}
              {lane.new > 0 && (
                <span className="lane__new">{t.laneNew(lane.new)}</span>
              )}
              <span className="lane__due">{count(lane)}</span>
            </button>
          )
        })}
      </div>

      <Shortfall due={due} free={free} credits={credits} t={t} lang={lang} />

      <button
        type="button"
        className="btn-depart"
        onClick={depart}
        aria-label={t.todayDue(due)}
        aria-keyshortcuts={desk ? 'Enter' : undefined}
        disabled={closed || due === 0}
      >
        <span className="btn-depart__jp">{t.depart}</span>
        {desk && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
        <span className="btn-depart__go" aria-hidden="true">▶</span>
      </button>
      {/* 机 (plan 115): Enter departs, from anywhere on Today. */}
      <DepartKey onDepart={depart} disabled={closed || due === 0} />
    </div>
  )
}

// ── 区間 — the run's length, kept per browser (plan 135) ─────────
const TAKE_KEY = 'tsuji.gateTake'
function readTake() {
  try {
    const n = Number.parseInt(window.localStorage.getItem(TAKE_KEY) ?? '', 10)
    return TAKE_STEPS.includes(n) ? n : null
  } catch {
    return null
  }
}
function writeTake(n) {
  try {
    if (n == null) window.localStorage.removeItem(TAKE_KEY)
    else window.localStorage.setItem(TAKE_KEY, String(n))
  } catch { /* private window: the choice lasts the visit */ }
}

// ── 机 — the gate as the desk draws it (plan 135) ────────────────
// The owner's pick (A·2 of the Today canvas): the gate takes the
// window's height; each line is a band, its switch on the left and its
// lanes as tiles beside it, which retires the chips (the band's switch
// IS the line's chip); the head holds the run's length (20 / 50 / 100 /
// all) and what the run will take in minutes; each lane prints its
// share of the run and whether it boards (free, or waiting for the
// refill); the foot counts the fare beside Depart.
//
// The length is dealt the way the queue deals (domain/lanes.splitTake),
// in the queue's order -- `today.lanes` as the server sent them -- while
// the bands keep the lines' order for reading.
function DeskGate({ today, lines, isOn, off, toggle, toggleLine, take, setTake, credits, metered, enforced, t, lang }) {
  const queue = (today.lanes ?? []).filter(isOn)
  const chosenTotal = queue.reduce((n, l) => n + laneCount(l), 0)
  const cut = take != null && take < chosenTotal ? take : null
  const shares = splitTake(queue, cut)
  const share = lane => (isOn(lane) ? shares.get(lane.id) ?? 0 : 0)
  const taken = cut ?? chosenTotal
  const free = metered ? queue.filter(isFreeLane).reduce((n, l) => n + (shares.get(l.id) ?? 0), 0) : 0
  const balance = metered ? credits.balance : null
  const { rides, waits } = runFit(taken, balance, free)
  // Nothing paid rides: every paid lane waits for the refill, and says so.
  const paidWait = metered && waits > 0 && rides <= free
  const clock = refillClock(credits?.refillAt, lang)
  const refill = credits?.dailyRefill ?? DAILY_REFILL
  const cap = credits?.cap ?? CAP
  const spr = today.seconds_per_review
  const minutes = spr && taken > 0 ? Math.max(1, Math.round((taken * spr) / 60)) : null
  const owed = queue.reduce((n, l) => n + (l.due ?? 0), 0)
  const unit = cut != null ? t.gateTakeOf(chosenTotal) : (owed === 0 && taken > 0 ? t.newUnit : t.dueUnit)
  const closed = Boolean(enforced && metered && balance === 0 && free === 0)
  // What this choice leaves for tomorrow, for the week ahead beside it.
  const left = Math.max(0, (today.total ?? 0) - taken)
  useEffect(() => {
    publishLeft(left)
    return () => publishLeft(0)
  }, [left])

  const steps = TAKE_STEPS.filter(n => n < chosenTotal)
  const options = [...steps.map(n => ({ key: String(n), label: String(n) })), { key: 'all', label: t.gateTakeAll(chosenTotal) }]

  function depart() {
    playAnnouncement('today')
    beginDeparture({ ...sectionFor('/today', t), path: runPathFor(today.lanes ?? [], off, cut) })
  }

  return (
    <div className="gate-card gate-card--desk" data-guide="today.gate">
      <div className="gate-card__head">
        <span className="gate-card__title">{t.fareGate}</span>
        <span className="gate-card__figs">
          {steps.length > 0 && (
            <Seg
              className="gate-card__take"
              label={t.gateTake}
              options={options}
              value={cut != null ? String(cut) : 'all'}
              onChange={key => setTake(key === 'all' ? null : Number(key))}
            />
          )}
          <span className="gate-card__figure">
            <span className="gate-card__count">{taken}</span>
            <span className="gate-card__unit">{unit}</span>
          </span>
          {minutes != null && (
            <span className="gate-card__time" role="img" aria-label={t.gateMinutesLabel(minutes)}>
              <span className="gate-card__minutes">≈ {minutes}</span>
              <span className="gate-card__unit">{t.gateMinutes}</span>
            </span>
          )}
        </span>
      </div>

      <div className="gate-card__bands" role="group" aria-label={t.todayLines}>
        {lines.map(line => {
          const lineShare = line.lanes.reduce((n, l) => n + share(l), 0)
          const color = LINE_COLOR[line.type]
          return (
            <div key={line.type} className="gate-band" style={{ '--lane-color': color }}>
              <button
                type="button"
                className={`gate-band__line${line.on ? '' : ' gate-band__line--off'}`}
                aria-pressed={line.on}
                onClick={() => toggleLine(line)}
              >
                <span className="lane__tick" aria-hidden="true">{line.on && <CheckIcon size={11} />}</span>
                <span className="gate-band__name">{LINE_TITLE[line.type]?.(t) ?? line.type}</span>
                <span className="gate-band__due">
                  {lineShare}
                  {lineShare !== line.due && <span className="gate-band__of"> / {line.due}</span>}
                </span>
              </button>
              <div className="gate-band__lanes">
                {line.lanes.map(lane => {
                  const on = isOn(lane)
                  const mine = share(lane)
                  const all = laneCount(lane)
                  const isFree = metered && isFreeLane(lane)
                  const waitsHere = paidWait && on && mine > 0 && !isFreeLane(lane)
                  return (
                    <button
                      key={lane.id}
                      type="button"
                      className={`lane lane--tile${on ? '' : ' lane--off'}${on && mine === 0 ? ' lane--out' : ''}${waitsHere ? ' lane--waits' : ''}`}
                      style={{ '--lane-color': color }}
                      aria-pressed={on}
                      onClick={() => toggle(lane.id)}
                    >
                      <span className="lane__tick" aria-hidden="true">{on && <CheckIcon size={11} />}</span>
                      <span className="lane__names">
                        <span className="lane__where">
                          {whereOf(lane, t, kanaSetLabel)} · {modeLabel(t, lane.mode)}
                        </span>
                        <span className="lane__tags">
                          {isFree && <span className="lane__free">{t.freeFare}</span>}
                          {waitsHere && (
                            <span className="lane__waits"><HourglassIcon size={12} /><span className="sr-only">{t.laneWaits('')}</span>{clock}</span>
                          )}
                          {lane.new > 0 && <span className="lane__new">+{t.laneNew(lane.new)}</span>}
                        </span>
                      </span>
                      <span className="lane__due">
                        {on ? mine : all}
                        {on && mine !== all && <span className="lane__of"> / {all}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="gate-card__fare">
        {metered && (
          <div className="gate-card__fare-parts">
            <span className="gate-card__part gate-card__part--rides">
              <span className="gate-card__part-n">{rides}</span>
              <span className="gate-card__part-l">{rides > 0 && rides <= free ? t.gateRidesFree : t.gateRides}</span>
            </span>
            {waits > 0 && (
              <span className="gate-card__part gate-card__part--waits">
                <span className="gate-card__part-n">{waits}</span>
                <span className="gate-card__part-l">{t.gateWaits(refill, clock)}</span>
              </span>
            )}
            <span className="gate-card__part">
              <span className="gate-card__part-n">{balance}{showsCap(balance, cap) ? ` / ${cap}` : ''}</span>
              <span className="gate-card__part-l">{t.gateBalance}</span>
            </span>
          </div>
        )}
        <button
          type="button"
          className="btn-depart"
          onClick={depart}
          aria-label={t.todayDue(taken)}
          aria-keyshortcuts="Enter"
          disabled={closed || taken === 0}
        >
          <span className="btn-depart__jp">{t.depart}</span>
          <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>
          <span className="btn-depart__go" aria-hidden="true">▶</span>
        </button>
      </div>
      <DepartKey onDepart={depart} disabled={closed || taken === 0} />
    </div>
  )
}
