import { useState, useEffect } from 'react'
import { useLang } from '../../LangContext'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
import { LINE_COLOR } from '../../config/tabs'
import { beginDeparture } from '../../stores/departure'
import { playAnnouncement } from '../../lib/audio'
import { Seg } from '../chrome/Console'
import { Sheet } from '../chrome/Sheet'
import { DepartKey } from '../chrome/DeskKeys'
import { GateButton } from '../ui/GateButton'
import { useDesk } from '../../hooks/useDesk'
import { Loading } from '../ui/Loading'
import { CheckIcon, ChevronIcon, HourglassIcon } from '../ui/Icons'
import { useCredits } from '../../stores/credits'
import { publishLeft } from '../../stores/gateRun'
import { runFit, isFreeLane, laneFreeShare, nextCreditClock, showsCap, CAP } from '../../domain/credits'
import { laneTypeOf, laneWhere as whereOf, runPathFor, untilNext, splitTake, laneCount, isMainLane, TAKE_STEPS } from '../../domain/lanes'

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
          ? t.gateNoCredits(nextCreditClock(credits, lang))
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
  // 区間 (plan 135): the run's length, null for the whole choice.
  // Remembered across visits: a learner who rides fifty a day picks it
  // once. The desk's head and, since plan 166, the phone's card.
  const [take, setTakeState] = useState(readTake)
  function setTake(next) {
    setTakeState(next)
    writeTake(next)
  }
  // 主 — the main flashcards alone: each line's recognition
  // card rides and every other mode stays on the platform. A filter
  // over the learner's own switches rather than a rewrite of them, so
  // "every mode" gives back the choice as it stood. Remembered like the
  // run's length.
  const [main, setMainState] = useState(readMain)
  function setMain(next) {
    setMainState(next)
    writeMain(next)
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
  const isOn = lane => !off.has(lane.id) && (!main || isMainLane(lane))
  const metered = Boolean(credits && !credits.unlimited)
  // Switch these lanes on or off. Turning on a mode the main-only
  // filter holds back is leaving the filter: what the gate shows stays
  // as it is, the filter's lanes now the learner's own switches, and
  // the lane asked for joins them.
  function choose(ids, on) {
    if (main && on && lanes.some(l => ids.includes(l.id) && !isMainLane(l))) {
      const next = new Set(lanes.filter(l => !isOn(l)).map(l => l.id))
      for (const id of ids) next.delete(id)
      setOff(next)
      setMain(false)
      return
    }
    setOff(prev => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }
  const toggle = id => choose([id], !isOn(lanes.find(l => l.id === id)))
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
      return { type, lanes: own, due: own.reduce((n, l) => n + laneCount(l), 0), on: own.length > 0 && own.every(isOn) }
    })
    .filter(line => line.lanes.length > 0)

  const toggleLine = line => choose(line.lanes.map(l => l.id), !line.on)

  // What the filter leaves out travels as switched off.
  const offNow = new Set(lanes.filter(l => !isOn(l)).map(l => l.id))
  const Gate = desk ? DeskGate : PhoneGate
  return (
    <Gate
      today={today} lanes={lanes} lines={lines} isOn={isOn} off={offNow}
      toggle={toggle} toggleLine={toggleLine} take={take} setTake={setTake}
      main={main} setMain={setMain} chosen={lanes.filter(l => !off.has(l.id))}
      credits={credits} metered={metered} enforced={Boolean(credits?.enforced)} t={t} lang={lang}
    />
  )
}

