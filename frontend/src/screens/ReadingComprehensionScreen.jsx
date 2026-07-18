import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import LevelSelector from '../components/LevelSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import { Loading, QuestionTypeBadge  } from '../components/QuizComponents'

// 'selecting' | 'loading' | 'reading' | 'questions' | 'submitting' | 'results' | 'error'

export default function ReadingComprehensionScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [level, setLevel]       = useState(null)
  const [stage, setStage]       = useState('selecting')
  const [exercise, setExercise] = useState(null)   // { text, translation, questions, read_seconds }
  const [timeLeft, setTimeLeft] = useState(0)
  const [showTranslation, setShowTranslation] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers]   = useState([])     // chosen option index per question
  const [results, setResults]   = useState(null)   // final { score, total, results[] }
  const [error, setError]       = useState(null)

  const timerRef = useRef(null)

  function startSession(lvl) {
    setLevel(lvl)
    setStage('loading')
    setError(null)
    setShowTranslation(false)

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
        setError(t.comprehensionFetchError || "Couldn't load a text. Try again.")
        setStage('error')
      })
  }

  // Reading countdown
  useEffect(() => {
    if (stage !== 'reading') return

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
  }, [stage])

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function finishReading() {
    clearTimer()
    setStage('questions')
  }

  function answerQuestion(optionIndex) {
    const newAnswers = [...answers, optionIndex]
    setAnswers(newAnswers)

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
        setError(t.comprehensionSubmitError || "Couldn't submit answers. Try again.")
        setStage('error')
      })
  }

  const formatTime = secs => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Level selection ──
  if (stage === 'selecting') {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.comprehensionTitle || 'Reading comprehension'} />
        <SelectionScreen subtitle={t.selectLevel}>
          <LevelSelector onSelect={startSession} color="var(--accent3)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Loading ──
  if (stage === 'loading') {
    return (
      <div className="screen">
        <TopBar onBack={() => setStage('selecting')} title={t.comprehensionTitle || 'Reading comprehension'} />
        <div className="comp-loading-wrap">
          <Loading />
          <div className="comp-loading-text">
            {t.comprehensionGenerating || 'Generating a text for you…'}
          </div>
        </div>
      </div>
    )
  }

  // ── Error ──
  if (stage === 'error') {
    return (
      <div className="screen">
        <TopBar onBack={() => setStage('selecting')} title={t.comprehensionTitle || 'Reading comprehension'} />
        <div className="container comp-error-page">
          <div className="card comp-error-card">{error}</div>
          <button onClick={() => startSession(level)} className="comp-retry-btn">
            {t.retry || 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  // ── Reading stage ──
  if (stage === 'reading' && exercise) {
    const readPct = (timeLeft / exercise.read_seconds) * 100

    return (
      <div className="screen">
        <TopBar onBack={() => { clearTimer(); setStage('selecting') }} title={`${t.comprehensionTitle || 'Reading comprehension'} — ${level}`} autoHide />
        <div className="container comp-reading-page">

          <div className="comp-reading-header">
            <div className="comp-time-remaining">
              {t.timeRemaining || 'Time remaining'}: <strong className="comp-time-value" style={{ '--time-color': timeLeft < 60 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {formatTime(timeLeft)}
              </strong>
            </div>
            <div className="comp-reading-actions">
              <button
                onClick={() => setShowTranslation(s => !s)}
                className="comp-toggle-translation"
              >
                {showTranslation ? (t.hideTranslation || 'Hide translation') : (t.showTranslation || 'Show translation')}
              </button>
              <button
                onClick={finishReading}
                className="comp-done-btn"
              >
                {t.doneReading || "Done reading"}
              </button>
            </div>
          </div>

          <div className="comp-bar-track comp-bar-track--reading">
            <div
              className="comp-bar-fill comp-bar-fill--linear"
              style={{ '--fill-color': timeLeft < 60 ? 'var(--danger)' : 'var(--accent)', '--fill-pct': `${readPct}%` }}
            />
          </div>

          <div className="card comp-text-card">
            <div className="comp-text-content">
              {exercise.text}
            </div>
          </div>

          {showTranslation && (
            <div className="card comp-translation-card">
              <div className="comp-translation-label">
                {t.translation || 'Translation'}
              </div>
              <div className="comp-translation-text">{exercise.translation}</div>
            </div>
          )}

        </div>
      </div>
    )
  }

  // ── Questions stage ──
  if ((stage === 'questions' || stage === 'submitting') && exercise) {
    const q = exercise.questions[currentQ]
    const total = exercise.questions.length

    return (
      <div className="screen">
        <TopBar onBack={() => setStage('selecting')} title={`${t.comprehensionTitle || 'Reading comprehension'} — ${level}`} autoHide />
        <div className="container quiz-area">

          {stage === 'submitting' ? (
            <Loading />
          ) : (
            <>
              <div className="comp-q-progress">
                {t.question || 'Question'} {currentQ + 1} / {total}
                <div className="comp-bar-track comp-bar-track--question">
                  <div className="comp-bar-fill" style={{ '--fill-pct': `${((currentQ + 1) / total) * 100}%` }} />
                </div>
              </div>

              <PromptCard>
                <QuestionTypeBadge type={q.type}/>
                <div className="comp-question-text">
                  {q.question}
                </div>
              </PromptCard>

              <div className="comp-options">
                {q.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => answerQuestion(i)}
                    className="comp-option-btn"
                  >
                    <span className="comp-option-btn__letter">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {option}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStage('reading')}
                className="comp-reread-btn"
              >
                {t.reReadText || 'Re-read the text'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Results ──
  if (stage === 'results' && results) {
    const pct = Math.round((results.score / results.total) * 100)
    const scoreColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'

    return (
      <div className="screen">
        <TopBar onBack={() => setStage('selecting')} title={`${t.comprehensionTitle || 'Reading comprehension'} — ${level}`} autoHide />
        <div className="container page-pad">

          <div className="card comp-score-card">
            <div>
              <div className="comp-score-value" style={{ '--score-color': scoreColor }}>
                {results.score}/{results.total}
              </div>
              <div className="comp-score-label">{t.score || 'Score'}</div>
            </div>
            <div>
              <div className="comp-score-value" style={{ '--score-color': scoreColor }}>{pct}%</div>
              <div className="comp-score-label">{t.accuracy || 'Accuracy'}</div>
            </div>
          </div>

          <div className="comp-results-list">
            {results.results.map((r, i) => (
              <div key={i} className="card comp-result-item" style={{ '--border-color': r.is_correct ? 'var(--success)' : 'var(--danger)' }}>
                <div className="comp-result-item__q">
                  <span className="comp-result-item__qnum">Q{i + 1}.</span>
                  {r.question}
                </div>
                <div className="comp-result-item__options">
                  {r.options.map((opt, j) => {
                    const isCorrect = j === r.correct
                    const isUser = j === r.user_answer
                    const color = isCorrect ? 'var(--success)' : (isUser && !isCorrect ? 'var(--danger)' : 'var(--text-secondary)')
                    return (
                      <div key={j} className="comp-result-option" style={{ '--opt-color': color }}>
                        <span className="comp-result-option__letter">{String.fromCharCode(65 + j)}.</span>
                        <span>{opt}</span>
                        {isCorrect && <span className="comp-result-option__mark">✓</span>}
                        {isUser && !isCorrect && <span className="comp-result-option__mark">✗ {t.yourAnswer || 'your answer'}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="card comp-original-card">
            <div className="comp-original-label">
              {t.originalText || 'Original text'}
            </div>
            <div className="comp-original-text">
              {exercise.text}
            </div>
            <div className="comp-original-translation">
              {exercise.translation}
            </div>
          </div>

          <div className="comp-results-actions">
            <button
              onClick={() => startSession(level)}
              className="comp-try-again-btn"
            >
              {t.tryAgain || 'Try again'}
            </button>
            <button
              onClick={() => setStage('selecting')}
              className="comp-change-level-btn"
            >
              {t.changeLevel || 'Change level'}
            </button>
          </div>

        </div>
      </div>
    )
  }

  return null
}