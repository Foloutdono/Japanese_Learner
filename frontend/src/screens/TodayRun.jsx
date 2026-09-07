import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { StudyStage } from '../components/study/StudyStage'
import { Loading } from '../components/ui/Loading'
import { CardTransition } from '../components/study/CardTransition'
import { useReviewGates } from '../hooks/useReviewGates'
import { MCQGrid, TypeInput } from '../components/study/QuizComponents'
import { DrawingQuiz } from '../components/study/DrawingCanvas'
import ReadingsInput from '../components/study/ReadingsInput'
import RatingBar from '../components/study/RatingBar'
import HintBar from '../components/study/HintBar'
import SessionError from '../components/study/SessionError'
import CardPrompt from '../components/study/CardPrompt'
import { radicalChoiceRenderer } from '../components/study/radicalChoiceRenderer'
import { ChevronIcon } from '../components/ui/Icons'
import { normalizeCard, cardShape, availableHintsFor, wordForm } from '../domain/cardShape'
import { RENDER, HINTS, modeLabel } from '../domain/studyModes'
import { LINE_COLOR } from '../config/tabs'
import { postReview as sendReview } from '../lib/reviews'
import { useTodaySummary, refreshToday } from '../stores/today'
import { laneWhere as whereOf, laneTypeOf } from '../domain/lanes'
import { kanaSetLabel } from '../domain/kanaSets'
import { useCardSession, sessionKey } from '../hooks/useCardSession'
import { formatGlossLine } from '../components/study/gloss'
import { romajiEquals } from '../lib/romaji'

// ── 本日の運行 — the run (plan 070) ───────────────────────────
// The day's queue on the stage: everything due, across every section
// and every personal deck, in one session with no level or mode to
// pick. The gate (screens/TodayScreen.jsx) chose the lanes; they
// arrive in the query (`?lanes=a,b`, absent when every lane is on).
//
// It differs from the five section screens in exactly one way that
// matters, and everything below follows from it: THE MODE IS PER CARD.
// A section session holds one mode for its whole life, so it can put the
// mode in a variable and derive the renderer, the direction and the
// answer widget from it once. Here the next card can be a kanji writing
// drill after a grammar multiple-choice, so all of that is read off
// `card.mode` — which is what domain/cardShape.js does, and why
// components/study/CardPrompt.jsx was extracted rather than copied.
//
// The consequence to keep in view: the review must be posted under the
// mode the card was SERVED in. Post it under anything else and the SRS
// advances a different row than the learner answered.

/** The card's footer strip: where it is from on the left, in the words
 *  the gate used for the lane, and the mode it is served in on the
 *  right. A mixed queue has to say this per card, or a kanji writing
 *  prompt after a grammar question reads as the app losing its place. */
function laneFoot(card, t) {
  const lane = card?.lane
  if (!lane) return undefined
  return { left: whereOf(lane, t, kanaSetLabel), right: modeLabel(t, card.mode) }
}

/** The stage floor every section screen gives its card, by structure:
 *  the boosts for vocab and grammar, the specimen floor for kana and
 *  kanji (see index.css), so a card in the queue holds still on reveal
 *  exactly as it does on its own screen. */
function stageClassFor(structureKey) {
  if (structureKey === 'vocab') return 'vocab-card-boost'
  if (structureKey === 'grammar') return 'grammar-card-boost'
  if (structureKey === 'kana' || structureKey === 'kanji') return 'specimen-card-stage'
  return undefined
}

