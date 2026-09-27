import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { apiFetch, apiJson } from '../lib/api'
import { track } from '../lib/track'
import { stopwatch } from '../lib/dwell'
import { StudyStage } from '../components/study/StudyStage'
import PromptCard from '../components/study/PromptCard'
import RatingBar from '../components/study/RatingBar'
import { Loading } from '../components/ui/Loading'
import { Continue } from '../components/boarding/BoardFrame'
import { Callout } from '../components/guide/Callout'
import { Guide } from '../components/guide/Guide'
import { TOUR_READ, TOUR_GRADED } from '../components/guide/rideTours'
import { OfferButton } from '../components/credits/OfferButton'
import { ReadingTimer, ReadingPrompt, AnswerForm, ReadingRegisters } from '../components/reading/ReadingPieces'
import { RunLines } from '../components/study/RunLines'
import { useSentenceKeys, currentLine } from '../components/study/sentenceLines'
import { BreakdownSide } from '../components/analysis/BreakdownSide'
import { vocabLookup, grammarLookup } from '../components/analysis/lookup'
import { PASS_PLATFORMS, SOURCES } from '../domain/paywall'
import { getAllSections } from '../config/tabs'
import { useCredits } from '../stores/credits'
import { startTally, countReview } from '../stores/runTally'
import { EnterKey } from '../components/chrome/DeskKeys'
import { useDesk } from '../hooks/useDesk'
import { paceFactor } from '../domain/readingPace'
import { useReadingPace } from '../stores/readingPace'

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
//
// 机 (plan 133): on the desk the ride stands on the practice runs'
// three panels (plan 129) -- this run's figures and its lines at the
// left, the sentence in the middle, the breakdown sealed at the right
// until the grade -- and walks the learner round them before the clock
// starts (`intro`, TOUR_READ), then, once graded, opens the sentence's
// breakdown there (`graded`: the local tier of /api/phrase/analyze,
// free and cached, never the paid explanation) and points at it and at
// the line the sentence became (TOUR_GRADED) before the plate. A phone
// keeps the ride it had.
const READING_COLOR = 'var(--line-reading)'
// The steps, as ride_step names them: read, type, measure, pass; on the
// desk intro before read and graded between measure and pass.

