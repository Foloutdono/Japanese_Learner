import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useProfileSummary } from '../../stores/profileSummary'
import { useCredits } from '../../stores/credits'
import { cardTier, holderName, xpClimb } from '../../domain/passCard'
import { CardFace } from '../pass/PassCard'
import { playGateChime } from '../../lib/audio'
import { spendKey } from '../../lib/keyGuards'

// ── 改札 — the ticket gate ─────────────────────────────────
// The moment between choosing a destination and arriving at it. You
// tap your 定期券 on the reader, the reader lights, the flaps snap
// into the cabinets, and the cabinets part onto the platform.
//
// It exists because the audio for it was already here and had nothing
// to look at: HomeScreen has always played a jingle and the spoken
// station name on departure, then navigated on the same frame, so
// two and a half seconds of announcement played over the *next*
// screen with nothing connecting it to the tap that caused it.
//
// Drawn rather than filmed, and that is the whole point. A recorded
// clip could not show *your* card — the name and the level — nor take
// the destination's own line colour, of which there are eleven. Every
// frame here is a transform on an element that already knows both.
//
// The budget is severe because this fires on every departure, dozens
// of times a session: 980ms end to end, skippable by any input, and
// skipped outright under prefers-reduced-motion.
//
// Drawn as a game asset since plan 249 (the owner's pick B of three
// drawn on the canvas "Tsuji — the ticket gate, redrawn", and "improve
// it one more time"): flat fills, one ink outline, no blurred shadow.
// The gate stands up close, its two cabinets the screen's two halves
// like the door's leaves, the line's light beyond them, a flat fill. The pass
// taps the reader, the flaps snap into the cabinets, and the cabinets
// part on the door's own keyframes onto the line's light, the name
// growing out of the hall to hold on it before the scene fades off the
// destination. The gate it replaces grew a box of blurred shadows to
// four times its size on the main thread, repainting it every frame:
// that was the lag. Nothing here scales but the name (laid out at the
// size it lands at) and the light (a flat fill): everything else is a
// translation of a layer drawn once, as the door is.
//
// One dial for the whole cutscene. The CSS reads it as --gate-x and
// multiplies every duration and delay by it, so the timers here and
// the animations there cannot drift apart — raise this and the card,
// the flaps, the cabinets and the navigation all stretch together.
const SPEED = 1.4

const CONTACT_MS  = 300 * SPEED   // card meets the reader; chime, the reader lights
const COVERED_MS  = 660 * SPEED   // the cabinets are off the screen; the hold
const NAVIGATE_MS = 700 * SPEED   // in the hold — swap the screen behind it
const LEAVE_MS    = 840 * SPEED   // the light starts off the destination
const DONE_MS     = 980 * SPEED   // gate leaves

// The name's way out of the hall: where it stands before the cabinets
// part (midway between the sign and the cabinets' tops), the size it
// stands at there, and the size at which it takes the screen — most of
// its width, or two thirds of its height where the screen is wide and a
// two-character name would otherwise run off its top and foot. Read off
// the name laid out at its own size (zoom 1, the CSS's default), before
// anything is written.
function titleFit(scene, sign, cab, body) {
  const { offsetWidth: w, offsetHeight: h } = body
  if (!w || !h) return null
  const { clientWidth: W, clientHeight: H } = scene
  const top = sign.offsetTop + sign.offsetHeight
  const band = cab.offsetTop - top
  const k = Math.min(0.84 * W / w, 0.66 * H / h)
  // In the hall: half again its own size, as long as the hall holds it.
  const s = Math.max(0.5, Math.min(1.5, 0.7 * band / h, 0.8 * W / w))
  return { k, s: s / k, dy: top + band / 2 - H / 2 }
}

