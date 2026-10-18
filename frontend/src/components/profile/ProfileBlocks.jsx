import { getProfileHalls } from '../../config/tabs'
import { ChevronIcon, GearIcon } from '../ui/Icons'
import { LineMark } from './LineLedger'
import { SplitRow } from '../selection/SplitRow'
import { useDesk } from '../../hooks/useDesk'
import { durationParts, weekShare } from '../../domain/agenda'
import { AGENDA_PATH } from '../agenda/AgendaNext'

// ── The stamp book (canvas Profile, plan 074) ─────────────────
// DESIGN.md, Motion: the streak is a stamp rally, not a flame. The
// gate stamps the last seven days on the strip; this is the rally's
// sheet — five whole weeks, Monday to Sunday, ending on the current
// one, every day ridden inked in the eki stamp's lacquer, a missed day
// dashed, today pressed harder, the days ahead faint. Under it, the
// three figures in one row of three: the streak, the longest, the
// days stamped. On the desk (plan 248) the three join the records in
// one lattice of six (Records' `book`) and the sheet prints none.
//
// The sheet names itself by its month (plan 143): the month is the
// title and the year sits in the margin, where "Stamp book" over
// "September 2026" said the name of the object a second time.
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

// The sheet's five weeks, a slot a day from the Monday four weeks before
// this one, against the local midnight `today` -- and how many of the
// days so far were stamped: what the sheet draws and what its figures
// count, the desk's records lattice included (plan 248).
function bookDays(calendar, today) {
  // A day is stamped for a review or, since plan 178, a graded practice
  // answer: the streak counts both, so the book has to.
  const byDate = new Map((calendar ?? []).map(d => [d.date, (d.count ?? 0) + (d.practice ?? 0)]))
  // 運休 (plan 191): a day a rest ticket covered (`rest: true`) is no
  // miss -- the streak walked through it -- so the board's stub is laid
  // over it, in pass ink, as on Today's stamp rally.
  const rested = new Set((calendar ?? []).filter(d => d.rest).map(d => d.date))
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
      rest: count === 0 && rested.has(key),
      // A deterministic wobble per slot — a rubber stamp never lands
      // perfectly square (same as the strip's StampRally).
      tilt: ((i * 37) % 13) - 6,
    })
  }
  return {
    cells,
    elapsed: cells.filter(c => !c.future).length,
    stamped: cells.filter(c => c.stamped).length,
  }
}

// Local midnight, the day the sheet ends its week on.
function localToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export function StampBook({ calendar, streak, longest, t, lang = 'en', figures = true }) {
  const today = localToday()
  const { cells, elapsed, stamped } = bookDays(calendar, today)

  // A title, so capitalised: French writes its months in lower case.
  const month = new Intl.DateTimeFormat(lang, { month: 'long' }).format(today)
  const title = month.charAt(0).toLocaleUpperCase(lang) + month.slice(1)
  const dowFmt = new Intl.DateTimeFormat(lang, { weekday: 'narrow' })
  const dows = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(A_MONDAY)
    d.setDate(A_MONDAY.getDate() + i)
    return dowFmt.format(d)
  })

  return (
    <section className="sbook" aria-label={`${t.currentStreak}: ${streak ?? 0}`} data-guide="profile.stamps">
      <div className="sbook__month">
        <span className="sbook__title">{title}</span>
        <span className="fig__l">{today.getFullYear()}</span>
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
              + (c.future ? ' sbook__stamp--future' : c.stamped ? '' : c.rest ? ' sbook__stamp--rest' : ' sbook__stamp--missed')
              + (c.today && c.stamped ? ' sbook__stamp--today' : '')
            }
            style={{ '--stamp-tilt': `${c.stamped ? c.tilt : c.rest ? -4 : 0}deg` }}
            title={c.rest ? `${c.key} · 運休` : `${c.key} · ${c.count}`}
            lang={c.rest ? 'ja' : undefined}
          >
            {c.rest ? '運休' : c.day}
          </span>
        ))}
      </div>

      {figures && (
        <div className="sbook__side">
          <div className="sbook__figs">
            <Figure value={streak ?? 0} unit={t.daysUnit(streak ?? 0)} label={t.streak} lang={lang} />
            <Figure value={longest ?? 0} unit={t.daysUnit(longest ?? 0)} label={t.longestStreak} lang={lang} />
            <Figure value={stamped} unit={`/ ${elapsed}`} label={t.daysStamped} lang={lang} />
          </div>
        </div>
      )}
    </section>
  )
}

