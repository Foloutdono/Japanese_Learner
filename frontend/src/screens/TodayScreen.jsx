import { startTransition, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useTodaySummary, refreshToday } from '../stores/today'
import { useProfileSummary } from '../stores/profileSummary'
import { comebackShut, markRestSeen, restNoticeSeen } from '../stores/dayClear'
import GateCard from '../components/station/GateCard'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import Empty from '../components/ui/Empty'
import { useDesk } from '../hooks/useDesk'
import RestDayNotice from '../components/dayclear/RestDayNotice'
import { ComebackSheet } from '../components/station/ComebackSheet'
import { InkFilters } from '../components/dayclear/kit'
import { restWeek, utcToday } from '../domain/dayClear'

// ── 本日 — the gate (plan 070) ────────────────────────────────
// The Today tab: the fare gate, the day's lanes as the run's picker.
// Since plan 199 (the canvas "Tsuji — Today at a glance") the gate is
// the whole screen at either width: the day as a dial, the run's
// choices and the day's figures a tap away on a phone and in the
// gate's own column on the desk (GateCard). The pass's strip, the
// agenda's card and the journey's panel that stood over or beside it
// went: the HUD carries the journey and the balance, the rail's holder
// too, and the sheet and the column the rest. The run itself
// is /today/run on the stage (screens/TodayRun.jsx); since plan 191 it
// finishes on /today/clear (screens/DayClearScreen.jsx, the day
// cleared or the partial finish), which comes back here with nothing:
// the finish this screen used to print (RunComplete, the fare slip)
// retired with it.
//
// 運休 (plan 191): the morning after a missed day a rest day covered,
// the gate gives way once to the notice saying so (RestDayNotice) --
// while Today's summary names a rest day not yet seen (`rest.unseen`).
// Any way out tells the server it was seen.
//
// 運転再開 (plan 216): a gate whose reviews piled up past a few days of
// the learner's own load opens on the comeback sheet (ComebackSheet),
// over the gate and after the rest-day notice, never with it: the
// paces to take the backlog at, chosen once.
//
// Everything this screen reads is shared: /api/today from the store
// the tab bar's badge already reads. One request, every consumer.

export default function TodayScreen({ session }) {
  const { t } = useLang()
  const desk = useDesk()
  const navigate = useNavigate()
  const { data: today, failed } = useTodaySummary()
  const summary = useProfileSummary()
  // 案内 — the gate's guide, once, after the lanes have painted (plan 100).
  const guide = useGuide('today', Boolean(today) || failed)

  // 運休 — the rest days the learner has not been told of, once.
  const restKey = (today?.rest?.unseen ?? []).join(',')
  const [restLeft, setRestLeft] = useState(false)
  const showRest = restKey !== '' && !restLeft && !restNoticeSeen(restKey)
  // Seen the moment the notice leaves, whichever way: deferred a tick so
  // StrictMode's rehearsed unmount (and a remount) cancels it.
  const leaving = useRef(null)
  useEffect(() => {
    if (!showRest) return undefined
    clearTimeout(leaving.current)
    return () => { leaving.current = setTimeout(() => markRestSeen(session, restKey), 0) }
  }, [showRest, restKey, session])
  // The notice gives way to the run, not to the gate: the router moves
  // in a transition, so leaving the notice outside it drew the gate (and
  // fetched its print, plan 205) for a beat before the run took over.
  const depart = () => {
    markRestSeen(session, restKey)
    startTransition(() => {
      setRestLeft(true)
      navigate('/today/run')
    })
  }
  // 運転再開 — the comeback offer, until it is answered or shut.
  const [comebackLeft, setComebackLeft] = useState(false)
  const offer = today?.review?.comeback ?? null
  const showComeback = Boolean(offer) && !showRest && !comebackLeft && !comebackShut()
  const restMinutes = today?.seconds_per_review && today?.total
    ? Math.max(1, Math.ceil((today.total * today.seconds_per_review) / 60))
    : null

  return (
    <main id="main-content" className="today">
      {/* No bar: the gate's head (本日 · Today · the date) came off the
          four gates on the owner's call (2026-09-20, see LearnScreen.jsx).
          The name stays as the screen's clipped <h1>. */}
      <h1 className="sr-only">{t.todayTitle}</h1>

      {/* The seal and the stamps' ink, for the rest notice and the
          cleared gate (plan 191's kit, plan 199). */}
      <InkFilters />
      {showRest ? (
        <RestDayNotice
          rest={today.rest}
          week={restWeek(summary?.week, today.rest.unseen, utcToday())}
          total={today.total}
          lanes={today.lanes}
          minutes={restMinutes}
          desk={desk}
          onDepart={depart}
        />
      ) : failed && !today ? (
        <Empty
          tone="error"
          message={t.errorTitle}
          hint={t.errorHint}
          action={{ label: t.tryAgain, onClick: refreshToday }}
        />
      ) : (
        <GateCard today={today} failed={failed && !today} />
      )}
      {showComeback && (
        <ComebackSheet
          offer={offer}
          secondsPerReview={today.seconds_per_review}
          session={session}
          onClose={() => setComebackLeft(true)}
        />
      )}
      {guide.open && !showRest && !showComeback && <Guide gate="today" onEnd={guide.onEnd} />}
    </main>
  )
}
