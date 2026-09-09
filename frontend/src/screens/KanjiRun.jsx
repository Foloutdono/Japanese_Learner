import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { tierLabelFor } from '../domain/tiers'
import { apiFetch, apiJson } from '../lib/api'
import { postReview as sendReview } from '../lib/reviews'
import {
  translatedMap, applyTranslations, retranslateSelection,
} from '../lib/translationCache'
import { useLang } from '../LangContext'
import RatingBar from '../components/study/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, MeaningDisplay, CharDisplay, RevealActions,
} from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import { formatGlossLine } from '../components/study/gloss'
import { Loading } from '../components/ui/Loading'
import { StudyStage } from '../components/study/StudyStage'
import { CardTransition } from '../components/study/CardTransition'
import { useReviewGates } from '../hooks/useReviewGates'
import PromptCard from '../components/study/PromptCard'
import HintBar from '../components/study/HintBar'
import ReadingsInput from '../components/study/ReadingsInput'
import SessionError from '../components/study/SessionError'
import ReviewDeck from '../components/study/ReviewDeck'
import {DrawingQuiz, DrawingOverlay} from '../components/study/DrawingCanvas'
import { speakJapanese, playUi } from '../lib/audio'
import {
  MODES as STUDY_MODES, RENDER, FAST_REVIEW,
  modeLabel, usesWritingDrill,
} from '../domain/studyModes'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'
import WritingToggle from '../components/study/WritingToggle'
import { RadicalAnswer } from '../components/study/RadicalPieces'
import { radicalChoiceRenderer } from '../components/study/radicalChoiceRenderer'

// ── 漢字 — the run (plan 071) ─────────────────────────────────
// /learn/kanji/:level/:mode and /learn/kanji/tier/:tier/:mode (with
// ?size=) on the stage frame. Where the kanji come from is the path —
// the station and the platforms (screens/KanjiScreen.jsx) are the
// screens before it, and ‹ Kanji is the way back. See KanaRun.jsx for
// the shape every run shares.

