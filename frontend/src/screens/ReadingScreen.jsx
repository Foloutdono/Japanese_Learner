import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import { Loading } from '../components/Loading'

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

// NOTE ON TRANSLATION KEYS: this rewrite (2026-08, real example
// sentences instead of LLM-generated ones) needs a handful of new
// LangContext keys that didn't exist before — the old phase-based ones
// (t.readingHiragana / t.readingKatakana / t.readingMixed and their
// *Desc siblings) are no longer referenced anywhere and can be removed
// from the translations file once you've added these:
//
//   t.readingSourceLevel         "By JLPT level"
//   t.readingSourceLevelDesc     "Sentences using vocabulary from a level you pick"
//   t.readingSourceFrequency     "By frequency"
//   t.readingSourceFrequencyDesc "Sentences using words from a frequency tier"
//   t.readingSourceMastery       "My cards"
//   t.readingSourceMasteryDesc   "Sentences made entirely of words you're learning or have mastered"
//   t.selectSource               "How do you want to pick sentences?"
//   t.selectDomain                "Which word list?"
//   t.domainVocabDeck            "Curated deck"
//   t.domainVocabDecDesc         "The app's own JLPT-leveled vocabulary"
//   t.domainVocabJmdict          "Full dictionary"
//   t.domainVocabJmdictDesc      "Every word in the JMdict pool, ranked by frequency"
//   t.selectTier                  "Select a frequency tier"
//   t.tierLabel                   "Tier {n}" (or adapt to your i18n interpolation style)
//   t.jumpToTier                  "Jump to tier…"
//   t.translationEnglish          "EN" (short label prefixing the translation, since real
//                                   example sentences only have an English gloss regardless
//                                   of UI language — see reading.py's translation_lang note)
//   t.notEnoughMasteryWords       "Not enough words in learning/mastered state yet — keep
//                                   studying and check back for this mode."
//
// Existing keys (selectLevel, readingTitle, score, writeWhatYouSaw,
// romajiPlaceholder, submit, didYouGetIt, correct, incorrect,
// correctRomaji, translation, yourAnswer, gradeIncorrect, gradeCorrect,
// nextPhrase, retry, readingFetchError, clickForDetails, ...) are all
// still used exactly as before.

const DEFAULT_TIER_SIZE = 200

