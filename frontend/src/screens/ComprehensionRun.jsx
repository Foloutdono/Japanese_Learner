import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { runSource } from '../domain/sentenceSource'
import { StudyStage } from '../components/study/StudyStage'
import PromptCard from '../components/study/PromptCard'
import { QuestionTypeBadge } from '../components/study/QuizComponents'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
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
  const { level: levelParam } = useParams()

  // The level list is this section's only picker, so its own root is
  // where the ‹ goes back to. Null for a grade that is not one.
  const route = runSource({ base: BASE, level: levelParam, levelsOnly: true })
  const level = route?.level ?? null

  const [stage, setStage]       = useState('loading')
  const [exercise, setExercise] = useState(null)   // { text, breakdown, questions, read_seconds }
  const [timeLeft, setTimeLeft] = useState(0)
  // Re-reading the text from the questions pauses the clock: the
  // reading window was for the first read, and coming back to check
  // a detail is what the paper allows.
  const [rereading, setRereading] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers]   = useState([])     // chosen option index per question
  const [picked, setPicked]     = useState(null)   // the current question's choice, until Next commits it
  const [results, setResults]   = useState(null)   // final { score, total, results[] }
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [openRow, setOpenRow]   = useState(null)   // which result row is opened on its question
  const [error, setError]       = useState(null)

  const timerRef = useRef(null)

  function startSession(lvl) {
    setStage('loading')
    setError(null)
    setRereading(false)
    setShowBreakdown(false)
    setOpenRow(null)
    setPicked(null)

    apiFetch(`/api/reading/comprehension?level=${lvl}&lang=${lang}`, session)
      .then(r => {
        if (!r.ok) throw new Error('Request failed')
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
      .catch(() => {
        setError(t.comprehensionFetchError)
        setStage('error')
      })
  }

  // Reading countdown — the first read only.
  useEffect(() => {
    if (stage !== 'reading' || rereading) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          clearTimer()
          setStage('questions')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return clearTimer
  }, [stage, rereading])

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
        breakdown: exercise.breakdown,
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
      })
      .catch(() => {
        setError(t.comprehensionSubmitError)
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

  // A grade the level list could not have offered: back to it rather
  // than an exercise nothing can be written for.
  if (!route) return <Navigate replace to={BASE} />

  const total = exercise?.questions?.length ?? 0

  // The passage cut into its sentences, as the exercise was served.
  // A backend that does not send one yet (the two deploy separately —
  // Vercel and Render) degrades to exactly what the toggle used to
  // open: the whole text over its whole translation, as one entry.
  const breakdown = exercise?.breakdown?.length
    ? exercise.breakdown
    : [{ jp: exercise?.text ?? '', translation: exercise?.translation ?? '', note: '' }]

  // One frame for the whole exercise, one way out, and a sub that says
  // where in it you are.
  const sub =
    stage === 'questions' || stage === 'submitting' ? `${level} · ${t.question} ${currentQ + 1} / ${total}` :
    stage === 'results' ? `${level} · ${t.practiceResult}` :
    level

  return (
    <StudyStage
      color={RIKAI_COLOR}
      onLeave={leave}
      leaveLabel={t[route.backKey]}
      where={t.comprehensionTitle}
      sub={sub}
      remaining={stage === 'questions' ? `${currentQ + 1} / ${total}` : undefined}
      pass={false}
      // The reading stage is the one that holds a page: it is bounded
      // to the screen so the passage scrolls in its own card rather
      // than taking the stage with it (index.css, .prompt-card--passage).
      className={stage === 'reading' ? 'stage--passage' : ''}
    >
      {/* A long wait (the text is written on demand) owes a sentence;
          the dots carry it (plan 067). */}
      {stage === 'loading' && <Loading copy={t.comprehensionGenerating} />}
      {stage === 'submitting' && <Loading />}

      {stage === 'error' && (
        <Empty tone="error" message={error} action={{ label: t.retry, onClick: () => startSession(level) }} />
      )}

      {stage === 'reading' && exercise && (
        <>
          {!rereading && (
            <div className="timer">
              <div className="timer__bar" aria-hidden="true">
                <span
                  className={`timer__fill${timeLeft < 60 ? ' timer__fill--low' : ''}`}
                  style={{ width: `${(timeLeft / exercise.read_seconds) * 100}%` }}
                />
              </div>
              <span className="timer__label" role="timer">{t.timeRemaining} · {formatTime(timeLeft)}</span>
            </div>
          )}

          {/* The text, and nothing else to do with it. The translation
              used to be a button away right here, which made the
              reading window optional: the fastest way through the
              paper was to read that and answer from it. It is
              now the breakdown on the result (below) — the same
              sentences, in the same order, but bought AFTER the
              answers are in rather than instead of them. */}
          <PromptCard prose className="prompt-card--passage" foot={{ left: level, right: t.comprehensionTitle }}>
            <span className="prose__jp prose__jp--passage" lang="ja">{exercise.text}</span>
          </PromptCard>

          <div className="stage__foot btn-row">
            <button type="button" className="btn-primary" onClick={finishReading}>
              {rereading ? t.compBackToQuestions : t.doneReading}
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
                  onClick={() => { playUi('click-mode-selection'); setPicked(i) }}
                >
                  <span className="mcq-row__accent" aria-hidden="true" />
                  <span className="mcq-row__index">{letter(i)}</span>
                  <span className="mcq-row__text mcq-row__text--latin">{option}</span>
                </button>
              ))}
            </div>

            <div className="stage__foot btn-row">
              <button type="button" className="btn-secondary" onClick={reread}>
                {t.reReadText}
              </button>
              <button type="button" className="btn-primary" disabled={picked == null} onClick={commitAnswer}>
                {currentQ + 1 < total ? t.reviewNext : t.submit}
              </button>
            </div>
          </>
        )
      })()}

      {stage === 'results' && results && (
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
                    onClick={() => { playUi('click-mode-selection'); setOpenRow(isOpen ? null : i) }}
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

          {/* 一文ずつ — the text again, one sentence at a time, each
              with its translation and a line on what it is built from
              (reading.py's breakdown). This is where the passage is
              finally read in the learner's own language, and it is
              the whole text: every sentence, in order, so the card is
              the original too. */}
          <button type="button" className="btn-secondary" onClick={() => setShowBreakdown(s => !s)} aria-expanded={showBreakdown}>
            {showBreakdown ? t.hideBreakdown : t.showBreakdown}
          </button>
          {showBreakdown && (
            <PromptCard prose foot={{ left: level, right: t.comprehensionTitle }}>
              <div className="cbd">
                {breakdown.map((part, i) => (
                  <div key={i} className="cbd__item">
                    <span className="prose__jp" lang="ja">{part.jp}</span>
                    {part.translation && <span className="cbd__en">{part.translation}</span>}
                    {part.note && <span className="prose__ai">{part.note}</span>}
                  </div>
                ))}
              </div>
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
    </StudyStage>
  )
}
