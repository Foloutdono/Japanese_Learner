import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { apiJson, apiJsonWithTimeout } from '../lib/api'
import { playUi } from '../lib/audio'
import { refreshSummary } from '../stores/profileSummary'
import { EditableUsername } from '../components/profile/EditableUsername'
import { PassWave } from '../components/profile/PassWave'
import PlacementTest from '../components/onboarding/PlacementTest'
import FirstRide from '../components/onboarding/FirstRide'
import { LEVEL_JP, LEVEL_SAMPLE } from '../components/onboarding/levelSigns'
import { levelItems } from '../domain/journeyProjection'
import { DAYS_PER_MONTH, addDays, journeyItems, journeyLevels, minutesFor } from '../domain/goalMath'
import DepartureBoard from '../components/onboarding/DepartureBoard'
import { goalDerived } from '../components/onboarding/goalDerived'
import CallingAt from '../components/onboarding/CallingAt'
import { TrainArrival } from '../components/onboarding/TrainArrival'
import { DEFAULT_PER_DAY, serviceLabel } from '../components/onboarding/paces'
import { DEPART_TIMES } from '../components/onboarding/departures'
import { DepartureChips } from '../components/onboarding/DepartureChips'
import { StopPattern } from '../components/onboarding/DepartureBoard'
import { GhostTrack } from '../components/journey/GhostTrack'
import { journeyStations } from '../components/journey/stations'

// ── みどりの窓口 — the ticket office ─────────────────────────────
// The onboarding flow: a full-screen stepped sequence rendered by App
// INSTEAD of the router whenever the profile has no onboarded_at —
// the same continuum Landing → Auth uses, which is why this is a
// plain component with callbacks and not a route. It is deliberately
// not a station (no stations.js/identity.js entry, no line colour of
// its own): like /profile and /settings it is about you, not
// somewhere you travel, so its rails fall back to shu-iro.
//
//   ride → level → [placement] → goal → map → pass
//
// 試乗 first (plan 063, phase D): the learner does the core loop once
// — card, flip, honest rating — before any question is asked. 行先
// (phase E) merged the old pace and projection steps: a pace chosen
// blind and a projection shown after were one decision split in half,
// so the departure board prices every service against the learner's
// date or patience in one place, and the calling-at strip confirms.
// 案内 (phase F) is the promise, not a tour — the first ride already
// demos the loop for real, so this scene shows the learner's own line
// with the plan-car pulling six honest days ahead: the ghost train
// met BEFORE day one, so the first real delay report reads as a
// promise kept. And the name is asked LAST: 窓口 folded into 定期券 —
// the application form signs, the pass prints, the gate opens.
//
// Nothing persists until the single POST /api/onboarding/complete at
// the end (or via skip), so a mid-flow refresh is a clean restart —
// at most two minutes lost, and no half-onboarded state to repair.
// The TicketGate finale is rendered by App, not here: this component
// unmounts the moment onComplete flips the gate state, and a cutscene
// rendered by the thing it unmounts would pop mid-wipe.

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// The flow's own stopping pattern — a スタンプラリー stamp card
// (plan 063): each stop inks its kanji when passed. The placement
// test is a branch of 乗車駅 (you are still settling where to board),
// not a station of its own, so it maps onto that stop. Five stops —
// the wave's final shape.
const STOPS = [
  { key: 'ride', jp: '試乗', kanji: '試' },
  { key: 'level', jp: '乗車駅', kanji: '乗' },
  { key: 'goal', jp: '行先', kanji: '行' },
  { key: 'map', jp: '案内', kanji: '案' },
  { key: 'pass', jp: '定期券', kanji: '定' },
]

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Where a boarding level points the destination chip by default: two
// stops up the line when they exist (N5 boards looking at N3), else
// the next one, else no destination at all (an N1 boarder rides free).
// A dest the learner already chose survives re-boarding when it is
// still ahead of the new start; 未定 (null) is an explicit answer and
// survives everything.
function destAfterBoarding(prev, startLevel) {
  const options = journeyLevels(startLevel).slice(1)
  if (prev === null) return null
  if (prev !== undefined && options.includes(prev)) return prev
  return options[1] ?? options[0] ?? null
}

