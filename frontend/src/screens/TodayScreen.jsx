import { startTransition, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useTodaySummary, refreshToday } from '../stores/today'
import { useProfileSummary } from '../stores/profileSummary'
import { finishShown, markRestSeen, restNoticeSeen, useDayClear } from '../stores/dayClear'
import { useFinishScreen } from '../components/dayclear/useFinish'
import { useReducedMotion } from '../components/dayclear/useReducedMotion'
import { XpToast } from '../components/rewards/XpToast'
import GateCard from '../components/station/GateCard'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import { useGuideHeld, wasShown } from '../stores/guide'
import Empty from '../components/ui/Empty'
import { useDesk } from '../hooks/useDesk'
import RestDayNotice from '../components/dayclear/RestDayNotice'
import { TransferSheet } from '../components/station/TransferSheet'
import { RatingSheet } from '../components/feedback/RatingSheet'
import { DuelsNewsSheet } from '../components/pvp/DuelsNewsSheet'
import { AccountSheet } from '../components/boarding/CardSheets'
import { noteAskedToKeep, shouldAskToKeep } from '../lib/guest'
import { useClaimOffer, usePaywall } from '../stores/credits'
import { InkFilters } from '../components/dayclear/kit'
import { restWeek, utcToday } from '../domain/dayClear'
import { startAmbiance, stopAmbiance } from '../lib/audio'

// ── 本日 — the gate (plan 070) ────────────────────────────────
// The Today tab: the fare gate, the day's lanes as the run's picker.
// Since plan 199 (the canvas "Tsuji — Today at a glance") the gate is
// the whole screen at either width: the day as a dial, the run's
// choices and the day's figures a tap away on a phone and in the
// gate's own column on the desk (GateCard). The pass's strip, the
// agenda's card and the journey's panel that stood over or beside it
// went: the HUD carries the journey and the balance, the rail's holder
// too, and the sheet and the column the rest. The run itself
// is /today/run on the stage (screens/TodayRun.jsx).
//
// 終着 (plan 250): the run finishes here, on /today/clear, its tally in
// the router's state. The screen asks the server once whether it
// cleared the day (stores/dayClear) and plays the answer on the gate
// itself (components/dayclear/useFinish, GateCard's `finish`): on a
// phone as a run's stage until its chrome beat, the bars then drawn
// back in; the fare said on the pass at its beat; the URL /today once
// it rests. A tap, a click or Enter skips to the rest. A reload does not
// replay it (finishShown): the gate as it stands.
//
// 運休 (plan 191): the morning after a missed day a rest day covered,
// the gate gives way once to the notice saying so (RestDayNotice) --
// while Today's summary names a rest day not yet seen (`rest.unseen`).
// Any way out tells the server it was seen.
//
// 運転再開 (plan 217): a gate whose reviews piled up past a few days of
// the learner's own load says so in a notice on the gate itself, which
// opens the paces to take the backlog at -- the gate's business
// (station/ComebackLine), never a sheet over it since plan 254, and
// never with the rest-day notice, which stands in the gate's place.
//
// 乗換 (plan 243b): a learner new to the app is asked once, after the
// first ride and the gate's guide and never over the rest-day notice,
// whether they studied in another app (TransferSheet), while the
// profile says the offer is open (`transferOffer`).
//
// Early access (plan 269): once the learner has earned 400 XP, they are
// asked how they find the app (RatingSheet), on the same terms as the
// offer above and never beside it, while the profile says it is open
// (`feedbackOffer`). The finish comes first: the question follows a day
// cleared, never interrupts it.
//
// 新しい (plan 287): a learner who met Today before the duels' key stood
// beside its gate is told of it once (DuelsNewsSheet), while the profile
// says so (`duelsNews`), after the offers above and never beside them,
// and never on the visit whose guide has just shown the key.
//
// 本乗車券 (plan 270): a guest is asked to make the card an account --
// Google, or an address and a password -- further and further apart (a
// day, two, four, a week, two weeks, a month, then never: lib/guest.js),
// after the guide, the transfer offer and the early-access question have
// had their turn, and never over another sheet. « Continuer en invité »
// is always the way past it.
//
// Everything this screen reads is shared: /api/today from the store
// the tab bar's badge already reads. One request, every consumer.
//
// 湖の刻 (plan 219): the gate stands on the print of the hour, and the
// print is heard: the ambiance plays the same hour's lake behind it,
// as it does behind every station page (SelectionScreen).