// A bare figure: large numeral, small unit inline, caps label beneath.
function Figure({ value, unit, label, lang }) {
  return (
    <div className="fig">
      <span className="fig__v">
        {value.toLocaleString(lang)}
        {unit && <span className="fig__u">{unit}</span>}
      </span>
      <span className="fig__l">{label}</span>
    </div>
  )
}

// ── The records (canvas ProfileInserts, plan 143) ─────────────
// What no other object on the screen already says (the streak rides
// the stamp book, the lines their ledger): every review, the share
// kept, and the best perfect run -- the longest unbroken run of good
// or better answers, which /api/profile has always counted and the
// screen never printed. Three figures in the flush hairline lattice,
// three across, so the count divides its content at every width
// (DESIGN.md, Surfaces). A figure with nothing to count yet prints a
// dash rather than leaving the lattice a bare slab.
//
// `book` is the desk's (plan 248): the stamp book's three figures -- the
// streak, the longest, the days stamped -- open the lattice, three by
// two, so the holder's figures are one record at the head of its column
// and the sheet beside the card is the stamps alone.
export function Records({ profile, t, lang, book = false }) {
  const { elapsed, stamped } = book ? bookDays(profile.calendar ?? profile.week, localToday()) : {}
  const streak = profile.streak ?? 0
  const longest = profile.streakLongest ?? 0
  const figures = [
    ...(book ? [
      { key: 'streak',  value: streak,  unit: t.daysUnit(streak),  label: t.streak },
      { key: 'longest', value: longest, unit: t.daysUnit(longest), label: t.longestStreak },
      { key: 'stamped', value: stamped, unit: `/ ${elapsed}`,      label: t.daysStamped },
    ] : []),
    { key: 'reviews',   value: profile.totalReviews, label: t.totalReviews },
    {
      key: 'retention',
      value: typeof profile.retention === 'number' ? Math.round(profile.retention * 100) : null,
      unit: '%',
      label: t.retention,
    },
    // No unit: "d'affilée" under its figure took a French phone's cell
    // to two lines while its neighbours kept one.
    { key: 'run', value: profile.bestQualityStreak, label: t.perfectRun },
  ]

  return (
    <div className="records records--three" data-guide="profile.records">
      {figures.map(f => (
        <div key={f.key} className="record">
          <span className="record__value">
            {typeof f.value === 'number' ? f.value.toLocaleString(lang) : '—'}
            {f.unit && typeof f.value === 'number' && <span className="record__unit">{f.unit}</span>}
          </span>
          <span className="record__label">{f.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── The two doors behind the pass ─────────────────────────────
// Statistics, drawn as the ledger draws a line (roundel, name) with a
// chevron where a figure would be, and Settings with the gear in its
// roundel: two cells, two across. They closed the records' lattice
// until plan 143 gave the records a third figure; they are their own
// lattice now, straight under the pass. The phone's alone -- on the desk both
// halls hang under the lit gate on the rail, so the page drew the same
// two doors a second time (ProfileScreen.jsx leaves them out there).
// The halls and Settings are places: on the desk (plan 123) they are
// links, so they open in a new tab too; the phone keeps its buttons.
export function ProfileDoors({ t, navigate }) {
  const desk = useDesk()
  return (
    <div className="records">
      {getProfileHalls(t).map(hall => (
        <SplitRow
          key={hall.path}
          to={desk ? hall.path : undefined}
          push
          className="record record--door"
          style={{ '--line-color': 'var(--pass-ink)' }}
          data-guide={hall.path === '/profile/stats' ? 'profile.stats' : undefined}
          onClick={() => { if (!desk) navigate(hall.path) }}
        >
          <LineMark section={hall} />
          <ChevronIcon direction="right" size={15} className="record__chev" />
        </SplitRow>
      ))}
      <SplitRow
        to={desk ? '/profile/settings' : undefined}
        push
        className="record record--door"
        style={{ '--line-color': 'var(--pass-ink)' }}
        data-guide="profile.settings"
        onClick={() => { if (!desk) navigate('/profile/settings') }}
      >
        <span className="pf-line__id">
          <span className="pf-line__roundel pf-line__roundel--icon" aria-hidden="true"><GearIcon size={14} /></span>
          <span className="pf-line__names"><span className="pf-line__jp">{t.settings}</span></span>
        </span>
        <ChevronIcon direction="right" size={15} className="record__chev" />
      </SplitRow>
    </div>
  )
}

// ── 記念切符 — the door to the tickets (plan 191) ──────────────────
// The streak's tickets (3, 7, 14 days, a month …) live behind the stamp
// book they were earned in: one door under it, drawn as the doors are
// (a roundel, the name, a chevron), in the stamp's ink, with how many
// the learner holds. On the phone and the desk alike -- the rail holds
// no door to it. A place, so a link on the desk (plan 123).
export function TicketsDoor({ t, navigate, count = 0 }) {
  return (
    <div className="records records--one">
      <TicketsCell t={t} navigate={navigate} count={count} />
    </div>
  )
}

function TicketsCell({ t, navigate, count }) {
  const desk = useDesk()
  return (
    <SplitRow
      to={desk ? '/profile/tickets' : undefined}
      push
      className="record record--door"
      style={{ '--line-color': 'var(--stamp-ink)' }}
      onClick={() => { if (!desk) navigate('/profile/tickets') }}
    >
      <span className="pf-line__id">
        <span className="pf-line__roundel" aria-hidden="true" lang="ja">券</span>
        <span className="pf-line__names"><span className="pf-line__jp">{t.tkbDoor}</span></span>
      </span>
      <span className="record__value record__value--door">{count}</span>
      <ChevronIcon direction="right" size={15} className="record__chev" />
    </SplitRow>
  )
}

// ── 時間割 — the door to the agenda (plan 202) ─────────────────────
// The owner's pick B of the two drawn (a timetable in the holder, or a
// door): the week's blocks live in Settings › Agenda (plan 181), and the
// holder keeps one door to them under the tickets', drawn as the doors
// are, in the pass's ink (the agenda is one of the card's own pages).
// Its figure is the hours the week holds, a standing arrangement rather
// than what is next, so the holder stays backward-looking (DESIGN.md);
// an empty or unread week prints none. A place, so a link on the desk
// (plan 123).
export function AgendaDoor({ t, navigate, blocks }) {
  return (
    <div className="records records--one">
      <AgendaCell t={t} navigate={navigate} blocks={blocks} />
    </div>
  )
}

function AgendaCell({ t, navigate, blocks }) {
  const desk = useDesk()
  const { total } = weekShare(blocks ?? [])
  const { h, m } = durationParts(total)
  return (
    <SplitRow
      to={desk ? AGENDA_PATH : undefined}
      push
      className="record record--door"
      style={{ '--line-color': 'var(--pass-ink)' }}
      onClick={() => { if (!desk) navigate(AGENDA_PATH) }}
    >
      <span className="pf-line__id">
        <span className="pf-line__roundel" aria-hidden="true" lang="ja">時</span>
        <span className="pf-line__names"><span className="pf-line__jp">{t.settingsAgenda}</span></span>
      </span>
      {total > 0 && <span className="record__value record__value--door">{t.agdDuration(h, m)}</span>}
      <ChevronIcon direction="right" size={15} className="record__chev" />
    </SplitRow>
  )
}

// ── 机 — the holder's two doors, under the card (plan 248) ──────────
// The tickets' and the agenda's doors as one lattice of two slim rows,
// straight under the card: places rather than figures, so they stand
// apart from the records, and the stamp book under them is the stamps
// alone. The phone keeps a lattice each under its stamp book.
export function HolderDoors({ t, navigate, count = 0, blocks }) {
  return (
    <div className="records records--one desk-doors">
      <TicketsCell t={t} navigate={navigate} count={count} />
      <AgendaCell t={t} navigate={navigate} blocks={blocks} />
    </div>
  )
}