// The one live exception to "a stamp inks when you leave": rating the
// demo card inks 試乗 on the spot — the reward IS the ink landing.
// `freshStamp` marks the single stamp allowed to play its landing
// animation; it is an index, not a flag, so re-renders never replay
// the whole row and back() clears it entirely.
function StepLine({ step, rideRated, freshStamp, t }) {
  const nowKey = step === 'placement' ? 'level' : step
  const now = STOPS.findIndex(s => s.key === nowKey)
  const isPast = i => i < now || (i === 0 && rideRated && now === 0)
  const isNow = i => i === now && !(i === 0 && rideRated && now === 0)
  const pct = STOPS.length > 1 ? now / (STOPS.length - 1) : 0
  return (
    <nav className="onb-line" aria-label={t.onbStepsAria(now + 1, STOPS.length)}>
      <span
        className="onb-line__fill"
        style={{ width: `calc((100% - 64px) * ${pct})` }}
        aria-hidden="true"
      />
      {STOPS.map((s, i) => (
        <span
          key={s.key}
          className={[
            'onb-line__stop',
            isPast(i) && 'onb-line__stop--past',
            isNow(i) && 'onb-line__stop--now',
            freshStamp === i && 'onb-line__stop--fresh',
          ].filter(Boolean).join(' ')}
          aria-current={isNow(i) ? 'step' : undefined}
        >
          <span className="onb-line__stamp" lang="ja" aria-hidden="true">
            {isPast(i) ? s.kanji : ''}
          </span>
          <span className="onb-line__name" lang="ja">{s.jp}</span>
        </span>
      ))}
    </nav>
  )
}

