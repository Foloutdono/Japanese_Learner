import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJsonWithTimeout } from '../lib/api'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { stationFor } from '../config/stations'
import { getSections } from '../config/tabs'
import { TRACKED_LINES } from '../domain/lineProgress'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { retentionSeries, missesSince, strengthRungs, lineGrids, weakestByLine } from '../domain/statsModel'
import { ReportStrip } from '../components/stats/ReportStrip'
import { LineReport } from '../components/stats/LineReport'
import { useDesk } from '../hooks/useDesk'

// 統計 wears the plate the profile's door to it already draws (TO, in
// LineMark) — the bar is the same mark, so the screen you land on is
// visibly the one you tapped. Pass ink rather than a hall's pigment: a
// hall behind the pass is pass material.
const STATION = stationFor('/profile/stats')

const MISS_WINDOW = 30

// ── 路線別 — the record, line by line (plans 085, 138) ────────
// One question, which the profile (what I did) and the fare gate (what
// now) do not ask: is the learning holding, and where is it leaking?
// Since plan 138 (the owner's pick B of four drawn directions) the
// screen answers it per line, because that is where a leak is:
//
//   the strip   retention with its line, the reviews behind the asked
//               stop, the misses of the last month, the strength ladder
//   the plates  one per line — its retention, its grid of exercise by
//               deck with the leak in red, its most-missed cards
//
// It replaced one retention card, one ladder card, a list of lines
// whose bar and figure measured two different things, and twelve
// trouble cards that were eight of one line's and none of another's.
//
// On the phone the plates stand in one column; on the desk they go two
// by two and take the window's height, the way the gates' plates do
// (plan 130). No sheet at either width: every drill-down is on its
// plate. Two fetches: /api/stats, which the profile reads too, and the
// report.
export default function StatsScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const desk = useDesk()
  const [stats, setStats] = useState(null)
  const [report, setReport] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // The stop the retention line is being asked about — a day or a week,
  // as the series draws them; null is the last one ridden. Reset with
  // the report, never carried over.
  const [point, setPoint] = useState(null)
  // The stop under the mouse on the desk, null off the line (plan 123).
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    let live = true
    Promise.all([
      apiJsonWithTimeout('/api/stats', session),
      apiJsonWithTimeout('/api/stats/report', session),
    ])
      .then(([s, r]) => { if (live) { setStats(s); setReport(r); setPoint(null); setPreview(null) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const series   = useMemo(() => retentionSeries(report?.days), [report])
  const misses   = useMemo(() => missesSince(report?.days, { window: MISS_WINDOW }), [report])
  const strength = useMemo(() => strengthRungs(report?.strength), [report])
  const { grids } = useMemo(() => lineGrids(stats), [stats])
  const weakest  = useMemo(() => weakestByLine(report?.weakest), [report])

  // There's no dedicated "review" screen — due cards are prioritised
  // inside a normal session, so this drops the user into the right
  // level/mode and lets the session surface them (plan 071).
  function startReview(category, key, mode) {
    navigate(`/learn/${category}/${encodeURIComponent(key)}/${mode}`)
  }

  const loaded = stats && report
  const nothingYet = loaded && series.current === null && strength.total === 0

  // The strip prints the asked stop — the last one ridden unless one
  // was pressed, or on the desk the one under the mouse (plan 123).
  const askedIndex = preview ?? point ?? series.currentIndex
  const asked = askedIndex === null ? null : series.points[askedIndex]
  const dayFmt = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' })
  const weekFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  const pointLabel = p => {
    const date = new Date(`${p.start}T12:00:00`)
    return series.unit === 'day' ? dayFmt.format(date) : t.reportWeekStart(weekFmt.format(date))
  }

  // The four lines, in the Learn gate's order, each with its section's
  // name, roundel and pigment.
  const lines = getSections('learn', t)
    .filter(s => TRACKED_LINES[s.path])
    .map(section => {
      const category = TRACKED_LINES[section.path]
      return { section, grid: grids.find(g => g.category === category), weakest: weakest[category] ?? [] }
    })

  return (
    <main id="main-content" className={`stats${desk ? ' desk-stats' : ''}`} style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar
        code={STATION.code}
        title={t.statistics}
        color="var(--pass-ink)"
        aside={<Leave to={'/profile'}>{t.profileTitle}</Leave>}
      />

      {!loaded && !failed && <Loading />}

      {failed && (
        <Empty
          tone="error"
          message={t.reportError}
          action={{ label: t.retry, onClick: () => { setFailed(false); setAttempt(a => a + 1) } }}
        />
      )}

      {nothingYet && <Empty message={t.reportEmpty} hint={t.reportEmptyHint} />}

      {loaded && !nothingYet && (
        <>
          <ReportStrip
            series={series}
            asked={asked}
            askedLabel={asked ? pointLabel(asked) : ''}
            describe={p => t.reportPointOf(pointLabel(p), p.reviews)}
            selected={preview ?? point}
            onSelect={setPoint}
            onPreview={desk ? setPreview : undefined}
            misses={misses}
            missWindow={MISS_WINDOW}
            strength={strength}
          />
          <div className="rep-plates">
            {lines.map(({ section, grid, weakest: cards }) => (
              <LineReport key={section.path} section={section} grid={grid} weakest={cards} onStartReview={startReview} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
