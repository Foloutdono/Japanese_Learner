import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { stationFor } from '../config/stations'
import { Loading } from '../components/ui/Loading'
import { flattenStats, sumRows } from '../domain/statsModel'
import { PracticeCalendar } from '../components/stats/PracticeCalendar'
import { Explorer } from '../components/stats/Explorer'
import { Forecast } from '../components/stats/Forecast'
import { TroubleList } from '../components/stats/TroubleList'

// Minutes east of UTC — the review log is stored in UTC, so the hour
// histogram has to be told which day the user is actually living in.
const TZ = -new Date().getTimezoneOffset()

const CAL_WEEKS = 14

// 統計 wears the plate the profile's door to it already draws (TO, in
// LineMark) — the bar is the same mark, so the screen you land on is
// visibly the one you tapped. Pass ink rather than the hall's own
// pigment: a hall behind the pass is pass material, which is what the
// door is painted in too.
const STATION = stationFor('/profile/stats')

// ── Statistics (canvas Statistics, plan 074) ──────────────────
// The screen is four questions, in the order they get asked:
//
//   Where do I stand?       the six records
//   Have I been showing up? the practice calendar
//   What's coming?          the week's forecast
//   Where am I weak?        the explorer, then the trouble list
//
// Every number comes from the same two fetches it always did. The
// records are the canvas's lattice with a note under each figure, so
// a bare number is never left to mean whatever you assume it means.
export default function StatsScreen({ session }) {
  const navigate = useNavigate()
  const { t }    = useLang()
  const [stats, setStats] = useState(null)
  const [extra, setExtra] = useState(null)

  useEffect(() => {
    apiFetch('/api/stats', session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setStats)
      .catch(() => setStats(null))

    apiFetch(`/api/stats/extra?tz_offset=${TZ}`, session)
      .then(r => (r.ok ? r.json() : null))
      .then(setExtra)
      .catch(() => setExtra(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // One flattening for the whole screen: the records, the explorer and
  // every total below them read the same array, so they cannot drift
  // apart the way three separate reduce()s over a nested payload
  // eventually do.
  const rows   = useMemo(() => flattenStats(stats, t), [stats, t])
  const totals = useMemo(() => sumRows(rows), [rows])

  // There's no dedicated "review" screen — due cards are prioritised
  // inside a normal session, so this drops the user into the right
  // level/mode and lets the session surface them. A set or level and a
  // mode are a path (plan 071).
  function startReview(category, key, mode) {
    navigate(`/learn/${category}/${encodeURIComponent(key)}/${mode}`)
  }

  const week = extra?.forecast?.slice(0, 7) ?? []
  const dueToday = week[0]?.count ?? totals.due
  const weekTotal = week.reduce((n, f) => n + f.count, 0)
  const streak = extra?.streak
  const bestDay = extra?.trend?.reduce((b, d) => Math.max(b, d.count), 0) ?? 0
  const mastery = Math.round(totals.masteryPct)
  const accuracy = totals.accuracyPct === null ? null : Math.round(totals.accuracyPct)

  return (
    <main id="main-content" className="stats" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar
        code={STATION.code}
        title={t.statistics}
        color="var(--pass-ink)"
        aside={<Leave onClick={() => navigate('/profile')}>{t.profileTitle}</Leave>}
      />

      {!stats && <Loading />}

      {stats && (
        <>
          <div className="records records--stats">
            <Record
              value={streak?.current ?? 0}
              unit={t.daysUnit}
              label={t.streak}
              note={streak?.longest ? t.longestNote(streak.longest) : t.noStreakYet}
            />
            <Record value={dueToday} label={t.dueToday} note={t.dueWeekNote(weekTotal)} />
            <Record value={mastery} unit="%" label={t.mastered} note={t.masteredNote(totals.mastered, totals.total)} />
            <Record
              value={accuracy ?? '—'}
              unit={accuracy == null ? null : '%'}
              label={t.accuracy}
              note={t.acrossReviews(totals.reviews.toLocaleString())}
            />
            <Record value={totals.learning} label={t.learning} />
            <Record value={totals.new} label={t.new} note={t.untouchedNote} />
          </div>

          <div className="stat-cap">
            <span>{t.practiceCalendar}</span>
            <span>{t.calWeeksCap(CAL_WEEKS)} <b className="stat-cap__fig">{bestDay.toLocaleString()}</b></span>
          </div>
          <PracticeCalendar trend={extra?.trend} weeks={CAL_WEEKS} />

          <div className="stat-cap">
            <span>{t.upcomingReviews}</span>
            <span>{t.forecastCap(7)} <b className="stat-cap__fig">{weekTotal.toLocaleString()}</b></span>
          </div>
          <Forecast forecast={week} />

          <div className="stat-cap"><span>{t.explorer}</span></div>
          <Explorer rows={rows} onStartReview={startReview} />

          {extra?.weakest?.length > 0 && (
            <>
              <div className="stat-cap"><span>{t.weakestItems}</span></div>
              <p className="hint">{t.troubleLede}</p>
              <TroubleList weakest={extra.weakest} onStartReview={startReview} />
            </>
          )}
        </>
      )}
    </main>
  )
}

// One cell of the lattice: the figure with its unit, the label, and
// the note that says what the figure is a share of.
function Record({ value, unit = null, label, note = null }) {
  return (
    <div className="record">
      <span className="record__value">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="record__unit">{unit}</span>}
      </span>
      <span className="record__label">{label}</span>
      {note && <span className="record__note">{note}</span>}
    </div>
  )
}