export default function ReadingScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const SOURCES = [
    { key: 'level',     label: t.readingSourceLevel,     desc: t.readingSourceLevelDesc },
    { key: 'frequency', label: t.readingSourceFrequency, desc: t.readingSourceFrequencyDesc },
    { key: 'mastery',   label: t.readingSourceMastery,   desc: t.readingSourceMasteryDesc },
  ]

  const DOMAINS = [
    { key: 'vocab',        label: t.domainVocabDeck,   desc: t.domainVocabDecDesc },
    { key: 'vocab_jmdict', label: t.domainVocabJmdict, desc: t.domainVocabJmdictDesc },
  ]

  const [source, setSource] = useState(null)       // 'level' | 'frequency' | 'mastery'
  const [level, setLevel]   = useState(null)        // source === 'level'
  const [domain, setDomain] = useState(null)        // source === 'frequency'
  const [tier, setTier]     = useState(null)        // source === 'frequency'

  // 'loading' | 'showing' | 'answering' | 'feedback' | 'error'
  const [stage, setStage]   = useState('loading')
  const [data, setData]     = useState(null)   // current phrase item from the batch
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

  // Compact label matching reading.py's _source_label() — sent back on
  // /api/reading/result so history stays informative without a DB
  // migration (see reading.py's get_reading_batch docstring).
  function sourceLabel() {
    if (source === 'level') return `level:${level}`
    if (source === 'frequency') return `freq:${domain}:${tier}`
    return 'mastery'
  }

  function batchUrl(count) {
    const params = new URLSearchParams({ source, count, lang })
    if (source === 'level') params.set('level', level)
    if (source === 'frequency') { params.set('domain', domain); params.set('tier', tier) }
    return `/api/reading/batch?${params.toString()}`
  }

  function startSession() {
    setScore({ correct: 0, total: 0 })
    queueRef.current = []
    setStage('loading')
    setError(null)
    fetchBatch().then(phrases => {
      if (phrases.length === 0) {
        setError(t.readingFetchError)
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
  function fetchBatch() {
    fetchingRef.current = true
    return apiFetch(batchUrl(BATCH_SIZE), session)
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
        fetchBatch().then(more => {
          queueRef.current = [...queueRef.current, ...more]
        })
      }
      return
    }

    // Queue ran dry (unlikely, but possible after a slow/failed prefetch) —
    // fall back to a blocking fetch so the user isn't stuck.
    setStage('loading')
    fetchBatch().then(more => {
      if (more.length === 0) {
        setError(t.readingFetchError)
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
        source: sourceLabel(),
        level: source === 'level' ? level : null,
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
    fetchBatch().then(phrases => {
      if (phrases.length === 0) {
        setError(t.readingFetchError)
        setStage('error')
        return
      }
      showPhrase(phrases[0])
      queueRef.current = phrases.slice(1)
    })
  }

  function resetAll() {
    setSource(null)
    setLevel(null)
    setDomain(null)
    setTier(null)
  }

  // ── Source selection (level / frequency / my cards) ──
  if (!source) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.readingTitle} />
        <SelectionScreen subtitle={t.selectSource}>
          <ModeSelector modes={SOURCES} onSelect={setSource} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Level source: pick a JLPT level ──
  if (source === 'level' && !level) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSource(null)} title={t.readingTitle} />
        <SelectionScreen subtitle={t.selectLevel}>
          <LevelSelector onSelect={setLevel} color="var(--accent3)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Frequency source: pick a word list, then a tier ──
  if (source === 'frequency' && !domain) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSource(null)} title={t.readingTitle} />
        <SelectionScreen subtitle={t.selectDomain}>
          <ModeSelector modes={DOMAINS} onSelect={setDomain} />
        </SelectionScreen>
      </div>
    )
  }

  if (source === 'frequency' && domain && tier == null) {
    return (
      <div className="screen">
        <TopBar onBack={() => setDomain(null)} title={t.readingTitle} />
        <SelectionScreen subtitle={t.selectTier}>
          <TierPicker session={session} domain={domain} onSelect={setTier} t={t} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Session (all sources land here once fully configured) ──
  return (
    <SessionView
      t={t}
      source={source}
      level={level}
      domain={domain}
      tier={tier}
      stage={stage}
      data={data}
      timeLeft={timeLeft}
      answer={answer}
      setAnswer={setAnswer}
      feedback={feedback}
      score={score}
      error={error}
      detail={detail}
      isMobile={isMobile}
      onBack={resetAll}
      onStart={startSession}
      submitAnswer={submitAnswer}
      gradeAnswer={gradeAnswer}
      next={next}
      retry={retry}
      openSegmentDetail={openSegmentDetail}
      closeDetail={() => setDetail(null)}
    />
  )
}

// Kicks off the session's very first batch fetch exactly once, then
// renders the same stage machine the single-screen version used to.
// Split out mainly to keep the selection-screen early-returns above
// simple (each of those is a plain "pick one thing" screen).
function SessionView({
  t, source, level, domain, tier, stage, data, timeLeft, answer, setAnswer,
  feedback, score, error, detail, isMobile, onBack, onStart, submitAnswer,
  gradeAnswer, next, retry, openSegmentDetail, closeDetail,
}) {
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    onStart()
  }, [])

  const titleSuffix =
    source === 'level' ? level :
    source === 'frequency' ? `${domain === 'vocab_jmdict' ? t.domainVocabJmdict : t.domainVocabDeck} — ${t.tierLabel ? t.tierLabel.replace('{n}', tier) : `Tier ${tier}`}` :
    t.readingSourceMastery

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        title={`${t.readingTitle} — ${titleSuffix}`}
        autoHide
      />
      <div className="container quiz-area">

        <div className="rdg-score">
          {t.score}: {score.correct}/{score.total}
        </div>

        {stage === 'loading' && <Loading />}

        {stage === 'error' && (
          <div className="card rdg-error-card">
            {error}
            <div className="rdg-retry-wrap">
              <button onClick={retry} className="rdg-retry-btn">
                {t.retry}
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
                {t.writeWhatYouSaw}
              </div>
            </PromptCard>
            <input
              autoFocus
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAnswer()}
              placeholder={t.romajiPlaceholder}
              className="rdg-answer-input"
            />
            <div className="rdg-submit-wrap">
              <button
                onClick={submitAnswer}
                disabled={!answer.trim()}
                className="rdg-submit-btn"
              >
                {t.submit}
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
                        title={seg.type !== 'plain' ? (t.clickForDetails) : undefined}
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
                  ? (t.didYouGetIt)
                  : (feedback.correct ? (t.correct) : (t.incorrect))}
              </div>
              <div className="rdg-feedback-romaji">
                {t.correctRomaji}: <strong>{feedback.romaji}</strong>
              </div>
              {data.translation && (
                <div className="rdg-feedback-translation">
                  {/* Real example sentences only carry an English gloss
                      regardless of UI language — see reading.py's
                      translation_lang note — so this is labelled
                      explicitly instead of implying it matches `lang`. */}
                  {data.translation_lang === 'en' ? (t.translationEnglish ?? 'EN') : t.translation}: {data.translation}
                </div>
              )}
              <div className="rdg-feedback-your-answer">
                {t.yourAnswer}: {answer}
              </div>
            </PromptCard>
            <div className="rdg-feedback-actions">
              {feedback.correct === null ? (
                <div className="rdg-grade-row">
                  <button
                    onClick={() => gradeAnswer(false)}
                    className="rdg-grade-btn--wrong"
                  >
                    {t.gradeIncorrect}
                  </button>
                  <button
                    onClick={() => gradeAnswer(true)}
                    className="rdg-grade-btn--right"
                  >
                    {t.gradeCorrect}
                  </button>
                </div>
              ) : (
                <button
                  onClick={next}
                  className="rdg-next-btn"
                >
                  {t.nextPhrase}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {detail && (
        <DetailPanel detail={detail} t={t} isMobile={isMobile} onClose={closeDetail} />
      )}
    </div>
  )
}

