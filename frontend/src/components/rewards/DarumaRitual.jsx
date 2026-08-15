import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { Daruma, RiseToken } from './Daruma'
import { StageFootlights } from './StageFootlights'
import { playSfx } from '../../lib/audio'

// ── 開眼 — the eye-opening ceremony ────────────────────────
// The reward moment for a fulfilled daruma, and the one place in the
// app that gets a full cinematic sequence rather than a flourish.
//
// XpToast's level-up is a kabuki curtain call — loud, theatrical, the
// whole stage at once. This is its opposite number and takes longer on
// purpose: a calligrapher's gesture, staged in four acts, with the
// camera pushing in the whole time. Same footlights underneath
// (imported from XpToast rather than reimplemented) so both still read
// as the same app celebrating.
//
// The idiom the whole thing is built on is 画竜点睛 — "dotting the
// eyes of the painted dragon", the finishing touch that brings a work
// to life. In the story the painter refuses to add the eyes because
// the dragon would fly away; pressed, he adds them, and it does. The
// impact at act 2 is that moment, and everything before it is the
// approach.
//
//   0 登場  the ground washes over, the doll rises and settles,
//           an ink ring spreads beneath it — one eye, waiting
//   1 筆    a brush descends from off-screen, the camera pushes in,
//           the edges of the world darken away
//   2 点睛  contact. The eye floods, the screen flashes, a shockwave
//           and a scatter of ink leave the strike, the doll recoils,
//           the brush flicks away, and a single drip runs down.
//   3 満願  gold rays ignite and begin to turn, the doll rocks itself
//           upright the way a roly-poly does, the banner rises and a
//           hanko is struck into it.
//
// Every act boundary is a class on the root (`--act0`…`--act3`), so
// the whole sequence is CSS-timed and this component only decides when
// the acts change. `onDone` fires on the real animationend of the exit
// wash, never on a guessed duration — the same contract XpToast holds.
// The brush's own animation runs 2000ms starting at ACT_BRUSH, and
// its contact keyframe sits at 75% of that — so ACT_IMPACT must be
// ACT_BRUSH + 1500 exactly, or the ink lands before or after the
// bristles touch. Change one, change the other.
const ACT_BRUSH  = 900
const ACT_IMPACT = 2400
const ACT_MANGAN = 3100

// Ink thrown off the strike. Hand-placed rather than randomised, for
// the same reason XpToast's embers are: a brush stroke is a deliberate
// act, and the same eight droplets every time is a composition where
// Math.random() is a particle system.
const SPLATTER = [
  { a: -128, d: 78,  s: 5 },
  { a: -96,  d: 118, s: 3 },
  { a: -58,  d: 62,  s: 4 },
  { a: -18,  d: 96,  s: 6 },
  { a: 24,   d: 70,  s: 3 },
  { a: 62,   d: 132, s: 5 },
  { a: 104,  d: 84,  s: 4 },
  { a: 148,  d: 58,  s: 3 },
]

// ── 筆 — the brush ────────────────────────────────────────
// Drawn in SVG rather than stacked divs, for one reason: bristles
// have to bend. A brush that lands on a surface and stays a rigid
// wedge reads as a cursor; a real one splays under pressure, curls
// away from the direction of travel, and springs back when lifted.
// That needs two bundle shapes to cross-fade between and a flex
// transform pivoted at the ferrule, neither of which a clip-path
// rectangle can do.
//
// Everything else is just observation of an actual fude: a bamboo
// shaft with visible nodes and a lit edge, a metal ferrule, and a
// bundle whose individual hairs show near the tip. The hairs are
// three lighter strands over the dark mass — enough to break up the
// silhouette, few enough to stay clean in motion.
//
// The tip point sits at (26, 252) in this box, and the wrapper's
// transform anchors that point to the doll's unpainted eye.
const BRISTLES_RELAXED = `
  M 16 168
  C 15 200, 19 228, 24.6 250
  C 25.2 252.4, 26.8 252.4, 27.4 250
  C 33 228, 37 200, 36 168
  Z
`
// Under pressure: the bundle widens at the shoulder, the mass bows to
// one side, and the point blunts as the hairs fan out against the
// paper.
const BRISTLES_PRESSED = `
  M 14.5 168
  C 12.5 202, 17 226, 22.5 244
  C 23.6 249, 25 252.5, 26.6 253
  C 28.6 252, 30.4 247, 31.6 242
  C 36.4 222, 38.5 200, 37.5 168
  Z
`

