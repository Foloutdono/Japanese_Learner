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
import { CardTransition } from '../components/CardTransition'
import { playSfx } from '../components/sound'

const DEFAULT_TIER_SIZE = 200

// NOTE ON TRANSLATION KEYS: reuses the same generic study-source keys
// ReadingScreen.jsx does (t.byLevel/byLevelDesc, t.byFrequency/
// byFrequencyDesc, t.byMastery/byMasteryDesc, t.selectStudySource,
// t.selectLevel, t.selectDomain, t.selectTier, t.domainVocabDeck/Desc,
// t.domainVocabJmdict/Desc, t.tierLabel, t.jumpToTier, t.submit,
// t.loadError, t.retry, t.score, t.correct, t.incorrect, t.yourAnswer).
// Genuinely new keys are given an inline `??` fallback below so a
// missing translations.js entry never breaks the screen.

export default function TranslationScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const SOURCES = [
    { key: 'level',     label: t.byLevel,     desc: t.byLevelDesc },
    { key: 'frequency', label: t.byFrequency, desc: t.byFrequencyDesc },
    { key: 'mastery',   label: t.byMastery,   desc: t.byMasteryDesc },
  ]

  const DOMAINS = [
    { key: 'vocab',        label: t.domainVocabDeck,   desc: t.domainVocabDecDesc },
    { key: 'vocab_jmdict', label: t.domainVocabJmdict, desc: t.domainVocabJmdictDesc },
  ]

  const [source, setSource] = useState(null)       // 'level' | 'frequency' | 'mastery'
  const [level, setLevel]   = useState(null)        // source === 'level'
  const [domain, setDomain] = useState(null)        // source === 'frequency'
  const [tier, setTier]     = useState(null)        // source === 'frequency'

  // 'loading' | 'writing' | 'feedback' | 'error'
  const [stage, setStage]   = useState('loading')
  const [data, setData]     = useState(null)   // current phrase item from the batch
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null) // { correct } — correct stays null until self-graded
  const [score, setScore]   = useState({ correct: 0, total: 0 })
  const [streak, setStreak] = useState(0)
  const [error, setError]   = useState(null)

  // LLM analysis of THIS attempt — unlike reading mode's breakdown,
  // this can't be prefetched while the phrase is on screen (it needs
  // the learner's own answer, which doesn't exist yet), so it's fired
  // from submitAnswer() instead and shown loading in the feedback
  // stage rather than gated behind a toggle — it's the actual point of
  // this mode, not a supplementary extra.
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const fetchingRef = useRef(false) // guards against duplicate concurrent prefetches
  const queueRef = useRef([])       // upcoming phrases, prefetched (not rendered, so a ref is fine)
  // Monotonic counter stamped onto each shown phrase as `_uiKey` — used
  // as CardTransition's cardKey and to guard the analysis fetch against
  // a slow response landing after the learner has already moved on
  // (mirrors ReadingScreen.jsx's phraseCounterRef/analysisPhraseRef,
  // keyed here instead of by phrase text since the analysis depends on
  // the learner's answer too, not just which phrase is showing).
  const phraseCounterRef = useRef(0)
  const analysisKeyRef = useRef(null)

  const BATCH_SIZE = 5
  const PREFETCH_THRESHOLD = 1 // refill once only this many (or fewer) remain in queue

  // Compact label matching reading.py's _source_label() (same values,
  // same meaning — translation_log.phase mirrors reading_log.phase).
  function sourceLabel() {
    if (source === 'level') return `level:${level}`
    if (source === 'frequency') return `freq:${domain}:${tier}`
    return 'mastery'
  }

  function batchUrl(count) {
    const params = new URLSearchParams({ source, count, lang })
    if (source === 'level') params.set('level', level)
    if (source === 'frequency') { params.set('domain', domain); params.set('tier', tier) }
    return `/api/translation/batch?${params.toString()}`
  }

  function startSession() {
    setScore({ correct: 0, total: 0 })
    setStreak(0)
    queueRef.current = []
    setStage('loading')
    setError(null)
    fetchBatch().then(phrases => {
      if (phrases.length === 0) {
        setError(t.translationFetchError ?? t.readingFetchError)
        setStage('error')
        return
      }
      showPhrase(phrases[0])
      queueRef.current = phrases.slice(1)
    })
  }

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
    setData({ ...phraseData, _uiKey: phraseCounterRef.current++ })
    setAnswer('')
    setFeedback(null)
    setAnalysis(null)
    setAnalysisLoading(false)
    setStage('writing')
  }

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

    setStage('loading')
    fetchBatch().then(more => {
      if (more.length === 0) {
        setError(t.translationFetchError ?? t.readingFetchError)
        setStage('error')
        return
      }
      showPhrase(more[0])
      queueRef.current = more.slice(1)
    })
  }

  // Fires the LLM analysis for the attempt just submitted. Keyed by
  // _uiKey (not phrase text — reading.py's fetchAnalysis keys by text,
  // but here two different answers to the same recurring phrase would
  // otherwise be indistinguishable) so a slow response for a phrase the
  // learner has already left can't overwrite the feedback currently on
  // screen.
  function fetchAnalysis(phraseData, userAnswer) {
    const uiKey = phraseData._uiKey
    analysisKeyRef.current = uiKey
    setAnalysis(null)
    setAnalysisLoading(true)

    apiFetch('/api/translation/analyze', session, {
      method: 'POST',
      body: JSON.stringify({
        translation_prompt: phraseData.translation,
        target_phrase: phraseData.phrase,
        target_romaji: phraseData.romaji,
        user_answer: userAnswer,
        lang,
      }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (analysisKeyRef.current !== uiKey) return // learner already moved on
        setAnalysis(d ? d.analysis : null)
      })
      .catch(() => {
        if (analysisKeyRef.current === uiKey) setAnalysis(null)
      })
      .finally(() => {
        if (analysisKeyRef.current === uiKey) setAnalysisLoading(false)
      })
  }

  function submitAnswer() {
    if (!answer.trim() || stage !== 'writing') return
    const trimmed = answer.trim()
    setFeedback({ correct: null })
    setStage('feedback')
    fetchAnalysis(data, trimmed)
  }

  function gradeAnswer(isCorrect) {
    if (feedback?.correct !== null) return // already graded, ignore repeat clicks

    setFeedback(f => ({ ...f, correct: isCorrect }))
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    setStreak(s => (isCorrect ? s + 1 : 0))
    if (isCorrect) playSfx('success')

    apiFetch('/api/translation/result', session, {
      method: 'POST',
      body: JSON.stringify({
        source: sourceLabel(),
        level: source === 'level' ? level : null,
        translation_prompt: data.translation,
        phrase: data.phrase,
        romaji: data.romaji,
        answer: answer.trim(),
        correct: isCorrect,
      }),
    }).catch(() => {
      // Logging failure shouldn't block the learner from continuing.
    })
  }

  function retry() {
    setStage('loading')
    setError(null)
    fetchBatch().then(phrases => {
      if (phrases.length === 0) {
        setError(t.translationFetchError ?? t.readingFetchError)
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
        <TopBar onBack={() => navigate('/')} title={t.translationTitle ?? 'Translation'} />
        <SelectionScreen heading={t.selectStudySource}>
          <ModeSelector modes={SOURCES} onSelect={setSource} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Level source: pick a JLPT level ──
  if (source === 'level' && !level) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSource(null)} title={t.translationTitle ?? 'Translation'} />
        <SelectionScreen heading={t.selectLevel}>
          <LevelSelector onSelect={setLevel} color="var(--accent9)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Frequency source: pick a word list, then a tier ──
  if (source === 'frequency' && !domain) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSource(null)} title={t.translationTitle ?? 'Translation'} />
        <SelectionScreen heading={t.selectDomain}>
          <ModeSelector modes={DOMAINS} onSelect={setDomain} />
        </SelectionScreen>
      </div>
    )
  }

  if (source === 'frequency' && domain && tier == null) {
    return (
      <div className="screen">
        <TopBar onBack={() => setDomain(null)} title={t.translationTitle ?? 'Translation'} />
        <SelectionScreen heading={t.selectTier}>
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
      answer={answer}
      setAnswer={setAnswer}
      feedback={feedback}
      score={score}
      streak={streak}
      error={error}
      analysis={analysis}
      analysisLoading={analysisLoading}
      onBack={resetAll}
      onStart={startSession}
      submitAnswer={submitAnswer}
      gradeAnswer={gradeAnswer}
      next={next}
      retry={retry}
    />
  )
}

// Kicks off the session's first batch fetch exactly once, then renders
// the stage machine. Split out for the same reason ReadingScreen.jsx
// splits it: keeps the selection-screen early-returns above simple.
function SessionView({
  t, source, level, domain, tier, stage, data, answer, setAnswer,
  feedback, score, streak, error, analysis, analysisLoading,
  onBack, onStart, submitAnswer, gradeAnswer, next, retry,
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
    t.byMastery

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        title={`${t.translationTitle ?? 'Translation'} — ${titleSuffix}`}
        autoHide
      />
      <div className="container quiz-area trn-area">

        <div className="trn-score-row">
          <div className="trn-score">
            {t.score}: {score.correct}/{score.total}
          </div>
          {streak > 1 && (
            <div className="trn-streak" title={t.streak ?? 'Streak'}>
              🔥 {streak}
            </div>
          )}
        </div>

        {stage === 'loading' && <Loading />}

        {stage === 'error' && (
          <div className="card trn-error-card">
            {error}
            <div className="trn-retry-wrap">
              <button onClick={retry} className="trn-retry-btn">
                {t.retry}
              </button>
            </div>
          </div>
        )}

        {stage === 'writing' && data && (
          <>
            <CardTransition cardKey={data._uiKey}>
              <PromptCard>
                <div className="trn-prompt-label">
                  {/* Real example sentences only carry an English gloss
                      regardless of UI language — see reading.py's
                      translation_lang note — labelled explicitly rather
                      than implying it's already in the UI language. */}
                  {data.translation_lang === 'en' ? (t.translationEnglish ?? 'EN') : t.translation}
                </div>
                <div className="trn-prompt-text">
                  {data.translation}
                </div>
              </PromptCard>
            </CardTransition>

            <div className="trn-input-center">
              <input
                autoFocus
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitAnswer()}
                placeholder={t.japanesePlaceholder ?? 'Write it in Japanese…'}
                className="trn-answer-input"
              />
              <div className="trn-submit-wrap">
                <button
                  onClick={submitAnswer}
                  disabled={!answer.trim()}
                  className="trn-submit-btn"
                >
                  {t.submit}
                </button>
              </div>
            </div>
          </>
        )}

        {stage === 'feedback' && data && feedback && (
          <>
            <div className="trn-feedback-card">
              <PromptCard>
                <div className="trn-feedback-prompt">
                  {data.translation}
                </div>
                <div className="trn-feedback-your-answer">
                  {t.yourAnswer}: <strong>{answer}</strong>
                </div>
                <div className="trn-feedback-phrase">
                  {data.phrase}
                </div>
                <div className="trn-feedback-romaji">{data.romaji}</div>

                <div className="trn-analysis-wrap">
                  <div className="trn-analysis-label">
                    {t.aiAnalysis ?? 'AI analysis'}
                  </div>
                  {analysisLoading && (
                    <div className="trn-analysis-loading">
                      {t.analyzingTranslation ?? 'Analyzing your translation…'}
                    </div>
                  )}
                  {!analysisLoading && analysis && (
                    <div className="trn-analysis-text">{analysis}</div>
                  )}
                  {!analysisLoading && !analysis && (
                    <div className="trn-analysis-unavailable">
                      {t.analysisUnavailable ?? 'Analysis unavailable — judge against the reference above.'}
                    </div>
                  )}
                </div>
              </PromptCard>
            </div>

            <div className="trn-feedback-actions">
              {feedback.correct === null ? (
                <div className="trn-grade-row">
                  <button
                    onClick={() => gradeAnswer(false)}
                    className="trn-grade-btn--wrong"
                  >
                    {t.gradeIncorrect}
                  </button>
                  <button
                    onClick={() => gradeAnswer(true)}
                    className="trn-grade-btn--right"
                  >
                    {t.gradeCorrect}
                  </button>
                </div>
              ) : (
                <button
                  onClick={next}
                  className="trn-next-btn"
                >
                  {t.nextPhrase}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Frequency tier picker ────────────────────────────────
// Same shape as ReadingScreen.jsx's own TierPicker (not exported from
// there, so duplicated rather than shared — small enough that pulling
// it into its own component file wasn't worth doing just for this).
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

  if (error) return <div className="card trn-error-card">{t.loadError}</div>
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
      <div className="trn-tier-jump">
        <input
          type="number"
          min="1"
          max={tiers.length}
          value={jumpValue}
          onChange={e => setJumpValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && jumpValue && onSelect(Number(jumpValue))}
          placeholder={t.jumpToTier}
          className="trn-answer-input"
        />
        <button
          onClick={() => jumpValue && onSelect(Number(jumpValue))}
          disabled={!jumpValue}
          className="trn-submit-btn"
        >
          {t.submit}
        </button>
      </div>
    </>
  )
}
