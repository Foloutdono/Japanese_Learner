import { useLang } from '../LangContext'

// ── Loading ───────────────────────────────────────────────
// A slow-turning, breathing ring (draws and fades on a loop) rather
// than a flat text label. Shared across any screen waiting on data —
// quiz cards, stats, decks — so "loading" always looks the same.
export function Loading() {
  const { t } = useLang()
  return (
    <div className="quiz-loading">
      <svg className="quiz-loading__ensor" viewBox="0 0 48 48" aria-hidden="true">
        <circle
          className="quiz-loading__ensor-circle"
          cx="24" cy="24" r="19"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="quiz-loading__text">{t.loading}</span>
    </div>
  )
}