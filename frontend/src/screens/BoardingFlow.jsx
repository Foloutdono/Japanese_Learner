import { useEffect, useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { apiFetch, apiJson, apiJsonWithTimeout } from '../lib/api'
import { canNudge, requestNudgePermission } from '../lib/platform'
import { refreshSummary } from '../stores/profileSummary'
import { refreshCredits } from '../stores/credits'
import { USERNAME_RE } from '../components/profile/EditableUsername'
import { TrainArrival } from '../components/onboarding/TrainArrival'
import { DEPART_TIMES } from '../components/onboarding/departures'
import {
  RECOMMENDED_RHYTHM, bucketFor, itemsForRhythm, jlptFor, levelForKana,
  minutesToTime, planFigures, stopsAhead, timeToMinutes,
} from '../domain/boarding'
import { BoardHead } from '../components/boarding/BoardFrame'
import NameStep from '../components/boarding/NameStep'
import WhyStep from '../components/boarding/WhyStep'
import { KanaStep, KanaReveal } from '../components/boarding/KanaStep'
import { LevelStep, GoalStep } from '../components/boarding/LevelStep'
import RhythmStep from '../components/boarding/RhythmStep'
import TimeStep from '../components/boarding/TimeStep'
import NudgeStep from '../components/boarding/NudgeStep'
import Building from '../components/boarding/Building'
import PlanStep from '../components/boarding/PlanStep'
import PassStep from '../components/boarding/PassStep'
import AccountStep from '../components/boarding/AccountStep'

// ── 乗車 — the boarding (plan 075) ────────────────────────────────
// The canvas's boarding, the owner's sketch drawn: name → why → the
// kana check → (the reveal | the level) → goal → rhythm → the hour →
// (the nudge, native only) → building → the plan → (the account) →
// the pass. Welcome is step zero (components/boarding/Welcome.jsx,
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

const PULL_MS = 260
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
    'rhythm', 'time',
    ...(canNudge() ? ['nudge'] : []),
  ]
}

