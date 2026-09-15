import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { postReview as sendReview } from '../lib/reviews'
import { useLang } from '../LangContext'
import RatingBar from '../components/study/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  Flashcard, MeaningDisplay,
} from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import { GrammarRule, GrammarAnswer, GrammarFillSentence, GrammarContrastSentence } from '../components/study/GrammarPieces'
import { GrammarLesson, GrammarLessonSheet } from '../components/study/GrammarLesson'
import { formatGlossLine, GlossList } from '../components/study/gloss'
import { ExampleSentence } from '../components/dictionary/ExampleSentence'
import { Loading } from '../components/ui/Loading'
import { StudyStage } from '../components/study/StudyStage'
import { CardTransition } from '../components/study/CardTransition'
import { useReviewGates } from '../hooks/useReviewGates'
import PromptCard from '../components/study/PromptCard'
import SessionError from '../components/study/SessionError'
import ReviewDeck from '../components/study/ReviewDeck'
import {
  MODES as STUDY_MODES, RENDER, HINTS, FAST_REVIEW, modeLabel,
} from '../domain/studyModes'
import HintBar from '../components/study/HintBar'
import { ChevronIcon } from '../components/ui/Icons'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'

// ── 文法 — the run (plan 071; plan 087) ───────────────────────
// /learn/grammar/:level/:mode on the stage frame. The level and the
// mode are the path — the station and the platforms
// (screens/GrammarScreen.jsx) are the screens before it, and
// ‹ Grammar is the way back. See KanaRun.jsx for the shape every run
// shares.
//
// Plan 087 adds three things. THE GATE: a card the learner has never
// met arrives carrying its lesson, and the lesson is shown first, in
// the card's place, with one button to board — a point is read once
// before it is drilled, exactly as a radical is (RadicalLesson). Seen
// is a flag on the queued card itself (updateCurrent persists it into
// the session mirror), so a reload does not re-gate and the flag goes
// when the card does; a re-served card arrives `learning` and never
// gates again. THE DOOR: the lesson, one tap from every card, as the
// head's own ghost beside the pass. THE CONTRAST DRILL: the pattern
// blanked out of one of its sentences and its rivals as the choices,
// always on — the choices are the exercise, not a hint.

