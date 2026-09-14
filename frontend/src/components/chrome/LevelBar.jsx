import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useXpGain } from './useXpGain'
import { FareFigure } from './Hud'

// ── 運賃表示 — the level bar, docked on a run ─────────────────
// The stage frame takes the HUD away, and with it the one object that
// reported the fare. This strip is what a run keeps: the level in the
// caption register, the pass's gold climbing toward the next one, and
// the XP figure the fare rises off. Docked on the bottom edge under
// the rating bar (or the field), where the thumb that just rated is —
// the placement chosen from three drawn side by side (2026-09).
//
// Sumi, like the rating bar it sits under, so the bottom of the screen
// stays one console. It is the same object on every run: the card runs
// move it per review (useReviewGates → applyXpGain), the practice runs
// per graded answer (hooks/usePracticeXp), the exam once, on submit.
//
// The gain: the span the bar just climbed lights gold and the amount
// rises off the figure. Both are cleared off the figure's own
// animationend (FareFigure), never off a timer guessing at the CSS.
// Inert on purpose: a run is not the place to walk to the pass.
//
// Rendered before the summary arrives too, at its full height, so the
// docks above it never move when the figures land.
export function LevelBar() {
  const { t } = useLang()
  const summary = useProfileSummary()
  const { gain, clear } = useXpGain(summary)

  const span = summary ? Math.max(1, summary.xpForNext - summary.xpPrevLevel) : 1
  const into = summary ? Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel)) : 0
  const pct  = Math.round((into / span) * 100)

  return (
    <div
      className="lvlbar"
      role="progressbar"
      aria-label={summary ? `${t.level} ${summary.level}` : t.level}
      aria-valuemin={0}
      aria-valuemax={span}
      aria-valuenow={into}
    >
      <span className="lvlbar__level">
        {t.levelShort}
        <b className="lvlbar__level-num">{summary?.level ?? ''}</b>
      </span>
      <span className="lvlbar__track" aria-hidden="true">
        <span className="lvlbar__fill" style={{ width: `${pct}%` }} />
        {gain && gain.toPct > gain.fromPct && (
          <span
            key={gain.id}
            className="lvlbar__gain"
            style={{ left: `${gain.fromPct}%`, width: `${gain.toPct - gain.fromPct}%` }}
          />
        )}
      </span>
      <span className="lvlbar__xp">
        <FareFigure gain={gain} className="hud-fare hud-fare--bar" onEnd={clear} />
        {summary ? `${into.toLocaleString()} / ${span.toLocaleString()}` : ''}
        <span className="lvlbar__unit">xp</span>
      </span>
    </div>
  )
}
