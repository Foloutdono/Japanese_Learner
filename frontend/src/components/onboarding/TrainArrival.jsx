import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playPlatformChime } from '../../lib/audio'
import { spendKey } from '../../lib/keyGuards'

// ── 到着 — arriving at the network ─────────────────────────────
// The third cutscene in the station family, and the first that means
// "you have arrived" rather than "you are leaving" (改札 TicketGate)
// or "you are boarding" (扉 TrainDoor). Plays exactly once, over the
// boarding's plan as it arrives (screens/BoardingFlow.jsx, plan 075):
// the scrim drops, the platform signboard slides down into place with
// the destination on it, the chime lands, and the whole thing steps
// aside — the plan is mounted and interactive underneath from frame
// one, so nothing is ever gated behind the animation finishing.
//
// Same discipline as its two siblings, deliberately: one SPEED dial
// shared between JS timers and CSS via a custom property so the two
// cannot drift; callbacks held in a ref so the single-run timeline
// effect never restarts on a parent re-render; skippable by any
// input; and absent — not merely still — under reduced motion, with
// the CSS display:none guard as belt and braces.
//
// No store and no shell, unlike gate/door: those exist because their
// cutscenes must outlive the screen that triggered them, and
// BoardingFlow never unmounts between steps. The precedent is
// App.jsx's own direct <TicketGate/> render for the finale.

const SPEED = 1.4
const SIGN_MS = 260 * SPEED   // the signboard lands; the chime with it
// When the chime lands, for the boarding to ring it at the same beat
// where the scene is not drawn (reduced motion): a sound is not motion.
export const ARRIVAL_CHIME_MS = SIGN_MS
const DONE_MS = 780 * SPEED   // the overlay leaves; onDone fires

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function TrainArrival({ jp, title, onDone }) {
  const [phase, setPhase] = useState('arriving')
  const timers = useRef([])
  // Kept current by its own effect so the timeline below can run once
  // ([] deps) without restarting the cutscene when the parent renders.
  const cbs = useRef({ onDone })
  useEffect(() => { cbs.current = { onDone } }, [onDone])

  useEffect(() => {
    // Nothing to watch, so do not make the tour wait on an animation
    // that is not going to play.
    if (prefersReducedMotion()) {
      cbs.current.onDone()
      return
    }

    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    at(SIGN_MS, () => { playPlatformChime(); setPhase('arrived') })
    at(DONE_MS, () => cbs.current.onDone())

    // Any input cuts to the end — a cutscene you cannot skip is a
    // toll booth (TicketGate's own words, same rule here).
    const skip = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      cbs.current.onDone()
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
    }
  }, [])

  if (prefersReducedMotion()) return null

  return createPortal(
    <div className={`onb-arrival onb-arrival--${phase}`} style={{ '--onb-arrival-x': SPEED }} aria-hidden="true">
      <div className="onb-arrival__scrim" />
      <div className="onb-arrival__board">
        <span className="onb-arrival__dest" lang="ja">{jp}</span>
        <span className="onb-arrival__latin">{title}</span>
      </div>
    </div>,
    document.body,
  )
}
