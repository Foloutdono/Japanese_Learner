import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { apiJson } from '../lib/api'
import { track } from '../lib/track'
import { stopwatch } from '../lib/dwell'
import { speakJapanese } from '../lib/audio'
import { StudyStage } from '../components/study/StudyStage'
import { CardTransition } from '../components/study/CardTransition'
import CardPrompt from '../components/study/CardPrompt'
import RatingBar from '../components/study/RatingBar'
import { Loading } from '../components/ui/Loading'
import { Emphasized } from '../components/ui/Emphasized'
import { Continue } from '../components/boarding/BoardFrame'
import { Callout } from '../components/guide/Callout'
import { HINTS } from '../domain/studyModes'
import { normalizeCard, wordForm } from '../domain/cardShape'
import { useProfileSummary } from '../stores/profileSummary'

// ── 試乗 — the test ride (plan 098) ──────────────────────────────
// The learner's first two flashcards, on the real stage: the same
// StudyStage, CardPrompt, CardTransition and RatingBar every run uses,
// fed two literal cards the ticket office serves (GET
// /api/onboarding/ride — plan 097) and writing nothing. One card they
// know (こんにちは) so the flip and the rating make sense; one they
// cannot (a station word a stop above their level) so rating it WRONG
// is shown to be the method rather than a failure.
//
// Nothing here is a review. No session hook, no review gates, no
// fare (lib/reviews): the rating is local state, the card is never
// scheduled, no XP lands, no credit is spent -- the ride borrows the
// bar the way the reading and translation runs do, to collect a
// self-rating and nothing more. The first real card is the one behind
// the 改札. The one thing posted is the stamp at the end
// (POST /api/onboarding/ride/done), finished or skipped alike, so the
// index route stops sending the learner here.
//
// The way out is the head's ‹, labelled Skip: quiet, never a primary
// button. A returning learner who has flipped cards for years does
// not need ninety seconds of this, and whether people skip is the one
// question the feature has to answer (ride_done's `skipped`).
//
// `covered` is App's word for "the 改札 cutscene is still playing over
// the router": the ride's first paint is under that scrim, so the
// stopwatch and the known card's sound wait for it. `dryRun` is the
// workbench's (/dev/ride): no POST, and `cards` may be handed in.

// Where a finished card ride goes: the reading ride (plan 099), whose
// last plate carries the lesson's stamp. Only a SKIP stamps from here,
// because a skip is the whole lesson declined.
export const RIDE_NEXT = '/ride/reading'

// The steps, as ride_step names them: known, known-back, unknown,
// unknown-back, done (stepFor below).
// The rating bar's own pressed-state beat (RatingBar.PRESSED_MS): the
// seal the learner pressed stays lit while the card moves on.
const HOLD_MS = 420

function stepFor(index, answered) {
  if (index >= 2) return 'done'
  return `${index === 0 ? 'known' : 'unknown'}${answered ? '-back' : ''}`
}

/** The card as CardPrompt wants it, with the romaji riding on it for
 *  a learner who does not yet read kana: the furigana hint's own
 *  parts, so the ruby is the reading in letters they can read. */
function rideCard(card, latin) {
  if (!card) return null
  const nc = normalizeCard(card)
  if (!latin || !card.romaji) return nc
  return {
    ...nc,
    // The back's reading line too: えき alone is one more thing this
    // learner cannot read yet, so the letters ride beside it.
    kana: nc.kana && nc.kana !== wordForm(nc) ? `${nc.kana} ${card.romaji}` : nc.kana,
    hints: { ...(nc.hints ?? {}), [HINTS.FURIGANA]: [{ text: wordForm(nc), reading: card.romaji }] },
  }
}

