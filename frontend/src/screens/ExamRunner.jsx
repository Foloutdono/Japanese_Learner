import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import { CardTransition } from '../components/study/CardTransition'
import EmptyState from '../components/ui/EmptyState'
import { getExam, flattenQuestions, submitAttempt } from '../exam/examService'
import { paperTitle } from '../exam/examKinds'
import QuestionRenderer from '../exam/QuestionRenderer'
import { PageIcon, ChevronIcon } from '../components/ui/Icons'

// Poll cadence while the server generates a paper (it answers 202 until
// the paper exists). Starts responsive, backs off geometrically so a
// slow generation isn't polled dozens of times.
const POLL_START_MS = 3000
const POLL_MAX_MS = 10000

// ── Mid-exam draft persistence ─────────────────────────────────
// Same load/save-wrapped-in-try/catch convention as
// hooks/useCardSession.js's loadCache/saveCache — a reload losing
// nothing is worth more than a rare storage failure being anything
// other than silent, since the exam itself works fine without it.
//
// Keyed by REVISION as well as exam id: one exam id now has several
// papers behind it (see backend/study/exam_schema.py), and a draft
// restored onto a different revision would put answers against question
// ids that paper doesn't contain.
function draftKey(examId, revision) {
  return `jp-exam-draft:${examId}:${revision}`
}