export default function KanjiRun({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()
  const { level, tier, mode } = useParams()
  const [sp] = useSearchParams()

  // 'level' (JLPT N5…N1) or 'frequency' (Top 200 / 201-400 / …, see
  // frequency.py). The tier size the chosen tier was built at rides in
  // the query: the same tier NUMBER means a different rank range at a
  // different size, so it travels into every /api/frequency call.
  const studyBy = level ? 'level' : tier ? 'frequency' : null
  const tierSize = Number(sp.get('size')) || 200
  const tierLabel = tier ? tierLabelFor(Number(tier), tierSize) : null
  const reviewing = mode === FAST_REVIEW
  // The browse exists for the JLPT path only (no tier review-cards
  // endpoint yet).
  const valid = Boolean(studyBy) && (reviewing ? studyBy === 'level' : STUDY_MODES[mode]?.source === 'kanji')
  const platforms = level ? `/learn/kanji/${level}` : `/learn/kanji/tier/${tier}?size=${tierSize}`
  const leave = () => navigate(platforms)

  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  const [showRating, setShowRating]   = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  const [progress, setProgress]       = useState(null)
  // ── Hint state (indice_1/2/3) ──
  // Session-wide rather than per-card: a display preference should stay
  // where the learner put it.
  const [activeHints, setActiveHints] = useState(() => new Set())
  function toggleHint(key) {
    playUi('click-mode-selection')
    setActiveHints(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)

  // One session per source+mode (see useCardSession). lang is
  // intentionally NOT part of the key — switching UI language
  // mid-session re-translates in place (see the effect below).
  const storageKey = !valid || reviewing ? IDLE_KEY
    : studyBy === 'level' ? sessionKey('kanji', level, mode)
    : sessionKey('kanji', 'freq', tier, tierSize, mode)

  const paceCtl = usePace(storageKey)

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!valid || reviewing) return []
    const url = studyBy === 'level'
      ? `/api/kanji/cards?level=${level}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
      : `/api/frequency/kanji/cards?tier=${tier}&tier_size=${tierSize}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
    const data = paceCtl.capture(await apiJson(url + paceCtl.query, session, { signal }))
    return (data.cards ?? []).map(c => ({ ...c, lang }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, reviewing, studyBy, level, tier, tierSize, mode, session, paceCtl.query, paceCtl.capture])

  const { current: card, loading, done, error, retry, advance, updateCurrent } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
    mode,
  })

  function translateCard(cardToTranslate, targetLang) {
    if (!cardToTranslate) return
    const words = [cardToTranslate.kanji, ...(cardToTranslate.hints?.indice_1 ?? []).map(c => c.kanji)]
    const unique = [...new Set(words.filter(Boolean))]
    Promise.all(unique.map(word =>
      apiFetch(`/api/translation/kanji?word=${encodeURIComponent(word)}&lang=${targetLang}`, session)
        .then(r => r.json())
        .then(data => [word, data.translation || ''])
    )).then(entries => {
      const map = translatedMap(entries)
      updateCurrent(cur => ({
        ...applyTranslations(cur, entry => entry.kanji, map),
        lang: targetLang,
      }))
      setSelected(prev => retranslateSelection(
        prev, cardToTranslate.hints?.indice_1, entry => entry.kanji, map,
      ))
    })
  }

  // Re-translate the card in hand when the UI language changes, or
  // when a newly-current card still carries the language it was
  // fetched in.
  useEffect(() => {
    if (card && card.lang !== lang) translateCard(card, lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, lang])

  // Every screen's rating flow: the lock, the gates the celebrations
  // open, and the advance once they all close. See hooks/useReviewGates.
  const gates = useReviewGates({ advance, sessionKey: storageKey })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`showDrawing`/`answered` are also set mid-flow by postReview() and other handlers below; moving this into a key-remounted child would need that mid-flow logic threaded back down too.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowDrawing(false)
  }, [card?.card_id])

  // Deck progress for the current source+mode, fetched independently
  // from the card so it never blocks card navigation.
  function loadProgress(source, m) {
    const url = 'level' in source
      ? `/api/kanji/stats?level=${encodeURIComponent(source.level)}&mode=${m}`
      : `/api/frequency/kanji/stats?tier=${source.tier}&tier_size=${source.tierSize}&mode=${m}`
    apiFetch(url, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }
  const source = studyBy === 'level' ? { level } : { tier, tierSize }
  useEffect(() => {
    if (valid && !reviewing) loadProgress(source, mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, tier, tierSize, mode])

  // The browse: the full set of already-studied cards, fetched once —
  // see ReviewDeck for why this doesn't go through useCardSession.
  useEffect(() => {
    if (!valid || !reviewing) return undefined
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch state that must land with the fetch it announces; not an id-keyed reset.
    setReviewLoading(true)
    apiFetch(`/api/kanji/review-cards?level=${level}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => { if (live) setReviewCards(data.cards ?? []) })
      .catch(() => { if (live) setReviewCards([]) })
      .finally(() => { if (live) setReviewLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, reviewing, lang])

  function postReview(quality) {
    // Struggling to recall the kanji from its meaning is exactly when a
    // quick writing drill helps most — recognition-direction modes and
    // the writing mode itself don't need this extra step. It rides as
    // a gate of this screen's own, released when the drill is
    // dismissed (see DrawingOverlay's onDone below).
    const needTraining = quality <= 3 && card?.direction === 'b2f' && drawingEnabled

    // The gates own the lock, so a review already in flight is refused
    // here rather than half-fired.
    if (!gates.review(card.review_preview?.[quality], {
      cardKey: card.card_id, quality, hold: needTraining ? ['training'] : [],
    })) return

    setShowRating(false)
    if (needTraining) setShowDrawing(true)
    loadProgress(source, mode)

    // Fire-and-forget: this only has to persist the review.
    sendReview('/api/kanji/review', session, { card_id: card.card_id, mode: card.mode, quality }).catch(() => {})
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

  if (!valid) return <Navigate replace to={studyBy ? platforms : '/learn/kanji'} />

  // ── Review (self-paced, ungraded browse of already-studied cards) ──
  if (reviewing) {
    return (
      <StudyStage
        color="var(--line-kanji)"
        onLeave={leave}
        leaveLabel={t.kanjiTitle}
        where={`${t.kanjiTitle} ${level}`}
        sub={t.modeReview}
      >
          <ReviewDeck
            foot={`${t.kanjiTitle} ${level}`}
            cards={reviewCards}
            loading={reviewLoading}
            t={t}
            session={session}
            dictCategory="kanji"
            dictTerm={c => c.kanji}
            onReplaySound={c => speakJapanese(c.kana)}
            renderFront={c => <CharDisplay char={c.kanji} size={100} />}
            renderBack={c => (
              <InlineReveal t={t} kana={c.kana} main={<MeaningDisplay meaning={c.meaning} size={28} />} />
            )}
            onExit={leave}
          />
      </StudyStage>
    )
  }

  // ── Quiz ──
  const isKjToM = card?.direction === 'f2b'
  // Only the hints this card could actually build — a mode may declare
  // indice_1 while a particular card has no distractors to offer.
  const availableHints = Object.keys(card?.hints ?? {})
  const showChoices = activeHints.has('indice_1') && Array.isArray(card?.hints?.indice_1)

  const title = modeLabel(t, mode)
  // Study.dc.html's footer strip.
  const cardFoot = { left: level ? `${level} 漢字` : '漢字', right: title }
  const sourceLabel = studyBy === 'level' ? level : tierLabel
  // Which UI this mode needs, from the registry rather than a string
  // comparison against one key ('write') that used to stand in for it.
  const renderer = STUDY_MODES[mode]?.renderer ?? RENDER.FLASHCARD
  const isRadical = STUDY_MODES[mode]?.base === 'radical'

  return (
    <StudyStage
      color="var(--line-kanji)"
      onLeave={leave}
      leaveLabel={t.kanjiTitle}
      where={`${t.kanjiTitle} ${sourceLabel}`}
      sub={title}
      aside={usesWritingDrill(mode) ? (
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

        {card && !loading && (
          <>
            <HintBar available={availableHints} active={activeHints}
                     onToggle={toggleHint} disabled={gates.locked} />
            <CardTransition
              className="specimen-card-stage"
              cardKey={card.card_id}
              contentKey={`${card.card_id}:${card.lang ?? ''}`}
              stamp={gates.stamp}
              stage={card.stage}
              onStampDone={gates.stampDone}
            >
              {renderer === RENDER.TYPE ? (
                /* readings — the kanji is shown, every reading is typed
                   into ReadingsInput below. No flip: the answer is not one
                   thing to uncover but a set the learner produces. */
                <PromptCard foot={cardFoot}>
                  <CharDisplay char={card.kanji} size={100} />
                  <RevealActions
                    t={t}
                    revealed={answered}
                    resetKey={card.card_id}
                    dictTerm={card.kanji}
                    dictCategory="kanji"
                    session={session}
                    onReplaySound={() => speakJapanese(card.kana)}
                  />
                </PromptCard>
              ) : isRadical ? (
                /* radical — the kanji is shown, the radical it is filed
                   under is the answer. Same flip/choices split as the
                   meaning flashcards above it. */
                <PromptCard foot={cardFoot}>
                  {!showChoices && (
                    <Flashcard
                      t={t}
                      resetKey={card.card_id}
                      onReveal={onFlashcardReveal}
                      front={<CharDisplay char={card.kanji} size={100} />}
                      back={
                        /* The kanji stays on the back, dimmed. Flipping
                           it away left the answer with nothing to be an
                           answer ABOUT — and on the cards where the
                           radical is the kanji, an unchanged-looking
                           card. */
                        <div className="radical-reveal">
                          <div className="radical-reveal__kanji" lang="ja">{card.kanji}</div>
                          <RadicalAnswer radical={card.radical} t={t} />
                        </div>
                      }
                      dictTerm={card.kanji}
                      dictCategory="kanji"
                      session={session}
                      onReplaySound={() => speakJapanese(card.kana)}
                    />
                  )}
                  {showChoices && (
                    <>
                      <CharDisplay char={card.kanji} size={100} />
                      {answered && <RadicalAnswer radical={card.radical} t={t} />}
                      <RevealActions
                        t={t}
                        revealed={answered}
                        resetKey={card.card_id}
                        dictTerm={card.kanji}
                        dictCategory="kanji"
                        session={session}
                        onReplaySound={() => speakJapanese(card.kana)}
                      />
                    </>
                  )}
                </PromptCard>
              ) : renderer !== RENDER.DRAW ? (
                <PromptCard foot={cardFoot}>
                  {!showChoices && (
                    <Flashcard
                      t={t}
                      resetKey={card.card_id}
                      onReveal={onFlashcardReveal}
                      front={
                        isKjToM
                          ? <CharDisplay char={card.kanji} size={100} />
                          : <MeaningDisplay meaning={card.meaning} size={44} />
                      }
                      back={
                        <InlineReveal
                          t={t}
                          kana={card.kana}
                          isLarge={isKjToM}
                          main={
                            isKjToM
                              ? <MeaningDisplay meaning={card.meaning} size={28} />
                              : <CharDisplay char={card.kanji} size={72} />
                          }
                        />
                      }
                      dictTerm={card.kanji}
                      dictCategory="kanji"
                      session={session}
                      onReplaySound={() => speakJapanese(card.kana)}
                    />
                  )}

                  {showChoices && (
                    <>
                      <InlineReveal
                        t={t}
                        kana={card.kana}
                        revealed={answered}
                        main={
                          isKjToM
                            ? <CharDisplay char={card.kanji} size={100} />
                            : <MeaningDisplay meaning={card.meaning} size={44} />
                        }
                      />
                      <RevealActions
                        t={t}
                        revealed={answered}
                        resetKey={card.card_id}
                        dictTerm={card.kanji}
                        dictCategory="kanji"
                        session={session}
                        onReplaySound={() => speakJapanese(card.kana)}
                      />
                    </>
                  )}
                </PromptCard>
              ) : (
                <PromptCard foot={cardFoot}>
                  <MeaningDisplay meaning={card.meaning} size={32} />
                  {card.kana && (
                    <div className="quiz-subtitle">({card.kana})</div>
                  )}
                  <RevealActions
                    t={t}
                    revealed={answered}
                    resetKey={card.card_id}
                    dictTerm={card.kanji}
                    dictCategory="kanji"
                    session={session}
                    onReplaySound={() => speakJapanese(card.kana)}
                  />
                </PromptCard>
              )}
            </CardTransition>

            {showChoices && isRadical && (
              <MCQGrid
                choices={(card.hints?.indice_1 ?? []).map(c => c.char)}
                correct={card.radical?.char}
                formatChoice={radicalChoiceRenderer(card.hints?.indice_1 ?? [])}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {showChoices && !isRadical && (
              <MCQGrid
                choices={(card.hints?.indice_1 ?? []).map(c => isKjToM ? c.meaning : c.kanji)}
                correct={isKjToM ? card.meaning : card.kanji}
                formatChoice={isKjToM ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {renderer === RENDER.TYPE && (
              <ReadingsInput
                key={card.card_id}
                readings={card.readings}
                submitted={answered}
                onSubmit={onFlashcardReveal}
              />
            )}

            {renderer === RENDER.DRAW && card.kanji && (
              <DrawingQuiz
                kanji={card.kanji}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={card.card_id}
                onValidate={() => {
                  setAnswered(true)
                  setShowRating(true)
                  speakJapanese(card.kana)
                }}
              />
            )}

            <RatingBar active={showRating && !gates.locked} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay
                kanji={card.kanji}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={card.card_id}
                meaning={formatGlossLine(card.meaning)}
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
