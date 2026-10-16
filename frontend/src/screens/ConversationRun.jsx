import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { postResult } from '../lib/postResult'
import { useLang } from '../LangContext'
import { playUi, speakSentence, stopSpeaking } from '../lib/audio'
import { runKey } from '../lib/keyGuards'
import { welded } from '../locales/frenchSpacing'
import { StudyStage } from '../components/study/StudyStage'
import PromptCard from '../components/study/PromptCard'
import RatingBar from '../components/study/RatingBar'
import { RunStreak } from '../components/study/RunStreak'
import { TutorReview, TutorVerdict } from '../components/study/TutorReview'
import { SentenceLead, AnswerWell, CorrectedInPlace, MarkedAnswer } from '../components/study/PracticeCard'
import { SceneLine, ScenePlate, Choices, Said } from '../components/study/GrammarTour'
import { DeskPane } from '../components/analysis/BreakdownSide'
import { FuriganaParts } from '../components/study/Readings'
import { EnterKey, KeyCap } from '../components/chrome/DeskKeys'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { usePracticeXp } from '../hooks/usePracticeXp'
import { useDesk } from '../hooks/useDesk'
import { startTally, countReview, useRunTally } from '../stores/runTally'
import { isRomajiAnswer, mostlyKept } from '../domain/answerDiff'
import { CHOICE_KEY_INDEX } from '../domain/choiceKeys'
import {
  BASE, MODES, MAX_TALK_TURNS, SCENARIO_ID, sceneLine, talkHistory, linesSaid, stationPath,
} from '../domain/conversation'

const KAIWA_COLOR = 'var(--line-kaiwa)'

// Route: /practice/conversation/:scenario/:mode — one scenario, ridden
// one way, on the stage (plan 217). The station above it chose both
// (screens/ConversationStation.jsx).
//
// ── What this mode is ──
// Someone speaks to the learner in a place, and they answer. The talk
// is drawn as the grammar tour draws its scene (GrammarTour's ScenePlate
// and SceneLine: the place as a station plate, each line with who says
// it, its furigana, its translation and its voice -- the other person in
// one voice, the learner in another), and grows a line at a time:
//
//   choose      the other person's line, and the three replies under
//               the card as the tour's tiles. A pick is the answer: the
//               right one ringed, a wrong one crossed, and why said at
//               the card's foot. Graded by the pick (4 or 1, a question's
//               rates), as comprehension's questions are.
//   translate   the other person's line, and what the learner wants to
//               say in their own language. Written in Japanese -- kana,
//               kanji or rōmaji -- it is measured against the model reply
//               and its alternatives, read by the tutor when the day
//               allows, and graded by the learner on the bar (ADR 0013),
//               translation's practice card with the scene round it.
//   free        the other person opens; then the learner answers however
//               they like, and the model plays the other person from
//               there, reacting to what was actually said, while the
//               tutor reads each line back under it. Graded by the
//               learner, line by line. Eight lines at most, and the
//               day's allowance: past it the talk says so and the other
//               two ways still ride.
//
// Whatever the way, the talk goes on as the script has it: the line the
// learner is credited with saying is the model reply (or the
// alternative their answer matched), so the next thing said to them is
// an answer to it. In free talk it is what they wrote.
export default function ConversationRun({ session }) {
  const { scenario, mode } = useParams()
  const { lang } = useLang()
  if (!MODES.includes(mode) || !SCENARIO_ID.test(scenario ?? '')) return <Navigate replace to={BASE} />
  // Keyed on the language too: the script carries its translations.
  return <Run key={`${scenario}:${mode}:${lang}`} session={session} id={scenario} mode={mode} />
}

