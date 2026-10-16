import { useState, useEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { modeLabel } from '../../domain/studyModes'
import { kanaSetLabel } from '../../domain/kanaSets'
import { sectionFor } from '../../config/stations'
import { LINE_COLOR } from '../../config/tabs'
import { beginDeparture } from '../../stores/departure'
import { playAnnouncement, playClick } from '../../lib/audio'
import { Seg } from '../chrome/Console'
import { Sheet } from '../chrome/Sheet'
import { DepartKey } from '../chrome/DeskKeys'
import { GateButton } from '../ui/GateButton'
import { useDesk } from '../../hooks/useDesk'
import { useMinute } from '../../hooks/useMinute'
import { Loading } from '../ui/Loading'
import { CheckIcon, ChevronIcon } from '../ui/Icons'
import { QuietButton } from '../dayclear/kit'
import { useCredits } from '../../stores/credits'
import { useProfileSummary } from '../../stores/profileSummary'
import { publishLeft } from '../../stores/gateRun'
import { runFit, isFreeLane, laneFreeShare, nextCreditClock, refillClock } from '../../domain/credits'
import { laneTypeOf, laneWhere as whereOf, runPathFor, untilNext, splitTake, laneCount, isMainLane, TAKE_STEPS } from '../../domain/lanes'
import { restWeek, sealDate, utcToday, weekdayKanji } from '../../domain/dayClear'
import { longDate } from '../dayclear/aria'
import { WeekStamps } from '../dayclear/kit/WeekStamps'
import { WeekAhead } from '../journey/WeekAhead'
import { TodayDial, FareKey, LineKeys } from './TodayDial'
import { TodayDay } from './TodayDay'
import { TodayPrint, PrintTitle } from './TodayPrint'
import { BELOW, PRINT, at, printHour, printVars, usePrintFrame } from './print/usePrint'

// ── 改札 — the fare gate ─────────────────────────────────────
// The day's reviews, first thing on Today, and the run's picker: each
// lane is a switch, the run covers the lanes that are on, and the
// screen's one filled action departs with them (plan 070).
//
// 一目 (plan 199, the owner's pick A2 of the canvas "Tsuji — Today at a
// glance"): the gate is read at a glance. The run is a dial -- a ring
// of the lines round the count, its minutes and the hour it ends --
// and, while the balance cannot pay for all of it, a thinner ring
// inside saying what boards and what waits; under it the legend, one
// row saying what the run is (which cards, how many, how many
// services) and the gate. Every choice that shapes the run lives a tap
// away on a phone (the services sheet: which cards, how many with what
// each takes, the lines and their modes, and the day in four figures)
// and in the column beside the dial on the desk. A day with nothing due
// is the dial closed round the day's stamp (ClearedGate).
//
// Two manners carry over: nothing is rendered after the fetch failed
// (the screen owns up instead), and the wait is drawn (plan 067).
//
// 無料 — the kana lanes ride free (domain/credits.js), counted out of
// what the balance has to cover, and marked on their line.
//
// Departing: the ticket-gate cutscene (stores/departure) and then
// /today/run, carrying the chosen lanes in the query — omitted when
// every lane is on, since an empty `lanes` already means the whole
// queue on the backend and the run's session key must not churn.

// Grouped by type, in the lines' order, because the pigment is what
// tells one lane from another and the backend's order interleaves them.
// Stable, so the backend's urgency order within a type survives.
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
const titlesOf = t => Object.fromEntries(Object.entries(LINE_TITLE).map(([k, f]) => [k, f(t)]))

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
  // once.
  const [take, setTakeState] = useState(readTake)
  function setTake(next) {
    setTakeState(next)
    writeTake(next)
  }
  // 主 — the main flashcards alone: each line's recognition
  // card rides and every other mode stays on the platform. A filter
  // over the learner's own switches rather than a rewrite of them, so
  // "every mode" gives back the choice as it stood. The default since
  // plan 199 (the owner's ask), and remembered like the run's length.
  const [main, setMainState] = useState(readMain)
  function setMain(next) {
    setMainState(next)
    writeMain(next)
  }

  if (failed) return null
  if (!today) return <PrintWait desk={desk} t={t} />

  if ((today.total ?? 0) === 0) return <ClearedGate today={today} desk={desk} />

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
  // A line's switch says whether it rides today: lit while any of its
  // lanes does, so a tap takes the line out of the day; unlit, a tap
  // puts it back as the choice of cards would board it (its main
  // flashcard under Principales, every mode under every mode). With the
  // main cards the default (plan 199) most lines ride in part, and a
  // switch lit only for a whole line would have read "off" on every
  // line that rides.
  const lines = TYPE_ORDER
    .map(type => {
      const own = lanes.filter(l => laneTypeOf(l) === type)
      const riding = own.filter(isOn).length
      return { type, lanes: own, due: own.reduce((n, l) => n + laneCount(l), 0), riding, on: riding > 0 }
    })
    .filter(line => line.lanes.length > 0)

  function toggleLine(line) {
    if (line.on) { choose(line.lanes.filter(isOn).map(l => l.id), false); return }
    const want = main ? line.lanes.filter(isMainLane) : line.lanes
    choose((want.length ? want : line.lanes).map(l => l.id), true)
  }

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
  // the learning steps' repeats on any line. A pass is not asked.
  const free = metered ? queue.reduce((n, l) => n + laneFreeShare(l, shares.get(l.id) ?? 0), 0) : 0
  const balance = metered ? credits.balance : null
  const { rides, waits } = runFit(taken, balance, free)
  const spr = today.seconds_per_review
  const minutes = minutesFor(taken, spr)
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
    queue, chosenTotal, cut, share, taken, free, balance, rides, waits, minutes, owed, closed, spr,
    // When the refill lands its next credit (plan 141) -- what a paid
    // lane that cannot board is waiting for.
    clock: nextCreditClock(credits, lang),
  }
}