// `dryRun` is the dev workbench's hook (/dev/onboarding, see
// OnboardingPreview): the whole flow runs for real — placement,
// volumes, every demo — but the final complete() hands over WITHOUT
// writing onboarded_at, so the office can be replayed on repeat.
export default function OnboardingFlow({ session, initialProfile, onComplete, dryRun = false }) {
  const { t, lang } = useLang()
  const [step, setStep] = useState('ride')
  const [history, setHistory] = useState([])
  const [rideRated, setRideRated] = useState(false)
  // Which stamp just landed — the only one whose ink animation plays.
  const [freshStamp, setFreshStamp] = useState(null)
  const [username, setUsername] = useState(initialProfile?.username ?? '')
  const [levelChoice, setLevelChoice] = useState(null) // {level, source: 'picked'|'beginner'|'test'}
  // The 行先 scene's whole state: destination (undefined = not asked
  // yet, null = 未定 chosen), by-date months, by-pace dial. perDay
  // below stays the FINAL chosen pace (set on the scene's Continue) —
  // skip and the pass read it, same as before phase E.
  const [goal, setGoal] = useState({ dest: undefined, mode: 'date', months: 12, perDay: DEFAULT_PER_DAY })
  // The clock reading taken on entering 行先: every date the board
  // prints derives from it, so nothing drifts while the learner dials
  // (and render never reads the clock — the React purity rule).
  const [goalNow, setGoalNow] = useState(null)
  const [perDay, setPerDay] = useState(null)
  // 定期券's two beats: the application signs, then 発行 prints. The
  // print moment is the clock the displayed pass reads (the POST takes
  // its own fresh reading — seconds apart at most).
  const [printed, setPrinted] = useState(false)
  const [printedAt, setPrintedAt] = useState(null)
  const [depart, setDepart] = useState(null) // 'am' | 'noon' | 'pm' | null = 自由
  // 案内's staged demo: the plan-car pulls ahead, then the bracket
  // measures it — timeouts, never rAF (a throttled tab must still
  // reach the final state), and static under prefers-reduced-motion.
  const [promiseMoved, setPromiseMoved] = useState(REDUCED)
  const [promiseGap, setPromiseGap] = useState(REDUCED)
  const [volumes, setVolumes] = useState(null)
  const [placementResult, setPlacementResult] = useState(null)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState(false)
  // 到着 — the arrival cutscene over the tour's FIRST entry only. A
  // ref, never reset, so backing out of the tour and returning does
  // not replay it; local state rather than a store because this
  // component (unlike the gate/door's triggers) never unmounts
  // mid-cutscene — the same reasoning as App's direct TicketGate.
  const [showArrival, setShowArrival] = useState(false)
  const arrivalPlayedRef = useRef(false)

  // Fetched once, in parallel with the whole flow — by the time the
  // learner reaches the projection it has long since arrived. Its
  // failure is absorbed: the projection step degrades to copy.
  useEffect(() => {
    let cancelled = false
    apiJson('/api/onboarding/volumes', session)
      .then(v => { if (!cancelled) setVolumes(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [session])

  // The office is not routed, so DocumentHead (which lives inside the
  // BrowserRouter branch of App) never runs here — without this the
  // tab keeps whatever title the landing page left.
  useEffect(() => {
    document.title = `${t.onbDocumentTitle} — ${t.appTitle}`
  }, [t])

  // A step change swaps content IN PLACE — this component never
  // unmounts between steps — so without this, the previous step's
  // scroll offset survives (the office sign read as "missing" when it
  // had merely been scrolled past) and a keyboard user's focus died
  // with the unmounted button they had just pressed. Every step
  // heading carries tabIndex={-1} so it can receive this focus, which
  // also makes the transition announce itself to a screen reader.
  useEffect(() => {
    document.querySelector('.onb-step__title')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [step])

  // Plays once, like the arrival cutscene: backing out and returning
  // shows the finished drawing, never the theatre again. Fire-and-
  // forget timers — the flow stays mounted well past 1.2s, and a
  // stray late setState is a no-op on the state it already has.
  const promisePlayedRef = useRef(REDUCED)
  useEffect(() => {
    if (step !== 'map' || promisePlayedRef.current) return
    promisePlayedRef.current = true
    setTimeout(() => setPromiseMoved(true), 500)
    setTimeout(() => setPromiseGap(true), 1200)
  }, [step])

  const startLevel = levelChoice?.level ?? 'N5'
  const goalNowDate = useMemo(() => (goalNow != null ? new Date(goalNow) : null), [goalNow])
  const derived = useMemo(
    () => (volumes && goalNowDate ? goalDerived(volumes, startLevel, goal, goalNowDate) : null),
    [volumes, startLevel, goal, goalNowDate],
  )

  function advance(next) {
    // Leaving a stop inks it: the stamp that just became --past is the
    // fresh one (placement is 乗車駅's branch, so it inks that stop).
    setFreshStamp(STOPS.findIndex(st => st.key === (step === 'placement' ? 'level' : step)))
    setHistory(h => [...h, step])
    setStep(next)
    if (next === 'map' && !arrivalPlayedRef.current) {
      arrivalPlayedRef.current = true
      setShowArrival(true)
    }
  }

  function back() {
    playUi('click')
    setFreshStamp(null)
    setHistory(h => {
      const prev = h[h.length - 1]
      if (!prev) return h
      // Deliberately does NOT clear placementResult: backing from the
      // pace step re-shows the SCORE, it does not silently discard a
      // finished 12-question test. A fresh test is an explicit choice
      // — PlacementResult's own retake link, never a side effect of
      // navigation.
      setStep(prev)
      return h.slice(0, -1)
    })
  }

  function boardAt(level, source) {
    setLevelChoice({ level, source })
    setGoal(g => ({ ...g, dest: destAfterBoarding(g.dest, level) }))
    setGoalNow(Date.now())
    advance('goal')
  }

  // The contract the pass prints (plan 063): destination + the date
  // this exact configuration promises — computed at POST time with a
  // fresh clock, in BOTH modes (a by-pace goal's arrival is still a
  // printed date; routes/journey.py falls back to the same arithmetic
  // only when none was stored). 未定 rides pace-only: no goal fields.
  function goalPayload() {
    if (goal.dest == null) return null
    const now = new Date()
    if (goal.mode === 'date') {
      return {
        goalLevel: goal.dest,
        goalTargetDate: addDays(now, goal.months * DAYS_PER_MONTH).toISOString().slice(0, 10),
      }
    }
    if (!volumes) return { goalLevel: goal.dest }
    const items = journeyItems(volumes, levelChoice?.level ?? 'N5', goal.dest)
    return {
      goalLevel: goal.dest,
      goalTargetDate: addDays(now, items / goal.perDay).toISOString().slice(0, 10),
    }
  }

  function complete(level, chosenPerDay, withGoal) {
    if (completing) return
    if (dryRun) { onComplete(); return }
    setCompleting(true)
    setCompleteError(false)
    apiJsonWithTimeout('/api/onboarding/complete', session, {
      method: 'POST',
      timeoutMs: 10000,
      body: JSON.stringify({
        jlptLevel: level,
        dailyNewTarget: chosenPerDay,
        ...(withGoal ? goalPayload() ?? {} : {}),
        ...(withGoal && depart ? { dailyDeparture: depart } : {}),
      }),
    })
      .then(() => {
        // The gate reads the profile summary for the pass holder's
        // name — refresh it (and the new jlptLevel with it) before the
        // cutscene mounts. Fire-and-forget: the summary store fails
        // silently by design and the gate has its own fallback.
        refreshSummary()
        onComplete()
      })
      .catch(() => {
        setCompleting(false)
        setCompleteError(true)
      })
  }

  function skip() {
    playUi('click')
    // Skipping the office skips the contract: whatever level and pace
    // stand so far, no destination — a goal is signed at the pass,
    // never implied by an escape hatch.
    complete(levelChoice?.level ?? 'N5', perDay ?? DEFAULT_PER_DAY, false)
  }

  const showBack = history.length > 0
  const showSkip = step !== 'pass'

  return (
    <div className="onb" data-step={step}>
      <header className="onb-header">
        <span className="onb-header__kana" lang="ja">みどりのまどぐち</span>
        <h1 className="onb-header__jp" lang="ja">みどりの窓口</h1>
        <span className="onb-header__latin">TICKET OFFICE</span>
      </header>

      <StepLine step={step} rideRated={rideRated} freshStamp={freshStamp} t={t} />

      <main className="onb-body">
        {showBack && (
          <button type="button" className="onb-link onb-back" onClick={back}>
            ← {t.back}
          </button>
        )}

        {step === 'ride' && (
          <FirstRide
            t={t}
            lang={lang}
            volumes={volumes}
            rated={rideRated}
            onRated={() => { setRideRated(true); setFreshStamp(0) }}
            onNext={() => { playUi('click'); advance('level') }}
            onSkipDemo={() => { playUi('click'); advance('level') }}
          />
        )}

        {step === 'level' && (
          <BoardingStep
            t={t}
            lang={lang}
            volumes={volumes}
            onPick={level => boardAt(level, 'picked')}
            onBeginner={() => { playUi('click-mode-selection'); boardAt('N5', 'beginner') }}
            onTest={() => { playUi('click-mode-selection'); advance('placement') }}
          />
        )}

        {step === 'placement' && !placementResult && (
          <section className="onb-step">
            <h2 className="onb-step__title" tabIndex={-1}>{t.onbTestTitle}</h2>
            <PlacementTest session={session} onResult={setPlacementResult} />
          </section>
        )}

        {step === 'placement' && placementResult && (
          <PlacementResult
            t={t}
            result={placementResult}
            onPick={level => boardAt(level, 'test')}
            onRetake={() => { playUi('click'); setPlacementResult(null) }}
          />
        )}

        {step === 'goal' && (
          <section className="onb-step">
            <h2 className="onb-step__title" tabIndex={-1}>{t.onbGoalTitle}</h2>
            <p className="onb-step__body">{t.onbGoalBody}</p>
            {derived ? (
              <>
                <DepartureBoard
                  volumes={volumes}
                  startLevel={startLevel}
                  goal={goal}
                  derived={derived}
                  now={goalNowDate}
                  onGoal={setGoal}
                />
                {derived.feasible && derived.items != null && (
                  <CallingAt
                    volumes={volumes}
                    startLevel={startLevel}
                    destLevel={goal.dest}
                    perDay={derived.effectivePerDay}
                    now={goalNowDate}
                  />
                )}
                <p className="onb-goal__hint">{honestLine(t, lang, goal, derived)}</p>
              </>
            ) : (
              <p className="onb-step__hint">{t.onbMapUnavailable}</p>
            )}
            <div className="onb-step__actions">
              <button
                type="button"
                className="onb-action"
                disabled={derived ? !derived.feasible : false}
                onClick={() => {
                  setPerDay(derived?.effectivePerDay ?? DEFAULT_PER_DAY)
                  playUi('click')
                  advance('map')
                }}
              >
                {t.onbContinue}
              </button>
            </div>
          </section>
        )}

        {step === 'map' && (
          <>
            <PromiseStep
              t={t}
              volumes={volumes}
              startLevel={startLevel}
              goal={goal}
              derived={derived}
              moved={promiseMoved}
              showGap={promiseGap}
              onNext={() => { playUi('click'); advance('pass') }}
            />
            {/* A pure overlay — the scene beneath is mounted and usable
                from frame one; nothing waits on it. */}
            {showArrival && (
              <TrainArrival jp="案内" title={t.onbPromiseTitle} onDone={() => setShowArrival(false)} />
            )}
          </>
        )}

        {step === 'pass' && (
          <PassStep
            t={t}
            lang={lang}
            session={session}
            username={username}
            onUsername={setUsername}
            volumes={volumes}
            startLevel={startLevel}
            goal={goal}
            perDay={perDay ?? DEFAULT_PER_DAY}
            depart={depart}
            onDepart={setDepart}
            printed={printed}
            printedAt={printedAt}
            onPrint={() => { playUi('click'); setPrintedAt(Date.now()); setPrinted(true) }}
            onEditApp={() => { playUi('click'); setPrinted(false) }}
            completing={completing}
            error={completeError}
            onBoard={() => complete(levelChoice?.level ?? 'N5', perDay ?? DEFAULT_PER_DAY, true)}
          />
        )}

        {showSkip && (
          <footer className="onb-footer">
            {/* Copy mirrors what skip() actually does: once a level is
                chosen, skipping completes at THAT level, not N5. */}
            <button type="button" className="onb-link onb-skip" onClick={skip} disabled={completing}>
              {t.onbSkip(levelChoice?.level ?? 'N5')}
            </button>
            <span className="onb-skip__hint">{t.onbSkipHint}</span>
            {completeError && step !== 'pass' && (
              <span className="onb-error" role="alert">{t.onbPassError}</span>
            )}
          </footer>
        )}
      </main>
    </div>
  )
}

// ── 乗車駅 ───────────────────────────────────────────────────────
// "Board at the last station whose sign you can read." Each level is
// a station row: the serif sign name, the load at that stop, and one
// sentence a learner THERE can read — the sentence is the placement
// heuristic (plan 063, phase D; the 12-question test stays as the
// second opinion below). The item counts come from the same volumes
// fetch the projection uses; until they arrive the rows simply omit
// the load line.
function BoardingStep({ t, lang, volumes, onPick, onBeginner, onTest }) {
  const numberFmt = lang === 'fr' ? 'fr-FR' : 'en'
  return (
    <section className="onb-step">
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbBoardBySign}</h2>
      <div className="onb-lvls" role="group" aria-label={t.onbLevelTitle}>
        {LEVELS.map(level => (
          <button
            key={level}
            type="button"
            className="onb-lvl"
            onClick={() => { playUi('click-mode-selection'); onPick(level) }}
          >
            <span className="onb-lvl__roundel">{level}</span>
            <span className="onb-lvl__body">
              <span className="onb-lvl__head">
                <span className="onb-lvl__jp" lang="ja">{LEVEL_JP[level]}</span>
                {volumes && (
                  <span className="onb-lvl__load">
                    {t.onbLvlLoad(levelItems(volumes, level).toLocaleString(numberFmt))}
                  </span>
                )}
              </span>
              <span className="onb-lvl__sample" lang="ja">{LEVEL_SAMPLE[level]}</span>
            </span>
            <span className="onb-lvl__go" aria-hidden="true">▶</span>
          </button>
        ))}
      </div>

      {/* Not stations — the diagram above is the line, these are the
          two ways of not knowing where on it you stand. */}
      <div className="onb-alts">
        <button type="button" className="onb-alt" onClick={onBeginner}>
          <span className="onb-alt__name">{t.onbLevelNever}</span>
          <span className="onb-alt__hint">{t.onbLevelNeverHint}</span>
        </button>
        <button type="button" className="onb-alt onb-alt--test" onClick={onTest}>
          <span className="onb-alt__name">{t.onbLevelTest}</span>
          <span className="onb-alt__hint">{t.onbLevelTestHint}</span>
        </button>
      </div>
    </section>
  )
}

// ── 診断結果 ─────────────────────────────────────────────────────
function PlacementResult({ t, result, onPick, onRetake }) {
  const [choice, setChoice] = useState(result.recommendedLevel)
  return (
    <section className="onb-step">
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbTestResultTitle}</h2>
      <p className="onb-step__body">{t.onbTestResult(result.recommendedLevel, result.correct, result.total)}</p>

      <div className="onb-result__levels">
        {LEVELS.map(level => {
          const stats = result.perLevel?.[level]
          return (
            <div key={level} className="onb-result__row">
              <span className="onb-result__level">{level}</span>
              <span className="onb-result__score">
                {stats ? `${stats.correct} / ${stats.total}` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      <p className="onb-step__hint">{t.onbTestOverrideHint}</p>
      {/* Flat sibling buttons, one group — never nested controls. */}
      <div className="onb-seg" role="group" aria-label={t.onbLevelTitle}>
        {LEVELS.map(level => (
          <button
            key={level}
            type="button"
            className={[
              'onb-seg__btn',
              level === choice && 'onb-seg__btn--on',
              level === result.recommendedLevel && 'onb-seg__btn--reco',
            ].filter(Boolean).join(' ')}
            aria-pressed={level === choice}
            onClick={() => { playUi('click-mode-selection'); setChoice(level) }}
          >
            {level}
          </button>
        ))}
      </div>

      <div className="onb-step__actions">
        {onRetake && (
          <button type="button" className="onb-link onb-result__retake" onClick={onRetake}>
            {t.onbTestRetake}
          </button>
        )}
        <button type="button" className="onb-action" onClick={() => { playUi('click'); onPick(choice) }}>
          {t.onbContinue}
        </button>
      </div>
    </section>
  )
}

// ── 行先's honest line ───────────────────────────────────────────
// One sentence under the board that says, in numbers, exactly what
// Continue signs — or exactly why it is disabled.
function honestLine(t, lang, goal, derived) {
  const numberFmt = lang === 'fr' ? 'fr-FR' : 'en'
  const fmtD = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  if (!derived.hasDest) {
    return t.onbHonestRide(goal.perDay, minutesFor(goal.perDay))
  }
  if (!derived.feasible) {
    return t.onbHonestNoRun(goal.dest, goal.months, derived.required)
  }
  return t.onbHonestPlan(
    derived.effectivePerDay,
    minutesFor(derived.effectivePerDay),
    derived.items.toLocaleString(numberFmt),
    goal.dest,
    fmtD.format(derived.targetDate),
  )
}

// ── 案内 — the map that will tell you the truth ─────────────────
// The promise scene (plan 063, phase F): the learner's own line goes
// up on a sumi panel with the SAME two-lane track the pass back uses
// (components/journey/GhostTrack — met here first, so the first real
// delay report post-launch reads as a promise kept, not a surprise).
// A staged demo: the plan-car pulls six honest days ahead on mount,
// then the bracket measures it — the flow drives both beats with
// timeouts and hands the results down as props. One quiet roundel row
// names the four lines; the demos are gone, because scene one already
// demos the loop for real.
const PROMISE_YOU = 15
const PROMISE_PLAN = 24
const PROMISE_DAYS = 6

const LINE_ROUNDELS = [
  { jp: '単語', color: 'var(--line-vocab)' },
  { jp: '文法', color: 'var(--line-grammar)' },
  { jp: '解析', color: 'var(--line-kaiseki)' },
  { jp: '模試', color: 'var(--line-exam)' },
]

function PromiseStep({ t, volumes, startLevel, goal, derived, moved, showGap, onNext }) {
  const dest = goal.dest ?? 'N1'
  const stations = journeyStations(volumes, startLevel, dest, derived?.items ?? null)
  const perDay = derived?.effectivePerDay ?? DEFAULT_PER_DAY
  return (
    <section className="onb-step">
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbPromiseTitle}</h2>
      <p className="onb-step__body">{t.onbPromiseBody(perDay)}</p>

      <div className="onb-promise jour-st--slightlyBehind">
        <div className="onb-promise__head">
          <span className="onb-promise__title">
            <b lang="ja">路線図</b>
            <span className="onb-promise__cap">{t.onbPromiseLine(startLevel, dest)}</span>
          </span>
          <span className="onb-promise__status">
            <b lang="ja">やや遅れ</b>
            <span className="onb-promise__cap">{t.onbPromiseExample}</span>
          </span>
        </div>
        <GhostTrack
          stations={stations}
          youF={PROMISE_YOU}
          planF={moved ? PROMISE_PLAN : PROMISE_YOU}
          gapDeltaDays={showGap ? PROMISE_DAYS : null}
          gapLabel={`+${t.jourDays(PROMISE_DAYS)}`}
          youLabel={t.jourYou}
          planLabel={t.jourPlan}
        />
        <p className="onb-promise__foot">{t.onbPromiseFoot}</p>
      </div>

      <div className="onb-lines">
        <span className="onb-lines__note">{t.onbLinesRow}</span>
        {LINE_ROUNDELS.map(line => (
          <span
            key={line.jp}
            className="onb-lines__roundel"
            style={{ '--row-color': line.color }}
            lang="ja"
          >
            {line.jp}
          </span>
        ))}
      </div>

      <div className="onb-step__actions">
        <button type="button" className="onb-action" onClick={onNext}>{t.onbContinue}</button>
      </div>
    </section>
  )
}

// ── 定期券 ───────────────────────────────────────────────────────
// 窓口 folded in (phase F): the name is asked LAST, on the
// application form, where leaving would mean abandoning a pass that
// already has a destination printed on it. Two beats in one scene:
// sign (氏名 through the same EditableUsername the profile uses,
// 発車時刻 as an optional habit hour, 申込日, the empty 印 box) →
// 発行 prints the pass — clip-path print, the seal stamping in — with
// the mutual vow beneath: あなた promise the pace, 窓口 promises the
// honest map. Board 改札へ fires the one POST and hands over to the
// TicketGate App renders.
function PassStep({
  t, lang, session, username, onUsername,
  volumes, startLevel, goal, perDay, depart, onDepart,
  printed, printedAt, onPrint, onEditApp,
  completing, error, onBoard,
}) {
  const fmtD = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const fmtDs = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', {
    day: 'numeric', month: 'short',
  })
  const fmtDy = d => `${fmtDs.format(d)} ’${String(d.getFullYear()).slice(2)}`
  const numberFmt = lang === 'fr' ? 'fr-FR' : 'en'

  if (!printed) {
    return (
      <section className="onb-step">
        <span className="onb-pa" lang="ja">まもなく発車します</span>
        <h2 className="onb-step__title" tabIndex={-1}>{t.onbSignTitle}</h2>

        <div className="onb-form">
          {/* An empty seal box, like the pass's own 駅長 impression — a
              drawing of where a stamp would go, never a label. Marked
              decorative so it is not announced as a lone 印, which is
              also why its faint dashed vermillion is not held to the
              text floor. */}
          <span className="onb-form__seal" lang="ja" aria-hidden="true">印</span>
          <div className="onb-form__head">
            <span className="onb-form__title" lang="ja">定期券申込書</span>
            <span className="onb-form__latin">{t.onbFormLatin}</span>
          </div>
          <div className="onb-form__row">
            <span className="onb-form__k"><span lang="ja">氏名</span>{t.onbFormName}</span>
            <EditableUsername username={username} session={session} onChange={onUsername} t={t} />
          </div>
          <div className="onb-form__row onb-form__row--stack">
            <span className="onb-form__k"><span lang="ja">発車時刻</span>{t.onbFormDepart}</span>
            <DepartureChips t={t} value={depart} onChange={onDepart} />
          </div>
          <div className="onb-form__row">
            <span className="onb-form__k"><span lang="ja">申込日</span>{t.onbFormDate}</span>
            <span className="onb-form__v">{fmtD.format(new Date())}</span>
          </div>
        </div>
        <p className="onb-step__hint">{t.onbDepartHint}</p>

        <div className="onb-step__actions">
          <button type="button" className="onb-action" onClick={onPrint}>
            {t.onbPrint} <span lang="ja">発行</span>
          </button>
        </div>
      </section>
    )
  }

  // The printed pass reads the clock 発行 was pressed on; the POST
  // takes its own fresh reading seconds later — same contract.
  const printNow = new Date(printedAt)
  const passDerived = volumes ? goalDerived(volumes, startLevel, goal, printNow) : null
  const svc = serviceLabel(perDay)
  const time = depart ? DEPART_TIMES[depart] : null
  const validity = goal.dest != null && passDerived?.targetDate
    ? fmtD.format(passDerived.targetDate)
    : '—'

  return (
    <section className="onb-step">
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbPassTitle}</h2>

      {/* A pass of its own, NOT <CommuterPass/> — that component prints
          profile.level, the XP level, and stamping a JLPT level into
          that slot is exactly the confusion CONTEXT.md warns about. */}
      <div className="onb-pass">
        <div className="onb-pass__head">
          <span className="onb-pass__brand" lang="ja">定期券</span>
          <span className="onb-pass__station" lang="ja">日本語駅</span>
        </div>
        <div className="onb-pass__route" lang="ja">
          {startLevel}
          <span className="onb-pass__arrow" aria-hidden="true">▶</span>
          {goal.dest ?? '未定'}
        </div>
        <div className="onb-pass__holder">
          {username || '—'}
          {time && <span className="onb-pass__departs"> · {t.onbDeparts(time)}</span>}
        </div>
        <div className="onb-pass__pattern">
          <StopPattern served={svc.pattern} dashed={svc.id === 'charter'} />
        </div>
        <div className="onb-pass__grid">
          <span className="onb-pass__cell">
            <span className="onb-pass__k" lang="ja">種別</span>
            <span className="onb-pass__v"><span lang="ja">{svc.jp}</span> · {perDay}/{t.onbGoalDay}</span>
          </span>
          <span className="onb-pass__cell">
            <span className="onb-pass__k" lang="ja">有効期限</span>
            <span className="onb-pass__v onb-pass__v--gold">{validity}</span>
          </span>
          {passDerived?.items != null && (
            <span className="onb-pass__cell">
              <span className="onb-pass__k" lang="ja">運賃</span>
              <span className="onb-pass__v">{passDerived.items.toLocaleString(numberFmt)}</span>
            </span>
          )}
          <span className="onb-pass__cell">
            <span className="onb-pass__k" lang="ja">発行</span>
            <span className="onb-pass__v">{fmtDy(printNow)}</span>
          </span>
        </div>
        <span className="onb-pass__seal" lang="ja" aria-hidden="true">日本語<br />駅長</span>
        <PassWave className="pass__wave onb-pass__wave" />
      </div>

      <div className="onb-vow">
        <div className="onb-vow__row">
          <span className="onb-vow__who" lang="ja">あなた</span>
          <span className="onb-vow__what">{t.onbVowYou(perDay, time)}</span>
        </div>
        <div className="onb-vow__row">
          <span className="onb-vow__who" lang="ja">窓口</span>
          <span className="onb-vow__what">{t.onbVowOffice}</span>
        </div>
      </div>

      {error && <p className="onb-error" role="alert">{t.onbPassError}</p>}
      <div className="onb-step__actions">
        <button type="button" className="onb-link" onClick={onEditApp} disabled={completing}>
          ← {t.onbEditApp}
        </button>
        <button type="button" className="onb-action onb-action--board" disabled={completing} onClick={onBoard}>
          {t.onbPassBoard} <span lang="ja">改札へ</span>
        </button>
      </div>
    </section>
  )
}
