import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi, playVoice } from '../lib/audio'
import { Leave } from '../components/chrome/Bar'
import { Sheet } from '../components/chrome/Sheet'
import { StudyStage, RunSide } from '../components/study/StudyStage'
import { LevelBar } from '../components/chrome/LevelBar'
import { applyXpGain } from '../stores/profileSummary'
import { CardTransition } from '../components/study/CardTransition'
import { CHOICE_KEY_INDEX } from '../domain/choiceKeys'
import Empty from '../components/ui/Empty'
import { getExam, flattenQuestions, submitAttempt } from '../exam/examService'
import { paperTitle, paperKind, kindMeta } from '../exam/examKinds'
import QuestionRenderer, { PassageText, AnswerTiles } from '../exam/QuestionRenderer'
import ExamCard from '../exam/ExamCard'
import AnswerSheet, { PartsSheet } from '../exam/AnswerSheet'
import { useDesk } from '../hooks/useDesk'
import { LeaveKey } from '../components/chrome/DeskKeys'
import { PageIcon, ChevronIcon, FlagIcon, InfoIcon, SheetIcon } from '../components/ui/Icons'

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
  const location = useLocation()
  const { t } = useLang()
  const desk = useDesk()
  // Read when the paper arrives, inside the poll's closure: on a phone
  // a paper not begun waits on its cover with the clock stopped, on the
  // desk it starts at once as it always has (plan 171).
  const deskRef = useRef(desk)
  deskRef.current = desk
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
          setStartedAt(draft?.startedAt ?? (deskRef.current ? Date.now() : null))
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

  // The same marks, heard: a voice the learner may choose (silent unless
  // they have), sounded when the announcement's text arrives, which it
  // does once a mark.
  useEffect(() => {
    if (announcement) playVoice('exam-warning')
  }, [announcement])

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
    if (!current || dialogOpen || startedAt === null) return
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
  }, [current, currentOptions, index, questions.length, dialogOpen, startedAt])

  const leaveToPapers = () => navigate('/practice/exam')
  const askLeave = useCallback(() => setLeaving(true), [])

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
    // On the desk the paper is the page's scroll, not a card's: a jump
    // lands at the top of it, except within one reading passage, whose
    // text stands where the learner left it.
    if (desk && !(current.passage && questions[i].passage === current.passage)) window.scrollTo(0, 0)
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
      // The paper's fare (xp_earned, top-level on the attempt): into
      // the running total now, so the level the results screen's HUD
      // shows is the one the paper just paid into.
      if (typeof summary.xp_earned === 'number') applyXpGain({ amount: summary.xp_earned })
      // attempt id in the URL (not just router state) is what makes a
      // reloaded result page recoverable — see ExamResult.
      // Replacing, not pushing: Back from the result must not land on
      // the runner, which would ask the server for a fresh paper — and
      // start a paid generation when none is left to offer.
      navigate(`/practice/exam/${examId}/results?attempt=${summary.attemptId}`, { replace: true, state: { summary, exam } })
    } catch {
      // This path used to not exist: a failed submit left the guard ref
      // latched true forever, so a finished exam sat on screen with no
      // message, no navigation and no second attempt possible.
      submitting.current = false
      setSubmitState('error')
    }
  }

  // The three questions a paper can ask of the learner, the same on
  // both chromes. Not window.confirm: it can't be themed, can't be
  // translated by the app's own locale, and is suppressed outright in
  // some embedded webviews -- which for the leave-guard would mean
  // silently losing the guard rather than silently keeping it.
  const dialogs = (
    <>
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
    </>
  )

  const timer = timeLeft !== null && (
    <span
      className={`exam-timer${timeLeft < 60 ? ' exam-timer--low' : ''}`}
      role="timer"
    >
      {formatTime(timeLeft)}
    </span>
  )

  // ── The phone's paper (plan 171) ──
  // The owner's mix on the canvas "Tsuji — the mock exam on the phone":
  // the paper opens on its cover (A2) and the clock waits for Start; a
  // question is a page holding the question alone, its number at the
  // head (V1), over a dock where the answers are given as the mark
  // sheet's bubbles carrying their words, Previous and Next under them;
  // the answer sheet is a sheet of the parts (C6). It replaced a head
  // row, a hairline, the instructions' row, the card, Previous · flag ·
  // Next under the card and a docked sheet bar -- six bands, so a
  // passage or a cloze pushed Previous and Next off the screen.
  if (!desk) {
    if (startedAt === null) {
      return (
        <ExamCover
          exam={exam}
          section={section}
          questions={questions}
          last={location.state?.last ?? null}
          onStart={() => { playUi('click-screen-selection'); setStartedAt(Date.now()) }}
          onLeave={leaveToPapers}
        />
      )
    }
    const last = index === questions.length - 1
    return (
      <div className="screen">
        <main id="main-content" className="container stage exam-run" style={{ '--line-color': EXAM_COLOR }}>
          <div className="exam-run__head">
            <button type="button" className="stage__leave exam-run__leave" onClick={askLeave} aria-label={t.leaveExam}>
              <ChevronIcon direction="left" size={16} />
            </button>
            <button
              type="button"
              className="exam-run__sheet"
              onClick={() => { playUi('click-mode-selection'); setSheetOpen(true) }}
              aria-haspopup="dialog"
            >
              <SheetIcon size={18} />
              {t.examSheetShort}
            </button>
            <button
              type="button"
              className={`exam-flag${isFlagged ? ' exam-flag--on' : ''}`}
              onClick={toggleFlag}
              aria-pressed={isFlagged}
              aria-label={isFlagged ? t.examUnflag : t.examFlag}
            >
              <FlagIcon size={16} filled={isFlagged} />
            </button>
            {timer}
          </div>

          <p className="exam-visually-hidden" role="status" aria-live="polite">{announcement}</p>

          <article key={current.id} className="exam-page" aria-label={`${t.examQuestionAbbrev}${current.number}`}>
            <header className="exam-page__head">
              <span className="exam-page__n">
                <b className="exam-page__fig">{current.number}</b>
                <span className="exam-page__of">/ {questions.length}</span>
              </span>
              {mondai && (
                <span className="exam-page__part" lang="ja">
                  <b>問題{mondai.number}</b>{mondai.nameJp ?? ''}
                </span>
              )}
              {mondai && (
                <button
                  type="button"
                  className="exam-page__info"
                  aria-expanded={instructionsOpen}
                  aria-label={instructionsOpen ? t.examHideInstructions : t.examShowInstructions}
                  onClick={() => setOpenMondai({ id: current.mondaiId, open: !instructionsOpen })}
                >
                  <InfoIcon size={18} />
                </button>
              )}
            </header>
            {/* The instruction in the learner's words, not a second title in
                Japanese under the part's (plan 171); the paper's own
                Japanese for a part the table does not know. */}
            {mondai && instructionsOpen && (t.examMondaiHow[mondai.nameJp]
              ? <p className="exam-page__inst">{t.examMondaiHow[mondai.nameJp]}</p>
              : <p className="exam-page__inst" lang="ja">{mondai.instructionsJp}</p>)}
            <QuestionRenderer question={current} selected={selected} onSelect={select} devMode={devMode} apart />
          </article>

          <div className="exam-dock">
            <AnswerTiles key={current.id} question={current} selected={selected} onSelect={select} />
            <div className="exam-dock__nav">
              <button type="button" className="exam-dock__go" disabled={index === 0} onClick={() => jumpTo(index - 1)}>
                <ChevronIcon direction="left" size={16} /> {t.examPrevious}
              </button>
              <button
                type="button"
                className="exam-dock__go exam-dock__go--next"
                onClick={() => {
                  if (!last) { jumpTo(index + 1); return }
                  playUi('click-mode-selection')
                  setSheetOpen(true)
                }}
              >
                {last ? t.examSheetShort : t.examNextQuestion}
                {last ? <SheetIcon size={16} /> : <ChevronIcon direction="right" size={16} />}
              </button>
            </div>
          </div>
        </main>
        <LevelBar />

        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} jp={t.examSheetTitle}>
          <PartsSheet
            questions={questions}
            answers={answers}
            flagged={flagged}
            index={index}
            onJump={i => { setSheetOpen(false); jumpTo(i) }}
            onFinish={() => { setSheetOpen(false); requestFinish() }}
            onFirstBlank={() => { setSheetOpen(false); goToFirstBlank() }}
            busy={submitState === 'sending'}
          />
        </Sheet>
        {dialogs}
      </div>
    )
  }

  // ── 机 — the paper, sat at a desk (plan 115) ──
  // The answer sheet stands in the run's side the whole time — the
  // clock over it, the count, every question's chip, Finish — where the
  // phone opens the sheet by parts from its head. A reading passage
  // stands flat beside its questions, on a card of its own that stays
  // put from one of its questions to the next; the phone scrolls it
  // on the question's page.
  const paper = current.type === 'reading-passage' && current.passage
  const card = (
    <CardTransition cardKey={current.id}>
      <ExamCard question={current} selected={selected} onSelect={select} devMode={devMode} keys passageAside={Boolean(paper)} />
    </CardTransition>
  )
  return (
    <div className="screen desk-run desk-run--paper">
      <main id="main-content" className="container stage" style={{ '--line-color': EXAM_COLOR }}>
        {/* The exam's own head row (canvas ExamRunner): the way out,
            the paper, the clock. Walking out of a timed exam is worth
            a question — and the answer ("your progress is saved") is
            something the learner otherwise has no way to know. */}
        <div className="exam-meta">
          <Leave onClick={() => setLeaving(true)} keys="Escape">
            {t.leaveExam}
            <kbd className="desk-kbd" aria-hidden="true">{t.keyEscape}</kbd>
          </Leave>
          {/* On the desk Esc asks the same question (plan 115). */}
          <LeaveKey onLeave={askLeave} />
          <span className="exam-meta__section">
            <h1 className="exam-meta__jp">{paperTitle(exam, t)}</h1>
          </span>
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

        {paper ? (
          <div className="desk-paper">
            <div key={paper.id ?? current.mondaiId} className="prompt-card exam-passage desk-paper__text">
              <PassageText passage={paper} />
            </div>
            <div className="desk-paper__ask">{card}</div>
          </div>
        ) : card}

        <div className="exam-nav">
          {/* Reuses ReviewDeck's prev/next wording (see quizModes' review
              mode) rather than inventing a third "back"/"next" pair. */}
          <button type="button" className="btn-secondary" disabled={index === 0} onClick={() => jumpTo(index - 1)} aria-keyshortcuts="ArrowLeft">
            <ChevronIcon direction="left" size={14} /> {t.reviewPrev}
            <kbd className="desk-kbd" aria-hidden="true">←</kbd>
          </button>
          <button
            type="button"
            className={`exam-flag${isFlagged ? ' exam-flag--on' : ''}`}
            onClick={toggleFlag}
            aria-pressed={isFlagged}
            aria-label={isFlagged ? t.examUnflag : t.examFlag}
            aria-keyshortcuts="F"
            title={`${isFlagged ? t.examUnflag : t.examFlag} (F)`}
          >
            <FlagIcon size={16} filled={isFlagged} />
            <kbd className="desk-kbd" aria-hidden="true">F</kbd>
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={index === questions.length - 1}
            onClick={() => jumpTo(index + 1)}
            aria-keyshortcuts="ArrowRight"
          >
            {t.reviewNext} <ChevronIcon direction="right" size={14} />
            <kbd className="desk-kbd" aria-hidden="true">→</kbd>
          </button>
        </div>

      </main>
      {/* The same level bar every run docks (StudyStage); the exam
          draws its own stage, so it mounts it itself. */}
      <LevelBar />

      <RunSide label={t.examSheetTitle} color={EXAM_COLOR}>
        {timer}
        <div className="desk-answers">
          <b className="desk-answers__fig">{answeredCount} / {questions.length}</b>
          <span className="desk-answers__cap">{t.examSheetTitle}</span>
        </div>
        <AnswerSheet questions={questions} answers={answers} flagged={flagged} index={index} onJump={jumpTo} />
        <button type="button" className="btn-primary desk-answers__finish" onClick={requestFinish} disabled={submitState === 'sending'}>
          {submitState === 'sending' ? t.examSubmitting : t.examFinishSection}
        </button>
      </RunSide>

      {dialogs}
    </div>
  )
}

