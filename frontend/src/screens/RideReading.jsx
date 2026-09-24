import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { apiJson } from '../lib/api'
import { track } from '../lib/track'
import { stopwatch } from '../lib/dwell'
import { StudyStage } from '../components/study/StudyStage'
import PromptCard from '../components/study/PromptCard'
import RatingBar from '../components/study/RatingBar'
import { Loading } from '../components/ui/Loading'
import { Continue } from '../components/boarding/BoardFrame'
import { Callout } from '../components/guide/Callout'
import { OfferButton } from '../components/credits/OfferButton'
import { ReadingTimer, ReadingPrompt, AnswerForm, ReadingRegisters } from '../components/reading/ReadingPieces'
import { PASS_PLATFORMS, SOURCES } from '../domain/paywall'
import { getAllSections } from '../config/tabs'
import { useCredits } from '../stores/credits'
import { EnterKey } from '../components/chrome/DeskKeys'
import { useDesk } from '../hooks/useDesk'

// ── 試乗 — the reading ride (plan 099) ───────────────────────────
// The second half of the lesson, on the reading stage: one curated N5
// sentence served by the ticket office (GET /api/onboarding/ride's
// `sentence`), the clock, the field, the measure and the rating, drawn
// with the reading run's own pieces (components/reading/ReadingPieces)
// -- and then the plate, which is why the owner wanted this ride for
// everyone: the platforms that ride on the 定期券, listed from the
// same map the server enforces (domain/paywall.PASS_PLATFORMS), with
// the offer under it and, while nothing is enforced, the line saying
// the platforms are open meanwhile.
//
// Nothing here is a result: /api/reading/result is never posted, no
// card is scheduled, and the measure is the ticket office's own
// (POST /api/onboarding/ride/check, against this sentence only) rather
// than the pass-gated reading router's. The one write is the lesson's
// stamp on "Enter the station" -- or on Skip, the same stamp: a
// learner who skipped is not asked again.
const READING_COLOR = 'var(--line-reading)'
// The steps, as ride_step names them: read, type, measure, pass.