// ── Frequency tier picker ────────────────────────────────
// No pre-existing tier-selection UI to reuse here (the study screens
// that already have frequency tiers weren't part of this rewrite), so
// this is a small purpose-built list: the first 50 tiers (ranks
// 1-10,000 at the default tier size — plenty for how deep most readers
// will want to go) plus a manual "jump to tier" input for anything
// further out. Mirrors ModeSelector's visual language rather than
// introducing a new one.
function TierPicker({ session, domain, onSelect, t }) {
  const [tiers, setTiers] = useState(null)
  const [error, setError] = useState(false)
  const [jumpValue, setJumpValue] = useState('')

  useEffect(() => {
    let cancelled = false
    apiFetch(`/api/frequency/${domain}/tiers?tier_size=${DEFAULT_TIER_SIZE}`, session)
      .then(r => { if (!r.ok) throw new Error('failed'); return r.json() })
      .then(d => { if (!cancelled) setTiers(d.tiers || []) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [domain])

  if (error) return <div className="card rdg-error-card">{t.readingFetchError}</div>
  if (!tiers) return <Loading />

  const visible = tiers.slice(0, 50)
  const modes = visible.map(tr => ({
    key: String(tr.tier),
    label: t.tierLabel ? t.tierLabel.replace('{n}', tr.tier) : `Tier ${tr.tier}`,
    desc: `${tr.start_rank}–${tr.end_rank} (${tr.count})`,
  }))

  return (
    <>
      <ModeSelector modes={modes} onSelect={key => onSelect(Number(key))} />
      <div className="rdg-tier-jump">
        <input
          type="number"
          min="1"
          max={tiers.length}
          value={jumpValue}
          onChange={e => setJumpValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && jumpValue && onSelect(Number(jumpValue))}
          placeholder={t.jumpToTier}
          className="rdg-answer-input"
        />
        <button
          onClick={() => jumpValue && onSelect(Number(jumpValue))}
          disabled={!jumpValue}
          className="rdg-submit-btn"
        >
          {t.submit}
        </button>
      </div>
    </>
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
          <Label>{t.appDefinition}</Label>
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
        <Label>{t.cardStats}</Label>
        <div className="detail-badges">
          <StatusBadge status={stats.status} />
          {stats.due && <StatusBadge status="due" />}
        </div>
        <StatRow label={t.totalReviews} value={stats.total_reviews} />
        <StatRow label={t.correctReviews} value={stats.correct_reviews} />
        <StatRow
          label={t.accuracy}
          value={stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
        />
        <StatRow
          label={t.interval}
          value={stats.interval_days !== null ? `${stats.interval_days} ${t.days}` : '—'}
        />
        <StatRow
          label={t.nextReview}
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
