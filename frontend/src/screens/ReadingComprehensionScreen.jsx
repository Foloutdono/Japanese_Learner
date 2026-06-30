import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import LevelSelector from '../components/LevelSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import { Loading } from '../components/QuizComponents'

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
      <div style={{ minHeight: '100vh' }}>
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
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setStage('selecting')} title={t.comprehensionTitle || 'Reading comprehension'} />
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Loading />
          <div style={{ color: 'var(--text-secondary)', marginTop: 16, fontSize: 14 }}>
            {t.comprehensionGenerating || 'Generating a text for you…'}
          </div>
        </div>
      </div>
    )
  }

  // ── Error ──
  if (stage === 'error') {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setStage('selecting')} title={t.comprehensionTitle || 'Reading comprehension'} />
        <div className="container" style={{ padding: 40, textAlign: 'center' }}>
          <div className="card" style={{ padding: 24, color: 'var(--danger)' }}>{error}</div>
          <button onClick={() => startSession(level)} style={{ marginTop: 16, background: 'var(--accent)', color: '#fff' }}>
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
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => { clearTimer(); setStage('selecting') }} title={`${t.comprehensionTitle || 'Reading comprehension'} — ${level}`} />
        <div className="container" style={{ padding: '24px 24px 40px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t.timeRemaining || 'Time remaining'}: <strong style={{ color: timeLeft < 60 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {formatTime(timeLeft)}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowTranslation(s => !s)}
                style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: 12 }}
              >
                {showTranslation ? (t.hideTranslation || 'Hide translation') : (t.showTranslation || 'Show translation')}
              </button>
              <button
                onClick={finishReading}
                style={{ background: 'var(--accent)', color: '#fff', fontSize: 13 }}
              >
                {t.doneReading || "Done reading"}
              </button>
            </div>
          </div>

          <div style={{ height: 4, background: 'var(--bg-panel)', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: timeLeft < 60 ? 'var(--danger)' : 'var(--accent)',
              width: `${readPct}%`, transition: 'width 1s linear',
            }} />
          </div>

          <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontFamily: 'Yu Gothic, sans-serif', lineHeight: 2.0, color: '#fff' }}>
              {exercise.text}
            </div>
          </div>

          {showTranslation && (
            <div className="card" style={{ padding: '16px 24px', borderLeft: '3px solid var(--accent2)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>
                {t.translation || 'Translation'}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6 }}>{exercise.translation}</div>
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
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setStage('selecting')} title={`${t.comprehensionTitle || 'Reading comprehension'} — ${level}`} />
        <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>

          {stage === 'submitting' ? (
            <Loading />
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
                {t.question || 'Question'} {currentQ + 1} / {total}
                <div style={{ height: 4, background: 'var(--bg-panel)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent)', width: `${((currentQ + 1) / total) * 100}%`, transition: 'width 0.3s' }} />
                </div>
              </div>

              <PromptCard>
                <div style={{ fontSize: 17, fontWeight: 'bold', lineHeight: 1.6, marginBottom: 8 }}>
                  {q.question}
                </div>
              </PromptCard>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24, textAlign: 'left' }}>
                {q.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => answerQuestion(i)}
                    style={{
                      textAlign: 'left', padding: '14px 20px', borderRadius: 10, fontSize: 15,
                      background: 'var(--bg-panel)', color: 'var(--text-primary)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.target.style.background = 'var(--bg-hover, rgba(255,255,255,0.08))'}
                    onMouseLeave={e => e.target.style.background = 'var(--bg-panel)'}
                  >
                    <span style={{ color: 'var(--text-secondary)', marginRight: 12, fontWeight: 'bold' }}>
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {option}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStage('reading')}
                style={{ marginTop: 24, background: 'none', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'underline' }}
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
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setStage('selecting')} title={`${t.comprehensionTitle || 'Reading comprehension'} — ${level}`} />
        <div className="container" style={{ padding: '32px 24px' }}>

          <div className="card" style={{
            textAlign: 'center', padding: '32px 24px', marginBottom: 24,
            display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 56, fontWeight: 'bold', color: scoreColor }}>
                {results.score}/{results.total}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{t.score || 'Score'}</div>
            </div>
            <div>
              <div style={{ fontSize: 56, fontWeight: 'bold', color: scoreColor }}>{pct}%</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{t.accuracy || 'Accuracy'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
            {results.results.map((r, i) => (
              <div key={i} className="card" style={{
                padding: '16px 20px',
                borderLeft: `3px solid ${r.is_correct ? 'var(--success)' : 'var(--danger)'}`,
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: 10, fontSize: 15 }}>
                  <span style={{ color: 'var(--text-secondary)', marginRight: 8 }}>Q{i + 1}.</span>
                  {r.question}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {r.options.map((opt, j) => {
                    const isCorrect = j === r.correct
                    const isUser = j === r.user_answer
                    const color = isCorrect ? 'var(--success)' : (isUser && !isCorrect ? 'var(--danger)' : 'var(--text-secondary)')
                    return (
                      <div key={j} style={{ fontSize: 14, color, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', minWidth: 20 }}>{String.fromCharCode(65 + j)}.</span>
                        <span>{opt}</span>
                        {isCorrect && <span style={{ fontSize: 12, marginLeft: 4 }}>✓</span>}
                        {isUser && !isCorrect && <span style={{ fontSize: 12, marginLeft: 4 }}>✗ {t.yourAnswer || 'your answer'}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px 24px', marginBottom: 32 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
              {t.originalText || 'Original text'}
            </div>
            <div style={{ fontSize: 16, fontFamily: 'Yu Gothic, sans-serif', lineHeight: 2.0, color: '#fff' }}>
              {exercise.text}
            </div>
            <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {exercise.translation}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => startSession(level)}
              style={{ background: 'var(--accent)', color: '#fff', padding: '10px 24px' }}
            >
              {t.tryAgain || 'Try again'}
            </button>
            <button
              onClick={() => setStage('selecting')}
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', padding: '10px 24px' }}
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