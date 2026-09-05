import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import { Loading } from '../components/ui/Loading'
import { SectionHeader } from '../components/ui/SectionHeader'
import { flattenStats, sumRows } from '../domain/statsModel'
import { Headline } from '../components/stats/Headline'
import { PracticeCalendar } from '../components/stats/PracticeCalendar'
import { Explorer } from '../components/stats/Explorer'
import { Forecast } from '../components/stats/Forecast'
import { StudyClock, RatingMix, IntervalLadder } from '../components/stats/Rhythm'
import { TroubleList } from '../components/stats/TroubleList'

// Minutes east of UTC — the review log is stored in UTC, so the hour
// histogram has to be told which day the user is actually living in.
const TZ = -new Date().getTimezoneOffset()

// ── 統計 ───────────────────────────────────────────────────
// The screen is four questions, in the order they get asked:
//
//   Where do I stand?      the headline band
//   Have I been showing up? the practice calendar
//   Where am I weak?        the Explorer, then the trouble list
//   What's coming?          the forecast, then the rhythm charts
//
// The old screen answered the first and then printed the payload:
// eighteen cards of level × mode progress bars in backend order, which
// is complete in the sense that everything is on the page and useless
// in the sense that nothing can be compared. Every number here comes
// from the same two fetches it always did — plus three aggregates that
// were sitting unused in the database (see routes/stats.py's _rhythm)
// and one, the daily trend, that was already being fetched on every
// load and thrown away without ever being drawn.
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

  // One flattening for the whole screen: the headline, the Explorer
  // and every total below them read the same array, so they cannot
  // drift apart the way three separate reduce()s over a nested payload
  // eventually do.
  const rows   = useMemo(() => flattenStats(stats, t), [stats, t])
  const totals = useMemo(() => sumRows(rows), [rows])

  // There's no dedicated "review" screen — due cards are prioritised
  // inside a normal session, so this drops the user into the right
  // level/mode and lets the session surface them.
  function startReview(category, key, mode) {
    if (category === 'kana') {
      navigate(`/kana?set=${encodeURIComponent(key)}&mode=${mode}`)
      return
    }
    navigate(`/${category}?level=${encodeURIComponent(key)}&mode=${mode}`)
  }

  const dueToday = extra?.forecast?.[0]?.count ?? totals.due
  const rhythm = extra?.rhythm

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.statistics} autoHide />

      {!stats && <Loading />}

      {stats && (
        <main id="main-content" className="container stats-container">
          <StationHeader />
          <Headline totals={totals} streak={extra?.streak} dueToday={dueToday} t={t} />

          <SectionHeader jp="暦" title={t.practiceCalendar} />
          <PracticeCalendar trend={extra?.trend} />

          <SectionHeader jp="内訳" title={t.explorer} />
          <Explorer rows={rows} onStartReview={startReview} />

          <SectionHeader jp="予定" title={t.upcomingReviews} />
          <Forecast forecast={extra?.forecast} />

          {rhythm && (
            <>
              <SectionHeader jp="時間帯" title={t.rhythm} />
              <div className="rhythm-grid">
                <StudyClock hours={rhythm.hours} />
                <RatingMix quality={rhythm.quality} />
                <IntervalLadder intervals={rhythm.intervals} />
              </div>
            </>
          )}

          {extra?.weakest?.length > 0 && (
            <>
              <SectionHeader jp="弱点" title={t.weakestItems} />
              <p className="stats-lede">{t.troubleLede}</p>
              <TroubleList weakest={extra.weakest} onStartReview={startReview} />
            </>
          )}
        </main>
      )}
    </div>
  )
}
