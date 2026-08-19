import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useExpress, endExpress } from '../../stores/express'
import { playExpressPass } from '../../lib/audio'

// ── 特急 — the limited express ─────────────────────────────
// The station's third transition, and the one the daily queue gets.
//
// The other two are ceremonies of permission. 改札 taps your pass and
// retracts the flaps; 扉 shuts the doors over the menu, commits the
// choice behind them, and parts onto the quiz. Both take their time
// because both mark a decision — which destination, which drill.
//
// The queue makes neither decision. Its entire claim is that it skips
// them: no level, no mode, no menu, just the thing that is due. Dressing
// that in a gate would be saying the opposite of what the screen does.
//
// So: the limited express, the train that takes a platform at line
// speed and does not stop. It is the fastest thing on the network and
// it is what a fast pass actually looks like here — you do not walk
// through anything, something goes past and you are already there.
//
// Deliberately quicker than both its siblings (520ms against 780) for
// the same reason. A "fast" transition that takes longer than the
// careful ones is a joke at its own expense.
const SPEED = 1.0

const PASS_MS   = 90 * SPEED   // the nose arrives; whoosh
const COMMIT_MS = 300 * SPEED  // the rake is across the screen — swap behind it
const CLEAR_MS  = 380 * SPEED  // tail leaves, the veil starts lifting
const DONE_MS   = 520 * SPEED

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// Enough cars to cross the widest viewport without the rake visibly
// ending mid-pass. They are identical on purpose — a passing express is
// a strobe of the same window over and over, which is exactly why it
// reads as speed rather than as a vehicle.
const CARS = 7

function ExpressScene({ commit }) {
  const [phase, setPhase] = useState('waiting')
  const timers = useRef([])
  const committed = useRef(false)
  const cb = useRef(commit)
  useEffect(() => { cb.current = commit }, [commit])

  useEffect(() => {
    // `commit` runs exactly once whichever path reaches it first — the
    // timeline, the skip, or the cleanup. Same guarantee the door
    // makes, and for the same reason: starting the session twice is
    // harmless today and would not stay harmless.
    const commitOnce = () => {
      if (committed.current) return
      committed.current = true
      cb.current?.()
    }

    if (prefersReducedMotion()) {
      commitOnce()
      endExpress()
      return
    }

    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    at(0, () => setPhase('passing'))
    at(PASS_MS, playExpressPass)
    at(COMMIT_MS, commitOnce)
    at(CLEAR_MS, () => setPhase('clear'))
    at(DONE_MS, () => { commitOnce(); endExpress() })

    const skip = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      commitOnce()
      endExpress()
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
      // Unmounted before the timeline finished — the session must still
      // start, or the press did nothing.
      commitOnce()
    }
  }, [])

  if (prefersReducedMotion()) return null

  return createPortal(
    <div className={`express express--${phase}`} style={{ '--express-x': SPEED }} aria-hidden="true">
      {/* The headlight reaching the platform before the train does. */}
      <span className="express__glare" />

      <div className="express__rake">
        {/* 特急 on the nose. The only type in the whole cutscene, and
            it is legible for about two frames — which is the correct
            amount of time to read a headboard off a passing express. */}
        <span className="express__nose">
          <span className="express__headboard" lang="ja">特急</span>
        </span>

        {Array.from({ length: CARS }, (_, i) => (
          <span key={i} className="express__car">
            <span className="express__window" />
            <span className="express__window" />
            <span className="express__belt" />
          </span>
        ))}
      </div>

      {/* Draught lines pulled along behind it, which is what sells the
          speed — the rake alone reads as a panel sliding. */}
      <span className="express__draught" />
    </div>,
    document.body,
  )
}

// The store-reading shell, keyed on the run id so a second press mounts
// a fresh scene rather than reusing one whose animations have already
// played — the same thing that lets the timeline above be a plain mount
// effect with no state to reset.
export function ExpressPass() {
  const express = useExpress()
  if (!express) return null
  return <ExpressScene key={express.id} commit={express.commit} />
}
