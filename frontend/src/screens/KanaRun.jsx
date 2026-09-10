import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { postReview as sendReview } from '../lib/reviews'
import { useLang } from '../LangContext'
import RatingBar from '../components/study/RatingBar'
import {
  CharDisplay, MCQGrid, DoneMessage,
  DeckProgress, Flashcard, RevealActions, TypeInput,
} from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import HintBar from '../components/study/HintBar'
import { DrawingQuiz } from '../components/study/DrawingCanvas'
import { Loading } from '../components/ui/Loading'
import { StudyStage } from '../components/study/StudyStage'
import { CardTransition } from '../components/study/CardTransition'
import PromptCard from '../components/study/PromptCard'
import ReviewDeck from '../components/study/ReviewDeck'
import SessionError from '../components/study/SessionError'
import { playKana } from '../lib/audio'
import {
  MODES as STUDY_MODES, RENDER, HINTS, FAST_REVIEW, modeLabel,
} from '../domain/studyModes'
import { romajiEquals } from '../lib/romaji'
import { useReviewGates } from '../hooks/useReviewGates'
import { kanaSets } from '../domain/kanaSets'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'

// ── かな — the run (plan 071) ─────────────────────────────────
// /learn/kana/:set/:mode on the stage frame. The set and the mode are
// the path — the station and the platforms (screens/KanaScreen.jsx)
// are the two screens before it, and ‹ Sets is the way back to them.
// A mode the registry does not know, or a set the app does not teach,
// lands on the picker instead of a blank stage.
//
// The session logic is the screen's own, as on every study screen:
// one useCardSession per set+mode, batched and cached so answering
// never waits on a fetch (see the hook for the full rationale), the
// gates the celebrations open (hooks/useReviewGates), the fare
// charged after the scheduler accepts (lib/reviews).

export default function KanaRun({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const { set, mode } = useParams()

  const SETS = kanaSets(t)
  const selectedSet = SETS.find(s => s.slug === set) ?? null
  const reviewing = mode === FAST_REVIEW
  const valid = Boolean(selectedSet) && (reviewing || STUDY_MODES[mode]?.source === 'kana')
  const platforms = `/learn/kana/${set}`
  const leave = () => navigate(platforms)

  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  // Hints switched on for the card in hand. Reset per card, so asking for
  // the options on one hard card doesn't quietly turn the rest of the
  // session into multiple choice.
  const [activeHints, setActiveHints] = useState([])
  const [typed, setTyped]             = useState('')
  const [showRating, setShowRating]   = useState(false)
  const [progress, setProgress]       = useState(null)
  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)

  // One session per set+mode — batched and cached so answering never
  // waits on a fetch, and a backend cold start doesn't blank the
  // screen (see useCardSession). The idle placeholder for a browse:
  // the review deck is a fixed list, not a queue.
  const storageKey = valid && !reviewing ? sessionKey('kana', selectedSet.slug, mode) : IDLE_KEY

  const paceCtl = usePace(storageKey)
  const { capture: capturePace, query: paceQuery } = paceCtl

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!valid || reviewing) return []
    const data = capturePace(await apiJson(
      `/api/kana/cards?set_name=${encodeURIComponent(selectedSet.slug)}&mode=${mode}&count=${count}&exclude=${excludeIds.join(',')}${paceQuery}`,
      session,
      { signal },
    ))
    return data.cards ?? []
  }, [valid, reviewing, selectedSet, mode, session, paceQuery, capturePace])

  const { current: card, loading, done, error, retry, advance } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
    mode,
  })

  // Every screen's rating flow: the lock, the gates the celebrations
  // open, and the advance once they all close. See hooks/useReviewGates.
  const gates = useReviewGates({ advance, sessionKey: storageKey })

  // Reset per-card UI state whenever the card in hand changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`answered` are also set mid-flow elsewhere in this screen (hidden immediately on a rating tap, before the card actually advances); moving this into a key-remounted child would need that mid-flow logic threaded back down too.
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
  useEffect(() => {
    if (valid && !reviewing) loadProgress(selectedSet.slug, mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, mode])

  // The browse: the full set of already-studied cards, fetched once —
  // see ReviewDeck for why this doesn't go through useCardSession.
  useEffect(() => {
    if (!valid || !reviewing) return undefined
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch state that must land with the fetch it announces; not an id-keyed reset.
    setReviewLoading(true)
    apiFetch(`/api/kana/review-cards?set_name=${encodeURIComponent(selectedSet.slug)}`, session)
      .then(r => r.json())
      .then(data => { if (live) setReviewCards(data.cards ?? []) })
      .catch(() => { if (live) setReviewCards([]) })
      .finally(() => { if (live) setReviewLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, reviewing])

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
    sendReview('/api/kana/review', session, { card_id: card.card_id, mode, quality }).catch(() => {})
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
  // learner's own 1-4 self-rating.
  function onTypeSubmit() {
    if (answered || !typed.trim()) return
    setAnswered(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  if (!valid) return <Navigate replace to={selectedSet ? platforms : '/learn/kana'} />

  // ── Review (self-paced, ungraded browse of already-studied cards) ──
  if (reviewing) {
    const dictCategory = selectedSet.slug.startsWith('hiragana') ? 'hiragana' : 'katakana'
    return (
      <StudyStage
        color="var(--line-kana)"
        onLeave={leave}
        leaveLabel={t.kanaTitle}
        where={selectedSet.label}
        sub={modeLabel(t, FAST_REVIEW)}
      >
          <ReviewDeck
            foot={selectedSet.label}
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
            onExit={leave}
          />
      </StudyStage>
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
    <StudyStage
      color="var(--line-kana)"
      onLeave={leave}
      leaveLabel={t.kanaTitle}
      where={selectedSet.label}
      sub={title}
      toast={gates.xpToast}
      onToastDone={gates.toastDone}
    >
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={leave} pace={paceCtl.pace}
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
                resetKey={card.card_id}
                onValidate={onDrawValidate}
              />
            )}
            <RatingBar active={showRating && !gates.locked} onRate={postReview} />
          </>
        )}
    </StudyStage>
  )
}
