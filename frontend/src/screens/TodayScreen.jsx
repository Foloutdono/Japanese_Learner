import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useTodaySummary, refreshToday } from '../stores/today'
import { useCredits } from '../stores/credits'
import GateCard from '../components/station/GateCard'
import { EnterKey } from '../components/chrome/DeskKeys'
import { untilNext } from '../domain/lanes'
import PassStrip from '../components/station/PassStrip'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import { FareSlip } from '../components/credits/FareSlip'
import Empty from '../components/ui/Empty'
import { CheckIcon } from '../components/ui/Icons'
import { useDesk } from '../hooks/useDesk'
import { DeskSide } from '../components/chrome/DeskSide'
import { JourneyPanel } from '../components/journey/JourneyPanel'

// ── 本日 — the gate (plan 070) ────────────────────────────────
// The Today tab: the bar, the pass at strip size, and under it the
// fare gate with the day's lanes as the run's picker. The run itself
// is /today/run on the stage (screens/TodayRun.jsx); it comes back
// here with what it cleared, and this screen prints the finish — the
// canvas's RunComplete, under the chrome — until "Back to the
// station" (or any navigation) puts the gate back.
//
// Everything this screen reads is shared: /api/today from the store
// the tab bar's badge already reads, the balance from the credits
// store. One request each, every consumer.

function RunComplete({ run, today, credits, t, lang, onBack }) {
  const desk = useDesk()
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
      <button type="button" className="btn-depart btn-depart--ghost" onClick={onBack} aria-keyshortcuts={desk ? 'Enter' : undefined}>
        <span className="btn-depart__jp">{t.backToStation}</span>
        {desk && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
      </button>
      {/* 机 (plan 114): Enter, the one way on. */}
      <EnterKey onEnter={onBack} />
    </div>
  )
}

export default function TodayScreen({ session }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: today, failed } = useTodaySummary()
  // 案内 — the gate's guide, once, after the lanes have painted (plan 100).
  const guide = useGuide('today', Boolean(today) || failed)
  const credits = useCredits()

  // What the run just cleared, handed back through the router's state
  // (screens/TodayRun.jsx). A reload has no state and shows the gate.
  const run = location.state?.run

  return (
    <main id="main-content" className="today">
      {/* No bar: the gate's head (本日 · Today · the date) came off the
          four gates on the owner's call (2026-09-20, see LearnScreen.jsx).
          The name stays as the screen's clipped <h1>. */}
      <h1 className="sr-only">{t.todayTitle}</h1>

      {run ? (
        <RunComplete
          run={run} today={today} credits={credits} t={t} lang={lang}
          onBack={() => navigate('/today', { replace: true, state: null })}
        />
      ) : (
        <>
          {/* The strip first: a status line — the week, the streak, the
              day's new items — reads over the object it is about, and
              the gate under it is then the last thing on the screen and
              can take the rest of it. Owner's call. */}
          {/* On the desk the strip stands beside the gate instead, with
              the pass's back under it (below). */}
          {desk ? null : <PassStrip pace={today?.pace} />}
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
        </>
      )}
      {guide.open && !run && <Guide gate="today" onEnd={guide.onEnd} />}
      {/* 机 — the desk (plan 113): the gate is the work, and beside it
          what the work is FOR — the pass at strip size (the week, the
          streak, the day's new items) and the pass's back, the journey
          it is on: how far along, how far behind the promise, and the
          two honest moves when behind. On a phone the strip heads the
          gate and the back is a tap on the HUD away. */}
      {desk && (
        <DeskSide label={t.passLabel}>
          {!run && <PassStrip pace={today?.pace} />}
          <JourneyPanel session={session} />
        </DeskSide>
      )}
    </main>
  )
}
