import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi, playCorrect } from '../lib/audio'
import QuestionRenderer from '../exam/QuestionRenderer'
import EmptyState from '../components/ui/EmptyState'
import { Loading } from '../components/ui/Loading'
import { flattenQuestions, getAttempt, getExam } from '../exam/examService'
import { CheckIcon, CrossIcon, ChevronIcon, PageIcon } from '../components/ui/Icons'

// Provisional until backend/study/exam_blueprint.py's per-level
// PASS_THRESHOLDS lands (see the JLPT mock-exam plan) — the official
// exam has a real sectional minimum per level, not one flat 60% cutoff
// for every section. This is a placeholder honest enough to build the
// rest of the result screen against, not the final rule.
const PASS_PCT = 60

// Route: /exam/:examId/:sectionId/results
// Fast path: ExamRunner.finish() hands this screen its data directly
// via router state, no refetch needed. Slow/reload path: the URL also
// carries ?attempt=<id> (set by the same finish()), so a refreshed or
// bookmarked result page can reconstruct itself from the server —
// GET the paper and GET the persisted attempt — instead of showing a
// dead end. Only truly gone (no state AND no attempt id, e.g. someone
// hand-edits the URL) falls through to the empty state.
export default function ExamResult({ session }) {
  const { examId, sectionId } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const [expandedId, setExpandedId] = useState(null)
  const [loaded, setLoaded] = useState(location.state ?? null)

  const attemptId = searchParams.get('attempt')

  useEffect(() => {
    if (loaded || !attemptId) return
    let alive = true
    Promise.all([getExam(examId, session), getAttempt(examId, attemptId, session)])
      .then(([exam, summary]) => { if (alive) setLoaded({ exam, summary }) })
      .catch(() => { if (alive) setLoaded(false) })
    return () => { alive = false }
  }, [loaded, attemptId, examId, session])

  const { summary, exam } = loaded || {}
  const sectionStats = summary?.perSection[sectionId] ?? null
  const passed = (sectionStats?.pct ?? 0) >= PASS_PCT

  // Real effect (not a call in the render body) — the render-body call
  // used to re-fire on every re-render, e.g. each time a review row
  // was expanded, once the scorePct bug below stopped masking it.
  useEffect(() => {
    if (passed) playCorrect()
  }, [passed])

  if (loaded === null && attemptId) {
    return <Loading />
  }

  if (!summary || !exam || !sectionStats) {
    return (
      <EmptyState
        icon={<PageIcon size={40} />}
        message={t.examResultMissing}
        action={{ label: t.examBackToSections, onClick: () => navigate(`/exam/${examId}`) }}
      />
    )
  }

  const section = exam.sections.find(s => s.id === sectionId)
  const questionsById = Object.fromEntries(flattenQuestions(exam).map(q => [q.id, q]))

  function toggle(id) {
    playUi('click-mode-selection')
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="exam-shell">
      <div className={`quiz-done exam-result-header${passed ? '' : ' exam-result-header--low'}`}>
        <span className="exam-result-header__score">{sectionStats.correct} / {sectionStats.total}</span>
        {/* Per-section percentage, not the old whole-paper scorePct —
            that field divided one section's correct count by every
            question in the paper (examService.js used to), so a
            perfect vocabulary-only run displayed 37%. See
            exam_scoring.py's module docstring. */}
        <span className="exam-result-header__pct">{sectionStats.pct}%</span>
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
                  <span className="exam-review-row__icon" aria-hidden="true">{r.isCorrect ? <CheckIcon size={14} /> : <CrossIcon size={14} />}</span>
                  <span className="exam-review-row__number">
                    {t.examQuestionAbbrev}{q.number}
                  </span>
                  <span className="exam-review-row__chevron" aria-hidden="true"><ChevronIcon direction={isOpen ? 'up' : 'down'} size={14} /></span>
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
          {t.examBackToSections}
        </button>
        <button
          type="button"
          className="exam-nav-btn exam-nav-btn--primary"
          onClick={() => { playUi('click-screen-selection'); navigate(`/exam/${examId}/${sectionId}`, { replace: true }) }}
        >
          {t.examRetrySection}
        </button>
      </div>
    </div>
  )
}