// What `n` cards take at the learner's pace, rounded, never under a
// minute; nothing before the pace is known.
function minutesFor(n, spr) {
  return spr && n > 0 ? Math.max(1, Math.round((n * spr) / 60)) : null
}

// The two choices: which modes (each line's main flashcard, the
// default, or every one) and how many cards, each option with what it
// rides -- and a length with the minutes it takes, so the consequence of
// a choice is printed before it is made (DESIGN.md, Settings).
function choicesOf(chosen, chosenTotal, spr, t) {
  const everyMode = chosen.reduce((n, l) => n + laneCount(l), 0)
  const mainCards = chosen.filter(isMainLane).reduce((n, l) => n + laneCount(l), 0)
  const steps = TAKE_STEPS.filter(n => n < chosenTotal)
  const sub = n => {
    const m = minutesFor(n, spr)
    return m == null ? null : `${m} ${t.gateMinutes}`
  }
  return {
    kinds: [
      { key: 'main', label: t.gateModesMainName, figure: mainCards },
      { key: 'all', label: t.gateModesAllName, figure: everyMode },
    ],
    steps,
    lengths: [
      ...steps.map(n => ({ key: String(n), label: String(n), sub: sub(n) })),
      { key: 'all', label: t.gateTakeWord, sub: sub(chosenTotal) },
    ],
  }
}

// Same tap the board rows used to make: the announcement, then the
// gate. The section is Today's, with the run's path, and `stage`: the
// run is drawn on the stage, so on the desk the gate spans the window
// from its first frame (TicketGate).
function departWith(today, off, cut, t) {
  playAnnouncement('today')
  beginDeparture({ ...sectionFor('/today', t), path: runPathFor(today.lanes ?? [], off, cut), stage: true })
}

// Each line's share of the run and what is chosen of it, in the lines'
// order: the dial's arcs and the legend.
function mixOf(lines, isOn, share) {
  return lines
    .map(line => ({
      type: line.type,
      chosen: line.lanes.filter(isOn).reduce((n, l) => n + laneCount(l), 0),
      n: line.lanes.reduce((n, l) => n + share(l), 0),
    }))
    .filter(part => part.chosen > 0)
}

// ── The dial's middle: the count and what it is; on the print the
// disc holds them, and the minutes and the hour they end are a line
// under the rings (the clock read once a minute, so it moves with it).
function unitOf({ taken, cut, chosenTotal, owed }, t) {
  return cut != null ? t.gateTakeOf(chosenTotal) : (owed === 0 && taken > 0 ? t.newUnit : t.dueUnit)
}

function DialCount({ run, t }) {
  return (
    <>
      <span className="tdy-dial__count">{run.taken}</span>
      <span className="tdy-dial__unit">{unitOf(run, t)}</span>
    </>
  )
}

