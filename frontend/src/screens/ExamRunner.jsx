import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { Leave } from '../components/chrome/Bar'
import { Sheet } from '../components/chrome/Sheet'
import { StudyStage } from '../components/study/StudyStage'
import { CardTransition } from '../components/study/CardTransition'
import { CHOICE_KEY_INDEX } from '../domain/choiceKeys'
import Empty from '../components/ui/Empty'
import { getExam, flattenQuestions, submitAttempt } from '../exam/examService'
import { paperTitle } from '../exam/examKinds'
import QuestionRenderer from '../exam/QuestionRenderer'
import AnswerSheet, { SheetBar } from '../exam/AnswerSheet'
import { PageIcon, ChevronIcon, FlagIcon } from '../components/ui/Icons'

// Poll cadence while the server generates a paper (it answers 202 until
// the paper exists). Starts responsive, backs off geometrically so a
// slow generation isn't polled dozens of times.
const POLL_START_MS = 3000
const POLL_MAX_MS = 10000

// Minutes-remaining marks that get spoken aloud. The red pulsing timer
// only helps someone already looking at the corner of the screen.
const TIME_WARNINGS = [5, 1]

const EXAM_COLOR = 'var(--line-exam)'

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

// Route: /practice/exam/:examId — on the stage frame (plan 072).
// Renders one question at a time via CardTransition so moving between
// questions gets the same crossfade Kana/Kanji/Vocab already use — no
// new animation language. Order is the learner's, not the screen's:
// the answer sheet (a bottom sheet the docked sheet bar opens) jumps
// to any question, which is how a paper exam is actually worked.
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
  // "Come back to this one." A Set of question ids, saved into the
  // draft as an array — JSON.stringify turns a Set into `{}`, so
  // persisting it directly would restore every flag as empty.
  const [flagged, setFlagged] = useState(() => new Set())

  // The mondai whose instructions the learner last toggled by hand,
  // and which way. Without a toggle the first question of each mondai
  // shows them and the rest fold them away (see `instructionsOpen`
  // below).
  const [openMondai, setOpenMondai] = useState(null)

  // 'idle' | 'confirming' (unanswered questions) | 'sending' | 'error'
  const [submitState, setSubmitState] = useState('idle')
  const [leaving, setLeaving] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

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
          setFlagged(new Set(draft?.flagged ?? []))
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

  // `?.` on sections too, not just a truthiness check on exam: getExam's
  // 202 shape ({generating: true}) is truthy with no sections. The poll
  // above early-returns on it today, so this is defence against that
  // guard being moved, not a live bug -- see plans/022.
  const section = exam?.sections?.[0] ?? null

  // Derived, not stored: recomputed every render (the tick heartbeat
  // above is what makes "every render" include "every second").
  const deadline = section && startedAt ? startedAt + section.timeLimitMin * 60 * 1000 : null
  const timeLeft = deadline !== null ? Math.max(0, (deadline - Date.now()) / 1000) : null
  const isTimeUp = timeLeft !== null && timeLeft <= 0
  const minutesLeft = timeLeft !== null ? Math.ceil(timeLeft / 60) : null
  // Derived, not stored. An aria-live region announces when its text
  // CHANGES, so text that is present for exactly the minute it
  // describes is spoken exactly once — which is what a warning wants,
  // and needs neither state nor an effect to arrange.
  const announcement =
    minutesLeft !== null && TIME_WARNINGS.includes(minutesLeft) ? t.examTimeWarning(minutesLeft) : ''

  useEffect(() => {
    if (!exam || !startedAt) return
    saveDraft(examId, exam.revision, { answers, index, startedAt, flagged: [...flagged] })
  }, [exam, examId, answers, index, startedAt, flagged])

  useEffect(() => {
    if (isTimeUp) finish()
    // finish() closes over current answers/startedAt/etc, and re-runs
    // only when isTimeUp itself flips — it isn't a real missing dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeUp])

  const current = questions[index] ?? null
  // `pieces` for sentence-order, `choices` for everything else — the
  // keyboard shortcut needs whichever list the renderer will draw.
  const currentOptions = current ? current.choices ?? current.pieces ?? [] : null
  const dialogOpen = submitState !== 'idle' || leaving || sheetOpen

  // Digits pick an answer, arrows move, `f` flags. Same binding the
  // study quiz has had all along (CHOICE_KEY_INDEX is imported from it
  // rather than retyped, AZERTY row and all) — the exam simply never
  // got it, so the one screen where somebody answers twenty questions
  // in a row was the one screen that required a mouse for every one.
  useEffect(() => {
    if (!current || dialogOpen) return
    const handler = e => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const idx = CHOICE_KEY_INDEX[e.key]
      if (idx !== undefined && idx < currentOptions.length) {
        e.preventDefault()
        playUi('click-mode-selection')
        setAnswers(prev => ({ ...prev, [current.id]: currentOptions[idx].id }))
        return
      }
      // Arrows inside the choice list belong to the radiogroup — moving
      // between options is what a radio advertises, and QuestionRenderer
      // implements it. Only arrows from outside change question.
      const inChoices = typeof e.target?.closest === 'function' && e.target.closest('[role="radiogroup"]')
      if (e.key === 'ArrowRight') { if (inChoices) return; e.preventDefault(); jumpTo(index + 1) }
      else if (e.key === 'ArrowLeft') { if (inChoices) return; e.preventDefault(); jumpTo(index - 1) }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFlag() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // jumpTo/toggleFlag are re-created every render and close over the
    // current index — the deps that matter are what they read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, currentOptions, index, questions.length, dialogOpen])

  const leaveToPapers = () => navigate('/practice/exam')

  // ── Generating ──
  // Not the shared <Loading/>: opening a never-before-seen paper runs
  // four-plus LLM calls per mondai and takes a minute or two, and a
  // bare spinner for that long reads as "broken", not as "working".
  // Saying what's happening (and that it only happens once) is the
  // difference between waiting and giving up.
  if (exam === null) {
    return (
      <StudyStage color={EXAM_COLOR} onLeave={leaveToPapers} leaveLabel={t.leaveExam} where={t.examTitle} pass={false}>
        <div className="exam-generating">
          <div className="exam-generating__brush" aria-hidden="true">
            <span className="exam-generating__stroke" />
            <span className="exam-generating__stroke" />
            <span className="exam-generating__stroke" />
          </div>
          <p className="exam-generating__title">{t.examGenerating}</p>
          <p className="exam-generating__hint">{t.examGeneratingHint}</p>
        </div>
      </StudyStage>
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
      <StudyStage color={EXAM_COLOR} onLeave={leaveToPapers} leaveLabel={t.leaveExam} where={t.examTitle} pass={false}>
        <Empty
          icon={<PageIcon size={40} />}
          message={t.examLoadFailed}
          hint={retryAfter > 0 ? t.examLoadFailedCooldown(waitMinutes) : t.examLoadFailedHint}
          action={retryAfter > 0 ? undefined : { label: t.examRetry, onClick: onRetry }}
        />
      </StudyStage>
    )
  }

  if (questions.length === 0 || !current) {
    return (
      <StudyStage color={EXAM_COLOR} onLeave={leaveToPapers} leaveLabel={t.leaveExam} where={t.examTitle} pass={false}>
        <Empty
          icon={<PageIcon size={40} />}
          message={t.examSectionEmpty}
          action={{ label: t.examBackToExams, onClick: leaveToPapers }}
        />
      </StudyStage>
    )
  }

  // A paper whose flattened questions name a mondai the section doesn't
  // carry is malformed, but reading `.number` off the undefined that
  // `.find` returns turned that into a blank screen for the whole exam.
  const mondai = section.mondai.find(m => m.id === current.mondaiId) ?? null
  const selected = answers[current.id] ?? null
  const answeredCount = Object.keys(answers).length
  const unansweredCount = questions.length - answeredCount
  // Answered, not position. A bar that fills as you walk PAST unanswered
  // questions claims progress the learner hasn't made — and position is
  // what the sheet bar shows anyway.
  const progressPct = Math.round((answeredCount / questions.length) * 100)
  const isFlagged = flagged.has(current.id)

  // Instructions are byte-identical for every question inside a mondai,
  // so they open on its first question and fold away after — they were
  // four lines of kana redrawn above every single question, taking the
  // top of the viewport before the learner reached what was being asked.
  // The row above the card is the toggle on every question (canvas).
  const isFirstOfMondai = questions.findIndex(q => q.mondaiId === current.mondaiId) === index
  const instructionsOpen = openMondai?.id === current.mondaiId ? openMondai.open : isFirstOfMondai

  function jumpTo(i) {
    if (i < 0 || i >= questions.length || i === index) return
    playUi('click-mode-selection')
    setIndex(i)
  }

  function select(choiceId) {
    setAnswers(prev => ({ ...prev, [current.id]: choiceId }))
  }

  function toggleFlag() {
    playUi('click-mode-selection')
    setFlagged(prev => {
      const next = new Set(prev)
      if (next.has(current.id)) next.delete(current.id)
      else next.add(current.id)
      return next
    })
  }

  // Finish is available on every question, not only the last: someone
  // who skipped question 3 used to have no way to submit without
  // walking to the end of the paper. Blanks are scored wrong, so it
  // asks first — and offers to go to them rather than only offering to
  // go through with it.
  function requestFinish() {
    playUi('click-screen-selection')
    if (unansweredCount > 0) setSubmitState('confirming')
    else finish()
  }

  function goToFirstBlank() {
    const i = questions.findIndex(q => answers[q.id] == null)
    setSubmitState('idle')
    if (i !== -1) jumpTo(i)
  }

  async function finish() {
    // Guards against the countdown hitting zero in the same window as
    // a manual "Finish" click — without it that's two POSTs and two
    // exam_attempts rows for one attempt.
    if (submitting.current) return
    submitting.current = true
    setSubmitState('sending')
    const finishedAt = Date.now()
    try {
      const summary = await submitAttempt(
        examId,
        // The revision travels with the submission so the server scores
        // against the paper actually sat — by then it is one the server's
        // own selection rule would no longer offer, precisely because
        // this attempt is about to exist.
        { sectionId: section.id, revision: exam.revision, answers, startedAt, finishedAt },
        session,
      )
      // Only once the answers are safely on the server. Clearing it
      // before the POST resolved would destroy the one copy of a
      // finished exam whenever the request failed.
      clearDraft(examId, exam.revision)
      // attempt id in the URL (not just router state) is what makes a
      // reloaded result page recoverable — see ExamResult.
      navigate(`/practice/exam/${examId}/results?attempt=${summary.attemptId}`, { state: { summary, exam } })
    } catch {
      // This path used to not exist: a failed submit left the guard ref
      // latched true forever, so a finished exam sat on screen with no
      // message, no navigation and no second attempt possible.
      submitting.current = false
      setSubmitState('error')
    }
  }

  return (
    <div className="screen">
      <main id="main-content" className="container stage" style={{ '--line-color': EXAM_COLOR }}>
        {/* The exam's own head row (canvas ExamRunner): the way out,
            the paper, the clock. Walking out of a timed exam is worth
            a question — and the answer ("your progress is saved") is
            something the learner otherwise has no way to know. */}
        <div className="exam-meta">
          <Leave onClick={() => setLeaving(true)}>{t.leaveExam}</Leave>
          <span className="exam-meta__section">
            <h1 className="exam-meta__jp">{paperTitle(exam, t)}</h1>
          </span>
          {timeLeft !== null && (
            <span
              className={`exam-timer${timeLeft < 60 ? ' exam-timer--low' : ''}`}
              role="timer"
            >
              {formatTime(timeLeft)}
            </span>
          )}
        </div>

        <div
          className="deck-progress"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t.examSheetTitle}
        >
          <div className="deck-progress__bar">
            <div className="deck-progress__segment" style={{ width: `${progressPct}%`, background: EXAM_COLOR }} />
          </div>
        </div>

        {/* Spoken at 5:00 and 1:00. The pulsing red timer only reaches
            somebody already watching the corner of the screen. */}
        <p className="exam-visually-hidden" role="status" aria-live="polite">{announcement}</p>

        {mondai && (
          <>
            <button
              type="button"
              className="exam-mondai"
              aria-expanded={instructionsOpen}
              onClick={() => setOpenMondai({ id: current.mondaiId, open: !instructionsOpen })}
            >
              <span>
                <b className="exam-mondai__part">{t.examPart(mondai.number)}</b>
                {' · '}
                {instructionsOpen ? t.examHideInstructions : t.examShowInstructions}
              </span>
              <ChevronIcon direction={instructionsOpen ? 'up' : 'down'} size={14} />
            </button>
            {instructionsOpen && (
              <p className="exam-mondai__text" lang="ja">{mondai.instructionsJp}</p>
            )}
          </>
        )}

        <CardTransition cardKey={current.id}>
          <div className="prompt-card prompt-card--ask exam-card">
            <span className="cap">{t.examQuestionAbbrev}{current.number}</span>
            <QuestionRenderer question={current} selected={selected} onSelect={select} devMode={devMode} />
          </div>
        </CardTransition>

        <div className="exam-nav">
          {/* Reuses ReviewDeck's prev/next wording (see quizModes' review
              mode) rather than inventing a third "back"/"next" pair. */}
          <button type="button" className="btn-secondary" disabled={index === 0} onClick={() => jumpTo(index - 1)}>
            <ChevronIcon direction="left" size={14} /> {t.reviewPrev}
          </button>
          <button
            type="button"
            className={`exam-flag${isFlagged ? ' exam-flag--on' : ''}`}
            onClick={toggleFlag}
            aria-pressed={isFlagged}
            aria-label={isFlagged ? t.examUnflag : t.examFlag}
            title={isFlagged ? t.examUnflag : t.examFlag}
          >
            <FlagIcon size={16} filled={isFlagged} />
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={index === questions.length - 1}
            onClick={() => jumpTo(index + 1)}
          >
            {t.reviewNext} <ChevronIcon direction="right" size={14} />
          </button>
        </div>

        <SheetBar
          questions={questions}
          answers={answers}
          flagged={flagged}
          index={index}
          answered={answeredCount}
          onOpen={() => { playUi('click-mode-selection'); setSheetOpen(true) }}
          onFinish={requestFinish}
          busy={submitState === 'sending'}
        />
      </main>

      {/* The grid, in a sheet the bar opens. Jumping closes it: the
          question is what the learner asked for. */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} jp={t.examSheetTitle}>
        <AnswerSheet
          questions={questions}
          answers={answers}
          flagged={flagged}
          index={index}
          onJump={i => { setSheetOpen(false); jumpTo(i) }}
        />
      </Sheet>

      {/* Not window.confirm: it can't be themed, can't be translated by
          the app's own locale, and is suppressed outright in some
          embedded webviews — which for the leave-guard would mean
          silently losing the guard rather than silently keeping it. */}
      <Sheet open={submitState === 'confirming'} onClose={() => setSubmitState('idle')} jp={t.examConfirmTitle}>
        <p className="hint">{t.examConfirmBody(unansweredCount)}</p>
        <button type="button" className="btn-primary" onClick={() => setSubmitState('idle')}>
          {t.examKeepGoing}
        </button>
        <button type="button" className="btn-secondary" onClick={goToFirstBlank}>
          {t.examReviewBlanks}
        </button>
        <button type="button" className="btn-secondary btn-secondary--danger" onClick={finish}>
          {t.examSubmitAnyway}
        </button>
      </Sheet>

      <Sheet open={submitState === 'error'} onClose={() => setSubmitState('idle')} jp={t.examSubmitFailed} label={t.examSubmitFailed}>
        <button type="button" className="btn-primary" onClick={finish}>
          {t.examSubmitRetry}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setSubmitState('idle')}>
          {t.examKeepGoing}
        </button>
      </Sheet>

      <Sheet open={leaving} onClose={() => setLeaving(false)} jp={t.examLeaveTitle}>
        <p className="hint">{t.examLeaveBody}</p>
        <button type="button" className="btn-primary" onClick={() => setLeaving(false)}>
          {t.examLeaveStay}
        </button>
        <button type="button" className="btn-secondary" onClick={leaveToPapers}>
          {t.examLeaveConfirm}
        </button>
      </Sheet>
    </div>
  )
}