// ── The run a choice makes, for either gate ─────────────────────
// The switches say which lanes; the length (区間, plan 135) how many of
// their cards, dealt the way the queue deals (domain/lanes.splitTake),
// in the queue's order -- `today.lanes` as the server sent them. What
// rides free and what the balance covers are counted on that share.
function runOf({ today, isOn, take, metered, credits, enforced, lang }) {
  const queue = (today.lanes ?? []).filter(isOn)
  const chosenTotal = queue.reduce((n, l) => n + laneCount(l), 0)
  const cut = take != null && take < chosenTotal ? take : null
  const shares = splitTake(queue, cut)
  const share = lane => (isOn(lane) ? shares.get(lane.id) ?? 0 : 0)
  const taken = cut ?? chosenTotal
  // Of the chosen cards, the ones that cost nothing: a free line's and
  // the learning steps' repeats on any line. A pass is not asked:
  // nothing costs anything on one, so nothing is worth marking free
  // either -- the tag would be on every row and say nothing.
  const free = metered ? queue.reduce((n, l) => n + laneFreeShare(l, shares.get(l.id) ?? 0), 0) : 0
  const balance = metered ? credits.balance : null
  const { rides, waits } = runFit(taken, balance, free)
  const spr = today.seconds_per_review
  const minutes = spr && taken > 0 ? Math.max(1, Math.round((taken * spr) / 60)) : null
  // The unit is honest about what the figure is: "due" while any of it
  // is owed, "new" when the whole run is the day's ration (a first day,
  // or a day with nothing yet to review).
  const owed = queue.reduce((n, l) => n + (l.due ?? 0), 0)
  // Closed only under enforcement, and only at zero WITH nothing free
  // in the run: the gate never blocks in shadow mode (plan 069), and
  // it must never block a run the balance is not being asked to pay
  // for. Nothing chosen is not a run.
  const closed = Boolean(enforced && metered && balance === 0 && free === 0)
  return {
    queue, chosenTotal, cut, share, taken, free, balance, rides, waits, minutes, owed, closed,
    // When the refill lands its next credit (plan 141) -- what a paid
    // lane that cannot board is waiting for.
    clock: nextCreditClock(credits, lang),
  }
}

// The two choices over the switches: which modes (every one, or each
// line's main flashcard) and how many cards, each with what it rides.
function choicesOf(chosen, chosenTotal, t) {
  const everyMode = chosen.reduce((n, l) => n + laneCount(l), 0)
  const mainCards = chosen.filter(isMainLane).reduce((n, l) => n + laneCount(l), 0)
  const steps = TAKE_STEPS.filter(n => n < chosenTotal)
  return {
    kinds: [
      { key: 'all', label: t.gateModesAll(everyMode) },
      { key: 'main', label: t.gateModesMain(mainCards) },
    ],
    steps,
    lengths: [...steps.map(n => ({ key: String(n), label: String(n) })), { key: 'all', label: t.gateTakeAll(chosenTotal) }],
  }
}

// Same tap the board rows used to make: the announcement, then the
// gate. /today has no clip in public/sounds/announcements, so
// playAnnouncement plays the jingle alone and degrades exactly the
// way it is built to. The section is Today's, with the run's path,
// and `stage`: the run is drawn on the stage, so on the desk the gate
// spans the window from its first frame rather than stopping at the
// rail and jumping over it when the chrome turns (TicketGate).
function departWith(today, off, cut, t) {
  playAnnouncement('today')
  beginDeparture({ ...sectionFor('/today', t), path: runPathFor(today.lanes ?? [], off, cut), stage: true })
}

// A lane as a switch's content: its tick, where over what, its tags
// and what it puts in the run.
function LaneRow({ lane, on, metered, t }) {
  return (
    <>
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
      <span className="lane__due">{laneCount(lane)}</span>
    </>
  )
}

