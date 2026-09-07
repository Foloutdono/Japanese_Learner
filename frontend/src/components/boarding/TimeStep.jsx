import { useRef } from 'react'
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

function Flaps({ time }) {
  const [h1, h2, , m1, m2] = time.split('')
  // Keyed on the time so the last tile remounts, and flips once, per change.
  return (
    <div className="brd-board__flaps" aria-label={time}>
      <span className="brd-flap">{h1}</span>
      <span className="brd-flap">{h2}</span>
      <span className="brd-board__colon" aria-hidden="true">:</span>
      <span className="brd-flap">{m1}</span>
      <span key={time} className="brd-flap brd-flap--turn">{m2}</span>
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
