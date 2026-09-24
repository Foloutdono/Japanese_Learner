import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { explainSentence } from '../lib/explainSentence'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { runSource } from '../domain/sentenceSource'
import { StudyStage } from '../components/study/StudyStage'
import { usePracticeXp } from '../hooks/usePracticeXp'
import PromptCard from '../components/study/PromptCard'
import RatingBar from '../components/study/RatingBar'
import { CardTransition } from '../components/study/CardTransition'
import { TutorReview } from '../components/study/TutorReview'
import { GrammarLessonBody, GrammarLessonSheet } from '../components/study/GrammarLesson'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { BreakdownSide } from '../components/analysis/BreakdownSide'
import { useDesk } from '../hooks/useDesk'
import { EnterKey } from '../components/chrome/DeskKeys'
import { DictionaryLookupSheet } from '../components/dictionary/DictionaryDetail'
import { vocabLookup, grammarLookup, lookupKey } from '../components/analysis/lookup'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'

const SAKUBUN_COLOR = 'var(--line-sakubun)'
const BASE = '/practice/composition'
const BATCH_SIZE = 5
const PREFETCH_THRESHOLD = 1

// Route: /practice/composition/:level — the session on the stage
// (plan 124). The level list is the station page above it, under the
// chrome (screens/SentenceStation.jsx), so this has one axis and no
// source picker: a 作文 run is chosen by grade and by nothing else.
// Same shape as dictation.
//
// ── What this mode is ──
// The learner is handed a grammar point and writes a sentence that
// uses it. Nothing else on this tab asks them to PRODUCE grammar: the
// grammar station drills recognition, and translation only checks a
// point when a curated sentence happens to carry one. Three opinions
// about the sentence come back, kept apart (ADR 0013, and
// routes/composition.py's docstring):
//
//   the detector's   is the point in the sentence — free, instant,
//                    printed as a hint on the answer's label the way
//                    dictation prints its accuracy, and only where the
//                    detector is trusted on the point (null otherwise)
//   the tutor's      the review in the shape translation's tutor
//                    answers in (components/study/TutorReview.jsx),
//                    plus what the sentence actually says — bought from
//                    the model, rationed by the day
//   the learner's    the rating on the bar: the grade, the only one
//
// The tutor is the one that can be missing — past the day's ceiling
// (429), with no provider, on an outage — and the run never waits on
// it: the check still prints, the bar still rates, the fare is still
// paid. That is the whole reason check and review are two calls.
export default function CompositionRun({ session }) {
  const { level: levelParam } = useParams()
  const { lang } = useLang()
  const route = runSource({ base: BASE, level: levelParam, levelsOnly: true })

  // A hand-typed path the station could not have produced: back to the
  // list rather than a session with nothing to fetch.
  if (!route) return <Navigate replace to={BASE} />

  // Keyed on the grade AND the language: the batch localises each
  // point's meaning, so a language switch is a fresh session rather
  // than a queue of points glossed in the wrong one.
  return <Session key={`${route.level}:${lang}`} session={session} level={route.level} />
}

