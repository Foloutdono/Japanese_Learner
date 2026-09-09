import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { DEPARTURES, DEPART_TIMES } from '../onboarding/departures'
import {
  DAY_STEP_MIN, DAY_START_MIN, LAST_DEPARTURE_MIN,
  bucketFor, clampDeparture, dayFraction, minuteAtFraction, minutesToTime, timeToMinutes,
} from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'

// ── 7 · the hour (plan 075) ──────────────────────────────────────
// The departure board prints the hour on split flaps; the three cells
// are the announced rides (morning, noon, evening -- the same clock
// Settings › Destination keeps); the day track under them is the fine
// control, a train on a rail from six to midnight in half hours, with
// a slider role so it works from a keyboard. Picking a cell moves the
// train to its hour; dragging the train lights the cell whose part of
// the day it sits in. The board flips its last digit once per change.

const TICKS = [
  { label: '06', at: 0, mod: 'first' },
  { label: '12', at: 1 / 3 },
  { label: '18', at: 2 / 3 },
  { label: '24', at: 1, mod: 'last' },
]

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

export default function TimeStep({ minute, onChange, onContinue }) {
  const { t } = useLang()
  const railRef = useRef(null)
  const time = minutesToTime(minute)
  const pct = dayFraction(minute) * 100
  const bucket = bucketFor(minute)

  function fromPointer(e) {
    const rect = railRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    onChange(minuteAtFraction((e.clientX - rect.left) / rect.width))
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    fromPointer(e)
  }

  function onPointerMove(e) {
    if (e.buttons === 0) return
    fromPointer(e)
  }

  function onKeyDown(e) {
    const moves = {
      ArrowLeft: -DAY_STEP_MIN, ArrowDown: -DAY_STEP_MIN,
      ArrowRight: DAY_STEP_MIN, ArrowUp: DAY_STEP_MIN,
      PageDown: -120, PageUp: 120,
    }
    if (e.key in moves) { e.preventDefault(); onChange(clampDeparture(minute + moves[e.key])); return }
    if (e.key === 'Home') { e.preventDefault(); onChange(DAY_START_MIN) }
    if (e.key === 'End') { e.preventDefault(); onChange(LAST_DEPARTURE_MIN) }
  }

  return (
    <>
      <div className="brd__body">
        <BoardQuestion>{t.brdTimeQ}</BoardQuestion>
        <div className="brd__stage">
          <div className="brd-board">
            <span className="brd-board__cap">{t.brdDeparture}</span>
            <Flaps time={time} />
          </div>
          <div className="brd-grid brd-grid--3" role="group" aria-label={t.brdDeparture}>
            {DEPARTURES.map(id => (
              <button
                key={id}
                type="button"
                className={`brd-cell brd-cell--sm${bucket === id ? ' brd-cell--on' : ''}`}
                aria-pressed={bucket === id}
                onClick={() => onChange(timeToMinutes(DEPART_TIMES[id]))}
                data-hour={id}
              >
                <span className="brd-cell__label">{t.destHour[id]}</span>
                <span className="brd-cell__time">{DEPART_TIMES[id]}</span>
              </button>
            ))}
          </div>
          <div
            className="brd-day"
            ref={railRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
          >
            <div className="brd-day__rail" />
            <div className="brd-day__done" style={{ width: `${pct}%` }} />
            {TICKS.map(tick => (
              <span
                key={tick.label}
                className={`brd-day__tick${tick.mod ? ` brd-day__tick--${tick.mod}` : ''}`}
                style={{ left: `${tick.at * 100}%` }}
                aria-hidden="true"
              >
                {tick.label}
              </span>
            ))}
            <button
              type="button"
              className="brd-day__train"
              role="slider"
              aria-label={t.brdDayAria}
              aria-valuemin={6}
              aria-valuemax={24}
              aria-valuenow={minute / 60}
              aria-valuetext={time}
              style={{ left: `${pct}%` }}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} data-action="continue" />
      </div>
    </>
  )
}
