import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProfileSummary } from '../../stores/profileSummary'
import { useCredits } from '../../stores/credits'
import { cardTier, xpClimb } from '../../domain/passCard'
import { CardFace } from '../pass/PassCard'
import { PassWave } from '../profile/PassWave'
import { playGateChime } from '../../lib/audio'
import { spendKey } from '../../lib/keyGuards'

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
// clip could not show *your* card — the name and the level — nor take
// the destination's own line colour, of which there are eleven. Every frame here is a transform on an element that
// already knows both.
//
// The budget is severe because this fires on every departure, dozens
// of times a session: 980ms end to end, skippable by any input, and
// skipped outright under prefers-reduced-motion. The last of it is the
// arrival the owner asked for: the open gate grows into view with the
// line's light until its lane is the screen, the destination's name
// growing with it to fill the screen, and the two hold there a beat
// before they fade off the destination. Navigation happens in that
// hold, so the destination is mounted and running its own arrive
// animation by the time the gate fades off it.
// One dial for the whole cutscene. The CSS reads it as --gate-x and
// multiplies every duration and delay by it, so the timers here and
// the animations there cannot drift apart — raise this and the card,
// the flaps, the push and the navigation all stretch together.
const SPEED = 1.4

const CONTACT_MS  = 300 * SPEED   // card meets the reader; chime, lamp turns
const COVERED_MS  = 660 * SPEED   // the lane's light has the screen; the hold
const NAVIGATE_MS = 700 * SPEED   // in the hold — swap the screen behind it
const LEAVE_MS    = 840 * SPEED   // the light starts off the destination
const DONE_MS     = 980 * SPEED   // gate leaves

// How far the view travels: the scale at which the lane, grown about
// its centre (the rig's, between two equal cabinets), covers the whole
// scene. Measured rather than written down, because it is a ratio of
// two boxes — the lane is 260px of a 390px phone, 470px of a 1180px
// desk canvas — and CSS cannot divide one length by another. A hair
// over, so no edge of the scene is left on a rounding.
function pushThrough(scene, lane) {
  if (!lane.clientWidth || !lane.clientHeight) return null
  return 1.03 * Math.max(scene.clientWidth / lane.clientWidth, scene.clientHeight / lane.clientHeight)
}

// The name's way out of the lane: where it stands in the scene, and
// the size at which it takes the screen — most of its width, or two
// thirds of its height where the screen is wide and a two-character
// name would otherwise run off its top and foot. Layout offsets, not the painted box: the rig is still
// rising on its arrive transform when this runs.
function titleFit(scene, name) {
  let x = 0
  let y = 0
  for (let el = name; el && el !== scene; el = el.offsetParent) {
    x += el.offsetLeft
    y += el.offsetTop
  }
  const { offsetWidth: w, offsetHeight: h } = name
  if (!w || !h) return null
  return {
    k: Math.min(0.84 * scene.clientWidth / w, 0.66 * scene.clientHeight / h),
    dx: x + w / 2 - scene.clientWidth / 2,
    dy: y + h / 2 - scene.clientHeight / 2,
  }
}