export default function TodayRun({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const [params] = useSearchParams()
  // The gate's choice. Sorted so the same selection always produces
  // the same string — the session key is built from it.
  const laneParam = (params.get('lanes') ?? '').split(',').filter(Boolean).sort().join(',')
  const allChosen = laneParam === ''
  const chosenIds = useMemo(() => new Set(laneParam.split(',').filter(Boolean)), [laneParam])

  // The shared summary (the tab badge reads the same one): the run's
  // total for the remaining pill, next_due for the finish. It may
  // still be on its way — the run does not wait for it.
  const { data: summary } = useTodaySummary()
  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [activeHints, setActiveHints] = useState([])
  const [typed, setTyped] = useState('')
  // indice_2's own translation reveal (grammar only).
  const [showEx, setShowEx] = useState(false)
  const [cardNonce, setCardNonce] = useState(0)
  const [cleared, setCleared] = useState(0)
  // What the run paid, for the fare slip at the end (plan 069).
  const [xpTotal, setXpTotal] = useState(0)

  const recentlyReviewedRef = useRef(new Map())

  // A card is identified by (id, mode) throughout: the same kanji can be
  // due as a flashcard AND as a writing drill, and those are two cards
  // here even though they share an id. See useCardSession's cardKey.
  const cardKey = useCallback(c => `${c.card_id}|${c.mode}`, [])

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    const data = await apiJson(
      `/api/today/cards?lang=${lang}&count=${count}`
      + `&exclude=${encodeURIComponent(excludeIds.join(','))}`
      // Omitted when everything is chosen: an empty `lanes` already
      // means the whole queue on the backend, and sending the full list
      // would make the session key churn as lanes empty out mid-run.
      + (allChosen ? '' : `&lanes=${encodeURIComponent(laneParam)}`),
      session,
      { signal },
    )
    return data.cards ?? []
  }, [lang, session, laneParam, allChosen])

  const extraExcludeIds = useCallback(
    () => Array.from(recentlyReviewedRef.current.keys()),
    [],
  )

  const { current: card, loading, done, error, retry, advance } = useCardSession({
    // The choice is part of the key: picking different lanes is a
    // different session, and resuming the previous one's cached queue
    // would serve cards from lanes the learner just switched off.
    storageKey: sessionKey('today', allChosen ? 'all' : laneParam),
    fetchBatch,
    batchSize: 10,
    cardKey,
    extraExcludeIds,
  })
  // The key CardTransition crossfades on, and the one any stamp routed
  // onto it must carry. ONE expression, because the two are compared
  // for equality: a stamp whose key does not match the live card is
  // never rendered, and the gate it opened is never closed. This
  // screen had two — `cardKey(card)` above (id|mode, no nonce) against
  // an inline `id:mode:nonce` — which can never be equal, so every
  // promotion stamp here was invisible and every stamped review hung
  // on the 4s safety net, or forever when it also levelled you up
  // (that path arms no timer at all).
  const transitionKey = card ? `${card.card_id}:${card.mode}:${cardNonce}` : null

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this is an id-keyed reset in shape, but `showRating` (and to a lesser extent `answered`) is also set mid-flow by postReview() below, independent of a card actually changing (it hides the rating bar the instant a rating is tapped, before checkAdvance()'s gates clear and the card actually swaps) — moving these into a key-remounted child would need postReview's mid-review-flow state changes threaded back down into that child too, which is a bigger restructure than this reset justifies. See postReview below.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setActiveHints([])
    setTyped('')
    setShowEx(false)
  }, [card?.card_id, card?.mode, cardNonce])

  // The finish is the gate's to print (screens/TodayScreen.jsx, the
  // canvas's RunComplete under the chrome): once the queue is
  // genuinely empty — never on a failed fetch, which the error branch
  // below owns — the run refetches the shared summary the tab badge
  // reads (a minute behind otherwise) and goes back with its figures.
  const finished = !error && (done || (!loading && !card))
  useEffect(() => {
    if (!finished) return
    if (cleared > 0) refreshToday()
    navigate('/today', { replace: true, state: cleared > 0 ? { run: { cleared, xp: xpTotal } } : null })
  }, [finished, cleared, xpTotal, navigate])

  // Every screen's rating flow: the lock, the gates the celebrations
  // open, and the advance once they all close. See hooks/useReviewGates.
  // The nonce rides along with the pop, so a card handed back under the
  // same id still resets to a fresh, unrevealed one. This screen has no
  // picker of its own, so its session key is constant — leaving it
  // unmounts the screen and takes the gates with it.
  const gates = useReviewGates({
    advance: useCallback(() => { advance(); setCardNonce(n => n + 1) }, [advance]),
    sessionKey: 'today',
  })

  const nc = card ? normalizeCard(card) : null
  const { structureKey, renderer, isRadical, isFill, isF2B } = cardShape(nc ?? {})
  const cardHints = nc?.hints ?? {}
  const availableHints = availableHintsFor(nc)
  const choicesOn = activeHints.includes(HINTS.CHOICES) && Array.isArray(cardHints[HINTS.CHOICES])
  const sentencesOn = activeHints.includes(HINTS.SENTENCES) && Array.isArray(cardHints[HINTS.SENTENCES])

  function toggleHint(key) {
    setActiveHints(hs => {
      if (hs.includes(key)) return structureKey === 'grammar' ? [] : hs.filter(h => h !== key)
      return structureKey === 'grammar' ? [key] : [...hs, key]
    })
  }

  function markReviewed(key) {
    recentlyReviewedRef.current.set(key, true)
    setTimeout(() => recentlyReviewedRef.current.delete(key), 8000)
  }


  function reveal() {
    setAnswered(true)
    setShowRating(true)
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    reveal()
  }

  function postReview(quality) {
    if (!card) return

    // The gates own the lock, so a review already in flight is refused
    // here rather than half-fired: everything below is this screen's
    // own business, and none of it should run twice. The stamp is keyed
    // on the transition's own key, not the bare card id — this queue is
    // mixed-mode and carries the same card under two of them, and a
    // stamp keyed on the id alone was once handed to a transition that
    // could never match it, which hung every stamped review.
    if (!gates.review(card.review_preview?.[quality], {
      cardKey: transitionKey, quality,
    })) return

    setShowRating(false)

    // From here on no refill, even one already in flight, may hand this
    // exact card back. Keyed by (id, mode) like everything else in this
    // session — excluding the bare id would also suppress the same
    // card's OTHER due mode, which the learner has not answered.
    markReviewed(cardKey(card))
    setCleared(n => n + 1)
    setXpTotal(x => x + (card.review_preview?.[quality]?.xp_earned ?? 0))

    // The mode travels with the card, never from screen state — see the
    // note at the top of this file. Fire-and-forget, same as every other
    // screen's review call; lib/reviews charges the fare and raises the
    // run-out sheet on a 402 (plan 069).
    sendReview('/api/today/review', session, {
      card_id: card.card_id,
      mode: card.mode,
      quality,
      prev_stage: card.stage ?? null,
    }, { cleared: cleared + 1 }).catch(() => {})
  }

  // Left in this run: the chosen lanes' due, less what this session
  // cleared. Null (no pill) until the summary is in.
  const chosenDue = summary
    ? (allChosen ? (summary.total ?? 0)
      : (summary.lanes ?? []).filter(l => chosenIds.has(l.id)).reduce((n, l) => n + l.due, 0))
    : null
  const remaining = chosenDue == null ? null : Math.max(0, chosenDue - cleared)

  // The stage's words: where the card in hand is from, in the words
  // the gate used, and the mode it is served in. Before a card, the
  // run's own name. The pigment is per CARD, not per screen (every
  // other study screen names one section; this queue draws a kanji
  // card, then grammar, then a personal deck).
  const where = card?.lane ? whereOf(card.lane, t, kanaSetLabel) : t.todayTitle
  const sub = card ? modeLabel(t, card.mode) : undefined
  const color = card?.lane ? LINE_COLOR[laneTypeOf(card.lane)] : undefined
  const pct = chosenDue ? Math.min(100, Math.round((100 * cleared) / chosenDue)) : 0

  return (
    <StudyStage
      color={color}
      onLeave={() => navigate('/today')}
      leaveLabel={t.stageGate}
      where={where}
      sub={sub}
      remaining={remaining}
      toast={gates.xpToast}
      onToastDone={gates.toastDone}
    >
      {/* The run's own hairline: what this session has cleared of what
          it set out to, in the day's gold. A mixed queue has no
          per-deck stage split to draw, so the bar is the run's. */}
      {chosenDue > 0 && (
        <div className="deck-progress" aria-hidden="true">
          <div className="deck-progress__bar">
            <div className="deck-progress__segment" style={{ width: `${pct}%`, background: 'var(--accent2)' }} />
          </div>
        </div>
      )}

      {error && !card && <SessionError error={error} onRetry={retry} />}
      {loading && !card && <Loading />}

        {card && (
          <>
            {/* The help switch sits above the card, which is where the
                section screens put it. Below the card it was past the
                fold on a drawing mode, so the one control that rescues
                a card you cannot answer was hidden exactly when you
                needed it. Where the card is from is on its own footer
                strip (see laneFoot), as on every other study card. */}
            {availableHints.length > 0 && (
              <HintBar
                available={availableHints} active={activeHints}
                onToggle={toggleHint} disabled={gates.locked}
              />
            )}

            <CardTransition
              className={stageClassFor(structureKey)}
              cardKey={transitionKey}
              stamp={gates.stamp}
              stage={card.stage}
              onStampDone={gates.stampDone}
            >
              <CardPrompt
                card={nc} t={t} session={session}
                answered={answered} cardNonce={cardNonce}
                activeHints={activeHints} onFlashcardReveal={reveal}
                foot={laneFoot(card, t)}
              />
            </CardTransition>

            {/* Every MCQ block below mirrors the section screens exactly
                — the choices are flattened to whichever side is not the
                prompt, which is a per-structure decision the payload
                does not make for us. */}
            {structureKey === 'kana' && choicesOn && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={nc.direction === 'b2f' ? nc.kana : nc.romaji}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'kanji' && isRadical && choicesOn && (
              <MCQGrid
                choices={(cardHints[HINTS.CHOICES] ?? []).map(c => c.char)}
                correct={nc.radical?.char}
                formatChoice={radicalChoiceRenderer(cardHints[HINTS.CHOICES] ?? [])}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'kanji' && !isRadical && choicesOn && (
              <MCQGrid
                choices={(cardHints[HINTS.CHOICES] ?? []).map(c => isF2B ? c.meaning : c.kanji)}
                correct={isF2B ? nc.meaning : nc.kanji}
                formatChoice={isF2B ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'vocab' && choicesOn && (
              <MCQGrid
                choices={(cardHints[HINTS.CHOICES] ?? []).map(c => isF2B ? c.meaning : wordForm(c))}
                correct={isF2B ? nc.meaning : wordForm(nc)}
                formatChoice={isF2B ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'grammar' && choicesOn && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={isFill || !isF2B ? nc.grammar : nc.meaning}
                formatChoice={isFill || !isF2B ? undefined : formatGlossLine}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'standard' && choicesOn && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={isF2B ? nc.back : nc.front}
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

            {/* kanji.readings — every on'yomi/kun'yomi typed in,
                self-graded against the full accepted list on submit. */}
            {structureKey === 'kanji' && renderer === RENDER.TYPE && (
              <ReadingsInput
                key={`${card.card_id}:${cardNonce}`}
                readings={nc.readings}
                submitted={answered}
                onSubmit={reveal}
              />
            )}

            {/* kana.write_romaji — the one typed answer the app checks
                itself, leniently, as feedback beside the self-rating. */}
            {structureKey === 'kana' && renderer === RENDER.TYPE && (
              <TypeInput
                value={typed} onChange={setTyped} onSubmit={reveal}
                submitted={answered} answer={nc.romaji}
                isCorrect={romajiEquals(typed, nc.romaji)}
              />
            )}

            {renderer === RENDER.DRAW && (
              <DrawingQuiz
                kanji={structureKey === 'kana' ? nc.kana : nc.kanji}
                meaning={structureKey === 'kana' ? nc.romaji : formatGlossLine(nc.meaning)}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={`${card.card_id}:${cardNonce}`}
                onValidate={reveal}
              />
            )}

            <RatingBar active={showRating && !gates.locked} onRate={postReview} />
          </>
        )}
    </StudyStage>
  )
}
