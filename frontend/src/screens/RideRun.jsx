import { useCallback, useEffect, useRef, useState } from 'react'
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
import { Guide } from '../components/guide/Guide'
import { Cue } from '../components/guide/Spot'
import { TOUR_BACK } from '../components/guide/rideTours'
import { HINTS } from '../domain/studyModes'
import { normalizeCard, wordForm } from '../domain/cardShape'
import { useProfileSummary } from '../stores/profileSummary'
import { startTally, countReview } from '../stores/runTally'
import { useDesk } from '../hooks/useDesk'
import { EnterKey } from '../components/chrome/DeskKeys'
import { SessionPanel } from '../components/study/SessionPanel'
import { CardPanel } from '../components/study/CardPanel'
import { LookupWatchContext } from '../components/study/lookupWatch'

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
// Plan 133 made it the lesson of the runs as they are drawn now. On a
// phone the known card, once turned, cannot be graded until the
// learner has opened its dictionary entry from the 🔍 in its corner
// and closed it again (`known-dict`): every card carries that door, and
// a door nobody is shown is one nobody finds. On the desk the ride
// stands on the three panels every card run stands on (plan 126) --
// this run's figures and the card panel at the left, the card, the
// details sealed at the right -- and, once the known card is turned,
// points at the one thing there its notes cannot: the entry docked
// beside it, the desk's 🔍 (TOUR_BACK, the gates' own guide handed one
// stop). The panels' figures, keys and rhythm are left to be found: a
// first card is not the moment for them. The ride counts its two
// ratings in the run's tally (stores/runTally) so the figures move; the tally is the screen's and is never posted.
//
// The way out is the head's ‹, labelled Skip: quiet, never a primary
// button. A returning learner who has flipped cards for years does
// not need ninety seconds of this, and whether people skip is the one
// question the feature has to answer (ride_done's `skipped`).
//
// `covered` is App's word for "the 改札 cutscene is still playing over
// the router": the ride's first paint is under that scrim, so the
// stopwatch and the known card's sound wait for it. `dryRun` is the
// workbench's (/dev/ride): no POST, `cards` may be handed in, and the
// way out is `onDone` alone -- the workbench has no /today to land on.

// Where a finished card ride goes: the reading ride (plan 099), whose
// last plate carries the lesson's stamp. Only a SKIP stamps from here,
// because a skip is the whole lesson declined.
export const RIDE_NEXT = '/ride/reading'

// The steps, as ride_step names them: known, known-back, unknown,
// unknown-back, done (stepFor below); on a phone known-dict between
// the known card's turn and its grade, and on the desk tour-back while
// the guide points at the entry.
// The rating bar's own pressed-state beat (RatingBar.PRESSED_MS): the
// seal the learner pressed stays lit while the card moves on.
const HOLD_MS = 420