function DialTime({ run, t, lang, style }) {
  const now = useMinute()
  const { minutes } = run
  if (minutes == null) return null
  const ends = refillClock(new Date(now.getTime() + minutes * 60_000).toISOString(), lang)
  return (
    <p className="tdy-dial__line tpr-at" style={style}>
      <b className="tdy-dial__time" role="img" aria-label={t.gateMinutesLabel(minutes)}>≈ {minutes} {t.gateMinutes}</b>
      {ends && <> · <span className="tdy-dial__end">{t.gateEndsAt(ends)}</span></>}
    </p>
  )
}

// ── 浮世絵 — the gate on the print of the hour (plan 205) ─────────
// The owner's pick of the canvas "Tsuji — Today, the visit card"
// (round 9): the gate stands on a print of the hour (TodayPrint), its
// dial the print's sun or moon, the lines under the dial set on the
// sky, the title slip down the right edge; on a phone the row and the
// gate at the thumb over the print's foreground, on the desk the gate
// under the dial and the services' board hung beside it. Everything
// placed on the print is placed in its units (print/usePrint.js), so it
// stands where the canvas drew it at any size. The frame chooses the
// print (`print`, null until it has been measured): a wide one in the
// phone's layout takes the desk's.
function usePrint(layout, anchorRef) {
  const now = useMinute()
  const hour = printHour(now)
  const [frameRef, box] = usePrintFrame(layout, anchorRef)
  const print = box?.print ?? layout
  const frame = PRINT.frames[print]
  return {
    now, hour, frame, frameRef, print: box?.print ?? null,
    style: printVars(hour, print, box), dial: { frame, disc: PRINT.hours[hour].disc },
  }
}

// The wait, drawn: the print of the hour comes first, the dial empty
// over it until the day has.
function PrintWait({ desk, t }) {
  const layout = desk ? 'desk' : 'phone'
  const p = usePrint(layout)
  const { frame } = p
  return (
    <div className={`tdy tdy--print tdy--${layout}`} style={p.style} data-hour={p.hour}>
      <TodayPrint hour={p.hour} device={p.print} frameRef={p.frameRef} />
      <section className="tdy-hero tdy-hero--print tdy-wait" aria-busy="true" aria-label={t.fareGate}>
        <PrintTitle now={p.now} hour={p.hour} />
        <TodayDial parts={[]} print={p.dial} className="tpr-at" style={at(frame.cx, frame.cy)}><Loading tight /></TodayDial>
      </section>
    </div>
  )
}

// What the dial and its legend draw, for either gate.
function dialOf({ lines, isOn, run, metered }) {
  const mix = mixOf(lines, isOn, run.share)
  const parts = mix.map(m => ({ key: m.type, n: m.chosen, lit: m.n }))
  const short = metered && run.waits > 0
  return { mix, parts, short, fare: short ? { rides: run.rides, total: run.taken } : null }
}

// A lane as a switch's content: its tick, where over what, its tags
// and what it puts in the run.
function LaneRow({ lane, on, metered, t }) {
  return (
    <>
      <span className="lane__tick" aria-hidden="true">{on && <CheckIcon size={11} />}</span>
      <span className="lane__names">
        <span className="lane__where">{whereOf(lane, t, kanaSetLabel)}</span>
        <span className="lane__mode">{modeLabel(t, lane.mode)}</span>
      </span>
      {metered && isFreeLane(lane) && <span className="lane__free">{t.freeFare}</span>}
      {lane.new > 0 && <span className="lane__new">{t.laneNew(lane.new)}</span>}
      <span className="lane__due">{laneCount(lane)}</span>
    </>
  )
}

