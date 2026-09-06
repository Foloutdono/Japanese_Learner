import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { postReview as sendReview } from '../lib/reviews'
import { useLang } from '../LangContext'
import RatingBar from '../components/study/RatingBar'
import { MCQGrid, DoneMessage, DeckProgress } from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import { radicalChoiceRenderer } from '../components/study/radicalChoiceRenderer'
import { formatGlossLine } from '../components/study/gloss'
import { Loading } from '../components/ui/Loading'
import { StudyStage } from '../components/study/StudyStage'
import { CardTransition } from '../components/study/CardTransition'
import { useReviewGates } from '../hooks/useReviewGates'
// The card faces themselves live beside the other study components now,
// because the daily queue (screens/TodayScreen) renders the same five
// structures and a second copy of them is how two payload shapes drift
// apart. See CardPrompt's own note.
import CardPrompt from '../components/study/CardPrompt'
import { wordForm, structureKeyOf, normalizeCard } from '../domain/cardShape'
import SessionError from '../components/study/SessionError'
import ReadingsInput from '../components/study/ReadingsInput'
import { DrawingQuiz, DrawingOverlay } from '../components/study/DrawingCanvas'
import { speakJapanese } from '../lib/audio'
import {
  MODES as STUDY_MODES, RENDER, HINTS,
  modeLabel, usesWritingDrill,
} from '../domain/studyModes'
import HintBar from '../components/study/HintBar'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'
import { ChevronIcon } from '../components/ui/Icons'
import WritingToggle from '../components/study/WritingToggle'

// ── 教材 — a deck's run (plan 071) ────────────────────────────
// /learn/decks/:deck_id/study/:mode on the stage frame. The deck and
// the mode are the path — the platforms (screens/StudyScreen.jsx) are
// the screen before it, and ‹ Deck is the way back. See KanaRun.jsx
// for the shape every run shares.
//
// One key still means one SRS track, one set of stats and one
// review_preview. What a review consumes is the learner's own 1-4
// self-rating, which means the same thing whether or not a hint
// happened to be on screen.

