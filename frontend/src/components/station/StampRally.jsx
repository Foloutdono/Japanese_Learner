// ── スタンプラリー — the streak as eki stamps ─────────────────
// DESIGN.md, Motion: "The streak is a スタンプラリー stamp rally, not a
// flame — a row of eki-stamp marks, one per day, today's freshly
// inked." This is that component, finally: seven days, oldest first,
// each stamped if any review landed on it, today's mark pressed a
// beat after the pass arrives.
//
// Built from /api/profile's `week` the same way the profile's
// WeekStrip is: the backend returns only days that have reviews, so
// the seven slots are generated here and matched by date — a missing
// day is a real miss, not a gap in the data.
const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土']

// 運休 (plan 191): a day a rest ticket covered -- the profile's week
// marks it `rest: true` -- keeps the streak without being studied, so it
// is neither a stamp nor a miss: the RestDay board's stub is laid over
// it, in pass ink, at its own small angle.
const REST_TILT = -4

export function StampRally({ week, streak, t }) {
  // Reviews and, since plan 178, graded practice answers: both are a day
  // shown up, as the streak counts it.
  const byDate = new Map((week ?? []).map(d => [d.date, (d.count ?? 0) + (d.practice ?? 0)]))
  const rested = new Set((week ?? []).filter(d => d.rest).map(d => d.date))
  const today = new Date()

  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const stamped = (byDate.get(key) ?? 0) > 0
    days.push({
      key,
      dow: d.getDay(),
      stamped,
      rest: !stamped && rested.has(key),
      isToday: i === 0,
      // A deterministic wobble per slot — a rubber stamp never lands
      // perfectly square, and seven identical circles would read as a
      // progress widget rather than an ink rally.
      tilt: ((i * 37) % 13) - 6,
    })
  }

  return (
    <div className="stamp-rally" role="img" aria-label={`${t.streak}: ${streak ?? 0}`}>
      <span className="stamp-rally__row" aria-hidden="true">
        {days.map(d => (
          <span
            key={d.key}
            lang="ja"
            className={
              'stamp-rally__stamp'
              + (d.stamped ? '' : d.rest ? ' stamp-rally__stamp--rest' : ' stamp-rally__stamp--missed')
              + (d.isToday && d.stamped ? ' stamp-rally__stamp--today' : '')
            }
            style={{ '--stamp-tilt': `${d.rest ? REST_TILT : d.tilt}deg` }}
          >
            {d.rest ? '運休' : WEEKDAY_JP[d.dow]}
          </span>
        ))}
      </span>
      <span className="stamp-rally__label" aria-hidden="true">
        <span className="stamp-rally__count">
          {streak ?? 0}
        </span>
        <span className="stamp-rally__caption">{t.streak}</span>
      </span>
    </div>
  )
}