// ── 線 — a line in the services: its switch, its share, its modes ──
// The head is the line's switch (its tick, its name, its share of the
// run, and what it holds today when that is more). Under it, a line of
// one mode says it; a line of several lists them as switches behind a
// chevron, on the desk as on a phone (plan 199b, the owner's word: the
// details are not opened by default). `bare` (the desk's board, A3·1)
// keeps a closed line to its one row: what rides of it is a tap away.
function LineRow({ line, isOn, share, toggle, toggleLine, metered, open, onOpen, bare = false, t }) {
  const many = line.lanes.length > 1
  const title = LINE_TITLE[line.type]?.(t) ?? line.type
  const lineShare = line.lanes.reduce((n, l) => n + share(l), 0)
  const free = metered && line.lanes.every(isFreeLane)
  const riding = line.lanes.filter(isOn)
  const fresh = riding.reduce((n, l) => n + (l.new ?? 0), 0)
  const said = l => `${whereOf(l, t, kanaSetLabel)} · ${modeLabel(t, l.mode)}`
  const sub = riding.length
    ? [riding.map(said).join(' · '), fresh > 0 ? t.laneNew(fresh) : null].filter(Boolean).join(' · ')
    : t.gateLineNone
  return (
    <li className={`tdy-line${line.on ? '' : ' tdy-line--off'}`} style={{ '--lane-color': LINE_COLOR[line.type] }}>
      <button type="button" className="tdy-line__head" aria-pressed={line.on} onClick={() => toggleLine(line)}>
        <span className="lane__tick" aria-hidden="true">{line.on && <CheckIcon size={12} />}</span>
        <span className="tdy-line__name">
          {title}
          {free && <span className="tdy-line__tag">{t.freeFare}</span>}
        </span>
        <span className="tdy-line__n">
          {line.on ? lineShare : line.due}
          {line.on && lineShare !== line.due && <small> / {line.due}</small>}
        </span>
      </button>
      {many && (
        <button type="button" className="tdy-line__more" aria-expanded={open} aria-label={t.gateLineModes(title)} onClick={() => { playClick(); onOpen() }}>
          <ChevronIcon direction={open ? 'up' : 'down'} size={16} />
        </button>
      )}
      {many && open ? (
        <div className="tdy-line__lanes" role="group" aria-label={t.gateLineModes(title)}>
          {line.lanes.map(lane => {
            const on = isOn(lane)
            return (
              <button key={lane.id} type="button" className={`lane${on ? '' : ' lane--off'}`} aria-pressed={on} onClick={() => toggle(lane.id)}>
                <LaneRow lane={lane} on={on} metered={metered} t={t} />
              </button>
            )
          })}
        </div>
      ) : bare ? null : (
        <span className="tdy-line__sub">{sub}</span>
      )}
    </li>
  )
}

// ── 選 — the services: the two choices and the lines ─────────────
// The sheet's body on a phone and the column's head on the desk. No
// title over either choice (the owner's word on the canvas): each
// option says what it is and what it rides.
function Services({ lines, isOn, share, toggle, toggleLine, choices, main, setMain, cut, setTake, metered, desk = false, t }) {
  const [open, setOpen] = useState(() => new Set())
  const flip = type => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    return next
  })
  return (
    <>
      <div className="tdy-asks">
        <Seg full className="tdy-seg" label={t.gateWhich} options={choices.kinds} value={main ? 'main' : 'all'} onChange={key => setMain(key === 'main')} />
        {choices.steps.length > 0 && (
          <Seg full className="tdy-seg tdy-seg--two" label={t.gateHowMany} options={choices.lengths} value={cut != null ? String(cut) : 'all'} onChange={key => setTake(key === 'all' ? null : Number(key))} />
        )}
      </div>
      <ul className="tdy-lines" aria-label={t.todayLines}>
        {lines.map(line => (
          <LineRow
            key={line.type}
            line={line} isOn={isOn} share={share} toggle={toggle} toggleLine={toggleLine} metered={metered} t={t}
            open={open.has(line.type)}
            onOpen={() => flip(line.type)}
            bare={desk}
          />
        ))}
      </ul>
    </>
  )
}

