import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { TopBar } from '../components/ui/TopBar'
import RatingBar from '../components/study/RatingBar'
import { MCQGrid, DoneMessage, DeckProgress } from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import { radicalChoiceRenderer } from '../components/study/radicalChoiceRenderer'
import { formatGlossLine } from '../components/study/gloss'
import { Loading } from '../components/ui/Loading'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import { useReviewGates } from '../hooks/useReviewGates'
import ModeSelector from '../components/selection/ModeSelector'
import SelectionScreen from '../components/selection/SelectionScreen'
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
  modeLabel, modeDesc, usesWritingDrill,
} from '../domain/studyModes'
import HintBar from '../components/study/HintBar'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'
import { ChevronIcon, PencilIcon } from '../components/ui/Icons'

// The 8s fetch timeout that used to live here is gone: useCardSession
// owns the abort signal and the timeout now (10s, matched to the cold
// start it was always meant to bridge), so the five screens no longer
// each hand-roll a controller that only ever timed out and never
// aborted on unmount.

// ── Deck modes come from the deck's STRUCTURE ──────────────
// A deck has one structure, so /api/decks/{id}/modes returns that
// structure's registry keys directly and this screen renders them with
// the registry's own labels — pulled from the exact same picker
// functions Kanji/Vocab/Grammar screens use, so a mode's text is never
// out of sync with what it actually looks like once you're inside it.
//
// One key still means one SRS track, one set of stats and one
// review_preview. What a review consumes is the learner's own 1-4
// self-rating, which means the same thing whether or not a hint
// happened to be on screen.

