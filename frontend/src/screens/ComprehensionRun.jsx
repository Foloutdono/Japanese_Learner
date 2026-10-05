import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { runSource } from '../domain/sentenceSource'
import { StudyStage } from '../components/study/StudyStage'
import { usePracticeXp } from '../hooks/usePracticeXp'
import PromptCard from '../components/study/PromptCard'
import { QuestionTypeBadge } from '../components/study/QuizComponents'
import { PassageBreakdown } from '../components/analysis/PassageBreakdown'
import { GrammarChips } from '../components/analysis/GrammarChips'
import { DictionaryLookupSheet } from '../components/dictionary/DictionaryDetail'
import { vocabLookup, grammarLookup, lookupKey } from '../components/analysis/lookup'
import { SideLookup } from '../components/analysis/SideLookup'
import { SentenceLine } from '../components/analysis/SentenceBreakdown'
import { DeskPane } from '../components/analysis/BreakdownSide'
import { SealedPanel } from '../components/study/SessionPanel'
import { RunLines } from '../components/study/RunLines'
import { KeyCap } from '../components/chrome/DeskKeys'
import { startTally, countReview } from '../stores/runTally'
import { RunStreak } from '../components/study/RunStreak'
import { useAsk } from '../hooks/useAsk'
import { AskPanel } from '../components/study/AskPanel'
import { askTarget } from '../domain/ask'
import { useDesk } from '../hooks/useDesk'
import { dialogOpen } from '../lib/dialogOpen'
import { CHOICE_KEY_INDEX, LETTER_KEY_INDEX } from '../domain/choiceKeys'
import { quotedFragments, sentenceFor } from '../domain/quotedFragments'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { paceFactor } from '../domain/readingPace'
import { useReadingPace } from '../stores/readingPace'
import { Clock, ReadingTimer, PaceChip } from '../components/reading/ReadingPieces'
import { CheckIcon, CrossIcon, ChevronIcon } from '../components/ui/Icons'

const RIKAI_COLOR = 'var(--line-rikai)'

// A, B, C, D — the canvas indexes a comprehension question's options
// by letter (the exam's rows carry the paper's own 1–4).
const letter = i => String.fromCharCode(65 + i)