// ── 一押し — the gate on a phone, in one gesture (plan 166) ──────
// The owner's pick C of four drawn on the canvas "Tsuji — Today on the
// phone": the common case is "clear the day", or clear it with a
// limit, so the phone's gate is the day as one card -- what the run
// takes and roughly how long, a bar of each line's share of it, then
// the two questions that shape it (which cards: every mode or the main
// flashcards; how many: 20 / 50 / 100 / all) -- and the gate under it
// at the thumb. The switches the card used to scroll inside itself,
// and the line chips over them, moved behind one row that opens them
// in a sheet: a fine choice a learner makes some days, not every day,
// and the card no longer holds a second scroll.
function PhoneGate({ today, lanes, lines, isOn, off, toggle, toggleLine, take, setTake, main, setMain, chosen, credits, metered, enforced, t, lang }) {
  const [open, setOpen] = useState(false)
  const run = runOf({ today, isOn, take, metered, credits, enforced, lang })
  const { taken, free, cut, share, minutes, owed, closed } = run
  const { kinds, steps, lengths } = choicesOf(chosen, run.chosenTotal, t)
  const unit = cut != null ? t.gateTakeOf(run.chosenTotal) : (owed === 0 && taken > 0 ? t.newUnit : t.dueUnit)
  // Each line's share of the run, in the lines' order: the bar and its key.
  const mix = lines
    .map(line => ({ type: line.type, n: line.lanes.reduce((sum, l) => sum + share(l), 0) }))
    .filter(part => part.n > 0)
  const riding = lanes.filter(isOn).length

  return (
    <div className="gate-one">
      <section className="gate-card gate-card--one" data-guide="today.gate" aria-label={t.fareGate}>
        <div className="gate-card__figure">
          <span className="gate-card__count">{taken}</span>
          <span className="gate-card__unit">{unit}</span>
          {minutes != null && (
            <span className="gate-card__time" role="img" aria-label={t.gateMinutesLabel(minutes)}>≈ {minutes} {t.gateMinutes}</span>
          )}
        </div>

        {mix.length > 0 && (
          <div className="gate-mix">
            <span className="gate-mix__bar" aria-hidden="true">
              {mix.map(part => (
                <span key={part.type} className="gate-mix__part" style={{ '--lane-color': LINE_COLOR[part.type], flexGrow: part.n }} />
              ))}
            </span>
            <ul className="gate-mix__keys" aria-label={t.todayLines}>
              {mix.map(part => (
                <li key={part.type} className="gate-mix__key" style={{ '--lane-color': LINE_COLOR[part.type] }}>
                  <span className="gate-mix__ring" aria-hidden="true" />
                  {LINE_TITLE[part.type]?.(t) ?? part.type}
                  <span className="gate-mix__n">{part.n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="gate-card__asks">
          <div className="gate-card__ask">
            <span className="gate-card__ask-label" aria-hidden="true">{t.gateWhich}</span>
            <Seg full className="gate-card__modes" label={t.gateWhich} options={kinds} value={main ? 'main' : 'all'} onChange={key => setMain(key === 'main')} />
          </div>
          {steps.length > 0 && (
            <div className="gate-card__ask">
              <span className="gate-card__ask-label" aria-hidden="true">{t.gateHowMany}</span>
              <Seg full className="gate-card__take" label={t.gateHowMany} options={lengths} value={cut != null ? String(cut) : 'all'} onChange={key => setTake(key === 'all' ? null : Number(key))} />
            </div>
          )}
        </div>
      </section>

      <button type="button" className="gate-one__services" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="gate-one__services-name">{t.gateServices}</span>
        <span className="gate-one__services-of">{t.gateServicesOf(riding, lanes.length)}</span>
        <ChevronIcon direction="right" size={16} />
      </button>

      <span className="gate-one__air" aria-hidden="true" />

      <div className="gate-one__foot">
        <Shortfall due={taken} free={free} credits={credits} t={t} lang={lang} />
        {/* 改札 (plan 164): the boarding's gate, the one filled action. */}
        <GateButton
          label={t.depart}
          data-guide="today.fare"
          onClick={() => departWith(today, off, cut, t)}
          aria-label={t.todayDue(taken)}
          disabled={closed || taken === 0}
        />
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} jp={t.gateServicesTitle} label={t.gateServicesTitle} className="gate-sheet">
        <div className="gate-sheet__lines">
          {lines.map(line => (
            <div key={line.type} className="gate-sheet__line" style={{ '--lane-color': LINE_COLOR[line.type] }}>
              <button
                type="button"
                className={`gate-sheet__head${line.on ? '' : ' gate-sheet__head--off'}`}
                aria-pressed={line.on}
                onClick={() => toggleLine(line)}
              >
                <span className="lane__tick" aria-hidden="true">{line.on && <CheckIcon size={11} />}</span>
                <span className="gate-sheet__name">{LINE_TITLE[line.type]?.(t) ?? line.type}</span>
                <span className="gate-sheet__due">{line.due}</span>
              </button>
              {line.lanes.map(lane => {
                const on = isOn(lane)
                return (
                  <button
                    key={lane.id}
                    type="button"
                    className={`lane${on ? '' : ' lane--off'}`}
                    style={{ '--lane-color': LINE_COLOR[line.type] }}
                    aria-pressed={on}
                    onClick={() => toggle(lane.id)}
                  >
                    <LaneRow lane={lane} on={on} metered={metered} t={t} />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary gate-sheet__done" onClick={() => setOpen(false)}>{t.done}</button>
      </Sheet>
    </div>
  )
}

// ── 区間 — the run's length, kept per browser (plan 135) ─────────
const TAKE_KEY = 'tsuji.gateTake'
const MAIN_KEY = 'tsuji.gateMain'
function readMain() {
  try {
    return window.localStorage.getItem(MAIN_KEY) === '1'
  } catch {
    return false
  }
}
function writeMain(on) {
  try {
    if (on) window.localStorage.setItem(MAIN_KEY, '1')
    else window.localStorage.removeItem(MAIN_KEY)
  } catch { /* private window: the choice lasts the visit */ }
}
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
function DeskGate({ today, lines, isOn, off, toggle, toggleLine, take, setTake, main, setMain, chosen, credits, metered, enforced, t, lang }) {
  const run = runOf({ today, isOn, take, metered, credits, enforced, lang })
  const { chosenTotal, cut, share, taken, free, balance, rides, waits, minutes, owed, closed, clock } = run
  // Nothing paid rides: every paid lane waits for the refill, and says so.
  const paidWait = metered && waits > 0 && rides <= free
  const cap = credits?.cap ?? CAP
  const unit = cut != null ? t.gateTakeOf(chosenTotal) : (owed === 0 && taken > 0 ? t.newUnit : t.dueUnit)
  // What this choice leaves for tomorrow, for the week ahead beside it.
  const left = Math.max(0, (today.total ?? 0) - taken)
  useEffect(() => {
    publishLeft(left)
    return () => publishLeft(0)
  }, [left])

  // The two ways to board what the switches chose -- every mode, or
  // each line's main flashcard alone -- and the run's length.
  const { kinds, steps, lengths: options } = choicesOf(chosen, chosenTotal, t)

  const depart = () => departWith(today, off, cut, t)

  return (
    <div className="gate-card gate-card--desk" data-guide="today.gate">
      <div className="gate-card__head">
        <span className="gate-card__title">{t.fareGate}</span>
        <span className="gate-card__figs">
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

      {/* What boards, as two instruments under the head: which modes
          (every one, or each line's main flashcard) on the left, the
          run's length on the right. The head keeps the figures. */}
      <div className="gate-card__console">
        <Seg
          className="gate-card__modes"
          label={t.gateModes}
          options={kinds}
          value={main ? 'main' : 'all'}
          onChange={key => setMain(key === 'main')}
        />
        {steps.length > 0 && (
          <span className="gate-card__length" data-guide="today.take">
            <Seg
              className="gate-card__take"
              label={t.gateTake}
              options={options}
              value={cut != null ? String(cut) : 'all'}
              onChange={key => setTake(key === 'all' ? null : Number(key))}
            />
          </span>
        )}
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
                  const waitsHere = paidWait && on && laneFreeShare(lane, mine) < mine
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
                            <span className="lane__waits"><HourglassIcon size={12} /><span className="sr-only">{t.laneWaits('')}</span>{clock ?? ''}</span>
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

      <div className="gate-card__fare" data-guide="today.fare">
        {metered && (
          <div className="gate-card__fare-parts">
            <span className="gate-card__part gate-card__part--rides">
              <span className="gate-card__part-n">{rides}</span>
              <span className="gate-card__part-l">{rides > 0 && rides <= free ? t.gateRidesFree : t.gateRides}</span>
            </span>
            {waits > 0 && (
              <span className="gate-card__part gate-card__part--waits">
                <span className="gate-card__part-n">{waits}</span>
                <span className="gate-card__part-l">{t.gateWaits(clock)}</span>
              </span>
            )}
            <span className="gate-card__part">
              <span className="gate-card__part-n">{balance}{showsCap(balance, cap) ? ` / ${cap}` : ''}</span>
              <span className="gate-card__part-l">{t.gateBalance}</span>
            </span>
          </div>
        )}
        {/* 改札 (plan 164): Depart drawn as the boarding's gate, the
            pass's mark in its reader -- the outline while nothing is
            chosen, woken by the first lane switched back on. */}
        <GateButton
          label={t.depart}
          onClick={depart}
          aria-label={t.todayDue(taken)}
          keys
          disabled={closed || taken === 0}
        />
      </div>
      <DepartKey onDepart={depart} disabled={closed || taken === 0} />
    </div>
  )
}