export default function RideReading({ session, onDone, dryRun = false, sentence: given = null }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const credits = useCredits()
  const desk = useDesk()
  const keys = useSentenceKeys()

  const [sentence, setSentence] = useState(given)
  const [failed, setFailed] = useState(false)
  // The desk opens on its walk, with the clock held; a phone on the
  // sentence. Decided once: the ride does not change chrome under the
  // learner.
  const [step, setStep] = useState(() => (desk ? 'intro' : 'read'))
  // null until the sentence is up: a clock that starts at zero would
  // read as already run out, and cover the sentence before it showed.
  const [timeLeft, setTimeLeft] = useState(null)
  // The learner's reading pace, as the reading run keeps it: timeLeft in
  // the server's seconds, the clock run 1/factor as fast, and no clock
  // at all for a null factor (a ride taken again from Settings › Help).
  const factor = paceFactor(useReadingPace())
  const [answer, setAnswer] = useState('')
  const [accuracy, setAccuracy] = useState(null)
  const [correct, setCorrect] = useState(null)
  const [quality, setQuality] = useState(null)
  const [busy, setBusy] = useState(false)
  // The desk's breakdown, and a door opened in it.
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [lookup, setLookup] = useState(null)
  const closeLookup = useCallback(() => setLookup(null), [])
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

  // This run's tally, for the figures the desk's panels print.
  useEffect(() => { startTally('ride-reading') }, [])

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
    if (factor == null) return undefined
    const tick = 0.1 / factor
    timer.current = setInterval(() => {
      setTimeLeft(prev => (prev - tick <= 0 ? 0 : prev - tick))
    }, 100)
    return undefined
  }, [sentence, step, factor])
  useEffect(() => () => clearInterval(timer.current), [])
  const covered = (step === 'read' || step === 'type') && sentence != null && factor != null && timeLeft !== null && timeLeft <= 0
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

  // The breakdown, fetched as the reading run fetches it the moment its
  // sentence shows: the desk's alone, since a phone draws none.
  function fetchAnalysis(phrase) {
    if (dryRun) return
    setAnalysisLoading(true)
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase, save: false, deep: false, lang }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setAnalysis(d))
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false))
  }

  function submit() {
    if (!answer.trim() || (step !== 'read' && step !== 'type')) return
    clearInterval(timer.current)
    timer.current = null
    go('measure')
    if (desk) fetchAnalysis(sentence.phrase)
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
    setQuality(q)
    countReview({ quality: q })
    go(desk ? 'graded' : 'pass')
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

  // The desk's second walk, once: the breakdown the grade opened.
  const [gradedToured, setGradedToured] = useState(false)
  const tour = !sentence ? null
    : step === 'intro' ? TOUR_READ
    : step === 'graded' && !gradedToured ? TOUR_GRADED
    : null
  function endTour() {
    if (step === 'intro') go('read')
    else setGradedToured(true)
  }

  const foot = { left: t.rideJp, right: t.readingTitle }
  const platforms = getAllSections(t).filter(s => Object.values(PASS_PLATFORMS).includes(s.path))
  const callouts = {
    // Untimed, nothing hides: the one callout says both halves.
    read:    { anchor: 'ride.sentence', place: 'top',   text: factor == null ? t.rideReadFrontUntimed : t.rideReadFront },
    type:    { anchor: 'ride.answer',   place: 'above', text: t.rideReadType },
    measure: { anchor: 'ride.rate',     place: 'above', text: (desk && t.rideReadMeasureDesk) || t.rideReadMeasure },
  }
  const callout = sentence && callouts[step]

  const writing = step === 'intro' || step === 'read' || step === 'type'
  const graded = step === 'graded'
  const panels = desk && Boolean(sentence) && step !== 'pass'
  const measured = step === 'measure' || graded

  return (
    <StudyStage
      color={READING_COLOR}
      onLeave={() => finish(true)}
      leaveLabel={t.rideSkip}
      where={t.rideJp}
      sub={t.readingTitle}
      pass={false}
      className="ride ride--reading"
      // 机 (plan 133): a practice run's three panels (plan 129). The
      // one sentence is the lines' current row, an ellipsis until the
      // answer is in; the lines are a record, not doors -- there is no
      // other sentence to reopen.
      records={panels}
      recordsLabel={t.deskLinesRated}
      panel={panels ? (
        <RunLines current={currentLine(measured ? sentence.phrase : null, quality)} keys={keys} />
      ) : null}
      side={panels ? (
        <BreakdownSide
          graded={graded}
          analysis={analysis}
          loading={analysisLoading}
          translation={sentence.translation}
          sentenceText={sentence.phrase}
          onTokenClick={w => setLookup(vocabLookup(w))}
          onGrammarOpen={g => setLookup(grammarLookup(g))}
          lookup={lookup}
          onExitLookup={closeLookup}
          session={session}
        />
      ) : undefined}
      sideLabel={t.deskBreakdownLabel}
    >
      {!sentence && !failed && <Loading />}

      {sentence && writing && (
        <>
          <ReadingTimer
            timeLeft={(timeLeft ?? sentence.display_seconds) * (factor ?? 1)}
            total={sentence.display_seconds * (factor ?? 1)}
            covered={covered}
            untimed={factor == null}
            t={t}
          />
          {/* Covered while the walk is open: its clock has not started,
              and a sentence left showing under it is free time. */}
          <ReadingPrompt cardKey="ride" foot={foot} phrase={sentence.phrase} covered={covered || step === 'intro'} guide="ride.sentence" />
          <AnswerForm answer={answer} setAnswer={setAnswer} onSubmit={submit} t={t} guide="ride.answer" />
        </>
      )}

      {sentence && measured && (
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
          {graded ? (
            <div className="stage__foot">
              <Continue keys label={t.rideContinue} onClick={() => go('pass')} />
              <EnterKey onEnter={() => go('pass')} disabled={Boolean(tour)} />
            </div>
          ) : (
            <RatingBar active onRate={rate} guide="ride.rate" />
          )}
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
      {tour && <Guide key={step} gate="ride" stops={tour} onEnd={endTour} />}
    </StudyStage>
  )
}
