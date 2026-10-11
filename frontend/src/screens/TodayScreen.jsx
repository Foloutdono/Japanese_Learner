import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useTodaySummary, refreshToday } from '../stores/today'
import { useProfileSummary } from '../stores/profileSummary'
import { markRestSeen, restNoticeSeen } from '../stores/dayClear'
import GateCard from '../components/station/GateCard'
import PassStrip from '../components/station/PassStrip'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import Empty from '../components/ui/Empty'
import { useDesk } from '../hooks/useDesk'
import { DeskSide } from '../components/chrome/DeskSide'
import RestDayNotice from '../components/dayclear/RestDayNotice'
import { InkFilters } from '../components/dayclear/kit'
import { restWeek, utcToday } from '../domain/dayClear'
import { JourneyPanel } from '../components/journey/JourneyPanel'
import { WeekAhead } from '../components/journey/WeekAhead'
import { AgendaNext } from '../components/agenda/AgendaNext'
import { useAgenda } from '../stores/agenda'
import { useMinute } from '../hooks/useMinute'

// ── 本日 — the gate (plan 070) ────────────────────────────────
// The Today tab: the bar, the pass at strip size, and under it the
// fare gate with the day's lanes as the run's picker. The run itself
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
  // 時間割 (plan 181): what is next on the learner's agenda, read once a
  // minute so a block starting while the gate is open is seen starting.
  const { blocks } = useAgenda()
  const now = useMinute()

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
  const depart = () => {
    markRestSeen(session, restKey)
    setRestLeft(true)
    navigate('/today/run')
  }
  const restMinutes = today?.seconds_per_review && today?.total
    ? Math.max(1, Math.ceil((today.total * today.seconds_per_review) / 60))
    : null

  return (
    <main id="main-content" className="today">
      {/* No bar: the gate's head (本日 · Today · the date) came off the
          four gates on the owner's call (2026-09-20, see LearnScreen.jsx).
          The name stays as the screen's clipped <h1>. */}
      <h1 className="sr-only">{t.todayTitle}</h1>

      {showRest ? (
        <>
          <InkFilters />
          <RestDayNotice
            rest={today.rest}
            week={restWeek(summary?.week, today.rest.unseen, utcToday())}
            total={today.total}
            lanes={today.lanes}
            minutes={restMinutes}
            desk={desk}
            onDepart={depart}
          />
        </>
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
      {guide.open && !showRest && <Guide gate="today" onEnd={guide.onEnd} />}
      {/* 机 — the desk (plan 114): the gate is the work, and beside it
          what the work is FOR — the pass at strip size (the week, the
          streak, the day's new items) and the pass's back, the journey
          it is on: how far along, how far behind the promise, and the
          two honest moves when behind. On a phone the strip heads the
          gate and the back is a tap on the HUD away. */}
      {desk && (
        <DeskSide label={t.passLabel}>
          <PassStrip pace={today?.pace} />
          {/* What is next on the agenda, and the two blocks after it:
              the hour's business before the journey's. */}
          {blocks?.length > 0 && <AgendaNext blocks={blocks} now={now} open then={2} />}
          <JourneyPanel session={session} />
          {/* 七日 (plan 135): the week ahead, at the column's foot. */}
          <WeekAhead />
        </DeskSide>
      )}
    </main>
  )
}
