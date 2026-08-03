import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi, playSfx } from '../components/sound'
import QuestionRenderer from '../exam/QuestionRenderer'
import { flattenQuestions } from '../exam/examService'

// Route: /exam/:examId/:sectionId/result
// Reads its data from router state (handed off by ExamRunner.finish())
// rather than refetching — a finished attempt is local-only for now
// (see examService's submitAttempt), so there's nothing to fetch by
// URL yet. Once attempts are persisted server-side, this becomes
// `getAttempt(attemptId)` keyed off a route param instead, and the
// rest of the screen is unaffected.
export default function ExamResult() {
  const { examId, sectionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLang()
  const [expandedId, setExpandedId] = useState(null)

  const { summary, exam } = location.state ?? {}

  if (!summary || !exam) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🗒️</div>
        <p className="empty-state__message">{t.examResultMissing ?? "This result isn't available — start the section again."}</p>
        <button type="button" className="empty-state__action" onClick={() => navigate(`/exam/${examId}`)}>
          {t.examBackToSections ?? 'Back to sections'}
        </button>
      </div>
    )
  }

  const section = exam.sections.find(s => s.id === sectionId)
  const questionsById = Object.fromEntries(flattenQuestions(exam).map(q => [q.id, q]))
  const sectionStats = summary.perSection[sectionId] ?? { correct: 0, total: 0 }

  const passed = summary.scorePct >= 60
  if (passed) playSfx('success')

  function toggle(id) {
    playUi('click-mode-selection')
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="exam-shell">
      <div className={`quiz-done exam-result-header${passed ? '' : ' exam-result-header--low'}`}>
        <span className="exam-result-header__score">{sectionStats.correct} / {sectionStats.total}</span>
        <span className="exam-result-header__pct">{summary.scorePct}%</span>
        <span className="exam-result-header__label" lang="ja">{section.labelJp}</span>
      </div>

      <div className="exam-review-list">
        {summary.review
          .filter(r => r.sectionId === sectionId)
          .map(r => {
            const q = questionsById[r.id]
            const isOpen = expandedId === r.id
            return (
              <div key={r.id} className={`exam-review-row${r.isCorrect ? ' exam-review-row--correct' : ' exam-review-row--wrong'}`}>
                <button type="button" className="exam-review-row__summary" onClick={() => toggle(r.id)} aria-expanded={isOpen}>
                  <span className="exam-review-row__icon" aria-hidden="true">{r.isCorrect ? '✓' : '✗'}</span>
                  <span className="exam-review-row__number">
                    {t.examQuestionAbbrev ?? 'Q'}{q.number}
                  </span>
                  <span className="exam-review-row__chevron" aria-hidden="true">{isOpen ? '︿' : '﹀'}</span>
                </button>
                {isOpen && (
                  <div className="exam-review-row__detail">
                    <QuestionRenderer question={q} selected={r.given} onSelect={() => {}} revealed devMode={false} />
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <div className="exam-nav-buttons">
        <button type="button" className="exam-nav-btn" onClick={() => { playUi('click-screen-selection'); navigate(`/exam/${examId}`) }}>
          {t.examBackToSections ?? 'Back to sections'}
        </button>
        <button
          type="button"
          className="exam-nav-btn exam-nav-btn--primary"
          onClick={() => { playUi('click-screen-selection'); navigate(`/exam/${examId}/${sectionId}`, { replace: true }) }}
        >
          {t.examRetrySection ?? 'Retry section'}
        </button>
      </div>
    </div>
  )
}