function Brush() {
  return (
    <span className="daruma-ritual__brush" aria-hidden="true">
      <svg viewBox="0 0 52 256" width="100%" height="100%" className="brush">
        <defs>
          <linearGradient id="brush-bamboo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#3a2a1c" />
            <stop offset="26%"  stopColor="#8a6b4f" />
            <stop offset="44%"  stopColor="#c2a179" />
            <stop offset="62%"  stopColor="#8a6b4f" />
            <stop offset="100%" stopColor="#2e2114" />
          </linearGradient>
          <linearGradient id="brush-metal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#6b5424" />
            <stop offset="34%"  stopColor="#e0bd6a" />
            <stop offset="56%"  stopColor="#c99a3e" />
            <stop offset="100%" stopColor="#5c471f" />
          </linearGradient>
          <linearGradient id="brush-ink" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b3542" />
            <stop offset="38%"  stopColor="#1a1620" />
            <stop offset="100%" stopColor="#07050a" />
          </linearGradient>
        </defs>

        {/* Shaft, with two node bands and a highlight down the lit edge */}
        <rect className="brush__shaft" x="18" y="0" width="16" height="152" rx="3" />
        <rect className="brush__node" x="18" y="38" width="16" height="3" />
        <rect className="brush__node" x="18" y="86" width="16" height="3" />
        <rect className="brush__sheen" x="22.5" y="4" width="3" height="144" rx="1.5" />

        {/* Ferrule */}
        <rect className="brush__ferrule" x="14.5" y="148" width="23" height="22" rx="2" />
        <rect className="brush__ferrule-line" x="14.5" y="154" width="23" height="1.2" />

        {/* The bundle. Both shapes are always present; the pressed one
            is revealed at the moment of contact, and the group flexes
            about the ferrule at the same time. */}
        <g className="brush__bristles">
          <path className="brush__tip" d={BRISTLES_RELAXED} fill="url(#brush-ink)" />
          <path className="brush__tip brush__tip--pressed" d={BRISTLES_PRESSED} fill="url(#brush-ink)" />
          <path className="brush__hair" d="M 22 172 C 22 200, 24 226, 26 244" />
          <path className="brush__hair" d="M 26 170 C 26.5 198, 27 224, 26.8 246" />
          <path className="brush__hair" d="M 30.5 172 C 30 200, 28.5 226, 27 244" />
        </g>

        {/* Loaded ink gathering at the point during the hover, heavy
            enough that two drops let go before the stroke is made. */}
        <circle className="brush__bead brush__bead--1" cx="26" cy="250" r="3" />
        <circle className="brush__bead brush__bead--2" cx="26" cy="250" r="2.4" />
      </svg>
    </span>
  )
}

export function DarumaRitual({ ritual, onDone }) {
  const { t } = useLang()
  // No reset effect: the caller keys this component on ritual.id, so a
  // second ceremony is a fresh mount with fresh state — and fresh CSS
  // animations, which only ever play on mount anyway.
  const [act, setAct] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!ritual) return
    playSfx('level-up')
    const timers = [
      setTimeout(() => setAct(1), ACT_BRUSH),
      setTimeout(() => setAct(2), ACT_IMPACT),
      setTimeout(() => setAct(3), ACT_MANGAN),
    ]
    return () => timers.forEach(clearTimeout)
  }, [ritual])

  if (!ritual) return null

  const { goal, xpEarned, tokensEarned } = ritual

  const handleOverlayAnimationEnd = (e) => {
    if (e.animationName === 'daruma-ritual-out') onDone?.()
  }

  return (
    <div
      className={`daruma-ritual daruma-ritual--act${act}${leaving ? ' daruma-ritual--leaving' : ''}`}
      style={{ '--daruma-color': `var(--daruma-${goal.color})` }}
      aria-live="polite"
      onAnimationEnd={handleOverlayAnimationEnd}
    >
      <StageFootlights big leaving={leaving} colorVar="--accent2" />

      {/* Sumi wash: one brush-loaded sweep across the ground, not a
          fade — the overlay arrives the way ink arrives. */}
      <div className="daruma-ritual__wash" aria-hidden="true" />
      {/* Closes in through acts 1-2 so the doll is the only lit thing
          left by the time the brush reaches it. */}
      <div className="daruma-ritual__vignette" aria-hidden="true" />
      <div className="daruma-ritual__flash" aria-hidden="true" />

      <div className="daruma-ritual__stage">
        <div className="daruma-ritual__halo" aria-hidden="true" />
        <div className="daruma-ritual__rays" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className={`daruma-ritual__ray${i % 2 ? ' daruma-ritual__ray--short' : ''}`}
              style={{ '--ray-angle': `${i * 22.5}deg` }}
            />
          ))}
        </div>

        <div className="daruma-ritual__doll">
          <Daruma
            color={goal.color}
            rarity={goal.rarity}
            glyph={goal.glyph}
            progress={1}
            eyes={act >= 2 ? 2 : 1}
            size={200}
            ceremonial
          />

          {/* Everything below is anchored to the doll's own box, not
              the viewport, so the strike lands on the eye at every
              breakpoint. See EYE in Daruma.jsx for the 40.5%/30%. */}
          <span className="daruma-ritual__ground" aria-hidden="true" />
          <Brush />
          <span className="daruma-ritual__shock" aria-hidden="true" />
          <span className="daruma-ritual__shock daruma-ritual__shock--2" aria-hidden="true" />
          <span className="daruma-ritual__drip" aria-hidden="true" />
          <span className="daruma-ritual__splatter" aria-hidden="true">
            {SPLATTER.map((d, i) => (
              <span
                key={i}
                className="daruma-ritual__drop"
                style={{ '--drop-angle': `${d.a}deg`, '--drop-dist': `${d.d}px`, '--drop-size': `${d.s}px` }}
              />
            ))}
          </span>

          {/* The seal goes on the artwork, not on the caption — the
              doll is the finished piece, and this is where a painter
              signs one. It rides the doll's rocking, which is right:
              the ink is on the object. */}
          <div className="daruma-ritual__hanko" aria-hidden="true">満</div>
        </div>

        <div className="daruma-ritual__banner">
          <div className="daruma-ritual__mangan" lang="ja">満願</div>
          <div className="daruma-ritual__label">{t.darumaFulfilled}</div>
          <div className="daruma-ritual__goal">{t.darumaGoalTitle?.[goal.id] ?? goal.id}</div>

          <div className="daruma-ritual__rewards">
            <span className="daruma-ritual__reward">+{xpEarned} XP</span>
            {tokensEarned > 0 && (
              <span className="daruma-ritual__reward daruma-ritual__reward--token">
                <RiseToken size={16} /> +{tokensEarned}
              </span>
            )}
          </div>

          <button
            type="button"
            className="daruma-ritual__claim"
            onClick={() => setLeaving(true)}
            disabled={leaving}
          >
            <span className="daruma-ritual__claim-glyph" aria-hidden="true">納</span>
            {t.darumaEnshrine}
          </button>
        </div>
      </div>
    </div>
  )
}
