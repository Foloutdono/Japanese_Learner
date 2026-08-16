import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { CardTransition } from '../components/study/CardTransition'
import { Loading } from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { getExam, flattenQuestions, submitAttempt } from '../exam/examService'
import QuestionRenderer from '../exam/QuestionRenderer'
import { PageIcon, ChevronIcon } from '../components/ui/Icons'

// Route: /exam/:examId/:sectionId
// Renders one question at a time from the chosen section, in order,
// via CardTransition so moving between questions gets the same
// crossfade Kana/Kanji/Vocab already use — no new animation language.
//
// `devMode` is wired to a query flag for now (?dev=1), purely so
// whoever is splitting audio/images can QA a question without
// spoiling it for real learners. Flip this to however your app gates
// dev tooling elsewhere once that exists.
export default function ExamRunner({ session }) {
  const { examId, sectionId } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const devMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1'

  const [exam, setExam] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [startedAt] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    getExam(examId, session).then(e => { if (alive) setExam(e) })
    return () => { alive = false }
  }, [examId, session])

  const questions = useMemo(() => {
    if (!exam) return []
    return flattenQuestions(exam).filter(q => q.sectionId === sectionId)
  }, [exam, sectionId])

  if (!exam) {
    return <Loading />
  }

  if (questions.length === 0) {
    return <EmptyState icon={<PageIcon size={40} />} message={t.examSectionEmpty} />
  }

  const section = exam.sections.find(s => s.id === sectionId)
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
    playUi('click-screen-selection')
    // section_id travels in the payload so the server can persist
    // which section this attempt belongs to (a paper can have several).
    const summary = await submitAttempt(examId, { sectionId, answers, startedAt, finishedAt: Date.now() }, session)
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
        <span className="exam-shell__count">{index + 1} / {questions.length}</span>
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
