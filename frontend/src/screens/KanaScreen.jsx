import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { TopBar } from '../components/ui/TopBar'
import RatingBar from '../components/study/RatingBar'
import {
  CharDisplay, MCQGrid, DoneMessage,
  DeckProgress, Flashcard, RevealActions, TypeInput,
} from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import HintBar from '../components/study/HintBar'
import { DrawingQuiz } from '../components/study/DrawingCanvas'
import { Loading } from '../components/ui/Loading'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import PromptCard from '../components/study/PromptCard'
import SelectionScreen from '../components/selection/SelectionScreen'
import ModeSelector from '../components/selection/ModeSelector'
import ReviewDeck from '../components/study/ReviewDeck'
import SessionError from '../components/study/SessionError'
import { playKana } from '../lib/audio'
import {
  MODES as STUDY_MODES, RENDER, HINTS, FAST_REVIEW,
  modePickerEntries, modeLabel,
} from '../domain/studyModes'
import { romajiEquals } from '../lib/romaji'
import { kanaSets } from '../domain/kanaSets'
import { applyXpGain } from '../stores/profileSummary'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'
import { rewardTier } from '../domain/rewardTier'

// The 8s fetch timeout that used to live here is gone: useCardSession
// owns the abort signal and the timeout now (10s, matched to the cold
// start it was always meant to bridge), so the five screens no longer
// each hand-roll a controller that only ever timed out and never
// aborted on unmount.

