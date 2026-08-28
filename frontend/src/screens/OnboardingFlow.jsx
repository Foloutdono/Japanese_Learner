import { useEffect, useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { apiJson, apiJsonWithTimeout } from '../lib/api'
import { playUi } from '../lib/audio'
import { refreshSummary } from '../stores/profileSummary'
import { EditableUsername } from '../components/profile/EditableUsername'
import { PassWave } from '../components/profile/PassWave'
import LevelSelector from '../components/selection/LevelSelector'
import PlacementTest from '../components/onboarding/PlacementTest'
import RouteProjection from '../components/onboarding/RouteProjection'
import { TrainArrival } from '../components/onboarding/TrainArrival'
import { PACES, DEFAULT_PER_DAY, paceFor } from '../components/onboarding/paces'
// The tour's demos are the REAL study components fed literal sample
// data — the exact controls the learner meets five minutes later, not
// mockups of them. RewardsPreview.jsx set the precedent: real
// component + literal payload + local state, zero backend.
import { Flashcard, CharDisplay, MeaningDisplay, DeckProgress } from '../components/study/QuizComponents'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import QuestionRenderer from '../exam/QuestionRenderer'

// ── みどりの窓口 — the ticket office ─────────────────────────────
// The onboarding flow: a full-screen stepped sequence rendered by App
// INSTEAD of the router whenever the profile has no onboarded_at —
// the same continuum Landing → Auth uses, which is why this is a
// plain component with callbacks and not a route. It is deliberately
// not a station (no stations.js/identity.js entry, no line colour of
// its own): like /profile and /settings it is about you, not
// somewhere you travel, so its rails fall back to shu-iro.
//
//   welcome → level → [placement] → pace → projection → tour → pass
//
// Nothing persists until the single POST /api/onboarding/complete at
// the end (or via skip), so a mid-flow refresh is a clean restart —
// at most two minutes lost, and no half-onboarded state to repair.
// The TicketGate finale is rendered by App, not here: this component
// unmounts the moment onComplete flips the gate state, and a cutscene
// rendered by the thing it unmounts would pop mid-wipe.

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// The flow's own stopping pattern — the steps drawn as the stations
// they are, under the office sign. The placement test is a branch of
// 乗車駅 (you are still settling where to board), not a station of its
// own, so it maps onto that stop.
const STOPS = [
  { key: 'welcome', jp: '窓口' },
  { key: 'level', jp: '乗車駅' },
  { key: 'pace', jp: '種別' },
  { key: 'projection', jp: '路線図' },
  { key: 'tour', jp: '案内' },
  { key: 'pass', jp: '定期券' },
]

function StepLine({ step, t }) {
  const nowKey = step === 'placement' ? 'level' : step
  const now = STOPS.findIndex(s => s.key === nowKey)
  return (
    <nav className="onb-line" aria-label={t.onbStepsAria(now + 1, STOPS.length)}>
      {STOPS.map((s, i) => (
        <span
          key={s.key}
          className={[
            'onb-line__stop',
            i < now && 'onb-line__stop--past',
            i === now && 'onb-line__stop--now',
          ].filter(Boolean).join(' ')}
          aria-current={i === now ? 'step' : undefined}
        >
          <span className="onb-line__marker" aria-hidden="true" />
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
  const { t } = useLang()
  const [step, setStep] = useState('welcome')
  const [history, setHistory] = useState([])
  const [username, setUsername] = useState(initialProfile?.username ?? '')
  const [levelChoice, setLevelChoice] = useState(null) // {level, source: 'picked'|'beginner'|'test'}
  const [perDay, setPerDay] = useState(null)
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

  function advance(next) {
    setHistory(h => [...h, step])
    setStep(next)
    if (next === 'tour' && !arrivalPlayedRef.current) {
      arrivalPlayedRef.current = true
      setShowArrival(true)
    }
  }

  function back() {
    playUi('click')
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

  function complete(level, chosenPerDay) {
    if (completing) return
    if (dryRun) { onComplete(); return }
    setCompleting(true)
    setCompleteError(false)
    apiJsonWithTimeout('/api/onboarding/complete', session, {
      method: 'POST',
      timeoutMs: 10000,
      body: JSON.stringify({ jlptLevel: level, dailyNewTarget: chosenPerDay }),
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
    complete(levelChoice?.level ?? 'N5', perDay ?? DEFAULT_PER_DAY)
  }

  const showBack = history.length > 0
  const showSkip = step !== 'welcome' && step !== 'pass'

  return (
    <div className="onb" data-step={step}>
      <header className="onb-header">
        <span className="onb-header__kana" lang="ja">みどりのまどぐち</span>
        <h1 className="onb-header__jp" lang="ja">みどりの窓口</h1>
        <span className="onb-header__latin">TICKET OFFICE</span>
      </header>

      <StepLine step={step} t={t} />

      <main className="onb-body">
        {showBack && (
          <button type="button" className="onb-link onb-back" onClick={back}>
            ← {t.back}
          </button>
        )}

        {step === 'welcome' && (
          <WelcomeStep
            t={t}
            session={session}
            username={username}
            onUsername={setUsername}
            onNext={() => { playUi('click'); advance('level') }}
          />
        )}

        {step === 'level' && (
          <BoardingStep
            t={t}
            onPick={level => { setLevelChoice({ level, source: 'picked' }); advance('pace') }}
            onBeginner={() => {
              playUi('click-mode-selection')
              setLevelChoice({ level: 'N5', source: 'beginner' })
              advance('pace')
            }}
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
            onPick={level => {
              setLevelChoice({ level, source: 'test' })
              advance('pace')
            }}
            onRetake={() => { playUi('click'); setPlacementResult(null) }}
          />
        )}

        {step === 'pace' && (
          <PaceStep
            t={t}
            selected={perDay}
            onPick={p => { setPerDay(p); advance('projection') }}
          />
        )}

        {step === 'projection' && (
          <section className="onb-step">
            <h2 className="onb-step__title" tabIndex={-1}>{t.onbMapTitle}</h2>
            {volumes ? (
              <RouteProjection
                volumes={volumes}
                startLevel={levelChoice?.level ?? 'N5'}
                perDay={perDay ?? DEFAULT_PER_DAY}
                includeKana={levelChoice?.source === 'beginner'}
              />
            ) : (
              <p className="onb-map__assumption">{t.onbMapUnavailable}</p>
            )}
            <div className="onb-step__actions">
              <button type="button" className="onb-action" onClick={() => { playUi('click'); advance('tour') }}>
                {t.onbContinue}
              </button>
            </div>
          </section>
        )}

        {step === 'tour' && (
          <>
            <TourStep t={t} onNext={() => { playUi('click'); advance('pass') }} />
            {/* A pure overlay — the tour above is mounted and usable
                underneath from frame one; nothing waits on it. */}
            {showArrival && (
              <TrainArrival jp="案内" title={t.onbTourTitle} onDone={() => setShowArrival(false)} />
            )}
          </>
        )}

        {step === 'pass' && (
          <PassStep
            t={t}
            username={username}
            level={levelChoice?.level ?? 'N5'}
            perDay={perDay ?? DEFAULT_PER_DAY}
            completing={completing}
            error={completeError}
            onBoard={() => complete(levelChoice?.level ?? 'N5', perDay ?? DEFAULT_PER_DAY)}
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

// ── ようこそ ─────────────────────────────────────────────────────
function WelcomeStep({ t, session, username, onUsername, onNext }) {
  return (
    <section className="onb-step">
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbWelcomeTitle}</h2>
      <p className="onb-step__body">{t.onbWelcomeBody}</p>

      <div className="onb-name">
        <span className="onb-name__label">{t.onbWelcomeNameHint}</span>
        <EditableUsername username={username} session={session} onChange={onUsername} t={t} />
      </div>

      <div className="onb-step__actions">
        <button type="button" className="onb-action" onClick={onNext}>{t.onbContinue}</button>
      </div>
    </section>
  )
}

// ── 乗車駅 ───────────────────────────────────────────────────────
function BoardingStep({ t, onPick, onBeginner, onTest }) {
  return (
    <section className="onb-step">
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbLevelTitle}</h2>
      <LevelSelector onSelect={onPick} />

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

// ── 種別 ─────────────────────────────────────────────────────────
// Which stations of a six-stop line each service actually calls at —
// the stopping-pattern diagram that is how a real 種別 board says
// "how fast" without a word. All six for the local, a skip-stop
// pattern for the rapid, the two ends for the limited express.
const PACE_PATTERNS = {
  local:   [1, 1, 1, 1, 1, 1],
  rapid:   [1, 0, 1, 0, 1, 1],
  express: [1, 0, 0, 0, 0, 1],
}

function StopPattern({ served }) {
  const n = served.length
  // n<=1 guard: a one-stop pattern would divide by zero; centre it.
  const x = i => (n <= 1 ? 60 : 7 + (106 * i) / (n - 1))
  return (
    <svg className="onb-pace__pattern" viewBox="0 0 120 14" aria-hidden="true">
      <line className="onb-pace__pattern-rail" x1="7" y1="7" x2="113" y2="7" />
      {served.map((s, i) => (
        <circle
          key={i}
          className={s ? 'onb-pace__pattern-stop' : 'onb-pace__pattern-skip'}
          cx={x(i)} cy="7" r={s ? 4 : 2}
        />
      ))}
    </svg>
  )
}

function PaceStep({ t, selected, onPick }) {
  const hints = { local: t.onbPaceHintLocal, rapid: t.onbPaceHintRapid, express: t.onbPaceHintExpress }
  const names = { local: t.onbPaceLocal, rapid: t.onbPaceRapid, express: t.onbPaceExpress }
  return (
    <section className="onb-step">
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbPaceTitle}</h2>
      <div className="onb-paces">
        {PACES.map(pace => (
          <button
            key={pace.id}
            type="button"
            className={['onb-pace', selected === pace.perDay && 'onb-pace--on'].filter(Boolean).join(' ')}
            onClick={() => { playUi('click-mode-selection'); onPick(pace.perDay) }}
          >
            {pace.recommended && (
              <span className="onb-reco-badge">{t.onbPaceRecommended}</span>
            )}
            <span className="onb-pace__jp" lang="ja">{pace.jp}</span>
            <span className="onb-pace__name">{names[pace.id]}</span>
            <StopPattern served={PACE_PATTERNS[pace.id]} />
            <span className="onb-pace__per-day">{t.onbPacePerDay(pace.perDay)}</span>
            <span className="onb-pace__hint">{hints[pace.id]}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ── 沿線案内 — the tour, with the real thing on every card ──────
// Each line is presented by a working piece of itself: the actual
// production component, fed a literal sample, tappable right here.
// Words about a flashcard cannot compete with flipping one. Every
// card keeps its own real --line-* colour (the old "study lines"
// bucket borrowed kana's vermillion for four different lines, against
// the app's own one-line-one-colour rule).

const TOUR_TODAY_STATS = { total: 24, new: 10, learning: 9, mastered: 5 }

// One pre-analysed N5 sentence, shaped exactly like analyze_local's
// output. Tokens deliberately carry no vocab_match/kanji_matches:
// TokenCard renders them as plain content (no dead lookups), and
// wordColor falls back honestly to the neutral status colour.
const TOUR_ANALYSIS = {
  text: '猫が好きです',
  level: 'N5',
  unknown_count: 1,
  off_deck_count: 0,
  tokens: [
    { surface: '猫', furigana: [{ text: '猫', reading: 'ねこ' }], reading: 'ねこ', pos: 'noun', meaning: 'cat; kitten, feline' },
    { surface: 'が', furigana: [{ text: 'が' }], pos: 'particle', meaning: 'subject marker' },
    { surface: '好き', furigana: [{ text: '好き', reading: 'すき' }], reading: 'すき', pos: 'adjective', meaning: 'liked; fond of' },
    { surface: 'です', furigana: [{ text: 'です' }], pos: 'auxiliary', meaning: 'polite copula' },
  ],
  grammar: [{ raw_id: 'onb-tour-ga-suki', start: 0, pattern: '～が好きです', level: 'N5' }],
  explanation: 'A likes/dislikes sentence: what is liked is marked by が, not を.',
}

// One flattened mcq-text question, the shape QuestionRenderer's
// McqBlock consumes (see exam/examService.flattenQuestions).
const TOUR_EXAM_QUESTION = {
  type: 'mcq-text',
  promptJp: '＿＿＿は　がくせいです。',
  choiceType: 'text',
  choices: [
    { id: 'a', textJp: 'わたし' },
    { id: 'b', textJp: 'たべる' },
    { id: 'c', textJp: 'あつい' },
    { id: 'd', textJp: 'きのう' },
  ],
  answer: 'a',
}

function TourCard({ jp, color, title, desc, t, children }) {
  return (
    <div className="onb-tour__card" style={{ '--row-color': color }}>
      <span className="onb-tour__head">
        <span className="onb-tour__roundel" lang="ja">{jp}</span>
        <span className="onb-tour__text">
          <span className="onb-tour__title">{title}</span>
          <span className="onb-tour__desc">{desc}</span>
        </span>
      </span>
      <div className="onb-tour__demo">
        <span className="onb-tour__try">{t.onbTourTryIt}</span>
        {children}
      </div>
    </div>
  )
}

function TourStep({ t, onNext }) {
  const [tokenIndex, setTokenIndex] = useState(0)
  const [examSelected, setExamSelected] = useState(null)
  const [examAnswered, setExamAnswered] = useState(false)

  return (
    <section className="onb-step">
      <h2 className="onb-step__title" tabIndex={-1}>{t.onbTourTitle}</h2>
      <div className="onb-tour">
        <TourCard jp="本日" color="var(--accent2)" title={t.onbTourTodayTitle} desc={t.onbTourTodayDesc} t={t}>
          <DeckProgress stats={TOUR_TODAY_STATS} />
        </TourCard>

        <TourCard jp="単語" color="var(--line-vocab)" title={t.onbTourVocabTitle} desc={t.onbTourVocabDesc} t={t}>
          <div className="onb-tour__flashcard">
            <Flashcard
              t={t}
              resetKey="onb-tour-vocab"
              front={<CharDisplay char="猫" size={56} />}
              back={<MeaningDisplay meaning="cat; kitten, feline" size={20} />}
            />
          </div>
        </TourCard>

        <TourCard jp="解析" color="var(--line-kaiseki)" title={t.onbTourAnalyzerTitle} desc={t.onbTourAnalyzerDesc} t={t}>
          <SentenceBreakdown
            analysis={TOUR_ANALYSIS}
            t={t}
            layout="stepper"
            index={tokenIndex}
            setIndex={setTokenIndex}
            onTokenClick={() => {}}
            onKanjiClick={() => {}}
          />
        </TourCard>

        <TourCard jp="模試" color="var(--line-exam)" title={t.onbTourExamsTitle} desc={t.onbTourExamsDesc} t={t}>
          <QuestionRenderer
            question={TOUR_EXAM_QUESTION}
            selected={examSelected}
            onSelect={id => { setExamSelected(id); setExamAnswered(true) }}
            revealed={examAnswered}
          />
          {examAnswered && (
            <button
              type="button"
              className="onb-link onb-tour__again"
              onClick={() => { playUi('click'); setExamSelected(null); setExamAnswered(false) }}
            >
              {t.onbTourTryAgain}
            </button>
          )}
        </TourCard>
      </div>
      <div className="onb-step__actions">
        <button type="button" className="onb-action" onClick={onNext}>{t.onbContinue}</button>
      </div>
    </section>
  )
}

// ── 定期券 ───────────────────────────────────────────────────────
function PassStep({ t, username, level, perDay, completing, error, onBoard }) {
  const pace = paceFor(perDay)
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
        <div className="onb-pass__main">
          <span className="onb-pass__level">{level}</span>
          <span className="onb-pass__holder">{username || '—'}</span>
        </div>
        <div className="onb-pass__foot">
          {pace && <span lang="ja">{pace.jp}</span>}
          <span>{t.onbPacePerDay(perDay)}</span>
          {/* The contactless mark every pass in the app carries — the
              same arcs the 改札 reader beyond this button is about to
              light up. */}
          <PassWave className="pass__wave onb-pass__wave" />
        </div>
      </div>

      {error && <p className="onb-error" role="alert">{t.onbPassError}</p>}
      <div className="onb-step__actions">
        <button type="button" className="onb-action onb-action--board" disabled={completing} onClick={onBoard}>
          {t.onbPassBoard} <span lang="ja">改札へ</span>
        </button>
      </div>
    </section>
  )
}
