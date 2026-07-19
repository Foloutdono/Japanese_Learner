import { useEffect } from 'react'
import { playXpGain, playLevelUp } from './sound'

// ── XP toast ──────────────────────────────────────────────
// `toast` is `{ amount, id, leveledUp, newLevel }` — `id` rather than
// keying off `amount` so two back-to-back reviews worth the same XP
// still re-trigger the animation, and `leveledUp`/`newLevel` (from
// srs.review()'s response — see KanjiScreen/VocabScreen/KanaScreen's
// postReview) switch it into the bigger celebration variant instead
// of the routine pop. `onDone` clears the parent's state once the
// toast has had its moment; the component itself doesn't track its
// own visibility.
const NORMAL_DURATION = 1600
const LEVEL_UP_DURATION = 2400

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
      <div key={toast.id} className="level-up-overlay" aria-live="polite">
        <div className="level-up-banner">
          <div className="level-up-banner__glyph" aria-hidden="true">昇</div>
          <div className="level-up-banner__label">Niveau supérieur</div>
          <div className="level-up-banner__level">Niveau {toast.newLevel}</div>
          <div className="level-up-banner__xp">+{toast.amount} XP</div>
        </div>
      </div>
    )
  }

  return (
    <div key={toast.id} className="xp-toast" aria-live="polite">
      <span className="xp-toast__glyph" aria-hidden="true">⚡</span>
      +{toast.amount} XP
    </div>
  )
}