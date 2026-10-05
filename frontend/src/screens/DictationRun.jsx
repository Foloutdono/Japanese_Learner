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
import { SentenceCheck } from '../components/study/PracticeCard'
import RatingBar from '../components/study/RatingBar'
import ClipPlayer from '../components/study/ClipPlayer'
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
import { RunStreak } from '../components/study/RunStreak'
import { DictionaryLookupSheet } from '../components/dictionary/DictionaryDetail'
import { vocabLookup, grammarLookup, lookupKey } from '../components/analysis/lookup'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'

const KAKITORI_COLOR = 'var(--line-kakitori)'
const BASE = '/practice/dictation'
const BATCH_SIZE = 5
const PREFETCH_THRESHOLD = 1

// Route: /practice/dictation/:level — the session on the stage. The
// level list is the station page above it, under the chrome
// (screens/SentenceStation.jsx), which is why this has one axis and no
// source picker: a dictation line is chosen by grade and by nothing
// else. Same shape as comprehension.
//
// ── What makes this mode different from the other three ──
// Reading, translation and comprehension all put the sentence on the
// screen and let the learner grade themselves against it. Here the
// sentence IS the answer, so three things follow that nothing else on
// this tab does:
//
//   the batch carries no text   Only audio and an id. The words arrive
//                               from /api/dictation/check, after the
//                               answer has been sent — see
//                               backend/routes/dictation.py for why
//                               shipping them early would end the mode.
//   the answer is romaji        Not by preference: a Japanese keyboard
//                               is a separate install on a laptop and a
//                               separate keyboard on a phone, and a
//                               beginner practising listening has not
//                               got that far. Kana and kanji answers
//                               still measure full — the backend tries
//                               all three forms — but the field asks
//                               for the one a learner can actually
//                               type, and the reveal answers in it.
//   the breakdown starts late   Reading practice fires its word-by-word
//                               analysis the instant the phrase goes up
//                               and has the whole writing window to
//                               resolve it. The client here does not
//                               have the line until /check answers, so
//                               the fetch begins at the reveal and the
//                               learner reading and rating is the whole
//                               of the window. See `analysis` below.
//
// The rating bar IS here, and once was not: the server graded, on the
// reasoning that a learner who has not seen the sentence cannot judge
// their own transcription. They can — they have just read it, on this
// screen, with its furigana and its romaji beside their own line — and
// romaji has more right spellings than a mark scheme can hold. So the
// server measures and the learner grades, the same split reading and
// translation practice use. See docs/adr/0013.
export default function DictationRun({ session }) {
  const { level: levelParam } = useParams()
  const route = runSource({ base: BASE, level: levelParam, levelsOnly: true })

  // A hand-typed path the station could not have produced: back to the
  // list rather than a session with nothing to fetch.
  if (!route) return <Navigate replace to={BASE} />

  // Keyed on the grade, so N5 → N4 is a NEW session rather than the
  // same one reset by hand. React Router keeps a component across a
  // param change, and every screen that forgets it carries an effect
  // whose whole job is to undo the last session's state.
  return <Session key={route.level} session={session} level={route.level} />
}