export default function StudyRun({ session }) {
  const { t, lang } = useLang()
  const navigate     = useNavigate()
  const { deck_id, mode } = useParams()
  const { state }    = useLocation()

  const valid = Boolean(deck_id) && Boolean(STUDY_MODES[mode]?.implemented) && STUDY_MODES[mode]?.graded !== false
  const platforms = `/learn/decks/${deck_id}/study`
  const leave = () => navigate(platforms)

  // Falls back to fetching the deck when opened without router state (a
  // refresh, a direct link): the writing-practice toggle depends on
  // knowing the deck's actual structure.
  const [deck, setDeck] = useState(state?.deck ?? null)
  useEffect(() => {
    if (deck) return
    apiFetch(`/api/decks/${deck_id}`, session)
      .then(r => r.json())
      .then(d => { if (!d?.error) setDeck(d) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id])

  const [answered, setAnswered]       = useState(false)
  // Hints switched on for the card in hand. Session-wide, so it stays
  // where the learner put it, and switchable mid-card.
  const [activeHints, setActiveHints] = useState([])
  const [selected, setSelected]       = useState(null)
  const [showRating, setShowRating]   = useState(false)
  // indice_2's own translation reveal (grammar only) — see GrammarRun.
  const [showEx, setShowEx]           = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  const [progress, setProgress]       = useState(null)
  // Bumped every single time advance() actually runs (see the
  // useReviewGates call below) — independent of whether the served
  // card_id happens to be different, so the screen visibly resets even
  // when the backend hands the exact same card back.
  const [cardNonce, setCardNonce]     = useState(0)

  // The card just answered has already been popped by advance() by the
  // time a refill runs, and its review POST is fire-and-forget, so a
  // refill can reach the backend before the POST has committed the new
  // next_review — and the backend serves the same card back. A short
  // memory of "just reviewed" ids, always merged into the exclude list,
  // closes that gap.
  const recentlyReviewedRef = useRef(new Map())

  function markReviewed(cardId) {
    recentlyReviewedRef.current.set(cardId, true)
    setTimeout(() => recentlyReviewedRef.current.delete(cardId), 8000)
  }

  const storageKey = valid ? sessionKey('deck', deck_id, mode) : IDLE_KEY

  const paceCtl = usePace(storageKey)

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!valid) return []
    const data = paceCtl.capture(await apiJson(
      `/api/decks/${deck_id}/study?mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}${paceCtl.query}`,
      session,
      { signal },
    ))
    return data.cards ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, deck_id, mode, lang, session, paceCtl.query, paceCtl.capture])

  const extraExcludeIds = useCallback(
    () => Array.from(recentlyReviewedRef.current.keys()),
    [],
  )

  const { current: card, loading, done, error, retry, advance } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
    mode,
    extraExcludeIds,
  })

  // Every screen's rating flow: the lock, the gates the celebrations
  // open, and the advance once they all close. See hooks/useReviewGates.
  // The nonce rides along with the pop, so a card handed back under the
  // same id still resets to a fresh, unrevealed one.
  const gates = useReviewGates({
    advance: useCallback(() => { advance(); setCardNonce(n => n + 1) }, [advance]),
    sessionKey: storageKey,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`answered` are also set mid-flow elsewhere in this screen; moving this into a key-remounted child would need that mid-flow logic threaded back down too.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowEx(false)
    setShowDrawing(false)
    setActiveHints([])
  }, [card?.card_id, cardNonce])

  // Deck progress for the current mode, fetched independently from the
  // card so it never blocks card navigation.
  function loadProgress(m) {
    apiFetch(`/api/decks/${deck_id}/stats?mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }
  useEffect(() => {
    if (valid) loadProgress(mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id, mode])

  function postReview(quality) {
    if (!card) return

    // Same writing-drill trigger as KanjiRun: only meaningful when
    // struggling to recall a kanji from its meaning. Keyed on the
    // card's STRUCTURE, not its source — a hand-written kanji card
    // wants the same drill a browsed-in one gets.
    const needTraining =
      quality <= 3 && structureKeyOf(card) === 'kanji' && card.direction === 'b2f' && drawingEnabled

    // The gates own the lock, so a review already in flight is refused
    // here rather than half-fired. The stamp's key carries the nonce
    // because this screen's transition key does.
    if (!gates.review(card.review_preview?.[quality], {
      cardKey: `${card.card_id}:${cardNonce}`, quality,
      hold: needTraining ? ['training'] : [],
    })) return

    setShowRating(false)
    if (needTraining) setShowDrawing(true)
    loadProgress(mode)

    // From this point on, any refill (even one already in flight) must
    // not be able to hand this exact card back.
    markReviewed(card.card_id)

    // Fire-and-forget — the response isn't read for anything the UI
    // shows, same as every other run's review call.
    sendReview(`/api/decks/${deck_id}/review`, session, { card_id: card.card_id, mode, quality, prev_stage: card.stage }).catch(() => {})
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

  if (!valid) return <Navigate replace to={deck_id ? platforms : '/learn/decks'} />

  // ── Quiz ──
  const structureKey = structureKeyOf(card)
  // The card projected onto its structure's own field names — see
  // normalizeCard's own comment for why this exists. Everything below
  // reads `nc`, never `card`, once past this point.
  const nc = card ? normalizeCard(card) : null

  // f2b shows the Japanese/rule side and asks for the other; b2f is the
  // reverse. One name for every source: kanji/vocab call this isKjToM,
  // grammar calls it !isB2F — same boolean, so one variable here.
  const isF2B = nc?.direction === 'f2b'
  const renderer = STUDY_MODES[mode]?.renderer ?? RENDER.FLASHCARD
  const isFill    = renderer === RENDER.FILL
  const isRadical = STUDY_MODES[mode]?.base === 'radical'

  // Hints this CARD can offer, not the ones the mode declares. A
  // hand-written card without a matching extra (no distractors to
  // build, no cached sentences) has no entry for that hint, and
  // HintBar renders from what is actually present rather than a
  // control that would do nothing.
  const cardHints = nc?.hints ?? {}
  const availableHints = Object.keys(cardHints).filter(
    k => Array.isArray(cardHints[k]) && cardHints[k].length > 0,
  )
  const choicesOn   = activeHints.includes(HINTS.CHOICES) && Array.isArray(cardHints[HINTS.CHOICES])
  const sentencesOn = activeHints.includes(HINTS.SENTENCES) && Array.isArray(cardHints[HINTS.SENTENCES])
  // fill_in's own reveal is the flip, same as every other mode here —
  // choicesOn is what actually decides whether the flip is replaced by
  // the options grid instead (see the grammar renderer below).
  const showChoices = choicesOn

  // One hint at a time, but ONLY for grammar — it is the one source
  // offering two (choices and example sentences), and both at once put
  // an MCQ list AND a sentence list under the card, pushing the card
  // itself off the top of the screen. Kanji/vocab only ever have one
  // hint available at a time regardless, so this never changes their
  // behaviour.
  function toggleHint(key) {
    setActiveHints(hs => {
      if (hs.includes(key)) return structureKey === 'grammar' ? [] : hs.filter(h => h !== key)
      return structureKey === 'grammar' ? [key] : [...hs, key]
    })
  }

  const title = modeLabel(t, mode)
  // Vocab/grammar get the same wider card their own screens give them;
  // every other structure/renderer reads fine at the container's
  // default width.
  const cardStageClassName =
    structureKey === 'vocab' ? 'vocab-card-boost'
    : structureKey === 'grammar' ? 'grammar-card-boost'
    : structureKey === 'kana' || structureKey === 'kanji' ? 'specimen-card-stage'
    : undefined
  // The card's footer strip, as on every section screen: the deck on
  // the left, the mode on the right.
  const cardFoot = { left: deck?.name ?? '', right: title }

  return (
    <StudyStage
      color="var(--line-decks)"
      onLeave={leave}
      leaveLabel={t.decksTitle}
      where={deck?.name ?? ''}
      sub={title}
      aside={deck?.type === 'kanji' && usesWritingDrill(mode) ? (
        <WritingToggle on={drawingEnabled} onToggle={() => setDrawingEnabled(d => !d)} />
      ) : undefined}
      toast={gates.xpToast}
      onToastDone={gates.toastDone}
    >
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={leave} pace={paceCtl.pace}
          onExtra={paceCtl.pacedOut ? () => paceCtl.boardExtra(retry) : undefined} />}

        {nc && !loading && (
          <>
            {/* The help switch, on the card rather than back on the
                mode picker: you only find out whether you needed the
                options once you're looking at the prompt. A
                hand-written card without a matching extra has no
                control here at all, rather than a dead one. */}
            <HintBar
              available={availableHints}
              active={activeHints}
              onToggle={toggleHint}
              disabled={gates.locked}
            />

            <CardTransition
              className={cardStageClassName}
              cardKey={`${nc.card_id}:${cardNonce}`}
              stamp={gates.stamp}
              stage={nc.stage}
              onStampDone={gates.stampDone}
            >
              <CardPrompt
                card={nc} t={t} session={session}
                answered={answered} cardNonce={cardNonce}
                activeHints={activeHints} onFlashcardReveal={onFlashcardReveal}
                foot={cardFoot}
              />
            </CardTransition>

            {/* Kanji radical MCQ — {char, stroke_count} distractor rows,
                the number shown alongside the glyph since several
                radicals from the same stroke-count bucket are one
                smudge at row size. */}
            {structureKey === 'kanji' && isRadical && showChoices && (
              <MCQGrid
                choices={(nc.hints?.indice_1 ?? []).map(c => c.char)}
                correct={nc.radical?.char}
                formatChoice={radicalChoiceRenderer(nc.hints?.indice_1 ?? [])}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {/* Kanji flashcard MCQ — choices are {kanji,meaning}
                objects, flattened to whichever side isn't the prompt. */}
            {structureKey === 'kanji' && !isRadical && showChoices && (
              <MCQGrid
                choices={(nc.hints?.indice_1 ?? []).map(c => isF2B ? c.meaning : c.kanji)}
                correct={isF2B ? nc.meaning : nc.kanji}
                formatChoice={isF2B ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {/* Vocab MCQ — choices are {kanji,kana,meaning} objects. */}
            {structureKey === 'vocab' && showChoices && (
              <MCQGrid
                choices={(nc.hints?.indice_1 ?? []).map(c => isF2B ? c.meaning : wordForm(c))}
                correct={isF2B ? nc.meaning : wordForm(nc)}
                formatChoice={isF2B ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {/* Grammar MCQ — options are plain meaning/pattern strings,
                for either the flashcard modes or fill_in's own "which
                rule is at work" choices. */}
            {structureKey === 'grammar' && showChoices && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={isFill || !isF2B ? nc.grammar : nc.meaning}
                formatChoice={isFill || !isF2B ? undefined : formatGlossLine}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {/* indice_2 — grammar's example sentences, translation
                hidden until asked for. */}
            {structureKey === 'grammar' && sentencesOn && (
              <div className="grammar-examples">
                <div className="grammar-examples__list">
                  {cardHints[HINTS.SENTENCES].map((ex, i) => (
                    <div key={i} className="grammar-example-card">
                      <div className="grammar-example-card__jp" lang="ja">{ex.jp}</div>
                      {showEx && <div className="grammar-example-card__en">{ex.en}</div>}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowEx(e => !e)} className="grammar-examples-toggle">
                  <ChevronIcon direction={showEx ? 'up' : 'down'} size={14} />
                  {showEx ? t.hideTranslation : t.showTranslation}
                </button>
              </div>
            )}

            {/* Kanji readings mode — every on'yomi/kun'yomi typed in,
                self-graded against the full accepted list on submit. */}
            {structureKey === 'kanji' && renderer === RENDER.TYPE && (
              <ReadingsInput
                key={nc.card_id}
                readings={nc.readings}
                submitted={answered}
                onSubmit={onFlashcardReveal}
              />
            )}

            {/* Kanji write mode */}
            {structureKey === 'kanji' && renderer === RENDER.DRAW && nc.kanji && (
              <DrawingQuiz
                kanji={nc.kanji}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={nc.card_id}
                meaning={formatGlossLine(nc.meaning)}
                onValidate={() => {
                  setAnswered(true)
                  setShowRating(true)
                  speakJapanese(nc.kana)
                }}
              />
            )}

            <RatingBar active={showRating && !gates.locked} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay
                kanji={nc.kanji}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={nc.card_id}
                meaning={formatGlossLine(nc.meaning)}
                onDone={() => {
                  setShowDrawing(false)
                  gates.release('training')
                }}
              />
            )}
          </>
        )}
    </StudyStage>
  )
}
