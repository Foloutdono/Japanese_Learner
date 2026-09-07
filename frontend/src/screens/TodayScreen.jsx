import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Bar } from '../components/chrome/Bar'
import { stationFor } from '../config/stations'
import { useTodaySummary, refreshToday } from '../stores/today'
import { useCredits } from '../stores/credits'
import GateCard from '../components/station/GateCard'
import { untilNext } from '../domain/lanes'
import PassStrip from '../components/station/PassStrip'
import { FareSlip } from '../components/credits/FareSlip'
import Empty from '../components/ui/Empty'
import { CheckIcon } from '../components/ui/Icons'

// ── 本日 — the gate (plan 070) ────────────────────────────────
// The Today tab: the bar, the fare gate with the day's lanes as the
// run's picker, and the pass at strip size under it. The run itself
// is /today/run on the stage (screens/TodayRun.jsx); it comes back
// here with what it cleared, and this screen prints the finish — the
// canvas's RunComplete, under the chrome — until "Back to the
// station" (or any navigation) puts the gate back.
//
// Everything this screen reads is shared: /api/today from the store
// the tab bar's badge already reads, the balance from the credits
// store. One request each, every consumer.

function RunComplete({ run, today, credits, t, lang, onBack }) {
  const when = untilNext(today?.next_due, lang)
  return (
    <div className="today-clear">
      <span className="today-clear__mark" aria-hidden="true"><CheckIcon size={26} /></span>
      <h2 className="today-clear__title">{t.todayClearTitle}</h2>
      <p className="today-clear__body">{t.todayClearedCount(run.cleared)}</p>
      {when && <p className="today-clear__next">{t.todayNextReview(when)}</p>}
      <FareSlip
        reviews={run.cleared}
        xp={run.xp}
        creditsLeft={credits?.unlimited ? null : credits?.balance}
      />
      <button type="button" className="btn-depart btn-depart--ghost" onClick={onBack}>
        <span className="btn-depart__jp">{t.backToStation}</span>
      </button>
    </div>
  )
}

export default function TodayScreen() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: today, failed } = useTodaySummary()
  const credits = useCredits()
  const station = stationFor('/today')

  // What the run just cleared, handed back through the router's state
  // (screens/TodayRun.jsx). A reload has no state and shows the gate.
  const run = location.state?.run

  // "Sat 5 Sep" — the bar's sub, on the learner's calendar.
  const dateSub = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())

  return (
    <main id="main-content" className="today">
      <Bar code={station.code} title={t.todayTitle} sub={dateSub} color="var(--accent2)" />

      {run ? (
        <RunComplete
          run={run} today={today} credits={credits} t={t} lang={lang}
          onBack={() => navigate('/today', { replace: true, state: null })}
        />
      ) : (
        <>
          {failed && !today ? (
            <Empty
              tone="error"
              message={t.errorTitle}
              hint={t.errorHint}
              action={{ label: t.tryAgain, onClick: refreshToday }}
            />
          ) : (
            <GateCard today={today} failed={failed && !today} />
          )}
          <PassStrip pace={today?.pace} />
        </>
      )}
    </main>
  )
}
