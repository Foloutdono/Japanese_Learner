import { FlameIcon } from '../ui/Icons'

// 月火水木金土日 — the same weekday glyphs the home concourse leads
// with, so a day means the same thing wherever the app prints one.
const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土']

// ── 今週 — this week ───────────────────────────────────────
// Seven days, oldest to today, each as tall as the reviews done on it.
// The streak counter says a number; this says what the week actually
// looked like — which day you skipped, which day you went hard — and
// that is the part that changes behaviour.
//
// Built from /api/profile's `week`, which is the same
// get_daily_review_counts the stats calendar uses, asked for seven
// days instead of a year. The backend returns only days that have
// reviews, so the seven slots are generated here and matched by date;
// a missing day is a real zero, not a gap.
export function WeekStrip({ week, t }) {
  const days = []
  const today = new Date()
  const byDate = new Map((week ?? []).map(d => [d.date, d.count]))

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    // Local ISO date, not toISOString(), which converts to UTC and can
    // land on the wrong calendar day either side of midnight.
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ key, count: byDate.get(key) ?? 0, dow: d.getDay(), today: i === 0 })
  }

  const peak = Math.max(1, ...days.map(d => d.count))
  const total = days.reduce((a, d) => a + d.count, 0)

  return (
    <div className="week">
      <div className="week__days">
        {days.map(d => (
          <div
            key={d.key}
            className={`week-day${d.today ? ' week-day--today' : ''}${d.count ? '' : ' week-day--empty'}`}
            title={`${d.key} · ${d.count}`}
          >
            <div className="week-day__gauge" aria-hidden="true">
              <div className="week-day__fill" style={{ height: `${Math.round((d.count / peak) * 100)}%` }} />
            </div>
            <span className="week-day__count">{d.count}</span>
            <span className="week-day__dow" lang="ja">{WEEKDAY_JP[d.dow]}</span>
          </div>
        ))}
      </div>
      {total === 0 && <p className="week__empty">{t.noActivityWeek}</p>}
    </div>
  )
}

// ── 記録 — personal bests ──────────────────────────────────
// Four numbers the app already knew and never showed. streakLongest
// and bestQualityStreak in particular were being computed on every
// profile request and thrown away — the first for nothing, the second
// only to decide whether the 極 badge was lit.
export function Records({ profile, t }) {
  const figures = [
    { key: 'streak',   value: profile.streak,             label: t.currentStreak, unit: t.dayUnit, flame: true },
    { key: 'longest',  value: profile.streakLongest,      label: t.longestStreak, unit: t.dayUnit },
    { key: 'reviews',  value: profile.totalReviews,       label: t.totalReviews },
    { key: 'perfect',  value: profile.bestQualityStreak,  label: t.perfectRun,    unit: t.perfectRunUnit },
  ].filter(f => typeof f.value === 'number')

  if (!figures.length) return null

  return (
    <div className="records">
      {figures.map(f => (
        <div key={f.key} className="record">
          <span className="record__value">
            {f.flame && <FlameIcon size={16} />}
            {f.value.toLocaleString()}
            {/* Inline, not a third stacked line: "14 / CURRENT STREAK
                / days" orphaned the unit two rows under the number it
                belongs to. */}
            {f.unit && <span className="record__unit">{f.unit}</span>}
          </span>
          <span className="record__label">{f.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── 段位 — the mastery ladder ──────────────────────────────
// The rank was a five-character chip under the name, which is a poor
// showing for the app's other progress axis: the level ring says how
// much you have turned up, this says how much Japanese you hold. All
// four numbers (from, mastered, next, nextLabel) already ride along on
// the profile response and only the label was being drawn.
export function MasteryLadder({ rank, t }) {
  if (!rank) return null

  const from = rank.from ?? 0
  const has = rank.mastered ?? 0
  // The top of the ladder has no `next`: there is nothing further to
  // fill toward, so it shows as complete rather than as a broken bar.
  const topped = typeof rank.next !== 'number'
  const span = topped ? 1 : Math.max(1, rank.next - from)
  const into = topped ? 1 : Math.min(span, Math.max(0, has - from))
  const pct = Math.round((into / span) * 100)
  const left = topped ? 0 : Math.max(0, rank.next - has)

  return (
    <div className="dan">
      <div className="dan__head">
        <span className="dan__now">
          <span className="dan__now-jp" lang="ja">{rank.label}</span>
          <span className="dan__now-sub">{t.masteryRank}</span>
        </span>
        <span className="dan__count">
          <span className="dan__count-value">{has.toLocaleString()}</span>
          <span className="dan__count-label">{t.mastered}</span>
        </span>
      </div>

      <div className="dan__track" aria-hidden="true">
        <div className="dan__fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="dan__foot">
        <span>{topped ? t.rankTopped : t.rankRemaining(left.toLocaleString(), rank.nextLabel)}</span>
        {!topped && <span className="dan__target" lang="ja">{rank.nextLabel}</span>}
      </div>
    </div>
  )
}