// The name's ink on the line's light, chosen by the light's lightness
// (DESIGN.md: "the ink is chosen by the fill's lightness"): the panel's
// kinari, as it stood in the hall, unless the pigment is too light to
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
 * without the chrome (the desk's rail then leaves with the scene).
 * `station` is its config/stations entry, for the code on the sign over
 * the gate. `onNavigate` is called once, while the line's light has the
 * screen; `onDone` when the gate should unmount.
 */
export function TicketGate({ section, station, onNavigate, onDone }) {
  const summary = useProfileSummary()
  const credits = useCredits()
  const timers = useRef([])
  const scene = useRef(null)
  const sign = useRef(null)
  const cab = useRef(null)
  const beyond = useRef(null)
  const body = useRef(null)
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

  // Before the first paint, so the name's growth never starts from a
  // guess. Every reading is taken before anything is written: a write
  // between two readings dirtied the page's style, and the next reading
  // recalculated it again, twice in the tap's frame.
  useLayoutEffect(() => {
    const el = scene.current
    if (!el || !sign.current || !cab.current || !body.current) return
    const fit = titleFit(el, sign.current, cab.current, body.current)
    // Against the kinari the name wears in the dim hall, which is what
    // it would keep.
    const light = getComputedStyle(beyond.current).backgroundColor
    const ink = inkFor(light, getComputedStyle(body.current.querySelector('.gate__dest')).color)
    if (fit) {
      el.style.setProperty('--gate-title-k', fit.k.toFixed(3))
      el.style.setProperty('--gate-title-s', fit.s.toFixed(3))
      el.style.setProperty('--gate-title-dy', `${fit.dy.toFixed(1)}px`)
    }
    el.dataset.ink = ink
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

    // The card, the reader, the flaps, the cabinets and the name run on
    // their own CSS delays (the 改札 block of index.css, every one
    // scaled by --gate-x), as the door's do: a class flipped at the
    // contact re-rendered the scene, card and all, in the middle of its
    // motion. The timers here only carry what CSS cannot: the chime,
    // the light on the window's gutter, the navigation and the unmount.
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))

    // The window's scrollbar gutter (index.css reserves one) is outside
    // every fixed box, so the light could never reach it: a desk with
    // classic scrollbars saw the line's colour stop a strip short of
    // the window's edge through the whole hold. The gutter is painted in
    // the page's own ground, so the ground takes the light the moment
    // the cabinets have left the screen — at once, not on html's own
    // transition, which would colour the strip before the light got
    // there — and gives it back as the scene fades, on that transition,
    // in step with the fade. Everywhere else that ground is under body.
    const ground = document.documentElement.style
    const unwash = () => {
      ground.removeProperty('transition')
      ground.removeProperty('--gate-ground')
    }

    at(CONTACT_MS, playGateChime)
    at(COVERED_MS, () => {
      ground.setProperty('transition', 'none')
      ground.setProperty('--gate-ground', wash.current)
    })
    at(NAVIGATE_MS, () => cbs.current.onNavigate())
    // The scene's fade is declared here, as it starts, rather than with
    // a delay from the mount (index.css, .gate[data-leaving]).
    at(LEAVE_MS, () => {
      if (scene.current) scene.current.dataset.leaving = ''
      unwash()
    })
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

  // The learner's own card (plan 173), face up: their material, the
  // name, the level under it and the road of its struck 辻 filled to the
  // climb -- the face every other screen draws.
  // The card's own name (plan 247): none prints none.
  const holder = holderName(summary)
  const level = summary?.level ?? null
  const { share } = xpClimb(summary)
  const tier = cardTier(credits)

  // The name twice over, stacked: in the hall's kinari while the hall
  // is dim, and in the light's ink once it is lit. The two cross by
  // opacity, so the name, laid out at the size it lands at, is drawn
  // once each and never repainted as its colour turns.
  const face = mode => (
    <span className={`gate__face gate__face--${mode}`}>
      <span className="gate__dest" lang="ja">{section.icon}</span>
      <span className="gate__dest-latin">{section.title}</span>
    </span>
  )

  return createPortal(
    <div
      ref={scene}
      className={`gate${section.stage ? ' gate--stage' : ''}`}
      style={{ '--line-color': section.color, '--gate-x': SPEED }}
      aria-hidden="true"
    >
      <div className="gate__scrim" />

      <div className="gate__set">
        {/* What is through the gate: the line's light, one flat fill,
            dim until the flaps open. */}
        <div className="gate__beyond" ref={beyond}>
          <span className="gate__dim" />
        </div>

        {/* The sign the gate stands under, which rides up and off as
            the cabinets part, as the door's header does. */}
        <div className="gate__sign" ref={sign}>
          {station?.code && <span className="gate__roundel">{station.code}</span>}
          <svg className="gate__arrow" viewBox="0 0 26 18" aria-hidden="true">
            <path d="M2 9h20M15 3l7 6-7 6" />
          </svg>
        </div>

        {/* The ground the gate stands on, the cabinets mirrored in it. */}
        <span className="gate__floor" />

        {/* The two cabinets, the screen's two halves. Each carries its
            flap, tucked behind its face. */}
        <div className="gate__cab gate__cab--l" ref={cab}>
          <span className="gate__flap" />
          <span className="gate__face-plate" />
          {/* The gate's own sign: shut, then the way through. */}
          <span className="gate__led">
            <svg className="gate__led-x" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" /></svg>
            <svg className="gate__led-go" viewBox="0 0 14 14"><path d="M2 7h9M7 3l4 4-4 4" /></svg>
          </span>
        </div>
        <div className="gate__cab gate__cab--r">
          <span className="gate__flap" />
          <span className="gate__face-plate" />
          {/* The reader, with the contactless mark every reader in a
              station carries: three arcs, drawn whole. (The pass's own
              mark, half-circles fading out, read at this size as a
              stray dot and two brackets.) */}
          <span className="gate__reader">
            <span className="gate__reader-lit" />
            <svg className="gate__nfc" viewBox="0 0 12 24">
              <path d="M1.28 9.03A4 4 0 0 1 1.28 14.97M3.95 6.05A8 8 0 0 1 3.95 17.95M6.63 3.08A12 12 0 0 1 6.63 20.92" />
            </svg>
          </span>
        </div>
      </div>

      {/* The destination's name: in the hall over the gate, then grown
          to take the screen as the cabinets part. Laid out at the size
          it lands at and shrunk until then, so it is sharp when it
          holds. Over the cabinets, which it outgrows as they leave. */}
      <div className="gate__title">
        <span className="gate__title-move">
          <span className="gate__title-body" ref={body}>
            {face('dim')}
            {face('lit')}
          </span>
        </span>
      </div>

      {/* The card, flying in to meet the reader: the learner's own. Not
          part of the gate, so it does not leave with the cabinets: it
          is in the learner's hand. */}
      <div className="gate__card">
        <CardFace tier={tier} name={holder} level={level ?? ''} share={share} />
      </div>
    </div>,
    document.body,
  )
}
