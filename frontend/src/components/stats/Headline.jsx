import { FlameIcon, BoltIcon } from '../ui/Icons'

// ── The headline band ─────────────────────────────────────
// Six numbers, and the first thing on the screen. The old overview was
// four figures in a flat row (streak, longest, accuracy, due) with no
// sense of which mattered; this leads with the two that are actually
// about *today* — the streak you could break and the pile you could
// clear — and gives each figure a second line so a bare number is
// never left to mean whatever you assume it means.
export function Headline({ totals, streak, dueToday, t }) {
  const mastery = Math.round(totals.masteryPct)

  return (
    <div className="headline">
      <Plaque
        tone="streak"
        value={<>{streak?.current ?? 0}<FlameIcon size={20} className="headline__flame" /></>}
        label={t.streak}
        note={streak?.longest ? t.longestIs(streak.longest) : t.noStreakYet}
      />

      <Plaque
        tone="due"
        value={dueToday.toLocaleString()}
        label={t.dueToday}
        note={dueToday > 0 ? t.dueNote : t.dueClear}
        icon={<BoltIcon size={14} />}
      />

      <Plaque
        tone="mastered"
        value={`${mastery}%`}
        label={t.mastered}
        note={t.ofTotalCards(totals.total.toLocaleString())}
        ring={mastery}
      />

      <Plaque
        tone="accuracy"
        value={totals.accuracyPct === null ? '—' : `${Math.round(totals.accuracyPct)}%`}
        label={t.accuracy}
        note={t.acrossReviews(totals.reviews.toLocaleString())}
      />

      <Plaque
        tone="learning"
        value={totals.learning.toLocaleString()}
        label={t.learning}
        note={t.startedNote(totals.started.toLocaleString())}
      />

      <Plaque
        tone="new"
        value={totals.new.toLocaleString()}
        label={t.new}
        note={t.untouchedNote}
      />
    </div>
  )
}

// A ring is drawn only where a figure is genuinely a share of
// something (mastery is; a streak isn't) — a progress ring around a
// number that can't be full is decoration pretending to be data.
function Plaque({ tone, value, label, note, icon, ring }) {
  const r = 15
  const circumference = 2 * Math.PI * r

  return (
    <div className={`plaque plaque--${tone}`}>
      <span className="plaque__rule" aria-hidden="true" />

      <span className="plaque__top">
        <span className="plaque__value">{value}</span>
        {ring != null && (
          <svg className="plaque__ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle className="plaque__ring-track" cx="18" cy="18" r={r} />
            <circle
              className="plaque__ring-fill"
              cx="18" cy="18" r={r}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ring / 100)}
            />
          </svg>
        )}
        {icon && <span className="plaque__icon">{icon}</span>}
      </span>

      <span className="plaque__label">{label}</span>
      <span className="plaque__note">{note}</span>
    </div>
  )
}
