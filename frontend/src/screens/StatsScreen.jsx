import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJsonWithTimeout } from '../lib/api'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { stationFor } from '../config/stations'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { weeklyRetention, missesSince, strengthRungs, lineRows } from '../domain/statsModel'
import { RetentionLine } from '../components/stats/RetentionLine'
import { StrengthLadder } from '../components/stats/StrengthLadder'
import { LineRows } from '../components/stats/LineRows'
import { TroubleList } from '../components/stats/TroubleList'

// 統計 wears the plate the profile's door to it already draws (TO, in
// LineMark) — the bar is the same mark, so the screen you land on is
// visibly the one you tapped. Pass ink rather than a hall's pigment: a
// hall behind the pass is pass material.
const STATION = stationFor('/profile/stats')

const MISS_WINDOW = 30

// ── 運行実績 — the service record (plan 085) ───────────────
// One question, which the profile (what I did) and the fare gate (what
// now) do not ask: is the learning holding, and where is it leaking?
// Read top to bottom as one sentence:
//
//   it holds        retention by week, the one chart
//   this well       the strength ladder
//   on these lines  by line, composition and retention
//   except here     the misses, then the cards behind them
//
// No block carries a heading; each names itself with its mark. Two
// fetches: /api/stats, which the profile reads too, and the report.
export default function StatsScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const [stats, setStats] = useState(null)
  const [report, setReport] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // The week the retention line is being asked about; null is the
  // latest ridden week. Reset with the report, never carried over.
  const [week, setWeek] = useState(null)

  useEffect(() => {
    let live = true
    Promise.all([
      apiJsonWithTimeout('/api/stats', session),
      apiJsonWithTimeout('/api/stats/report', session),
    ])
      .then(([s, r]) => { if (live) { setStats(s); setReport(r); setWeek(null) } })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const retention = useMemo(() => weeklyRetention(report?.days), [report])
  const misses    = useMemo(() => missesSince(report?.days, { window: MISS_WINDOW }), [report])
  const strength  = useMemo(() => strengthRungs(report?.strength), [report])
  const lines     = useMemo(() => lineRows(stats), [stats])

  // There's no dedicated "review" screen — due cards are prioritised
  // inside a normal session, so this drops the user into the right
  // level/mode and lets the session surface them (plan 071).
  function startReview(category, key, mode) {
    navigate(`/learn/${category}/${encodeURIComponent(key)}/${mode}`)
  }

  const loaded = stats && report
  const nothingYet = loaded && retention.current === null && strength.total === 0

  // The head prints the asked week — this week unless a stop was
  // pressed — and the delta stays what it is: the whole line's drift.
  const askedIndex = week ?? retention.currentIndex
  const asked = askedIndex === null ? null : retention.weeks[askedIndex]
  const weekFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  const weekLabel = asked ? weekFmt.format(new Date(`${asked.start}T12:00:00`)) : ''

  return (
    <main id="main-content" className="stats" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar
        code={STATION.code}
        title={t.statistics}
        color="var(--pass-ink)"
        aside={<Leave onClick={() => navigate('/profile')}>{t.profileTitle}</Leave>}
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
          <section className="rep-card" aria-label={t.reportRetention}>
            <div className="rep-head">
              <span className="rep-fig">
                {asked?.pct == null ? '—' : asked.pct}
                {asked?.pct != null && <span className="rep-fig__u">%</span>}
              </span>
              {retention.delta !== null && (
                <span className="rep-delta">
                  {/* Over the span the line draws — first ridden week
                      to this one — never the twelve the payload holds. */}
                  {t.reportDelta(retention.delta, retention.weeks.length - retention.firstIndex - 1)}
                </span>
              )}
            </div>
            <div className="rep-caps">
              <span className="rep-cap">{t.reportRetention}</span>
              {asked && <span className="rep-cap">{t.reportWeekOf(weekLabel, asked.reviews)}</span>}
            </div>
            <RetentionLine
              weeks={retention.weeks}
              currentIndex={retention.currentIndex}
              firstIndex={retention.firstIndex}
              selected={week}
              onSelect={setWeek}
            />
          </section>

          {strength.total > 0 && (
            <section className="rep-card">
              <StrengthLadder rungs={strength.rungs} total={strength.total} />
            </section>
          )}

          {lines.some(l => l.total > 0) && (
            <section className="rep-card rep-card--rows">
              <LineRows rows={lines} />
            </section>
          )}

          {report.weakest?.length > 0 && (
            <>
              <div className="rep-head">
                <span className="rep-fig rep-fig--title">
                  {misses.toLocaleString()}
                  <span className="rep-fig__u">{t.reportMisses(misses, MISS_WINDOW)}</span>
                </span>
              </div>
              <TroubleList weakest={report.weakest} onStartReview={startReview} />
            </>
          )}
        </>
      )}
    </main>
  )
}