export default function StudyScreen({ session }) {
  const { t, lang } = useLang()
  const navigate     = useNavigate()
  const { deck_id }  = useParams()
  const { state }    = useLocation()

  // Falls back to fetching the deck when opened without router state (a
  // refresh, a direct link) — same fallback DeckDetailScreen already
  // has, needed here too now that the writing-practice toggle depends
  // on knowing the deck's actual structure rather than guessing from
  // whatever cards happened to load first.
  const [deck, setDeck] = useState(state?.deck ?? null)
  useEffect(() => {
    if (deck) return
    apiFetch(`/api/decks/${deck_id}`, session)
      .then(r => r.json())
      .then(d => { if (!d?.error) setDeck(d) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id])

  // A deck's available modes come from its structure (see decks.py's
  // get_deck_modes) — every graded key that structure's source offers,
  // provided the deck actually has a card.
  const [availableModes, setAvailableModes] = useState([])
  const [modesLoaded, setModesLoaded]       = useState(false)
  const [mode, setMode]                     = useState(null)

  useEffect(() => {
    if (!deck_id) return
    apiFetch(`/api/decks/${deck_id}/modes`, session)
      .then(r => r.json())
      .then(data => {
        const keys = data.modes?.length ? data.modes : []
        setAvailableModes(keys.map(key => ({
          key,
          label: modeLabel(t, key),
          desc: modeDesc(t, key),
        })))
      })
      .catch(() => setAvailableModes([]))
      .finally(() => setModesLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id, session])

  const [answered, setAnswered]       = useState(false)
  // Hints switched on for the card in hand. Session-wide, so it stays
  // where the learner put it, and switchable mid-card — the point at
  // which they actually know whether they need the options.
  const [activeHints, setActiveHints] = useState([])
  const [selected, setSelected]       = useState(null)
  const [showRating, setShowRating]   = useState(false)
  // indice_2's own translation reveal (grammar only) — see GrammarScreen.
  const [showEx, setShowEx]           = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  const [progress, setProgress]       = useState(null)
  // Bumped every single time advance() actually runs (see the
  // useReviewGates call below) — independent of whether the served card_id
  // happens to be different. Everything that resets "for a new card"
  // (the UI-state effect below, Flashcard's resetKey, RevealActions'
  // resetKey) now keys off `${card_id}:${cardNonce}` instead of
  // card_id alone. This is the actual guarantee: even in the one
  // scenario nothing else here can fully rule out — the backend
  // handing back the exact same card_id — the screen still visibly
  // resets to a fresh, unrevealed card with the rating bar showing,
  // because the nonce changed regardless.
  const [cardNonce, setCardNonce]     = useState(0)


  // useCardSession's own exclude list only protects cards still
  // sitting unreviewed in its local queue — the card just answered
  // has already been popped out via advance() by the time a refill
  // runs, so it's not in there. The review POST for it is
  // fire-and-forget (see postReview), so there's a real window where
  // a refill reaches the backend before that POST has actually
  // committed the card's new next_review date — and the backend,
  // still seeing it as due, serves the exact same card right back.
  // Since the reset effect below keys off card_id, an unchanged id
  // means nothing resets: same revealed face, hidden rating bar,
  // frozen. This is what actually closes that gap: a short-lived
  // memory of "just reviewed" ids, always merged into the exclude
  // list regardless of what's still in the queue. Cleared per id
  // after a few seconds — plenty long for the POST to have landed.
  const recentlyReviewedRef = useRef(new Map())

  function markReviewed(cardId) {
    recentlyReviewedRef.current.set(cardId, true)
    setTimeout(() => recentlyReviewedRef.current.delete(cardId), 8000)
  }



  // v3: bumped alongside this screen's field-name-adapter rewrite — a
  // cached batch from before it has the same shape but the WRONG one
  // was being trusted (front/back regardless of direction); resuming
  // it would put a stale, still-backwards card back on screen instead
  // of fetching a corrected one.
  const storageKey = mode ? sessionKey('deck', deck_id, mode) : IDLE_KEY

  const paceCtl = usePace(storageKey)

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!mode) return []
    const data = paceCtl.capture(await apiJson(
      `/api/decks/${deck_id}/study?mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}${paceCtl.query}`,
      session,
      { signal },
    ))
    return data.cards ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id, mode, lang, session, paceCtl.query, paceCtl.capture])

  // The just-reviewed set is merged into the exclude list by the hook
  // itself now (extraExcludeIds), so every screen gets the protection
  // this one had hand-rolled inside its own fetchBatch.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`answered` are also set mid-flow elsewhere in this screen (hidden/toggled immediately on user action, independent of the card actually changing) — see the other setShowRating/setAnswered call sites below. Moving this into a key-remounted child would need that mid-flow logic threaded back down too, a bigger restructure than this reset justifies.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowEx(false)
    setShowDrawing(false)
    setActiveHints([])
  }, [card?.card_id, cardNonce])


  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // mode. Fetched independently from the card so it never blocks or
  // slows down card navigation.
  function loadProgress(m) {
    apiFetch(`/api/decks/${deck_id}/stats?mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startSession(m) {
    setMode(m)
    // Start with no hints: the point is to try recalling first and reach
    // for the options when you actually need them, not the other way round.
    setActiveHints([])
    loadProgress(m)
  }


  function postReview(quality) {
    if (!card) return

    // Same writing-drill trigger as KanjiScreen: only meaningful when
    // struggling to recall a kanji from its meaning. Keyed on the
    // card's STRUCTURE, not its source — a hand-written kanji card
    // wants the same drill a browsed-in one gets, which the old
    // `card.source === 'builtin_kanji'` check silently denied it. It
    // rides as a gate of this screen's own, released when the drill is
    // dismissed (see DrawingOverlay's onDone below).
    const needTraining =
      quality <= 3 && structureKeyOf(card) === 'kanji' && card.direction === 'b2f' && drawingEnabled

    // The gates own the lock, so a review already in flight is refused
    // here rather than half-fired: everything below is this screen's
    // own business, and none of it should run twice. The stamp's key
    // carries the nonce because this screen's transition key does — the
    // backend can hand the same card_id straight back, and a stamp
    // keyed on the id alone would be offered to a card the transition
    // has already stopped treating as the same one.
    if (!gates.review(card.review_preview?.[quality], {
      cardKey: `${card.card_id}:${cardNonce}`, quality,
      hold: needTraining ? ['training'] : [],
    })) return

    setShowRating(false)
    if (needTraining) setShowDrawing(true)
    loadProgress(mode)

    // Close the exclude-list race described above: from this point on,
    // any refill (even one already in flight) must not be able to hand
    // this exact card back.
    markReviewed(card.card_id)

    // Fire-and-forget — the response isn't read for anything the UI
    // shows, same as Kana/Kanji/Vocab/Grammar's own review calls.
    apiFetch(`/api/decks/${deck_id}/review`, session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality, prev_stage: card.stage }),
    }).catch(() => {})
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

  // ── Mode selection ──
  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/decks')} title={deck?.name ?? t.deckFallbackTitle} autoHide />
        {/* No `heading` — /decks/:id/study resolves to 教材 station by
            prefix now (see config/stations.js), so the plate names the
            screen and a "Choose your training mode" title under it
            would just be saying it twice. */}
        <main id="main-content">
          <SelectionScreen>
            {!modesLoaded && <Loading />}
            {modesLoaded && availableModes.length === 0 && (
              <div className="quiz-done">{t.noCards}</div>
            )}
            {modesLoaded && availableModes.length > 0 && (
              <ModeSelector modes={availableModes} onSelect={m => board(() => startSession(m))} />
            )}
          </SelectionScreen>
        </main>
      </div>
    )
  }

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
    : undefined

  return (
    <div className="screen">
      <TopBar
        onBack={() => setMode(null)}
        title={`${deck?.name ?? ''} — ${title}`}
        autoHide
        // The toggle is keyed on the DECK's structure, not on whether
        // any browsed-in kanji cards happen to be present — a deck made
        // entirely of hand-written kanji cards used to never show it at
        // all, since `composition.kanji` only ever counted the former.
        actions={deck?.type === 'kanji' && usesWritingDrill(mode) && (
          <button
            onClick={() => setDrawingEnabled(d => !d)}
            className={`btn-writing-toggle ${drawingEnabled ? 'btn-writing-toggle--on' : 'btn-writing-toggle--off'}`}
            title={t.toggleWriting}
          >
            <PencilIcon size={14} /> {drawingEnabled ? t.writingOn : t.writingOff}
          </button>
        )}
      />
      <XpToast toast={gates.xpToast} onDone={gates.toastDone} />
      {/* 蘇芳 — a personal deck is 教材, so this screen wears the same
          pigment as Decks and DeckDetail. Per DESIGN.md's "the pigment
          is injected once"; see DecksScreen's comment for why it sits
          on <main> and not on .screen. */}
      <main id="main-content" className="container quiz-area"
        style={{ '--line-color': 'var(--line-decks)' }}>
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={() => setMode(null)} pace={paceCtl.pace}
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
      </main>
    </div>
  )
}
