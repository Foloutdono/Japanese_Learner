import { useEffect, useRef } from 'react'
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
import { playArrival } from '../lib/audio'
import { DeskSide } from '../components/chrome/DeskSide'
import { JourneyPanel } from '../components/journey/JourneyPanel'
import { WeekAhead } from '../components/journey/WeekAhead'
import { AgendaNext } from '../components/agenda/AgendaNext'
import { useAgenda } from '../stores/agenda'
import { useMinute } from '../hooks/useMinute'

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
  // 到着. Every other run ends on the arrival (DoneMessage); the day's
  // own run, the one most learners take, ended in silence. Guarded
  // against StrictMode's double effect, which would flam it.
  const sounded = useRef(false)
  useEffect(() => {
    if (sounded.current) return
    sounded.current = true
    playArrival()
  }, [])
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
      {/* 机 (plan 115): Enter, the one way on. */}
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
  // 時間割 (plan 181): what is next on the learner's agenda, read once a
  // minute so a block starting while the gate is open is seen starting.
  const { blocks } = useAgenda()
  const now = useMinute()

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
          {/* Under the strip, over the gate: the block under way (and the
              way into it) or the next, and the door to the agenda. Nothing
              for a learner with no agenda. On the desk it stands in the
              side column instead (below). */}
          {!desk && blocks?.length > 0 && <AgendaNext blocks={blocks} now={now} open />}
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
      {/* 机 — the desk (plan 114): the gate is the work, and beside it
          what the work is FOR — the pass at strip size (the week, the
          streak, the day's new items) and the pass's back, the journey
          it is on: how far along, how far behind the promise, and the
          two honest moves when behind. On a phone the strip heads the
          gate and the back is a tap on the HUD away. */}
      {desk && (
        <DeskSide label={t.passLabel}>
          {/* The strip stays on the finish too (plan 123): the run has
              just inked today's stamp and moved the new-items gauge. */}
          <PassStrip pace={today?.pace} />
          {/* What is next on the agenda, and the two blocks after it:
              the hour's business before the journey's. */}
          {blocks?.length > 0 && <AgendaNext blocks={blocks} now={now} open then={2} />}
          <JourneyPanel session={session} />
          {/* 七日 (plan 135): the week ahead, at the column's foot. */}
          {!run && <WeekAhead />}
        </DeskSide>
      )}
    </main>
  )
}
