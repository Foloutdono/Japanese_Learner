import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { BoardQuestion } from './BoardFrame'
import { CheckMark } from './icons'

// ── Building the journey (plan 075) ──────────────────────────────
// The first arrival screen: no track, no back. The train drives the
// build track to the stop being built and the passed stops tick --
// the goal, the lines, the daily ride, the projection -- then the plan
// arrives. A wait the learner can see the end of; any tap cuts to it.
// Under reduced motion the rest state (everything ticked) is drawn
// and the plan follows after a beat.
const TICK_MS = 600
const REST_MS = 400

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export default function Building({ name, steps, onDone }) {
  const { t } = useLang()
  const reduced = prefersReducedMotion()
  const [done, setDone] = useState(reduced ? steps.length : 0)
  const timers = useRef([])
  const cbs = useRef({ onDone })
  useEffect(() => { cbs.current = { onDone } }, [onDone])

  useEffect(() => {
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    if (reduced) {
      at(REST_MS, () => cbs.current.onDone())
    } else {
      steps.forEach((_, i) => at(TICK_MS * (i + 1), () => setDone(i + 1)))
      at(TICK_MS * (steps.length + 1), () => cbs.current.onDone())
    }
    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
    // The timeline runs once per mount; the steps are the answers,
    // which cannot change while it plays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function skip() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setDone(steps.length)
    cbs.current.onDone()
  }

  const pct = Math.round((done / steps.length) * 100)
  return (
    <div className="brd__body brd__body--center" onClick={skip}>
      <div className="brd__stage">
        <BoardQuestion>
          <Emphasized text={t.brdBuildingQ(name)} strongClassName="brd__q-em" />
        </BoardQuestion>
        <div
          className="brd-build__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          aria-label={t.brdBuildingAria}
        >
          <div className="brd-build__done" style={{ width: `${pct}%` }} />
          <span className="brd-build__train" style={{ left: `${pct}%` }} />
        </div>
        <div className="brd-steps">
          {steps.map((step, i) => {
            const state = i < done ? 'done' : i === done ? 'now' : 'next'
            return (
              <div key={step.key} className={`brd-step brd-step--${state}`} data-build={step.key}>
                <span className="brd-step__mark">{state === 'done' && <CheckMark />}</span>
                <span className="brd-step__label">{step.label}</span>
                {(state === 'done' || step.always) && step.value && (
                  <span className="brd-step__val">{step.value}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
