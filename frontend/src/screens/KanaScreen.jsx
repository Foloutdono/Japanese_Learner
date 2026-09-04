import { useState, useEffect, useCallback } from 'react'
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
import { useReviewGates } from '../hooks/useReviewGates'
import { kanaSets } from '../domain/kanaSets'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'

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
  const [reviewing, setReviewing]     = useState(false)
  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)


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

  // Every screen's rating flow: the lock, the gates the celebrations
  // open, and the advance once they all close. See hooks/useReviewGates.
  const gates = useReviewGates({ advance, sessionKey: storageKey })

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


  function postReview(quality) {
    // The gates own the lock, so a review already in flight is refused
    // here rather than half-fired: everything below is this screen's
    // own business, and none of it should run twice.
    if (!gates.review(card.review_preview?.[quality], {
      cardKey: card.card_id, quality,
    })) return

    setShowRating(false)
    loadProgress(selectedSet.slug, mode)

    // Fire-and-forget: this only has to persist the review — the
    // response is not read for anything the UI shows, so a slow or
    // dead request can no longer desync the toast or the stamp from
    // what is already happening.
    apiFetch('/api/kana/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality }),
    }).catch(() => {})
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
      <XpToast toast={gates.xpToast} onDone={gates.toastDone} />
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
              disabled={gates.locked}
            />
            <CardTransition
              className="specimen-card-stage"
              cardKey={card.card_id} stamp={gates.stamp} stage={card.stage}
              onStampDone={gates.stampDone}>
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
            <RatingBar active={showRating && !gates.locked} onRate={postReview} />
          </>
        )}
      </main>
    </div>
  )
}