export default function KanaScreen({ session }) {
  const navigate    = useNavigate()
  const { t } = useLang()

  // Map translated labels → API slugs.
  //
  // `sample` is the first row of each set, and it is the only thing on
  // this screen that answers the question actually being asked. "Kana
  // (combinations)" names a set without showing one; きゃ きゅ きょ
  // shows it, in the script you came here to learn, and needs no
  // translating into either language the app speaks. It's the 停車駅
  // strip under a destination — the stops this service actually makes.
  const SETS = kanaSets(t)

  // Straight from the registry — one definition of what kana offers,
  // shared with the backend's own (see domain/studyModes.js).
  const MODES = modePickerEntries(t, 'kana')

  const [selectedSet, setSelectedSet] = useState(null) // { label, slug }
  const [mode, setMode]               = useState(null)
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  // Hints switched on for the card in hand. Reset per card, so asking for
  // the options on one hard card doesn't quietly turn the rest of the
  // session into multiple choice.
  const [activeHints, setActiveHints] = useState([])
  const [typed, setTyped]             = useState('')
  const [showRating, setShowRating]   = useState(false)
  const [progress, setProgress]       = useState(null)
  const [xpToast, setXpToast]         = useState(null)
  const [cardStamp, setCardStamp]     = useState(null)
  const [locked, setLocked]           = useState(false)
  const [reviewing, setReviewing]     = useState(false)
  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)

  // Gates that must all clear before the deck is allowed to move on
  // to the next card: the review request itself, plus whichever of
  // the XP toast / stage stamp actually end up showing. Kept in a
  // ref, not state — nothing needs to re-render off it, it's only
  // ever read at the moment a gate closes, to decide whether
  // advance() can finally run.
  const pendingGatesRef = useRef(new Set())
  // Guards against advancing twice for the same review. Gates can
  // reach empty more than once per review — e.g. the toast's own
  // gate is now released as soon as we know it's safe to move on
  // (see postReview), but the toast keeps animating and still calls
  // its onDone → checkAdvance() later, by which point the gate set is
  // already empty again. A ref (not state) so the guard is set the
  // instant advance() fires, with no render/closure lag to race.
  const advancedRef = useRef(false)


  // One session per deck+mode — batched and cached so answering never
  // waits on a fetch, and a backend cold start doesn't blank the
  // screen (see useCardSession for the full rationale). storageKey
  // stays a stable 'idle' placeholder until a set+mode is chosen; the
  // hook itself is always called (rules of hooks), it just has
  // nothing to fetch yet.
  const storageKey = selectedSet && mode
    ? sessionKey('kana', selectedSet.slug, mode)
    : IDLE_KEY

  // apiJson, not apiFetch: a non-2xx now throws instead of resolving to
  // a body with no `cards` key, which the hook used to read as "deck
  // finished" and celebrate. The hook owns the abort signal and the
  // timeout, so there's no controller to hand-roll here any more.
  const paceCtl = usePace(storageKey)
  const { capture: capturePace, query: paceQuery } = paceCtl

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!selectedSet || !mode) return []
    const data = capturePace(await apiJson(
      `/api/kana/cards?set_name=${encodeURIComponent(selectedSet.slug)}&mode=${mode}&count=${count}&exclude=${excludeIds.join(',')}${paceQuery}`,
      session,
      { signal },
    ))
    return data.cards ?? []
  }, [selectedSet, mode, session, paceQuery, capturePace])

  const { current: card, loading, done, error, retry, advance } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
    mode,
  })

  // Reset per-card UI state whenever the card in hand changes —
  // advance() is a synchronous local pop now, so there's no fetch
  // callback to hang this reset off of like there used to be.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`answered` are also set mid-flow elsewhere in this screen (e.g. hidden immediately on a rating tap, before the card actually advances) — see the other setShowRating/setAnswered call sites below. Moving this into a key-remounted child would need that mid-flow logic threaded back down too, a bigger restructure than this reset justifies.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setActiveHints([])
    setTyped('')
  }, [card?.card_id])

  // ── Leaving a card mid-flight must not strand the next one ──────
  // `locked`, the gate set and the celebration state are per-REVIEW,
  // but they live on the screen, which survives stepping back to the
  // picker and coming in again. Walk out while a stamp is playing and
  // its gate is still in the set on the way back — with no stamp
  // playing to take it out, the queue never advances and `locked`
  // never lifts. postReview hides the rating bar the instant a rating
  // is tapped, so the card sits revealed with no way forward and no
  // way to rate it again: reported from production on a kana card, and
  // reproduced in KanaScreen.stuck.browser.test.jsx.
  //
  // storageKey is the session's own identity (deck/level/set + mode),
  // so this fires exactly when the session changes and never mid-card.
  useEffect(() => {
    pendingGatesRef.current.clear()
    advancedRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the same id-keyed-reset shape as the per-card effect beside it, and for the same reason: `locked` and the two celebration states are also set mid-flow by postReview, so a key-remounted child would need that flow threaded back down.
    setLocked(false)
    setXpToast(null)
    setCardStamp(null)
  }, [storageKey])

  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // set+mode. Fetched independently from the card so it never blocks
  // or slows down card navigation.
  function loadProgress(slug, m) {
    apiFetch(`/api/kana/stats?set_name=${encodeURIComponent(slug)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startSession(set) {
    setSelectedSet(set)
    setMode(null)
  }

  function startMode(m) {
    setMode(m)
    loadProgress(selectedSet.slug, m)
  }

  // Fetches the full set of already-studied cards once — see
  // ReviewDeck for why this doesn't go through useCardSession (no due
  // queue, no refill, just a fixed list to flip through).
  function startReview() {
    setReviewing(true)
    setReviewLoading(true)
    apiFetch(`/api/kana/review-cards?set_name=${encodeURIComponent(selectedSet.slug)}`, session)
      .then(r => r.json())
      .then(data => setReviewCards(data.cards ?? []))
      .catch(() => setReviewCards([]))
      .finally(() => setReviewLoading(false))
  }

  // advance() only ever runs once every gate above has cleared — see
  // pendingGatesRef — and only once per review, even if the gate set
  // empties out more than once (see advancedRef above).
  function checkAdvance() {
    if (pendingGatesRef.current.size === 0 && !advancedRef.current) {
      advancedRef.current = true
      advance()
      setLocked(false)
    }
  }

  function postReview(quality) {
    // Locked the instant a rating is picked, until the card is
    // actually replaced — covers the XP toast (including an
    // indefinite level-up hold) and any stage stamp, so nothing can
    // land on a card that's already mid-celebration, and a second tap
    // can't fire a review twice.
    if (locked) return
    setLocked(true)
    setShowRating(false)
    loadProgress(selectedSet.slug, mode)

    // The exact outcome of this rating — xp, level-up, stage
    // promotion — was already computed when this card was fetched
    // (see review_preview on the card payload / preview_reviews_bulk
    // in srs.py), so there's nothing left to guess or wait on a
    // network round trip for. That round trip is what used to let the
    // XP toast finish and release its "safe to advance" gate well
    // before a slow or cold-starting backend had actually confirmed a
    // stage promotion — which is what was making the card stamp
    // silently never show.
    const preview = card.review_preview?.[quality]

    advancedRef.current = false
    const gates = pendingGatesRef.current
    // Whatever is still in here belongs to a review that is over — a
    // component that would have cleared it is long gone. `locked` above
    // means no review can be in flight at this point, so anything left
    // is stale by construction and would hang this one forever.
    gates.clear()

    if (preview) {
      // leveledUp/newLevel come from applyXpGain's own running total,
      // not preview.leveled_up/preview.new_level — the latter is
      // computed once per batch fetch and can't see XP already
      // earned from other cards answered earlier in this same batch
      // (see the comment on applyXpGain for why that matters here).
      const { leveledUp, newLevel } = applyXpGain({ amount: preview.xp_earned })
      // A fare tick is a corner badge at the top-right, under the XP
      // ring it reports to — it never touches the card. Gating the
      // next card on its fade cost 2175ms measured (1900 hold + 260
      // exit), on the overwhelming majority of reviews, for an
      // animation the learner is not even looking at. XpToast's own
      // note calls this tier "under a second, corner of the screen, no
      // interaction"; it now behaves that way, playing over the next
      // card instead of in place of it. The louder two tiers still
      // gate: a level board is a moment, and a rank waits to be
      // dismissed by hand.
      if (rewardTier({ leveledUp, newLevel }) !== 'fare') gates.add('toast')
      setXpToast({ amount: preview.xp_earned, id: Date.now(), leveledUp, newLevel, quality })

      if (preview.stage_up) {
        gates.add('stamp')
        setCardStamp({ id: Date.now(), to: preview.stage_up, cardKey: card.card_id })
      } else if (preview.stage_down) {
        gates.add('stamp')
        setCardStamp({ id: Date.now(), to: preview.stage_down, demoted: true, cardKey: card.card_id })
      }
    }

    // Fire-and-forget: this only has to persist the review now — the
    // response isn't read for anything the UI shows. A slow or dead
    // request can no longer desync the toast or the stamp from
    // what's actually about to happen.
    apiFetch('/api/kana/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality }),
    }).catch(() => {})

    checkAdvance()
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  function onFlashcardReveal() {
    if (answered) return
    setAnswered(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  function onDrawValidate() {
    if (answered) return
    setAnswered(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  // write_romaji. The comparison in lib/romaji is FEEDBACK only — the
  // rating bar still opens either way, and what the SRS records is the
  // learner's own 1-4 self-rating. Nothing here decides anything: typing
  // "si" for し is not a mistake, and a grader confident enough to fail
  // it would be wrong more often than the learner.
  function onTypeSubmit() {
    if (answered || !typed.trim()) return
    setAnswered(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  // ── Set selection ──
  if (!selectedSet) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.kana} autoHide />
        <main id="main-content">
          <SelectionScreen>
            <ModeSelector
              modes={SETS.map(s => ({ key: s.slug, label: s.label, sample: s.sample }))}
              onSelect={slug => startSession(SETS.find(s => s.slug === slug))}
            />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode && !reviewing) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSelectedSet(null)} title={selectedSet.label} autoHide />
        <main id="main-content">
          <SelectionScreen>
            <ModeSelector
              modes={MODES}
              onSelect={m => (m === FAST_REVIEW ? startReview() : board(() => startMode(m)))}
            />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Review (self-paced, ungraded browse of already-studied cards) ──
  if (reviewing) {
    const dictCategory = selectedSet.slug.startsWith('hiragana') ? 'hiragana' : 'katakana'
    return (
      <div className="screen">
        <TopBar onBack={() => setReviewing(false)} title={`${selectedSet.label} — ${modeLabel(t, FAST_REVIEW)}`} autoHide />
        {/* 朱色, per DESIGN.md's "the pigment is injected once" — see
            DecksScreen's comment for why it sits on <main> and not on
            .screen. Both of this screen's study shells carry it, review
            and quiz alike, or the pigment would flicker between them. */}
        <main id="main-content" className="container quiz-area"
          style={{ '--line-color': 'var(--line-kana)' }}>
          <ReviewDeck
            cards={reviewCards}
            loading={reviewLoading}
            t={t}
            session={session}
            dictCategory={dictCategory}
            dictTerm={c => c.kana}
            onReplaySound={c => playKana(c.romaji)}
            renderFront={c => <CharDisplay char={c.kana} />}
            renderBack={c => (
              <div>
                <CharDisplay char={c.kana} />
                <div className="flashcard-answer">{c.romaji}</div>
              </div>
            )}
            onExit={() => setReviewing(false)}
          />
        </main>
      </div>
    )
  }

  // ── Quiz ──
  const title = modeLabel(t, mode)
  // Study.dc.html's footer strip. Kana has no JLPT level -- the set
  // the learner picked is what says which card this is.
  const cardFoot = { left: selectedSet?.label ? `${selectedSet.label} あ` : 'あ', right: title }
  // Both hiragana sets (basic/combos) and both katakana sets share one
  // dictionary category each — the dictionary itself doesn't
  // distinguish combos from the base set.
  const dictCategory = selectedSet.slug.startsWith('hiragana') ? 'hiragana' : 'katakana'

  // ── What this card renders as ──
  // Driven by the registry plus the card's own direction, not by a chain
  // of string comparisons against mode keys. Adding a mode is a registry
  // entry and a renderer, not an edit to every conditional on the screen.
  const renderer = STUDY_MODES[mode]?.renderer ?? RENDER.FLASHCARD
  // b2f shows the romaji and asks for the kana; f2b is the other way up.
  const isB2F    = card?.direction === 'b2f'
  const prompt   = isB2F ? card?.romaji : card?.kana
  const answer   = isB2F ? card?.kana   : card?.romaji

  // Hints the CARD can actually offer, not the ones the mode declares:
  // a mode that offers choices still can't show them for a set too small
  // to draw distractors from, and a dead control is worse than none.
  const cardHints  = card?.hints ?? {}
  const availableHints = Object.keys(cardHints).filter(
    k => Array.isArray(cardHints[k]) ? cardHints[k].length > 0 : cardHints[k] != null,
  )
  const choicesOn = activeHints.includes(HINTS.CHOICES)
                    && Array.isArray(cardHints[HINTS.CHOICES])

  function toggleHint(key) {
    setActiveHints(hs => (hs.includes(key) ? hs.filter(h => h !== key) : [...hs, key]))
  }

  // The romaji side of a card, as a prompt. NOT MeaningDisplay, which is
  // for glosses and sentence-cases what it is given: it rendered "ba" as
  // "Ba", so the b2f prompt disagreed with the same reading shown
  // lowercase everywhere else, including in its own answer. CharDisplay
  // under 60px inherits the Latin font rather than the JP one.
  const romajiPrompt = text => <CharDisplay char={text} size={44} />

  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${selectedSet.label} — ${title}`} autoHide/>
      <XpToast toast={xpToast} onDone={() => {
        setXpToast(null)
        pendingGatesRef.current.delete('toast')
        checkAdvance()
      }} />
      <main id="main-content" className="container quiz-area"
        style={{ '--line-color': 'var(--line-kana)' }}>
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={() => setMode(null)} pace={paceCtl.pace}
          onExtra={paceCtl.pacedOut ? () => paceCtl.boardExtra(retry) : undefined} />}
        {card && !loading && (
          <>
            <HintBar
              available={availableHints}
              active={activeHints}
              onToggle={toggleHint}
              disabled={locked}
            />
            <CardTransition
              className="specimen-card-stage"
              cardKey={card.card_id} stamp={cardStamp} stage={card.stage} onStampDone={() => {
              setCardStamp(null)
              pendingGatesRef.current.delete('stamp')
              checkAdvance()
            }}>
              {/* Flashcard, either direction — one face is the kana, the
                  other is its romaji, same as Kanji's card shows the
                  character on one face and the meaning on the other
                  rather than stacking the answer under a repeat of the
                  prompt. With the choices hint on it renders as prompt +
                  options instead of a flip card: two reveal affordances
                  on one card compete, so the hint replaces the flip
                  rather than sitting beside it. Same resolution the
                  merged deck modes use in StudyScreen. */}
              {renderer === RENDER.FLASHCARD && !choicesOn && (
                <PromptCard foot={cardFoot}>
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={isB2F
                      ? romajiPrompt(prompt)
                      : <CharDisplay char={prompt} />}
                    back={isB2F
                      ? <CharDisplay char={answer} />
                      : romajiPrompt(answer)}
                    dictTerm={card.kana}
                    dictCategory={dictCategory}
                    session={session}
                    onReplaySound={() => playKana(card.romaji)}
                  />
                </PromptCard>
              )}

              {renderer === RENDER.FLASHCARD && choicesOn && (
                <PromptCard foot={cardFoot}>
                  {isB2F
                    ? romajiPrompt(prompt)
                    : <CharDisplay char={prompt} />}
                  <RevealActions
                    t={t}
                    revealed={answered}
                    resetKey={card.card_id}
                    dictTerm={card.kana}
                    dictCategory={dictCategory}
                    session={session}
                    onReplaySound={() => playKana(card.romaji)}
                  />
                </PromptCard>
              )}

              {/* write_romaji — the kana is shown, type its reading. */}
              {renderer === RENDER.TYPE && (
                <PromptCard foot={cardFoot}>
                  <CharDisplay char={card.kana} />
                  <RevealActions
                    t={t}
                    revealed={answered}
                    resetKey={card.card_id}
                    dictTerm={card.kana}
                    dictCategory={dictCategory}
                    session={session}
                    onReplaySound={() => playKana(card.romaji)}
                  />
                </PromptCard>
              )}

              {/* write_kana — the reading is shown, draw the kana. */}
              {renderer === RENDER.DRAW && (
                <PromptCard foot={cardFoot}>
                  {romajiPrompt(card.romaji)}
                  <RevealActions
                    t={t}
                    revealed={answered}
                    resetKey={card.card_id}
                    dictTerm={card.kana}
                    dictCategory={dictCategory}
                    session={session}
                    onReplaySound={() => playKana(card.romaji)}
                  />
                </PromptCard>
              )}
            </CardTransition>

            {renderer === RENDER.FLASHCARD && choicesOn && (
              <MCQGrid choices={cardHints[HINTS.CHOICES]} correct={answer}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}
            {renderer === RENDER.TYPE && (
              <TypeInput
                value={typed}
                onChange={setTyped}
                onSubmit={onTypeSubmit}
                submitted={answered}
                answer={card.romaji}
                isCorrect={romajiEquals(typed, card.romaji)}
              />
            )}
            {renderer === RENDER.DRAW && (
              <DrawingQuiz
                kanji={card.kana}
                meaning={card.romaji}
                resetKey={card.card_id}
                onValidate={onDrawValidate}
              />
            )}
            <RatingBar active={showRating && !locked} onRate={postReview} />
          </>
        )}
      </main>
    </div>
  )
}