import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../components/sound'
import { CardTransition } from '../components/CardTransition'
import { getExam, flattenQuestions, submitAttempt } from '../exam/examService'
import QuestionRenderer from '../exam/QuestionRenderer'

// Route: /exam/:examId/:sectionId
// Renders one question at a time from the chosen section, in order,
// via CardTransition so moving between questions gets the same
// crossfade Kana/Kanji/Vocab already use — no new animation language.
//
// `devMode` is wired to a query flag for now (?dev=1), purely so
// whoever is splitting audio/images can QA a question without
// spoiling it for real learners. Flip this to however your app gates
// dev tooling elsewhere once that exists.
export default function ExamRunner() {
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
    getExam(examId).then(e => { if (alive) setExam(e) })
    return () => { alive = false }
  }, [examId])

  const questions = useMemo(() => {
    if (!exam) return []
    return flattenQuestions(exam).filter(q => q.sectionId === sectionId)
  }, [exam, sectionId])

  if (!exam) {
    return (
      <div className="quiz-loading">
        <svg className="quiz-loading__ensor" viewBox="0 0 48 48">
          <circle className="quiz-loading__ensor-circle" cx="24" cy="24" r="19" fill="none" strokeWidth="3" />
        </svg>
        <span className="quiz-loading__text">{t.loading ?? 'Loading…'}</span>
      </div>
    )
  }

  if (questions.length === 0) {
    return <div className="empty-state"><p className="empty-state__message">{t.examSectionEmpty ?? 'This section has no questions yet.'}</p></div>
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
    const summary = await submitAttempt(examId, { answers, startedAt, finishedAt: Date.now() })
    navigate(`/exam/${examId}/${sectionId}/result`, { state: { summary, exam, sectionId } })
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
        <button type="button" className="exam-nav-btn" disabled={index === 0} onClick={goBack}>
          {t.back ?? 'Back'}
        </button>
        <span className="exam-nav-buttons__hint">{answeredCount} / {questions.length} {t.examAnswered ?? 'answered'}</span>
        {isLast ? (
          <button type="button" className="exam-nav-btn exam-nav-btn--primary" onClick={finish}>
            {t.examFinishSection ?? 'Finish section'}
          </button>
        ) : (
          <button type="button" className="exam-nav-btn exam-nav-btn--primary" onClick={goNext}>
            {t.next ?? 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
