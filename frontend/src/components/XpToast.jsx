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

// Builds one wavy, chaotic top-edge silhouette as an SVG path, filled
// from that edge down to the bottom of a 0-100 viewBox. Several sine
// terms of random frequency/amplitude/phase are summed for an organic
// multi-frequency wave, then extra per-point jitter is layered on top
// so the edge reads as rough/hand-drawn rather than a clean curve —
// no two calls produce the same silhouette.
function generateWavePath() {
  const POINTS = 36
  const terms = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
    freq: 1 + Math.random() * 4,
    amp: 8 + Math.random() * 16,
    phase: Math.random() * Math.PI * 2,
  }))
  const baseline = 50 + Math.random() * 15 // 0 = top of viewBox, 100 = bottom

  let d = `M 0 100 L 0 ${baseline.toFixed(1)}`
  for (let i = 0; i <= POINTS; i++) {
    const x = (i / POINTS) * 100
    let y = baseline
    terms.forEach(term => { y += Math.sin((x / 100) * Math.PI * term.freq + term.phase) * term.amp })
    y += (Math.random() - 0.5) * 12 // rough per-point jitter, on top of the smooth wave
    y = Math.max(4, Math.min(96, y))
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
  }
  d += ' L 100 100 Z'
  return d
}

// Bottom-anchored pulse: a chaotic wavy silhouette of `colorVar` rising
// from the bottom edge of the screen, filled with a vertical gradient
// so it's most opaque low down and fades out toward its own peak.
// Several layers stack, each with its own random wave shape plus
// randomized delay/duration/peak-opacity, for an organic, non-uniform
// beat rather than one identical flash repeated. Regenerated (via the
// `count` dependency, changed only through React's `key` on the
// component itself) so each burst gets its own random shapes.
function PulseEffect({ count, colorVar }) {
  const pulses = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: (Math.random() * 0.35).toFixed(2),
    duration: (0.7 + Math.random() * 0.6).toFixed(2),
    peak: (0.35 + Math.random() * 0.4).toFixed(2),
    path: generateWavePath(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [count])

  return (
    <div className="xp-pulse-stage" aria-hidden="true">
      {pulses.map(p => (
        <svg
          key={p.id}
          className="xp-pulse"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--pulse-peak': p.peak,
          }}
        >
          <defs>
            <linearGradient id={`xp-pulse-grad-${p.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" style={{ stopColor: `var(${colorVar})` }} />
            </linearGradient>
          </defs>
          <path d={p.path} fill={`url(#xp-pulse-grad-${p.id})`} />
        </svg>
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