export default function GrammarRun({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const { level, mode } = useParams()

  const reviewing = mode === FAST_REVIEW
  const valid = Boolean(level) && (reviewing || STUDY_MODES[mode]?.source === 'grammar')
  const platforms = `/learn/grammar/${level}`
  const leave = () => navigate(platforms)

  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [showEx, setShowEx]         = useState(false)
  // Hints switched on for the card in hand, reset per card -- reaching for
  // the options on one hard rule should not turn the rest of the session
  // into multiple choice.
  const [activeHints, setActiveHints] = useState([])
  const [progress, setProgress]     = useState(null)
  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)
  // The lesson sheet the door opens, by card id.
  const [sheet, setSheet]           = useState(null)

  // One session per level+mode+language (see useCardSession): the
  // payload is localised server-side, distractors included, so a
  // language switch is a fresh queue rather than a re-translation.
  const storageKey = valid && !reviewing ? sessionKey('grammar', level, mode, lang) : IDLE_KEY

  const paceCtl = usePace(storageKey)
  const { capture: capturePace, query: paceQuery } = paceCtl

  const renderer = STUDY_MODES[mode]?.renderer ?? RENDER.FLASHCARD
  const isFill     = renderer === RENDER.FILL
  const isContrast = renderer === RENDER.CONTRAST

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!valid || reviewing) return []
    const data = capturePace(await apiJson(
      `/api/grammar/cards?level=${encodeURIComponent(level)}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}${paceQuery}`,
      session,
      { signal },
    ))
    return data.cards ?? []
  }, [valid, reviewing, level, mode, lang, session, paceQuery, capturePace])

  const validateCard = useCallback(
    c => !isContrast || Array.isArray(c.contrast?.choices),
    [isContrast],
  )

  const { current: card, loading, done, error, retry, advance, updateCurrent } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
    mode,
    validateCard,
  })

  // Every screen's rating flow: the lock, the gates the celebrations
  // open, and the advance once they all close. See hooks/useReviewGates.
  const gates = useReviewGates({ advance, sessionKey: storageKey })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`answered` are also set mid-flow elsewhere in this screen; moving this into a key-remounted child would need that mid-flow logic threaded back down too.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowEx(false)
    setActiveHints([])
  }, [card?.card_id])

  // Deck progress for the current level+mode, fetched independently
  // from the card so it never blocks card navigation.
  function loadProgress(lvl, m) {
    apiFetch(`/api/grammar/level-stats?level=${encodeURIComponent(lvl)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }
  useEffect(() => {
    if (valid && !reviewing) loadProgress(level, mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, mode])

  // The browse: the full set of already-studied cards, fetched once —
  // see ReviewDeck for why this doesn't go through useCardSession.
  useEffect(() => {
    if (!valid || !reviewing) return undefined
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch state that must land with the fetch it announces; not an id-keyed reset.
    setReviewLoading(true)
    apiFetch(`/api/grammar/review-cards?level=${encodeURIComponent(level)}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => { if (live) setReviewCards(data.cards ?? []) })
      .catch(() => { if (live) setReviewCards([]) })
      .finally(() => { if (live) setReviewLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, reviewing, lang])

  function postReview(quality) {
    // The gates own the lock, so a review already in flight is refused
    // here rather than half-fired.
    if (!gates.review(card.review_preview?.[quality], {
      cardKey: card.card_id, quality,
    })) return

    setShowRating(false)
    loadProgress(level, mode)

    // Fire-and-forget: this only has to persist the review.
    sendReview('/api/grammar/review', session, { card_id: card.card_id, mode, quality, prev_stage: card.stage }).catch(() => {})
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

  if (!valid) return <Navigate replace to={level ? platforms : '/learn/grammar'} />

  // ── Review (self-paced, ungraded browse of already-studied cards) ──
  if (reviewing) {
    return (
      <StudyStage
        color="var(--line-grammar)"
        onLeave={leave}
        leaveLabel={t.grammarTitle}
        where={`${t.grammarTitle} ${level}`}
        sub={t.modeReview}
      >
          <ReviewDeck
            foot={`${t.grammarTitle} ${level}`}
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
            onExit={leave}
          />
      </StudyStage>
    )
  }

  const currentModeLabel = modeLabel(t, mode)
  // Study.dc.html's footer strip.
  const cardFoot = { left: level ? `${level} 文法` : '文法', right: currentModeLabel }
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

  // The gate: a never-met card, its lesson in hand, not yet read.
  const gated = Boolean(card && card.stage === 'new' && card.lesson && !card.lesson_seen)
  // The lesson as the sheet and the gate print it: the card's own
  // identity over the embedded lesson.
  const lessonOf = c => c.lesson && ({
    ...c.lesson, raw_id: c.raw_id ?? c.card_id, level, pattern: c.grammar,
    structure: c.structure, meaning: c.meaning, stage: c.stage,
  })

  const door = card && (
    <button
      type="button"
      className="stage__leave dict-browse-door gl-door--ghost"
      onClick={() => setSheet(card.raw_id ?? card.card_id)}
      disabled={gates.locked}
    >
      <span>{t.glLesson}</span>
      <ChevronIcon direction="right" size={14} />
    </button>
  )

  // ── Quiz ──
  return (
    <StudyStage
      color="var(--line-grammar)"
      onLeave={leave}
      leaveLabel={t.grammarTitle}
      where={`${t.grammarTitle} ${level}`}
      sub={currentModeLabel}
      aside={door}
      toast={gates.xpToast}
      onToastDone={gates.toastDone}
    >
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={leave} pace={paceCtl.pace}
          onExtra={paceCtl.pacedOut ? () => paceCtl.boardExtra(retry) : undefined} />}

        {card && !loading && gated && (
          <div className="gl-gate">
            <GrammarLesson
              point={lessonOf(card)}
              variant="gate"
              onCompare={id => setSheet(id)}
              onBoard={() => updateCurrent({ lesson_seen: true })}
            />
          </div>
        )}

        {card && !loading && !gated && (
          <>
            <HintBar available={availableHints} active={activeHints}
                     onToggle={toggleHint} disabled={gates.locked} />

            <CardTransition
              className="grammar-card-boost"
              cardKey={`${card.card_id}:${card.lesson_seen ? 1 : 0}`}
              stamp={gates.stamp}
              stage={card.stage}
              onStampDone={gates.stampDone}
            >
              <PromptCard className="grammar-prompt" foot={cardFoot}>
                {/* Every mode here is the same card with a different
                    front: a rule, a meaning, or a sentence. The flip is
                    the reveal in all three, and switching the choices on
                    replaces the flip rather than sitting beside it (two
                    reveal affordances on one card) — the same resolution
                    Kanji and Vocab use for their own indice_1. The
                    contrast drill has no flip at all: its choices are
                    the exercise, and the reveal is the answer chosen. */}
                {isContrast ? (
                  <>
                    <GrammarContrastSentence card={card} revealed={answered} t={t} />
                    {answered && <GrammarAnswer card={card} size={36} divided />}
                  </>
                ) : !choicesOn ? (
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={
                      isFill
                        ? <GrammarFillSentence card={card} />
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
                            <GrammarFillSentence card={card} echo revealed />
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
                          : <MeaningDisplay meaning={card.meaning} size={30} />
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
                      ? <GrammarFillSentence card={card} revealed={answered} />
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

            {/* The contrast drill's choices: the rivals, always on. */}
            {isContrast && (
              <MCQGrid
                choices={card.contrast?.choices ?? []}
                correct={card.grammar}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}

            {/* Options: meanings for a flashcard, rules for fill_in. */}
            {!isContrast && showChoices && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={isFill || isB2F ? card.grammar : card.meaning}
                formatChoice={isFill || isB2F ? undefined : formatGlossLine}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}

            {/* indice_2 — example sentences, translation hidden until asked
                for. That reveal is the point of the hint, so it is a second
                switch inside it rather than shown alongside. Furigana and
                the pattern picked out, as the lesson prints them. */}
            {sentencesOn && (
              <div className="grammar-examples">
                <div className="grammar-examples__list">
                  {cardHints[HINTS.SENTENCES].map((ex, i) => (
                    <div key={i} className="grammar-example-card">
                      <ExampleSentence ex={{ ...ex, segments: ex.furigana }} showTr={showEx} />
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowEx(e => !e)} className="grammar-examples-toggle">
                  <ChevronIcon direction={showEx ? 'up' : 'down'} size={14} />
                  {showEx ? t.hideTranslation : t.showTranslation}
                </button>
              </div>
            )}

            <RatingBar active={showRating && !gates.locked} onRate={postReview} />
          </>
        )}

        {sheet && (
          <GrammarLessonSheet
            key={sheet}
            id={sheet}
            initial={card && (card.raw_id ?? card.card_id) === sheet ? lessonOf(card) : null}
            session={session}
            onClose={() => setSheet(null)}
          />
        )}
    </StudyStage>
  )
}
