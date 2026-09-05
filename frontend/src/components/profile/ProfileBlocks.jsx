import { getProfileHalls } from '../../config/navLinks'
import { ChevronIcon } from '../ui/Icons'
import { LineMark } from './LineLedger'

// ── スタンプ帳 — the stamp book ────────────────────────────────
// DESIGN.md, Motion: the streak is a スタンプラリー, not a flame. The
// home hall stamps the last seven days on the pass; this is the rally's
// sheet — five whole weeks, Monday to Sunday, ending on the current one,
// every day ridden inked in the eki stamp's lacquer, today's pressed a
// beat after the page arrives. It replaced the week bars and the flame: the
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

// ── 記録 — the records, and the door to the room that keeps them ──
// Reviews, retention and the best perfect run — what no other object
// on the screen already says (the streaks ride the stamp book, the
// lines their ledger) — in the flush hairline lattice, two by two. The
// fourth cell is 統計 itself: the one hall the profile still opens
// onto, drawn as the ledger draws a line (roundel, name, caption) with
// a ▶ where a figure would be, so a doorway and a record read as the
// same kind of cell. Four cells always: a figure with nothing to count
// yet prints a dash rather than leaving the lattice a bare slab.
export function Records({ profile, t, navigate }) {
  const figures = [
    { key: 'reviews',   value: profile.totalReviews, label: t.totalReviews },
    {
      key: 'retention',
      value: typeof profile.retention === 'number' ? Math.round(profile.retention * 100) : null,
      unit: '%',
      label: t.retention,
    },
    { key: 'perfect',   value: profile.bestQualityStreak, label: t.perfectRun, unit: t.perfectRunUnit },
  ]

  return (
    <div className="records">
      {figures.map(f => (
        <div key={f.key} className="record">
          <span className="record__value">
            {typeof f.value === 'number' ? f.value.toLocaleString() : '—'}
            {f.unit && typeof f.value === 'number' && <span className="record__unit">{f.unit}</span>}
          </span>
          <span className="record__label">{f.label}</span>
        </div>
      ))}
      {getProfileHalls(t).map(hall => (
        <button
          type="button"
          key={hall.path}
          className="record record--door"
          style={{ '--line-color': hall.color }}
          onClick={() => navigate(hall.path)}
        >
          <LineMark section={hall} />
          <ChevronIcon direction="right" size={15} className="record__chev" />
        </button>
      ))}
    </div>
  )
}
