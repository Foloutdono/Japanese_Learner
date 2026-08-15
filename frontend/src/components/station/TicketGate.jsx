import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProfileSummary } from '../../stores/profileSummary'
import { PassWave } from '../profile/PassWave'
import { playGateChime } from '../../lib/audio'

// ── 改札 — the ticket gate ─────────────────────────────────
// The moment between choosing a destination and arriving at it. You
// tap your 定期券 on the reader, the lamp turns, the flaps retract,
// and you walk through onto the platform.
//
// It exists because the audio for it was already here and had nothing
// to look at: HomeScreen has always played a jingle and the spoken
// station name on departure, then navigated on the same frame, so
// two and a half seconds of announcement played over the *next*
// screen with nothing connecting it to the tap that caused it.
//
// Drawn rather than filmed, and that is the whole point. A recorded
// clip could not show *your* card — the name, the level, and the
// seven storehouse slots that exist precisely so no two passes look
// alike — nor take the destination's own line colour, of which there
// are eleven. Every frame here is a transform on an element that
// already knows both.
//
// The budget is severe because this fires on every departure, dozens
// of times a session: 780ms end to end, skippable by any input, and
// skipped outright under prefers-reduced-motion. Navigation happens
// at 600ms, while the wipe is opaque, so the destination is already
// mounted and running its own arrive animation by the time the gate
// fades off it.
// One dial for the whole cutscene. The CSS reads it as --gate-x and
// multiplies every duration and delay by it, so the timers here and
// the animations there cannot drift apart — raise this and the card,
// the flaps, the wipe and the navigation all stretch together.
const SPEED = 1.4

const CONTACT_MS  = 300 * SPEED   // card meets the reader; chime, lamp turns
const NAVIGATE_MS = 600 * SPEED   // wipe is opaque — swap the screen behind it
const DONE_MS     = 780 * SPEED   // gate leaves

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * `section` is the board row being departed for — it carries the line
 * colour and the name. `station` is its config/stations entry, for the
 * code on the roundel beyond the flaps. `onNavigate` is called once,
 * mid-wipe; `onDone` when the gate should unmount.
 */
export function TicketGate({ section, station, onNavigate, onDone }) {
  const summary = useProfileSummary()
  const [phase, setPhase] = useState('closed')
  const timers = useRef([])
  // The callbacks are new objects on every render, so the timeline
  // effect below cannot depend on them without restarting the whole
  // cutscene each time the parent re-renders. Held in a ref, kept
  // current by its own effect — writing it during render is what
  // react-hooks/refs forbids, and rightly.
  const cbs = useRef({ onNavigate, onDone })
  useEffect(() => { cbs.current = { onNavigate, onDone } }, [onNavigate, onDone])

  useEffect(() => {
    const reduced = prefersReducedMotion()

    // Nothing to watch, so do not hold the navigation hostage to an
    // animation that is not going to play.
    if (reduced) {
      cbs.current.onNavigate()
      cbs.current.onDone()
      return
    }

    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))

    at(CONTACT_MS, () => { playGateChime(); setPhase('open') })
    at(NAVIGATE_MS, () => cbs.current.onNavigate())
    at(DONE_MS, () => cbs.current.onDone())

    // Any input cuts to the end. A cutscene you cannot skip is a
    // toll booth by the fortieth time through it.
    const skip = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      cbs.current.onNavigate()
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

  const holder = summary?.username ?? '—'
  const level = summary?.level

  return createPortal(
    <div
      className={`gate gate--${phase}`}
      style={{ '--line-color': section.color, '--gate-x': SPEED }}
      aria-hidden="true"
    >
      <div className="gate__scrim" />

      <div className="gate__rig">
        <div className="gate__pillar gate__pillar--left">
          <span className="gate__lamp" />
        </div>

        {/* The lane: what is beyond the gate, and the flaps over it. */}
        <div className="gate__lane">
          <span className="gate__beyond">
            {station?.code && <span className="gate__roundel">{station.code}</span>}
            <span className="gate__dest" lang="ja">{section.icon}</span>
            <span className="gate__dest-latin">{section.title}</span>
          </span>
          <span className="gate__flap gate__flap--l" />
          <span className="gate__flap gate__flap--r" />
        </div>

        <div className="gate__pillar gate__pillar--right">
          {/* The reader. The contactless mark is the same component
              the pass and the top bar draw, so the thing tapping and
              the thing being tapped are visibly the same object. */}
          <span className="gate__reader">
            <PassWave className="pass__wave gate__wave" />
          </span>
          <span className="gate__lamp" />
        </div>

        {/* The pass, flying in to meet the reader. */}
        <div className="gate__card">
          <span className="gate__card-brand" lang="ja">定期券</span>
          <span className="gate__card-name">{holder}</span>
          {level != null && <span className="gate__card-level">{level}</span>}
        </div>
      </div>

      <div className="gate__wipe" />
    </div>,
    document.body,
  )
}
