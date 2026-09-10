import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { runSource } from '../domain/sentenceSource'
import { StudyStage } from '../components/study/StudyStage'
import PromptCard from '../components/study/PromptCard'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { CardTransition } from '../components/study/CardTransition'
import RatingBar from '../components/study/RatingBar'
import { FireIcon, EyeOffIcon } from '../components/ui/Icons'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { WordDetail } from '../components/analysis/WordDetail'
import { tierLabelFor } from '../domain/tiers'

const MOBILE_BREAKPOINT = 768
const READING_COLOR = 'var(--line-reading)'

// NOTE ON TRANSLATION KEYS: reuses the app's existing generic
// study-source keys (t.byLevel/byLevelDesc, t.byFrequency/
// byFrequencyDesc, t.byMastery/byMasteryDesc, t.selectStudySource,
// t.selectTier, t.loadError, t.status_*, t.clickForDetails,
// t.appDefinition, t.cardStats, t.inThisPhrase) rather than inventing
// reading-specific duplicates.

// Routes: /practice/reading/level/:level, /tier/:tier (?size=&domain=)
// and /mastery — the session on the stage (the canvas's Reading
// artboard: the timer over the sentence, the field and Submit docked
// in the foot, the rating bar docked once the answer is in). What it
// is a session OF is the path: the pickers are the station page above
// it, under the chrome (screens/SentenceStation.jsx).
const BASE = '/practice/reading'