// ── 一押し — the gate on a phone (plan 166, redrawn by plan 199) ──
// The dial and its legend on the room's middle, and at the thumb the
// row that says what the run is (and opens the services) over the gate.
// The foot never leaves the screen (owner-directed): it docks on the
// tab bar on the page's own ground, and the air gives way first.
function PhoneGate({ today, lanes, lines, isOn, off, toggle, toggleLine, take, setTake, main, setMain, chosen, credits, metered, enforced, t, lang }) {
  const [open, setOpen] = useState(false)
  const run = runOf({ today, isOn, take, metered, credits, enforced, lang })
  const choices = choicesOf(chosen, run.chosenTotal, run.spr, t)
  const { mix, parts, short, fare } = dialOf({ lines, isOn, run, metered })
  const riding = lanes.filter(isOn).length
  const depart = () => { setOpen(false); departWith(today, off, run.cut, t) }
  const gate = (
    <GateButton
      label={t.depart}
      onClick={depart}
      aria-label={t.todayDue(run.taken)}
      disabled={run.closed || run.taken === 0}
    />
  )

  const p = usePrint('phone')
  const { frame } = p
  return (
    <div className="tdy tdy--print tdy--phone" style={p.style} data-hour={p.hour}>
      <TodayPrint hour={p.hour} device={p.print} frameRef={p.frameRef} />
      <section className="tdy-hero tdy-hero--print" aria-label={t.fareGate}>
        <PrintTitle now={p.now} hour={p.hour} />
        <TodayDial parts={parts} fare={fare} print={p.dial} className="tpr-at" style={at(frame.cx, frame.cy)}>
          <span className="tdy-dial__gate" data-guide="today.gate" aria-hidden="true" />
          <DialCount run={run} t={t} />
        </TodayDial>
        <DialTime run={run} t={t} lang={lang} style={at(frame.cx, frame.cy + frame.fare + BELOW.time)} />
        <div className="tpr-at" style={at(frame.cx, frame.cy + frame.fare + BELOW.keys)}>
          {short
            ? <FareKey rides={run.rides} waits={run.waits} clock={run.clock} t={t} />
            : <LineKeys mix={mix} titles={titlesOf(t)} label={t.todayLines} />}
        </div>
      </section>
      <span className="tdy__air" aria-hidden="true" />

      <div className="tdy__foot">
        <button type="button" className="tdy-door" onClick={() => { playClick(); setOpen(true) }} aria-haspopup="dialog">
          <span className="tdy-door__what">
            <b>{main ? t.gateModesMainName : t.gateModesAllName}</b>
            {' · '}{run.cut ?? t.gateTakeAllWord}
            {' · '}{t.gateServicesN(riding)}
          </span>
          <span className="tdy-door__go">{t.gateAdjust}<ChevronIcon direction="right" size={16} /></span>
        </button>
        {gate}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} jp={t.todayTitle} label={t.gateServicesTitle} className="tdy-sheet">
        <Services
          lines={lines} isOn={isOn} share={run.share} toggle={toggle} toggleLine={toggleLine}
          choices={choices} main={main} setMain={setMain} cut={run.cut} setTake={setTake}
          metered={metered} t={t}
        />
        <TodayDay today={today} />
        <div className="tdy-sheet__foot">{gate}</div>
      </Sheet>
    </div>
  )
}

