import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useBoarding, endBoarding } from '../../stores/boarding'
import { useLang } from '../../LangContext'
import { sectionFor } from '../../config/stations'
import { playDoorChime } from '../../lib/audio'

// ── 扉 — the train door ────────────────────────────────────
// The bookend to the ticket gate. The gate is leaving the concourse
// for a platform; this is boarding, and it plays on the last choice of
// a selection screen — the one that turns it into a quiz.
//
// The doors are shut before you see them. They cover the menu you were
// reading, the choice is committed behind them, and they part onto the
// screen you actually asked for. That ordering is the whole trick: the
// panels are the reveal, so there is nothing else to wipe with.
//
// Same rules as the gate, for the same reason — this fires every time
// a session starts: one dial for the pace, skippable by any input, and
// not mounted at all under prefers-reduced-motion.
const SPEED = 1.4

const CHIME_MS  = 120 * SPEED   // ピンポーン, just before they move
const COMMIT_MS = 190 * SPEED   // swap the screen behind the shut doors
const OPEN_MS   = 250 * SPEED   // panels begin to part
const DONE_MS   = 780 * SPEED   // door leaves

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function DoorScene({ commit, color }) {
  const [phase, setPhase] = useState('shut')
  const timers = useRef([])
  const committed = useRef(false)
  const cb = useRef(commit)
  useEffect(() => { cb.current = commit }, [commit])

  useEffect(() => {
    // `commit` must run exactly once whichever path reaches it first —
    // the timeline, the skip, or the cleanup. Running setMode twice is
    // harmless today; a commit that shuffles a deck would not be, and
    // that is the kind of thing that only bites later.
    const commitOnce = () => {
      if (committed.current) return
      committed.current = true
      cb.current?.()
    }

    if (prefersReducedMotion()) {
      commitOnce()
      endBoarding()
      return
    }

    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    at(CHIME_MS, playDoorChime)
    at(COMMIT_MS, commitOnce)
    at(OPEN_MS, () => setPhase('open'))
    at(DONE_MS, () => { commitOnce(); endBoarding() })

    const skip = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      commitOnce()
      endBoarding()
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
      // Unmounted before the timeline finished — a route change, say.
      // The choice must still take effect, or the tap did nothing.
      commitOnce()
    }
  }, [])

  if (prefersReducedMotion()) return null

  const style = { '--door-x': SPEED, ...(color ? { '--line-color': color } : {}) }

  return createPortal(
    <div className={`door door--${phase}`} style={style} aria-hidden="true">
      {/* Two leaves meeting on the seam. The windows are cut out
          rather than painted, so the screen behind shows through them
          — you can see where you are going before the doors move,
          which is what a train door actually does. */}
      <div className="door__leaf door__leaf--l">
        <span className="door__glass" />
        <span className="door__belt" />
      </div>
      <div className="door__leaf door__leaf--r">
        <span className="door__glass" />
        <span className="door__belt" />
      </div>
      <span className="door__seam" />
    </div>,
    document.body,
  )
}

// The store-reading shell. Keyed on the boarding id so a second
// selection mounts a fresh scene rather than reusing one whose
// animations have already run — which is also what keeps DoorScene's
// timeline effect a plain mount effect, with no state to reset.
//
// The livery colour is read from the route rather than passed in by
// every screen. It has to be resolved *here*: the door is portaled to
// document.body, so it inherits nothing from the selection screen that
// opened it, and left to the CSS fallback every line's train was
// painted --accent — which happens to be right for 仮名 and wrong for
// the other ten.
export function TrainDoor() {
  const boarding = useBoarding()
  const { pathname } = useLocation()
  const { t } = useLang()
  if (!boarding) return null

  const color = boarding.color ?? sectionFor(pathname, t)?.color
  return <DoorScene key={boarding.id} commit={boarding.commit} color={color} />
}
