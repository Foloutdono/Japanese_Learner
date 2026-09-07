import { getProfileHalls } from '../../config/tabs'
import { ChevronIcon, GearIcon } from '../ui/Icons'
import { LineMark } from './LineLedger'

// ── The stamp book (canvas Profile, plan 074) ─────────────────
// DESIGN.md, Motion: the streak is a stamp rally, not a flame. The
// gate stamps the last seven days on the strip; this is the rally's
// sheet — five whole weeks, Monday to Sunday, ending on the current
// one, every day ridden inked in the eki stamp's lacquer, a missed day
// dashed, today pressed harder, the days ahead faint. Under it, the
// three figures: the streak, the longest, the days stamped.
//
// Built from /api/profile's `calendar` (35 days of counts, days with
// nothing simply absent), so the seven-by-five grid is generated here
// and matched by local date — a missing day is a real miss. The month
// and the weekday initials are the learner's language: the interface
// speaks it, and a date is not content.
const WEEKS = 5
// A known Monday, to take the weekday initials off in any locale.
const A_MONDAY = new Date(2024, 0, 1)

// Local ISO date, not toISOString(), which converts to UTC and can land
// on the wrong calendar day either side of midnight.
function localIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function StampBook({ calendar, streak, longest, t, lang = 'en' }) {
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
      // perfectly square (same as the strip's StampRally).
      tilt: ((i * 37) % 13) - 6,
    })
  }
  const elapsed = cells.filter(c => !c.future).length
  const stamped = cells.filter(c => c.stamped).length

  const monthFmt = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' })
  const dowFmt = new Intl.DateTimeFormat(lang, { weekday: 'narrow' })
  const dows = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(A_MONDAY)
    d.setDate(A_MONDAY.getDate() + i)
    return dowFmt.format(d)
  })

  return (
    <section className="sbook" aria-label={`${t.currentStreak}: ${streak ?? 0}`}>
      <div className="sbook__month">
        <span className="sbook__title">{t.stampBook}</span>
        <span className="fig__l">{monthFmt.format(today)}</span>
      </div>
      <div className="sbook__dows" aria-hidden="true">
        {dows.map((d, i) => <span key={i} className="sbook__dow">{d}</span>)}
      </div>
      <div className="sbook__grid" aria-hidden="true">
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

      <div className="sbook__side">
        <div className="sbook__figs">
          <Figure value={streak ?? 0} unit={t.daysUnit} label={t.currentStreak} />
          <Figure value={longest ?? 0} unit={t.daysUnit} label={t.longestStreak} />
          <Figure value={stamped} unit={`/ ${elapsed}`} label={t.daysStamped} />
        </div>
      </div>
    </section>
  )
}

// A bare figure: large numeral, small unit inline, caps label beneath.
function Figure({ value, unit, label }) {
  return (
    <div className="fig">
      <span className="fig__v">
        {value.toLocaleString()}
        {unit && <span className="fig__u">{unit}</span>}
      </span>
      <span className="fig__l">{label}</span>
    </div>
  )
}

// ── The records, and the two doors (canvas ProfileInserts) ────
// Reviews and retention — what no other object on the screen already
// says (the streak rides the stamp book, the lines their ledger) — in
// the flush hairline lattice, two by two, with the two doors behind
// the pass closing the second row: Statistics, drawn as the ledger
// draws a line (roundel, name) with a chevron where a figure would be,
// and Settings with the gear in its roundel. Four cells always: a
// figure with nothing to count yet prints a dash rather than leaving
// the lattice a bare slab.
export function Records({ profile, t, navigate }) {
  const figures = [
    { key: 'reviews',   value: profile.totalReviews, label: t.totalReviews },
    {
      key: 'retention',
      value: typeof profile.retention === 'number' ? Math.round(profile.retention * 100) : null,
      unit: '%',
      label: t.retention,
    },
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
          style={{ '--line-color': 'var(--pass-ink)' }}
          onClick={() => navigate(hall.path)}
        >
          <LineMark section={hall} />
          <ChevronIcon direction="right" size={15} className="record__chev" />
        </button>
      ))}
      <button
        type="button"
        className="record record--door"
        style={{ '--line-color': 'var(--pass-ink)' }}
        onClick={() => navigate('/profile/settings')}
      >
        <span className="pf-line__id">
          <span className="pf-line__roundel pf-line__roundel--icon" aria-hidden="true"><GearIcon size={14} /></span>
          <span className="pf-line__names"><span className="pf-line__jp">{t.settings}</span></span>
        </span>
        <ChevronIcon direction="right" size={15} className="record__chev" />
      </button>
    </div>
  )
}