function stepFor(index, answered, lookFirst = false) {
  if (index >= 2) return 'done'
  if (index === 0 && answered && lookFirst) return 'known-dict'
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
  const desk = useDesk()
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
  // A phone's known-dict step: the 🔍's sheet is open now, and it has
  // been opened and closed once.
  const [lookupOpen, setLookupOpen] = useState(false)
  const [looked, setLooked] = useState(false)
  // The desk's stop at the entry: open now, and seen or declined.
  const [tour, setTour] = useState(false)
  const [toured, setToured] = useState(false)
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

  // This run's tally, for the figures the desk's panels print.
  useEffect(() => { startTally('ride') }, [])

  useEffect(() => {
    if (given) return undefined
    let live = true
    apiJson(`/api/onboarding/ride?lang=${encodeURIComponent(lang)}`, session)
      .then(body => { if (live) setCards(body.cards ?? []) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [session, lang, given])

  // The desk docks the entry beside the card on the flip, so the 🔍
  // step is the phone's alone.
  const lookFirst = !desk && !looked
  const step = stepFor(index, answered, lookFirst)

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
      if (!dryRun) navigate('/today', { replace: true })
    })
  }

  // The lesson could not be served: never a lesson at the cost of a
  // door. Leave for the app as if skipped, without a stamp -- the
  // request that failed is the one that would carry it.
  useEffect(() => {
    if (!failed || finished.current) return
    finished.current = true
    onDone?.()
    if (!dryRun) navigate('/today', { replace: true })
  }, [failed, navigate, onDone, dryRun])

  const card = cards?.[index] ?? null
  const nc = rideCard(card, latin)

  function reveal() {
    if (answered) return
    mark(step, stepFor(index, true, lookFirst))
    setAnswered(true)
    if (latin && card?.kana) speakJapanese(card.kana)
  }

  function rate(q) {
    if (!answered || busy || step === 'known-dict') return
    countReview({ quality: q })
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

  // The 🔍's sheet, told through LookupWatchContext: closing it once is
  // what lets the known card's grade through.
  const onLookup = useCallback(open => {
    setLookupOpen(open)
    if (!open) setLooked(true)
  }, [])
  const lookedOnKnown = looked && index === 0 && answered
  useEffect(() => {
    if (lookedOnKnown && !desk) mark('known-dict', 'known-back')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookedOnKnown])

  // The desk's stop at the entry, once the known card is turned.
  const panels = desk && Boolean(cards?.length) && step !== 'done'
  const due = panels && !covered && Boolean(card) && index === 0 && answered && !tour && !toured
  useEffect(() => {
    if (!due) return
    mark(step, 'tour-back')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the stop opens once its anchor is painted, which is after this render.
    setTour(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due])
  function endTour() {
    mark('tour-back', step)
    setToured(true)
    setTour(false)
  }

  const remaining = cards ? Math.max(0, cards.length - index) : null
  const foot = { left: t.rideJp, right: t.rideCap }
  const callouts = {
    'known':        { anchor: 'ride.card', place: 'top',   text: (desk && t.rideKnownFrontDesk) || t.rideKnownFront },
    'known-dict':   { anchor: 'card.lookup', place: 'below', text: t.rideKnownDict },
    'known-back':   { anchor: 'ride.rate', place: 'above', text: (desk && t.rideKnownBackDesk) || t.rideKnownBack },
    'unknown':      { anchor: 'ride.card', place: 'top',   text: (desk && t.rideUnknownFrontDesk) || t.rideUnknownFront },
    'unknown-back': { anchor: 'ride.rate', place: 'above', text: (desk && t.rideUnknownBackDesk) || t.rideUnknownBack },
  }
  const callout = !covered && !tour && !lookupOpen && card && callouts[step]
  // The one thing each note asks for, lit (guide/Spot.jsx): the card to turn,
  // the 🔍 to open, the bar to grade on -- and on the new card its
  // Wrong tile alone, which is Wrong's quality (1) on every scale. The
  // learner follows the light and never has to look for the next press.
  const bar = '[data-guide="ride.rate"]'
  const cues = {
    'known':        { target: '[data-guide="ride.card"]', radius: 'card' },
    'known-dict':   { target: '[data-guide="card.lookup"]', radius: 'pill' },
    'known-back':   { target: `${bar} .rating-bar__buttons`, radius: 'card' },
    'unknown':      { target: '[data-guide="ride.card"]', radius: 'card' },
    'unknown-back': { target: `${bar} .rating-bar__btn--q1`, radius: 'card' },
  }
  const cue = callout && cues[step]

  return (
    <StudyStage
      color="var(--line-vocab)"
      onLeave={() => finish(true)}
      leaveLabel={t.rideSkip}
      where={t.rideJp}
      sub={t.rideCap}
      remaining={step === 'done' ? undefined : remaining}
      className="ride"
      // 机 (plan 133): a card run's three panels (plan 126) -- this
      // run's figures and the card panel at the left, the details at
      // the right, sealed until the flip docks the card's entry there,
      // where a phone looks it up from 🔍. Nothing beside the done
      // room, and no misses: two cards are not a list.
      records={panels}
      panel={panels && card ? <CardPanel card={card} remaining={remaining} keys="ride" /> : null}
      side={panels ? <SessionPanel misses={false} /> : undefined}
      sideLabel={t.dictionaryTitle}
    >
      {!cards && !failed && <Loading />}

      {card && step !== 'done' && (
        <>
          {/* `guide` names the two anchors the notes point at (the
              CardTransition's and the RatingBar's own roots), so both
              stay DIRECT children of .stage -- the phone dock's
              `.stage > .rating-bar` and the card's floor depend on it. */}
          <CardTransition className="vocab-card-boost" cardKey={card.card_id} guide="ride.card">
            <LookupWatchContext.Provider value={onLookup}>
              <CardPrompt
                card={nc} t={t} session={session}
                answered={answered} cardNonce={0}
                activeHints={latin ? [HINTS.FURIGANA] : []}
                onFlashcardReveal={reveal}
                foot={foot}
              />
            </LookupWatchContext.Provider>
          </CardTransition>
          <RatingBar active={answered && !busy && step !== 'known-dict'} onRate={rate} guide="ride.rate" />
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
            <Continue keys label={t.rideContinue} onClick={() => finish(false)} disabled={busy} />
            {/* 机 (plan 122): Enter goes on, as the key printed says. */}
            <EnterKey onEnter={() => finish(false)} disabled={busy} />
          </div>
        </div>
      )}

      {cue && <Cue target={cue.target} radius={cue.radius} />}
      {callout && <Callout anchor={callout.anchor} place={callout.place} text={callout.text} />}
      {tour && <Guide gate="ride" stops={TOUR_BACK} onEnd={endTour} />}
    </StudyStage>
  )
}