// 'loading' | 'writing' | 'feedback' | 'error'
function Session({ session, level }) {
  const desk = useDesk()
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [stage, setStage]     = useState('loading')
  const [point, setPoint]     = useState(null)   // { raw_id, level, pattern, structure, meaning, register, stage, _uiKey }
  const [answer, setAnswer]   = useState('')
  const [sentence, setSentence] = useState('')   // the answer as submitted, trimmed
  const [found, setFound]     = useState(null)   // the detector's: true | false | null
  const [tutor, setTutor]     = useState(null)   // { review, analysis } from /review
  const [tutorLoading, setTutorLoading] = useState(false)
  const [limited, setLimited] = useState(false)  // the day's reviews are spent
  const [rated, setRated]     = useState(false)
  const [score, setScore]     = useState({ correct: 0, total: 0 })
  const [error, setError]     = useState(null)
  // The lesson behind the point, on a phone: a sheet opened from the
  // card's door (a free door, ADR 0017). On the desk the lesson stands
  // in the side column instead, and no door is drawn.
  const [lesson, setLesson]   = useState(false)
  // The fare per rated sentence, from the result's own response.
  const fare = usePracticeXp()

  // ── The word-by-word breakdown of the learner's own sentence ──
  // Dictation's wiring, name for name: the local tier through
  // POST /api/phrase/analyze with save=false, drawn by SentenceBreakdown
  // in its 'rows' layout, the explanation bought on demand.
  const [analysis, setAnalysis]               = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [showBreakdown, setShowBreakdown]     = useState(false)
  const [explaining, setExplaining]           = useState(false)
  const [explainError, setExplainError]       = useState(null)
  const [lookup, setLookup] = useState(null)
  const closeLookup = useCallback(() => setLookup(null), [])

  const queueRef = useRef([])      // points fetched ahead, never rendered
  const fetchingRef = useRef(false)
  const seenRef = useRef([])       // every raw id this session has been handed
  const startedRef = useRef(false)
  const counterRef = useRef(0)
  // Which point the in-flight check and review belong to, so a slow
  // answer for a point the learner has already moved past cannot
  // overwrite the one on screen. The same point can recur with a new
  // sentence, so it is the card's own key and not its id.
  const pointKeyRef = useRef(null)
  // Which sentence the in-flight breakdown belongs to.
  const analysisLineRef = useRef(null)
  // Once the day's reviews are spent they stay spent: no further call
  // is made this session, which spares the slot a refused call would
  // still cost (routes/composition.py claims it before the model).
  const limitedRef = useRef(false)

  function batchUrl(count) {
    const params = new URLSearchParams({ level, lang, count })
    if (seenRef.current.length) params.set('exclude', seenRef.current.slice(-40).join('|'))
    return `/api/composition/batch?${params.toString()}`
  }

  function fetchBatch() {
    fetchingRef.current = true
    return apiJson(batchUrl(BATCH_SIZE), session)
      .then(data => {
        const points = (data.points ?? []).map(p => ({ ...p, _uiKey: ++counterRef.current }))
        seenRef.current = [...seenRef.current, ...points.map(p => p.raw_id)]
        return points
      })
      .catch(() => [])
      .finally(() => { fetchingRef.current = false })
  }

  function show(next) {
    setPoint(next)
    setAnswer('')
    setSentence('')
    setFound(null)
    setTutor(null)
    setTutorLoading(false)
    setLimited(false)
    setRated(false)
    setLesson(false)
    setAnalysis(null)
    setAnalysisLoading(false)
    setShowBreakdown(false)
    setExplaining(false)
    setExplainError(null)
    setLookup(null)
    pointKeyRef.current = next._uiKey
    analysisLineRef.current = null
    setStage('writing')
  }

  function fetchCheck(key, raw_id, line) {
    apiJson('/api/composition/check', session, {
      method: 'POST',
      body: JSON.stringify({ raw_id, sentence: line }),
    })
      .then(d => { if (pointKeyRef.current === key) setFound(typeof d.found === 'boolean' ? d.found : null) })
      .catch(() => { if (pointKeyRef.current === key) setFound(null) })
  }

  function fetchReview(key, raw_id, line) {
    if (limitedRef.current) {
      setLimited(true)
      return
    }
    setTutorLoading(true)
    apiFetch('/api/composition/review', session, {
      method: 'POST',
      body: JSON.stringify({ raw_id, sentence: line, lang }),
    })
      .then(async r => {
        if (pointKeyRef.current !== key) return
        if (r.status === 429) {
          limitedRef.current = true
          setLimited(true)
          return
        }
        if (!r.ok) {
          setTutor(null)
          return
        }
        setTutor(await r.json())
      })
      .catch(() => { if (pointKeyRef.current === key) setTutor(null) })
      .finally(() => { if (pointKeyRef.current === key) setTutorLoading(false) })
  }

  function fetchAnalysis(line) {
    analysisLineRef.current = line
    setAnalysis(null)
    setAnalysisLoading(true)
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: line, save: false, deep: false, lang }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (analysisLineRef.current === line) setAnalysis(d) })
      .catch(() => { if (analysisLineRef.current === line) setAnalysis(null) })
      .finally(() => { if (analysisLineRef.current === line) setAnalysisLoading(false) })
  }

  function explainLine() {
    const key = analysisLineRef.current
    if (!key || explaining) return
    setExplaining(true)
    setExplainError(null)
    explainSentence(session, key, lang)
      .then(d => { if (analysisLineRef.current === key) setAnalysis(d) })
      .catch(e => {
        if (analysisLineRef.current !== key) return
        setExplainError(e?.message === '503' ? t.explainUnavailable : t.explainFailed)
      })
      .finally(() => { if (analysisLineRef.current === key) setExplaining(false) })
  }

  function load() {
    return fetchBatch().then(points => {
      if (!points.length) {
        setError(t.compositionFetchError)
        setStage('error')
        return
      }
      show(points[0])
      queueRef.current = points.slice(1)
    })
  }

  // The mount IS the start; the key above guarantees a fresh session
  // per grade and per language.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function next() {
    if (queueRef.current.length) {
      const [head, ...rest] = queueRef.current
      queueRef.current = rest
      show(head)
      if (rest.length <= PREFETCH_THRESHOLD && !fetchingRef.current) {
        fetchBatch().then(more => { queueRef.current = [...queueRef.current, ...more] })
      }
      return
    }
    setStage('loading')
    load()
  }

  function retry() {
    setError(null)
    setStage('loading')
    load()
  }

  // Three calls at once, and the screen turns on none of them alone:
  // the check prints when it lands, the review prints when it lands,
  // the breakdown is ready by the time the learner has rated.
  function submit() {
    if (stage !== 'writing') return
    const line = answer.trim()
    if (!line) return
    playUi('click-mode-selection')
    const key = point._uiKey
    setSentence(line)
    setStage('feedback')
    fetchCheck(key, point.raw_id, line)
    fetchReview(key, point.raw_id, line)
    fetchAnalysis(line)
  }

  // The learner's own grade, on the app's six-segment bar; q > 2 is
  // the pass. The two other opinions go back with it as the learner
  // saw them (dictation's rule: the figure on the screen is the one
  // worth keeping beside the rating), or as nothing when there was
  // none. Never gated on the tutor: a spent day still grades.
  function grade(quality) {
    if (rated) return
    setRated(true)
    setScore(s => ({ correct: s.correct + (quality > 2 ? 1 : 0), total: s.total + 1 }))
    apiJson('/api/composition/result', session, {
      method: 'POST',
      body: JSON.stringify({
        raw_id: point.raw_id,
        sentence,
        quality,
        found,
        verdict: tutor?.review?.verdict ?? null,
        grammar_used: tutor?.review?.grammar_used ?? null,
      }),
    })
      .then(res => fare.pay(res, quality))
      .catch(() => {})
  }

  const where = `${level} · ${t.stationJlpt}`
  const grammarFoot = point
    ? <>{t.readingGrammarPoint} · <span lang="ja">{point.pattern}</span></>
    : t.compositionTitle

  // The desk's column (plan 114): the point's lesson while the learner
  // writes — rule, use, careful, the examples, the rivals, the same body
  // the grammar station stands beside its points — and the sentence's
  // own breakdown once they have rated, with the doors opening in the
  // column (BreakdownSide → SideLookup).
  const side = rated
    ? (
      <BreakdownSide
        graded
        analysis={analysis}
        loading={analysisLoading}
        translation={tutor?.review?.meaning}
        sentenceText={sentence}
        onTokenClick={w => setLookup(vocabLookup(w))}
        onGrammarOpen={g => setLookup(grammarLookup(g))}
        onExplain={explainLine}
        explaining={explaining}
        explainError={explainError}
        lookup={lookup}
        onExitLookup={closeLookup}
        session={session}
      />
    )
    : point
      ? <GrammarLessonBody key={point.raw_id} id={point.raw_id} session={session} />
      : <p className="desk-run__note">{t.loading}</p>

  return (
    <StudyStage
      color={SAKUBUN_COLOR}
      onLeave={() => navigate(BASE)}
      leaveLabel={t.leaveLevels}
      where={t.compositionTitle}
      sub={where}
      remaining={`${score.correct} / ${score.total}`}
      pass={false}
      toast={fare.toast}
      onToastDone={fare.toastDone}
      side={side}
      sideLabel={rated ? t.deskBreakdownLabel : t.glLesson}
    >
      {stage === 'loading' && <Loading />}

      {stage === 'error' && (
        <Empty tone="error" message={error} action={{ label: t.retry, onClick: retry }} />
      )}

      {stage === 'writing' && point && (
        <>
          {/* The point as the page: the pattern where the sentence goes
              in the other runs, its structure under it, its meaning in
              the learner's language. No example sentence, ever — an
              example on the card is a sentence to copy; the examples
              live behind the lesson's door, which costs nothing to
              open. The prose card rather than the entry plate: the
              stage grows a footed prompt card into whatever the docked
              field leaves, and the plate is the entry panel's header,
              drawn only with the entry's own marks and actions. */}
          <CardTransition cardKey={point._uiKey}>
            <PromptCard prose foot={{ left: where, right: t.compositionTitle }}>
              <span className="prose__label">{t.compositionPrompt}</span>
              <span className="prose__jp" lang="ja">{point.pattern}</span>
              {point.structure && <span className="prose__romaji" lang="ja">{point.structure}</span>}
              <span className="prose__rule" />
              <span className="prose__en">{point.meaning}</span>
              {!desk && (
                <div className="prose__breakdown">
                  <button type="button" className="btn-secondary" onClick={() => setLesson(true)}>
                    {t.glLesson}
                  </button>
                </div>
              )}
            </PromptCard>
          </CardTransition>

          {/* Translation's Japanese field, word for word: fed by an IME,
              whose candidate is already the learner's choice, so
              nothing may rewrite it on the way in. */}
          <form className="stage__foot" onSubmit={e => { e.preventDefault(); submit() }}>
            <input
              autoFocus
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder={t.japanesePlaceholder}
              aria-label={t.compositionPrompt}
              className="field field--page"
              lang="ja"
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

      {stage === 'feedback' && point && (
        <>
          <PromptCard prose foot={{ left: where, right: grammarFoot }}>
            {/* Opening the breakdown puts the sentence away — its own
                line prints it — and keeps the tutor's reading of it. */}
            {!showBreakdown && (
              <>
                {/* The detector's word rides on the answer's own label
                    rather than standing over the card as a verdict: a
                    hint for the learner grading below, not the grade,
                    exactly where dictation prints its accuracy. Nothing
                    at all on a point the detector is not trusted on. */}
                <span className="prose__label prose__label--measured">
                  {t.yourAnswer}
                  {typeof found === 'boolean' && (
                    <span className="prose__measure">{found ? t.compositionFound : t.compositionNotFound}</span>
                  )}
                </span>
                <span className="prose__jp" lang="ja">{sentence}</span>
                <span className="prose__rule" />
              </>
            )}
            <span className="prose__label">{t.aiAnalysis}</span>
            {tutorLoading && <Loading inline copy={t.analyzingComposition} />}
            {!tutorLoading && limited && <span className="prose__ai">{t.compositionLimitReached}</span>}
            {!tutorLoading && !limited && tutor?.review && (
              <TutorReview review={tutor.review} grammar={point.pattern} t={t} />
            )}
            {!tutorLoading && !limited && tutor && !tutor.review && (
              <span className="prose__ai">{tutor.analysis}</span>
            )}
            {!tutorLoading && !limited && !tutor && <span className="prose__ai">{t.analysisUnavailable}</span>}

            {/* The sentence word by word, once the learner has rated —
                the same gate and the same button states as dictation's. */}
            {!desk && rated && (
              <div className="prose__breakdown">
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
                    translation={tutor?.review?.meaning}
                    sentenceText={sentence}
                    t={t}
                    onTokenClick={w => setLookup(vocabLookup(w))}
                    onGrammarOpen={g => setLookup(grammarLookup(g))}
                    onExplain={explainLine}
                    explaining={explaining}
                    explainError={explainError}
                  />
                )}
              </div>
            )}
          </PromptCard>

          {rated ? (
            <div className="stage__foot">
              <button type="button" className="btn-primary" onClick={next} aria-keyshortcuts={desk ? 'Enter' : undefined}>
                {t.nextPhrase}
                {desk && <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>}
              </button>
              {/* 机: Enter takes the next point, as in every practice run. */}
              <EnterKey onEnter={next} />
            </div>
          ) : (
            /* Docked on the stage's bottom edge, like every other run's.
               Active whether or not the tutor answered: the grade is the
               learner's, and a spent day does not take it away. */
            <RatingBar active onRate={grade} />
          )}
        </>
      )}

      {/* The phone's doors: the lesson behind the point, and a word or
          a rule in the breakdown. On the desk the lesson is the side and
          a door in the breakdown opens there (SideLookup). */}
      {lesson && !desk && point && (
        <GrammarLessonSheet id={point.raw_id} session={session} onClose={() => setLesson(false)} />
      )}
      {lookup && !desk && (
        <DictionaryLookupSheet key={lookupKey(lookup)} {...lookup} session={session} onClose={closeLookup} />
      )}
    </StudyStage>
  )
}
