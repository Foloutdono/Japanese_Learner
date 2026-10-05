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
import { PointTag, PointForm, SentenceLead, CorrectedInPlace } from '../components/study/PracticeCard'
import { GrammarLessonBody, GrammarLessonSheet } from '../components/study/GrammarLesson'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { BreakdownSide, LineSide, DeskPane } from '../components/analysis/BreakdownSide'
import { useDesk } from '../hooks/useDesk'
import { EnterKey, KeyCap } from '../components/chrome/DeskKeys'
import { RunLines } from '../components/study/RunLines'
import { useSentenceKeys, currentLine } from '../components/study/sentenceLines'
import { useRunLines } from '../hooks/useRunLines'
import { useAsk } from '../hooks/useAsk'
import { AskPanel } from '../components/study/AskPanel'
import { askTarget } from '../domain/ask'
import { startTally, countReview } from '../stores/runTally'
import { RunStreak } from '../components/study/RunStreak'
import { DictionaryLookupSheet } from '../components/dictionary/DictionaryDetail'
import { vocabLookup, grammarLookup, lookupKey } from '../components/analysis/lookup'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'

const SAKUBUN_COLOR = 'var(--line-sakubun)'
const BASE = '/practice/composition'
const BATCH_SIZE = 5
const PREFETCH_THRESHOLD = 1

// Typed in the alphabet: letters, and not a kana or a kanji among them
// (the server's study/romaji.is_romaji, for the same sentence).
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f]/
const isRomaji = text => !JAPANESE.test(text) && /\p{L}/u.test(text)