export default function ReadingRun({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const { level: levelParam, tier: tierParam } = useParams()
  const { search } = useLocation()

  // 'level' | 'frequency' | 'mastery', and the ‹ back to the list it
  // was chosen from. Null for a path the station could not produce.
  const picked = runSource({ base: BASE, level: levelParam, tier: tierParam, search })
  const { source, level, domain, tier, tierSize, back, backKey } = picked ?? {}

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
  // Stable so WordDetail's useDialog doesn't re-run its focus-on-open
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
  // currently showing — see SentenceBreakdown's 'stepper' layout. Reset
  // to 0 every time a new phrase is shown (showPhrase) so the reader
  // always starts at the first word of a fresh breakdown.
  const [breakdownIndex, setBreakdownIndex] = useState(0)

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // WordDetail just needs {title, level, entry, stats} — sourced from
  // the AI breakdown's word/kanji shape (the backend no longer returns
  // a morphology-based `segments` field at all, see reading.py's
  // _finish_phrase note). Mirrors AnalyzerScreen's
  // openVocabDetail/openKanjiDetail; kept as its own small function
  // here rather than importing those directly since the two screens'
  // detail shapes differ slightly (this one has no contextMeaning).
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
    if (source === 'frequency') {
      params.set('domain', domain)
      params.set('tier', tier)
      params.set('tier_size', tierSize)
    }
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
      body: JSON.stringify({ phrase: phraseText, save: false, deep: true, lang }),
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

  // `quality` is the learner's own rating, 0..5 worst to best, as
  // RatingBar emits it. `isCorrect` stays the derived pass/fail, because
  // it is what the score row, the streak and every existing reader of
  // reading_log understand -- the rating is recorded alongside it, not
  // instead of it.
  function gradeAnswer(isCorrect, quality = null) {
    if (feedback?.correct !== null) return // already graded, ignore repeat clicks

    setFeedback(f => ({ ...f, correct: isCorrect }))
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    setStreak(s => (isCorrect ? s + 1 : 0))
    // No playCorrect here any more: RatingBar plays the tap itself, on
    // both sides, and grading is only ever reached through it now --
    // calling it here too doubled the sound on a correct answer.

    apiFetch('/api/reading/result', session, {
      method: 'POST',
      body: JSON.stringify({
        source: sourceLabel(),
        level: source === 'level' ? level : null,
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

  // ‹ — back to the list the source was chosen from.
  function leave() {
    clearTimer()
    navigate(back)
  }

  // A hand-typed path the station could not have produced: back to it
  // rather than a session with nothing to fetch.
  if (!picked) return <Navigate replace to={BASE} />

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
      onBack={leave}
      backLabel={t[backKey]}
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

// The streak, in the head's aside: a lightweight gaming touch that
// only appears once there is one to show off.
function Streak({ streak, t }) {
  if (streak < 2) return null
  return (
    <span className="stage__streak" title={t.streak}>
      <FireIcon size={14} /> {streak}
    </span>
  )
}

// Kicks off the session's very first batch fetch exactly once, then
// renders the stage machine. A component of its own so that the mount
// IS the start: the run above it is the route, and the route is what
// decides there is a session to start at all.
function SessionView({
  t, source, level, domain, tier, tierSize, stage, data, timeLeft, answer, setAnswer,
  feedback, score, streak, error, detail, isMobile, analysis, analysisLoading, backLabel,
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

  // Where the sentences come from, for the head and the card's foot:
  // "N4 · JLPT", "Curated deck · 1–200", "My cards".
  const where =
    source === 'level' ? `${level} · ${t.stationJlpt}` :
    source === 'frequency' ? `${domain === 'vocab_jmdict' ? t.freqDomainJmdict : t.freqDomainDeck} · ${tierLabelFor(tier, tierSize)}` :
    t.byMastery

  const phraseCovered = stage === 'reading' && timeLeft <= 0

  return (
    <StudyStage
      color={READING_COLOR}
      onLeave={onBack}
      leaveLabel={backLabel}
      where={t.readingTitle}
      sub={where}
      remaining={`${score.correct} / ${score.total}`}
      pass={false}
      aside={<Streak streak={streak} t={t} />}
    >
      {stage === 'loading' && <Loading />}

      {stage === 'error' && (
        <Empty tone="error" message={error} action={{ label: t.retry, onClick: retry }} />
      )}

      {stage === 'reading' && data && (
        <>
          <div className="timer">
            <div className="timer__bar" aria-hidden="true">
              <span className="timer__fill" style={{ width: `${(timeLeft / data.display_seconds) * 100}%` }} />
            </div>
            <span className="timer__label" role="timer">
              {phraseCovered ? t.writeWhatYouSaw : `${timeLeft.toFixed(1)}s`}
            </span>
          </div>

          <CardTransition cardKey={data._uiKey}>
            <PromptCard foot={{ left: where, right: t.readingTitle }}>
              {/* The sentence is covered when the clock runs out, so
                  recall keeps mattering for anyone still writing. */}
              <span className={`sentence${phraseCovered ? ' sentence--covered' : ''}`} lang="ja">
                {phraseCovered ? <EyeOffIcon size={34} /> : data.phrase}
              </span>
            </PromptCard>
          </CardTransition>

          {/* The answer field is available the whole time the phrase is
              on screen, not only after the timer runs out — the reader
              can start writing as soon as they're ready.

              Nothing may rewrite what is typed here. Romaji is not a
              word in any language the keyboard knows, so a phone's own
              helpers treat every answer as a typo to be repaired:
              autocapitalise puts a capital on it, autocorrect
              substitutes the nearest real word, and this run is
              self-graded — the learner compares what they wrote
              against the reference and rates themselves on it. A
              silently rewritten answer is therefore not a cosmetic
              annoyance but a wrong verdict on their own recall. */}
          <form className="stage__foot" onSubmit={e => { e.preventDefault(); submitAnswer() }}>
            <input
              autoFocus
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder={t.romajiPlaceholder}
              aria-label={t.writeWhatYouSaw}
              className="field field--page"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
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
              // Only a curated sentence carries a grammar point: it was
              // written to demonstrate exactly this one, and a test
              // proves it contains it (content/reading_sentences.py).
              // A corpus sentence gets the section's name rather than
              // a guessed label.
              right: data.grammar
                ? <>{t.readingGrammarPoint} · <span lang="ja">{data.grammar}</span></>
                : t.readingTitle,
            }}
          >
            {/* Pushing "show breakdown" hides everything above the toggle
                (phrase/romaji/translation/your answer) so the single-card
                breakdown below gets the room instead of being squeezed
                under a wall of already-read text. */}
            {!showBreakdown && (
              <>
                <span className="prose__jp" lang="ja">{data.phrase}</span>
                <span className="prose__romaji">{feedback.romaji}</span>
                {data.translation && (
                  <>
                    {/* Real example sentences only carry an English gloss
                        regardless of UI language — see reading.py's
                        translation_lang note — so this is labelled
                        explicitly instead of implying it matches `lang`. */}
                    <span className="prose__label">{data.translation_lang === 'en' ? t.translationEnglish : t.translation}</span>
                    <span className="prose__en">{data.translation}</span>
                  </>
                )}
                <span className="prose__rule" />
                <span className="prose__label">{t.yourAnswer}</span>
                <span className="prose__en">{answer}</span>
                <span
                  className={`prose__verdict${feedback.correct === null ? '' : feedback.correct ? ' prose__verdict--ok' : ' prose__verdict--x'}`}
                >
                  {feedback.correct === null ? t.didYouGetIt : feedback.correct ? t.correct : t.incorrect}
                </span>
              </>
            )}

            {feedback.correct !== null && (
              <div className="prose__breakdown">
                {/* Live only when there is something to show. Gating
                    on `!analysis && !analysisLoading` instead left the
                    button pressable for the whole of an in-flight
                    fetch, and pressing it hid the registers above
                    (they are behind `!showBreakdown`) without the
                    breakdown below being able to take their place (it
                    is behind `showBreakdown && analysis`) — an empty
                    card until the response landed. Reading practice
                    rarely reached it, because fetchAnalysis fires the
                    instant the phrase is shown and the whole
                    display-and-writing window is prefetch, but a slow
                    or retrying model call is all it takes. 書取 gates
                    its own copy of this button on the same condition,
                    and reaches the loading state routinely rather than
                    rarely (DictationRun.jsx). */}
                <button
                  type="button"
                  onClick={() => setShowBreakdown(s => !s)}
                  disabled={!analysis}
                  className="btn-secondary"
                >
                  {showBreakdown
                    ? t.hideBreakdown
                    : analysis
                      ? t.showBreakdown
                      : analysisLoading
                        ? t.preparingBreakdown
                        : t.breakdownUnavailable}
                </button>

                {showBreakdown && analysis && (
                  <SentenceBreakdown
                    analysis={analysis}
                    layout="stepper"
                    index={breakdownIndex}
                    setIndex={setBreakdownIndex}
                    t={t}
                    onTokenClick={openAnalysisWordDetail}
                    onKanjiClick={openAnalysisKanjiDetail}
                  />
                )}
              </div>
            )}
          </PromptCard>

          {feedback.correct === null ? (
            /* Six-way rating rather than the two buttons this used to
               have, for the same reason TranslationRun was changed:
               reading a sentence is rarely simply right or wrong, and
               the learner already knows how close they were -- the two
               buttons made them flatten that to a coin flip. RatingBar's
               own threshold decides correctness: q > 2 is a pass, the
               same line it draws between playCorrect and playWrong. It
               docks on the stage's bottom edge (index.css, .stage). */
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

      {detail && (
        <WordDetail detail={detail} t={t} isMobile={isMobile} onClose={closeDetail} />
      )}
    </StudyStage>
  )
}
