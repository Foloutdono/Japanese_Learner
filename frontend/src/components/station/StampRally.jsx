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

export function StampRally({ week, streak, t }) {
  const byDate = new Map((week ?? []).map(d => [d.date, d.count]))
  const today = new Date()

  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({
      key,
      dow: d.getDay(),
      stamped: (byDate.get(key) ?? 0) > 0,
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
              + (d.stamped ? '' : ' stamp-rally__stamp--missed')
              + (d.isToday && d.stamped ? ' stamp-rally__stamp--today' : '')
            }
            style={{ '--stamp-tilt': `${d.tilt}deg` }}
          >
            {WEEKDAY_JP[d.dow]}
          </span>
        ))}
      </span>
      <span className="stamp-rally__label" aria-hidden="true">
        <span className="stamp-rally__count">
          {streak ?? 0}<span className="stamp-rally__unit" lang="ja">日</span>
        </span>
        <span className="stamp-rally__caption">{t.streak}</span>
      </span>
    </div>
  )
}