// ── 机 — the gate as the desk draws it (plan 199) ────────────────
// The owner's pick A2 on the desk: the dial at the size the room gives
// it on a panel the window's height, its legend in words, the gate at
// the panel's foot; beside it, in a column at the entry's width, what
// the sheet holds on a phone -- the two choices and the lines, their
// modes behind a chevron (plan 199b) -- and the day: its four figures
// and the week ahead. One board since plan 199b (the owner's pick A3·1
// of the canvas): a line a row, the day a strip of four figures over a
// slim week, so the column holds a five-line day without scrolling
// down to the short desk.
function DeskGate({ today, lines, isOn, off, toggle, toggleLine, take, setTake, main, setMain, chosen, credits, metered, enforced, t, lang }) {
  const run = runOf({ today, isOn, take, metered, credits, enforced, lang })
  const choices = choicesOf(chosen, run.chosenTotal, run.spr, t)
  const { mix, parts, short, fare } = dialOf({ lines, isOn, run, metered })
  // What this choice leaves for tomorrow, for the week ahead beside it.
  const left = Math.max(0, (today.total ?? 0) - run.taken)
  useEffect(() => {
    publishLeft(left)
    return () => publishLeft(0)
  }, [left])
  const depart = () => departWith(today, off, run.cut, t)
  const closed = run.closed || run.taken === 0
  // The print centres on the gate's column, so the dial stands over the gate.
  const hero = useRef(null)
  const p = usePrint('desk', hero)
  const { frame } = p

  return (
    <div className="tdy-desk tdy--print tdy--desk" style={p.style} data-hour={p.hour}>
      <TodayPrint hour={p.hour} device={p.print} frameRef={p.frameRef} />
      <section className="tdy-hero tdy-hero--print" aria-label={t.fareGate}>
        <PrintTitle now={p.now} hour={p.hour} />
        <TodayDial parts={parts} fare={fare} print={p.dial} className="tpr-at" style={at(frame.cx, frame.cy)}>
          <span className="tdy-dial__gate" data-guide="today.gate" aria-hidden="true" />
          <DialCount run={run} t={t} />
        </TodayDial>
        <DialTime run={run} t={t} lang={lang} style={at(frame.cx, frame.cy + frame.fare + 28)} />
        <div className="tdy-desk__keys tpr-at tpr-at--top" style={at(frame.cx, frame.cy + frame.fare + 62)}>
          <LineKeys mix={mix} titles={titlesOf(t)} named label={t.todayLines} />
        </div>
        {short && (
          <div className="tpr-at" style={at(frame.cx, frame.cy + frame.fare + 128)}>
            <FareKey rides={run.rides} waits={run.waits} clock={run.clock} t={t} />
          </div>
        )}
      </section>
      <div className="tdy-desk__hero" ref={hero}>
        <div className="tdy-desk__go">
          <GateButton label={t.depart} onClick={depart} aria-label={t.todayDue(run.taken)} keys disabled={closed} />
        </div>
      </div>
      <aside className="tdy-desk__col">
        <section className="tdy-desk__panel tdy-desk__svc" aria-label={t.gateServicesTitle}>
          <Services
            lines={lines} isOn={isOn} share={run.share} toggle={toggle} toggleLine={toggleLine}
            choices={choices} main={main} setMain={setMain} cut={run.cut} setTake={setTake}
            metered={metered} desk t={t}
          />
          <DeskDay today={today} part />
        </section>
      </aside>
      <DepartKey onDepart={depart} disabled={closed} />
    </div>
  )
}

// The desk's day: the four figures over the week ahead. A panel of its
// own beside a cleared dial; under the services, the board's foot, its
// figures a strip (`part`, plan 199b).
function DeskDay({ today, part = false }) {
  const { t } = useLang()
  if (part) {
    return (
      <div className="tdy-desk__day">
        <TodayDay today={today} strip />
        <WeekAhead />
      </div>
    )
  }
  return (
    <section className="tdy-desk__panel tdy-desk__day" aria-label={t.todayDayLabel}>
      <TodayDay today={today} />
      <WeekAhead />
    </section>
  )
}

