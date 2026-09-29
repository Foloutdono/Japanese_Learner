import { Fragment, useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { DEPARTURES, DEPART_JP, DEPART_TIMES } from '../onboarding/departures'
import {
  DAY_STEP_MIN, DAY_START_MIN, LAST_DEPARTURE_MIN,
  bucketFor, clampDeparture, firstDeparture, minuteAtFraction, minutesToTime, timeToMinutes,
} from '../../domain/boarding'
import { Emphasized } from '../ui/Emphasized'
import { BoardQuestion, Continue } from './BoardFrame'
import { useDesk } from '../../hooks/useDesk'
import { useBoxSize } from '../../hooks/useBoxWidth'
import { PickMark } from './BoardOption'

// ── 7 · the hour (plan 075) ──────────────────────────────────────
// The departure board prints the hour on split flaps; the three cells
// are the announced rides (morning, noon, evening -- the same clock
// Settings › Destination keeps). On a phone (plan 167, the owner's
// pick ② of A07) the board is the control: ▲ and ▼ over and under the
// flaps turn the hour and the half hour, the three services under it
// set their own, and the line under them says when the first train
// leaves. On the desk (plan 163) the day is the sun's arc (DayArc). The
// board flips its last digit once per change.

// ── The board settles ────────────────────────────────────────────
// A 発車標 does not arrive already showing the time: every drum is
// spinning when the board lights, and they stop one after another from
// the left, which is the sound the whole thing is remembered for. The
// step's board did arrive already set, and only ever turned its last
// digit.
//
// So the four drums spin on their own tick and stop on a stagger. The
// aria-label carries the real time throughout — a screen reader is
// told the hour, never the spin — and reduced motion gets the settled
// board on the first frame.
const SPIN_TICK_MS = 60
const SPIN_STOP_MS = 260
const SPIN_STAGGER_MS = 180

function useSettling(digits) {
  const still = prefersStill()
  const [face, setFace] = useState(() => (still ? digits : digits.map(() => '0')))
  // How many drums have stopped, left to right — the stops fire in
  // order, so one counter says which are still turning and the count
  // itself is what re-renders the row.
  const [stopped, setStopped] = useState(still ? digits.length : 0)
  const turning = useRef(digits.map(() => true))

  useEffect(() => {
    if (still) return undefined
    const tick = setInterval(() => {
      // The live flags, not the render's: an array read from inside an
      // interval is the one the interval closed over on the frame it
      // was created.
      setFace(f => f.map((d, i) => (turning.current[i] ? String(Math.floor(Math.random() * 10)) : d)))
    }, SPIN_TICK_MS)
    const stops = digits.map((_, i) => setTimeout(() => {
      turning.current[i] = false
      setFace(f => f.map((d, j) => (j === i ? digits[j] : d)))
      setStopped(n => n + 1)
      if (turning.current.every(on => !on)) clearInterval(tick)
    }, SPIN_STOP_MS + i * SPIN_STAGGER_MS))
    return () => { clearInterval(tick); stops.forEach(clearTimeout) }
    // Once, when the board lights. A later change to the hour turns its
    // own drum (brd-flap--turn) rather than re-shuffling the whole board
    // under the learner's finger, which is why `digits` is not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Settled, the board IS the time: a change to the hour shows on the
  // next render rather than waiting for a tick that no longer runs.
  const settled = stopped >= digits.length
  return { face: settled ? digits : face, stopped }
}

function prefersStill() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function Flaps({ time }) {
  const [h1, h2, , m1, m2] = time.split('')
  const { face, stopped } = useSettling([h1, h2, m1, m2])
  // A drum still turning says so, so the board can be styled and read
  // mid-spin. The label is the hour throughout: a screen reader is told
  // the time, never the shuffle.
  const drum = i => `brd-flap${i >= stopped ? ' brd-flap--spin' : ''}`
  // Keyed on the time so the last tile remounts, and flips once, per change.
  return (
    <div className="brd-board__flaps" aria-label={time}>
      <span className={drum(0)}>{face[0]}</span>
      <span className={drum(1)}>{face[1]}</span>
      <span className="brd-board__colon" aria-hidden="true">:</span>
      <span className={drum(2)}>{face[2]}</span>
      <span key={time} className={`${drum(3)} brd-flap--turn`}>{face[3]}</span>
    </div>
  )
}

// `now` is the day the board's first departure is counted from.
export default function TimeStep({ minute, onChange, onContinue, now = null }) {
  const { t } = useLang()
  // 机 (plan 122): 1-3 pick one of the three hours.
  const desk = useDesk()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={desk ? t.brdTimeHint : null}>{t.brdTimeQ}</BoardQuestion>
        <div className="brd__stage">
          {desk
            ? <DayArc minute={minute} onChange={onChange} now={now ?? new Date()} />
            : <HourBoard minute={minute} onChange={onChange} now={now ?? new Date()} />}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} data-action="continue" />
      </div>
    </>
  )
}

// ── 発車標 — the board as the control (plan 167) ───────────────────
// The flaps turned by hand: ▲ and ▼ over the two hour drums move the
// hour, over the two minute drums the half hour, the day held from six
// to half past eleven (clampDeparture). The three services under the
// board are the announced rides, the one whose part of the day the hour
// stands in lit.
const STEPS = [[60, 30], [-60, -30]]

function HourBoard({ minute, onChange, now }) {
  const { t } = useLang()
  const time = minutesToTime(minute)
  const bucket = bucketFor(minute)
  const { later } = firstDeparture(now, minute)
  const turn = by => {
    const next = clampDeparture(minute + by)
    return { disabled: next === minute, onClick: () => onChange(next) }
  }
  return (
    <>
      <div className="brd-board brd-clock" role="group" aria-label={t.brdDayAria}>
        <span className="brd-board__cap">{t.brdDeparture}</span>
        {STEPS.map(([hour, half], row) => (
          <Fragment key={hour}>
            {row === 1 && <Flaps time={time} />}
            <p className="brd-clock__steps">
              <button type="button" className="brd-clock__step" aria-label={hour > 0 ? t.brdHourLater : t.brdHourEarlier} {...turn(hour)}>
                <StepChevron up={hour > 0} />
              </button>
              <button type="button" className="brd-clock__step" aria-label={half > 0 ? t.brdHalfLater : t.brdHalfEarlier} {...turn(half)}>
                <StepChevron up={half > 0} />
              </button>
            </p>
          </Fragment>
        ))}
      </div>
      <div className="brd-hours" role="group" aria-label={t.brdDeparture}>
        {DEPARTURES.map(id => (
          <button
            key={id}
            type="button"
            className="brd-hour"
            aria-pressed={bucket === id}
            onClick={() => onChange(timeToMinutes(DEPART_TIMES[id]))}
            data-hour={id}
          >
            <span className="brd-hour__jp" lang="ja">{DEPART_JP[id]}</span>
            <span className="brd-hour__name">{t.destHour[id]}</span>
            <span className="brd-hour__time">{DEPART_TIMES[id]}</span>
          </button>
        ))}
      </div>
      <p className="brd-clock__when"><Emphasized text={t.brdTrainAt(later, time)} /></p>
    </>
  )
}

function StepChevron({ up }) {
  return (
    <svg className="svg" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points={up ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
    </svg>
  )
}

// The train's keys on the desk's arc (the phone's rail took the same
// until plan 167 made the board its control): a half hour a press, two
// hours a page, the day's ends on Home and End.
function stepHour(e, minute, onChange) {
  const moves = {
    ArrowLeft: -DAY_STEP_MIN, ArrowDown: -DAY_STEP_MIN,
    ArrowRight: DAY_STEP_MIN, ArrowUp: DAY_STEP_MIN,
    PageDown: -120, PageUp: 120,
  }
  if (e.key in moves) { e.preventDefault(); onChange(clampDeparture(minute + moves[e.key])); return }
  if (e.key === 'Home') { e.preventDefault(); onChange(DAY_START_MIN) }
  if (e.key === 'End') { e.preventDefault(); onChange(LAST_DEPARTURE_MIN) }
}

// ── 辻 — the day as the sun's arc (plan 163, option 3) ───────────
// The owner's pick of five drawn for the hour (空の弧): the day as the
// sky from sunrise at the left, over noon at the top, to night at the
// right -- the three rides announced on it as stations (朝, 昼, 夜) and
// the departure board in the bowl under it. The train rides the arc, a
// half hour at a time: dragged along it, or its keys, as the phone's
// rail took them; the stretch of day behind it is gold, and the ride
// whose part of the day it stands in is lit. Standing on a ride's own
// hour, the station is the train.
//
// The arc is the box's own (useBoxSize): an ellipse on the horizon,
// the morning given the first quarter-turn (06 to 13) and the rest of
// the day the second (13 to 24), so noon's ride stands near the top.
const EDGE = 80     // beside the arc: the sun at its left end, the moon at its right
const BELOW = 28    // under the horizon: the day's two ends named
const ABOVE = 60    // over the arc's crown: half a station and its hour's name
const TURN = 13     // the hour at the crown
const RING = 48     // a station's ring's radius
const LABEL = 128   // a station's name beside its ring, and the gap to it

const angleAt = hours => (hours <= TURN
  ? Math.PI - ((hours - 6) / (TURN - 6)) * (Math.PI / 2)
  : Math.PI / 2 - ((hours - TURN) / (24 - TURN)) * (Math.PI / 2))
const hoursAt = angle => (angle >= Math.PI / 2
  ? 6 + ((Math.PI - angle) / (Math.PI / 2)) * (TURN - 6)
  : TURN + ((Math.PI / 2 - angle) / (Math.PI / 2)) * (24 - TURN))

function skyOf(width, height) {
  const cx = width / 2
  const cy = height - BELOW
  const rx = Math.max(0, Math.min(540, cx - EDGE))
  const ry = Math.max(0, Math.min(420, cy - ABOVE))
  const at = minute => {
    const a = angleAt(minute / 60)
    return [cx + rx * Math.cos(a), cy - ry * Math.sin(a)]
  }
  // Outward from the arc at an hour, for its tick and its name.
  const out = (minute, by) => {
    const a = angleAt(minute / 60)
    const nx = Math.cos(a) / rx
    const ny = Math.sin(a) / ry
    const n = Math.hypot(nx, ny) || 1
    const [x, y] = at(minute)
    return [x + (nx / n) * by, y - (ny / n) * by]
  }
  // The board in the bowl: as wide as the morning's name leaves it.
  const morning = cx - at(timeToMinutes(DEPART_TIMES.am))[0]
  const board = Math.max(0, Math.min(500, 2 * (morning - RING - LABEL)))
  return { cx, cy, rx, ry, at, out, board }
}

const r1 = n => Math.round(n * 10) / 10

function DayArc({ minute, onChange, now }) {
  const { t, lang } = useLang()
  const [boxRef, size] = useBoxSize(true)
  const time = minutesToTime(minute)
  const bucket = bucketFor(minute)
  const docked = DEPARTURES.some(id => timeToMinutes(DEPART_TIMES[id]) === minute)
  const g = size ? skyOf(size.width, size.height) : null

  // A point on the page to an hour on the arc: its angle about the
  // horizon's centre, on the ellipse's own proportions -- and how far
  // out from that centre it is, the arc itself at 1.
  function onArc(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!g || !rect.width) return null
    const dx = (e.clientX - rect.left - g.cx) / (g.rx || 1)
    const dy = (g.cy - (e.clientY - rect.top)) / (g.ry || 1)
    return { angle: Math.atan2(Math.max(0, dy), dx), out: Math.hypot(dx, dy) }
  }
  function fromPointer(e) {
    const at = onArc(e)
    if (at) onChange(minuteAtFraction((hoursAt(at.angle) - 6) / 18))
  }
  // The train is taken by itself or by the arc under it: not by a
  // station (its own button), nor by the board or the sky either side.
  function onPointerDown(e) {
    if (e.target.closest?.('button:not(.desk-brd__train)')) return
    const at = onArc(e)
    if (!at || (!e.target.closest?.('.desk-brd__train') && Math.abs(at.out - 1) > 0.2)) return
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* a pointer the page no longer holds */ }
    fromPointer(e)
  }
  function onPointerMove(e) {
    if (e.buttons === 0 || !e.currentTarget.hasPointerCapture?.(e.pointerId)) return
    fromPointer(e)
  }

  // The first departure: today, if the hour is still to come.
  const { first, later } = firstDeparture(now, minute)
  const day = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(first)

  return (
    <div className="desk-brd__day">
      <div ref={boxRef} className="desk-brd__sky" onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
        {g && (
          <>
            <svg className="desk-brd__sky-map" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
              <line className="desk-brd__horizon" x1={r1(g.cx - g.rx - EDGE / 2)} y1={g.cy} x2={r1(g.cx + g.rx + EDGE / 2)} y2={g.cy} />
              <path className="desk-brd__arc" d={`M${r1(g.cx - g.rx)} ${g.cy}A${g.rx} ${g.ry} 0 0 1 ${r1(g.cx + g.rx)} ${g.cy}`} />
              <path className="desk-brd__arc desk-brd__arc--done" d={`M${r1(g.cx - g.rx)} ${g.cy}A${g.rx} ${g.ry} 0 0 1 ${g.at(minute).map(r1).join(' ')}`} />
              {Array.from({ length: 17 }, (_, i) => {
                const hour = 7 + i
                const major = hour % 3 === 0
                const [x1, y1] = g.at(hour * 60)
                const [x2, y2] = g.out(hour * 60, major ? 12 : 7)
                return <line key={hour} className={`desk-brd__sky-tick${major ? ' desk-brd__sky-tick--major' : ''}`} x1={r1(x1)} y1={r1(y1)} x2={r1(x2)} y2={r1(y2)} />
              })}
              {[9, 12, 15, 18, 21].map(hour => {
                const [x, y] = g.out(hour * 60, 26)
                // An hour's name a station would stand on is left to it.
                const under = DEPARTURES.some(id => {
                  const [sx, sy] = g.at(timeToMinutes(DEPART_TIMES[id]))
                  return Math.hypot(x - sx, y - sy) < RING + 14
                })
                return under ? null : <text key={hour} className="desk-brd__hour" x={r1(x)} y={r1(y)}>{String(hour).padStart(2, '0')}</text>
              })}
              <text className="desk-brd__hour" x={r1(g.cx - g.rx)} y={g.cy + 18}>06</text>
              <text className="desk-brd__hour" x={r1(g.cx + g.rx)} y={g.cy + 18}>24</text>
              <g className="desk-brd__sun" transform={`translate(${r1(g.cx - g.rx - EDGE / 2 - 18)} ${g.cy})`}>
                <path d="M-16 0A16 16 0 0 1 16 0Z" />
                {[-150, -120, -90, -60, -30].map(deg => {
                  const a = (deg * Math.PI) / 180
                  return <line key={deg} x1={r1(Math.cos(a) * 22)} y1={r1(Math.sin(a) * 22)} x2={r1(Math.cos(a) * 30)} y2={r1(Math.sin(a) * 30)} />
                })}
              </g>
              <path
                className="desk-brd__moon"
                transform={`translate(${r1(g.cx + g.rx + EDGE / 2 + 14)} ${g.cy - 18})`}
                d="M0 -14A14 14 0 0 0 0 14A18 18 0 0 1 0 -14Z"
              />
            </svg>
            {DEPARTURES.map((id, i) => {
              const [x, y] = g.at(timeToMinutes(DEPART_TIMES[id]))
              return (
                <button
                  key={id}
                  type="button"
                  className={`desk-brd__hour-stn desk-brd__hour-stn--${id}`}
                  // Plain numbers, placed by the sheet: the ring's centre.
                  style={{ '--x': r1(x), '--y': r1(y) }}
                  aria-pressed={bucket === id}
                  aria-keyshortcuts={String(i + 1)}
                  onClick={() => onChange(timeToMinutes(DEPART_TIMES[id]))}
                  data-hour={id}
                >
                  <span className="desk-brd__hour-ring" lang="ja" aria-hidden="true">{DEPART_JP[id]}</span>
                  <span className="desk-brd__hour-lab">
                    <span className="desk-brd__hour-name">
                      {t.destHour[id]}
                      <PickMark digit={i + 1} />
                    </span>
                    <span className="desk-brd__hour-time">{DEPART_TIMES[id]}</span>
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              className={`desk-brd__train${docked ? ' desk-brd__train--docked' : ''}`}
              role="slider"
              aria-label={t.brdDayAria}
              aria-valuemin={6}
              aria-valuemax={24}
              aria-valuenow={minute / 60}
              aria-valuetext={time}
              style={{ '--x': r1(g.at(minute)[0]), '--y': r1(g.at(minute)[1]) }}
              onKeyDown={e => stepHour(e, minute, onChange)}
            />
            <div className="desk-brd__sky-board" style={{ '--x': r1(g.cx), '--y': r1(g.cy), '--w': r1(g.board) }}>
              <span className="brd-board__cap">{t.brdYourTrain}</span>
              <Flaps time={time} />
              <span className="desk-brd__sky-when">
                <b>{`${later ? t.nudgeWhen.today : t.nudgeWhen.tomorrow}, ${day}`}</b>
                {` — ${t.brdThenDaily}`}
              </span>
            </div>
          </>
        )}
      </div>
      <p className="desk-brd__fine">
        <kbd className="desk-kbd">←</kbd>
        <kbd className="desk-kbd">→</kbd>
        {t.brdTimeFine}
      </p>
    </div>
  )
}