function loadDraft(examId, revision) {
  try {
    const raw = window.localStorage.getItem(draftKey(examId, revision))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDraft(examId, revision, draft) {
  try {
    window.localStorage.setItem(draftKey(examId, revision), JSON.stringify(draft))
  } catch {
    // Storage full/disabled — a reload just won't restore progress,
    // nothing else about the current attempt is affected.
  }
}

function clearDraft(examId, revision) {
  try {
    window.localStorage.removeItem(draftKey(examId, revision))
  } catch {
    // best effort
  }
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

// The shell reads the route; the scene below plays it. Keyed on examId
// so switching papers mounts a fresh scene rather than reusing one
// whose answers/timer/draft belong to a different paper — and (unlike
// an effect that resets state on param change) the reason none of this
// component's state-restoration logic needs an effect that calls
// setState in its body at all: a fresh mount's lazy useState
// initializers just run again.
export default function ExamRunner({ session }) {
  const { examId } = useParams()
  // ?exclude=<revision> — "not that paper, I've seen it". Part of the
  // key below so arriving from the picker's fresh-paper action while
  // already on this route mounts a new scene rather than reusing one
  // holding the paper being excluded.
  const [searchParams] = useSearchParams()
  const exclude = searchParams.get('exclude')
  // Retrying a failed generation bumps this, which remounts the scene
  // — the same keyed-remount trick as switching papers, rather than an
  // effect that reaches back in and resets the scene's own state.
  const [attempt, setAttempt] = useState(0)
  return (
    <RunnerScene
      key={`${examId}:${exclude ?? ''}:${attempt}`}
      session={session}
      examId={examId}
      exclude={exclude}
      onRetry={() => setAttempt(n => n + 1)}
    />
  )
}

// Route: /exam/:examId
// Renders one question at a time, in order, via CardTransition so
// moving between questions gets the same crossfade Kana/Kanji/Vocab
// already use — no new animation language.
//
// The section is read off the paper rather than the URL: every
// generator emits exactly one section (see each backend/study/
// exam_*_gen.py), so a /:sectionId segment was a route parameter with
// exactly one legal value, and the screen that made the learner pick
// it has been removed.
//
// `devMode` is wired to a query flag (?dev=1), purely so whoever is
// QAing generated audio can check a question without spoiling it for
// real learners.
function RunnerScene({ session, examId, exclude, onRetry }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const devMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1'

  // null = still loading, false = generation failed (see the catch
  // below); anything else is the paper itself.
  const [exam, setExam] = useState(null)

  // Restored when the paper arrives, not at mount: which draft belongs
  // to this session depends on the paper's revision, and that isn't
  // known until the fetch resolves. Until then there is nothing to
  // restore anyway — the generating screen is what's on display.
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [startedAt, setStartedAt] = useState(null)

  // A heartbeat, not a clock: its value is never read, only its change
  // forces a re-render each second so the derived `timeLeft` below gets
  // recomputed against a fresh Date.now().
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const submitting = useRef(false)

  // Seconds until another generation attempt is allowed, when the last
  // one failed. 0 means "retry freely".
  const [retryAfter, setRetryAfter] = useState(0)

  // Generation runs on the server's own thread and answers 202 until
  // the paper exists, so this polls rather than holding one request
  // open for the minutes a paper takes to build. Backing off from 3s to
  // 10s keeps the first-ready case snappy without hammering a
  // generation that turns out to be a long one.
  useEffect(() => {
    let alive = true
    let timer = null
    let delay = POLL_START_MS

    const poll = () => {
      getExam(examId, session, { exclude })
        .then(e => {
          if (!alive) return
          if (e?.generating) {
            timer = setTimeout(poll, delay)
            delay = Math.min(delay * 1.5, POLL_MAX_MS)
            return
          }
          const draft = loadDraft(examId, e.revision)
          setAnswers(draft?.answers ?? {})
          setIndex(draft?.index ?? 0)
          setStartedAt(draft?.startedAt ?? Date.now())
          setExam(e)
        })
        // An LLM-backed paper can genuinely fail to generate (the writer
        // being rate-limited or out of credit is a 503 from
        // routes/exams.py, not a bug). This used to leave setExam never
        // called, so the screen sat on its spinner forever with no way
        // out — now it says what happened and offers a retry.
        .catch(err => {
          if (!alive) return
          setRetryAfter(err?.retryAfter ?? 0)
          setExam(false)
        })
    }

    poll()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [examId, session, exclude])

  const questions = useMemo(() => (exam ? flattenQuestions(exam) : []), [exam])

  const section = exam ? exam.sections[0] : null

  // Derived, not stored: recomputed every render (the tick heartbeat
  // above is what makes "every render" include "every second").
  const deadline = section && startedAt ? startedAt + section.timeLimitMin * 60 * 1000 : null
  const timeLeft = deadline !== null ? Math.max(0, (deadline - Date.now()) / 1000) : null
  const isTimeUp = timeLeft !== null && timeLeft <= 0

  useEffect(() => {
    if (!exam || !startedAt) return
    saveDraft(examId, exam.revision, { answers, index, startedAt })
  }, [exam, examId, answers, index, startedAt])

  useEffect(() => {
    if (isTimeUp) finish()
    // finish() closes over current answers/startedAt/etc, and re-runs
    // only when isTimeUp itself flips — it isn't a real missing dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeUp])

  // ── Generating ──
  // Not the shared <Loading/>: opening a never-before-seen paper runs
  // four-plus LLM calls per mondai and takes a minute or two, and a
  // bare spinner for that long reads as "broken", not as "working".
  // Saying what's happening (and that it only happens once) is the
  // difference between waiting and giving up.
  if (exam === null) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/exam')} title={t.examTitle} autoHide />
        <div className="container exam-shell">
          <div className="exam-generating">
            <div className="exam-generating__brush" aria-hidden="true">
              <span className="exam-generating__stroke" />
              <span className="exam-generating__stroke" />
              <span className="exam-generating__stroke" />
            </div>
            <p className="exam-generating__title">{t.examGenerating}</p>
            <p className="exam-generating__hint">{t.examGeneratingHint}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Generation failed ──
  // The retry button is withheld while the server is in its cooldown
  // window: a click during it can only get the same 503 back, and this
  // button used to be an unguarded trigger for a full multi-minute,
  // dozens-of-model-calls generation cascade.
  if (exam === false) {
    const waitMinutes = Math.ceil(retryAfter / 60)
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/exam')} title={t.examTitle} autoHide />
        <div className="container exam-shell">
          <EmptyState
            icon={<PageIcon size={40} />}
            message={t.examLoadFailed}
            hint={retryAfter > 0 ? t.examLoadFailedCooldown(waitMinutes) : t.examLoadFailedHint}
            action={retryAfter > 0 ? undefined : { label: t.examRetry, onClick: onRetry }}
          />
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/exam')} title={t.examTitle} autoHide />
        <div className="container exam-shell">
          <EmptyState
            icon={<PageIcon size={40} />}
            message={t.examSectionEmpty}
            action={{ label: t.examBackToExams, onClick: () => navigate('/exam') }}
          />
        </div>
      </div>
    )
  }

  const current = questions[index]
  const mondai = section.mondai.find(m => m.id === current.mondaiId)
  const isLast = index === questions.length - 1
  const selected = answers[current.id] ?? null
  const answeredCount = Object.keys(answers).length
  const progressPct = Math.round(((index + 1) / questions.length) * 100)

  function select(choiceId) {
    setAnswers(prev => ({ ...prev, [current.id]: choiceId }))
  }

  function goNext() {
    playUi('click-mode-selection')
    setIndex(i => i + 1)
  }

  function goBack() {
    playUi('click-mode-selection')
    setIndex(i => i - 1)
  }

  async function finish() {
    // Guards against the countdown hitting zero in the same window as
    // a manual "Finish" click — without it that's two POSTs and two
    // exam_attempts rows for one attempt.
    if (submitting.current) return
    submitting.current = true
    playUi('click-screen-selection')
    const summary = await submitAttempt(
      examId,
      // The revision travels with the submission so the server scores
      // against the paper actually sat — by then it is one the server's
      // own selection rule would no longer offer, precisely because
      // this attempt is about to exist.
      { sectionId: section.id, revision: exam.revision, answers, startedAt, finishedAt: Date.now() },
      session,
    )
    clearDraft(examId, exam.revision)
    // attempt id in the URL (not just router state) is what makes a
    // reloaded result page recoverable — see ExamResult.
    navigate(`/exam/${examId}/results?attempt=${summary.attemptId}`, { state: { summary, exam } })
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/exam')} title={paperTitle(exam, t)} autoHide />
      <div className="container exam-shell">
        <div className="exam-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="exam-progress-bar__fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="exam-shell__meta">
          <span className="exam-shell__section" lang="ja">{section.labelJp}</span>
          <span className="exam-shell__meta-right">
            {timeLeft !== null && (
              <span
                className={`exam-shell__timer${timeLeft < 60 ? ' exam-shell__timer--low' : ''}`}
                role="timer"
              >
                {formatTime(timeLeft)}
              </span>
            )}
            <span className="exam-shell__count">{index + 1} / {questions.length}</span>
          </span>
        </div>

        <div className="exam-mondai-instructions">
          <span className="exam-mondai-instructions__label" lang="ja">もんだい{mondai.number}</span>
          <p className="exam-mondai-instructions__text" lang="ja">{mondai.instructionsJp}</p>
        </div>

        <CardTransition cardKey={current.id} className="exam-card-stage">
          <div className="prompt-card exam-card">
            <QuestionRenderer question={current} selected={selected} onSelect={select} devMode={devMode} />
          </div>
        </CardTransition>

        <div className="exam-nav-buttons">
          {/* Reuses ReviewDeck's prev/next wording (see quizModes' review
              mode) rather than inventing a third "back"/"next" pair —
              t.back is a bare icon-only button made for TopBar's compact
              style, not a fit here. */}
          <button type="button" className="exam-nav-btn" disabled={index === 0} onClick={goBack}>
            <ChevronIcon direction="left" size={14} /> {t.reviewPrev}
          </button>
          <span className="exam-nav-buttons__hint">{answeredCount} / {questions.length} {t.examAnswered}</span>
          {isLast ? (
            <button type="button" className="exam-nav-btn exam-nav-btn--primary" onClick={finish}>
              {t.examFinishSection}
            </button>
          ) : (
            <button type="button" className="exam-nav-btn exam-nav-btn--primary" onClick={goNext}>
              {t.reviewNext} <ChevronIcon direction="right" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
