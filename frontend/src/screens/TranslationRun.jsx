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
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { CardTransition } from '../components/study/CardTransition'
import RatingBar from '../components/study/RatingBar'
import { RunStreak } from '../components/study/RunStreak'
// The tutor's review, drawn by the component 作文 shares (plan 125).
import { TutorReview } from '../components/study/TutorReview'
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

const TRANSLATION_COLOR = 'var(--line-honyaku)'

// NOTE ON TRANSLATION KEYS: reuses the same generic study-source keys
// ReadingRun.jsx does (t.byLevel/byLevelDesc, t.byFrequency/
// byFrequencyDesc, t.byMastery/byMasteryDesc, t.selectStudySource,
// t.selectLevel, t.selectDomain, t.selectTier, t.tierLabel, t.submit,
// t.loadError, t.retry, t.score, t.correct, t.incorrect, t.yourAnswer).

// Routes: /practice/translation/level/:level, /tier/:tier
// (?size=&domain=) and /mastery — the session on the stage (the
// canvas's TranslationWrite and Translation artboards: the prompt as a
// page, the field and Submit docked in the foot; then the answer, the
// reference, the AI's reading of it, and the rating bar docked). The
// pickers are the station page above it, under the chrome
// (screens/SentenceStation.jsx).
const BASE = '/practice/translation'

