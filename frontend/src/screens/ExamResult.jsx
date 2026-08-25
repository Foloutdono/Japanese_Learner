import { useEffect, useMemo, useState } from 'react'
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

// Geometry of the score ring. A bare red "48%" says you did badly
// without ever saying badly against what — on the ring, the target sits
// as a tick you can see yourself falling short of or clearing.
const RING_SIZE = 132
const RING_STROKE = 9
const RING_R = (RING_SIZE - RING_STROKE) / 2
const RING_C = 2 * Math.PI * RING_R

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  return `${m}:${(total % 60).toString().padStart(2, '0')}`
}

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
  // Missed questions are what a review is for, so that is what opens.
  // Showing all of them made a 21-question paper into 21 identical
  // collapsed rows to click through before finding the two that went
  // wrong.
  const [showAll, setShowAll] = useState(false)
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

  // Grouped into the mondai they came from, so the result reads as
  // "もんだい3 cost me four marks" rather than as one undifferentiated
  // run of question numbers. `mondaiNumber` rides along on every object
  // flattenQuestions produces, so this is derived here rather than
  // added to the server's `review` — that payload is frozen into JSONB
  // at submit time, and every attempt already recorded would lack it.
  const groups = useMemo(() => {
    if (!summary || !exam || !section) return []
    const byId = Object.fromEntries(flattenQuestions(exam).map(q => [q.id, q]))
    const out = []
    for (const r of summary.review) {
      if (r.sectionId !== section.id) continue
      const q = byId[r.id]
      // An attempt whose ids don't line up with the paper we were
      // handed is a bug worth not blanking the entire result over —
      // reading `.number` off this undefined used to white-screen the
      // whole review.
      if (!q) continue
      const key = q.mondaiId
      let group = out.find(g => g.key === key)
      if (!group) {
        group = { key, number: q.mondaiNumber, rows: [], correct: 0 }
        out.push(group)
      }
      group.rows.push({ ...r, q })
      if (r.isCorrect) group.correct += 1
    }
    return out
  }, [summary, exam, section])

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
        <main id="main-content"><Loading /></main>
      </div>
    )
  }

  if (!summary || !exam || !sectionStats) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/exam')} title={t.examTitle} autoHide />
        <main id="main-content" className="container exam-shell">
          <EmptyState
            icon={<PageIcon size={40} />}
            message={t.examResultMissing}
            action={{ label: t.examBackToExams, onClick: () => navigate('/exam') }}
          />
        </main>
      </div>
    )
  }

  const missedCount = sectionStats.total - sectionStats.correct
  const elapsedMs = summary.startedAt && summary.finishedAt ? summary.finishedAt - summary.startedAt : null

  function toggle(id) {
    playUi('click-mode-selection')
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/exam')} title={paperTitle(exam, t)} autoHide />
      <main id="main-content" className="container exam-shell">
        <div className={`exam-result-header${metTarget ? '' : ' exam-result-header--low'}`}>
          <ScoreRing pct={sectionStats.pct} metTarget={metTarget} />
          <span className="exam-result-header__score">
            {sectionStats.correct} / {sectionStats.total} {t.examScoreCorrect}
          </span>
          <span className="exam-result-header__target">
            {t.examPracticeTarget} {PRACTICE_TARGET_PCT}%
            {elapsedMs !== null && <> · {t.examTimeTaken} {formatDuration(elapsedMs)}</>}
          </span>
        </div>

        {/* The one screen in the app where somebody might mistake a
            generated practice number for a real JLPT result, so it says
            outright that it isn't one. */}
        <p className="exam-result-disclaimer">{t.examUnofficialNote}</p>

        <div className="exam-review">
          <div className="exam-review__head">
            <div>
              <h3 className="exam-review__title">{t.examReviewTitle}</h3>
              <p className="exam-review__hint">{t.examReviewHint}</p>
            </div>
            {/* Rendered even on a clean sheet. Gating it on missedCount
                left a perfect run with the "nothing missed" line and no
                control at all — no question expandable, and in
                particular no way to reach the listening transcripts,
                which is exactly what somebody who just aced a listening
                paper might want to read. */}
            <button
              type="button"
              className="exam-review__filter"
              aria-pressed={showAll}
              onClick={() => { playUi('click-mode-selection'); setShowAll(v => !v) }}
            >
              {showAll ? t.examShowWrongOnly : t.examShowAll}
            </button>
          </div>
        </div>

        {missedCount === 0 && <p className="exam-review__perfect">{t.examAllCorrect}</p>}

        {(showAll || missedCount > 0) &&
          groups.map(group => {
            const rows = showAll ? group.rows : group.rows.filter(r => !r.isCorrect)
            if (rows.length === 0) return null
            return (
              <div key={group.key} className="exam-review-group">
                <h4 className="exam-review-group__title">
                  <span lang="ja">もんだい{group.number}</span>
                  <span className="exam-review-group__score">{group.correct} / {group.rows.length}</span>
                </h4>
                <div className="exam-review-list">
                  {rows.map(r => {
                    const isOpen = expandedId === r.id
                    // Three outcomes, not two: a question left blank
                    // scores like a wrong answer but isn't one, and the
                    // two used to render identically.
                    const state = r.isCorrect ? 'correct' : r.given == null ? 'blank' : 'wrong'
                    return (
                      <div key={r.id} className={`exam-review-row exam-review-row--${state}`}>
                        <button type="button" className="exam-review-row__summary" onClick={() => toggle(r.id)} aria-expanded={isOpen}>
                          <span className="exam-review-row__icon" aria-hidden="true">
                            {r.isCorrect ? <CheckIcon size={14} /> : <CrossIcon size={14} />}
                          </span>
                          <span className="exam-review-row__number">
                            {t.examQuestionAbbrev}{r.q.number}
                          </span>
                          {state === 'blank' && (
                            <span className="exam-review-row__blank">{t.examNotAnswered}</span>
                          )}
                          <span className="exam-review-row__chevron" aria-hidden="true">
                            <ChevronIcon direction={isOpen ? 'up' : 'down'} size={14} />
                          </span>
                        </button>
                        {isOpen && (
                          <div className="exam-review-row__detail">
                            <QuestionRenderer question={r.q} selected={r.given} onSelect={() => {}} revealed devMode={false} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

        <div className="exam-nav-buttons exam-nav-buttons--result">
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
      </main>
    </div>
  )
}

// Inline SVG, no dependency: an arc for the score and a tick for the
// practice target, so "48% against 60%" is one glance instead of two
// numbers to compare by reading.
function ScoreRing({ pct, metTarget }) {
  const targetAngle = (PRACTICE_TARGET_PCT / 100) * 360 - 90
  const rad = (targetAngle * Math.PI) / 180
  const cx = RING_SIZE / 2
  const inner = RING_R - RING_STROKE / 2 - 2
  const outer = RING_R + RING_STROKE / 2 + 2

  return (
    <div className="exam-score-ring">
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
        <circle cx={cx} cy={cx} r={RING_R} className="exam-score-ring__track" strokeWidth={RING_STROKE} fill="none" />
        <circle
          cx={cx}
          cy={cx}
          r={RING_R}
          className="exam-score-ring__arc"
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - Math.min(100, Math.max(0, pct)) / 100)}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        <line
          x1={cx + inner * Math.cos(rad)}
          y1={cx + inner * Math.sin(rad)}
          x2={cx + outer * Math.cos(rad)}
          y2={cx + outer * Math.sin(rad)}
          className="exam-score-ring__target"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
      {/* The number itself is the accessible content — the ring above is
          the same fact drawn. */}
      <span className={`exam-result-header__pct${metTarget ? '' : ' exam-result-header__pct--low'}`}>{pct}%</span>
    </div>
  )
}