const formatTime = secs => {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// The text on its card. The reading stage draws it bounded, its body
// scrolling inside (prompt-card--passage); the desk's side column draws
// it whole beside the questions (plan 115), with no foot — the stage's
// head already says which level and which exercise it is.
function Passage({ text, level, t, className, foot = true }) {
  return (
    <PromptCard prose className={className} foot={foot ? { left: level, right: t.comprehensionTitle } : undefined}>
      <span className="prose__jp prose__jp--passage" lang="ja">{text}</span>
    </PromptCard>
  )
}

// The passage cut into its sentences, as the exercise was served.
// A backend that does not send one yet (the two deploy separately —
// Vercel and Render) degrades to exactly what the toggle used to
// open: the whole text over its whole translation, as one entry.
function breakdownOf(exercise) {
  return exercise?.breakdown?.length
    ? exercise.breakdown
    : [{ jp: exercise?.text ?? '', translation: exercise?.translation ?? '', note: '', analysis: null }]
}

// Route: /practice/comprehension/:level — the whole exercise on the
// stage (the canvas's Comprehension and ComprehensionResult
// artboards). The level list is the station page above it, under the
// chrome (screens/SentenceStation.jsx).
//
// 'loading' | 'reading' | 'questions' | 'submitting' | 'results' | 'error'
const BASE = '/practice/comprehension'

export default function ComprehensionRun({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const desk = useDesk()
  const { level: levelParam } = useParams()

  // The level list is this section's only picker, so its own root is
  // where the ‹ goes back to. Null for a grade that is not one.
  const route = runSource({ base: BASE, level: levelParam, levelsOnly: true })
  const level = route?.level ?? null

  const [stage, setStage]       = useState('loading')
  const [exercise, setExercise] = useState(null)   // { text, breakdown, questions, read_seconds }
  // Counted in the server's seconds (read_seconds, the standard pace's):
  // the learner's reading pace (domain/readingPace.js) runs the clock
  // 1/factor as fast and scales what the timer prints. A null factor is
  // no clock: the text stays until Done reading.
  const [timeLeft, setTimeLeft] = useState(0)
  const factor = paceFactor(useReadingPace())
  // When this reading began, for the Enter key's guard below.
  const readFrom = useRef(0)
  // Re-reading the text from the questions pauses the clock: the
  // reading window was for the first read, and coming back to check
  // a detail is what the paper allows.
  const [rereading, setRereading] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers]   = useState([])     // chosen option index per question
  const [picked, setPicked]     = useState(null)   // the current question's choice, until Next commits it
  const [results, setResults]   = useState(null)   // final { score, total, results[] }
  // The fare for the exercise, once, off the submission's response.
  const fare = usePracticeXp()
  const [showBreakdown, setShowBreakdown] = useState(false)
  // Which sentence of the breakdown is open on its rows (plan 084).
  // The first, to begin with: the learner pressed "Show breakdown",
  // and a list of closed sentences would be the old list with one
  // more tap in front of it.
  const [openIndex, setOpenIndex] = useState(0)
  // One sheet for everything the breakdown opens (plan 096): the word
  // the learner tapped in a sentence opens its dictionary entry, a
  // marker row and a chip open the point's lesson.
  const [lookup, setLookup]     = useState(null)
  const closeLookup = useCallback(() => setLookup(null), [])
  const [openRow, setOpenRow]   = useState(null)   // which result row is opened on its question
  // { message, retry } — the retry flag exists because one of these
  // cannot be retried: a spent daily allowance comes back tomorrow, and
  // a button that says "Retry" and fails every time is worse than no
  // button (see the 429 branch in startSession).
  const [error, setError]       = useState(null)

  const timerRef = useRef(null)

  // 問 (plan 131): a question about a question, on the results, on the
  // desk -- never while the paper is being answered.
  const asking = useAsk(session, 'comprehension')

  function startSession(lvl) {
    setStage('loading')
    setError(null)
    // A new exercise is a new run: its figures start again (plan 129).
    startTally(`comprehension:${lvl}`)
    asking.reset()
    setRereading(false)
    setShowBreakdown(false)
    setOpenIndex(0)
    setLookup(null)
    setOpenRow(null)
    setPicked(null)

    apiFetch(`/api/reading/comprehension?level=${lvl}&lang=${lang}`, session)
      .then(r => {
        if (!r.ok) {
          // The status, carried on the error the way ImageInput's OCR
          // path does it: without it a 429 is indistinguishable from a
          // failure to reach the server, and the screen said "Couldn't
          // load a text. Try again." to a learner who had simply read
          // every new text the day allows.
          const failed = new Error('Request failed')
          failed.status = r.status
          throw failed
        }
        return r.json()
      })
      .then(data => {
        setExercise(data)
        setTimeLeft(data.read_seconds)
        setAnswers([])
        setCurrentQ(0)
        setResults(null)
        setStage('reading')
      })
      .catch(e => {
        // 429 is the daily ceiling on NEW exercises, and it is rare:
        // past the ceiling the server normally hands back a text the
        // learner has read before rather than refusing. This is the
        // case where it has nothing to hand back.
        setError(e?.status === 429
          ? { message: t.comprehensionLimitReached, retry: false }
          : { message: t.comprehensionFetchError, retry: true })
        setStage('error')
      })
  }

  // Reading countdown — the first read only.
  useEffect(() => {
    if (stage !== 'reading' || rereading) return
    readFrom.current = Date.now()
    if (factor == null) return

    const tick = 1 / factor
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= tick / 10) {
          clearTimer()
          setStage('questions')
          return 0
        }
        return prev - tick
      })
    }, 1000)

    return clearTimer
  }, [stage, rereading, factor])

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function finishReading() {
    clearTimer()
    setRereading(false)
    setStage('questions')
  }

  function reread() {
    setRereading(true)
    setStage('reading')
  }

  // A grammar chip — over the text or under a sentence — opens the
  // point's dictionary entry by its card id. No mining here: the plate
  // has its ✕ alone on this stage.
  const openGrammar = g => setLookup(grammarLookup(g))

  // Next commits the pick (the canvas: choose a row, then Next) and
  // submits on the last question.
  function commitAnswer() {
    if (picked == null) return
    playUi('click-mode-selection')
    const newAnswers = [...answers, picked]
    setAnswers(newAnswers)
    setPicked(null)

    if (newAnswers.length < exercise.questions.length) {
      setCurrentQ(q => q + 1)
    } else {
      submitAnswers(newAnswers)
    }
  }

  function submitAnswers(finalAnswers) {
    setStage('submitting')

    apiFetch('/api/reading/comprehension/result', session, {
      method: 'POST',
      body: JSON.stringify({
        level,
        text: exercise.text,
        translation: exercise.translation,
        // Without each sentence's analysis: a dozen token lists with
        // deck entries and SRS stats is not a payload to post over 4G
        // to be dropped (reading.py accepts the breakdown and stores
        // nothing of it).
        breakdown: exercise.breakdown?.map(part => {
          const copy = { ...part }
          delete copy.analysis
          return copy
        }),
        // The points the text was written around, so the next
        // exercise can keep clear of them.
        grammar_points: (exercise.grammar_points ?? []).map(g => g.pattern),
        questions: exercise.questions,
        answers: finalAnswers,
      }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      })
      .then(data => {
        setResults(data)
        setStage('results')
        // This run's figures (plan 129): each question at the quality
        // its fare was paid at (reading.py: 4 right, 1 wrong).
        data.results?.forEach(r => countReview({ quality: r.is_correct ? 4 : 1 }))
        fare.pay(data)
        // On the desk the review opens on the first miss, its question
        // in the middle and the sentence it quotes in the breakdown.
        if (desk) {
          const first = data.results?.findIndex(r => !r.is_correct) ?? -1
          const at = first >= 0 ? first : 0
          setOpenRow(at)
          const r = data.results?.[at]
          const k = r ? sentenceFor(breakdownOf(exercise), quotedFragments(r.question)) : -1
          if (k >= 0) setOpenIndex(k)
        }
      })
      .catch(() => {
        setError({ message: t.comprehensionSubmitError, retry: true })
        setStage('error')
      })
  }

  // ‹ — back to the level list.
  function leave() {
    clearTimer()
    navigate(route.back)
  }

  // The mount IS the start: the route is what says there is an
  // exercise to fetch, and which grade it is written to. Once only —
  // a re-render must not throw away the text being read.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !level) return
    startedRef.current = true
    startSession(level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The keys (plan 115). The one multiple-choice run that needed the
  // mouse for every answer: a letter or a digit picks, Enter commits,
  // and Enter ends the reading. Every width, as every run's keys are;
  // the desk prints them. Not while typing, under a dialog, or with a
  // modifier (Ctrl+C copies).
  useEffect(() => {
    if (stage !== 'questions' && stage !== 'reading') return undefined
    const onKey = e => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.isComposing || dialogOpen()) return
      const target = e.target
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName) || target?.isContentEditable) return
      const button = target?.closest?.('button')
      if (stage === 'reading') {
        // Only once the reading has run a second (a tick of the clock,
        // when there is one): the train door's any-key skip
        // (components/station/TrainDoor) must not also end the reading.
        // A focused button answers Enter itself.
        if (e.key !== 'Enter' || button) return
        if (!rereading && Date.now() - readFrom.current < 1000) return
        e.preventDefault()
        finishReading()
        return
      }
      const q = exercise?.questions?.[currentQ]
      if (!q) return
      const idx = LETTER_KEY_INDEX[e.key.toLowerCase()] ?? CHOICE_KEY_INDEX[e.key]
      if (idx !== undefined && idx < q.options.length) {
        e.preventDefault()
        playUi('click-mode-selection')
        setPicked(idx)
        return
      }
      if (e.key !== 'Enter') return
      // Next and Re-read answer Enter themselves when focused. A row
      // does not: it is the same node on the next question, and its
      // native press would pick a letter on a question not yet read.
      if (button && !button.classList.contains('mcq-row')) return
      e.preventDefault()
      if (picked != null) {
        document.activeElement?.blur?.()
        commitAnswer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // A grade the level list could not have offered: back to it rather
  // than an exercise nothing can be written for.
  if (!route) return <Navigate replace to={BASE} />

  const total = exercise?.questions?.length ?? 0

  const breakdown = breakdownOf(exercise)

  // One frame for the whole exercise, one way out, and a sub that says
  // where in it you are.
  const sub =
    stage === 'questions' || stage === 'submitting' ? `${level} · ${t.question} ${currentQ + 1} / ${total}` :
    stage === 'results' ? `${level} · ${t.practiceResult}` :
    level

  // The desk's side column (plan 115). While the questions are asked
  // the text stands in it whole — the paper prints them on one page, and
  // the phone's Re-read round trip has nothing left to do. On the
  // results it is the breakdown, open with no toggle, its doors opening
  // in the same column under the open sentence's line. Reading has no
  // side: the text is the stage then.
  const breakdownBody = (
    <>
      {exercise?.grammar_points?.length > 0 && (
        <GrammarChips grammar={exercise.grammar_points} t={t} quiet label={t.grammarInText} onOpen={openGrammar} />
      )}
      <PassageBreakdown
        sentences={breakdown}
        t={t}
        openIndex={openIndex}
        setOpenIndex={setOpenIndex}
        onTokenClick={w => setLookup(vocabLookup(w))}
        onGrammarOpen={openGrammar}
      />
    </>
  )
  const openSentence = breakdown[openIndex]
  //
  // On the desk's panels (plan 129) the column is the run's third from
  // the first frame: sealed while the text is written and while it is
  // read on the stage -- the breakdown is its translation -- the text
  // beside the questions, the breakdown on the results. A failed fetch
  // stands an empty column and no panels (plan 123).
  const side =
    (stage === 'questions' || stage === 'submitting') && exercise ? (
      <Passage text={exercise.text} level={level} t={t} foot={false} />
    ) : stage === 'results' && results ? (
      <DeskPane label={t.deskBreakdownLabel}>
        <SideLookup
          lookup={lookup}
          onExit={closeLookup}
          session={session}
          head={openSentence ? (
            <SentenceLine analysis={openSentence.analysis} text={openSentence.jp} t={t} onTokenClick={w => setLookup(vocabLookup(w))} />
          ) : null}
        >
          {breakdownBody}
        </SideLookup>
      </DeskPane>
    ) : stage === 'error' ? null : (
      <SealedPanel label={t.deskBreakdownWait} />
    )

  // The run's lines (plan 129): the questions, as far as they have been
  // asked -- never ahead of the one on the stage, and none while the
  // text is read -- and on the results every one with its verdict, each
  // opening its question in the middle and the sentence it quotes in the
  // breakdown. A record while they are asked: an answer is committed by
  // Next and not revisited, as on the paper.
  const asked = stage === 'questions' || stage === 'submitting'
  const questionLines = stage === 'results' && results
    ? results.results.map((r, i) => ({
      key: i, text: `Q${i + 1} · ${r.question}`, lang,
      quality: r.is_correct ? 4 : 1, verdict: r.is_correct ? t.correct : t.incorrect,
    }))
    : asked && exercise
      ? exercise.questions.slice(0, answers.length).map((q, i) => ({ key: i, text: `Q${i + 1} · ${q.question}`, lang, answered: true }))
      : []
  const currentQuestion = stage === 'questions' && exercise
    ? { label: `Q${currentQ + 1} · ${exercise.questions[currentQ].question}`, lang, quality: null }
    : null
  const deskOpen = stage === 'results' ? openRow : null

  // The asking's thread is the open question's: the text, its
  // translation, the question with its options, the right one and the
  // learner's, and the words of the sentence it quotes. Sealed until
  // the results (plan 131).
  const reviewed = stage === 'results' && results ? results.results[openRow ?? 0] : null
  const target = askTarget(null, reviewed ? {
    key: `q${openRow ?? 0}`,
    base: {
      sentence: exercise?.text,
      level,
      translation: exercise?.translation,
      review: [
        reviewed.question,
        ...reviewed.options.map((o, j) => `${letter(j)}. ${o}`),
        `Right answer: ${letter(reviewed.correct)}. The learner chose: ${reviewed.user_answer == null ? 'nothing' : letter(reviewed.user_answer)}.`,
      ].join('\n'),
    },
    analysis: breakdown[openIndex]?.analysis,
    open: true,
  } : { key: 'sealed', open: false })

  // A result row opens its question; on the desk it also opens the
  // sentence the question quotes, in the breakdown beside it. From the
  // run's lines (plan 129) a row is only ever opened, never folded: the
  // middle always stands one question.
  function openLine(i) {
    const r = results?.results?.[i]
    if (!r || i === openRow) return
    openResultRow(i, false, r)
  }
  function openResultRow(i, isOpen, r) {
    playUi('click-mode-selection')
    setOpenRow(isOpen ? null : i)
    if (!desk || isOpen) return
    const k = sentenceFor(breakdown, quotedFragments(r.question))
    if (k >= 0) {
      setLookup(null)
      setOpenIndex(k)
    }
  }

  return (
    <StudyStage
      color={RIKAI_COLOR}
      onLeave={leave}
      leaveLabel={t[route.backKey]}
      where={t.comprehensionTitle}
      sub={sub}
      // On the desk the count is the run's lines' (plan 129).
      remaining={stage === 'questions' && !desk ? `${currentQ + 1} / ${total}` : undefined}
      pass={false}
      aside={<RunStreak />}
      toast={fare.toast}
      onToastDone={fare.toastDone}
      records
      // Its answers are graded together at the end, so a meter would sit
      // empty through the questions: it keeps its own count (plan 174).
      meter={false}
      recordsLabel={t.deskQuestionsRated}
      panel={(
        <RunLines
          label={t.deskQuestionsRated}
          lines={questionLines}
          current={currentQuestion}
          openKey={deskOpen}
          onOpen={stage === 'results' ? openLine : undefined}
          keys={stage === 'results' ? [
            ['↑ ↓', t.deskKeyWalk],
            [t.keyEscape, t.deskKeyLeave],
          ] : [
            ['A–D', t.deskKeyPick],
            [t.keyEnter, t.deskKeyNext],
            [t.keyEscape, t.deskKeyLeave],
          ]}
          rhythm={[{ label: t.deskAnswered, value: `${answers.length} / ${total}` }]}
          ask={(
            <AskPanel key={target.key} ask={asking} askKey={target.key} context={target.context} open={target.open} text />
          )}
        />
      )}
      // The level bar steps off while the text is up: the passage band
      // is measured against the whole screen (index.css,
      // .stage--passage) and nothing is graded until the questions.
      // That band is a phone rule; the desk keeps its bar.
      levelBar={desk || stage !== 'reading'}
      side={side}
      sideLabel={stage === 'results' ? t.deskBreakdownLabel : t.deskPassageLabel}
      // The reading stage is the one that holds a page: it is bounded
      // to the screen so the passage scrolls in its own card rather
      // than taking the stage with it (index.css, .prompt-card--passage).
      // `stage--comprehension` stands its floor unframed on the desk, as
      // the four sentence runs' does (plan 185; the 机 section's 三面).
      className={stage === 'reading' ? 'stage--comprehension stage--passage' : 'stage--comprehension'}
    >
      {/* A long wait (the text is written on demand) owes a sentence;
          the dots carry it (plan 067). */}
      {stage === 'loading' && <Loading copy={t.comprehensionGenerating} />}
      {stage === 'submitting' && <Loading />}

      {stage === 'error' && (
        <Empty
          tone="error"
          message={error?.message}
          action={error?.retry ? { label: t.retry, onClick: () => startSession(level) } : undefined}
        />
      )}

      {stage === 'reading' && exercise && (
        <>
          {/* The window, and the pace's chip at its end (PaceChip). No
              clock: the reading run's own word for it, in its place. */}
          {!rereading && factor == null && <ReadingTimer untimed t={t} aside={<PaceChip session={session} />} />}
          {!rereading && factor != null && (
            <Clock
              fill={timeLeft / exercise.read_seconds}
              low={timeLeft * factor < 60}
              label={`${t.timeRemaining} · ${formatTime(timeLeft * factor)}`}
              aside={<PaceChip session={session} />}
            />
          )}

          {/* The text, and nothing else to do with it. The translation
              used to be a button away right here, which made the
              reading window optional: the fastest way through the
              paper was to read that and answer from it. It is
              now the breakdown on the result (below) — the same
              sentences, in the same order, but bought AFTER the
              answers are in rather than instead of them. */}
          <Passage className="prompt-card--passage" text={exercise.text} level={level} t={t} />

          <div className="stage__foot btn-row">
            <button type="button" className="btn-primary" onClick={finishReading} aria-keyshortcuts={desk ? 'Enter' : undefined}>
              {rereading ? t.compBackToQuestions : t.doneReading}
              <KeyCap>{t.keyEnter}</KeyCap>
            </button>
          </div>
        </>
      )}

      {stage === 'questions' && exercise && (() => {
        const q = exercise.questions[currentQ]
        return (
          <>
            <div className="deck-progress" aria-hidden="true">
              <div className="deck-progress__bar">
                <div className="deck-progress__segment" style={{ width: `${((currentQ + 1) / total) * 100}%`, background: RIKAI_COLOR }} />
              </div>
            </div>

            {/* The questions are written in the learner's language
                (reading.py's comprehension prompt), so the card is a
                page, not a Japanese face. */}
            <PromptCard className="prompt-card--ask">
              <QuestionTypeBadge type={q.type} />
              <span className="prose__en prose__en--lead">{q.question}</span>
            </PromptCard>

            <div className="mcq-list" role="group" aria-label={q.question}>
              {q.options.map((option, i) => (
                <button
                  key={i}
                  type="button"
                  className={`mcq-row${picked === i ? ' mcq-row--selected' : ''}`}
                  aria-pressed={picked === i}
                  aria-keyshortcuts={desk ? `${letter(i)} ${i + 1}` : undefined}
                  onClick={() => { playUi('click-mode-selection'); setPicked(i) }}
                >
                  <span className="mcq-row__accent" aria-hidden="true" />
                  <span className="mcq-row__index">{letter(i)}</span>
                  <span className="mcq-row__text mcq-row__text--latin">{option}</span>
                </button>
              ))}
            </div>

            <div className="stage__foot btn-row">
              {/* The text stands beside the questions on the desk. */}
              {!desk && (
                <button type="button" className="btn-secondary" onClick={reread}>
                  {t.reReadText}
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={picked == null}
                onClick={commitAnswer}
                aria-keyshortcuts={desk ? 'Enter' : undefined}
              >
                {currentQ + 1 < total ? t.reviewNext : t.submit}
                <KeyCap>{t.keyEnter}</KeyCap>
              </button>
            </div>
          </>
        )
      })()}

      {/* 机 (plan 129): the review as the exam's is on the desk -- the
          questions in the run's lines, the open one's card here with its
          options marked, the score in the run's figures. */}
      {stage === 'results' && results && desk && (() => {
        const r = results.results[openRow ?? 0]
        if (!r) return null
        return (
          <>
            <PromptCard className="prompt-card--ask">
              <QuestionTypeBadge type={r.type} />
              <span className="prose__en prose__en--lead">{r.question}</span>
            </PromptCard>
            <div className="mcq-list" role="group" aria-label={r.question}>
              {r.options.map((opt, j) => {
                const cls = [
                  'mcq-row',
                  j === r.correct && 'mcq-row--correct',
                  j === r.user_answer && j !== r.correct && 'mcq-row--wrong',
                ].filter(Boolean).join(' ')
                return (
                  <div key={j} className={cls}>
                    <span className="mcq-row__accent" aria-hidden="true" />
                    <span className="mcq-row__index">{letter(j)}</span>
                    <span className="mcq-row__text mcq-row__text--latin">{opt}</span>
                  </div>
                )
              })}
            </div>
            <div className="stage__foot btn-row">
              <button type="button" className="btn-secondary" onClick={leave}>
                {t.changeLevel}
              </button>
              <button type="button" className="btn-primary" onClick={() => startSession(level)}>
                {t.tryAgain}
              </button>
            </div>
          </>
        )
      })()}

      {stage === 'results' && results && !desk && (
        <>
          <div className="result-lattice">
            <div className="record">
              <span className="record__value">{results.score}<span className="record__unit">/ {results.total}</span></span>
              <span className="record__label">{t.score}</span>
            </div>
            <div className="record">
              <span className="record__value">{Math.round((results.score / results.total) * 100)}<span className="record__unit">%</span></span>
              <span className="record__label">{t.accuracy}</span>
            </div>
          </div>

          {/* One row per question; a missed one says what was picked
              and what was right. Tapping a row opens the question
              with its options marked. */}
          <div className="surface qrows">
            {results.results.map((r, i) => {
              const isOpen = openRow === i
              return (
                <div key={i} className="qrow-item">
                  <button
                    type="button"
                    className="qrow"
                    aria-expanded={isOpen}
                    onClick={() => openResultRow(i, isOpen, r)}
                  >
                    <span className={`exam-review-row__mark exam-review-row__mark--${r.is_correct ? 'ok' : 'x'}`} aria-hidden="true">
                      {r.is_correct ? <CheckIcon size={11} /> : <CrossIcon size={11} />}
                    </span>
                    <span className="qrow__q">Q{i + 1}</span>
                    {!r.is_correct && (
                      <span className="qrow__note">{t.compNote(letter(r.user_answer), letter(r.correct))}</span>
                    )}
                    <span className="exam-review-row__chev" aria-hidden="true">
                      <ChevronIcon direction={isOpen ? 'up' : 'down'} size={14} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="qrow__detail">
                      <span className="prose__en">{r.question}</span>
                      <div className="mcq-list">
                        {r.options.map((opt, j) => {
                          const cls = [
                            'mcq-row',
                            j === r.correct && 'mcq-row--correct',
                            j === r.user_answer && j !== r.correct && 'mcq-row--wrong',
                            j !== r.correct && j !== r.user_answer && 'mcq-row--filler',
                          ].filter(Boolean).join(' ')
                          return (
                            <div key={j} className={cls}>
                              <span className="mcq-row__accent" aria-hidden="true" />
                              <span className="mcq-row__index">{letter(j)}</span>
                              <span className="mcq-row__text mcq-row__text--latin">{opt}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 一文ずつ — the text again, sentence by sentence, each over
              its translation, and one at a time open on its words, its
              grammar and a line on what it is built from (reading.py's
              breakdown, analysed). This is where the passage is finally
              read in the learner's own language, and it is the whole
              text: every sentence, in order, so the card is the
              original too. Over it, the grammar points the text was
              written around (plan 084). */}
          {/* On the desk the breakdown stands open in the side column. */}
          {!desk && (
            <button type="button" className="btn-secondary" onClick={() => setShowBreakdown(s => !s)} aria-expanded={showBreakdown}>
              {showBreakdown ? t.hideBreakdown : t.showBreakdown}
            </button>
          )}
          {!desk && showBreakdown && (
            <PromptCard prose foot={{ left: level, right: t.comprehensionTitle }}>
              {breakdownBody}
            </PromptCard>
          )}

          <div className="stage__foot btn-row">
            <button type="button" className="btn-secondary" onClick={leave}>
              {t.changeLevel}
            </button>
            <button type="button" className="btn-primary" onClick={() => startSession(level)}>
              {t.tryAgain}
            </button>
          </div>
        </>
      )}

      {lookup && !desk && (
        <DictionaryLookupSheet key={lookupKey(lookup)} {...lookup} session={session} onClose={closeLookup} />
      )}
    </StudyStage>
  )
}