export default function RideRun({ session, onDone, onNext = null, covered = false, dryRun = false, cards: given = null }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const summary = useProfileSummary()
  // "No kana" or "katakana only": neither reads the hiragana on the
  // known card, so the reading rides on it in Latin letters and is
  // spoken on the flip.
  const latin = summary?.kanaKnown != null && summary.kanaKnown !== 'both' && summary.kanaKnown !== 'hiragana'

  const [cards, setCards] = useState(given)
  const [failed, setFailed] = useState(false)
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [guessed, setGuessed] = useState(false)
  const [busy, setBusy] = useState(false)
  const watches = useRef(null)
  const holdTimer = useRef(null)
  const finished = useRef(false)

  useEffect(() => {
    document.title = `${t.rideDocumentTitle} — ${t.appTitle}`
  }, [t])

  // The two stopwatches the boarding keeps (lib/dwell.js): engaged
  // time per step and for the whole ride. Started once the cutscene
  // has lifted -- a minute under a scrim is not a minute on a card.
  useEffect(() => {
    if (covered || watches.current) return undefined
    watches.current = { total: stopwatch(), step: stopwatch() }
    const w = watches.current
    return () => { w.total.stop(); w.step.stop(); watches.current = null }
  }, [covered])

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  useEffect(() => {
    if (given) return undefined
    let live = true
    apiJson(`/api/onboarding/ride?lang=${encodeURIComponent(lang)}`, session)
      .then(body => { if (live) setCards(body.cards ?? []) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [session, lang, given])

  const step = stepFor(index, answered)

  function mark(from, to) {
    track('ride_step', { step: from, to, dir: 'fwd', ms: watches.current?.step.lap() ?? 0 })
  }

  function finish(skipped) {
    if (finished.current) return
    finished.current = true
    setBusy(true)
    if (!skipped) {
      // On to the reading ride; the lesson's stamp is its plate's.
      mark(step, 'reading')
      if (onNext) onNext()
      else navigate(RIDE_NEXT, { replace: true })
      return
    }
    track('ride_done', { skipped: true, at: 'cards', ms: watches.current?.total.read() ?? 0 })
    const stamped = dryRun
      ? Promise.resolve()
      : apiJson('/api/onboarding/ride/done', session, {
          method: 'POST', body: JSON.stringify({ skipped: true }),
        }).catch(() => {})
    // A stamp that could not land is not a reason to hold the door:
    // the ride shows again next launch, which costs a learner one more
    // Skip and nothing else.
    stamped.then(() => {
      onDone?.()
      navigate('/today', { replace: true })
    })
  }

  // The lesson could not be served: never a lesson at the cost of a
  // door. Leave for the app as if skipped, without a stamp -- the
  // request that failed is the one that would carry it.
  useEffect(() => {
    if (!failed || finished.current) return
    finished.current = true
    onDone?.()
    navigate('/today', { replace: true })
  }, [failed, navigate, onDone])

  const card = cards?.[index] ?? null
  const nc = rideCard(card, latin)

  function reveal() {
    if (answered) return
    mark(step, stepFor(index, true))
    setAnswered(true)
    if (latin && card?.kana) speakJapanese(card.kana)
  }

  function rate(q) {
    if (!answered || busy) return
    // The second card is the lesson: a wrong on it is the method, and
    // anything else is a guess the done screen answers gently.
    if (index === 1 && q > 2) setGuessed(true)
    mark(step, stepFor(index + 1, false))
    setBusy(true)
    holdTimer.current = setTimeout(() => {
      setIndex(i => i + 1)
      setAnswered(false)
      setBusy(false)
    }, HOLD_MS)
  }

  const remaining = cards ? Math.max(0, cards.length - index) : null
  const foot = { left: t.rideJp, right: t.rideCap }
  const callouts = {
    'known':        { anchor: 'ride.card', place: 'top',   text: t.rideKnownFront },
    'known-back':   { anchor: 'ride.rate', place: 'above', text: t.rideKnownBack },
    'unknown':      { anchor: 'ride.card', place: 'top',   text: t.rideUnknownFront },
    'unknown-back': { anchor: 'ride.rate', place: 'above', text: t.rideUnknownBack },
  }
  const callout = !covered && card && callouts[step]

  return (
    <StudyStage
      color="var(--line-vocab)"
      onLeave={() => finish(true)}
      leaveLabel={t.rideSkip}
      where={t.rideJp}
      sub={t.rideCap}
      remaining={step === 'done' ? undefined : remaining}
      className="ride"
    >
      {!cards && !failed && <Loading />}

      {card && step !== 'done' && (
        <>
          {/* `guide` names the two anchors the notes point at (the
              CardTransition's and the RatingBar's own roots), so both
              stay DIRECT children of .stage -- the phone dock's
              `.stage > .rating-bar` and the card's floor depend on it. */}
          <CardTransition className="vocab-card-boost" cardKey={card.card_id} guide="ride.card">
            <CardPrompt
              card={nc} t={t} session={session}
              answered={answered} cardNonce={0}
              activeHints={latin ? [HINTS.FURIGANA] : []}
              onFlashcardReveal={reveal}
              foot={foot}
            />
          </CardTransition>
          <RatingBar active={answered && !busy} onRate={rate} guide="ride.rate" />
        </>
      )}

      {step === 'done' && (
        <div className="ride__done" data-guide="ride.done">
          <p className="ride__done-text">
            <Emphasized text={t.rideDoneBody(summary?.dailyNewTarget ?? 10)} />
          </p>
          {guessed && <p className="ride__done-note">{t.rideGuessed}</p>}
          <div className="ride__done-air" aria-hidden="true" />
          <div className="ride__done-foot">
            <Continue label={t.rideContinue} onClick={() => finish(false)} disabled={busy} />
          </div>
        </div>
      )}

      {callout && <Callout anchor={callout.anchor} place={callout.place} text={callout.text} />}
    </StudyStage>
  )
}
