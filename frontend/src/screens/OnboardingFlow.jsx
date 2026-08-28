import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { apiJson, apiJsonWithTimeout } from '../lib/api'
import { playUi } from '../lib/audio'
import { refreshSummary } from '../stores/profileSummary'
import { EditableUsername } from '../components/profile/EditableUsername'
import { PassWave } from '../components/profile/PassWave'
import LevelSelector from '../components/selection/LevelSelector'
import PlacementTest from '../components/onboarding/PlacementTest'
import RouteProjection from '../components/onboarding/RouteProjection'
import { PACES, DEFAULT_PER_DAY } from '../components/onboarding/paces'

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

export default function OnboardingFlow({ session, initialProfile, onComplete }) {
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

  function advance(next) {
    setHistory(h => [...h, step])
    setStep(next)
  }

  function back() {
    playUi('click')
    setHistory(h => {
      const prev = h[h.length - 1]
      if (!prev) return h
      if (prev === 'placement') setPlacementResult(null)
      setStep(prev)
      return h.slice(0, -1)
    })
  }

  function complete(level, chosenPerDay) {
    if (completing) return
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
            <h2 className="onb-step__title">{t.onbTestTitle}</h2>
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
            <h2 className="onb-step__title">{t.onbMapTitle}</h2>
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
          <TourStep t={t} onNext={() => { playUi('click'); advance('pass') }} />
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
            <button type="button" className="onb-link onb-skip" onClick={skip} disabled={completing}>
              {t.onbSkip}
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
      <h2 className="onb-step__title">{t.onbWelcomeTitle}</h2>
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
      <h2 className="onb-step__title">{t.onbLevelTitle}</h2>
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
function PlacementResult({ t, result, onPick }) {
  const [choice, setChoice] = useState(result.recommendedLevel)
  return (
    <section className="onb-step">
      <h2 className="onb-step__title">{t.onbTestResultTitle}</h2>
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
  const x = i => 7 + (106 * i) / (n - 1)
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
      <h2 className="onb-step__title">{t.onbPaceTitle}</h2>
      <div className="onb-paces">
        {PACES.map(pace => (
          <button
            key={pace.id}
            type="button"
            className={['onb-pace', selected === pace.perDay && 'onb-pace--on'].filter(Boolean).join(' ')}
            onClick={() => { playUi('click-mode-selection'); onPick(pace.perDay) }}
          >
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

// ── 沿線案内 ─────────────────────────────────────────────────────
function TourStep({ t, onNext }) {
  const cards = [
    { key: 'today', jp: '本日', color: 'var(--accent2)', title: t.onbTourTodayTitle, desc: t.onbTourTodayDesc },
    { key: 'lines', jp: '学習', color: 'var(--line-kana)', title: t.onbTourLinesTitle, desc: t.onbTourLinesDesc },
    { key: 'analyzer', jp: '解析', color: 'var(--line-kaiseki)', title: t.onbTourAnalyzerTitle, desc: t.onbTourAnalyzerDesc },
    { key: 'exam', jp: '模試', color: 'var(--line-exam)', title: t.onbTourExamsTitle, desc: t.onbTourExamsDesc },
  ]
  return (
    <section className="onb-step">
      <h2 className="onb-step__title">{t.onbTourTitle}</h2>
      <div className="onb-tour">
        {cards.map(card => (
          <div key={card.key} className="onb-tour__card" style={{ '--row-color': card.color }}>
            <span className="onb-tour__roundel" lang="ja">{card.jp}</span>
            <span className="onb-tour__text">
              <span className="onb-tour__title">{card.title}</span>
              <span className="onb-tour__desc">{card.desc}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="onb-step__actions">
        <button type="button" className="onb-action" onClick={onNext}>{t.onbContinue}</button>
      </div>
    </section>
  )
}

// ── 定期券 ───────────────────────────────────────────────────────
function PassStep({ t, username, level, perDay, completing, error, onBoard }) {
  const pace = PACES.find(p => p.perDay === perDay)
  return (
    <section className="onb-step">
      <h2 className="onb-step__title">{t.onbPassTitle}</h2>

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
