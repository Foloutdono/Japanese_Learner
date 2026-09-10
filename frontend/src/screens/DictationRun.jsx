import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { runSource } from '../domain/sentenceSource'
import { StudyStage } from '../components/study/StudyStage'
import PromptCard from '../components/study/PromptCard'
import RatingBar from '../components/study/RatingBar'
import ClipPlayer from '../components/study/ClipPlayer'
import { FuriganaParts } from '../components/study/Readings'
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
// sentence IS the answer, so two things follow that nothing else on
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
  const navigate = useNavigate()
  const { t } = useLang()

  const [stage, setStage]       = useState('loading')
  const [clip, setClip]         = useState(null)   // { id, level, audioSrc }
  const [maxPlays, setMaxPlays] = useState(2)
  const [plays, setPlays]       = useState(0)
  const [answer, setAnswer]     = useState('')
  const [result, setResult]     = useState(null)   // the graded reveal
  const [score, setScore]       = useState({ correct: 0, total: 0 })
  const [rated, setRated]       = useState(false)
  const [error, setError]       = useState(null)

  const queueRef = useRef([])      // clips fetched ahead, never rendered
  const fetchingRef = useRef(false)
  const heardRef = useRef([])      // every clip id this session has played
  const startedRef = useRef(false)

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
    setStage('listening')
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
      })
      .catch(() => {
        // The answer is graded on the server and nowhere else, so a
        // failure here has nothing to fall back to. What was typed is
        // kept, and the retry re-fetches rather than losing the run.
        setError(t.dictationCheckError)
        setStage('error')
      })
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
    setScore(s => ({ correct: s.correct + (quality > 2 ? 1 : 0), total: s.total + 1 }))
    apiJson('/api/dictation/result', session, {
      method: 'POST',
      body: JSON.stringify({
        clip_id: clip.id,
        answer: answer.trim(),
        quality,
        accuracy: result.accuracy,
        plays,
      }),
    }).catch(() => {})
  }

  const where = `${level} · ${t.stationJlpt}`

  return (
    <StudyStage
      color={KAKITORI_COLOR}
      onLeave={() => navigate(BASE)}
      leaveLabel={t.leaveLevels}
      where={t.dictationTitle}
      sub={where}
      remaining={`${score.correct} / ${score.total}`}
      pass={false}
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
          <PromptCard foot={{ left: where, right: t.dictationTitle }}>
            <ClipPlayer
              key={clip.audioSrc}
              src={clip.audioSrc}
              plays={plays}
              maxPlays={maxPlays}
              onPlay={() => setPlays(n => n + 1)}
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
              autoFocus
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
          <PromptCard prose foot={{ left: where, right: t.dictationTitle }}>
            {/* The line, with its reading over the kanji that need one.
                Built backend-side from the bank's own kana, so the ruby
                over 九時 is くじ rather than a guess — see
                study/dictation.reveal. The kana line this replaces said
                the same thing twice, once detached from the writing it
                belonged to. */}
            <span className="prose__jp kaki-line" lang="ja">
              <FuriganaParts parts={result.furigana} />
            </span>
            {/* Romaji rather than kana: it is the alphabet the learner
                just answered in, so it is the line they can actually
                check themselves against. */}
            <span className="prose__romaji">{result.romaji}</span>
            <span className="prose__label">
              {result.translation_lang === 'en' ? t.translationEnglish : t.translation}
            </span>
            <span className="prose__en">{result.translation}</span>
            <span className="prose__rule" />
            {/* The measurement rides on the answer's own label rather
                than standing over the card as a verdict: it is a hint
                for the learner grading below, not the grade. */}
            <span className="prose__label kaki-answer__label">
              {t.yourAnswer}
              <span className="kaki-accuracy">{t.dictationCaught(result.accuracy)}</span>
            </span>
            <span className="prose__en">{answer.trim() || '—'}</span>
          </PromptCard>

          {rated ? (
            <div className="stage__foot">
              <button type="button" className="btn-primary" onClick={next}>{t.nextPhrase}</button>
            </div>
          ) : (
            /* Docked on the stage's bottom edge (index.css, .stage),
               like every other run's. */
            <RatingBar active onRate={grade} />
          )}
        </>
      )}

    </StudyStage>
  )
}
