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
      <div style={{ minHeight: '100vh' }}>
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
      <div style={{ minHeight: '100vh' }}>
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
    <div style={{ minHeight: '100vh' }}>
      <TopBar
        onBack={() => setPhase(null)}
        title={`${t.readingTitle || 'Reading practice'} — ${PHASES.find(p => p.key === phase)?.label}`}
      />
      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>

        <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
          {t.score || 'Score'}: {score.correct}/{score.total}
        </div>

        {stage === 'loading' && <Loading />}

        {stage === 'error' && (
          <div className="card" style={{ padding: 16, color: 'var(--danger)' }}>
            {error}
            <div style={{ marginTop: 12 }}>
              <button onClick={retry} style={{ background: 'var(--accent)', color: '#fff' }}>
                {t.retry || 'Retry'}
              </button>
            </div>
          </div>
        )}

        {stage === 'showing' && data && (
          <>
            <PromptCard>
              <div style={{ fontSize: 36, fontFamily: 'Yu Gothic, system-ui, -apple-system, "Segoe UI", sans-serif', color: '#fff' }}>
                {data.phrase}
              </div>
            </PromptCard>
            <div style={{ marginTop: 16 }}>
              <div style={{
                height: 6, background: 'var(--bg-panel)', borderRadius: 4, overflow: 'hidden', maxWidth: 300, margin: '0 auto',
              }}>
                <div style={{
                  height: '100%', background: 'var(--accent)',
                  width: `${(timeLeft / data.display_seconds) * 100}%`,
                  transition: 'width 0.1s linear',
                }} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                {timeLeft.toFixed(1)}s
              </div>
            </div>
          </>
        )}

        {stage === 'answering' && (
          <>
            <PromptCard>
              <div style={{ fontSize: 18, color: 'var(--text-secondary)' }}>
                {t.writeWhatYouSaw || 'Write what you saw, in romaji'}
              </div>
            </PromptCard>
            <input
              autoFocus
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAnswer()}
              placeholder={t.romajiPlaceholder || 'e.g. konnichiwa'}
              style={{
                fontSize: 22, padding: 12, borderRadius: 8, width: '100%', maxWidth: 360,
                background: 'var(--bg-panel)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', marginTop: 16, textAlign: 'center',
              }}
            />
            <div style={{ marginTop: 16 }}>
              <button
                onClick={submitAnswer}
                disabled={!answer.trim()}
                style={{ background: 'var(--accent)', color: '#fff', padding: '10px 28px', fontSize: 15 }}
              >
                {t.submit || 'Submit'}
              </button>
            </div>
          </>
        )}

        {stage === 'feedback' && data && feedback && (
          <>
            <PromptCard>
              <div style={{ fontSize: 32, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', marginBottom: 12, lineHeight: 1.5 }}>
                {data.segments
                  ? data.segments.map((seg, i) => (
                      <span
                        key={i}
                        onClick={() => openSegmentDetail(seg)}
                        style={{
                          color: seg.type === 'plain' ? '#fff' : (STATUS_COLORS[seg.stats.status] || STATUS_COLORS.not_started),
                          cursor: seg.type !== 'plain' ? 'pointer' : 'default',
                          textDecoration: seg.type !== 'plain' ? 'underline' : 'none',
                          textDecorationStyle: 'dotted',
                          textUnderlineOffset: 4,
                        }}
                        title={seg.type !== 'plain' ? (t.clickForDetails || 'Click for definition & stats') : undefined}
                      >
                        {seg.text}
                      </span>
                    ))
                  : data.phrase}
              </div>
              <div style={{
                fontSize: 18,
                color: feedback.correct === null ? 'var(--text-secondary)' : (feedback.correct ? 'var(--success)' : 'var(--danger)'),
                fontWeight: 'bold',
              }}>
                {feedback.correct === null
                  ? (t.didYouGetIt || 'Did you get it right?')
                  : (feedback.correct ? (t.correct || 'Correct!') : (t.incorrect || 'Not quite'))}
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
                {t.correctRomaji || 'Correct romaji'}: <strong>{feedback.romaji}</strong>
              </div>
              {data.translation && (
                <div style={{ fontSize: 15, color: 'var(--text-primary)', marginTop: 4 }}>
                  {t.translation || 'Translation'}: {data.translation}
                </div>
              )}
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
                {t.yourAnswer || 'Your answer'}: {answer}
              </div>
            </PromptCard>
            <div style={{ marginTop: 16 }}>
              {feedback.correct === null ? (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button
                    onClick={() => gradeAnswer(false)}
                    style={{ background: 'var(--danger)', color: '#fff', padding: '10px 24px', fontSize: 15 }}
                  >
                    {t.gradeIncorrect || "I got it wrong"}
                  </button>
                  <button
                    onClick={() => gradeAnswer(true)}
                    style={{ background: 'var(--success)', color: '#fff', padding: '10px 24px', fontSize: 15 }}
                  >
                    {t.gradeCorrect || "I got it right"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={next}
                  style={{ background: 'var(--accent)', color: '#fff', padding: '10px 28px', fontSize: 15 }}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 40, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>{title}</div>
        <button onClick={onClose} style={{ background: 'none', fontSize: 18, color: 'var(--text-secondary)' }}>✕</button>
      </div>

      {level && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{level}</div>
      )}

      {entry && Object.keys(entry).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Label>{t.appDefinition || 'Definition in the app'}</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(entry).map(([key, value]) => (
              <div key={key} style={{ fontSize: 14, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-secondary)', minWidth: 90, textTransform: 'capitalize' }}>{key}</span>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Label>{t.cardStats || 'Card stats'}</Label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
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
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="card"
          style={{ width: '100%', maxWidth: 480, margin: 16, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}
        >
          {content}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh', width: 360,
          padding: 24, overflowY: 'auto', borderRadius: 0,
        }}
      >
        {content}
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started
  const label = STATUS_LABELS[status] || status
  return (
    <span style={{
      fontSize: 12, color, border: `1px solid ${color}`,
      borderRadius: 4, padding: '2px 8px',
    }}>
      {label}
    </span>
  )
}