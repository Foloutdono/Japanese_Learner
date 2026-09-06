import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi, playCorrect } from '../lib/audio'
import { Bar } from '../components/chrome/Bar'
import { Chip } from '../components/chrome/Console'
import { stationFor } from '../config/stations'
import QuestionRenderer from '../exam/QuestionRenderer'
import Empty from '../components/ui/Empty'
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

// Geometry of the score ring (canvas ExamResult: a 108 viewBox, the
// arc at r=46). A bare red "48%" says you did badly without ever
// saying badly against what — on the ring, the target sits as a tick
// you can see yourself falling short of or clearing.
const RING_BOX = 108
const RING_R = 46
const RING_C = 2 * Math.PI * RING_R

const EXAM_COLOR = 'var(--line-exam)'

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  return `${m}:${(total % 60).toString().padStart(2, '0')}`
}

// The one line of a question the review row can show beside its
// number: the prompt for most types, the passage's title for a
// reading, the context sentence for an ordering. A listening
// question has no visible text and gets nothing — the row still
// opens on the transcript.
function questionLine(q) {
  return q.promptJp ?? q.questionPromptJp ?? q.contextJp ?? q.passage?.titleJp ?? ''
}

// Route: /practice/exam/:examId/results — under the shell (plan 072):
// the bar names the paper, the ring and the figures head the page,
// the review is a surface of parts and rows.
//
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
  const station = stationFor('/practice/exam')

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
          .then(exam => {
            if (!alive) return
            // getExam returns {generating: true} on a 202 -- truthy, and
            // with no `sections`. Storing it would crash the render below
            // on exam.sections[0]. A result screen has nothing useful to
            // show for a paper that isn't materialized yet, so this is
            // the same "couldn't load" state as a failure.
            if (exam?.generating) { setLoaded(false); return }
            setLoaded({ exam, summary })
          }))
      .catch(() => { if (alive) setLoaded(false) })
    return () => { alive = false }
  }, [loaded, attemptId, examId, session])

  const { summary, exam } = loaded || {}
  // `?.` on sections and perSection too, not just on their parents: the
  // `?.` before a bracket guards the object, never the index step, so
  // `exam?.sections[0]` still throws when sections is undefined. That
  // exact line white-screened this screen in production -- see
  // plans/022-exam-generating-shape-crash.md.
  const section = exam?.sections?.[0] ?? null
  const sectionStats = section ? summary?.perSection?.[section.id] ?? null : null
  const metTarget = (sectionStats?.pct ?? 0) >= PRACTICE_TARGET_PCT

  // Grouped into the mondai they came from, so the result reads as
  // "Part 3 cost me four marks" rather than as one undifferentiated
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
      <main id="main-content" className="practice" style={{ '--line-color': EXAM_COLOR }}>
        <Bar code={station.code} color={EXAM_COLOR} title={t.examTitle} />
        <Loading />
      </main>
    )
  }

  if (!summary || !exam || !sectionStats) {
    return (
      <main id="main-content" className="practice" style={{ '--line-color': EXAM_COLOR }}>
        <Bar code={station.code} color={EXAM_COLOR} title={t.examTitle} />
        <Empty
          icon={<PageIcon size={40} />}
          message={t.examResultMissing}
          action={{ label: t.examBackToExams, onClick: () => navigate('/practice/exam') }}
        />
      </main>
    )
  }

  const missedCount = sectionStats.total - sectionStats.correct
  const elapsedMs = summary.startedAt && summary.finishedAt ? summary.finishedAt - summary.startedAt : null

  function toggle(id) {
    playUi('click-mode-selection')
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <main id="main-content" className="practice" style={{ '--line-color': EXAM_COLOR }}>
      <Bar code={station.code} color={EXAM_COLOR} title={t.examTitle} sub={paperTitle(exam, t)} />

      <div className="exam-result-head">
        <ScoreRing pct={sectionStats.pct} metTarget={metTarget} />
        <div className="exam-result-figs">
          <b className="exam-result-figs__score">{sectionStats.correct} / {sectionStats.total}</b>
          <span className="exam-result-figs__cap">{t.examScoreCorrect}</span>
          <span className="exam-result-figs__note">
            {t.examPracticeTarget} {PRACTICE_TARGET_PCT}%
            {elapsedMs !== null && <> · {t.examTimeTaken} {formatDuration(elapsedMs)}</>}
          </span>
          {/* The one screen in the app where somebody might mistake a
              generated practice number for a real JLPT result, so it
              says outright that it isn't one. */}
          <span className="exam-result-figs__note">{t.examUnofficialNote}</span>
        </div>
      </div>

      <div className="section-header section-header--paired">
        <span className="section-header__mark">
          <h2 className="section-header__jp">{t.examReviewTitle}</h2>
        </span>
        {/* Rendered even on a clean sheet. Gating it on missedCount
            left a perfect run with the "nothing missed" line and no
            control at all — no question expandable, and in particular
            no way to reach the listening transcripts, which is exactly
            what somebody who just aced a listening paper might want to
            read. */}
        <Chip
          on={!showAll}
          color={EXAM_COLOR}
          className="section-header__chip"
          onClick={() => { playUi('click-mode-selection'); setShowAll(v => !v) }}
        >
          {t.examShowWrongOnly}
        </Chip>
        <span className="section-header__rule" aria-hidden="true" />
      </div>
      <p className="hint">{missedCount === 0 ? t.examAllCorrect : t.examReviewHint}</p>

      {(showAll || missedCount > 0) && (
        <div className="surface exam-review">
          {groups.map(group => {
            const rows = showAll ? group.rows : group.rows.filter(r => !r.isCorrect)
            if (rows.length === 0) return null
            return (
              <div key={group.key} className="exam-review__part">
                <div className="exam-group">
                  <b className="exam-group__part">{t.examPart(group.number)}</b>
                  <span className="exam-group__score">{group.correct} / {group.rows.length}</span>
                </div>
                {rows.map(r => {
                  const isOpen = expandedId === r.id
                  // Three outcomes, not two: a question left blank
                  // scores like a wrong answer but isn't one, and the
                  // two used to render identically.
                  const state = r.isCorrect ? 'ok' : r.given == null ? 'blank' : 'x'
                  const line = questionLine(r.q)
                  return (
                    <div key={r.id}>
                      <button type="button" className="exam-review-row" onClick={() => toggle(r.id)} aria-expanded={isOpen}>
                        <span className={`exam-review-row__mark exam-review-row__mark--${state}`} aria-hidden="true">
                          {r.isCorrect ? <CheckIcon size={11} /> : <CrossIcon size={11} />}
                        </span>
                        <span className="exam-review-row__q">{t.examQuestionAbbrev}{r.q.number}</span>
                        {state === 'blank'
                          ? <span className="exam-review-row__blank">{t.examNotAnswered}</span>
                          : <span className="exam-review-row__jp" lang="ja">{line}</span>}
                        <span className="exam-review-row__chev" aria-hidden="true">
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
            )
          })}
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={() => { playUi('click-screen-selection'); navigate('/practice/exam') }}>
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
          className="btn-primary"
          onClick={() => {
            playUi('click-screen-selection')
            navigate(`/practice/exam/${examId}?exclude=${exam.revision}`, { replace: true })
          }}
        >
          {t.examNewPaper}
        </button>
      </div>
    </main>
  )
}

// Inline SVG, no dependency: an arc for the score and a tick for the
// practice target, so "48% against 60%" is one glance instead of two
// numbers to compare by reading. The tick is drawn at twelve o'clock
// and rotated to the target; the arc starts there too (the SVG is
// rotated a quarter turn in CSS).
function ScoreRing({ pct, metTarget }) {
  const c = RING_BOX / 2
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className={`exam-score-ring${metTarget ? '' : ' exam-score-ring--low'}`}>
      <svg className="exam-score-ring__svg" viewBox={`0 0 ${RING_BOX} ${RING_BOX}`} aria-hidden="true">
        <circle className="exam-score-ring__track" cx={c} cy={c} r={RING_R} />
        <circle
          className="exam-score-ring__fill"
          cx={c}
          cy={c}
          r={RING_R}
          strokeDasharray={RING_C.toFixed(1)}
          strokeDashoffset={(RING_C * (1 - clamped / 100)).toFixed(1)}
        />
        <line
          className="exam-score-ring__tick"
          x1={c} y1={4} x2={c} y2={14}
          transform={`rotate(${(PRACTICE_TARGET_PCT / 100) * 360} ${c} ${c})`}
        />
      </svg>
      {/* The number itself is the accessible content — the ring above is
          the same fact drawn. */}
      <span className="exam-score-ring__pct">{pct}%</span>
    </div>
  )
}