// Route: /practice/composition/:level — the session on the stage
// (plan 125). The level list is the station page above it, under the
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
  // The sentence in Japanese when it was typed in romaji: the tutor's
  // spelling in kanji and kana, else the check's kana. Null while it is
  // coming, and for a sentence written in Japanese, which is its own.
  const [written, setWritten] = useState(null)
  const [found, setFound]     = useState(null)   // the detector's: true | false | null
  const [tutor, setTutor]     = useState(null)   // { review, analysis } from /review
  const [tutorLoading, setTutorLoading] = useState(false)
  const [limited, setLimited] = useState(false)  // the day's reviews are spent
  const [rated, setRated]     = useState(false)
  // The grade given, for the run's lines (plan 129); null until rated.
  const [quality, setQuality] = useState(null)
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
  // 机 (plan 129): this run's sentences -- the learner's own -- each
  // reopening its breakdown in the side.
  const lines = useRunLines(session, { held: Boolean(lookup) })
  // 問 (plan 131): a question about the sentence, once graded, on the desk.
  const asking = useAsk(session, 'composition')

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
    setWritten(null)
    setFound(null)
    setTutor(null)
    setTutorLoading(false)
    setLimited(false)
    setRated(false)
    setQuality(null)
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

  // Resolves to the check's kana of a romaji sentence, or null.
  function fetchCheck(key, raw_id, line) {
    return apiJson('/api/composition/check', session, {
      method: 'POST',
      body: JSON.stringify({ raw_id, sentence: line }),
    })
      .then(d => {
        if (pointKeyRef.current === key) setFound(typeof d.found === 'boolean' ? d.found : null)
        return d.japanese ?? null
      })
      .catch(() => {
        if (pointKeyRef.current === key) setFound(null)
        return null
      })
  }

  // Resolves to the tutor's spelling of a romaji sentence, or null --
  // none asked for (the day spent), none given, or the call failed.
  function fetchReview(key, raw_id, line) {
    if (limitedRef.current) {
      setLimited(true)
      return Promise.resolve(null)
    }
    setTutorLoading(true)
    return apiFetch('/api/composition/review', session, {
      method: 'POST',
      body: JSON.stringify({ raw_id, sentence: line, lang }),
    })
      .then(async r => {
        if (pointKeyRef.current !== key) return null
        if (r.status === 429) {
          limitedRef.current = true
          setLimited(true)
          return null
        }
        if (!r.ok) {
          setTutor(null)
          return null
        }
        const d = await r.json()
        if (pointKeyRef.current !== key) return null
        setTutor(d)
        // The detector's word again, on the sentence the tutor wrote out.
        if (typeof d.found === 'boolean') setFound(d.found)
        return d.japanese ?? null
      })
      .catch(() => {
        if (pointKeyRef.current === key) setTutor(null)
        return null
      })
      .finally(() => { if (pointKeyRef.current === key) setTutorLoading(false) })
  }

  function fetchAnalysis(line) {
    analysisLineRef.current = line
    setAnalysis(null)
    setAnalysisLoading(true)
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: line, save: false, deep: false, whole: true, lang }),
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
    startTally(`composition:${level}`)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // What a question about the sentence carries, less its breakdown
  // (domain/ask's askTarget adds the words): the learner's own
  // sentence, what the tutor says it means, the point it practises and
  // the tutor's review of it.
  function askBase() {
    if (!point || !sentence) return null
    return {
      sentence: written ?? sentence,
      level,
      translation: tutor?.review?.meaning ?? '',
      point: `${point.pattern} — ${point.meaning}`,
      review: tutor?.analysis ?? '',
    }
  }

  function next() {
    // The sentence just graded joins the run's lines (plan 129), with
    // what the tutor said it means as its translation.
    if (point && sentence && quality != null) {
      lines.commit({ key: point._uiKey, jp: written ?? sentence, translation: tutor?.review?.meaning, quality, analysis, ask: askBase() })
    }
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
  //
  // A sentence typed in romaji is broken down in Japanese: the
  // breakdown reads nothing else, and "mizu to gohan wo tabemashita"
  // drew five rows of letters with no card and no rule. So its
  // breakdown waits for the tutor to write it out in kanji and kana,
  // or, with no tutor, for the check's kana.
  function submit() {
    if (stage !== 'writing') return
    const line = answer.trim()
    if (!line) return
    playUi('click-mode-selection')
    const key = point._uiKey
    setSentence(line)
    setStage('feedback')
    const kana = fetchCheck(key, point.raw_id, line)
    const spelled = fetchReview(key, point.raw_id, line)
    if (!isRomaji(line)) {
      fetchAnalysis(line)
      return
    }
    setAnalysisLoading(true)
    spelled
      .then(jp => jp ?? kana)
      .then(jp => {
        if (pointKeyRef.current !== key) return
        setWritten(jp || null)
        fetchAnalysis(jp || line)
      })
  }

  // The learner's own grade, on the app's six-segment bar; q > 2 is
  // the pass. The two other opinions go back with it as the learner
  // saw them (dictation's rule: the figure on the screen is the one
  // worth keeping beside the rating), or as nothing when there was
  // none. Never gated on the tutor: a spent day still grades.
  function grade(quality) {
    if (rated) return
    setRated(true)
    setQuality(quality)
    setScore(s => ({ correct: s.correct + (quality > 2 ? 1 : 0), total: s.total + 1 }))
    countReview({ quality })
    lines.close()
    setLookup(null)
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
  // The tutor's review, when it answered in its shape.
  const review = tutor?.review ?? null

  // The desk's column (plan 114): the point's lesson while the learner
  // writes — rule, use, careful, the examples, the rivals, the same body
  // the grammar station stands beside its points — and the sentence's
  // own breakdown once they have rated, with the doors opening in the
  // column (BreakdownSide → SideLookup).
  //
  // A sentence of an earlier point reopened from the run's lines (plan
  // 129) takes the column until the learner comes back to this one.
  const doors = {
    onTokenClick: w => setLookup(vocabLookup(w)),
    onGrammarOpen: g => setLookup(grammarLookup(g)),
    lookup,
    onExitLookup: closeLookup,
    session,
  }
  const keys = useSentenceKeys()
  // The asking's thread: a reopened line's, else the sentence on the
  // stage's, open once it is graded (plan 131).
  const target = askTarget(lines.opened, { key: point?._uiKey, base: askBase(), analysis, open: rated })
  const side = lines.opened
    ? <LineSide lines={lines} {...doors} />
    : rated
      ? (
        <BreakdownSide
          graded
          analysis={analysis}
          loading={analysisLoading}
          translation={tutor?.review?.meaning}
          sentenceText={written ?? sentence}
          onExplain={explainLine}
          explaining={explaining}
          explainError={explainError}
          {...doors}
        />
      )
      : point
        ? <DeskPane label={t.glLesson} className="desk-pane--lesson"><GrammarLessonBody key={point.raw_id} id={point.raw_id} session={session} /></DeskPane>
        : <p className="desk-run__note">{t.loading}</p>

  return (
    <StudyStage
      color={SAKUBUN_COLOR}
      // One of the four sentence runs: on the desk its floor stands
      // unframed on the page (index.css, the 机 section's 三面 block).
      className="stage--sentence"
      onLeave={() => navigate(BASE)}
      leaveLabel={t.leaveLevels}
      where={t.compositionTitle}
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
          // The point until the sentence is written, then the sentence.
          current={point && stage !== 'error'
            ? (stage === 'feedback' ? currentLine(written ?? sentence, quality) : { label: point.pattern, lang: 'ja', quality: null })
            : null}
          openKey={lines.opened?.key ?? null}
          onOpen={key => { setLookup(null); lines.open(key) }}
          onCurrent={() => { setLookup(null); lines.close() }}
          keys={keys}
          ask={target.key != null && (
            <AskPanel key={target.key} ask={asking} askKey={target.key} context={target.context} open={target.open} />
          )}
        />
      )}
      side={side}
      sideLabel={rated || lines.opened ? t.deskBreakdownLabel : t.glLesson}
    >
      {stage === 'loading' && <Loading />}

      {stage === 'error' && (
        <Empty tone="error" message={error} action={{ label: t.retry, onClick: retry }} />
      )}

      {stage === 'writing' && point && (
        <>
          {/* The point as the page: the pattern where the sentence goes
              in the other runs, the one thing on the card (plan 185),
              its form as its pieces under it, its meaning in the
              learner's language. No example sentence, ever — an
              example on the card is a sentence to copy; the examples
              live behind the lesson's door, which costs nothing to
              open. The prose card rather than the entry plate: the
              stage grows a footed prompt card into whatever the docked
              field leaves, and the plate is the entry panel's header,
              drawn only with the entry's own marks and actions. */}
          <CardTransition cardKey={point._uiKey}>
            <PromptCard page prose>
              <div className="pcard-group">
                <div className="pcard-lead">
                  <span className="pcard-lead__jp pcard-lead__jp--point" lang="ja">{point.pattern}</span>
                  {point.structure && <PointForm structure={point.structure} />}
                  <span className="pcard-lead__en pcard-lead__en--quiet">{point.meaning}</span>
                </div>
              </div>
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
          {/* The practice card (plan 185, the owner's pick A, then
              A1): the point's tag with the detector's word on it
              (nothing on a point it is not trusted on); the learner's
              sentence leading, corrected in place -- what the tutor took
              out struck and what it put in written small over it,
              numbered with the fix that names it, the corrected
              sentence's reading over the kanji -- the romaji the learner
              typed, when they typed romaji, and what it says under it;
              then the tutor's notes, led by the verdict. Opening the
              breakdown puts the sentence away (its own line prints it)
              and keeps the notes. */}
          <PromptCard page prose>
            {!showBreakdown && (
              <PointTag point={point.pattern} label={t.pcardPoint} used={typeof found === 'boolean' ? found : null} />
            )}
            <div className="pcard-group">
              {!showBreakdown && (
                <SentenceLead
                  romaji={written ? sentence : null}
                  meaning={review?.meaning}
                >
                  <CorrectedInPlace given={written ?? sentence} parts={review?.better ? review.better_parts : null} fixes={review?.fix} />
                </SentenceLead>
              )}
              <div className="pcard-notes">
              {tutorLoading && <Loading inline copy={t.analyzingComposition} />}
              {!tutorLoading && limited && <span className="prose__ai">{t.compositionLimitReached}</span>}
              {!tutorLoading && !limited && review && <TutorReview review={review} t={t} verdict />}
              {!tutorLoading && !limited && tutor && !review && <span className="prose__ai">{tutor.analysis}</span>}
              {!tutorLoading && !limited && !tutor && <span className="prose__ai">{t.analysisUnavailable}</span>}
              </div>
            </div>

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
                    sentenceText={written ?? sentence}
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
                <KeyCap>{t.keyEnter}</KeyCap>
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
