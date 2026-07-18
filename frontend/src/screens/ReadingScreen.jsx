import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import { Loading } from '../components/QuizComponents'

const STATUS_COLORS = {
  mastered:     'var(--success)',
  learning:     'var(--accent2)',
  new:          'var(--warning)',
  not_started:  'var(--text-secondary)',
  due:          'var(--accent)',
}

const STATUS_LABELS = {
  mastered:     'Mastered',
  learning:     'Learning',
  new:          'New',
  not_started:  'Not in deck',
  due:          'Due now',
}

const MOBILE_BREAKPOINT = 768

export default function ReadingScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const PHASES = [
    { key: 'hiragana', label: t.readingHiragana || 'Hiragana only', desc: t.readingHiraganaDesc || 'Phrases written only in hiragana' },
    { key: 'katakana', label: t.readingKatakana || 'Katakana only', desc: t.readingKatakanaDesc || 'Phrases written only in katakana' },
    { key: 'mixed',    label: t.readingMixed || 'Everything', desc: t.readingMixedDesc || 'Natural Japanese with kanji and kana' },
  ]

  const [level, setLevel]   = useState(null)
  const [phase, setPhase]   = useState(null)

  // 'loading' | 'showing' | 'answering' | 'feedback' | 'error'
  const [stage, setStage]   = useState('loading')
  const [data, setData]     = useState(null)   // current { phrase, romaji, display_seconds }
  const [timeLeft, setTimeLeft] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null) // { correct, romaji }
  const [score, setScore]   = useState({ correct: 0, total: 0 })
  const [error, setError]   = useState(null)
  const [detail, setDetail] = useState(null) // { title, level, entry, stats } for the clicked vocab/kanji segment
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function openSegmentDetail(seg) {
    if (seg.type === 'plain') return
    setDetail({ title: seg.text, level: seg.level, entry: seg.entry, stats: seg.stats })
  }

  const timerRef = useRef(null)
  const fetchingRef = useRef(false) // guards against duplicate concurrent prefetches
  const queueRef = useRef([])       // upcoming phrases, prefetched (not rendered, so a ref is fine)

  const BATCH_SIZE = 5
  const PREFETCH_THRESHOLD = 1 // refill once only this many (or fewer) remain in queue

  function startSession(lvl, ph) {
    setLevel(lvl)
    setPhase(ph)
    setScore({ correct: 0, total: 0 })
    queueRef.current = []
    setStage('loading')
    setError(null)
    fetchBatch(lvl, ph).then(phrases => {
      if (phrases.length === 0) {
        setError(t.readingFetchError || "Couldn't load a phrase. Try again.")
        setStage('error')
        return
      }
      showPhrase(phrases[0])
      queueRef.current = phrases.slice(1)
    })
  }

  // Fetches a fresh batch from the backend. Returns a promise of the phrase
  // list so callers can decide what to do with it (show immediately vs.
  // silently append to the queue).
  function fetchBatch(lvl, ph) {
    fetchingRef.current = true
    return apiFetch(`/api/reading/batch?level=${lvl}&phase=${ph}&count=${BATCH_SIZE}&lang=${lang}`, session)
      .then(r => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      })
      .then(d => d.phrases || [])
      .catch(() => [])
      .finally(() => { fetchingRef.current = false })
  }

  function showPhrase(phraseData) {
    setData(phraseData)
    setAnswer('')
    setFeedback(null)
    setDetail(null)
    setStage('showing')
    setTimeLeft(phraseData.display_seconds)
  }

  // Pulls the next phrase from the queue (instant — no waiting), and tops
  // the queue back up in the background if it's getting low.
  function next() {
    if (queueRef.current.length > 0) {
      const [head, ...rest] = queueRef.current
      queueRef.current = rest
      showPhrase(head)

      if (rest.length <= PREFETCH_THRESHOLD && !fetchingRef.current) {
        fetchBatch(level, phase).then(more => {
          queueRef.current = [...queueRef.current, ...more]
        })
      }
      return
    }

    // Queue ran dry (unlikely, but possible after a slow/failed prefetch) —
    // fall back to a blocking fetch so the user isn't stuck.
    setStage('loading')
    fetchBatch(level, phase).then(more => {
      if (more.length === 0) {
        setError(t.readingFetchError || "Couldn't load a phrase. Try again.")
        setStage('error')
        return
      }
      showPhrase(more[0])
      queueRef.current = more.slice(1)
    })
  }

  // Countdown while the phrase is visible, then flip to the answering stage.
  useEffect(() => {
    if (stage !== 'showing') return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 0.1
        if (next <= 0) {
          clearTimer()
          setStage('answering')
          return 0
        }
        return next
      })
    }, 100)

    return clearTimer
  }, [stage])

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function submitAnswer() {
    if (!answer.trim() || stage !== 'answering') return
    // No correctness check here anymore — auto-comparing romaji proved too
    // brittle. Reveal the answer and let the user judge for themselves.
    setFeedback({ correct: null, romaji: data.romaji })
    setStage('feedback')
  }

  function gradeAnswer(isCorrect) {
    if (feedback?.correct !== null) return // already graded, ignore repeat clicks

    setFeedback(f => ({ ...f, correct: isCorrect }))
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))

    apiFetch('/api/reading/result', session, {
      method: 'POST',
      body: JSON.stringify({
        level, phase,
        phrase: data.phrase,
        romaji: data.romaji,
        answer: answer.trim(),
        correct: isCorrect,
      }),
    }).catch(() => {
      // Logging failure shouldn't block the user from continuing.
    })
  }

  function retry() {
    setStage('loading')
    setError(null)
    fetchBatch(level, phase).then(phrases => {
      if (phrases.length === 0) {
        setError(t.readingFetchError || "Couldn't load a phrase. Try again.")
        setStage('error')
        return
      }
      showPhrase(phrases[0])
      queueRef.current = phrases.slice(1)
    })
  }

  // ── Level selection ──
  if (!level) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.readingTitle || 'Reading practice'} />
        <SelectionScreen subtitle={t.selectLevel}>
          <LevelSelector onSelect={setLevel} color="var(--accent3)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Phase selection ──
  if (!phase) {
    return (
      <div className="screen">
        <TopBar onBack={() => setLevel(null)} title={`${t.readingTitle || 'Reading practice'} ${level}`} />
        <SelectionScreen subtitle={t.selectPhase}>
          <ModeSelector
            modes={PHASES.map(p => ({ key: p.key, label: p.label, desc: p.desc }))}
            onSelect={ph => startSession(level, ph)}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Session ──
  return (
    <div className="screen">
      <TopBar
        onBack={() => setPhase(null)}
        title={`${t.readingTitle || 'Reading practice'} — ${PHASES.find(p => p.key === phase)?.label}`}
        autoHide
      />
      <div className="container quiz-area">

        <div className="rdg-score">
          {t.score || 'Score'}: {score.correct}/{score.total}
        </div>

        {stage === 'loading' && <Loading />}

        {stage === 'error' && (
          <div className="card rdg-error-card">
            {error}
            <div className="rdg-retry-wrap">
              <button onClick={retry} className="rdg-retry-btn">
                {t.retry || 'Retry'}
              </button>
            </div>
          </div>
        )}

        {stage === 'showing' && data && (
          <>
            <PromptCard>
              <div className="rdg-phrase-display">
                {data.phrase}
              </div>
            </PromptCard>
            <div className="rdg-timer-wrap">
              <div className="rdg-phrase-progress">
                <div
                  className="rdg-phrase-progress__fill"
                  style={{ '--pct': `${(timeLeft / data.display_seconds) * 100}%` }}
                />
              </div>
              <div className="rdg-timer-label">
                {timeLeft.toFixed(1)}s
              </div>
            </div>
          </>
        )}

        {stage === 'answering' && (
          <>
            <PromptCard>
              <div className="rdg-answering-hint">
                {t.writeWhatYouSaw || 'Write what you saw, in romaji'}
              </div>
            </PromptCard>
            <input
              autoFocus
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAnswer()}
              placeholder={t.romajiPlaceholder || 'e.g. konnichiwa'}
              className="rdg-answer-input"
            />
            <div className="rdg-submit-wrap">
              <button
                onClick={submitAnswer}
                disabled={!answer.trim()}
                className="rdg-submit-btn"
              >
                {t.submit || 'Submit'}
              </button>
            </div>
          </>
        )}

        {stage === 'feedback' && data && feedback && (
          <>
            <PromptCard>
              <div className="rdg-feedback-phrase">
                {data.segments
                  ? data.segments.map((seg, i) => (
                      <span
                        key={i}
                        onClick={() => openSegmentDetail(seg)}
                        className={`word-span${seg.type !== 'plain' ? ' word-span--clickable' : ''}`}
                        style={{ '--word-color': seg.type === 'plain' ? '#fff' : (STATUS_COLORS[seg.stats.status] || STATUS_COLORS.not_started) }}
                        title={seg.type !== 'plain' ? (t.clickForDetails || 'Click for definition & stats') : undefined}
                      >
                        {seg.text}
                      </span>
                    ))
                  : data.phrase}
              </div>
              <div
                className="rdg-feedback-status"
                style={{ '--status-color': feedback.correct === null ? 'var(--text-secondary)' : (feedback.correct ? 'var(--success)' : 'var(--danger)') }}
              >
                {feedback.correct === null
                  ? (t.didYouGetIt || 'Did you get it right?')
                  : (feedback.correct ? (t.correct || 'Correct!') : (t.incorrect || 'Not quite'))}
              </div>
              <div className="rdg-feedback-romaji">
                {t.correctRomaji || 'Correct romaji'}: <strong>{feedback.romaji}</strong>
              </div>
              {data.translation && (
                <div className="rdg-feedback-translation">
                  {t.translation || 'Translation'}: {data.translation}
                </div>
              )}
              <div className="rdg-feedback-your-answer">
                {t.yourAnswer || 'Your answer'}: {answer}
              </div>
            </PromptCard>
            <div className="rdg-feedback-actions">
              {feedback.correct === null ? (
                <div className="rdg-grade-row">
                  <button
                    onClick={() => gradeAnswer(false)}
                    className="rdg-grade-btn--wrong"
                  >
                    {t.gradeIncorrect || "I got it wrong"}
                  </button>
                  <button
                    onClick={() => gradeAnswer(true)}
                    className="rdg-grade-btn--right"
                  >
                    {t.gradeCorrect || "I got it right"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={next}
                  className="rdg-next-btn"
                >
                  {t.nextPhrase || 'Next phrase'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {detail && (
        <DetailPanel detail={detail} t={t} isMobile={isMobile} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function DetailPanel({ detail, t, isMobile, onClose }) {
  const { title, level, entry, stats } = detail

  const content = (
    <>
      <div className="detail-header">
        <div className="detail-title">{title}</div>
        <button onClick={onClose} className="detail-close-btn">✕</button>
      </div>

      {level && (
        <div className="detail-level">{level}</div>
      )}

      {entry && Object.keys(entry).length > 0 && (
        <div className="detail-section">
          <Label>{t.appDefinition || 'Definition in the app'}</Label>
          <div className="detail-entry-list">
            {Object.entries(entry).map(([key, value]) => (
              <div key={key} className="detail-entry-row">
                <span className="detail-entry-row__key">{key}</span>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section">
        <Label>{t.cardStats || 'Card stats'}</Label>
        <div className="detail-badges">
          <StatusBadge status={stats.status} />
          {stats.due && <StatusBadge status="due" />}
        </div>
        <StatRow label={t.totalReviews || 'Reviews'} value={stats.total_reviews} />
        <StatRow label={t.correctReviews || 'Correct'} value={stats.correct_reviews} />
        <StatRow
          label={t.accuracy || 'Accuracy'}
          value={stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
        />
        <StatRow
          label={t.interval || 'Interval'}
          value={stats.interval_days !== null ? `${stats.interval_days} ${t.days || 'days'}` : '—'}
        />
        <StatRow
          label={t.nextReview || 'Next review'}
          value={stats.next_review ? new Date(stats.next_review).toLocaleDateString() : '—'}
        />
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div onClick={onClose} className="detail-overlay-sheet">
        <div onClick={e => e.stopPropagation()} className="card detail-sheet">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} className="detail-overlay-side">
      <div onClick={e => e.stopPropagation()} className="card detail-side">
        {content}
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <div className="detail-label">
      {children}
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started
  const label = STATUS_LABELS[status] || status
  return (
    <span className="status-pill" style={{ '--pill-color': color }}>
      {label}
    </span>
  )
}