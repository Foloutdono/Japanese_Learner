import { useState, useEffect, useRef, useCallback } from 'react'
import { shortDate } from '../lib/formatDate'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { TopBar } from '../components/ui/TopBar'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import SelectionScreen from '../components/selection/SelectionScreen'
import PromptCard from '../components/study/PromptCard'
import { Loading } from '../components/ui/Loading'
import { CardTransition } from '../components/study/CardTransition'
import { playCorrect } from '../lib/audio'
import { FireIcon, EyeOffIcon, CrossIcon } from '../components/ui/Icons'
import { useDialog } from '../hooks/useDialog'

const STATUS_COLORS = {
  mastered:     'var(--success)',
  learning:     'var(--accent2)',
  new:          'var(--warning)',
  not_started:  'var(--text-secondary)',
  due:          'var(--accent)',
}

const MOBILE_BREAKPOINT = 768

// NOTE ON TRANSLATION KEYS: reuses the app's existing generic
// study-source keys (t.byLevel/byLevelDesc, t.byFrequency/
// byFrequencyDesc, t.byMastery/byMasteryDesc, t.selectStudySource,
// t.selectTier, t.loadError, t.status_*, t.clickForDetails,
// t.appDefinition, t.cardStats, t.inThisPhrase) rather than inventing
// reading-specific duplicates. Genuinely new keys (all with an inline
// `??` fallback below, so a missing translations.js entry never breaks
// the screen) are: showBreakdown, hideBreakdown, preparingBreakdown,
// streak.

const DEFAULT_TIER_SIZE = 200

// Best-effort color for a word chip in the AI breakdown line: prefer
// its vocab status; if the word itself isn't in the deck but some of
// its kanji are, hint at partial knowledge with accent3.
function wordColor(word) {
  if (word.vocab_match) return STATUS_COLORS[word.vocab_match.stats.status] || STATUS_COLORS.not_started
  if (word.kanji_matches?.length > 0) return 'var(--accent3)'
  return 'var(--text-secondary)'
}