export default function RideReading({ session, onDone, dryRun = false, sentence: given = null }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const credits = useCredits()
  const desk = useDesk()

  const [sentence, setSentence] = useState(given)
  const [failed, setFailed] = useState(false)
  const [step, setStep] = useState('read')
  // null until the sentence is up: a clock that starts at zero would
  // read as already run out, and cover the sentence before it showed.
  const [timeLeft, setTimeLeft] = useState(null)
  const [answer, setAnswer] = useState('')
  const [accuracy, setAccuracy] = useState(null)
  const [correct, setCorrect] = useState(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)
  const watches = useRef(null)
  const finished = useRef(false)

  useEffect(() => {
    document.title = `${t.rideDocumentTitle} — ${t.appTitle}`
  }, [t])

  useEffect(() => {
    watches.current = { total: stopwatch(), step: stopwatch() }
    const w = watches.current
    return () => { w.total.stop(); w.step.stop(); watches.current = null }
  }, [])

  useEffect(() => {
    if (given) return undefined
    let live = true
    apiJson(`/api/onboarding/ride?lang=${encodeURIComponent(lang)}`, session)
      .then(body => { if (live) setSentence(body.sentence ?? null) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [session, lang, given])

  // The clock, as the reading run keeps it: the sentence is covered at
  // zero and writing is open the whole time.
  useEffect(() => {
    if (!sentence || step !== 'read' && step !== 'type') return undefined
    if (timer.current) return undefined
    setTimeLeft(sentence.display_seconds)
    timer.current = setInterval(() => {
      setTimeLeft(prev => (prev - 0.1 <= 0 ? 0 : prev - 0.1))
    }, 100)
    return undefined
  }, [sentence, step])
  useEffect(() => () => clearInterval(timer.current), [])
  const covered = (step === 'read' || step === 'type') && sentence != null && timeLeft !== null && timeLeft <= 0
  // The clock running out is the step turning from reading to writing.
  useEffect(() => {
    if (covered && step === 'read') go('type')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [covered])

  function mark(from, to) {
    track('ride_step', { step: from, to, dir: 'fwd', ms: watches.current?.step.lap() ?? 0 })
  }
  function go(next) {
    mark(step, next)
    setStep(next)
  }

  function submit() {
    if (!answer.trim() || (step !== 'read' && step !== 'type')) return
    clearInterval(timer.current)
    timer.current = null
    go('measure')
    if (!dryRun) {
      apiJson('/api/onboarding/ride/check', session, {
        method: 'POST', body: JSON.stringify({ answer: answer.trim() }),
      })
        .then(m => setAccuracy(typeof m?.accuracy === 'number' ? m.accuracy : null))
        .catch(() => {})   // the figure is a hint, not the ride
    }
  }

  function rate(q) {
    if (step !== 'measure' || correct !== null) return
    setCorrect(q >= 3)
    go('pass')
  }

  function finish(skipped) {
    if (finished.current) return
    finished.current = true
    setBusy(true)
    track('ride_done', { skipped, at: 'reading', ms: watches.current?.total.read() ?? 0 })
    const stamped = dryRun
      ? Promise.resolve()
      : apiJson('/api/onboarding/ride/done', session, {
          method: 'POST', body: JSON.stringify({ skipped }),
        }).catch(() => {})
    stamped.then(() => {
      onDone?.()
      navigate('/today', { replace: true })
    })
  }

  useEffect(() => {
    if (!failed || finished.current) return
    finished.current = true
    onDone?.()
    navigate('/today', { replace: true })
  }, [failed, navigate, onDone])

  const foot = { left: t.rideJp, right: t.readingTitle }
  const platforms = getAllSections(t).filter(s => Object.values(PASS_PLATFORMS).includes(s.path))
  const callouts = {
    read:    { anchor: 'ride.sentence', place: 'top',   text: t.rideReadFront },
    type:    { anchor: 'ride.answer',   place: 'above', text: t.rideReadType },
    measure: { anchor: 'ride.rate',     place: 'above', text: (desk && t.rideReadMeasureDesk) || t.rideReadMeasure },
  }
  const callout = sentence && callouts[step]

  return (
    <StudyStage
      color={READING_COLOR}
      onLeave={() => finish(true)}
      leaveLabel={t.rideSkip}
      where={t.rideJp}
      sub={t.readingTitle}
      pass={false}
      className="ride ride--reading"
    >
      {!sentence && !failed && <Loading />}

      {sentence && (step === 'read' || step === 'type') && (
        <>
          <ReadingTimer timeLeft={timeLeft ?? sentence.display_seconds} total={sentence.display_seconds} covered={covered} t={t} />
          <ReadingPrompt cardKey="ride" foot={foot} phrase={sentence.phrase} covered={covered} guide="ride.sentence" />
          <AnswerForm answer={answer} setAnswer={setAnswer} onSubmit={submit} t={t} guide="ride.answer" />
        </>
      )}

      {sentence && step === 'measure' && (
        <>
          <PromptCard prose foot={{ left: t.rideJp, right: <>{t.readingGrammarPoint} · <span lang="ja">{sentence.grammar}</span></> }}>
            <ReadingRegisters
              phrase={sentence.phrase}
              romaji={sentence.romaji}
              translation={sentence.translation}
              translationLang={sentence.translation_lang}
              answer={answer}
              accuracy={accuracy}
              correct={correct}
              t={t}
            />
          </PromptCard>
          <RatingBar active onRate={rate} guide="ride.rate" />
        </>
      )}

      {step === 'pass' && (
        <div className="ride__done ride__plate" data-guide="ride.plate">
          <p className="ride__plate-cap">{t.ridePlateCap}</p>
          <p className="ride__done-text">{t.ridePlateBody}</p>
          <ul className="ride__plate-list">
            {platforms.map(s => (
              <li key={s.path} className="ride__plate-item" style={{ '--line-color': s.color }}>
                <span className="ride__plate-icon" lang="ja">{s.icon}</span>
                <span className="ride__plate-title">{s.title}</span>
              </li>
            ))}
          </ul>
          {!credits?.enforced && <p className="ride__done-note">{t.ridePlateOpen}</p>}
          <div className="ride__done-air" aria-hidden="true" />
          <div className="ride__done-foot">
            <OfferButton source={SOURCES.RIDE} className="pw-open--quiet" />
            <Continue keys label={t.brdEnter} onClick={() => finish(false)} disabled={busy} data-action="enter" />
            {/* 机 (plan 122): Enter goes on, as the key printed says. */}
            <EnterKey onEnter={() => finish(false)} disabled={busy} />
          </div>
        </div>
      )}

      {callout && <Callout anchor={callout.anchor} place={callout.place} text={callout.text} />}
    </StudyStage>
  )
}