// The name's ink on the line's light, chosen by the light's lightness
// (DESIGN.md: "the ink is chosen by the fill's lightness"): the panel's
// kinari, as it stood in the lane, unless the pigment is too light to
// carry it at display size, where the floor is 3:1 — and then the
// fill's dark ink. Measured, that is 山吹 gold alone, Today's line and
// the dictionary's, at 2.19:1 in the dark theme; the next lightest,
// 黄丹 safflower, carries kinari at 3.18:1.
function luminance(rgb) {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map(v => {
    const c = Number(v) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function inkFor(light, kinari) {
  const [a, b] = [luminance(light), luminance(kinari)].sort((m, n) => n - m)
  return (a + 0.05) / (b + 0.05) < 3 ? 'fill' : 'panel'
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * `section` is the board row being departed for — it carries the line
 * colour and the name, and `stage` when the destination is a run, drawn
 * without the chrome (the desk's rail then leaves with the scene). `station` is its config/stations entry, for the
 * code on the roundel beyond the flaps. `onNavigate` is called once,
 * while the line's light has the screen; `onDone` when the gate should
 * unmount.
 */
export function TicketGate({ section, station, onNavigate, onDone }) {
  const summary = useProfileSummary()
  const credits = useCredits()
  const [phase, setPhase] = useState('closed')
  const timers = useRef([])
  const scene = useRef(null)
  const lane = useRef(null)
  const name = useRef(null)
  // The light's colour, for the one strip of the window the scene
  // cannot paint (below): the line's as the gate mounted, which is all
  // it will ever be — DepartureGate keys a new gate per departure. The
  // onboarding's finale has no line, and washes in the accent.
  const wash = useRef(section.color ?? 'var(--accent)')
  // The callbacks are new objects on every render, so the timeline
  // effect below cannot depend on them without restarting the whole
  // cutscene each time the parent re-renders. Held in a ref, kept
  // current by its own effect — writing it during render is what
  // react-hooks/refs forbids, and rightly.
  const cbs = useRef({ onNavigate, onDone })
  useEffect(() => { cbs.current = { onNavigate, onDone } }, [onNavigate, onDone])

  // Before the first paint, so neither the push nor the name's growth
  // ever starts from a guess.
  useLayoutEffect(() => {
    const el = scene.current
    if (!el || !lane.current || !name.current) return
    const push = pushThrough(el, lane.current)
    if (push) el.style.setProperty('--gate-push', push.toFixed(3))
    const fit = titleFit(el, name.current)
    if (fit) {
      el.style.setProperty('--gate-title-k', fit.k.toFixed(3))
      el.style.setProperty('--gate-title-dx', `${fit.dx.toFixed(1)}px`)
      el.style.setProperty('--gate-title-dy', `${fit.dy.toFixed(1)}px`)
    }
    // Against the kinari the name wears in the lane, which is what it
    // would keep.
    const light = getComputedStyle(lane.current.querySelector('.gate__wipe')).backgroundColor
    el.dataset.ink = inkFor(light, getComputedStyle(name.current.firstChild).color)
  }, [])

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

    // The window's scrollbar gutter (index.css reserves one) is outside
    // every fixed box, so the light could never reach it: a desk with
    // classic scrollbars saw the line's colour stop a strip short of
    // the window's edge through the whole hold. The gutter is painted in
    // the page's own ground, so the ground takes the light the moment
    // the lane has the screen — at once, not on html's own transition,
    // which would colour the strip before the light got there — and
    // gives it back as the scene fades, on that transition, in step
    // with the fade. Everywhere else that ground is under body.
    const ground = document.documentElement.style
    const unwash = () => {
      ground.removeProperty('transition')
      ground.removeProperty('--gate-ground')
    }

    at(CONTACT_MS, () => { playGateChime(); setPhase('open') })
    at(COVERED_MS, () => {
      ground.setProperty('transition', 'none')
      ground.setProperty('--gate-ground', wash.current)
    })
    at(NAVIGATE_MS, () => cbs.current.onNavigate())
    at(LEAVE_MS, unwash)
    at(DONE_MS, () => cbs.current.onDone())

    // Any input cuts to the end. A cutscene you cannot skip is a
    // toll booth by the fortieth time through it.
    const skip = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      unwash()
      cbs.current.onNavigate()
      cbs.current.onDone()
    }
    // A key is spent on the scene it skips (lib/keyGuards, plan 123).
    const skipKey = e => { spendKey(e); skip() }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skipKey, true)

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      unwash()
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skipKey, true)
    }
  }, [])

  if (prefersReducedMotion()) return null

  // The learner's own card (plan 172), face up: their material, the
  // name, the level under it and the road of its struck 辻 filled to the
  // climb -- the face every other screen draws.
  const holder = summary?.username ?? '—'
  const level = summary?.level ?? null
  const { share } = xpClimb(summary)
  const tier = cardTier(credits)

  return createPortal(
    <div
      ref={scene}
      className={`gate gate--${phase}${section.stage ? ' gate--stage' : ''}`}
      style={{ '--line-color': section.color, '--gate-x': SPEED }}
      aria-hidden="true"
    >
      <div className="gate__scrim" />

      <div className="gate__rig">
        <div className="gate__pillar gate__pillar--left">
          <span className="gate__lamp" />
        </div>

        {/* The lane: what is beyond the gate, the flaps over it, and
            the light it floods with as the gate grows into view. */}
        <div className="gate__lane" ref={lane}>
          <span className="gate__beyond">
            {station?.code && <span className="gate__roundel">{station.code}</span>}
            <span className="gate__name" ref={name}>
              <span className="gate__dest" lang="ja">{section.icon}</span>
              <span className="gate__dest-latin">{section.title}</span>
            </span>
          </span>
          <span className="gate__flap gate__flap--l" />
          <span className="gate__flap gate__flap--r" />
          <span className="gate__wipe" />
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
      </div>

      {/* The card, flying in to meet the reader: the learner's own.
          Beside the rig rather than in it, where it stands at the same
          place: it is in the learner's hand, not part of the gate, so
          it does not grow with the gate as the gate grows into view. */}
      <div className="gate__card">
        <CardFace tier={tier} name={holder} level={level ?? ''} share={share} />
      </div>

      {/* The destination's name, handed out of the lane as the gate
          grows: laid out at the size it takes the screen at, and shrunk
          to the lane's until then, so it is sharp when it holds. */}
      <div className="gate__title">
        <span className="gate__title-move">
          <span className="gate__title-body">
            <span className="gate__dest" lang="ja">{section.icon}</span>
            <span className="gate__dest-latin">{section.title}</span>
          </span>
        </span>
      </div>
    </div>,
    document.body,
  )
}
