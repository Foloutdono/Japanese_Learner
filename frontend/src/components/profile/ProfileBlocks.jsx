import { RANK_LABELS } from '../../stores/cosmetics'

// ── スタンプ帳 — the stamp book ────────────────────────────────
// DESIGN.md, Motion: the streak is a スタンプラリー, not a flame. The
// home hall stamps the last seven days on the pass; this is the rally's
// sheet — five whole weeks, Monday to Sunday, ending on the current one,
// every day ridden inked in the daruma's lacquer, today's pressed a beat
// after the page arrives. It replaced the week bars and the flame: the
// bars said how much, this says WHICH days, and that is the part that
// changes what you do tomorrow.
//
// Built from /api/profile's `calendar` (35 days of counts, days with
// nothing simply absent), so the seven-by-five grid is generated here
// and matched by local date — a missing day is a real miss.
const MONTH_JP = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const DOW_JP = ['月', '火', '水', '木', '金', '土', '日']
const WEEKS = 5

// Local ISO date, not toISOString(), which converts to UTC and can land
// on the wrong calendar day either side of midnight.
function localIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function StampBook({ calendar, streak, longest, t }) {
  const byDate = new Map((calendar ?? []).map(d => [d.date, d.count]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = (today.getDay() + 6) % 7 // Monday-first
  const start = new Date(today)
  start.setDate(today.getDate() - dow - 7 * (WEEKS - 1))

  const cells = []
  for (let i = 0; i < 7 * WEEKS; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = localIso(d)
    const count = byDate.get(key) ?? 0
    cells.push({
      key,
      day: d.getDate(),
      count,
      future: d > today,
      today: d.getTime() === today.getTime(),
      stamped: count > 0,
      // A deterministic wobble per slot — a rubber stamp never lands
      // perfectly square (same as the hall's StampRally).
      tilt: ((i * 37) % 13) - 6,
    })
  }
  const elapsed = cells.filter(c => !c.future).length
  const stamped = cells.filter(c => c.stamped).length

  return (
    <section className="sbook" aria-label={`${t.currentStreak}: ${streak ?? 0}`}>
      <div className="sbook__sheet" aria-hidden="true">
        <div className="sbook__dows">
          {DOW_JP.map(d => <span key={d} className="sbook__dow" lang="ja">{d}</span>)}
        </div>
        <div className="sbook__grid">
          {cells.map(c => (
            <span
              key={c.key}
              className={
                'sbook__stamp'
                + (c.future ? ' sbook__stamp--future' : c.stamped ? '' : ' sbook__stamp--missed')
                + (c.today && c.stamped ? ' sbook__stamp--today' : '')
              }
              style={{ '--stamp-tilt': `${c.stamped ? c.tilt : 0}deg` }}
              title={`${c.key} · ${c.count}`}
            >
              {c.day}
            </span>
          ))}
        </div>
      </div>

      <div className="sbook__side">
        <div className="sbook__month">
          <span className="sbook__month-jp" lang="ja">{MONTH_JP[today.getMonth()]}</span>
          <span className="fig__l">{today.getFullYear()}</span>
        </div>
        <div className="sbook__figs">
          <Figure value={streak ?? 0} unitJp="日" label={t.currentStreak} />
          <Figure value={longest ?? 0} unitJp="日" label={t.longestStreak} />
          <Figure value={stamped} unit={`/ ${elapsed}`} label={t.daysStamped} />
        </div>
      </div>
    </section>
  )
}

// A bare figure: large numeral, small unit inline, caps label beneath.
function Figure({ value, unit, unitJp, label }) {
  return (
    <div className="fig">
      <span className="fig__v">
        {value.toLocaleString()}
        {unitJp && <span className="fig__u" lang="ja">{unitJp}</span>}
        {unit && <span className="fig__u">{unit}</span>}
      </span>
      <span className="fig__l">{label}</span>
    </div>
  )
}

// ── The three figures — reviews, retention, best perfect run ────
// The flush hairline lattice the stats screen uses. The streaks moved
// onto the stamp book and the mastered count onto the rank plaque, so
// what is left here is what no other object on the screen already says.
export function Figures({ profile, t }) {
  const figures = [
    { key: 'reviews',   value: profile.totalReviews,      label: t.totalReviews },
    {
      key: 'retention',
      value: typeof profile.retention === 'number' ? Math.round(profile.retention * 100) : null,
      unit: '%',
      label: t.retention,
    },
    { key: 'perfect',   value: profile.bestQualityStreak, label: t.perfectRun, unit: t.perfectRunUnit },
  ].filter(f => typeof f.value === 'number')

  if (!figures.length) return null

  return (
    <div className="records">
      {figures.map(f => (
        <div key={f.key} className="record">
          <span className="record__value">
            {f.value.toLocaleString()}
            {f.unit && <span className="record__unit">{f.unit}</span>}
          </span>
          <span className="record__label">{f.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── 段位 — the mastery ladder, drawn as a line ─────────────────
// The level ring says how much you have turned up; this says how much
// Japanese you hold. The ladder used to be a bar; it is a line with
// stops now — the app's own idiom for distance (the wall map, the ghost
// track): six ranks around where you stand, the ones behind filled, 初段
// and above ringed twice like a dan seal, your train between the stop
// you hold and the next. Every number already rides on the profile
// response; the labels come from the same ladder the storehouse reads.
const SHODAN = RANK_LABELS.indexOf('初段')
const WINDOW = 6

export function MasteryLine({ rank, t }) {
  if (!rank) return null

  const idx = typeof rank.index === 'number' ? rank.index : Math.max(0, RANK_LABELS.indexOf(rank.label))
  const from = rank.from ?? 0
  const has = rank.mastered ?? 0
  // The top of the ladder has no `next`: nothing further to fill toward.
  const topped = typeof rank.next !== 'number'
  const span = topped ? 1 : Math.max(1, rank.next - from)
  const into = topped ? 1 : Math.min(span, Math.max(0, has - from))
  const frac = into / span
  const left = topped ? 0 : Math.max(0, rank.next - has)

  const first = Math.max(0, Math.min(idx - 2, RANK_LABELS.length - WINDOW))
  const stops = RANK_LABELS.slice(first, first + WINDOW).map((label, i) => ({ label, i: first + i }))
  // Percent geometry mirrors the wall map's: first stop at 5%, last at 95%.
  const step = 90 / Math.max(1, stops.length - 1)
  const x = i => 5 + (i - first) * step
  const you = topped ? x(idx) : Math.min(95, x(idx) + frac * step)

  return (
    <section className="dan">
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

      <div className="dan-line" aria-hidden="true">
        <span className="dan-line__in">
          <span className="dan-line__rail" />
          <span className="dan-line__done" style={{ width: `${you}%` }} />
          {stops.map(s => (
            <span
              key={s.label}
              className={
                'dan-line__stop'
                + (s.i <= idx ? ' dan-line__stop--past' : '')
                + (s.i >= SHODAN ? ' dan-line__stop--dan' : '')
              }
              style={{ left: `${x(s.i)}%` }}
            />
          ))}
          {stops.map(s => (
            <span
              key={`l-${s.label}`}
              className={`dan-line__label${s.i === idx ? ' dan-line__label--now' : ''}`}
              style={{ left: `${x(s.i)}%` }}
              lang="ja"
            >
              {s.label}
            </span>
          ))}
          <span className="dan-line__train" style={{ left: `${you}%` }} />
        </span>
      </div>

      <div className="dan__foot">
        <span>{topped ? t.rankTopped : t.rankRemaining(left.toLocaleString(), rank.nextLabel)}</span>
        {!topped && <span className="dan__target" lang="ja">{rank.nextLabel}</span>}
      </div>
    </section>
  )
}
