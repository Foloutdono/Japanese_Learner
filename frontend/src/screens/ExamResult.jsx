import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi, playCorrect } from '../lib/audio'
import { Bar } from '../components/chrome/Bar'
import { stationFor } from '../config/stations'
import { useListWalk, useFollowFocus, WALK_KEYS_PAGED } from '../hooks/useListWalk'
import QuestionRenderer, { GapText, PageChoices, PassageText } from '../exam/QuestionRenderer'
import ExamStudy from '../exam/ExamStudy'
import { MarkedSheet } from '../exam/DeskSheet'
import { StationSplit } from '../components/selection/StationSplit'
import { relativeDate } from '../lib/formatDate'
import { useDesk } from '../hooks/useDesk'
import { dialogOpen } from '../lib/dialogOpen'
import Empty from '../components/ui/Empty'
import { Loading } from '../components/ui/Loading'
import { flattenQuestions, getAttempt, getExam } from '../exam/examService'
import { paperTitle } from '../exam/examKinds'
import { ChevronIcon, PageIcon } from '../components/ui/Icons'

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
  const { t, lang } = useLang()
  const desk = useDesk()
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
        group = { key, number: q.mondaiNumber, name: q.mondaiName, rows: [], correct: 0 }
        out.push(group)
      }
      group.rows.push({ ...r, q })
      if (r.isCorrect) group.correct += 1
    }
    return out
  }, [summary, exam, section])

  // ── 机 — the sheet marked beside its page (plans 115, 117, 200) ──
  // The owner's mix of the canvas "Tsuji — the mock exam on the desk"
  // (M7): the answer sheet handed back marked, under the score, and
  // beside it the booklet's page of the question open. Every row of the
  // sheet is a door to its question (the first miss opens on arrival);
  // ←/→ walk the misses -- "miss 2 of 9" -- or, on a clean sheet, every
  // question, a listening transcript being what somebody who aced the
  // paper may want to read.
  //
  // The open question is named in the URL, beside the attempt
  // (?question=, plan 117), and each row is a link to it: a question
  // opens in a tab of its own, which rebuilds the result from ?attempt=
  // as a reload does. The link and ←/→ replace the URL, carrying the
  // paper and the attempt this screen was handed (router state), so the
  // swap refetches nothing. The phone keeps its rows opening in place.
  const allRows = useMemo(() => groups.flatMap(g => g.rows), [groups])
  const walkRows = useMemo(() => {
    const missed = allRows.filter(r => !r.isCorrect)
    return missed.length > 0 ? missed : allRows
  }, [allRows])
  const asked = searchParams.get('question')
  const openRow = allRows.find(r => String(r.id) === asked) ?? walkRows[0] ?? null
  // The sheet is one tab stop, the open question, walked with ↑/↓
  // across its parts (plan 123); ←/→ open the next miss, and the focus
  // goes with them while it is in the sheet.
  const onReviewWalk = useListWalk(desk, { items: '.desk-mark-row' })
  const reviewRef = useRef(null)
  useFollowFocus(reviewRef, openRow?.id, desk)
  useEffect(() => {
    if (!desk || !openRow) return undefined
    const onKey = e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || dialogOpen()) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '') || e.target?.isContentEditable) return
      // From the open row's place on the paper, so a right answer
      // opened from the sheet walks on to the miss after it.
      const at = allRows.indexOf(openRow)
      const next = e.key === 'ArrowRight'
        ? walkRows.find(r => allRows.indexOf(r) > at)
        : walkRows.findLast(r => allRows.indexOf(r) < at)
      if (!next) return
      e.preventDefault()
      playUi('click-mode-selection')
      navigate(questionAt(location.pathname, searchParams, next.id), { replace: true, state: location.state })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desk, allRows, walkRows, openRow, navigate, location.pathname, location.state, searchParams])
  // The open row kept in view in the sheet's own scroll.
  const openId = desk ? openRow?.id : null
  useEffect(() => {
    if (openId) document.querySelector('.desk-mark-row[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [openId])

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

  // A NEW paper, not this one again. Re-sitting a paper whose answers
  // you have just read through tests recall of those answers rather
  // than the language, so the server is asked for a different revision
  // — another existing one where it has one (free), a freshly generated
  // one where it doesn't. The excluded revision is the one just sat;
  // the server would skip it anyway on the strength of the attempt now
  // recorded, and saying so explicitly costs nothing.
  const newPaper = (
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
  )

  if (desk) {
    const pct = sectionStats.pct
    const group = groups.find(g => g.rows.includes(openRow)) ?? null
    const q = openRow?.q ?? null
    const misses = walkRows.filter(r => !r.isCorrect)
    const missAt = openRow && !openRow.isCorrect ? misses.indexOf(openRow) : -1
    // When it was handed in, as M7 prints it: the day, then the hour.
    const day = relativeDate(summary.finishedAt, lang, t)
    const when = day && `${day}, ${new Date(summary.finishedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}`
    return (
      <main id="main-content" className="practice desk-res" style={{ '--line-color': EXAM_COLOR }}>
        {/* The desk's bar is the screen's name for a screen reader, and
            nothing drawn: the rail names the place (Bar). */}
        <Bar code={station.code} color={EXAM_COLOR} title={t.examTitle} sub={paperTitle(exam, t)} />
        <StationSplit
          label={t.examYourSheet}
          className="desk-split--res"
          list={(
            <div className="desk-res__sheet">
              <div className="desk-res__paper">
                <b>{paperTitle(exam, t)}</b>
                {when && <span className="cap">{when}</span>}
              </div>
              <div className="desk-score">
                <div className="desk-score__figs">
                  <b className="desk-score__fig">{sectionStats.correct}</b>
                  <span className="desk-score__of">/ {sectionStats.total}</span>
                  <span className={metTarget ? 'desk-score__pct' : 'desk-score__pct desk-score__pct--low'}>{t.percent(pct)}</span>
                </div>
                <div className="desk-score__bar" role="img" aria-label={t.examScoreAgainst(pct, PRACTICE_TARGET_PCT)}>
                  <i className={metTarget ? undefined : 'desk-score__low'} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                  <span className="desk-score__tick" style={{ left: `${PRACTICE_TARGET_PCT}%` }} />
                </div>
                {/* The one screen where a generated practice number could
                    be taken for a real JLPT result, so it says it is not. */}
                <div className="desk-score__cap">
                  <span className="cap">{t.examPracticeTarget} {PRACTICE_TARGET_PCT} % · {t.examUnofficial}</span>
                  {elapsedMs !== null && (
                    <span className="desk-score__time">{formatDuration(elapsedMs)} <small>/ {section.timeLimitMin}:00</small></span>
                  )}
                </div>
              </div>
              <div ref={reviewRef} onKeyDown={onReviewWalk} aria-keyshortcuts={WALK_KEYS_PAGED}>
                <MarkedSheet
                  groups={groups}
                  openId={openRow?.id ?? null}
                  rowTo={id => questionAt(location.pathname, searchParams, id)}
                  navState={location.state}
                  onOpen={() => playUi('click-mode-selection')}
                />
              </div>
            </div>
          )}
        >
          {q && (
            <article key={q.id} className="desk-book desk-book--res" aria-label={`${t.examQuestionAbbrev}${q.number}`}>
              <header className="desk-book__head">
                {group && <span className="desk-mondai" lang="ja">問題{group.number}</span>}
                {group && <span className="desk-book__part" lang="ja">{group.name ?? t.examPart(group.number)}</span>}
                {missAt !== -1 && (
                  <span className="desk-book__walk">
                    <kbd className="desk-kbd" aria-hidden="true">←</kbd>
                    {t.examMissOf(missAt + 1, misses.length)}
                    <kbd className="desk-kbd" aria-hidden="true">→</kbd>
                  </span>
                )}
                <span className="desk-folio"><b>{q.number}</b><small>/ {allRows.length}</small></span>
              </header>
              {q.type === 'reading-passage' && q.passage ? (
                <div className="desk-spread">
                  <div className="desk-spread__text"><PassageText passage={q.passage} /></div>
                  <div className="desk-spread__ask">
                    <div className="desk-q">
                      <span className="desk-q__n" aria-hidden="true">{q.number}</span>
                      <QuestionRenderer question={q} selected={openRow.given} revealed keys paged passageAside />
                    </div>
                    <PageChoices question={q} selected={openRow.given} revealed narrow keys />
                  </div>
                </div>
              ) : (
                <div className="desk-book__body">
                  <div className="desk-q">
                    <span className="desk-q__n" aria-hidden="true">{q.number}</span>
                    <QuestionRenderer question={q} selected={openRow.given} revealed keys paged />
                  </div>
                  <PageChoices question={q} selected={openRow.given} revealed keys />
                </div>
              )}
            </article>
          )}
          {q && <ExamStudy key={`study-${q.id}`} session={session} examId={examId} revision={exam.revision} question={q} />}
          <div className="desk-res__acts">
            <button type="button" className="btn-secondary" onClick={() => { playUi('click-screen-selection'); navigate('/practice/exam') }}>
              {t.examPapers}
            </button>
            {newPaper}
          </div>
        </StationSplit>
      </main>
    )
  }

  // ── The phone's result (plan 171) ──
  // The owner's pick A7 of the canvas "Tsuji — the mock exam on the
  // phone": the score against the practice target on one bar, the paper
  // graded part by part -- a mark per question, so where the points went
  // is seen before it is read -- then the misses, each with the bubble
  // picked and the one that was right, opening on the whole question.
  const pct = sectionStats.pct
  const listed = groups.flatMap(g => (showAll ? g.rows : g.rows.filter(r => !r.isCorrect)))
  return (
    <main id="main-content" className="practice exam-res" style={{ '--line-color': EXAM_COLOR }}>
      <Bar code={station.code} color={EXAM_COLOR} title={t.examTitle} sub={paperTitle(exam, t)} />

      <div className="exam-res__score">
        <div className="exam-res__figs">
          <b className="exam-res__fig">{sectionStats.correct}</b>
          <span className="exam-res__of">/ {sectionStats.total}</span>
          <span className={metTarget ? 'exam-res__pct' : 'exam-res__pct exam-res__pct--low'}>{t.percent(pct)}</span>
        </div>
        <div className="exam-res__bar" role="img" aria-label={t.examScoreAgainst(pct, PRACTICE_TARGET_PCT)}>
          <span className={metTarget ? 'exam-res__fill' : 'exam-res__fill exam-res__fill--low'} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
          <span className="exam-res__tick" style={{ left: `${PRACTICE_TARGET_PCT}%` }} />
        </div>
        {/* The one screen where a generated practice number could be
            taken for a real JLPT result, so it says it is not one. */}
        <span className="cap">{t.examPracticeTarget} {PRACTICE_TARGET_PCT} % · {t.examUnofficial}</span>
        {elapsedMs !== null && (
          <div className="exam-res__time">
            <span className="cap">{t.examTimeLabel}</span>
            <span className="exam-res__clock">
              <b>{formatDuration(elapsedMs)}</b>
              <span className="exam-res__limit"> / {section.timeLimitMin}:00</span>
            </span>
            <span className="exam-res__track" aria-hidden="true">
              <span className="exam-res__used" style={{ width: `${Math.min(100, elapsedMs / (section.timeLimitMin * 600))}%` }} />
            </span>
          </div>
        )}
      </div>

      <section className="exam-res__parts" aria-label={t.examByPart}>
        {groups.map(g => {
          const low = g.correct / g.rows.length < PRACTICE_TARGET_PCT / 100
          return (
            <div key={g.key} className="exam-res__part">
              <span className="exam-res__no" lang="ja">問題{g.number}</span>
              <span className="exam-res__jp" lang="ja">{g.name ?? t.examPart(g.number)}</span>
              <span className="exam-res__marks" aria-hidden="true">
                {g.rows.map(r => (
                  <i
                    key={r.id}
                    className={r.isCorrect ? 'exam-res__mk' : r.given == null ? 'exam-res__mk exam-res__mk--blank' : 'exam-res__mk exam-res__mk--x'}
                  />
                ))}
              </span>
              <span className={low ? 'exam-res__s exam-res__s--low' : 'exam-res__s'}>{g.correct}/{g.rows.length}</span>
            </div>
          )
        })}
      </section>

      <div className="exam-res__mhead">
        <span className="cap">{missedCount === 0 ? t.examAllCorrect : t.examMisses(missedCount)}</span>
        {/* Rendered on a clean sheet too: every question can still be
            opened -- a listening transcript is what somebody who aced
            the paper may want to read. */}
        <button
          type="button"
          className="exam-res__all"
          aria-pressed={showAll}
          onClick={() => { playUi('click-mode-selection'); setShowAll(v => !v) }}
        >
          {showAll ? t.examMissesOnly : t.examSeeAll}
          <ChevronIcon direction="right" size={14} />
        </button>
      </div>

      {listed.length > 0 && (
        <div className="exam-res__misses">
          {listed.map(r => (
            <div key={r.id}>
              <MissRow r={r} open={expandedId === r.id} onClick={() => toggle(r.id)} />
              {expandedId === r.id && (
                <div className="exam-review-row__detail">
                  <QuestionRenderer question={r.q} selected={r.given} onSelect={() => {}} revealed devMode={false} />
                  <ExamStudy session={session} examId={examId} revision={exam.revision} question={r.q} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={() => { playUi('click-screen-selection'); navigate('/practice/exam') }}>
          {t.examPapers}
        </button>
        {newPaper}
      </div>
    </main>
  )
}

// One question in the phone's list (plan 171): its number and its line,
// then the sheet's bubbles -- the one picked, the one that was right --
// and the right answer's words. Opens the question, revealed, under it.
function MissRow({ r, open, onClick }) {
  const { t } = useLang()
  const choices = r.q.choices ?? r.q.pieces ?? []
  const right = choices.findIndex(c => c.id === r.q.answer)
  const given = choices.findIndex(c => c.id === r.given)
  const line = questionLine(r.q)
  return (
    <button type="button" className="exam-miss" onClick={onClick} aria-expanded={open}>
      <span className="exam-miss__l1">
        <span className="exam-miss__n">{r.q.number}</span>
        {line
          ? <span className="exam-miss__q" lang="ja"><GapText text={line} /></span>
          : <span className="exam-miss__q" />}
        <ChevronIcon direction={open ? 'up' : 'down'} size={14} className="exam-miss__chev" />
      </span>
      <span className="exam-miss__l2">
        {choices.map((c, i) => {
          const cls = i === right
            ? (r.isCorrect ? 'exam-miss__b exam-miss__b--got' : 'exam-miss__b exam-miss__b--right')
            : i === given ? 'exam-miss__b exam-miss__b--x' : 'exam-miss__b'
          return <span key={c.id} className={cls}>{i + 1}</span>
        })}
        {r.given == null && <span className="exam-miss__blank">{t.examNotAnswered}</span>}
        {right !== -1 && choices[right].textJp && (
          <span className="exam-miss__a" lang="ja">{choices[right].textJp}</span>
        )}
      </span>
    </button>
  )
}

// The desk's URL for one question of this result: the same page, the
// question named beside the attempt (plan 117).
function questionAt(pathname, searchParams, id) {
  const next = new URLSearchParams(searchParams)
  next.set('question', String(id))
  return { pathname, search: `?${next}` }
}
