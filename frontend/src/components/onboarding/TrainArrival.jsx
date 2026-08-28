import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playPlatformChime } from '../../lib/audio'

// ── 到着 — arriving at the network ─────────────────────────────
// The third cutscene in the station family, and the first that means
// "you have arrived" rather than "you are leaving" (改札 TicketGate)
// or "you are boarding" (扉 TrainDoor). Plays exactly once, over the
// onboarding tour's first entry (see OnboardingFlow's advance()):
// the scrim drops, the platform signboard slides down into place with
// the destination on it, the chime lands, and the whole thing steps
// aside — the tour is mounted and interactive underneath from frame
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
// OnboardingFlow never unmounts between steps. The precedent is
// App.jsx's own direct <TicketGate/> render for the finale.

const SPEED = 1.4
const SIGN_MS = 260 * SPEED   // the signboard lands; the chime with it
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
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  if (prefersReducedMotion()) return null

  return createPortal(
    <div className={`arrival arrival--${phase}`} style={{ '--arrival-x': SPEED }} aria-hidden="true">
      <div className="arrival__scrim" />
      <div className="arrival__board">
        <span className="arrival__eyebrow" lang="ja">ただいま到着</span>
        <span className="arrival__dest" lang="ja">{jp}</span>
        <span className="arrival__latin">{title}</span>
      </div>
    </div>,
    document.body,
  )
}