export default function ReadingScreen({ session }) {
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

  // 'loading' | 'reading' | 'feedback' | 'error'
  //
  // 'reading' now covers both looking at the phrase AND writing the
  // answer at the same time (previously a separate 'answering' stage
  // that only started once the timer ran out) — see showPhrase/
  // submitAnswer below.
  const [stage, setStage]   = useState('loading')
  const [data, setData]     = useState(null)   // current phrase item from the batch
  const [timeLeft, setTimeLeft] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null) // { correct, romaji }
  const [score, setScore]   = useState({ correct: 0, total: 0 })
  // Consecutive correct grades — purely a lightweight gaming touch (no
  // XP/SRS backing here, reading practice isn't a card mode), reset on
  // any incorrect grade.
  const [streak, setStreak] = useState(0)
  const [error, setError]   = useState(null)
  const [detail, setDetail] = useState(null) // { title, level, entry, stats } for the clicked vocab/kanji
  // Stable so DetailPanel's useDialog doesn't re-run its focus-on-open
  // effect (and steal focus) on every render of this screen while the
  // detail sheet is open.
  const closeDetail = useCallback(() => setDetail(null), [])

  // AI breakdown of the current phrase — fetched in the background the
  // moment the phrase is shown (see showPhrase), using the exact same
  // LLM-driven segmentation the phrase-analyzer screen uses
  // (POST /api/phrase/analyze, save=false so reading sessions don't
  // flood the analyzer's own history). By the time the reader has
  // finished reading/writing and reaches the feedback stage, this is
  // almost always already resolved — the "show breakdown" button just
  // reveals it rather than triggering the fetch itself.
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  // Which word/kanji card the single-card breakdown carousel is
  // currently showing — see AnalysisBreakdown. Reset to 0 every time a
  // new phrase is shown (showPhrase) so the reader always starts at the
  // first word of a fresh breakdown.
  const [breakdownIndex, setBreakdownIndex] = useState(0)

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  )


  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // DetailPanel just needs {title, level, entry, stats} — sourced from
  // the AI breakdown's word/kanji shape (the backend no longer returns
  // a morphology-based `segments` field at all, see reading.py's
  // _finish_phrase note). Mirrors PhraseAnalyzerScreen's
  // openVocabDetail/openKanjiDetail, kept separate rather than shared
  // since the two screens' surrounding layout differs enough not to be
  // worth a shared component yet.
  function openAnalysisWordDetail(word) {
    if (!word.vocab_match) return
    setDetail({
      title: word.surface,
      entry: word.vocab_match.entry,
      stats: word.vocab_match.stats,
      level: word.vocab_match.level,
    })
  }

  function openAnalysisKanjiDetail(k) {
    setDetail({ title: k.kanji, entry: k.entry, stats: k.stats, level: k.level })
  }

  const timerRef = useRef(null)
  const fetchingRef = useRef(false) // guards against duplicate concurrent prefetches
  const queueRef = useRef([])       // upcoming phrases, prefetched (not rendered, so a ref is fine)
  // Monotonic counter stamped onto each shown phrase as `_uiKey` — used
  // as CardTransition's cardKey. Plain `data.phrase` text would collide
  // (no re-trigger of the crossfade/sound) if the same sentence happens
  // to come up twice in a row, which real example-sentence batches can
  // do.
  const phraseCounterRef = useRef(0)
  // Identifies which phrase the in-flight analysis fetch belongs to, so
  // a slow response for a phrase the reader has already moved past
  // can't overwrite the (possibly already-loaded) analysis for the
  // phrase actually on screen.
  const analysisPhraseRef = useRef(null)

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

  // Every sentence this session has already served, so the backend can
  // work through its curated bank rather than reshuffling the same
  // handful (see reading.py's _pick_curated_phrases). '|' rather than
  // ',' because a Japanese sentence may well contain a comma — 、 is a
  // different character, but the English translations and the corpus
  // sentences are not guaranteed to be that tidy.
  const seenRef = useRef([])

  function batchUrl(count) {
    const params = new URLSearchParams({ source, count, lang })
    if (source === 'level') params.set('level', level)
    if (source === 'frequency') { params.set('domain', domain); params.set('tier', tier) }
    // Capped: the curated bank is 30-55 sentences a level, so anything
    // past that is a query string growing without bound for no effect.
    if (seenRef.current.length) params.set('exclude', seenRef.current.slice(-60).join('|'))
    return `/api/reading/batch?${params.toString()}`
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
      .then(d => {
        const phrases = d.phrases || []
        seenRef.current = [...seenRef.current, ...phrases.map(p => p.phrase)]
        return phrases
      })
      .catch(() => [])
      .finally(() => { fetchingRef.current = false })
  }

  // Kicks off the AI breakdown for `phraseText` in the background —
  // fired the instant a phrase is shown (see showPhrase) so it has the
  // whole display+writing window to resolve before the reader ever
  // asks for it. `save: false` keeps this out of the phrase-analyzer's
  // own history (see phrase.py's PhraseRequest.save).
  function fetchAnalysis(phraseText) {
    analysisPhraseRef.current = phraseText
    setAnalysis(null)
    setAnalysisLoading(true)
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: phraseText, save: false }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (analysisPhraseRef.current !== phraseText) return // reader already moved on
        setAnalysis(d)
      })
      .catch(() => {
        if (analysisPhraseRef.current === phraseText) setAnalysis(null)
      })
      .finally(() => {
        if (analysisPhraseRef.current === phraseText) setAnalysisLoading(false)
      })
  }

  function showPhrase(phraseData) {
    setData({ ...phraseData, _uiKey: phraseCounterRef.current++ })
    setAnswer('')
    setFeedback(null)
    setDetail(null)
    setShowBreakdown(false)
    setBreakdownIndex(0)
    setStage('reading')
    setTimeLeft(phraseData.display_seconds)
    fetchAnalysis(phraseData.phrase)
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

  // Countdown while the phrase is up. Reaching zero no longer changes
  // `stage` — writing is available from the moment the phrase appears
  // (see the 'reading' stage's render below) — it just covers the
  // phrase text so recall keeps mattering for anyone who didn't finish
  // writing before the timer ran out.
  useEffect(() => {
    if (stage !== 'reading') return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 0.1
        return next <= 0 ? 0 : next
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
    if (!answer.trim() || stage !== 'reading') return
    clearTimer()
    // No correctness check here anymore — auto-comparing romaji proved too
    // brittle. Reveal the answer and let the user judge for themselves.
    setFeedback({ correct: null, romaji: data.romaji })
    setStage('feedback')
  }

  function gradeAnswer(isCorrect) {
    if (feedback?.correct !== null) return // already graded, ignore repeat clicks

    setFeedback(f => ({ ...f, correct: isCorrect }))
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    setStreak(s => {
      const next = isCorrect ? s + 1 : 0
      return next
    })
    if (isCorrect) playCorrect()

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
        <main id="main-content">
          <SelectionScreen heading={t.selectStudySource}>
            {/* 'mastery' needs no further choice, so choosing it is the
                last step and boards straight away. The other two each
                have one more list after this one. */}
            <ModeSelector
              modes={SOURCES}
              onSelect={key => (key === 'mastery' ? board(() => setSource(key)) : setSource(key))}
            />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Level source: pick a JLPT level ──
  if (source === 'level' && !level) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSource(null)} title={t.readingTitle} />
        <main id="main-content">
          <SelectionScreen heading={t.selectLevel}>
            <LevelSelector onSelect={lvl => board(() => setLevel(lvl))} />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Frequency source: pick a word list, then a tier ──
  if (source === 'frequency' && !domain) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSource(null)} title={t.readingTitle} />
        <main id="main-content">
          <SelectionScreen heading={t.selectDomain}>
            <ModeSelector modes={DOMAINS} onSelect={setDomain} />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  if (source === 'frequency' && domain && tier == null) {
    return (
      <div className="screen">
        <TopBar onBack={() => setDomain(null)} title={t.readingTitle} />
        <main id="main-content">
          <SelectionScreen heading={t.selectTier}>
            <TierPicker session={session} domain={domain} onSelect={tr => board(() => setTier(tr))} t={t} />
          </SelectionScreen>
        </main>
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
      streak={streak}
      error={error}
      detail={detail}
      isMobile={isMobile}
      analysis={analysis}
      analysisLoading={analysisLoading}
      showBreakdown={showBreakdown}
      setShowBreakdown={setShowBreakdown}
      breakdownIndex={breakdownIndex}
      setBreakdownIndex={setBreakdownIndex}
      onBack={resetAll}
      onStart={startSession}
      submitAnswer={submitAnswer}
      gradeAnswer={gradeAnswer}
      next={next}
      retry={retry}
      openAnalysisWordDetail={openAnalysisWordDetail}
      openAnalysisKanjiDetail={openAnalysisKanjiDetail}
      closeDetail={closeDetail}
    />
  )
}

// Kicks off the session's very first batch fetch exactly once, then
// renders the same stage machine the single-screen version used to.
// Split out mainly to keep the selection-screen early-returns above
// simple (each of those is a plain "pick one thing" screen).
function SessionView({
  t, source, level, domain, tier, stage, data, timeLeft, answer, setAnswer,
  feedback, score, streak, error, detail, isMobile, analysis, analysisLoading,
  showBreakdown, setShowBreakdown, breakdownIndex, setBreakdownIndex, onBack, onStart, submitAnswer,
  gradeAnswer, next, retry, openAnalysisWordDetail,
  openAnalysisKanjiDetail, closeDetail,
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

  const phraseCovered = stage === 'reading' && timeLeft <= 0

  return (
    <div className="screen">
      <TopBar
        onBack={onBack}
        title={`${t.readingTitle} — ${titleSuffix}`}
        autoHide
      />
      <main id="main-content" className="container quiz-area rdg-area">

        <div className="rdg-score-row">
          <div className="rdg-score">
            {t.score}: {score.correct}/{score.total}
          </div>
          {streak > 1 && (
            <div className="rdg-streak" title={t.streak ?? 'Streak'}>
              <FireIcon size={14} /> {streak}
            </div>
          )}
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

        {stage === 'reading' && data && (
          <>
            <CardTransition cardKey={data._uiKey}>
              <PromptCard>
                <div className={`rdg-phrase-display${phraseCovered ? ' rdg-phrase-display--covered' : ''}`}>
                  {phraseCovered ? <EyeOffIcon size={34} /> : data.phrase}
                </div>
              </PromptCard>
            </CardTransition>

            <div className="rdg-timer-wrap">
              <div className="rdg-phrase-progress">
                <div
                  className="rdg-phrase-progress__fill"
                  style={{ '--pct': `${(timeLeft / data.display_seconds) * 100}%` }}
                />
              </div>
              <div className="rdg-timer-label">
                {phraseCovered ? (t.writeWhatYouSaw) : `${timeLeft.toFixed(1)}s`}
              </div>
            </div>

            {/* Fix: the answer field is available the whole time the
                phrase is on screen, not only after the timer runs out —
                the reader can start writing as soon as they're ready. */}
            <div className="rdg-input-center">
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
            </div>
          </>
        )}

        {stage === 'feedback' && data && feedback && (
          <>
            {/* rdg-feedback-card wrapper only exists to scope the mobile
                max-height override below (see index.css) — PromptCard
                itself caps at 60vh with internal scroll everywhere else
                in the app (flashcard sizing), which turns into an
                unwanted "scroll to see the rest of the breakdown" on
                small screens once the single-card breakdown is open. */}
            <div className="rdg-feedback-card">
            <PromptCard>
              {/* Fix: pushing "show breakdown" hides everything above the
                  toggle (phrase/status/romaji/translation/your-answer) so
                  the single-card breakdown below gets the room instead of
                  being squeezed under a wall of already-read text. */}
              {!showBreakdown && (
                <>
                  <div className="rdg-feedback-phrase">
                    {data.phrase}
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
                  {/* Only a curated sentence carries this: it was written
                      to demonstrate exactly this point, and a test proves
                      it contains it (see content/reading_sentences.py).
                      A corpus sentence gets no label rather than a
                      guessed one. */}
                  {data.grammar && (
                    <div className="rdg-feedback-grammar">
                      <span className="rdg-feedback-grammar__label">{t.readingGrammarPoint}</span>
                      <span className="rdg-feedback-grammar__pattern" lang="ja">{data.grammar}</span>
                    </div>
                  )}
                  <div className="rdg-feedback-your-answer">
                    {t.yourAnswer}: {answer}
                  </div>
                </>
              )}

              {feedback.correct !== null && (
                <div className="rdg-breakdown-wrap">
                  <button
                    onClick={() => setShowBreakdown(s => !s)}
                    disabled={!analysis && !analysisLoading}
                    className="rdg-breakdown-toggle"
                  >
                    {showBreakdown
                      ? (t.hideBreakdown ?? 'Hide breakdown')
                      : analysis
                        ? (t.showBreakdown ?? 'Show breakdown')
                        : (t.preparingBreakdown ?? 'Preparing breakdown…')}
                  </button>

                  {showBreakdown && analysis && (
                    <AnalysisBreakdown
                      analysis={analysis}
                      index={breakdownIndex}
                      setIndex={setBreakdownIndex}
                      t={t}
                      onWordClick={openAnalysisWordDetail}
                      onKanjiClick={openAnalysisKanjiDetail}
                    />
                  )}
                </div>
              )}
            </PromptCard>
            </div>
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
      </main>

      {detail && (
        <DetailPanel detail={detail} t={t} isMobile={isMobile} onClose={closeDetail} />
      )}
    </div>
  )
}

// Simple stroke-based chevron — real vector paths instead of the
// `‹`/`›` text glyphs this used to render, whose optical centering
// varies by font/OS. `display: block` avoids the few px of inline
// descender space an <svg> gets by default, so it sits dead-center in
// the round nav button regardless.
function ChevronIcon({ direction = 'left' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {direction === 'left'
        ? <polyline points="15 5 8 12 15 19" />
        : <polyline points="9 5 16 12 9 19" />}
    </svg>
  )
}

// AI breakdown panel shown once the reader taps "Show breakdown" — same
// data shape phrase.py's /api/phrase/analyze returns (words[] with
// vocab_match/kanji_matches, plus a short explanation), same visual
// language PhraseAnalyzerScreen uses for it (word-colored phrase line +
// per-word cards), reused here on the AI's OWN segmentation instead of
// the old morphology-based scan — see reading.py's _finish_phrase note.
//
// One word/kanji card at a time (not a scrolling list) — the overview
// line up top doubles as a jump-to-word index (tap any word chip to
// jump straight to its card), and the prev/next arrows step through
// them in order. `index`/`setIndex` live in the parent (ReadingScreen)
// so they can be reset to 0 whenever a new phrase is shown.
function AnalysisBreakdown({ analysis, index, setIndex, t, onWordClick, onKanjiClick }) {
  const words = analysis.words
  const current = words[Math.min(index, words.length - 1)]
  const canPrev = index > 0
  const canNext = index < words.length - 1

  return (
    <div className="rdg-breakdown">
      <div className="phrase-line rdg-breakdown-line">
        {words.map((w, i) => (
          <span
            key={i}
            onClick={() => setIndex(i)}
            className={`word-span rdg-breakdown-line__word${i === index ? ' rdg-breakdown-line__word--active' : ''}`}
            style={{ '--word-color': wordColor(w) }}
            title={t.jumpToWord ?? 'Jump to this word'}
          >
            {w.surface}
          </span>
        ))}
      </div>

      {analysis.explanation && (
        <div className="phrase-explanation rdg-breakdown-explanation">
          {analysis.explanation}
        </div>
      )}

      <div className="rdg-breakdown-card-row">
        <button
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={!canPrev}
          className="rdg-breakdown-nav rdg-breakdown-nav--prev"
          aria-label={t.previousWord ?? 'Previous word'}
        >
          <ChevronIcon direction="left" />
        </button>

        <CardTransition cardKey={index} className="rdg-breakdown-card-stage">
          <BreakdownWordCard word={current} t={t} onWordClick={onWordClick} onKanjiClick={onKanjiClick} />
        </CardTransition>

        <button
          onClick={() => setIndex(i => Math.min(words.length - 1, i + 1))}
          disabled={!canNext}
          className="rdg-breakdown-nav rdg-breakdown-nav--next"
          aria-label={t.nextWord ?? 'Next word'}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div className="rdg-breakdown-counter">
        {index + 1} / {words.length}
      </div>
    </div>
  )
}

// A single word's card. `phrase-word-card__surface-wrap--clickable` and
// `phrase-kanji-chip--clickable` (see index.css) both carry a visible
// affordance now — a dashed underline + tap hint on the word, a lifted
// hover/press state on kanji chips — rather than relying on cursor:
// pointer alone, which is easy to miss on a card that otherwise reads
// as plain text.
function BreakdownWordCard({ word, t, onWordClick, onKanjiClick }) {
  return (
    <div className="card phrase-word-card rdg-breakdown-card">
      <div className="phrase-word-card__top">
        <div
          onClick={() => onWordClick(word)}
          className={`phrase-word-card__surface-wrap${word.vocab_match ? ' phrase-word-card__surface-wrap--clickable' : ''}`}
          title={word.vocab_match ? (t.clickForDetails) : undefined}
        >
          <span className="phrase-word-card__surface" style={{ '--word-color': wordColor(word) }}>
            {word.surface}
          </span>
          {word.reading && (
            <span className="phrase-word-card__reading">({word.reading})</span>
          )}
          {word.pos && (
            <span className="phrase-word-card__pos">{word.pos}</span>
          )}
        </div>
      </div>

      <div className="phrase-word-card__meaning">{word.meaning}</div>

      {word.kanji_matches?.length > 0 && (
        <div className="phrase-word-card__kanji-row">
          {word.kanji_matches.map(k => (
            <div
              key={k.raw_id}
              onClick={() => onKanjiClick(k)}
              className="phrase-kanji-chip"
            >
              <span className="phrase-kanji-chip__char" style={{ '--word-color': STATUS_COLORS[k.stats.status] }}>
                {k.kanji}
              </span>
              <span className="phrase-kanji-chip__level">{k.level}</span>
            </div>
          ))}
        </div>
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

  if (error) return <div className="card rdg-error-card">{t.loadError}</div>
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
  // `t` arrives as a prop but the locale does not, and the review date
  // needs it — reading the context here beats threading a second
  // argument through every caller.
  const { lang } = useLang()
  const { title, level, entry, stats } = detail
  const dialogRef = useDialog(onClose)

  const content = (
    <>
      <div className="detail-header">
        <div className="detail-title" id="reading-detail-title">{title}</div>
        <button onClick={onClose} className="detail-close-btn" aria-label={t.close}><CrossIcon size={16} /></button>
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
          <StatusBadge status={stats.status} t={t} />
          {stats.due && <StatusBadge status="due" t={t} />}
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
          value={shortDate(stats.next_review, lang) ?? '—'}
        />
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div onClick={onClose} className="detail-overlay-sheet">
        <div ref={dialogRef} onClick={e => e.stopPropagation()} className="card detail-sheet"
             role="dialog" aria-modal="true" aria-labelledby="reading-detail-title">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} className="detail-overlay-side">
      <div ref={dialogRef} onClick={e => e.stopPropagation()} className="card detail-side"
           role="dialog" aria-modal="true" aria-labelledby="reading-detail-title">
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

function StatusBadge({ status, t }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started
  const label = t[`status_${status}`] || status
  return (
    <span className="status-pill" style={{ '--pill-color': color }}>
      {label}
    </span>
  )
}