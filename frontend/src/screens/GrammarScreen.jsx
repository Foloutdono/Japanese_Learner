import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { TopBar } from '../components/ui/TopBar'
import RatingBar from '../components/study/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  Flashcard, MeaningDisplay,
} from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import { GrammarRule, GrammarAnswer } from '../components/study/GrammarPieces'
import { formatGlossLine, GlossList } from '../components/study/gloss'
import { Loading } from '../components/ui/Loading'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import SelectionScreen from '../components/selection/SelectionScreen'
import PromptCard from '../components/study/PromptCard'
import SessionError from '../components/study/SessionError'
import ReviewDeck from '../components/study/ReviewDeck'
import {
  MODES as STUDY_MODES, RENDER, HINTS, FAST_REVIEW,
  modePickerEntries, modeLabel,
} from '../domain/studyModes'
import HintBar from '../components/study/HintBar'
import { ChevronIcon } from '../components/ui/Icons'
import { applyXpGain } from '../stores/profileSummary'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'

// The 8s fetch timeout that used to live here is gone: useCardSession
// owns the abort signal and the timeout now (10s, matched to the cold
// start it was always meant to bridge), so the five screens no longer
// each hand-roll a controller that only ever timed out and never
// aborted on unmount.

export default function GrammarScreen({ session }) {
  const navigate = useNavigate()
  const { t }    = useLang()

  const MODES = modePickerEntries(t, 'grammar')

  const [level, setLevel]           = useState(null)
  const [mode, setMode]             = useState(null)
  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [showEx, setShowEx]         = useState(false)
  // Hints switched on for the card in hand, reset per card -- reaching for
  // the options on one hard rule should not turn the rest of the session
  // into multiple choice.
  const [activeHints, setActiveHints] = useState([])
  const [progress, setProgress]     = useState(null)
  const [xpToast, setXpToast]       = useState(null)
  const [cardStamp, setCardStamp]   = useState(null)
  const [locked, setLocked]         = useState(false)
  const [reviewing, setReviewing]     = useState(false)
  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)

  // Gates that must all clear before the deck is allowed to move on
  // to the next card: the review request itself, plus whichever of
  // the XP toast / stage stamp actually end up showing. Kept in a
  // ref, not state — nothing needs to re-render off it, it's only
  // ever read at the moment a gate closes, to decide whether
  // advance() can finally run. Same pattern as Kana/Vocab/Kanji.
  const pendingGatesRef = useRef(new Set())
  // Guards against advancing twice for the same review — see those
  // screens' own comment on this for the full race it prevents.
  const advancedRef = useRef(false)


  // One session per level+mode — batched and cached so answering never
  // waits on a fetch, and a backend cold start doesn't blank the
  // screen (see useCardSession for the full rationale, and
  // /api/grammar/cards for the batch endpoint this replaced the old
  // one-card-per-fetch /api/grammar/card flow with).
  const storageKey = level && mode
    ? sessionKey('grammar', level, mode)
    : IDLE_KEY

  const paceCtl = usePace(storageKey)
  const { capture: capturePace, query: paceQuery } = paceCtl

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!level || !mode) return []
    const data = capturePace(await apiJson(
      `/api/grammar/cards?level=${encodeURIComponent(level)}&mode=${mode}&count=${count}&exclude=${excludeIds.join(',')}${paceQuery}`,
      session,
      { signal },
    ))
    return data.cards ?? []
  }, [level, mode, session, paceQuery, capturePace])

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`answered` are also set mid-flow elsewhere in this screen (hidden/toggled immediately on user action, independent of the card actually changing) — see the other setShowRating/setAnswered call sites below. Moving this into a key-remounted child would need that mid-flow logic threaded back down too, a bigger restructure than this reset justifies.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowEx(false)
    setActiveHints([])
  }, [card?.card_id])

  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // level+mode. Fetched independently from the card so it never blocks
  // or slows down card navigation.
  function loadProgress(lvl, m) {
    apiFetch(`/api/grammar/level-stats?level=${encodeURIComponent(lvl)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startSession(lvl, m) {
    setLevel(lvl)
    setMode(m)
    loadProgress(lvl, m)
  }

  // Fetches the full set of already-studied cards once — see
  // ReviewDeck for why this doesn't go through useCardSession (no due
  // queue, no refill, just a fixed list to flip through).
  function startReview() {
    setReviewing(true)
    setReviewLoading(true)
    apiFetch(`/api/grammar/review-cards?level=${encodeURIComponent(level)}`, session)
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
    loadProgress(level, mode)

    // The exact outcome of this rating — xp, level-up, stage
    // promotion — was already computed when this card was fetched
    // (see review_preview on the card payload / preview_reviews_bulk
    // in srs.py), so there's nothing left to guess or wait on a
    // network round trip for.
    const preview = card.review_preview?.[quality]

    advancedRef.current = false
    const gates = pendingGatesRef.current

    if (preview) {
      gates.add('toast')
      // leveledUp/newLevel come from applyXpGain's own running total,
      // not preview.leveled_up/preview.new_level — see that function's
      // comment for why the batch-computed preview can't see XP
      // already earned from other cards answered earlier in the batch.
      const { leveledUp, newLevel } = applyXpGain({ amount: preview.xp_earned })
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
    // request can no longer freeze the quiz on every single review,
    // which is what the old fetchCard-after-POST flow used to do.
    apiFetch('/api/grammar/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality, prev_stage: card.stage }),
    }).catch(() => {})

    checkAdvance()
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
  }

  function onFlashcardReveal() {
    if (answered) return
    setAnswered(true)
    setShowRating(true)
  }

  // ── Level selection ──
  if (!level) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.grammarTitle} autoHide />
        {/* No subtitle here — LevelSelector supplies its own header
            (defaulting to t.selectLevel) via SelectionScreen's bare
            layout shell, same as Kanji/Vocab. Passing subtitle here
            too used to render that header twice. */}
        <main id="main-content">
          <SelectionScreen>
            <LevelSelector onSelect={setLevel} />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode && !reviewing) {
    return (
      <div className="screen">
        <TopBar onBack={() => setLevel(null)} title={`${t.grammarTitle} ${level}`} autoHide />
        <main id="main-content">
          <SelectionScreen>
            <ModeSelector
              modes={MODES}
              onSelect={m => (m === FAST_REVIEW ? startReview() : board(() => startSession(level, m)))}
            />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Review (self-paced, ungraded browse of already-studied cards) ──
  if (reviewing) {
    return (
      <div className="screen">
        <TopBar onBack={() => setReviewing(false)} title={`${t.grammarTitle} ${level} — ${t.modeReview}`} autoHide />
        <main id="main-content" className="container quiz-area">
          <ReviewDeck
            cards={reviewCards}
            loading={reviewLoading}
            t={t}
            session={session}
            renderFront={c => <div className="grammar-glyph">{c.grammar}</div>}
            renderBack={c => (
              <div>
                <div className="grammar-glyph">{c.grammar}</div>
                <div className="grammar-meaning"><GlossList meaning={c.meaning} /></div>
                {c.structure && (
                  <div className="review-grammar-explanation">{c.structure}</div>
                )}
              </div>
            )}
            onExit={() => setReviewing(false)}
          />
        </main>
      </div>
    )
  }

  const currentModeLabel = modeLabel(t, mode)
  // Driven by the registry, not by comparing against mode-key strings.
  const renderer = STUDY_MODES[mode]?.renderer ?? RENDER.FLASHCARD
  const isFill   = renderer === RENDER.FILL
  // b2f shows the meaning and asks for the rule; f2b is the other way up.
  const isB2F    = card?.direction === 'b2f'

  const cardHints = card?.hints ?? {}
  const availableHints = Object.keys(cardHints).filter(
    k => Array.isArray(cardHints[k]) && cardHints[k].length > 0,
  )
  const choicesOn   = activeHints.includes(HINTS.CHOICES) && Array.isArray(cardHints[HINTS.CHOICES])
  const sentencesOn = activeHints.includes(HINTS.SENTENCES) && Array.isArray(cardHints[HINTS.SENTENCES])
  // The choices are a hint here exactly as they are everywhere else —
  // fill_in used to force them on, which made it the one mode you could
  // not answer from memory, and made its indice_1 switch a control that
  // visibly did nothing. Naming the rule with no options is a perfectly
  // good free-recall question; the flip below is its reveal.
  const showChoices = choicesOn

  // One hint at a time. Grammar is the only source offering two
  // (choices and example sentences) and both at once put an MCQ list
  // AND a sentence list under the card, pushing the card itself off
  // the top of the screen. Switching one on switches the other off,
  // so reaching for a different kind of help is one tap, not two.
  function toggleHint(key) {
    setActiveHints(hs => (hs.includes(key) ? [] : [key]))
  }

  // ── Quiz ──
  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${t.grammarTitle} ${level} — ${currentModeLabel}`} autoHide />
      <XpToast toast={xpToast} onDone={() => {
        setXpToast(null)
        pendingGatesRef.current.delete('toast')
        checkAdvance()
      }} />
      <main id="main-content" className="container quiz-area">
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={() => setMode(null)} pace={paceCtl.pace}
          onExtra={paceCtl.pacedOut ? () => paceCtl.boardExtra(retry) : undefined} />}

        {card && !loading && (
          <>
            <HintBar available={availableHints} active={activeHints}
                     onToggle={toggleHint} disabled={locked} />

            <CardTransition
              className="grammar-card-boost"
              cardKey={card.card_id}
              stamp={cardStamp}
              stage={card.stage}
              onStampDone={() => {
                setCardStamp(null)
                pendingGatesRef.current.delete('stamp')
                checkAdvance()
              }}
            >
              <PromptCard className="grammar-prompt">
                {/* Every mode here is the same card with a different
                    front: a rule, a meaning, or a sentence. The flip is
                    the reveal in all three, and switching the choices on
                    replaces the flip rather than sitting beside it (two
                    reveal affordances on one card) — the same resolution
                    Kanji and Vocab use for their own indice_1. */}
                {!choicesOn ? (
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={
                      isFill
                        ? <div className="grammar-fill-sentence" lang="ja">{card.fill_sentence?.jp}</div>
                        : isB2F
                          ? <MeaningDisplay meaning={card.meaning} size={34} />
                          : (
                            <>
                              <GrammarRule text={card.grammar} size={52} />
                              {card.structure && (
                                <div className="grammar-structure">{card.structure}</div>
                              )}
                            </>
                          )
                    }
                    back={
                      isFill
                        ? (
                          /* The sentence stays on the back, dimmed: the
                             answer is which rule is at work IN IT, and
                             reading the rule with the sentence gone
                             makes it a bare fact instead of an
                             observation about the sentence. */
                          <>
                            <div className="grammar-fill-sentence grammar-fill-sentence--echo" lang="ja">
                              {card.fill_sentence?.jp}
                            </div>
                            <GrammarAnswer card={card} size={40} />
                          </>
                        )
                        : isB2F
                          ? (
                            <>
                              <GrammarRule text={card.grammar} size={44} />
                              {card.structure && (
                                <div className="grammar-structure">{card.structure}</div>
                              )}
                            </>
                          )
                          : <MeaningDisplay meaning={card.meaning} size={30} color="var(--success)" />
                    }
                  />
                ) : (
                  /* Choices on — the prompt does NOT swap: the answer is
                     whichever MCQ row lights up below, not a second face
                     here. fill_in is the exception, because its own
                     prompt is the sentence and the rule named below is
                     worth seeing spelled out next to it. */
                  <>
                    {isFill
                      ? <div className="grammar-fill-sentence" lang="ja">{card.fill_sentence?.jp}</div>
                      : isB2F
                        ? <MeaningDisplay meaning={card.meaning} size={34} />
                        : (
                          <>
                            <GrammarRule text={card.grammar} size={52} />
                            {card.structure && (
                              <div className="grammar-structure">{card.structure}</div>
                            )}
                          </>
                        )}
                    {isFill && answered && <GrammarAnswer card={card} size={36} divided />}
                  </>
                )}
              </PromptCard>
            </CardTransition>

            {/* Options: meanings for a flashcard, rules for fill_in. */}
            {showChoices && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={isFill || isB2F ? card.grammar : card.meaning}
                formatChoice={isFill || isB2F ? undefined : formatGlossLine}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}

            {/* indice_2 — example sentences, translation hidden until asked
                for. That reveal is the point of the hint, so it is a second
                switch inside it rather than shown alongside. */}
            {sentencesOn && (
              <div className="grammar-examples">
                <div className="grammar-examples__list">
                  {cardHints[HINTS.SENTENCES].map((ex, i) => (
                    <div key={i} className="grammar-example-card">
                      <div className="grammar-example-card__jp" lang="ja">{ex.jp}</div>
                      {showEx
                        ? <div className="grammar-example-card__en">{ex.en}</div>
                        : null}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowEx(e => !e)} className="grammar-examples-toggle">
                  <ChevronIcon direction={showEx ? 'up' : 'down'} size={14} />
                  {showEx ? t.hideTranslation : t.showTranslation}
                </button>
              </div>
            )}

            <RatingBar active={showRating && !locked} onRate={postReview} />
          </>
        )}
      </main>
    </div>
  )
}