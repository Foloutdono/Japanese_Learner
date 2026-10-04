import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { postResult } from '../lib/postResult'
import { explainSentence } from '../lib/explainSentence'
import { useLang } from '../LangContext'
import { runSource, logLabel } from '../domain/sentenceSource'
import { StudyStage } from '../components/study/StudyStage'
import { usePracticeXp } from '../hooks/usePracticeXp'
import PromptCard from '../components/study/PromptCard'
import { ReadingTimer, ReadingPrompt, AnswerForm, ReadingRegisters, PaceChip } from '../components/reading/ReadingPieces'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import RatingBar from '../components/study/RatingBar'
import { RunStreak } from '../components/study/RunStreak'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { BreakdownSide, LineSide } from '../components/analysis/BreakdownSide'
import { useDesk } from '../hooks/useDesk'
import { EnterKey, KeyCap } from '../components/chrome/DeskKeys'
import { RunLines } from '../components/study/RunLines'
import { useSentenceKeys, currentLine } from '../components/study/sentenceLines'
import { useRunLines } from '../hooks/useRunLines'
import { useAsk } from '../hooks/useAsk'
import { AskPanel } from '../components/study/AskPanel'
import { askTarget } from '../domain/ask'
import { startTally, countReview } from '../stores/runTally'
import { DictionaryLookupSheet } from '../components/dictionary/DictionaryDetail'
import { vocabLookup, grammarLookup, lookupKey } from '../components/analysis/lookup'
import { tierLabelFor } from '../domain/tiers'
import { paceFactor } from '../domain/readingPace'
import { useReadingPace } from '../stores/readingPace'

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
  // Counted in the server's seconds (display_seconds, the standard
  // pace's); the learner's reading pace (domain/readingPace.js) runs the
  // clock 1/factor as fast and scales what the timer prints, so a pace
  // that arrives with the profile after the first sentence still applies
  // to it. A null factor is no clock: the sentence is never covered, or
  // stays covered if the clock ran out before the pace was changed.
  const [timeLeft, setTimeLeft] = useState(0)
  const factor = paceFactor(useReadingPace())
  // Whether the learner has pressed play on the phrase. Each phrase
  // arrives with the sentence held back behind the play button, the
  // clock still and the field shut; the press shows the sentence and
  // starts the clock, so the reading begins when the learner is ready
  // rather than the instant the phrase loads.
  const [started, setStarted] = useState(false)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null) // { correct, romaji, accuracy }
  const [score, setScore]   = useState({ correct: 0, total: 0 })
  // The fare per rated sentence, from the result's own response.
  const fare = usePracticeXp()
  const [error, setError]   = useState(null)
  // The last rated sentence's result post never landed (lib/postResult).
  const [unsaved, setUnsaved] = useState(false)
  // AI breakdown of the current phrase — fetched in the background the
  // moment the phrase is shown (see showPhrase), using the exact same
  // LLM-driven segmentation the phrase-analyzer screen uses
  // (POST /api/phrase/analyze, save=false so reading sessions don't
  // flood the analyzer's own history). By the time the reader has
  // finished reading/writing and reaches the feedback stage, this is
  // almost always already resolved — the "show breakdown" button just
  // reveals it rather than triggering the fetch itself.
  // ONE sheet for everything the breakdown opens (plan 096): a word
  // opens its dictionary entry, a marker row and a chip open the
  // point's lesson, and both are the same plate on the same ‹ stack.
  // Held HERE and not in the view below, so a new phrase closes it:
  // the sheet describes a word of the sentence that was on screen when
  // it was opened. Stable so the sheet's useDialog doesn't re-run its
  // focus-on-open effect (and steal focus) on every render of this
  // screen while it is open.
  const [lookup, setLookup] = useState(null)
  const closeLookup = useCallback(() => setLookup(null), [])
  // 机 (plan 129): this run's sentences, each reopening its breakdown in
  // the side; Esc closes an open one unless a door in it holds the key.
  const lines = useRunLines(session, { held: Boolean(lookup) })
  // 問 (plan 131): a question about the sentence, once graded, on the desk.
  const asking = useAsk(session, 'reading')

  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)

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
  // The phrase whose measurement is in flight, by the same _uiKey the
  // card is keyed on: a figure that lands after the reader has moved
  // on belongs to a sentence that is no longer on screen.
  const measureKeyRef = useRef(null)

  const BATCH_SIZE = 5
  const PREFETCH_THRESHOLD = 1 // refill once only this many (or fewer) remain in queue

  // Compact label matching reading.py's _source_label() — sent back on
  // /api/reading/result so history stays informative without a DB
  // migration (see reading.py's get_reading_batch docstring).
  // The tier's size rides in the label since plan 159 (sentenceSource's
  // logLabel): the desk's practice station reads a tier's record by it.
  function sourceLabel() {
    return logLabel({ source, level, domain, tier, tierSize })
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
    setUnsaved(false)
    startTally(`reading:${sourceLabel()}`)
    lines.reset()
    asking.reset()
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

  // Kicks off the breakdown for `phraseText` in the background --
  // fired the instant a phrase is shown (see showPhrase) so it has the
  // whole display+writing window to resolve before the reader ever
  // asks for it. The local tier only: free, instant, no model call.
  // The explanation is bought on demand (explainPhrase). `save: false`
  // keeps this out of the phrase-analyzer's own history (see
  // phrase.py's PhraseRequest.save).
  function fetchAnalysis(phraseText) {
    analysisPhraseRef.current = phraseText
    setAnalysis(null)
    setAnalysisLoading(true)
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: phraseText, save: false, deep: false, whole: true, lang }),
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


  // ── The explanation, bought on demand (plan 095, owner-directed) ──
  // The fetch above buys the local tier only; this buys the deep tier
  // for the sentence on screen when the learner presses Explain under
  // the breakdown, and replaces the analysis with the explained one.
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState(null)
  function explainPhrase() {
    const key = analysisPhraseRef.current
    if (!key || explaining) return
    setExplaining(true)
    setExplainError(null)
    explainSentence(session, key, lang)
      .then(d => { if (analysisPhraseRef.current === key) setAnalysis(d) })
      .catch(e => {
        if (analysisPhraseRef.current !== key) return
        setExplainError(e?.message === '503' ? t.explainUnavailable : t.explainFailed)
      })
      .finally(() => { if (analysisPhraseRef.current === key) setExplaining(false) })
  }

  function showPhrase(phraseData) {
    setData({ ...phraseData, _uiKey: phraseCounterRef.current++ })
    setAnswer('')
    setFeedback(null)
    setLookup(null)
    setShowBreakdown(false)
    setExplaining(false)
    setExplainError(null)
    setStage('reading')
    setStarted(false)
    setTimeLeft(phraseData.display_seconds)
    fetchAnalysis(phraseData.phrase)
  }

  // The play button: the sentence onto the card and the clock running.
  const startReading = useCallback(() => setStarted(true), [])

  // What a question about the sentence on the stage carries, less its
  // breakdown (domain/ask's askTarget adds the words): the sentence, its
  // translation, what the learner typed, the point it was written for.
  function askBase() {
    if (!data) return null
    return {
      sentence: data.phrase,
      level: source === 'level' ? level : '',
      translation: data.translation,
      answer: answer.trim(),
      point: data.grammar ?? '',
    }
  }

  // Pulls the next phrase from the queue (instant — no waiting), and tops
  // the queue back up in the background if it's getting low.
  function next() {
    // The sentence just graded joins the run's lines with whatever
    // breakdown it has by now (plan 129).
    if (data && feedback?.quality != null) {
      lines.commit({ key: data._uiKey, jp: data.phrase, translation: data.translation, quality: feedback.quality, analysis, ask: askBase() })
    }
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

  // Countdown while the phrase is up, from the press of play. Reaching
  // zero no longer changes `stage` — writing is available from the
  // moment the phrase appears (see the 'reading' stage's render below)
  // — it just covers the phrase text so recall keeps mattering for
  // anyone who didn't finish writing before the timer ran out.
  useEffect(() => {
    if (stage !== 'reading' || !started || factor == null) return

    const tick = 0.1 / factor
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - tick
        return next <= 0 ? 0 : next
      })
    }, 100)

    return clearTimer
  }, [stage, started, factor])

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function submitAnswer() {
    if (!answer.trim() || stage !== 'reading' || !started) return
    clearTimer()
    // No correctness check here anymore — auto-comparing romaji proved too
    // brittle. Reveal the answer and let the user judge for themselves.
    setFeedback({ correct: null, romaji: data.romaji, accuracy: null })
    setStage('feedback')
    measure(data, answer.trim())
  }

  // How much of the line the answer caught, from the server's own
  // measure — the same figure 書取 prints, so the two practices say the
  // same thing about the same answer (study/dictation.measure_forms).
  //
  // Asked for AFTER the reveal rather than before it, and the reveal
  // never waits on it: the sentence, the romaji and the answer are all
  // already here, and a run that showed nothing until a round trip
  // landed would be a worse screen than one that shows the figure a
  // beat late. A failed measurement costs the figure and nothing else
  // — the grade below it was always the learner's.
  function measure(phraseData, given) {
    const key = phraseData._uiKey
    measureKeyRef.current = key
    apiFetch('/api/reading/check', session, {
      method: 'POST',
      body: JSON.stringify({
        phrase: phraseData.phrase,
        romaji: phraseData.romaji,
        answer: given,
      }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(m => {
        if (!m || measureKeyRef.current !== key) return // reader already moved on
        setFeedback(f => (f ? { ...f, accuracy: m.accuracy } : f))
      })
      .catch(() => {
        // The figure is a hint, not the run.
      })
  }

  // `quality` is the learner's own rating, 0..5 worst to best, as
  // RatingBar emits it. `isCorrect` stays the derived pass/fail, because
  // it is what the score row and every existing reader of
  // reading_log understand -- the rating is recorded alongside it, not
  // instead of it.
  function gradeAnswer(isCorrect, quality = null) {
    if (feedback?.correct !== null) return // already graded, ignore repeat clicks

    setFeedback(f => ({ ...f, correct: isCorrect, quality }))
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    // This run's figures (stores/runTally), and the side back on this
    // sentence: its breakdown is what the grade has just opened.
    countReview({ quality })
    lines.close()
    setLookup(null)
    // No playCorrect here any more: RatingBar plays the tap itself, on
    // both sides, and grading is only ever reached through it now --
    // calling it here too doubled the sound on a correct answer.

    postResult('/api/reading/result', session, {
      source: sourceLabel(),
      level: source === 'level' ? level : null,
      phrase: data.phrase,
      romaji: data.romaji,
      answer: answer.trim(),
      correct: isCorrect,
      quality,
      // The figure the learner was looking at when they rated, which
      // is the only version of it worth keeping beside the rating.
      // null when the measurement never landed -- the rating is a
      // fact about what they did either way, and 書取 sends its own
      // the same way (DictationRun.jsx).
      accuracy: feedback?.accuracy ?? null,
      // The word this sentence was chosen to practise. The endpoint
      // resolves it to that word's SRS card so the rating schedules
      // something, rather than only being written down.
      source_word: data.source_word ?? null,
    }).then(({ saved, data: res }) => {
      // The fare rides the response (xp_earned, top-level): the level
      // bar moves once the rating is on the server. A post that never
      // landed is said so (unsaved) rather than dropped: the sentence is
      // not in the record, and the learner is the one who can tell.
      setUnsaved(!saved)
      if (saved) fare.pay(res, quality)
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
      factor={factor}
      started={started}
      onPlay={startReading}
      answer={answer}
      setAnswer={setAnswer}
      feedback={feedback}
      score={score}
      fare={fare}
      unsaved={unsaved}
      error={error}
      lookup={lookup}
      setLookup={setLookup}
      closeLookup={closeLookup}
      lines={lines}
      asking={asking}
      askBase={askBase}
      analysis={analysis}
      analysisLoading={analysisLoading}
      onExplain={explainPhrase}
      explaining={explaining}
      explainError={explainError}
      showBreakdown={showBreakdown}
      setShowBreakdown={setShowBreakdown}
      onBack={leave}
      backLabel={t[backKey]}
      onStart={startSession}
      submitAnswer={submitAnswer}
      gradeAnswer={gradeAnswer}
      next={next}
      retry={retry}
      session={session}
    />
  )
}

// Kicks off the session's very first batch fetch exactly once, then
// renders the stage machine. A component of its own so that the mount
// IS the start: the run above it is the route, and the route is what
// decides there is a session to start at all.
function SessionView({
  t, source, level, domain, tier, tierSize, stage, data, timeLeft, factor, started, onPlay, answer, setAnswer,
  feedback, score, fare, unsaved, error, lookup, setLookup, closeLookup, lines, asking, askBase,
  analysis, analysisLoading, backLabel,
  onExplain, explaining, explainError, showBreakdown, setShowBreakdown, onBack, onStart, submitAnswer,
  gradeAnswer, next, retry, session,
}) {
  const desk = useDesk()
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

  // Only a clock that ran can reach zero: an untimed one never ticks.
  const phraseCovered = stage === 'reading' && timeLeft <= 0
  const keys = useSentenceKeys({ reveal: true })
  // The asking's thread: a reopened line's, else the sentence on the
  // stage's, open once it is graded (plan 131).
  const graded = stage === 'feedback' && feedback?.correct != null
  const target = askTarget(lines.opened, { key: data?._uiKey, base: askBase(), analysis, open: graded })

  // A door in a breakdown -- the sentence on the stage's, or a line
  // reopened from the run's lines -- opens in the column (plan 115).
  const doors = {
    onTokenClick: w => setLookup(vocabLookup(w)),
    onGrammarOpen: g => setLookup(grammarLookup(g)),
    lookup,
    onExitLookup: closeLookup,
    session,
  }

  return (
    <StudyStage
      color={READING_COLOR}
      onLeave={onBack}
      leaveLabel={backLabel}
      where={t.readingTitle}
      sub={where}
      // On the desk the score is the run panel's figures (plan 129).
      remaining={desk ? undefined : `${score.correct} / ${score.total}`}
      pass={false}
      aside={<RunStreak />}
      toast={fare.toast}
      onToastDone={fare.toastDone}
      records
      recordsLabel={t.deskLinesRated}
      panel={(
        <RunLines
          lines={lines.lines}
          current={data && stage !== 'error' ? currentLine(stage === 'feedback' ? data.phrase : null, feedback?.quality ?? null) : null}
          openKey={lines.opened?.key ?? null}
          onOpen={key => { setLookup(null); lines.open(key) }}
          onCurrent={() => { setLookup(null); lines.close() }}
          keys={keys}
          ask={target.key != null && (
            <AskPanel key={target.key} ask={asking} askKey={target.key} context={target.context} open={target.open} />
          )}
        />
      )}
      side={lines.opened ? <LineSide lines={lines} {...doors} /> : (
        <BreakdownSide
          graded={stage === 'feedback' && feedback?.correct != null}
          analysis={analysis}
          loading={analysisLoading}
          translation={data?.translation}
          sentenceText={data?.phrase}
          onExplain={onExplain}
          explaining={explaining}
          explainError={explainError}
          {...doors}
        />
      )}
      sideLabel={t.deskBreakdownLabel}
    >
      {stage === 'loading' && <Loading />}

      {stage === 'error' && (
        <Empty tone="error" message={error} action={{ label: t.retry, onClick: retry }} />
      )}

      {stage === 'reading' && data && (
        <>
          {/* The stage's pieces are shared with the reading ride (plan
              099, components/reading/ReadingPieces.jsx). The answer
              field is available the whole time the phrase is on
              screen, not only after the timer runs out — the reader
              can start writing as soon as they're ready. */}
          <ReadingTimer
            timeLeft={timeLeft * (factor ?? 1)}
            total={data.display_seconds * (factor ?? 1)}
            covered={phraseCovered}
            untimed={factor == null}
            t={t}
            aside={<PaceChip session={session} />}
          />
          <ReadingPrompt
            cardKey={data._uiKey}
            foot={{ left: where, right: t.readingTitle }}
            phrase={data.phrase}
            covered={phraseCovered}
            onPlay={started ? undefined : onPlay}
            playLabel={t.readingPlay}
            keyHint={desk}
          />
          <AnswerForm answer={answer} setAnswer={setAnswer} onSubmit={submitAnswer} t={t} disabled={!started} />
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
                (phrase/romaji/translation/your answer): the rows below
                print the sentence and its translation themselves, so
                the registers would only say it twice, over the room
                the rows need. */}
            {!showBreakdown && (
              <ReadingRegisters
                phrase={data.phrase}
                romaji={feedback.romaji}
                translation={data.translation}
                translationLang={data.translation_lang}
                answer={answer}
                accuracy={feedback.accuracy}
                correct={feedback.correct}
                t={t}
              />
            )}

            {!desk && feedback.correct !== null && (
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
                    layout="rows"
                    translation={data.translation}
                    sentenceText={data.phrase}
                    t={t}
                    onTokenClick={w => setLookup(vocabLookup(w))}
                    onGrammarOpen={g => setLookup(grammarLookup(g))}
                    onExplain={onExplain}
                    explaining={explaining}
                    explainError={explainError}
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
              {unsaved && <p className="hint" role="status">{t.resultNotSaved}</p>}
              <button type="button" onClick={next} className="btn-primary" aria-keyshortcuts={desk ? 'Enter' : undefined}>
                {t.nextPhrase}
                <KeyCap>{t.keyEnter}</KeyCap>
              </button>
              {/* 机 (plan 123): Enter takes the next sentence, so a run
                  is type, Enter, a digit, Enter -- as comprehension's is. */}
              <EnterKey onEnter={next} />
            </div>
          )}
        </>
      )}

      {/* On the desk a door in the docked breakdown opens in the side
          column (BreakdownSide → SideLookup, plan 115). */}
      {lookup && !desk && (
        <DictionaryLookupSheet key={lookupKey(lookup)} {...lookup} session={session} onClose={closeLookup} />
      )}
    </StudyStage>
  )
}
