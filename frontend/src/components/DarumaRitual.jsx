import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { Daruma, RiseToken } from './Daruma'
import { StageFootlights } from './XpToast'
import { playSfx } from './sound'

// ── 満願 — the eye-painting ceremony ───────────────────────
// The reward moment for a fulfilled daruma. XpToast's level-up is a
// kabuki curtain call — loud, theatrical, the whole stage. This is
// deliberately its opposite number: a calligrapher's gesture. One
// brush comes down, one eye is inked, the ink bleeds outward, and the
// doll is finished. Same footlights underneath (imported from XpToast
// rather than reimplemented) so the two still read as the same app
// celebrating, just in two different registers.
//
// The sequence is CSS-timed end to end (see .daruma-ritual* in
// index.css); this component only tracks which act we're in, because
// the second eye must not appear until the brush has actually reached
// it, and the claim button must not be clickable until the ink has
// settled:
//
//   0 approach — ground washes over, doll rises, one-eyed
//   1 stroke   — the brush sweeps in and lands
//   2 mangan   — eye inked, ink-bleed ring, rays, banner, reward
//
// `onDone` fires only on the real animationend of the exit wash — never
// on a guessed duration — the same contract XpToast holds itself to.
const ACT_STROKE = 900
const ACT_MANGAN = 1500

export function DarumaRitual({ ritual, onDone }) {
  const { t } = useLang()
  // No reset-on-new-ritual effect: the caller keys this component on
  // ritual.id, so a second ceremony is a fresh mount with fresh state
  // (and fresh CSS animations, which only ever play on mount anyway).
  const [act, setAct] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!ritual) return
    playSfx('level-up')
    const a = setTimeout(() => setAct(1), ACT_STROKE)
    const b = setTimeout(() => setAct(2), ACT_MANGAN)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [ritual])

  if (!ritual) return null

  const { goal, xpEarned, tokensEarned } = ritual

  const handleOverlayAnimationEnd = (e) => {
    if (e.animationName === 'daruma-ritual-out') onDone?.()
  }

  return (
    <div
      className={`daruma-ritual${leaving ? ' daruma-ritual--leaving' : ''} daruma-ritual--act${act}`}
      style={{ '--daruma-color': `var(--daruma-${goal.color})` }}
      aria-live="polite"
      onAnimationEnd={handleOverlayAnimationEnd}
    >
      <StageFootlights big leaving={leaving} colorVar="--accent2" />

      {/* Sumi wash: a single brush-loaded sweep across the ground,
          not a fade — the overlay arrives the way ink arrives. */}
      <div className="daruma-ritual__wash" aria-hidden="true" />

      <div className="daruma-ritual__stage">
        <div className="daruma-ritual__rays" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className="daruma-ritual__ray" style={{ '--ray-angle': `${i * 30}deg` }} />
          ))}
        </div>

        <div className="daruma-ritual__doll">
          <Daruma
            color={goal.color}
            rarity={goal.rarity}
            glyph={goal.glyph}
            progress={1}
            eyes={act >= 2 ? 2 : 1}
            size={190}
          />
          {/* Lands exactly over the doll's blank eye. Positioned in CSS
              against the doll box, not the viewport, so it stays on the
              eye at every breakpoint. */}
          <span className="daruma-ritual__brush" aria-hidden="true" />
          <span className="daruma-ritual__bleed" aria-hidden="true" />
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
