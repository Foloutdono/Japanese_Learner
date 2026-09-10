import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { runSource } from '../domain/sentenceSource'
import { StudyStage } from '../components/study/StudyStage'
import PromptCard from '../components/study/PromptCard'
import ClipPlayer from '../components/study/ClipPlayer'
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
//   the grade is the server's   There is no rating bar. The learner has
//                               not seen the line, so they cannot judge
//                               their own transcription; the backend
//                               compares the two texts and says how
//                               close it was. The rating bar would be
//                               asking someone to mark an exam they
//                               have not been given the paper for.
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
      body: JSON.stringify({ clip_id: clip.id, answer: answer.trim(), plays }),
    })
      .then(data => {
        setResult(data)
        setScore(s => ({ correct: s.correct + (data.correct ? 1 : 0), total: s.total + 1 }))
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

          {/* Japanese, so a phone's own helpers are a smaller hazard
              here than on the romaji field in reading practice — the
              IME is the input method. Spellcheck still goes: it
              underlines every Japanese sentence, and a red squiggle
              under a correct transcription is a lie the learner has no
              way to check. */}
          <form className="stage__foot" onSubmit={e => { e.preventDefault(); submit() }}>
            <input
              autoFocus
              lang="ja"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder={t.dictationPlaceholder}
              aria-label={t.dictationPrompt}
              className="field field--page"
              autoComplete="off"
              autoCorrect="off"
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
          <Verdict result={result} t={t} />

          <PromptCard prose foot={{ left: where, right: t.dictationTitle }}>
            <span className="prose__jp" lang="ja">{result.jp}</span>
            <span className="prose__kana" lang="ja">{result.kana}</span>
            <span className="prose__label">
              {result.translation_lang === 'en' ? t.translationEnglish : t.translation}
            </span>
            <span className="prose__en">{result.translation}</span>
            <span className="prose__rule" />
            <span className="prose__label">{t.yourAnswer}</span>
            <Attempt diff={result.diff} t={t} />
          </PromptCard>

          <div className="stage__foot">
            <button type="button" className="btn-primary" onClick={next}>{t.nextPhrase}</button>
          </div>
        </>
      )}
    </StudyStage>
  )
}

// The machine's mark, set as the app sets any other number: the figure
// with its unit inline and the word beneath it (DESIGN.md, "Figures").
// The word carries a STATE colour — this is correct/incorrect, which is
// what that family is for — and there are four of them because "wrong"
// and "you caught half of it" are not the same result to a listener.
const VERDICT_KEY = {
  perfect: 'dictationPerfect',
  close:   'dictationClose',
  partial: 'dictationPartial',
  missed:  'dictationMissed',
}

function Verdict({ result, t }) {
  return (
    <div className={`kaki-score kaki-score--${result.verdict}`}>
      <span className="record__value">
        {result.accuracy}<span className="record__unit">%</span>
      </span>
      <span className="record__label kaki-score__verdict">
        {t[VERDICT_KEY[result.verdict]] ?? t.dictationMissed}
      </span>
    </div>
  )
}

// What was written, against what was said. The `equal` and `missing`
// runs together spell the line; `extra` is what the ear invented. Each
// mark is a colour AND a line — an underline for a miss, a strike for
// an addition — because a difference told only in colour is no
// difference at all to a share of the people on this screen.
function Attempt({ diff, t }) {
  if (!diff?.length) return <span className="prose__en">—</span>
  return (
    <span className="kaki-diff" lang="ja" aria-label={t.yourAnswer}>
      {diff.map((run, i) => (
        <span key={i} className={`kaki-diff__run kaki-diff__run--${run.op}`}>{run.text}</span>
      ))}
    </span>
  )
}
