import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { Daruma, RiseToken } from './Daruma'
import { StageFootlights } from './XpToast'
import { playSfx } from './sound'

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
const ACT_BRUSH  = 1000
const ACT_IMPACT = 2100
const ACT_MANGAN = 2700

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
          <span className="daruma-ritual__brush" aria-hidden="true">
            <span className="daruma-ritual__brush-handle" />
            <span className="daruma-ritual__brush-ferrule" />
            <span className="daruma-ritual__brush-tip" />
          </span>
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
