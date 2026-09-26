import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useBoarding, endBoarding } from '../../stores/boarding'
import { useLang } from '../../LangContext'
import { sectionFor, stationFor } from '../../config/stations'
import { playDoorChime, playDoorSlide } from '../../lib/audio'
import { spendKey } from '../../lib/keyGuards'

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
//
// Unlock and part (plan 144, the owner's pick A of three drawn beside
// the shipped door on the canvas "Tsuji — gate & door cutscenes"). The
// door fades in over the menu rather than landing on it in one frame,
// while the view settles onto it. The lamp over the seam lights with
// the chime; the leaves crack a few pixels apart, the destination
// showing through the slit, and only then slide. They finish their
// travel before anything else leaves — the shipped door faded out with
// its leaves 85% open — and the frame goes last, the header up and the
// sill down, so nothing fades over the run. Every figure here is the
// one that plays; the base figures were 1.4× slower before.
const SPEED = 1

const COMMIT_MS = 200 * SPEED   // swap the screen behind the shut doors
const CHIME_MS  = 260 * SPEED   // ピンポーン, and the lamp over the seam lights
const OPEN_MS   = 300 * SPEED   // the leaves unlock, then part
const DONE_MS   = 920 * SPEED   // the frame has left; door leaves

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function DoorScene({ commit, color, code }) {
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

    // The leaves, the lamp and the frame run on their own CSS delays
    // (the 扉 block of index.css, every one scaled by --door-x), so the
    // timers here only carry what CSS cannot: the sounds, the commit
    // and the unmount.
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    at(COMMIT_MS, commitOnce)
    at(CHIME_MS, playDoorChime)
    // Under the leaves for the whole of their travel — the chime only
    // announces the move, and the move itself was silent.
    at(OPEN_MS, playDoorSlide)
    at(DONE_MS, () => { commitOnce(); endBoarding() })

    const skip = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      commitOnce()
      endBoarding()
    }
    // A key is spent on the scene it skips (lib/keyGuards, plan 123).
    const skipKey = e => { spendKey(e); skip() }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skipKey, true)

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skipKey, true)
      // Unmounted before the timeline finished — a route change, say.
      // The choice must still take effect, or the tap did nothing.
      commitOnce()
    }
  }, [])

  if (prefersReducedMotion()) return null

  const style = { '--door-x': SPEED, ...(color ? { '--line-color': color } : {}) }

  return createPortal(
    <div className="door" style={style} aria-hidden="true">
      {/* Two leaves meeting on the seam — which each leaf carries half
          of, so it travels with them. The windows are cut out
          rather than painted, so the screen behind shows through them
          — you can see where you are going before the doors move,
          which is what a train door actually does. */}
      {['l', 'r'].map(side => (
        <div key={side} className={`door__leaf door__leaf--${side}`}>
          <span className="door__glass">
            {/* Light running across the glass as the leaf moves. */}
            <span className="door__sheen" />
          </span>
          <span className="door__belt" />
          {/* 号車 — the car plate. Small, and the only type on the
              door, so it does the work a whole destination board
              would have done, far more quietly. */}
          {code && <span className="door__plate">{code}</span>}
        </div>
      ))}
      {/* The header the leaves hang from, and the lamp over the seam
          that blinks while they move. An element rather than the
          doorway's ::before, because the lamp rides it out. */}
      <span className="door__head"><span className="door__lamp" /></span>
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

  const section = sectionFor(pathname, t)
  const color = boarding.color ?? section?.color
  const station = section ? stationFor(section.path) : null
  const code = station && station.code !== '??' ? station.code : null

  return (
    <DoorScene
      key={boarding.id}
      commit={boarding.commit}
      color={color}
      code={code}
    />
  )
}