export default function TranslationRun({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const { level: levelParam, tier: tierParam } = useParams()
  const { search } = useLocation()

  // 'level' | 'frequency' | 'mastery', and the ‹ back to the list it
  // was chosen from. Null for a path the station could not produce.
  const picked = runSource({ base: BASE, level: levelParam, tier: tierParam, search })
  const { source, level, domain, tier, tierSize, back, backKey } = picked ?? {}

  // 'loading' | 'writing' | 'feedback' | 'error'
  const [stage, setStage]   = useState('loading')
  const [data, setData]     = useState(null)   // current phrase item from the batch
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null) // { correct } — correct stays null until self-graded
  const [score, setScore]   = useState({ correct: 0, total: 0 })
  // The fare per rated sentence, from the result's own response.
  const fare = usePracticeXp()
  const [error, setError]   = useState(null)
  // The last rated sentence's result post never landed (lib/postResult).
  const [unsaved, setUnsaved] = useState(false)

  // LLM analysis of THIS attempt — unlike reading mode's breakdown,
  // this can't be prefetched while the phrase is on screen (it needs
  // the learner's own answer, which doesn't exist yet), so it's fired
  // from submitAnswer() instead and shown loading in the feedback
  // stage rather than gated behind a toggle — it's the actual point of
  // this mode, not a supplementary extra.
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // ── The word-by-word breakdown of the REFERENCE (plan 084) ──
  // Distinct from `analysis` above, which is the tutor's reading of
  // the learner's own attempt. This is reading practice's breakdown
  // of the reference sentence -- the same POST /api/phrase/analyze
  // with save=false, the same SentenceBreakdown rows -- and it can be
  // prefetched exactly as reading practice does: the reference is on
  // the client from the moment the prompt goes up, so the whole
  // writing window is its prefetch. Shown once the learner has graded
  // themselves, like every other mode's.
  const [breakdown, setBreakdown] = useState(null)
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  // ONE sheet for everything the breakdown opens (plan 096): a word
  // opens its dictionary entry, a marker row and a chip open the
  // point's lesson, on the same ‹ stack. Held here and not in the view
  // below, so a new phrase closes it: the sheet describes a word of
  // the reference that was on screen when it was opened. Stable so the
  // sheet's useDialog doesn't re-run its focus-on-open effect on every
  // render while it is open.
  const [lookup, setLookup] = useState(null)
  const closeLookup = useCallback(() => setLookup(null), [])
  // 机 (plan 129): this run's sentences, each reopening its reference's
  // breakdown in the side.
  const lines = useRunLines(session, { held: Boolean(lookup) })
  // 問 (plan 131): a question about the sentence, once graded, on the desk.
  const asking = useAsk(session, 'translation')
  // Which reference the in-flight breakdown belongs to, so a slow
  // answer for a phrase the learner has already left cannot overwrite
  // the one on screen (ReadingRun's analysisPhraseRef).
  const breakdownPhraseRef = useRef(null)

  const fetchingRef = useRef(false) // guards against duplicate concurrent prefetches
  const queueRef = useRef([])       // upcoming phrases, prefetched (not rendered, so a ref is fine)
  // Monotonic counter stamped onto each shown phrase as `_uiKey` — used
  // as CardTransition's cardKey and to guard the analysis fetch against
  // a slow response landing after the learner has already moved on
  // (mirrors ReadingRun.jsx's phraseCounterRef/analysisPhraseRef,
  // keyed here instead of by phrase text since the analysis depends on
  // the learner's answer too, not just which phrase is showing).
  const phraseCounterRef = useRef(0)
  const analysisKeyRef = useRef(null)

  const BATCH_SIZE = 5
  const PREFETCH_THRESHOLD = 1 // refill once only this many (or fewer) remain in queue

  // Compact label matching reading.py's _source_label() (same values,
  // same meaning — translation_log.phase mirrors reading_log.phase).
  // The tier's size rides in the label since plan 159 (sentenceSource's
  // logLabel): the desk's practice station reads a tier's record by it.
  function sourceLabel() {
    return logLabel({ source, level, domain, tier, tierSize })
  }

  // Every sentence this session has already served, so the backend can
  // work through its curated bank rather than reshuffling the same
  // handful. Same mechanism ReadingRun uses -- both modes draw from
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
    setUnsaved(false)
    startTally(`translation:${sourceLabel()}`)
    lines.reset()
    asking.reset()
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


  // ── The explanation, bought on demand (plan 095, owner-directed) ──
  // The fetch above buys the local tier only; this buys the deep tier
  // for the sentence on screen when the learner presses Explain under
  // the breakdown, and replaces the analysis with the explained one.
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState(null)
  function explainReference() {
    const key = breakdownPhraseRef.current
    if (!key || explaining) return
    setExplaining(true)
    setExplainError(null)
    explainSentence(session, key, lang)
      .then(d => { if (breakdownPhraseRef.current === key) setBreakdown(d) })
      .catch(e => {
        if (breakdownPhraseRef.current !== key) return
        setExplainError(e?.message === '503' ? t.explainUnavailable : t.explainFailed)
      })
      .finally(() => { if (breakdownPhraseRef.current === key) setExplaining(false) })
  }

  function showPhrase(phraseData) {
    setData({ ...phraseData, _uiKey: phraseCounterRef.current++ })
    setAnswer('')
    setFeedback(null)
    setAnalysis(null)
    setAnalysisLoading(false)
    setShowBreakdown(false)
    setExplaining(false)
    setExplainError(null)
    setLookup(null)
    setStage('writing')
    fetchBreakdown(phraseData.phrase)
  }

  // The breakdown of the reference, started the moment it is on the
  // client -- the local tier only; the explanation is bought on demand
  // (explainReference). `save: false` keeps translation runs out of the
  // analyzer's own history (routes/phrase.py's PhraseRequest.save).
  function fetchBreakdown(phraseText) {
    breakdownPhraseRef.current = phraseText
    setBreakdown(null)
    setBreakdownLoading(true)
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: phraseText, save: false, deep: false, whole: true, lang }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (breakdownPhraseRef.current === phraseText) setBreakdown(d) })
      .catch(() => { if (breakdownPhraseRef.current === phraseText) setBreakdown(null) })
      .finally(() => { if (breakdownPhraseRef.current === phraseText) setBreakdownLoading(false) })
  }

  // What a question about the sentence on the stage carries, less its
  // breakdown (domain/ask's askTarget adds the words): the reference,
  // the prompt it translates, the learner's own Japanese, the point,
  // and the tutor's reading of the attempt.
  function askBase() {
    if (!data) return null
    return {
      sentence: data.phrase,
      level: source === 'level' ? level : '',
      translation: data.translation,
      answer: answer.trim(),
      point: data.grammar ?? '',
      review: analysis?.analysis ?? '',
    }
  }

  function next() {
    // The sentence just graded joins the run's lines (plan 129): the
    // reference, and its breakdown as it stands by now.
    if (data && feedback?.quality != null) {
      lines.commit({ key: data._uiKey, jp: data.phrase, translation: data.translation, quality: feedback.quality, analysis: breakdown, ask: askBase() })
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
        // {review, analysis}: the shaped review when the model gave
        // one, the prose it fell back to otherwise (routes/translation.py).
        setAnalysis(d && (d.review || d.analysis) ? d : null)
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
  // it is what the score row and every existing reader of
  // translation_log understand -- the rating is recorded alongside it,
  // not instead of it.
  function gradeAnswer(isCorrect, quality = null) {
    if (feedback?.correct !== null) return // already graded, ignore repeat clicks

    setFeedback(f => ({ ...f, correct: isCorrect, quality }))
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    countReview({ quality })
    lines.close()
    setLookup(null)
    // No playCorrect here any more: RatingBar plays the tap itself, on
    // both sides, and grading is only ever reached through it now --
    // calling it here too doubled the sound on a correct answer.

    postResult('/api/translation/result', session, {
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
    }).then(({ saved, data: res }) => {
      // The fare rides the response (xp_earned, top-level): the level
      // bar moves once the rating is on the server. A post that never
      // landed is said so (unsaved), not dropped (lib/postResult).
      setUnsaved(!saved)
      if (saved) fare.pay(res, quality)
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

  // ‹ — back to the list the source was chosen from.
  function leave() {
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
      answer={answer}
      setAnswer={setAnswer}
      feedback={feedback}
      score={score}
      fare={fare}
      unsaved={unsaved}
      error={error}
      analysis={analysis}
      analysisLoading={analysisLoading}
      breakdown={breakdown}
      breakdownLoading={breakdownLoading}
      onExplain={explainReference}
      explaining={explaining}
      explainError={explainError}
      showBreakdown={showBreakdown}
      setShowBreakdown={setShowBreakdown}
      lookup={lookup}
      setLookup={setLookup}
      closeLookup={closeLookup}
      lines={lines}
      asking={asking}
      askBase={askBase}
      session={session}
      onBack={leave}
      backLabel={t[backKey]}
      onStart={startSession}
      submitAnswer={submitAnswer}
      gradeAnswer={gradeAnswer}
      next={next}
      retry={retry}
    />
  )
}

// Kicks off the session's first batch fetch exactly once, then renders
// the stage machine. A component of its own for the same reason
// ReadingRun.jsx splits it: the mount is the start, and the route above
// is what decides there is a session to start.
function SessionView({
  t, source, level, domain, tier, tierSize, stage, data, answer, setAnswer,
  feedback, score, fare, unsaved, error, analysis, analysisLoading, backLabel,
  breakdown, breakdownLoading, onExplain, explaining, explainError,
  showBreakdown, setShowBreakdown, lookup, setLookup, closeLookup, lines, asking, askBase,
  session, onBack, onStart, submitAnswer, gradeAnswer, next, retry,
}) {
  const desk = useDesk()
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

  // The prompt carries no "EN" caption (owner-directed, 2026-09-13):
  // the sentence to translate is self-evidently the one in the
  // learner's own alphabet, and a label over it said what the eye
  // already knew (DESIGN.md, "say less").

  const keys = useSentenceKeys()
  // The asking's thread: a reopened line's, else the sentence on the
  // stage's, open once it is graded (plan 131). Its words are the
  // reference's breakdown.
  const target = askTarget(lines.opened, {
    key: data?._uiKey, base: askBase(), analysis: breakdown, open: stage === 'feedback' && feedback?.correct != null,
  })
  // A door in a breakdown -- the reference on the stage's, or a line
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
      color={TRANSLATION_COLOR}
      // One of the four sentence runs: on the desk its floor stands
      // unframed on the page (index.css, the 机 section's 三面 block).
      className="stage--sentence"
      onLeave={onBack}
      leaveLabel={backLabel}
      where={t.translationTitle}
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
          // The reference is the answer: the row shows it once the
          // answer is in, as the card does.
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
          analysis={breakdown}
          loading={breakdownLoading}
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

      {stage === 'writing' && data && (
        <>
          <CardTransition cardKey={data._uiKey}>
            <PromptCard prose foot={{ left: where, right: t.translationTitle }}>
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
              className="field field--page"
              lang="ja"
              /* The same rule as reading's romaji entry: nothing may
                 rewrite the answer on its way in. Here the field is fed
                 by an IME, whose candidate is already the learner's
                 choice — a spellchecker underlining kana it does not
                 know, or an autocorrect reaching past the IME, can only
                 be wrong about it. */
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
              // What this sentence was chosen to practise. Only a curated
              // sentence carries it, and a test proves the sentence
              // contains the point it names -- see
              // content/reading_sentences.py.
              right: data.grammar
                ? <>{t.readingGrammarPoint} · <span lang="ja">{data.grammar}</span></>
                : t.translationTitle,
            }}
          >
            {/* Opening the breakdown puts the prompt and the reference
                away -- its rows print the sentence and its translation
                themselves -- and keeps the learner's answer and the
                tutor's reading of it, which are the point of this mode. */}
            {!showBreakdown && (
              <>
                <span className="prose__en">{data.translation}</span>
                <span className="prose__rule" />
              </>
            )}
            <span className="prose__label">{t.yourAnswer}</span>
            <span className="prose__jp" lang="ja">{answer}</span>
            {!showBreakdown && (
              <>
                <span className="prose__label">{t.reference}</span>
                <span className="prose__jp" lang="ja">{data.phrase}</span>
                <span className="prose__romaji">{data.romaji}</span>
              </>
            )}
            <span className="prose__rule" />
            <span className="prose__label">{t.aiAnalysis}</span>
            {analysisLoading && <Loading inline copy={t.analyzingTranslation} />}
            {!analysisLoading && analysis?.review && (
              <TutorReview review={analysis.review} grammar={data.grammar} t={t} />
            )}
            {!analysisLoading && analysis && !analysis.review && (
              <span className="prose__ai">{analysis.analysis}</span>
            )}
            {!analysisLoading && !analysis && <span className="prose__ai">{t.analysisUnavailable}</span>}

            {/* The reference, word by word, once the learner has
                graded themselves -- the same gate and the same button
                states as dictation's (DictationRun.jsx). */}
            {!desk && feedback.correct !== null && (
              <div className="prose__breakdown">
                <button
                  type="button"
                  onClick={() => setShowBreakdown(s => !s)}
                  disabled={!breakdown}
                  className="btn-secondary"
                >
                  {showBreakdown
                    ? t.hideBreakdown
                    : breakdown
                      ? t.showBreakdown
                      : breakdownLoading
                        ? t.preparingBreakdown
                        : t.breakdownUnavailable}
                </button>

                {showBreakdown && breakdown && (
                  <SentenceBreakdown
                    analysis={breakdown}
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
