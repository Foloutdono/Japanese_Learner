import { useEffect, useMemo } from 'react'
import { playXpGain, playLevelUp } from './sound'

// ── XP toast ──────────────────────────────────────────────
// `toast` is `{ amount, id, leveledUp, newLevel, quality }` — `id`
// rather than keying off `amount` so two back-to-back reviews worth
// the same XP still re-trigger the animation, and `leveledUp`/
// `newLevel` (from srs.review()'s response — see KanjiScreen/
// VocabScreen/KanaScreen's postReview) switch it into the bigger
// celebration variant instead of the routine pop. `onDone` clears the
// parent's state once the toast has had its moment; the component
// itself doesn't track its own visibility.
const NORMAL_DURATION = 1600
const LEVEL_UP_DURATION = 2400

// Same per-quality accent the rating bar itself uses (see
// .rating-bar__btn--q* in index.css) — q3 "hésitant" and up get a
// spark burst in the matching color; q0-q2 (failed) ratings get none.
const SPARK_COLOR_VAR = { 3: '--accent2', 4: '--accent6', 5: '--success' }

// Bottom-anchored pulse: a soft wash of `colorVar` rising from the
// bottom edge of the screen, most opaque low down and fading out
// toward the top (the gradient stop is itself randomized per layer so
// stacked pulses don't all reach the same height). Several layers are
// stacked with randomized delay/duration/peak-opacity for an organic,
// non-mechanical beat rather than one uniform flash. Regenerated (via
// the `count` dependency, changed only through React's `key` on the
// component itself) so each burst gets its own random spread.
function PulseEffect({ count, colorVar }) {
  const pulses = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: (Math.random() * 0.35).toFixed(2),
    duration: (0.6 + Math.random() * 0.5).toFixed(2),
    peak: (0.3 + Math.random() * 0.4).toFixed(2),
    spread: Math.round(50 + Math.random() * 30), // % where the gradient fades to transparent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [count])

  return (
    <div className="xp-pulse-stage" aria-hidden="true">
      {pulses.map(p => (
        <span
          key={p.id}
          className="xp-pulse"
          style={{
            background: `linear-gradient(to top, var(${colorVar}) 0%, transparent ${p.spread}%)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--pulse-peak': p.peak,
          }}
        />
      ))}
    </div>
  )
}

export function XpToast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    if (toast.leveledUp) playLevelUp()
    else playXpGain()

    const timer = setTimeout(() => onDone?.(), toast.leveledUp ? LEVEL_UP_DURATION : NORMAL_DURATION)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  if (!toast) return null

  if (toast.leveledUp) {
    return (
      <>
        <PulseEffect key={toast.id} count={6} colorVar="--accent2" />
        <div key={toast.id} className="level-up-overlay" aria-live="polite">
          <div className="level-up-banner">
            <div className="level-up-banner__glyph" aria-hidden="true">昇</div>
            <div className="level-up-banner__label">Niveau supérieur</div>
            <div className="level-up-banner__level">Niveau {toast.newLevel}</div>
            <div className="level-up-banner__xp">+{toast.amount} XP</div>
          </div>
        </div>
      </>
    )
  }

  // One spark per quality point above q2 (so 1/2/3 sparks for
  // q3/q4/q5), plus a stronger glow pulse on the pill itself from q4
  // up, plus a bottom-of-screen pulse wash that scales the same way —
  // the better the rating, the more the toast celebrates it.
  const sparkColorVar = SPARK_COLOR_VAR[toast.quality]
  const sparkCount = sparkColorVar ? toast.quality - 2 : 0
  const boosted = toast.quality >= 4
  const pulseCount = sparkCount * 2

  return (
    <>
      {pulseCount > 0 && <PulseEffect key={toast.id} count={pulseCount} colorVar={sparkColorVar} />}
      <div
        key={toast.id}
        className={`xp-toast${boosted ? ' xp-toast--boosted' : ''}`}
        aria-live="polite"
        style={sparkColorVar ? { '--spark-color': `var(${sparkColorVar})` } : undefined}
      >
        <span className="xp-toast__glyph" aria-hidden="true">⚡</span>
        +{toast.amount} XP
        {sparkCount > 0 && (
          <span className="xp-toast__sparks" aria-hidden="true">
            {Array.from({ length: sparkCount }, (_, i) => (
              <span key={i} className={`xp-toast__spark xp-toast__spark--${i}`} />
            ))}
          </span>
        )}
      </div>
    </>
  )
}