export default function TodayScreen({ session }) {
  const { t } = useLang()
  const desk = useDesk()
  const navigate = useNavigate()
  const { pathname, state: routed } = useLocation()
  const { data: today, failed } = useTodaySummary()
  const summary = useProfileSummary()

  // 終着 — the run's finish, taken from the router once.
  const [run] = useState(() => {
    const handed = pathname === '/today/clear' ? routed?.run ?? null : null
    return handed && !finishShown(handed) ? handed : null
  })
  const clear = useDayClear(run, session)
  const reduced = useReducedMotion()
  const fin = useFinishScreen({
    run, clear, desk, reduced,
    // At rest the finish is Today's: Back from here does not replay it.
    onEnd: () => navigate('/today', { replace: true, state: null }),
  })
  const finishing = Boolean(run) && !fin.ended
  // A finish with no run to finish (a reload, a typed address) is the gate's.
  useEffect(() => {
    if (pathname === '/today/clear' && !run) navigate('/today', { replace: true, state: null })
  }, [pathname, run, navigate])

  // 案内 — the gate's guide, once, after the lanes have painted (plan 100).
  const guide = useGuide('today', (Boolean(today) || failed) && !finishing)

  useEffect(() => {
    startAmbiance()
    return () => stopAmbiance()
  }, [])

  // 運休 — the rest days the learner has not been told of, once.
  const restKey = (today?.rest?.unseen ?? []).join(',')
  const [restLeft, setRestLeft] = useState(false)
  const showRest = restKey !== '' && !restLeft && !restNoticeSeen(restKey) && !run
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
  // 乗換 — the offer to bring another app's progress, once: after the
  // gate's guide has had its turn (stamped, or shown on this visit) and
  // while nothing holds the guides, so the two never meet.
  const [transferLeft, setTransferLeft] = useState(false)
  const held = useGuideHeld()
  const showTransfer = Boolean(summary?.transferOffer) && !transferLeft && Boolean(today)
    && (summary.guided?.today || wasShown('today')) && !guide.open && !held && !showRest && !finishing
  const [rateLeft, setRateLeft] = useState(false)
  const showRate = Boolean(summary?.feedbackOffer) && !rateLeft && Boolean(today)
    && (summary.guided?.today || wasShown('today')) && !guide.open && !held && !showRest && !finishing
    && !showTransfer
  const [newsLeft, setNewsLeft] = useState(false)
  const showNews = Boolean(summary?.duelsNews) && !newsLeft && Boolean(today)
    && Boolean(summary.guided?.today) && !wasShown('today') && !guide.open && !held && !showRest && !finishing
    && !showTransfer && !showRate
  // Read once, at mount: the visit that asks keeps the sheet up.
  const [keepAsk] = useState(() => shouldAskToKeep(session))
  const [keepLeft, setKeepLeft] = useState(false)
  const [keepSent, setKeepSent] = useState(null)
  const claimOffer = useClaimOffer()
  const paywall = usePaywall()
  const showKeep = keepAsk && !keepLeft && Boolean(today)
    && (summary?.guided?.today || wasShown('today')) && !guide.open && !held && !showRest && !finishing
    && !showTransfer && !showRate && !showNews && !claimOffer && !paywall
  const keepUserId = session?.user?.id
  useEffect(() => {
    if (showKeep) noteAskedToKeep(keepUserId)
  }, [showKeep, keepUserId])
  const leaveKeep = () => setKeepLeft(true)
  const restMinutes = today?.seconds_per_review && today?.total
    ? Math.max(1, Math.ceil((today.total * today.seconds_per_review) / 60))
    : null

  return (
    <main
      id="main-content"
      className={run ? 'today today--fin' : 'today'}
      // A tap skips the finish to its rest, and does nothing else.
      onClickCapture={fin.onClickCapture}
    >
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
      ) : (failed && !today) || clear.status === 'error' ? (
        <Empty
          tone="error"
          message={t.errorTitle}
          hint={t.errorHint}
          action={{ label: t.tryAgain, onClick: clear.status === 'error' ? clear.retry : refreshToday }}
        />
      ) : (
        <GateCard today={today} failed={failed && !today} session={session} finish={run ? fin : null} />
      )}
      {fin.toast && <XpToast toast={fin.toast} onDone={() => {}} />}
      {guide.open && !showRest && <Guide gate="today" onEnd={guide.onEnd} />}
      {showTransfer && (
        <TransferSheet session={session} onClose={() => setTransferLeft(true)} />
      )}
      {showRate && (
        <RatingSheet session={session} onClose={() => setRateLeft(true)} />
      )}
      {showNews && (
        <DuelsNewsSheet session={session} onClose={() => setNewsLeft(true)} />
      )}
      {showKeep && (
        <AccountSheet
          open
          onClose={leaveKeep}
          onGuest={leaveKeep}
          onKept={leaveKeep}
          onSent={setKeepSent}
          sent={keepSent}
        />
      )}
    </main>
  )
}
