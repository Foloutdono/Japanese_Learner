import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi, playCorrect } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import QuestionRenderer from '../exam/QuestionRenderer'
import EmptyState from '../components/ui/EmptyState'
import { Loading } from '../components/ui/Loading'
import { flattenQuestions, getAttempt, getExam } from '../exam/examService'
import { paperTitle } from '../exam/examKinds'
import { CheckIcon, CrossIcon, ChevronIcon, PageIcon } from '../components/ui/Icons'

// A practice target, deliberately NOT a JLPT pass mark.
//
// The blueprint's PASS_THRESHOLDS are real (backend/study/
// exam_blueprint.py), but they grade a whole 180-point exam sat in one
// go — an overall minimum plus a per-section 基準点. These papers are
// single-section practice sets, so "you passed N5" is not a claim any
// one of them can support in either direction: the sectional minimum
// alone (38/120 at N5) would call a 32% run a pass, and the overall
// minimum can't be computed from one section at all.
//
// So this is what it says on the tin — a target worth aiming at while
// practising — and the screen labels it that way rather than dressing
// a raw proportion up as an official result. See exam_blueprint.py's
// own note on 尺度得点: the real score is IRT-scaled from official item
// parameters, and no third party can reproduce it.
const PRACTICE_TARGET_PCT = 60

// Route: /exam/:examId/results
// Fast path: ExamRunner.finish() hands this screen its data directly
// via router state, no refetch needed. Slow/reload path: the URL also
// carries ?attempt=<id> (set by the same finish()), so a refreshed or
// bookmarked result page can reconstruct itself from the server —
// GET the paper and GET the persisted attempt — instead of showing a
// dead end. Only truly gone (no state AND no attempt id, e.g. someone
// hand-edits the URL) falls through to the empty state.
export default function ExamResult({ session }) {
  const { examId } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const [expandedId, setExpandedId] = useState(null)
  const [loaded, setLoaded] = useState(location.state ?? null)

  const attemptId = searchParams.get('attempt')

  // Sequential, not Promise.all: an exam id has several papers behind
  // it now, and the only one that can render THIS attempt is the
  // revision it was sat on — which the attempt row is what knows. Asked
  // for in parallel, the paper fetch would return whichever revision
  // this learner should be served NEXT, and the review below would map
  // the attempt's question ids onto a paper that doesn't contain them.
  useEffect(() => {
    if (loaded || !attemptId) return
    let alive = true
    getAttempt(examId, attemptId, session)
      .then(summary =>
        getExam(examId, session, { revision: summary.revision })
          .then(exam => { if (alive) setLoaded({ exam, summary }) }))
      .catch(() => { if (alive) setLoaded(false) })
    return () => { alive = false }
  }, [loaded, attemptId, examId, session])

  const { summary, exam } = loaded || {}
  const section = exam?.sections[0] ?? null
  const sectionStats = section ? summary?.perSection[section.id] ?? null : null
  const metTarget = (sectionStats?.pct ?? 0) >= PRACTICE_TARGET_PCT

  // Real effect (not a call in the render body) — the render-body call
  // used to re-fire on every re-render, e.g. each time a review row
  // was expanded.
  useEffect(() => {
    if (metTarget) playCorrect()
  }, [metTarget])

  if (loaded === null && attemptId) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/exam')} title={t.examTitle} autoHide />
        <Loading />
      </div>
    )
  }

  if (!summary || !exam || !sectionStats) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/exam')} title={t.examTitle} autoHide />
        <div className="container exam-shell">
          <EmptyState
            icon={<PageIcon size={40} />}
            message={t.examResultMissing}
            action={{ label: t.examBackToExams, onClick: () => navigate('/exam') }}
          />
        </div>
      </div>
    )
  }

  const questionsById = Object.fromEntries(flattenQuestions(exam).map(q => [q.id, q]))
  const review = summary.review.filter(r => r.sectionId === section.id)

  function toggle(id) {
    playUi('click-mode-selection')
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/exam')} title={paperTitle(exam, t)} autoHide />
      <div className="container exam-shell">
        <div className={`exam-result-header${metTarget ? '' : ' exam-result-header--low'}`}>
          <span className="exam-result-header__pct">{sectionStats.pct}%</span>
          <span className="exam-result-header__score">
            {sectionStats.correct} / {sectionStats.total} {t.examScoreCorrect}
          </span>
          <span className="exam-result-header__target">
            {t.examPracticeTarget} {PRACTICE_TARGET_PCT}%
          </span>
        </div>

        {/* The one screen in the app where somebody might mistake a
            generated practice number for a real JLPT result, so it says
            outright that it isn't one. */}
        <p className="exam-result-disclaimer">{t.examUnofficialNote}</p>

        <div className="exam-review">
          <h3 className="exam-review__title">{t.examReviewTitle}</h3>
          <p className="exam-review__hint">{t.examReviewHint}</p>
        </div>

        <div className="exam-review-list">
          {review.map(r => {
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
          <button type="button" className="exam-nav-btn" onClick={() => { playUi('click-screen-selection'); navigate('/exam') }}>
            {t.examBackToExams}
          </button>
          {/* A NEW paper, not this one again. Re-sitting a paper whose
              answers you have just read through tests recall of those
              answers rather than the language, so the server is asked
              for a different revision — another existing one where it
              has one (free), a freshly generated one where it doesn't.
              The excluded revision is the one just sat; the server
              would skip it anyway on the strength of the attempt now
              recorded, and saying so explicitly costs nothing. */}
          <button
            type="button"
            className="exam-nav-btn exam-nav-btn--primary"
            onClick={() => {
              playUi('click-screen-selection')
              navigate(`/exam/${examId}?exclude=${exam.revision}`, { replace: true })
            }}
          >
            {t.examNewPaper}
          </button>
        </div>
      </div>
    </div>
  )
}
