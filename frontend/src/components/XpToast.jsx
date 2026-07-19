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

// Confetti palette — a few accents in rotation rather than a single
// tone, so a burst reads as "confetti" and not "colored spark".
const CONFETTI_COLORS = ['--accent2', '--accent6', '--success', '--accent9', '--accent7', '--accent3']

// Small rhythm-game-style confetti burst rising from the bottom edge
// of the screen. Regenerated (via the `count` dependency, which only
// ever changes when a fresh burst is requested through React's `key`
// on the component itself) so each burst gets its own random spread.
function ConfettiBurst({ count }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() * 100).toFixed(1),
    delay: (Math.random() * 0.3).toFixed(2),
    duration: (0.9 + Math.random() * 0.6).toFixed(2),
    drift: Math.round(Math.random() * 70 - 35),
    rotate: Math.round(Math.random() * 360),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [count])

  return (
    <div className="xp-confetti" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className="xp-confetti__piece"
          style={{
            left: `${p.x}%`,
            background: `var(${p.color})`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--rotate': `${p.rotate}deg`,
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
        <ConfettiBurst key={toast.id} count={44} />
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
  // up, plus a bottom-of-screen confetti burst that scales the same
  // way — the better the rating, the more the toast celebrates it.
  const sparkColorVar = SPARK_COLOR_VAR[toast.quality]
  const sparkCount = sparkColorVar ? toast.quality - 2 : 0
  const boosted = toast.quality >= 4
  const confettiCount = sparkCount * 12

  return (
    <>
      {confettiCount > 0 && <ConfettiBurst key={toast.id} count={confettiCount} />}
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