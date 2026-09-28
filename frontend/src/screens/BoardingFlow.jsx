import { useEffect, useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { ApiError, apiFetch, apiJson, apiJsonWithTimeout } from '../lib/api'
import { canNudge, requestNudgePermission } from '../lib/platform'
import { track } from '../lib/track'
import { stopwatch } from '../lib/dwell'
import { refreshSummary } from '../stores/profileSummary'
import { refreshCredits } from '../stores/credits'
import { USERNAME_RE } from '../components/profile/EditableUsername'
import { TrainArrival } from '../components/onboarding/TrainArrival'
import { DEPART_TIMES } from '../components/onboarding/departures'
import {
  LINES, RECOMMENDED_RHYTHM, boardingDraft, bucketFor, goalStops, itemsForRhythm, kanaFigures,
  levelAnswers, levelForKana, minutesToTime, planFigures, stopsAhead, timeToMinutes,
} from '../domain/boarding'
import { BoardHead } from '../components/boarding/BoardFrame'
import { useBoardKeys } from '../hooks/useBoardKeys'
import { useDesk } from '../hooks/useDesk'
import { useBoxWidth } from '../hooks/useBoxWidth'
import NameStep from '../components/boarding/NameStep'
import WhyStep from '../components/boarding/WhyStep'
import { KanaStep, KanaReveal } from '../components/boarding/KanaStep'
import { LevelStep, GoalStep } from '../components/boarding/LevelStep'
import LinesStep from '../components/boarding/LinesStep'
import RhythmStep from '../components/boarding/RhythmStep'
import TimeStep from '../components/boarding/TimeStep'
import NudgeStep from '../components/boarding/NudgeStep'
import Building from '../components/boarding/Building'
import { DeskStrip } from '../components/boarding/DeskStrip'
import { BoardBack } from '../components/boarding/boardBack'
import PlanStep from '../components/boarding/PlanStep'
import PassStep from '../components/boarding/PassStep'
import AccountStep from '../components/boarding/AccountStep'

// ── 乗車 — the boarding (plan 075) ────────────────────────────────
// The canvas's boarding, the owner's sketch drawn: name → why → the
// kana check → (the reveal | the level) → goal → the lines → rhythm →
// the hour → (the nudge, native only) → building → the plan → (the
// account) → the pass. Welcome is step zero (components/boarding/Welcome.jsx,
// mounted by App.jsx in place of the old landing page); the offer
// stays out while domain/credits.js's HAS_STORE is false.
//
// The account is asked for at the END, and refusably. Boarding starts
// on a guest pass — a real Supabase user with no credentials on it, so
// every question here writes to real server-side state (lib/guest.js
// explains why that is a whole account rather than a local shadow) —
// and `account` offers to put an email and a password onto the very
// row the learner has been filling in. Nothing is migrated because
// nothing moved. A learner who says no rides on exactly as they were.
// The step is skipped for anyone who already has real credentials,
// which is how an interrupted sign-up resumes without being asked
// twice.
//
// `onExit` is the way back OUT of the first question: back on step one
// has nowhere to go inside the flow, so it leaves for Welcome, where
// the sign-in is. `onSignIn` is the same door named directly, offered
// on the name screen and again at the account step, so a returning
// learner who tapped Embarquer by mistake is one tap from where they
// meant to be.
//
// The track at the head is the progress bar -- one stop per question,
// the train where you are; the three arrival screens have no track and
// no back. Back keeps every answer and exists until the plan is built.
// Nothing persists until the single POST /api/onboarding/complete on
// "Enter the station" (the name is the one exception: it is the pass
// holder's, written the moment the office accepts it, so a taken name
// is refused on its own screen and never on the pass). A mid-flow
// refresh is a clean restart. The TicketGate finale is rendered by
// App, not here: this component unmounts the moment onComplete flips
// the gate state, and a cutscene rendered by the thing it unmounts
// would pop mid-wipe.
//
// Between screens the train pulls: the leaving screen slides left as
// the next arrives from the right, 260 ms ease-out, and back runs it
// in reverse. The leaving screen stays mounted for the pull (the
// `--out` car, inert) and is dropped after it. Under reduced motion no
// car moves and only the rest state is drawn (index.css kills every
// brd animation there too).
//
// `dryRun` is the dev workbench's hook (/dev/onboarding): the whole
// flow, the real volumes, and no write -- neither the name nor the
// contract.

// ── The stash — surviving an OAuth redirect ──────────────────────
// Signing in with Google on the WEB navigates the page away and comes
// back as a fresh load, which would otherwise mean answering all eight
// questions again for the crime of choosing the fast way to keep them.
// So the answers are written down at exactly the moment the redirect
// is about to happen, and picked back up on the next mount.
//
// sessionStorage, not local: the stash belongs to this tab and this
// attempt. Cleared the instant it is read, and again when the contract
// is signed, so a later boarding can never resume someone else's.
// Deliberately NOT a general autosave — a mid-flow refresh is still a
// clean restart, which is the behaviour every other screen here was
// written against.
const STASH_KEY = 'jp-boarding-stash'

function stash(state) {
  try { sessionStorage.setItem(STASH_KEY, JSON.stringify(state)) } catch { /* private mode */ }
}

function takeStash() {
  try {
    const raw = sessionStorage.getItem(STASH_KEY)
    sessionStorage.removeItem(STASH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearStash() {
  try { sessionStorage.removeItem(STASH_KEY) } catch { /* private mode */ }
}

const PULL_MS = 260
// 机 (plan 155): the desk's pull is a short one -- a rung sideways and a
// fade, not the paper's whole width -- and the arriving car's answers
// follow it in a beat apart (the 机 section of index.css, "the pull on
// the desk"). The leaving car is kept until all of that has landed:
// dropping it at the phone's 260 ms took the arriving car's `--in` with
// it, and the answers still on their way snapped the rest of it.
const DESK_PULL_MS = 820
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const DEFAULT_TIME = DEPART_TIMES.am

// The answered stops, in line order -- the track's stops. Which branch
// the kana check takes and whether a goal exists depend on answers
// given later, so the count reads the answers so far.
function trackStops(answers) {
  const branch = answers.kana === 'both' ? 'level' : 'reveal'
  const goal = answers.jlpt == null || stopsAhead(answers.jlpt).length > 0
  return [
    'name', 'why', 'kana', branch,
    ...(goal ? ['goal'] : []),
    'lines', 'rhythm', 'time',
    ...(canNudge() ? ['nudge'] : []),
  ]
}

export default function BoardingFlow({
  session, initialProfile, onComplete, onExit = null, onSignIn = null,
  guest = false, dryRun = false,
}) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const profile = { level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100, username: '', ...(initialProfile ?? {}) }

  // Read once, in the initialiser rather than an effect: the flow must
  // never paint question one before resuming the step it left from.
  const [resumed] = useState(takeStash)

  const [answers, setAnswers] = useState({
    name: profile.username ?? '',
    motive: null,
    kana: null,
    levelChoice: null,   // 'novice' | 'N5'..'N1' on the level list
    jlpt: null,          // the level the office stores
    goal: null,
    lines: LINES,        // what to learn: any of vocab / kanji / grammar
    rhythm: RECOMMENDED_RHYTHM,
    minute: timeToMinutes(DEFAULT_TIME),
    notifications: false,
    ...(resumed?.answers ?? {}),
  })
  // The account step is the one the stash can come back to having
  // ANSWERED: on the web the Google button leaves the page, and a round
  // trip that worked returns a learner who is no longer a guest — the
  // button's own onDone never runs, because the component that would
  // have called it was unmounted by the navigation. Resuming onto
  // "Keep your progress." after they just kept it reads as the sign-in
  // having done nothing, which is exactly what it looked like. So the
  // resumed step is honoured only while there is still something to
  // offer; the same predicate the forward path uses (`plan` → account
  // or pass).
  //
  // On the desk the pass's screen folds into the plan (plan 140), so the
  // same return lands on the plan, which then carries Enter the station.
  const [step, setStep] = useState(() => {
    const at = resumed?.step ?? 'name'
    if (at === 'account' && !guest) return desk ? 'plan' : 'pass'
    return at
  })
  const [history, setHistory] = useState([])
  const [leaving, setLeaving] = useState(null)   // { step, dir } during a pull
  const [volumes, setVolumes] = useState(null)
  const [savedName, setSavedName] = useState(resumed?.savedName ?? profile.username ?? '')
  const [nameError, setNameError] = useState(null)
  const [busy, setBusy] = useState(false)
  // null | 'network' | 'refused' -- which of the two the pass says.
  const [saveError, setSaveError] = useState(null)
  const [arrival, setArrival] = useState(false)
  const [now] = useState(() => new Date())
  const frameRef = useRef(null)
  // 辻 (plan 161): the strip at the floor's left end, measured so the
  // floor gives way before it (--desk-strip-w).
  const [stripRef, stripW] = useBoxWidth(desk)
  const arrivalPlayed = useRef(REDUCED)
  // Two stopwatches counting only time the tab was actually looked at
  // (lib/dwell.js): one lapped at every question, one for the whole
  // line. Wall-clock would say a boarding left open over lunch took an
  // hour to choose a study rhythm, and a handful of those makes "which
  // question stalls people" unanswerable. Built in an effect, not in
  // render — each attaches a listener, and StrictMode would double it.
  const watches = useRef(null)

  const set = patch => setAnswers(a => ({ ...a, ...patch }))
  // 机 (plan 122): Enter goes on from anywhere in the live car.
  useBoardKeys(frameRef, { off: arrival })

  useEffect(() => {
    document.title = `${t.brdDocumentTitle} — ${t.appTitle}`
  }, [t])

  useEffect(() => {
    watches.current = { total: stopwatch(), step: stopwatch() }
    const w = watches.current
    return () => { w.total.stop(); w.step.stop(); watches.current = null }
  }, [])

  // The volumes price the level list and the plan; the canvas's round
  // figures stand in until they arrive, and a failed fetch leaves the
  // plan's date to the office (the POST then carries no date).
  useEffect(() => {
    let live = true
    apiJson('/api/onboarding/volumes', session)
      .then(v => { if (live) setVolumes(v) })
      .catch(() => {})
    return () => { live = false }
  }, [session])

  // The pull: the leaving car is dropped once it has left.
  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(() => setLeaving(null), desk ? DESK_PULL_MS : PULL_MS)
    return () => clearTimeout(id)
  }, [leaving, desk])

  // Focus lands on the new screen's question -- except on the name,
  // whose field is already focused and must keep the keyboard.
  useEffect(() => {
    if (step === 'name') return
    const q = frameRef.current?.querySelector('.brd__car:not(.brd__car--out) .brd__q')
    q?.focus({ preventScroll: true })
  }, [step])

  // 足跡 — every transition in the boarding runs through these two, so
  // instrumenting them is the whole of it. Until now this flow wrote
  // NOTHING until POST /api/onboarding/complete at the very end, which
  // made the one thing worth knowing -- where people give up on the way
  // in -- the one thing invisible. There is no "abandoned" event and
  // there does not need to be: it is a boarding_step with no
  // boarding_done after it.
  //
  // (`track` here is the analytics seam, lib/track.js. `trackStops`
  // above is the railway kind. The collision is unfortunate and the
  // metaphor is older, so the import keeps the shorter name.)
  function mark(from, to, dir) {
    track('boarding_step', {
      step: from, to, dir,
      // How long `from` actually held them, then reset for the next
      // question. Read here because this is the one place that knows a
      // question is being left.
      ms: watches.current?.step.lap() ?? 0,
      // trackStops() rather than the `stops` const below: this is
      // called from a handler, and computing it here keeps the two
      // independent of declaration order.
      index: trackStops(answers).indexOf(from) + 1,
    })
  }

  function go(next) {
    mark(step, next, 'fwd')
    setHistory(h => [...h, step])
    if (!REDUCED) setLeaving({ step, dir: 'fwd' })
    setStep(next)
  }

  function back() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    mark(step, prev, 'back')
    setHistory(h => h.slice(0, -1))
    if (!REDUCED) setLeaving({ step, dir: 'back' })
    setStep(prev)
  }

  // 机 (plan 140): a stop already passed on the line is a door straight
  // back to its question -- Back pressed as many times as it takes, in
  // one pull. Every answer is kept, as Back keeps them. Since plan 161
  // the line is the strip at the floor's left end.
  function jumpTo(target) {
    const at = history.lastIndexOf(target)
    if (at < 0) return
    mark(step, target, 'back')
    setHistory(h => h.slice(0, at))
    if (!REDUCED) setLeaving({ step, dir: 'back' })
    setStep(target)
  }

  // ── The browser's Back (plan 123) ────────────────────────────
  // The flow changes screens through state alone, so the browser's
  // Back -- Alt+←, a mouse's side button, a phone's back gesture --
  // left Tsuji from question 8, and coming back was a fresh load at
  // question 1 with the answers gone. One guard entry stands in the
  // browser's history exactly while the flow has a question behind it:
  // Back pops the guard and steps back one question, and the guard is
  // put back while more remain. It is taken out again (history.back(),
  // its pop ignored) the moment none do -- ‹ back to the first
  // question, or the plan being built -- so by the time the router
  // mounts no dead entry is left, and returnToFrontDoor still replaces
  // the entry the flow began on. From the first question Back leaves,
  // as it always has.
  const guard = useRef(false)
  const ignorePop = useRef(false)
  const backRef = useRef(back)
  useEffect(() => { backRef.current = back })
  useEffect(() => {
    function onPop() {
      if (ignorePop.current) { ignorePop.current = false; return }
      if (!guard.current) return
      guard.current = false
      backRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const depth = history.length
  useEffect(() => {
    try {
      if (depth > 0 && !guard.current) {
        window.history.pushState({ brd: true }, '')
        guard.current = true
      } else if (depth === 0 && guard.current) {
        guard.current = false
        ignorePop.current = true
        window.history.back()
      }
    } catch { /* a browser refusing the history API: Back leaves, as before */ }
  }, [depth])

  // ── The answers ──────────────────────────────────────────────
  function continueName() {
    const name = answers.name.trim()
    if (!USERNAME_RE.test(name)) { setNameError(t.usernameInvalid); return }
    if (name === savedName || dryRun) { setNameError(null); go('why'); return }
    setBusy(true)
    setNameError(null)
    apiFetch('/api/profile', session, { method: 'PATCH', body: JSON.stringify({ username: name }) })
      .then(r => {
        if (r.status === 409) throw new Error(t.usernameTaken)
        if (!r.ok) throw new Error(t.genericError)
        setSavedName(name)
        go('why')
      })
      .catch(err => setNameError(err.message || t.genericError))
      .finally(() => setBusy(false))
  }

  // The learner's own CHOICE decides the goal list; the office stores
  // the JLPT level it maps to. The two differ for exactly one answer —
  // the novice, who is stored at N5 but has not passed it, so N5 is the
  // first stop AHEAD of them rather than the one behind. The kana
  // answer decides one more thing: a learner who cannot read both
  // scripts has not reached the novice's stop either, so it heads
  // their list as a destination they can take (goalStops).
  //
  // The default stays the nearest JLPT stop it has always been. The
  // novice's stop is an offer rather than a preselection: it is a real
  // destination (the office signs it, the pass measures it in kana),
  // but which one to ride to is the learner's call to make rather than
  // the flow's to make for them.
  function afterLevel(choice, kana) {
    set(levelAnswers(choice, kana))
    return goalStops(choice, kana).length > 0 ? 'goal' : 'lines'
  }

  function answerKana(kana) {
    const choice = levelForKana(kana)
    if (choice) {
      set({ kana })
      afterLevel(choice, kana)
      go('reveal')
    } else {
      set({ kana })
      go('level')
    }
  }

  function continueReveal() {
    go(afterLevel(answers.levelChoice ?? 'novice', answers.kana))
  }

  function continueLevel() {
    go(afterLevel(answers.levelChoice, answers.kana))
  }

  function continueTime() {
    if (canNudge()) go('nudge')
    else toBuilding()
  }

  function buildingDone() {
    if (!arrivalPlayed.current) { arrivalPlayed.current = true; setArrival(true) }
    setHistory([])
    setStep('plan')
  }

  // 机 (plan 122, owner's call): no Building on the desk. Its one job --
  // gathering the answers into the journey -- is done by every question
  // as it is answered, and the strip (below) holds them; the plan arrives
  // straight after the hour, under the same signboard. The funnel reads
  // time → plan there.
  function toBuilding() {
    if (!desk) { go('building'); return }
    mark(step, 'plan', 'fwd')
    buildingDone()
  }

  // ── The contract ─────────────────────────────────────────────
  const jlpt = answers.jlpt ?? 'N5'
  // What the learner said they are, as they said it: the novice is
  // stored at N5 and must not be printed as one — they are boarding
  // before that stop, not at it.
  const levelLabel = answers.levelChoice === 'novice' ? t.brdNovice : jlpt
  // The ride, as the building screen prints it. The novice's stop taken
  // as a GOAL is where the ride ENDS -- the learner is short of it, not
  // standing on it -- so the destination stands alone rather than
  // joining "Novice → Novice".
  const goalLine = answers.goal === 'novice'
    ? t.brdNovice
    : answers.goal ? `${levelLabel} → ${answers.goal}` : levelLabel
  const perDay = itemsForRhythm(answers.rhythm)
  const figures = planFigures(volumes, jlpt, answers.goal, perDay, answers.kana, now, answers.lines)
  const time = minutesToTime(answers.minute)
  // 辻 (plan 161): the month the goal picked is reached in, hung over it
  // on the desk's line -- once the volumes that price it have answered.
  const arrivalMonth = desk && volumes
    ? new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(figures.date)
    : null
  // And the reveal's first stop -- the kana still unread, at the ride's
  // pace (the recommended one, until it is asked).
  const kanaStop = desk && volumes
    ? {
        date: new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
          .format(kanaFigures(volumes, answers.kana, perDay, now).date),
        min: answers.rhythm,
      }
    : null
  // The lines as the building screen prints them: the kana first --
  // every ticket rides them -- then the ones chosen.
  const linesLine = [t.kanaTitle, ...answers.lines.map(line => t.brdLine[line])].join(' · ')

  function complete() {
    if (busy) return
    if (dryRun) { onComplete(); return }
    setBusy(true)
    setSaveError(null)
    const fresh = planFigures(volumes, jlpt, answers.goal, perDay, answers.kana, new Date(), answers.lines)
    const body = {
      jlptLevel: jlpt,
      dailyNewTarget: perDay,
      // The novice's stop rides in this field like any JLPT one: the
      // office stores it (routes/onboarding.py GOAL_LEVELS), and the
      // pass then measures the promise in kana.
      ...(answers.goal ? { goalLevel: answers.goal } : {}),
      ...(answers.goal && volumes ? { goalTargetDate: fresh.date.toISOString().slice(0, 10) } : {}),
      dailyDeparture: bucketFor(answers.minute),
      motive: answers.motive,
      kanaKnown: answers.kana,
      // The lines to ride (backend core/lines.py): the plates' order,
      // the promise's price, the ghost train's scope.
      lines: answers.lines,
      rhythmMin: answers.rhythm,
      reminderTime: time,
      notifications: answers.notifications,
      tzOffsetMin: -new Date().getTimezoneOffset(),
    }
    apiJsonWithTimeout('/api/onboarding/complete', session, {
      method: 'POST',
      timeoutMs: 10000,
      body: JSON.stringify(body),
    })
      .then(() => {
        clearStash()
        // The far end of the funnel every boarding_step above measures.
        // The answers, not the name or the hour: `motive` is the one
        // field that says WHY someone is here, and it is the most
        // useful thing the app knows about a learner it has just met.
        track('boarding_done', {
          motive: answers.motive,
          kana_known: answers.kana,
          level: jlpt,
          pace: perDay,
          // The chosen names joined, never text a learner typed.
          lines: answers.lines.join(','),
          notifications: answers.notifications,
          // The same measure across the whole line: does the boarding
          // as a whole ask for too much of someone's evening?
          ms: watches.current?.total.read() ?? 0,
        })
        // The gate reads the profile summary for the pass holder's
        // name and the HUD reads the balance -- refresh both before the
        // cutscene mounts. Fire-and-forget: both stores fail quietly.
        refreshSummary()
        refreshCredits()
        onComplete()
      })
      .catch(err => {
        setBusy(false)
        // An ApiError means the office ANSWERED and refused the
        // contract; anything else -- a dead fetch, the timeout's own
        // abort -- never reached it. The pass said "check your
        // connection" for both, which on a 422 sent a learner to look
        // at a connection that was plainly working, on the one screen
        // that has no other way forward (2026-09-09).
        setSaveError(err instanceof ApiError ? 'refused' : 'network')
      })
  }

  // ── The screens ──────────────────────────────────────────────
  const stops = trackStops(answers)
  const onTrack = stops.includes(step)
  const index = stops.indexOf(step) + 1
  const total = stops.length
  const displayName = answers.name.trim() || savedName || profile.username || ''
  // The strip's stops (the reveal is the kana's own, not a stop), and
  // the number a question's hub prints on the desk: its place on them.
  const lineStops = stops.filter(key => key !== 'reveal')
  const hubNo = key => String(lineStops.indexOf(key) + 1).padStart(2, '0')

  function renderStep(key) {
    switch (key) {
      case 'name':
        return (
          <NameStep
            value={answers.name}
            onChange={v => { set({ name: v }); setNameError(null) }}
            onContinue={continueName}
            onSignIn={onSignIn}
            // Whose pass this is, when it is anybody's: a guest has no
            // address and the line stays off. See NameStep.
            email={session?.user?.email ?? null}
            error={nameError}
            busy={busy}
          />
        )
      case 'why':
        return <WhyStep name={displayName} value={answers.motive} onChange={v => set({ motive: v })} onContinue={() => go('kana')} no={hubNo('why')} />
      case 'kana':
        return <KanaStep value={answers.kana} onAnswer={answerKana} />
      case 'reveal':
        return <KanaReveal onContinue={continueReveal} first={kanaStop} />
      case 'level':
        return <LevelStep volumes={volumes} value={answers.levelChoice} onChange={v => set({ levelChoice: v })} onContinue={continueLevel} no={hubNo('level')} />
      case 'goal':
        return (
          <GoalStep
            volumes={volumes}
            level={answers.levelChoice ?? jlpt}
            kana={answers.kana}
            value={answers.goal}
            onChange={v => set({ goal: v })}
            onContinue={() => go('lines')}
            arrival={arrivalMonth}
            no={hubNo('goal')}
          />
        )
      case 'lines':
        return <LinesStep value={answers.lines} onChange={v => set({ lines: v })} onContinue={() => go('rhythm')} />
      case 'rhythm':
        return <RhythmStep value={answers.rhythm} onChange={v => set({ rhythm: v })} onContinue={() => go('time')} />
      case 'time':
        return <TimeStep minute={answers.minute} onChange={v => set({ minute: v })} onContinue={continueTime} />
      case 'nudge':
        return (
          <NudgeStep
            time={time}
            // Allow asks the OS -- its own prompt, its own words -- and
            // the answer is the answer: a refusal boards without the nudge.
            onAllow={() => {
              requestNudgePermission().then(granted => { set({ notifications: granted }); toBuilding() })
            }}
            onSkip={() => { set({ notifications: false }); toBuilding() }}
          />
        )
      case 'building':
        return (
          <Building
            name={displayName}
            onDone={buildingDone}
            steps={[
              { key: 'goal', label: t.brdBuildGoal, value: goalLine },
              { key: 'lines', label: t.brdBuildLines, value: linesLine },
              { key: 'ride', label: t.brdBuildRide, value: `${answers.rhythm} min · ${time}` },
              {
                key: 'projection',
                label: t.brdBuildProjection,
                value: new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(figures.date),
              },
            ]}
          />
        )
      case 'plan':
        // 机 (plan 140): on the desk the pass's own screen folds away, so
        // the plan is the last screen and enters the station -- unless
        // there is an account to offer first. The funnel reads plan →
        // boarding_done there. The car names its step (`data-car`) for
        // the width it stands at.
        return (
          <PlanStep
            name={displayName}
            motive={answers.motive ?? 'other'}
            rhythm={answers.rhythm}
            goal={answers.goal}
            lines={answers.lines}
            figures={figures}
            now={now}
            onContinue={desk && !guest ? complete : () => go(guest ? 'account' : 'pass')}
            last={desk && !guest}
            busy={busy}
            error={saveError}
          />
        )
      case 'account':
        // And the account, when it is offered, is the desk's last screen:
        // keeping the progress, or riding on without it, enters.
        return (
          <AccountStep
            onCreated={() => (desk ? complete() : go('pass'))}
            onSkip={() => (desk ? complete() : go('pass'))}
            onSignIn={onSignIn}
            onLeaveForAuth={() => stash({ answers, step, savedName })}
            error={desk ? saveError : null}
          />
        )
      case 'pass':
        return <PassStep name={displayName} profile={profile} onEnter={complete} busy={busy} error={saveError} />
      default:
        return null
    }
  }

  // ── 辻 — the strip at the floor's left end (plans 140, 161) ──────
  // A stop per question (the reveal is the kana's own, not a stop), each
  // named, the ones ridden filled and the one being asked lit. The
  // answer given is said on its stop -- a level picked but not yet
  // continued is already a goal, priced the way Continue will commit it
  // (boardingDraft) -- and a stop behind is a door back to its question
  // while there is a way back (the history).
  const draft = boardingDraft(answers, step)
  const draftLevel = draft.levelChoice === 'novice' ? t.brdNovice : draft.jlpt
  const draftGoal = draft.levelChoice == null ? null
    : draft.goal === 'novice' ? t.brdNovice
      : draft.goal ? `${draftLevel} → ${draft.goal}` : draftLevel
  const stopValue = {
    name: displayName,
    why: answers.motive ? t.brdMotive[answers.motive] : null,
    kana: answers.kana ? t.brdKana[answers.kana] : null,
    level: answers.levelChoice == null ? null : answers.levelChoice === 'novice' ? t.brdNovice : answers.levelChoice,
    goal: draftGoal,
    lines: [t.kanaTitle, ...draft.lines.map(line => t.brdLine[line])].join(' · '),
    rhythm: `${answers.rhythm} ${t.brdMinADay}`,
    time,
    nudge: answers.notifications ? time : t.brdNotNow,
  }
  const atStop = lineStops.indexOf(step === 'reveal' ? 'kana' : step)
  const deskStops = lineStops.map((key, i) => {
    const state = atStop < 0 || i < atStop ? 'done' : i === atStop ? 'now' : 'next'
    return {
      key,
      label: t.brdStop[key],
      value: stopValue[key],
      state,
      onOpen: state === 'done' && history.includes(key) ? () => jumpTo(key) : undefined,
    }
  })
  // The way back the floor draws beside Continue (BoardBack): the
  // question before, or out of the flow from the first -- the head's ‹,
  // which the desk no longer draws.
  const floorBack = desk && onTrack ? (history.length > 0 ? back : onExit) : null

  return (
    <main
      className={desk ? 'brd desk-brd' : 'brd'}
      id="main-content"
      data-step={step}
      ref={frameRef}
      // A plain number, read as pixels by the sheet: a measured length,
      // not one chosen from the scale.
      style={desk && stripW ? { '--desk-strip-w': stripW } : undefined}
    >
      {onTrack && !desk && <BoardHead index={index} total={total} onBack={history.length > 0 ? back : onExit} />}
      <BoardBack.Provider value={floorBack}>
        <div className="brd__cars">
          {leaving && (
            <div key={`out:${leaving.step}`} className="brd__car brd__car--out" data-dir={leaving.dir} data-car={desk ? leaving.step : undefined} aria-hidden="true" inert>
              {renderStep(leaving.step)}
            </div>
          )}
          <div key={step} className={`brd__car${leaving ? ' brd__car--in' : ''}`} data-dir={leaving?.dir ?? 'none'} data-car={desk ? step : undefined}>
            {renderStep(step)}
          </div>
        </div>
      </BoardBack.Provider>
      {desk && <DeskStrip stops={deskStops} stripRef={stripRef} />}
      {/* 到着: the plan arrives under the signboard, once; skippable,
          absent under reduced motion (TrainArrival's own rules). */}
      {arrival && <TrainArrival jp="案内" title={t.brdArrivalTitle} onDone={() => setArrival(false)} />}
    </main>
  )
}
