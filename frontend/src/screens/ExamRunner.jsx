import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { CardTransition } from '../components/study/CardTransition'
import { Loading } from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { getExam, flattenQuestions, submitAttempt } from '../exam/examService'
import QuestionRenderer from '../exam/QuestionRenderer'
import { PageIcon, ChevronIcon } from '../components/ui/Icons'

// ── Mid-exam draft persistence ─────────────────────────────────
// Same load/save-wrapped-in-try/catch convention as
// hooks/useCardSession.js's loadCache/saveCache — a reload losing
// nothing is worth more than a rare storage failure being anything
// other than silent, since the exam itself works fine without it.
function draftKey(examId, sectionId) {
  return `jp-exam-draft:${examId}:${sectionId}`
}

function loadDraft(examId, sectionId) {
  try {
    const raw = window.localStorage.getItem(draftKey(examId, sectionId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDraft(examId, sectionId, draft) {
  try {
    window.localStorage.setItem(draftKey(examId, sectionId), JSON.stringify(draft))
  } catch {
    // Storage full/disabled — a reload just won't restore progress,
    // nothing else about the current attempt is affected.
  }
}

function clearDraft(examId, sectionId) {
  try {
    window.localStorage.removeItem(draftKey(examId, sectionId))
  } catch {
    // best effort
  }
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

// The shell reads the route; the scene below plays it. Keyed on
// examId:sectionId so switching sections mounts a fresh scene rather
// than reusing one whose answers/timer/draft belong to a different
// section — same shape as the ticket gate and the train door, and
// (unlike an effect that resets state on param change) the reason
// none of this component's state-restoration logic needs an effect
// that calls setState in its body at all: a fresh mount's lazy
// useState initializers just run again.
export default function ExamRunner({ session }) {
  const { examId, sectionId } = useParams()
  return <RunnerScene key={`${examId}:${sectionId}`} session={session} examId={examId} sectionId={sectionId} />
}

// Route: /exam/:examId/:sectionId
// Renders one question at a time from the chosen section, in order,
// via CardTransition so moving between questions gets the same
// crossfade Kana/Kanji/Vocab already use — no new animation language.
//
// `devMode` is wired to a query flag for now (?dev=1), purely so
// whoever is splitting audio/images can QA a question without
// spoiling it for real learners. Flip this to however your app gates
// dev tooling elsewhere once that exists.
function RunnerScene({ session, examId, sectionId }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const devMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1'

  const [exam, setExam] = useState(null)

  // Restored synchronously from localStorage at mount (examId/sectionId
  // are route params, already known — no need to wait on the exam
  // fetch), which is what lets a reload mid-section keep its answers
  // without an effect calling setState to "restore" anything.
  const [draftSnapshot] = useState(() => loadDraft(examId, sectionId))
  const [answers, setAnswers] = useState(() => draftSnapshot?.answers ?? {})
  const [index, setIndex] = useState(() => draftSnapshot?.index ?? 0)
  const [startedAt] = useState(() => draftSnapshot?.startedAt ?? Date.now())

  // A heartbeat, not a clock: its value is never read, only its
  // change forces a re-render each second so the derived `timeLeft`
  // below gets recomputed against a fresh Date.now(). setTick only
  // ever runs inside the interval's callback, never synchronously in
  // the effect body itself.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const submitting = useRef(false)

  useEffect(() => {
    let alive = true
    getExam(examId, session).then(e => { if (alive) setExam(e) })
    return () => { alive = false }
  }, [examId, session])

  const questions = useMemo(() => {
    if (!exam) return []
    return flattenQuestions(exam).filter(q => q.sectionId === sectionId)
  }, [exam, sectionId])

  const section = exam?.sections.find(s => s.id === sectionId)

  // Derived, not stored: recomputed every render (the tick heartbeat
  // above is what makes "every render" include "every second"), so
  // there's no separate seed-once state to keep in sync with a resumed
  // attempt's real startedAt.
  const deadline = section ? startedAt + section.timeLimitMin * 60 * 1000 : null
  const timeLeft = deadline !== null ? Math.max(0, (deadline - Date.now()) / 1000) : null
  const isTimeUp = timeLeft !== null && timeLeft <= 0

  // Persisting to localStorage is exactly the kind of "update an
  // external system with the latest state from React" an effect is
  // for — unlike setState, it's the encouraged case, not the flagged one.
  useEffect(() => {
    if (!exam) return
    saveDraft(examId, sectionId, { answers, index, startedAt })
  }, [exam, examId, sectionId, answers, index, startedAt])

  useEffect(() => {
    if (isTimeUp) finish()
    // finish() closes over current answers/startedAt/etc, and re-runs
    // only when isTimeUp itself flips — it isn't a real missing dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeUp])

  if (!exam) {
    return <Loading />
  }

  if (questions.length === 0) {
    return <EmptyState icon={<PageIcon size={40} />} message={t.examSectionEmpty} />
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
    // a manual "Finish section" click — without it that's two POSTs
    // and two exam_attempts rows for one attempt.
    if (submitting.current) return
    submitting.current = true
    playUi('click-screen-selection')
    // section_id travels in the payload so the server can persist
    // which section this attempt belongs to (a paper can have several).
    const summary = await submitAttempt(examId, { sectionId, answers, startedAt, finishedAt: Date.now() }, session)
    clearDraft(examId, sectionId)
    // attempt id in the URL (not just router state) is what makes a
    // reloaded result page recoverable — see ExamResult. The route
    // itself is /results (plural, App.jsx:124); this used to navigate
    // to the singular /result, which no registered route ever
    // matched, so the result screen never rendered.
    navigate(`/exam/${examId}/${sectionId}/results?attempt=${summary.attemptId}`, { state: { summary, exam } })
  }

  return (
    <div className="exam-shell">
      <div className="exam-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="exam-progress-bar__fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="exam-shell__meta">
        <span className="exam-shell__section" lang="ja">{section.labelJp}</span>
        <span className="exam-shell__meta-right">
          {timeLeft !== null && (
            <span className="exam-shell__timer" style={{ '--timer-color': timeLeft < 60 ? 'var(--danger)' : undefined }}>
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
  )
}