// ── 済 — a day with nothing due (plans 199, 206) ─────────────────
// The owner's ruling on the canvas: the empty gate looked cheap. The
// dial closes round the day it was: its ring is today's reviews by line
// (/api/today's `reviewed`). Under it what the day was and the week's
// stamps; at the foot tomorrow as a row of a departure board, and the
// gate shut, saying when it opens. On the print (plan 206, the owner's
// pick G3 of the canvas, round 10) the disc itself is the day's
// 駅スタンプ, cut in red where the sun or the moon was (TodayDial's
// CutSeal), and the last train has gone from the viaduct. A day with
// nothing reviewed and nothing due stamps nothing: the hour's own disc,
// saying the learner is up to date.
function ClearedGate({ today, desk }) {
  const { t, lang } = useLang()
  const summary = useProfileSummary()
  const day = utcToday()
  const reviewed = today.reviewed
  const stamped = (reviewed?.total ?? 0) > 0
  const parts = TYPE_ORDER
    .map(key => ({ key, n: reviewed?.by_line?.[key] ?? 0 }))
    .filter(p => p.n > 0)
  const week = summary?.streak > 0 ? restWeek(summary.week, [], day) : null
  const tomorrow = today.tomorrow
  const opens = opensWords(today.next_due, t, lang)
  const held = today.review?.held ?? 0
  function rideExtra() {
    playAnnouncement('today')
    beginDeparture({ ...sectionFor('/today', t), path: '/today/run?extra=1', stage: true })
  }
  // On the desk the print centres on the gate's column, as DeskGate's does.
  const heroRef = useRef(null)
  const p = usePrint(desk ? 'desk' : 'phone', desk ? heroRef : null)
  const { frame } = p
  const seal = stamped
    ? { day: weekdayKanji(day), foot: sealDate(day), label: t.clrSealAria(longDate(day, lang)) }
    : null

  const hero = (
    <section className="tdy-hero tdy-hero--print tdy-hero--clear" aria-label={t.fareGate}>
      <PrintTitle now={p.now} hour={p.hour} />
      <TodayDial parts={parts} print={p.dial} seal={seal} className="tpr-at" style={at(frame.cx, frame.cy)}>
        <span className="tdy-dial__gate" data-guide="today.gate" aria-hidden="true" />
        {!stamped && <span className="tdy-dial__clear">{t.todayNothingDueShort}</span>}
      </TodayDial>
      {stamped && (
        <p className="tdy-recap tdy-dial__line tpr-at" style={at(frame.cx, frame.cy + frame.fare + BELOW.time)}>
          <b>{reviewed.total}</b> {t.todayReviewedUnit(reviewed.total)}
        </p>
      )}
      {week && (
        <div className="tdy-rally tpr-at" style={at(frame.cx, frame.cy + frame.fare + BELOW.week)}>
          <WeekStamps week={week} label={t.todayWeekStamps(summary.streak)} />
          <span className="tdy-rally__n" aria-hidden="true"><b>{summary.streak}</b>{t.todayStreakDays(summary.streak)}</span>
        </div>
      )}
    </section>
  )
  const foot = (
    <>
      {tomorrow?.cards > 0 && (
        <div className="tdy-next" role="group" aria-label={t.nudgeWhen.tomorrow}>
          <span className="tdy-next__day">{t.nudgeWhen.tomorrow}</span>
          <b className="tdy-next__n">{tomorrow.cards}<small>{t.todayCardsUnit(tomorrow.cards)}</small></b>
          <span className="tdy-next__min">≈ {tomorrow.minutes} {t.gateMinutes}</span>
        </div>
      )}
      {/* 回復運転 (plan 217): the share is spent and reviews wait past
          it -- the way on, for a learner who wants more, stands a rung
          over the shut gate as a quiet way. The ceiling is a default,
          never a lock. */}
      {held > 0 && (
        <QuietButton className="tdy-extra" data-action="review-extra" onClick={rideExtra}>
          {t.todayExtra(held)}
        </QuietButton>
      )}
      <GateButton label={opens ?? t.depart} aria-label={opens ?? t.todayNothingDueShort} disabled />
    </>
  )

  if (desk) {
    return (
      <div className="tdy-desk tdy--print tdy--desk tdy--clear" style={p.style} data-hour={p.hour}>
        <TodayPrint hour={p.hour} device={p.print} frameRef={p.frameRef} train={false} />
        {hero}
        <div className="tdy-desk__hero" ref={heroRef}>
          <div className="tdy-desk__go tdy-desk__go--clear">{foot}</div>
        </div>
        <aside className="tdy-desk__col">
          <DeskDay today={today} />
        </aside>
      </div>
    )
  }
  return (
    <div className="tdy tdy--print tdy--phone tdy--clear" style={p.style} data-hour={p.hour}>
      <TodayPrint hour={p.hour} device={p.print} frameRef={p.frameRef} train={false} />
      {hero}
      <span className="tdy__air" aria-hidden="true" />
      <div className="tdy__foot">{foot}</div>
    </div>
  )
}

// When the shut gate opens: its hour within the day, else the day.
function opensWords(iso, t, lang) {
  if (!iso) return null
  const at = new Date(iso)
  if (!Number.isFinite(at.getTime())) return null
  if (at.getTime() - Date.now() < 20 * 3600_000) return t.gateOpensAt(refillClock(iso, lang))
  const when = untilNext(iso, lang)
  return when ? t.gateOpensIn(when) : null
}

// ── 区間 — the run's length, kept per browser (plan 135) ─────────
const TAKE_KEY = 'tsuji.gateTake'
// 主 — which cards, kept the same way. The main flashcards are the
// default (plan 199), so what is kept is the learner leaving them:
// '0' is every mode, and nothing kept (a first visit, a private
// window, the '1' an earlier build wrote) is the main cards.
const MAIN_KEY = 'tsuji.gateMain'
function readMain() {
  try {
    return window.localStorage.getItem(MAIN_KEY) !== '0'
  } catch {
    return true
  }
}
function writeMain(on) {
  try {
    if (on) window.localStorage.removeItem(MAIN_KEY)
    else window.localStorage.setItem(MAIN_KEY, '0')
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