// ── The paper's cover (plan 171) ──────────────────────────────
// The owner's pick A2: before the first question, what the paper is --
// its section's own name, its questions, minutes and parts, each part by
// its JLPT name with what it asks in the learner's words -- and Start,
// which is what starts the clock. The clock used to start the moment the
// paper arrived, a paper being written included. Leaving from here asks
// nothing: there is nothing yet to lose.
function ExamCover({ exam, section, questions, last, onStart, onLeave }) {
  const { t } = useLang()
  const kind = paperKind(exam)
  const label = kind ? kindMeta(t)[kind].label : section.label
  const parts = section.mondai.map(m => ({
    ...m,
    count: questions.filter(q => q.mondaiId === m.id).length,
  })).filter(m => m.count > 0)
  return (
    <div className="screen">
      <main id="main-content" className="container stage exam-run exam-run--cover" style={{ '--line-color': EXAM_COLOR }}>
        <div className="stage__head">
          <Leave onClick={onLeave}>{t.examPapers}</Leave>
          <span className="stage__where">
            <h1 className="stage__where-jp">{paperTitle(exam, t)}</h1>
          </span>
        </div>
        <section className="exam-cover" aria-label={label}>
          <div className="exam-cover__names">
            <span className="cap exam-cover__tag">{exam.level} · {t.examTitle}</span>
            {section.labelJp && <h2 className="exam-cover__jp" lang="ja">{section.labelJp}</h2>}
            <span className="exam-cover__name">{label}</span>
          </div>
          <div className="records records--three exam-cover__figs">
            <div className="record"><b className="record__value">{questions.length}</b><span className="record__label">{t.examQuestions}</span></div>
            <div className="record"><b className="record__value">{section.timeLimitMin}</b><span className="record__label">{t.examMinutesUnit}</span></div>
            <div className="record"><b className="record__value">{parts.length}</b><span className="record__label">{t.examPartsUnit(parts.length)}</span></div>
          </div>
          <ol className="exam-cover__parts">
            {parts.map(m => (
              <li key={m.id} className="exam-cover__part">
                <span className="exam-cover__no" lang="ja">問題{m.number}</span>
                <span className="exam-cover__part-names">
                  <span className="exam-cover__part-jp" lang="ja">{m.nameJp ?? t.examPart(m.number)}</span>
                  {m.nameJp && t.examMondai[m.nameJp] && <span className="exam-cover__part-fr">{t.examMondai[m.nameJp]}</span>}
                </span>
                <span className="exam-cover__count">{m.count}</span>
              </li>
            ))}
          </ol>
          <ul className="exam-cover__notes">
            <li>{t.examCoverClock}</li>
            <li>{t.examCoverBlank}</li>
          </ul>
        </section>
        <div className="exam-cover__foot">
          {last && (
            <p className="exam-cover__last">
              <span className="record__label">{t.examLastScore}</span>
              <span className="exam-cover__last-fig">{last.correct} / {last.total}</span>
            </p>
          )}
          <button type="button" className="btn-primary exam-cover__go" onClick={onStart}>{t.examStart}</button>
        </div>
      </main>
      <LevelBar />
    </div>
  )
}