// 'loading' | 'brief' | 'talk' | 'over' | 'error'
function Run({ session, id, mode }) {
  const desk = useDesk()
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const fare = usePracticeXp()
  const tally = useRunTally()

  const [script, setScript] = useState(null)
  const [stage, setStage] = useState('loading')
  const [fetches, setFetches] = useState(0)
  // The scripted turn the learner is on (choose, translate).
  const [turn, setTurn] = useState(0)
  // The talk so far, each line in SceneLine's shape (domain/conversation's
  // sceneLine) plus, on a free line of the learner's, what the tutor said.
  const [lines, setLines] = useState([])
  // Lines whose translation the learner asked for before answering.
  const [early, setEarly] = useState(() => new Set())
  const [score, setScore] = useState({ right: 0, total: 0 })

  // Choose: the tile picked, which is the answer.
  const [pick, setPick] = useState(null)
  // Translate and free: the field, and whether the grade is given.
  const [answer, setAnswer] = useState('')
  const [rated, setRated] = useState(false)
  // Translate: the reply as submitted, the measure, the tutor.
  const [said, setSaid] = useState(null)
  const [measure, setMeasure] = useState(null)
  const [tutor, setTutor] = useState(null)
  const [tutorLoading, setTutorLoading] = useState(false)
  const [limited, setLimited] = useState(false)
  // Free: a line in flight, why the last one failed, the talk's end.
  const [waiting, setWaiting] = useState(false)
  const [talkError, setTalkError] = useState(null)   // 'limit' | 'off' | 'failed'
  // Why the talk ended, once it has: the other person closed it
  // ('done'), or the learner's eighth line was said ('max').
  const [ended, setEnded] = useState(null)

  const keyRef = useRef(0)
  const nextKey = () => (keyRef.current += 1)
  // Which answer the calls in flight belong to: a slow reply for a turn
  // the learner has moved past must not land on the one in hand.
  const flightRef = useRef(0)
  // Once the day's reviews are spent they stay spent this run: no call
  // is made that the server would refuse and still count.
  const limitedRef = useRef(false)
  // "Again" boards the talk straight away rather than the brief.
  const restartRef = useRef(false)
  const talkRef = useRef(null)

  useEffect(() => {
    let live = true
    apiJson(`/api/conversation/scenario/${id}?lang=${lang}`, session)
      .then(body => {
        if (!live) return
        const data = lang === 'fr' ? welded(body) : body
        setScript(data)
        if (restartRef.current) {
          restartRef.current = false
          begin(data)
        } else {
          setStage('brief')
        }
      })
      .catch(e => {
        if (!live) return
        // A scenario the bank no longer has: back to the list.
        if (e?.status === 404) navigate(BASE, { replace: true })
        else setStage('error')
      })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetches])

  useEffect(() => () => stopSpeaking(), [])

  // The newest line stays in view as the talk grows.
  useEffect(() => {
    const last = talkRef.current?.lastElementChild
    if (!last) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    last.scrollIntoView?.({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [lines.length, pick, said, waiting])

  function resetTurn() {
    flightRef.current += 1
    setPick(null)
    setAnswer('')
    setRated(false)
    setSaid(null)
    setMeasure(null)
    setTutor(null)
    setTutorLoading(false)
  }

  function begin(data) {
    startTally(`conversation:${id}:${mode}`)
    resetTurn()
    setTurn(0)
    setScore({ right: 0, total: 0 })
    setEarly(new Set())
    setLimited(limitedRef.current)
    setWaiting(false)
    setTalkError(null)
    setEnded(null)
    setLines([sceneLine(nextKey(), 'them', data.turns[0].them)])
    setStage('talk')
  }

  function start() {
    playUi('click-mode-selection')
    begin(script)
  }

  function again() {
    playUi('click-mode-selection')
    // A fresh script: the choices are dealt again.
    restartRef.current = true
    setStage('loading')
    setFetches(n => n + 1)
  }

  function leave() {
    navigate(stationPath(script?.level, mode))
  }

  // ── The grade, every way ──
  // `body` is what the result carries besides the scenario and the way:
  // the pick's `correct`, or the rating's `quality` with the opinions the
  // learner saw beside it.
  function grade(quality, body) {
    setScore(s => ({ right: s.right + (quality > 2 ? 1 : 0), total: s.total + 1 }))
    countReview({ quality })
    postResult('/api/conversation/result', session, { scenario: id, mode, ...body })
      .then(({ data }) => fare.pay(data, quality))
  }

  // ── Choose ──
  function choose(i) {
    if (pick != null) return
    const choice = script.turns[turn].choices[i]
    setPick(i)
    grade(choice.right ? 4 : 1, { turn, correct: choice.right })
  }

  // ── Translate ──
  function check() {
    const line = answer.trim()
    if (!line || said != null) return
    playUi('click-mode-selection')
    const flight = (flightRef.current += 1)
    setSaid(line)
    apiJson('/api/conversation/check', session, {
      method: 'POST',
      body: JSON.stringify({ scenario: id, turn, answer: line }),
    })
      .then(d => { if (flightRef.current === flight) setMeasure(d) })
      .catch(() => {})
    if (limitedRef.current) {
      setLimited(true)
      return
    }
    setTutorLoading(true)
    apiFetch('/api/conversation/review', session, {
      method: 'POST',
      body: JSON.stringify({ scenario: id, turn, answer: line, lang }),
    })
      .then(async r => {
        if (flightRef.current !== flight) return
        if (r.status === 429) {
          limitedRef.current = true
          setLimited(true)
          return
        }
        if (!r.ok) return
        const d = await r.json()
        if (flightRef.current === flight) setTutor(lang === 'fr' ? welded(d) : d)
      })
      .catch(() => {})
      .finally(() => { if (flightRef.current === flight) setTutorLoading(false) })
  }

  function rateTranslation(quality) {
    if (rated) return
    setRated(true)
    grade(quality, {
      turn,
      quality,
      accuracy: measure?.accuracy ?? null,
      verdict: tutor?.review?.verdict ?? null,
    })
  }

  // The scripted turn is done: the learner's line joins the talk -- the
  // model reply, or the alternative a translation matched -- and the
  // next thing said to them follows, or the scene's last word.
  function next() {
    const step = script.turns[turn]
    const credited = mode === 'translate' && measure?.target > 0 ? step.alt[measure.target - 1] : step.me
    const added = [sceneLine(nextKey(), 'me', { ...credited, translation: step.me.translation })]
    const following = script.turns[turn + 1]
    if (following) added.push(sceneLine(nextKey(), 'them', following.them))
    else if (script.close) added.push(sceneLine(nextKey(), 'them', script.close))
    setLines(ls => [...ls, ...added])
    resetTurn()
    if (following) setTurn(turn + 1)
    else setStage('over')
  }

  // ── Free ──
  function send() {
    const line = answer.trim()
    if (!line || waiting || ended) return
    playUi('click-mode-selection')
    const flight = (flightRef.current += 1)
    const history = talkHistory(lines)
    const mine = { ...sceneLine(nextKey(), 'me', { jp: line }, speakSentence), index: linesSaid(lines) }
    setLines(ls => [...ls, mine])
    setAnswer('')
    setWaiting(true)
    setTalkError(null)
    setRated(false)
    apiFetch('/api/conversation/talk', session, {
      method: 'POST',
      body: JSON.stringify({ scenario: id, lines: history, answer: line, lang }),
    })
      .then(async r => {
        if (flightRef.current !== flight) return
        if (!r.ok) throw r
        const raw = await r.json()
        const d = lang === 'fr' ? welded(raw) : raw
        // The learner's line as the tutor read it: in Japanese when it
        // was typed in rōmaji, what it says under it, the notes beside it.
        const heard = {
          ...mine,
          jp: d.japanese ?? line,
          typed: d.japanese ? line : null,
          tr: d.review?.meaning || null,
          review: d.review ?? null,
          analysis: d.review ? null : d.analysis ?? null,
        }
        const reply = sceneLine(nextKey(), 'them', d.reply, speakSentence)
        setLines(ls => [...ls.map(l => (l.key === mine.key ? heard : l)), reply])
        if (d.reply.done) setEnded('done')
        else if (mine.index + 1 >= MAX_TALK_TURNS) setEnded('max')
      })
      .catch(failure => {
        if (flightRef.current !== flight) return
        // The line goes back in the field, to be sent again -- or, past
        // the day's allowance or with no tutor at all, to stay there.
        setLines(ls => ls.filter(l => l.key !== mine.key))
        setAnswer(line)
        // The line before it was graded before this one could be sent.
        setRated(true)
        const status = failure?.status
        setTalkError(status === 429 ? 'limit' : status === 500 ? 'off' : 'failed')
      })
      .finally(() => { if (flightRef.current === flight) setWaiting(false) })
  }

  function rateLine(quality) {
    if (rated) return
    const mine = [...lines].reverse().find(l => l.who === 'me')
    if (!mine) return
    setRated(true)
    grade(quality, { turn: mine.index, quality, verdict: mine.review?.verdict ?? null })
    if (ended) setStage('over')
  }

  // ── The keys (the desk's; a phone has none to press) ──
  // A digit picks the tile it numbers, on either keyboard row, as the
  // tour's and Choisir's do.
  const picking = stage === 'talk' && mode === 'choose' && pick == null
  useEffect(() => {
    if (!picking || !desk) return undefined
    const onKey = e => {
      if (!runKey(e)) return
      const i = CHOICE_KEY_INDEX[e.key]
      if (i === undefined || i >= 3) return
      e.preventDefault()
      choose(i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ── What the talk shows ──
  const step = script?.turns[turn] ?? null
  const last = lines.at(-1)
  // The line just said to the learner, while they still owe it a reply:
  // its translation is held back until they answer, unless they ask.
  const owed = stage === 'talk' && last?.who === 'them' && (
    mode === 'choose' ? pick == null : mode === 'translate' ? said == null : !ended
  ) ? last.key : null
  const reveal = key => setEarly(s => new Set(s).add(key))

  const talk = script && (
    <ol className="kaiwa-talk" ref={talkRef}>
      {lines.map(line => {
        const held = line.key === owed && !early.has(line.key)
        return (
          <SceneLine
            key={line.key}
            line={line}
            them={script.them}
            showTr={!held && Boolean(line.tr)}
            speak={line.speak}
          >
            {held && line.tr && (
              <button type="button" className="brd__link kaiwa-tr" onClick={() => reveal(line.key)}>
                {t.showTranslation}
              </button>
            )}
            {line.typed && <span className="kaiwa-typed">{line.typed}</span>}
            {line.review && <LineReview review={line.review} given={line.jp} t={t} />}
            {line.analysis && <span className="prose__ai">{line.analysis}</span>}
          </SceneLine>
        )
      })}
    </ol>
  )

  const brief = script && <Brief script={script} mode={mode} t={t} />

  // ── The foot: the one control the moment wants ──
  let foot = null
  if (stage === 'brief') {
    foot = (
      <div className="stage__foot">
        <button type="button" className="btn-primary" onClick={start} aria-keyshortcuts={desk ? 'Enter' : undefined}>
          {t.cvsStart}
          <KeyCap>{t.keyEnter}</KeyCap>
        </button>
        <EnterKey onEnter={start} />
      </div>
    )
  } else if (stage === 'over') {
    foot = (
      <div className="stage__foot btn-row">
        <button type="button" className="btn-secondary" onClick={again}>{t.cvsAgain}</button>
        <button type="button" className="btn-primary" onClick={leave} aria-keyshortcuts={desk ? 'Enter' : undefined}>
          {t.cvsOther}
          <KeyCap>{t.keyEnter}</KeyCap>
        </button>
        <EnterKey onEnter={leave} />
      </div>
    )
  } else if (stage === 'talk' && mode === 'choose') {
    foot = pick == null ? null : (
      <div className="stage__foot">
        <button type="button" className="btn-primary" onClick={next} aria-keyshortcuts={desk ? 'Enter' : undefined}>
          {script.turns[turn + 1] ? t.cvsNext : t.cvsFinish}
          <KeyCap>{t.keyEnter}</KeyCap>
        </button>
        <EnterKey onEnter={next} />
      </div>
    )
  } else if (stage === 'talk' && mode === 'translate') {
    if (said == null) {
      foot = <Field value={answer} onChange={setAnswer} onSubmit={check} label={t.cvsReplyLabel} action={t.submit} t={t} />
    } else if (!rated) {
      foot = <RatingBar active onRate={rateTranslation} />
    } else {
      foot = (
        <div className="stage__foot">
          <button type="button" className="btn-primary" onClick={next} aria-keyshortcuts={desk ? 'Enter' : undefined}>
            {script.turns[turn + 1] ? t.cvsNext : t.cvsFinish}
            <KeyCap>{t.keyEnter}</KeyCap>
          </button>
          <EnterKey onEnter={next} />
        </div>
      )
    }
  } else if (stage === 'talk' && mode === 'free') {
    const owesGrade = !waiting && !rated && last?.who === 'them' && lines.some(l => l.who === 'me')
    if (talkError === 'limit' || talkError === 'off') {
      foot = (
        <div className="stage__foot">
          <button type="button" className="btn-primary" onClick={leave}>{t.cvsOther}</button>
        </div>
      )
    } else if (owesGrade) {
      foot = <RatingBar active onRate={rateLine} />
    } else if (!waiting) {
      foot = <Field value={answer} onChange={setAnswer} onSubmit={send} label={t.cvsReplyLabel} action={t.cvsSend} t={t} />
    }
  }

  const where = script?.title ?? t.conversationTitle
  const sub = script ? `${script.level} · ${t.cvsModes[mode]}` : t.cvsModes[mode]
  // The desk's column: the scene's brief, once the talk is under way.
  // Before that the brief is the stage's own card, centred alone the
  // way a run without a side stands (StudyStage), and the talk opens
  // the panels round it; a scene that did not come keeps the empty
  // column every failed run stands (plan 123).
  const side = stage === 'talk' || stage === 'over'
    ? <DeskPane label={t.cvsGoal} className="desk-pane--kaiwa">{brief}</DeskPane>
    : stage === 'error' ? null : undefined

  return (
    <StudyStage
      color={KAIWA_COLOR}
      className="stage--sentence stage--kaiwa"
      onLeave={leave}
      leaveLabel={t.cvsLeave}
      where={where}
      sub={sub}
      // On the desk the score is the run panel's figures.
      remaining={desk ? undefined : `${score.right} / ${score.total}`}
      pass={false}
      aside={<RunStreak />}
      toast={fare.toast}
      onToastDone={fare.toastDone}
      records
      recordsLabel={t.cvsRepliesRated}
      side={side}
      sideLabel={t.cvsGoal}
    >
      {stage === 'loading' && <Loading />}

      {stage === 'error' && (
        <Empty tone="error" message={t.cvsFetchError} action={{ label: t.retry, onClick: () => { setStage('loading'); setFetches(n => n + 1) } }} />
      )}

      {stage === 'brief' && script && (
        <PromptCard page prose className="kaiwa-card">{brief}</PromptCard>
      )}

      {(stage === 'talk' || stage === 'over') && script && (
        <PromptCard page prose className="kaiwa-card">
          {!desk && (
            <ScenePlate caption={script.place.name}>
              <FuriganaParts parts={script.place.parts} />
            </ScenePlate>
          )}
          {talk}

          {stage === 'talk' && mode === 'free' && waiting && (
            <Loading inline copy={t.cvsAnswering(script.them)} className="kaiwa-pending" />
          )}
          {stage === 'talk' && mode === 'free' && talkError && (
            <p className="kaiwa-alert" role="status">
              {{ limit: t.cvsTalkLimit, off: t.cvsTalkOff, failed: t.cvsTalkFailed }[talkError]}
            </p>
          )}
          {stage === 'talk' && mode === 'free' && ended && (
            <p className="cap kaiwa-end">{ended === 'max' ? t.cvsTalkOver : t.cvsOver}</p>
          )}

          {stage === 'talk' && mode === 'choose' && pick != null && (
            <Picked step={step} pick={pick} t={t} />
          )}

          {stage === 'talk' && mode === 'translate' && said == null && (
            <p className="kaiwa-ask">
              <span className="cap">{t.cvsSay}</span>
              <span className="kaiwa-ask__line">{step.me.translation}</span>
            </p>
          )}
          {stage === 'talk' && mode === 'translate' && said != null && (
            <Checked
              step={step}
              said={said}
              measure={measure}
              tutor={tutor}
              tutorLoading={tutorLoading}
              limited={limited}
              lang={lang}
              t={t}
            />
          )}

          {stage === 'over' && (
            <div className="kaiwa-over">
              <p className="cap kaiwa-end">{t.cvsOver}</p>
              <div className="records kaiwa-over__figs">
                <div className="record">
                  <span className="record__label">{t.cvsRepliesRated}</span>
                  <span className="record__value">{score.right}<span className="record__unit">/ {score.total}</span></span>
                </div>
                <div className="record">
                  <span className="record__label">{t.deskEarned}</span>
                  <span className="record__value">+{tally.xp}<span className="record__unit">XP</span></span>
                </div>
              </div>
            </div>
          )}
        </PromptCard>
      )}

      {stage === 'talk' && mode === 'choose' && step && (
        <Choices
          items={step.choices.map(c => ({ jp: c.jp, correct: c.right }))}
          pick={pick}
          done={pick != null}
          onPick={choose}
          label={t.cvsReplyLabel}
          ja
        />
      )}

      {foot}
    </StudyStage>
  )
}

/** The scene before it starts, and beside it on the desk once it has:
 *  where, what is going on, what the learner is there to do, and what
 *  this way of riding asks. */
function Brief({ script, mode, t }) {
  return (
    <div className="kaiwa-brief">
      <ScenePlate caption={script.place.name}>
        <FuriganaParts parts={script.place.parts} />
      </ScenePlate>
      <p className="kaiwa-brief__situation">{script.situation}</p>
      <p className="kaiwa-brief__goal">
        <span className="cap">{t.cvsGoal}</span>
        <span>{script.goal}</span>
      </p>
      <p className="kaiwa-how">{t.cvsHow[mode]}</p>
    </div>
  )
}

/** The field a reply is written in, and the key that sends it: the
 *  practice runs' entry (CompositionRun's), docked on the stage's foot.
 *  An input method feeds it, so nothing rewrites what is typed. */
function Field({ value, onChange, onSubmit, label, action, t }) {
  return (
    <form className="stage__foot" onSubmit={e => { e.preventDefault(); onSubmit() }}>
      <input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t.cvsReplyPlaceholder}
        aria-label={label}
        className="field field--page"
        lang="ja"
        maxLength={200}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
      />
      <button type="submit" className="btn-primary" disabled={!value.trim()}>{action}</button>
    </form>
  )
}

/** What Choose says back: right or not, and why -- the pick's own note,
 *  and for a wrong one the reply that was right with its note. */
function Picked({ step, pick, t }) {
  const picked = step.choices[pick]
  const right = step.choices.find(c => c.right)
  return (
    <Said kind={picked.right ? 'ok' : 'no'} head={picked.right ? t.tourRight : t.tourNotQuite}>
      {!picked.right && (
        <p className="tour-said__line">
          <span className="kaiwa-said__tr">{picked.translation}</span> {picked.note}
        </p>
      )}
      {!picked.right && (
        <p className="tour-said__line tour-said__line--ja" lang="ja">
          <span className="cap">{t.cvsTheReply}</span> {right.jp}
        </p>
      )}
      <p className="tour-said__line">
        <span className="kaiwa-said__tr">{right.translation}</span> {right.note}
      </p>
    </Said>
  )
}

/** Translate's practice card, under the talk: what the learner was
 *  asked to say over the reply that says it (the model, or the
 *  alternative their answer came closest to), their answer in its well
 *  -- its misses marked when it is rōmaji, corrected in place when it is
 *  Japanese the tutor kept most of -- the tutor's verdict at the well's
 *  end, or the measure where there is none, then the notes. */
function Checked({ step, said, measure, tutor, tutorLoading, limited, lang, t }) {
  const target = measure?.target > 0 ? step.alt[measure.target - 1] : step.me
  const review = tutor?.review ?? null
  return (
    <div className="pcard-group kaiwa-check">
      <SentenceLead ask={step.me.translation} askLang={lang} parts={target.parts} text={target.jp} romaji={target.romaji} />
      <AnswerWell
        figure={review ? null : measure?.accuracy ?? null}
        figureLabel={t.pcardMatched}
        aside={review ? <TutorVerdict review={review} t={t} /> : null}
      >
        {isRomajiAnswer(said)
          ? <MarkedAnswer answer={said} reference={target.romaji} />
          : (
            <span lang="ja" className="pcard-answer">
              {review?.better && mostlyKept(said, review.better)
                ? <CorrectedInPlace given={said} parts={review.better_parts} />
                : said}
            </span>
          )}
      </AnswerWell>
      {step.me.note && <p className="kaiwa-note">{step.me.note}</p>}
      <div className="pcard-notes">
        {tutorLoading && <Loading inline copy={t.cvsReading} />}
        {!tutorLoading && limited && <span className="prose__ai">{t.cvsReviewLimit}</span>}
        {!tutorLoading && !limited && review && <TutorReview review={review} t={t} />}
        {!tutorLoading && !limited && tutor && !review && <span className="prose__ai">{tutor.analysis}</span>}
        {!tutorLoading && !limited && !tutor && <span className="prose__ai">{t.analysisUnavailable}</span>}
      </div>
    </div>
  )
}

/** What the tutor said of a free line, under it: the verdict and why,
 *  the line put right where it needed it, the fixes and what worked. */
function LineReview({ review, given, t }) {
  return (
    <div className="kaiwa-review">
      {review.better && review.better !== given && (
        <span className="kaiwa-review__better" lang="ja">
          {review.better_parts?.length ? <CorrectedInPlace given={given} parts={review.better_parts} fixes={review.fix} /> : review.better}
        </span>
      )}
      <TutorReview review={review} t={t} verdict />
    </div>
  )
}