// 'loading' | 'listening' | 'checking' | 'feedback' | 'error'
function Session({ session, level }) {
  const desk = useDesk()
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [stage, setStage]       = useState('loading')
  const [clip, setClip]         = useState(null)   // { id, level, audioSrc }
  const [maxPlays, setMaxPlays] = useState(2)
  const [plays, setPlays]       = useState(0)
  const [answer, setAnswer]     = useState('')
  const [result, setResult]     = useState(null)   // the graded reveal
  const [score, setScore]       = useState({ correct: 0, total: 0 })
  // The fare per graded clip, from the result's own response.
  const fare = usePracticeXp()
  const [rated, setRated]       = useState(false)
  // The grade given, for the run's lines (plan 129); null until rated.
  const [quality, setQuality]   = useState(null)
  const [error, setError]       = useState(null)
  // 机 (plan 123): on the desk the field is not focused on arrival, so
  // the first Space plays the clip; the listen puts the pen in the
  // field. Replays stay on ▶ -- Space in the field is a space.
  const fieldRef = useRef(null)
  function onListen() {
    setPlays(n => n + 1)
    if (desk) fieldRef.current?.focus()
  }

  // ── The word-by-word breakdown (reading practice's, on this stage) ──
  // The same LLM segmentation the 解析 screen runs, through the same
  // POST /api/phrase/analyze with save=false, drawn by the same
  // SentenceBreakdown in its 'rows' layout. Third caller, no fourth
  // copy: a near-copy of it would have drifted inside two features
  // (DESIGN.md, "What not to do").
  //
  // One thing here is not like reading practice, and it follows from
  // the mode's own rule. Reading fires this the instant the phrase goes
  // up, so the whole display-and-writing window is prefetch and the
  // reader never waits. Here the client does not HAVE the sentence
  // until /check answers -- that is the entire point of the batch being
  // audio and an id (routes/dictation.py) -- so the fetch cannot start
  // one moment sooner than the reveal, and the learner reading the line
  // and rating themselves is the whole of the window. It is usually
  // enough, and it costs nothing after the first learner of a given
  // line: routes/phrase.py caches the analysis permanently by (phrase,
  // lang), and this bank is ~20 fixed lines a grade.
  //
  // What that changes on screen is the button's states, below: both
  // "preparing" and "unavailable" are reachable here, where reading's
  // prefetch window hides them.
  const [analysis, setAnalysis]               = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [showBreakdown, setShowBreakdown]     = useState(false)
  // One sheet for everything the breakdown opens (plan 096): the word
  // the learner tapped opens its dictionary entry, a marker row and a
  // chip open the point's lesson. Stable, so the sheet's useDialog
  // does not re-run its focus effect (and steal focus) on every render
  // while it is open.
  const [lookup, setLookup] = useState(null)
  const closeLookup = useCallback(() => setLookup(null), [])
  // 机 (plan 129): this run's lines, each reopening its breakdown.
  const lines = useRunLines(session, { held: Boolean(lookup) })
  // 問 (plan 131): a question about the line, once graded, on the desk.
  const asking = useAsk(session, 'dictation')

  const queueRef = useRef([])      // clips fetched ahead, never rendered
  const fetchingRef = useRef(false)
  const heardRef = useRef([])      // every clip id this session has played
  const startedRef = useRef(false)
  // Which line the in-flight analysis belongs to, so a slow answer for
  // a clip the learner has already moved past cannot overwrite the one
  // on screen.
  const analysisLineRef = useRef(null)

  function batchUrl(count) {
    const params = new URLSearchParams({ level, count })
    // The bank is 18-20 lines a level, so the tail is all the picker
    // needs to work through it before repeating. Same '|' separator and
    // the same reasoning as reading practice's own exclude.
    if (heardRef.current.length) params.set('exclude', heardRef.current.slice(-40).join('|'))
    return `/api/dictation/batch?${params.toString()}`
  }

  function fetchBatch() {
    fetchingRef.current = true
    return apiJson(batchUrl(BATCH_SIZE), session)
      .then(data => {
        const clips = data.clips ?? []
        if (data.max_plays) setMaxPlays(data.max_plays)
        heardRef.current = [...heardRef.current, ...clips.map(c => c.id)]
        return clips
      })
      .catch(() => [])
      .finally(() => { fetchingRef.current = false })
  }

  function show(next) {
    setClip(next)
    setPlays(0)
    setAnswer('')
    setResult(null)
    setRated(false)
    setQuality(null)
    setAnalysis(null)
    setAnalysisLoading(false)
    setShowBreakdown(false)
    setExplaining(false)
    setExplainError(null)
    setLookup(null)
    analysisLineRef.current = null
    setStage('listening')
  }

  // The breakdown for `jp`, started the moment the line exists on the
  // client -- see the note on `analysis` above for why that moment is
  // the reveal and cannot be earlier. `save: false` keeps dictation
  // runs out of the analyzer's own history (routes/phrase.py's
  // PhraseRequest.save).
  function fetchAnalysis(jp) {
    analysisLineRef.current = jp
    setAnalysis(null)
    setAnalysisLoading(true)
    // The local tier only; the explanation is bought on demand below.
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: jp, save: false, deep: false, whole: true, lang }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (analysisLineRef.current === jp) setAnalysis(d) })
      .catch(() => { if (analysisLineRef.current === jp) setAnalysis(null) })
      .finally(() => { if (analysisLineRef.current === jp) setAnalysisLoading(false) })
  }


  // ── The explanation, bought on demand (plan 095, owner-directed) ──
  // The fetch above buys the local tier only; this buys the deep tier
  // for the sentence on screen when the learner presses Explain under
  // the breakdown, and replaces the analysis with the explained one.
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState(null)
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

  // Fetches, then either shows the head or says why it cannot. Takes no
  // state to `loading` itself: on mount everything already is, and the
  // one caller that needs the reset (retry) is an event handler and
  // does it there.
  function load() {
    return fetchBatch().then(clips => {
      if (!clips.length) {
        setError(t.dictationFetchError)
        setStage('error')
        return
      }
      show(clips[0])
      queueRef.current = clips.slice(1)
    })
  }

  // The mount IS the start (the shape ReadingRun's SessionView uses):
  // this component only exists once there is a session to run, and the
  // key above guarantees a fresh one per grade.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    startTally(`dictation:${level}`)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // What a question about the line carries, less its breakdown
  // (domain/ask's askTarget adds the words): the line, its translation,
  // what the learner heard. Nothing before the reveal: the line is the
  // answer.
  function askBase() {
    if (!result) return null
    return { sentence: result.jp, level, translation: result.translation, answer: answer.trim() }
  }

  function next() {
    // The line just graded joins the run's lines (plan 129).
    if (clip && result && quality != null) {
      lines.commit({ key: clip.id, jp: result.jp, translation: result.translation, quality, analysis, ask: askBase() })
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
    // The queue ran dry behind a slow or failed prefetch: block rather
    // than strand the learner on a clip they have finished.
    setStage('loading')
    load()
  }

  function retry() {
    setError(null)
    setStage('loading')
    load()
  }

  function submit() {
    if (stage !== 'listening') return
    playUi('click-mode-selection')
    setStage('checking')
    apiJson('/api/dictation/check', session, {
      method: 'POST',
      // No `plays` here: the reveal does not write a row, so the
      // listen count travels with the grade instead (see grade()).
      body: JSON.stringify({ clip_id: clip.id, answer: answer.trim() }),
    })
      .then(data => {
        setResult(data)
        setStage('feedback')
        return data
      })
      .catch(() => {
        // The answer is graded on the server and nowhere else, so a
        // failure here has nothing to fall back to. What was typed is
        // kept, and the retry re-fetches rather than losing the run.
        setError(t.dictationCheckError)
        setStage('error')
        return null
      })
      // The breakdown is kicked off AFTER the reveal's own catch, and
      // deliberately: inside the `.then` above it would sit within the
      // chain that catch guards, and anything it threw would put the
      // run on its error screen. A breakdown that cannot be fetched
      // must cost the breakdown and nothing else.
      .then(data => { if (data) fetchAnalysis(data.jp) })
  }

  // The learner's own grade, on the app's six-segment bar. `quality`
  // is 0..5 worst-to-best as RatingBar emits it, and q > 2 is the pass
  // — the same line the bar itself draws between its two sounds.
  //
  // The accuracy goes back with it: it is the figure the learner was
  // looking at when they rated, which is the only version of it worth
  // keeping beside the rating. A failed write costs a history row and
  // nothing else, so the run does not wait on it.
  function grade(quality) {
    if (rated) return
    setRated(true)
    setQuality(quality)
    setScore(s => ({ correct: s.correct + (quality > 2 ? 1 : 0), total: s.total + 1 }))
    countReview({ quality })
    lines.close()
    setLookup(null)
    apiJson('/api/dictation/result', session, {
      method: 'POST',
      body: JSON.stringify({
        clip_id: clip.id,
        answer: answer.trim(),
        quality,
        accuracy: result.accuracy,
        plays,
      }),
    })
      // The fare rides the response (xp_earned, top-level); a failed
      // post costs the fare and nothing else.
      .then(res => fare.pay(res, quality))
      .catch(() => {})
  }

  const where = `${level} · ${t.stationJlpt}`
  const keys = useSentenceKeys({ listen: true })
  // The asking's thread: a reopened line's, else the line on the
  // stage's, open once it is graded (plan 131).
  const target = askTarget(lines.opened, { key: clip?.id, base: askBase(), analysis, open: stage === 'feedback' && rated })
  // A door in a breakdown -- the line on the stage's, or one reopened
  // from the run's lines -- opens in the column (plan 115).
  const doors = {
    onTokenClick: w => setLookup(vocabLookup(w)),
    onGrammarOpen: g => setLookup(grammarLookup(g)),
    lookup,
    onExitLookup: closeLookup,
    session,
  }

  return (
    <StudyStage
      color={KAKITORI_COLOR}
      // One of the four sentence runs: on the desk its floor stands
      // unframed on the page (index.css, the 机 section's 三面 block).
      className="stage--sentence"
      onLeave={() => navigate(BASE)}
      leaveLabel={t.leaveLevels}
      where={t.dictationTitle}
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
          // The line is unknown until the reveal: the row is an
          // ellipsis while the learner listens.
          current={clip && stage !== 'error' ? currentLine(stage === 'feedback' ? result?.jp : null, quality) : null}
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
          graded={stage === 'feedback' && Boolean(result) && rated}
          analysis={analysis}
          loading={analysisLoading}
          translation={result?.translation}
          sentenceText={result?.jp}
          onExplain={explainLine}
          explaining={explaining}
          explainError={explainError}
          {...doors}
        />
      )}
      sideLabel={t.deskBreakdownLabel}
    >
      {(stage === 'loading' || stage === 'checking') && <Loading />}

      {stage === 'error' && (
        <Empty tone="error" message={error} action={{ label: t.retry, onClick: retry }} />
      )}

      {stage === 'listening' && clip && (
        <>
          {/* The clip's card IS the stage's card — a footed prompt card
              handed straight to the stage, the way the other practice
              runs hand theirs, so index.css's `.stage > .prompt-card
              --footed` grows it into whatever the docked field leaves
              and the player sits in the middle of that room. Without
              it the control was 90px of card over 450px of nothing.

              No CardTransition around it, unlike the sentence runs:
              their card carries a specimen worth crossfading, and this
              one carries a control. The player is keyed on the clip
              instead — the rail, the failure and the <audio> element
              all belong to one src, and a new clip is a new player.

              Footed, and that is the whole layout: a footed card is
              already a flex column whose body owns the leftover height
              and centres in it, so the player needs no rule of its
              own. */}
          <PromptCard page>
            <ClipPlayer
              key={clip.audioSrc}
              src={clip.audioSrc}
              plays={plays}
              maxPlays={maxPlays}
              onPlay={onListen}
              keyHint={desk}
            />
          </PromptCard>

          {/* Nothing may rewrite what is typed here, and the reason is
              reading practice's word for word: romaji is not a word in
              any language the keyboard knows, so a phone's own helpers
              treat every answer as a typo to be repaired —
              autocapitalise puts a capital on it, autocorrect
              substitutes the nearest real word, spellcheck underlines
              all of it. The learner grades this line against the
              reveal; a silently rewritten answer is not a cosmetic
              annoyance but a wrong verdict on their own hearing.

              No lang="ja" either, for the same reason: the field holds
              Latin letters now, and telling the browser otherwise
              invites an IME onto a keyboard the learner does not have. */}
          <form className="stage__foot" onSubmit={e => { e.preventDefault(); submit() }}>
            <input
              ref={fieldRef}
              autoFocus={!desk}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder={t.dictationPlaceholder}
              aria-label={t.dictationPrompt}
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

      {stage === 'feedback' && result && (
        <>
          {/* The practice card (plan 185, the owner's pick A, then
              A1 with A2.2 and A2.3): the line leading with its reading
              over the kanji -- built backend-side from the bank's own
              kana, so the ruby over 九時 is くじ rather than a guess
              (study/dictation.reveal) -- each miss underlined in it, its
              gloss, and the answer in its well with its misses corrected
              over it against the bank's romaji and the server's measure
              at its end; under it each word missed, read as the bank
              reads it. Opening the breakdown puts the page away, as
              reading's does: the breakdown's own line and gloss say the
              same. */}
          <PromptCard page prose>
            {!showBreakdown && (
              <SentenceCheck
                parts={result.furigana}
                text={result.jp}
                words={result.words}
                tokens={analysis?.tokens}
                romaji={result.romaji}
                meaning={result.translation}
                meaningLang={result.translation_lang}
                answer={answer.trim()}
                accuracy={result.accuracy}
                t={t}
              />
            )}

            {/* Only once the learner has rated. Before that the rating
                bar is docked over this edge anyway, but the real reason
                is the mode: the grade is theirs to give against what
                they heard, and a word-by-word gloss offered first is an
                answer key handed over mid-question. Reading practice
                gates its own breakdown on the same moment. */}
            {!desk && rated && (
              <div className="prose__breakdown">
                <button
                  type="button"
                  onClick={() => setShowBreakdown(s => !s)}
                  /* Disabled until there IS one to show, and not merely
                     until the fetch has settled — a press mid-flight
                     would put the registers away and draw nothing in
                     their place. Reading practice used to enable this
                     while loading and got away with it, because its
                     prefetch is long since done by the time the button
                     exists; it gates on the same condition now, since
                     "unlikely" was never the same as "cannot happen".
                     Here the fetch starts at the reveal, so a press
                     mid-flight is ordinary rather than a slow day. */
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
                    translation={result.translation}
                    sentenceText={result.jp}
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
              {/* 机 (plan 123): Enter takes the next line. */}
              <EnterKey onEnter={next} />
            </div>
          ) : (
            /* Docked on the stage's bottom edge (index.css, .stage),
               like every other run's. */
            <RatingBar active onRate={grade} />
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
