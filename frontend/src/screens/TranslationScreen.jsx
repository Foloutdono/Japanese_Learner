import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import TierSelector from '../components/selection/TierSelector'
import SelectionScreen from '../components/selection/SelectionScreen'
import { StudyStage } from '../components/study/StudyStage'
import PromptCard from '../components/study/PromptCard'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { CardTransition } from '../components/study/CardTransition'
import RatingBar from '../components/study/RatingBar'
import { FireIcon } from '../components/ui/Icons'
import { tierLabelFor, DEFAULT_TIER_SIZE } from '../domain/tiers'

const TRANSLATION_COLOR = 'var(--line-honyaku)'

// NOTE ON TRANSLATION KEYS: reuses the same generic study-source keys
// ReadingScreen.jsx does (t.byLevel/byLevelDesc, t.byFrequency/
// byFrequencyDesc, t.byMastery/byMasteryDesc, t.selectStudySource,
// t.selectLevel, t.selectDomain, t.selectTier, t.tierLabel, t.submit,
// t.loadError, t.retry, t.score, t.correct, t.incorrect, t.yourAnswer).

// Route: /practice/translation (plan 072: the pickers on the station
// page, the session on the stage — the canvas's TranslationWrite and
// Translation artboards: the prompt as a page, the field and Submit
// docked in the foot; then the answer, the reference, the AI's
// reading of it, and the rating bar docked).
export default function TranslationScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const SOURCES = [
    { key: 'level',     label: t.byLevel,     desc: t.byLevelDesc },
    { key: 'frequency', label: t.byFrequency, desc: t.byFrequencyDesc },
    { key: 'mastery',   label: t.byMastery,   desc: t.byMasteryDesc },
  ]

  const [source, setSource] = useState(null)       // 'level' | 'frequency' | 'mastery'
  const [level, setLevel]   = useState(null)        // source === 'level'
  const [domain, setDomain] = useState('vocab')     // source === 'frequency'
  const [tier, setTier]     = useState(null)
  const [tierSize, setTierSize] = useState(DEFAULT_TIER_SIZE)

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

  // Every sentence this session has already served, so the backend can
  // work through its curated bank rather than reshuffling the same
  // handful. Same mechanism ReadingScreen uses -- both modes draw from
  // the same picker (translation.py delegates to reading.py wholesale),
  // so both need to tell it what they have already shown.
  const seenRef = useRef([])

  function batchUrl(count) {
    const params = new URLSearchParams({ source, count, lang })
    if (source === 'level') params.set('level', level)
    if (source === 'frequency') {
      params.set('domain', domain)
      params.set('tier', tier)
      params.set('tier_size', tierSize)
    }
    // Capped: the bank is 30-55 sentences a level, so anything past that
    // is a query string growing without bound for no effect.
    if (seenRef.current.length) params.set('exclude', seenRef.current.slice(-60).join('|'))
    return `/api/translation/batch?${params.toString()}`
  }

  function startSession() {
    setScore({ correct: 0, total: 0 })
    setStreak(0)
    seenRef.current = []
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
      .then(d => {
        const phrases = d.phrases || []
        seenRef.current = [...seenRef.current, ...phrases.map(p => p.phrase)]
        return phrases
      })
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
        // Only a curated sentence has one. The backend adds a line to
        // the tutor prompt when it is present and says nothing when it
        // is not, rather than guessing what a corpus sentence is "for".
        grammar: phraseData.grammar ?? '',
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

  // `quality` is the learner's own rating, 0..5 worst to best, as
  // RatingBar emits it. `isCorrect` stays the derived pass/fail, because
  // it is what the score row, the streak and every existing reader of
  // translation_log understand -- the rating is recorded alongside it,
  // not instead of it.
  function gradeAnswer(isCorrect, quality = null) {
    if (feedback?.correct !== null) return // already graded, ignore repeat clicks

    setFeedback(f => ({ ...f, correct: isCorrect }))
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    setStreak(s => (isCorrect ? s + 1 : 0))
    // No playCorrect here any more: RatingBar plays the tap itself, on
    // both sides, and grading is only ever reached through it now --
    // calling it here too doubled the sound on a correct answer.

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
        quality,
        // The word this sentence was chosen to practise. The endpoint
        // resolves it to that word's SRS card so the rating schedules
        // something, rather than only being written down.
        source_word: data.source_word ?? null,
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
    setTier(null)
  }

  // ── Source selection (level / frequency / my cards) ──
  if (!source) {
    return (
      <SelectionScreen
        title={t.translationTitle}
        sub={t.selectStudySource}
        aside={<Leave onClick={() => navigate('/practice')}>{t.tabPractice}</Leave>}
      >
        <ModeSelector
          modes={SOURCES}
          onSelect={key => (key === 'mastery' ? board(() => setSource(key)) : setSource(key))}
        />
      </SelectionScreen>
    )
  }

  // ── Level source: pick a JLPT level ──
  if (source === 'level' && !level) {
    return (
      <SelectionScreen
        title={t.translationTitle}
        sub={t.selectLevel}
        aside={<Leave onClick={() => setSource(null)}>{t.leaveSources}</Leave>}
      >
        <LevelSelector onSelect={lvl => board(() => setLevel(lvl))} />
      </SelectionScreen>
    )
  }

  // ── Frequency source: the word list and the tier, on one page ──
  if (source === 'frequency' && tier == null) {
    return (
      <SelectionScreen
        title={t.translationTitle}
        sub={t.selectTier}
        aside={<Leave onClick={() => setSource(null)}>{t.leaveSources}</Leave>}
      >
        <Seg
          full
          label={t.selectDomain}
          value={domain}
          onChange={setDomain}
          options={[
            { key: 'vocab', label: t.freqDomainDeck },
            { key: 'vocab_jmdict', label: t.freqDomainJmdict },
          ]}
        />
        <TierSelector
          domain={domain}
          session={session}
          tierSize={tierSize}
          onTierSize={setTierSize}
          onSelect={tr => board(() => setTier(tr))}
        />
      </SelectionScreen>
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
      tierSize={tierSize}
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

function Streak({ streak, t }) {
  if (streak < 2) return null
  return (
    <span className="stage__streak" title={t.streak}>
      <FireIcon size={14} /> {streak}
    </span>
  )
}

// Kicks off the session's first batch fetch exactly once, then renders
// the stage machine. Split out for the same reason ReadingScreen.jsx
// splits it: keeps the selection-screen early-returns above simple.
function SessionView({
  t, source, level, domain, tier, tierSize, stage, data, answer, setAnswer,
  feedback, score, streak, error, analysis, analysisLoading,
  onBack, onStart, submitAnswer, gradeAnswer, next, retry,
}) {
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    onStart()
  }, [])

  const where =
    source === 'level' ? `${level} · ${t.stationJlpt}` :
    source === 'frequency' ? `${domain === 'vocab_jmdict' ? t.freqDomainJmdict : t.freqDomainDeck} · ${tierLabelFor(tier, tierSize)}` :
    t.byMastery

  // Real example sentences only carry an English gloss regardless of
  // UI language — see reading.py's translation_lang note — labelled
  // explicitly rather than implying it's already in the UI language.
  const promptLabel = data?.translation_lang === 'en' ? t.translationEnglish : t.translation

  return (
    <StudyStage
      color={TRANSLATION_COLOR}
      onLeave={onBack}
      leaveLabel={t.tabPractice}
      where={t.translationTitle}
      sub={where}
      remaining={`${score.correct} / ${score.total}`}
      pass={false}
      aside={<Streak streak={streak} t={t} />}
    >
      {stage === 'loading' && <Loading />}

      {stage === 'error' && (
        <Empty tone="error" message={error} action={{ label: t.retry, onClick: retry }} />
      )}

      {stage === 'writing' && data && (
        <>
          <CardTransition cardKey={data._uiKey}>
            <PromptCard prose foot={{ left: where, right: t.translationTitle }}>
              <span className="prose__label">{promptLabel}</span>
              <span className="prose__en prose__en--lead">{data.translation}</span>
            </PromptCard>
          </CardTransition>

          <form className="stage__foot" onSubmit={e => { e.preventDefault(); submitAnswer() }}>
            <input
              autoFocus
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder={t.japanesePlaceholder}
              aria-label={t.japanesePlaceholder}
              className="field"
              lang="ja"
            />
            <button type="submit" className="btn-primary" disabled={!answer.trim()}>
              {t.submit}
            </button>
          </form>
        </>
      )}

      {stage === 'feedback' && data && feedback && (
        <>
          <PromptCard
            prose
            foot={{
              left: where,
              // What this sentence was chosen to practise. Only a curated
              // sentence carries it, and a test proves the sentence
              // contains the point it names -- see
              // content/reading_sentences.py.
              right: data.grammar
                ? <>{t.readingGrammarPoint} · <span lang="ja">{data.grammar}</span></>
                : t.translationTitle,
            }}
          >
            <span className="prose__label">{promptLabel}</span>
            <span className="prose__en">{data.translation}</span>
            <span className="prose__rule" />
            <span className="prose__label">{t.yourAnswer}</span>
            <span className="prose__jp" lang="ja">{answer}</span>
            <span className="prose__label">{t.reference}</span>
            <span className="prose__jp" lang="ja">{data.phrase}</span>
            <span className="prose__romaji">{data.romaji}</span>
            <span className="prose__rule" />
            <span className="prose__label">{t.aiAnalysis}</span>
            {analysisLoading && <Loading inline copy={t.analyzingTranslation} />}
            {!analysisLoading && analysis && <span className="prose__ai">{analysis}</span>}
            {!analysisLoading && !analysis && <span className="prose__ai">{t.analysisUnavailable}</span>}
          </PromptCard>

          {feedback.correct === null ? (
            /* The same six-segment instrument the study screens grade
               with, instead of a right/wrong pair. A translation is
               rarely simply right or wrong, and the learner already
               knows how close they were -- the two buttons made them
               flatten that to a coin flip. RatingBar's own threshold
               decides correctness: q > 2 is a pass, which is the same
               line it draws between playCorrect and playWrong. */
            <RatingBar active onRate={q => gradeAnswer(q >= 3, q)} />
          ) : (
            <div className="stage__foot">
              <button type="button" onClick={next} className="btn-primary">
                {t.nextPhrase}
              </button>
            </div>
          )}
        </>
      )}
    </StudyStage>
  )
}