export default function BoardingFlow({
  session, initialProfile, onComplete, onExit = null, onSignIn = null,
  guest = false, dryRun = false,
}) {
  const { t, lang } = useLang()
  const profile = { level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100, username: '', ...(initialProfile ?? {}) }

  const [answers, setAnswers] = useState({
    name: profile.username ?? '',
    motive: null,
    kana: null,
    levelChoice: null,   // 'novice' | 'N5'..'N1' on the level list
    jlpt: null,          // the level the office stores
    goal: null,
    rhythm: RECOMMENDED_RHYTHM,
    minute: timeToMinutes(DEFAULT_TIME),
    notifications: false,
  })
  const [step, setStep] = useState('name')
  const [history, setHistory] = useState([])
  const [leaving, setLeaving] = useState(null)   // { step, dir } during a pull
  const [volumes, setVolumes] = useState(null)
  const [savedName, setSavedName] = useState(profile.username ?? '')
  const [nameError, setNameError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [arrival, setArrival] = useState(false)
  const [now] = useState(() => new Date())
  const frameRef = useRef(null)
  const arrivalPlayed = useRef(REDUCED)

  const set = patch => setAnswers(a => ({ ...a, ...patch }))

  useEffect(() => {
    document.title = `${t.brdDocumentTitle} — ${t.appTitle}`
  }, [t])

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
    const id = setTimeout(() => setLeaving(null), PULL_MS)
    return () => clearTimeout(id)
  }, [leaving])

  // Focus lands on the new screen's question -- except on the name,
  // whose field is already focused and must keep the keyboard.
  useEffect(() => {
    if (step === 'name') return
    const q = frameRef.current?.querySelector('.brd__car:not(.brd__car--out) .brd__q')
    q?.focus({ preventScroll: true })
  }, [step])

  function go(next) {
    setHistory(h => [...h, step])
    if (!REDUCED) setLeaving({ step, dir: 'fwd' })
    setStep(next)
  }

  function back() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    if (!REDUCED) setLeaving({ step, dir: 'back' })
    setStep(prev)
  }

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

  function afterLevel(jlpt) {
    const ahead = stopsAhead(jlpt)
    set({ jlpt, goal: ahead[0] ?? null })
    return ahead.length > 0 ? 'goal' : 'rhythm'
  }

  function answerKana(kana) {
    const level = levelForKana(kana)
    if (level) {
      set({ kana, levelChoice: null })
      afterLevel(level)
      go('reveal')
    } else {
      set({ kana })
      go('level')
    }
  }

  function continueReveal() {
    go(afterLevel(answers.jlpt ?? 'N5'))
  }

  function continueLevel() {
    go(afterLevel(jlptFor(answers.levelChoice)))
  }

  function continueTime() {
    go(canNudge() ? 'nudge' : 'building')
  }

  function buildingDone() {
    if (!arrivalPlayed.current) { arrivalPlayed.current = true; setArrival(true) }
    setHistory([])
    setStep('plan')
  }

  // ── The contract ─────────────────────────────────────────────
  const jlpt = answers.jlpt ?? 'N5'
  const perDay = itemsForRhythm(answers.rhythm)
  const figures = planFigures(volumes, jlpt, answers.goal, perDay, answers.kana, now)
  const time = minutesToTime(answers.minute)

  function complete() {
    if (busy) return
    if (dryRun) { onComplete(); return }
    setBusy(true)
    setSaveError(false)
    const fresh = planFigures(volumes, jlpt, answers.goal, perDay, answers.kana, new Date())
    const body = {
      jlptLevel: jlpt,
      dailyNewTarget: perDay,
      ...(answers.goal ? { goalLevel: answers.goal } : {}),
      ...(answers.goal && volumes ? { goalTargetDate: fresh.date.toISOString().slice(0, 10) } : {}),
      dailyDeparture: bucketFor(answers.minute),
      motive: answers.motive,
      kanaKnown: answers.kana,
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
        // The gate reads the profile summary for the pass holder's
        // name and the HUD reads the balance -- refresh both before the
        // cutscene mounts. Fire-and-forget: both stores fail quietly.
        refreshSummary()
        refreshCredits()
        onComplete()
      })
      .catch(() => {
        setBusy(false)
        setSaveError(true)
      })
  }

  // ── The screens ──────────────────────────────────────────────
  const stops = trackStops(answers)
  const onTrack = stops.includes(step)
  const index = stops.indexOf(step) + 1
  const total = stops.length
  const displayName = answers.name.trim() || savedName || profile.username || ''

  function renderStep(key) {
    switch (key) {
      case 'name':
        return (
          <NameStep
            value={answers.name}
            onChange={v => { set({ name: v }); setNameError(null) }}
            onContinue={continueName}
            onSignIn={onSignIn}
            error={nameError}
            busy={busy}
          />
        )
      case 'why':
        return <WhyStep name={displayName} value={answers.motive} onChange={v => set({ motive: v })} onContinue={() => go('kana')} />
      case 'kana':
        return <KanaStep value={answers.kana} onAnswer={answerKana} />
      case 'reveal':
        return <KanaReveal onContinue={continueReveal} />
      case 'level':
        return <LevelStep volumes={volumes} value={answers.levelChoice} onChange={v => set({ levelChoice: v })} onContinue={continueLevel} />
      case 'goal':
        return <GoalStep volumes={volumes} level={jlpt} value={answers.goal} onChange={v => set({ goal: v })} onContinue={() => go('rhythm')} />
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
              requestNudgePermission().then(granted => { set({ notifications: granted }); go('building') })
            }}
            onSkip={() => { set({ notifications: false }); go('building') }}
          />
        )
      case 'building':
        return (
          <Building
            name={displayName}
            onDone={buildingDone}
            steps={[
              { key: 'goal', label: t.brdBuildGoal, value: answers.goal ? `${jlpt} → ${answers.goal}` : jlpt },
              { key: 'lines', label: t.brdBuildLines, value: t.brdFourLines },
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
        return (
          <PlanStep
            name={displayName}
            motive={answers.motive ?? 'other'}
            rhythm={answers.rhythm}
            goal={answers.goal}
            figures={figures}
            now={now}
            onContinue={() => go(guest ? 'account' : 'pass')}
          />
        )
      case 'account':
        return (
          <AccountStep
            onCreated={() => go('pass')}
            onSkip={() => go('pass')}
            onSignIn={onSignIn}
          />
        )
      case 'pass':
        return <PassStep name={displayName} profile={profile} onEnter={complete} busy={busy} error={saveError} />
      default:
        return null
    }
  }

  return (
    <main className="brd" id="main-content" data-step={step} ref={frameRef}>
      {onTrack && <BoardHead index={index} total={total} onBack={history.length > 0 ? back : onExit} />}
      <div className="brd__cars">
        {leaving && (
          <div className="brd__car brd__car--out" data-dir={leaving.dir} aria-hidden="true" inert>
            {renderStep(leaving.step)}
          </div>
        )}
        <div key={step} className={`brd__car${leaving ? ' brd__car--in' : ''}`} data-dir={leaving?.dir ?? 'none'}>
          {renderStep(step)}
        </div>
      </div>
      {/* 到着: the plan arrives under the signboard, once; skippable,
          absent under reduced motion (TrainArrival's own rules). */}
      {arrival && <TrainArrival jp="案内" title={t.brdArrivalTitle} onDone={() => setArrival(false)} />}
    </main>
  )
}
