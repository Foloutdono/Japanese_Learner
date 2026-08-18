import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { TopBar } from '../components/ui/TopBar'
import RatingBar from '../components/study/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, CharDisplay, MeaningDisplay, RevealActions,
} from '../components/study/QuizComponents'
import { FuriganaWord } from '../components/study/Readings'
import { GrammarRule, GrammarAnswer } from '../components/study/GrammarPieces'
import { RadicalAnswer } from '../components/study/RadicalPieces'
import { radicalChoiceRenderer } from '../components/study/radicalChoiceRenderer'
import { formatGlossLine } from '../components/study/gloss'
import { Loading } from '../components/ui/Loading'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import ModeSelector from '../components/selection/ModeSelector'
import SelectionScreen from '../components/selection/SelectionScreen'
import PromptCard from '../components/study/PromptCard'
import SessionError from '../components/study/SessionError'
import ReadingsInput from '../components/study/ReadingsInput'
import { DrawingQuiz, DrawingOverlay } from '../components/study/DrawingCanvas'
import { speakJapanese } from '../lib/audio'
import {
  MODES as STUDY_MODES, RENDER, HINTS,
  modeLabel, modeDesc, usesWritingDrill,
} from '../domain/studyModes'
import HintBar from '../components/study/HintBar'
import { applyXpGain } from '../stores/profileSummary'
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

// The written form to quiz/display on — mirrors Kanji/VocabScreen's own
// wordForm: some vocab entries are kana-only (no kanji), and this also
// doubles as "the kanji itself" for kanji entries/choices, which always
// have a `kanji` field.
function wordForm(entry) {
  return entry?.kanji || entry?.kana || ''
}

// ── Which structure a card is actually studying as ──────────────
// A browsed-in app card already carries this as its source
// ('builtin_kanji' → 'kanji'); a personal card carries it directly as
// `structure` (see study/structures.py — a deck has ONE structure, and
// every personal card in it takes that shape). One function so the
// render body never has to spell out the `source === 'custom' ? … :
// …` branch itself more than once.
function structureKeyOf(card) {
  if (!card) return null
  return card.source === 'custom' ? card.structure : card.source?.replace('builtin_', '')
}

// A kanji-range test, not a script one — used only to tell a personal
// vocab card's kana-only word ("ねこ") apart from one with kanji in it
// ("猫"), the same distinction eligible_for()/wordForm() make for the
// app's own deck.
const KANJI_RANGE = /[㐀-鿿]/

// ── Field-name adapter ───────────────────────────────────────────
// A browsed-in app card already has kanji/kana/meaning (or grammar/
// structure) at the top level of its payload; a personal card of the
// matching structure carries the same information under `card.fields`,
// keyed by THAT structure's own field names (a kanji card calls them
// kanji/meaning, a grammar card calls them rule/meaning — see
// study/structures.py). This projects a personal card onto the exact
// shape its app-sourced counterpart already has, so every renderer
// below reads `card.kanji`/`card.meaning`/`card.grammar` regardless of
// where the card actually came from, instead of branching on
// card.source at every single field access — which is what let the
// direction bug hide here in the first place: renderCustomPrompt used
// to read `card.front`/`card.back` UNCONDITIONALLY, so a "meaning →
// word" session always showed the word first no matter what the mode
// asked for, because nothing here ever looked at `card.direction` for
// a personal card.
//
// readings/radical/furigana/hints/kana — the mode-specific extras — are
// already attached at the top level by decks.py for BOTH sources (see
// _custom_card_extras there), so nothing here needs to touch those.
function normalizeCard(card) {
  if (!card || card.source !== 'custom') return card
  const f = card.fields || {}
  if (card.structure === 'kanji') {
    return { ...card, kanji: f.kanji ?? '', meaning: f.meaning ?? '' }
  }
  if (card.structure === 'vocab') {
    const word = f.word ?? ''
    const hasKanji = KANJI_RANGE.test(word)
    return {
      ...card,
      kanji: hasKanji ? word : '',
      // decks.py sets `kana` from the optional `reading` field when one
      // was given; a kana-only word is already its own reading.
      kana: card.kana || (hasKanji ? '' : word),
      meaning: f.meaning ?? '',
    }
  }
  if (card.structure === 'grammar') {
    // `structure` on the raw payload is the DECK's structure key
    // ('grammar') — GrammarAnswer wants the explanation TEXT there
    // instead (a personal card has none to give), so it is overwritten
    // rather than read.
    return { ...card, grammar: f.rule ?? '', structure: '', meaning: f.meaning ?? '' }
  }
  return card // 'standard' needs no projection — front/back already are its own fields
}

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
  const [xpToast, setXpToast]         = useState(null)
  const [cardStamp, setCardStamp]     = useState(null)
  const [locked, setLocked]           = useState(false)
  // Bumped every single time advance() actually runs (see
  // checkAdvance) — independent of whether the served card's card_id
  // happens to be different. Everything that resets "for a new card"
  // (the UI-state effect below, Flashcard's resetKey, RevealActions'
  // resetKey) now keys off `${card_id}:${cardNonce}` instead of
  // card_id alone. This is the actual guarantee: even in the one
  // scenario nothing else here can fully rule out — the backend
  // handing back the exact same card_id — the screen still visibly
  // resets to a fresh, unrevealed card with the rating bar showing,
  // because the nonce changed regardless.
  const [cardNonce, setCardNonce]     = useState(0)

  // Same gating scheme as Kana/Kanji/Vocab/Grammar — see those
  // screens' own comments for the full rationale.
  const pendingGatesRef = useRef(new Set())
  const advancedRef     = useRef(false)
  // Belt-and-suspenders: if some gate (toast/stamp/training) never
  // actually clears — a toast that doesn't mount for an edge-case
  // payload, a drawing overlay dismiss that doesn't fire its onDone,
  // anything — the session used to just sit there forever: answered
  // card, no rating bar, nothing to do. This forces every gate open
  // and advances anyway once too much time has passed, so a stuck
  // gate costs a skipped animation, not a frozen quiz.
  const safetyTimerRef  = useRef(null)

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

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  useEffect(() => () => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
  }, [])

  // v3: bumped alongside this screen's field-name-adapter rewrite — a
  // cached batch from before it has the same shape but the WRONG one
  // was being trusted (front/back regardless of direction); resuming
  // it would put a stale, still-backwards card back on screen instead
  // of fetching a corrected one.
  const storageKey = mode ? sessionKey('deck', deck_id, mode) : IDLE_KEY

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!mode) return []
    const data = await apiJson(
      `/api/decks/${deck_id}/study?mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`,
      session,
      { signal },
    )
    return data.cards ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id, mode, lang, session])

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

  useEffect(() => {
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

  function checkAdvance() {
    if (pendingGatesRef.current.size === 0 && !advancedRef.current) {
      advancedRef.current = true
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }
      advance()
      setCardNonce(n => n + 1)
      setLocked(false)
    }
  }

  function postReview(quality) {
    if (locked || !card) return
    setLocked(true)

    // Everything from here down is best-effort — XP toast, stage
    // stamp, the writing drill, the review POST. The one thing that
    // must happen regardless of whether any of it throws or hangs is
    // checkAdvance() at the very end, so it's in a finally: a
    // synchronous error anywhere above can no longer silently skip
    // past it and leave the card frozen.
    try {
      // Same writing-drill trigger as KanjiScreen: only meaningful when
      // struggling to recall a kanji from its meaning. Keyed on the
      // card's STRUCTURE, not its source — a hand-written kanji card
      // wants the same drill a browsed-in one gets, which the old
      // `card.source === 'builtin_kanji'` check silently denied it.
      const needTraining =
        quality <= 3 && structureKeyOf(card) === 'kanji' && card.direction === 'b2f' && drawingEnabled

      loadProgress(mode)

      // Precomputed at fetch time (see review_preview / preview_reviews_bulk
      // in decks.py) for every source including custom cards now, so
      // there's nothing to wait on a round trip for.
      const preview = card.review_preview?.[quality]

      advancedRef.current = false
      const gates = pendingGatesRef.current
      // A level-up toast never auto-dismisses (see XpToast — it waits
      // indefinitely for the player to tap the claim button), so the
      // safety-net below must never force it closed early; that's the
      // one case where "gate still open" isn't a bug, it's the design.
      let safeToForce = true

      if (needTraining) {
        gates.add('training')
        setShowRating(false)
        setShowDrawing(true)
        // The 'training' gate clears once the drawing drill is
        // dismissed (see DrawingOverlay's onDone below).
      } else {
        setShowRating(false)
      }

      try {
        if (preview) {
          gates.add('toast')
          // Guard against a non-numeric xp_earned (undefined/NaN) — the
          // gate above is already added by this point, and if
          // applyXpGain or setXpToast were to throw on a bad value,
          // execution would abort right here: no toast would ever
          // render, meaning nothing is left to fire the animationend
          // that normally clears the 'toast' gate. The try/catch around
          // this whole block is the same guarantee from the other side:
          // even if something here still throws, the gate gets dropped
          // in the catch instead of hanging forever.
          const amount = typeof preview.xp_earned === 'number' ? preview.xp_earned : 0
          const { leveledUp, newLevel } = applyXpGain({ amount })
          if (leveledUp) safeToForce = false
          setXpToast({ amount, id: Date.now(), leveledUp, newLevel, quality })
          if (preview.stage_up) {
            gates.add('stamp')
            setCardStamp({ id: Date.now(), to: preview.stage_up, cardKey: `${card.card_id}:${cardNonce}` })
          } else if (preview.stage_down) {
            gates.add('stamp')
            setCardStamp({ id: Date.now(), to: preview.stage_down, demoted: true, cardKey: `${card.card_id}:${cardNonce}` })
          }
        }
      } catch (err) {
        gates.delete('toast')
        console.error('XP toast setup failed', err)
      }

      if (gates.size > 0 && safeToForce) {
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = setTimeout(() => {
          gates.clear()
          checkAdvance()
        }, 4000)
      }

      // Close the exclude-list race described above: from this point
      // on, any refill (even one already in flight) must not be able
      // to hand this exact card back.
      markReviewed(card.card_id)

      // Fire-and-forget — the response isn't read for anything the UI
      // shows, same as Kanji/Vocab/Grammar's own review calls.
      apiFetch(`/api/decks/${deck_id}/review`, session, {
        method: 'POST',
        body: JSON.stringify({ card_id: card.card_id, mode, quality, prev_stage: card.stage }),
      }).catch(() => {})
    } catch (err) {
      console.error('postReview failed', err)
      pendingGatesRef.current.clear()
    } finally {
      checkAdvance()
    }
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
        {/* Custom decks live at /decks/:id/study — a path with no
            station plate (see config/stations.js), so this is one of
            the few screens where SelectionScreen's own heading is
            still doing real work rather than repeating a sign
            overhead. */}
        <SelectionScreen heading={t.selectMode}>
          {!modesLoaded && <Loading />}
          {modesLoaded && availableModes.length === 0 && (
            <div className="quiz-done">{t.noCards}</div>
          )}
          {modesLoaded && availableModes.length > 0 && (
            <ModeSelector modes={availableModes} onSelect={m => board(() => startSession(m))} />
          )}
        </SelectionScreen>
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
  const furiganaOn  = activeHints.includes(HINTS.FURIGANA) && Array.isArray(cardHints[HINTS.FURIGANA])
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

  /** The vocab word, with furigana when the hint is on and the card has it. */
  function wordDisplay(c, size) {
    const parts = furiganaOn ? cardHints[HINTS.FURIGANA] : null
    if (parts?.length) return <FuriganaWord parts={parts} size={size} />
    return <CharDisplay char={wordForm(c)} size={size} />
  }

  // ── Per-structure prompt renderers (rendered inside CardTransition) ──
  // Deliberately not collapsed into one generic front/back layout — a
  // kanji, vocab, grammar or standard card each have their own actual
  // UI in this app (shared <Flashcard> for most, Kanji's radical/
  // readings/write modes their own), reproduced here exactly as their
  // own screen renders them, reading from the SAME normalized shape
  // regardless of whether `c` came from the app's own deck or was
  // hand-written into this one.

  function renderKanjiPrompt(c) {
    if (renderer === RENDER.TYPE) {
      // readings — the kanji is shown, every reading is typed into
      // ReadingsInput below. No flip: the answer is not one thing to
      // uncover but a set the learner produces.
      return (
        <PromptCard>
          <CharDisplay char={c.kanji} size={100} />
          <RevealActions
            t={t} revealed={answered} resetKey={`${c.card_id}:${cardNonce}`}
            dictTerm={c.kanji} dictCategory="kanji" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        </PromptCard>
      )
    }
    if (isRadical) {
      // radical — the kanji is shown, the radical it is filed under is
      // the answer. Same flip/choices split as the meaning flashcards.
      return (
        <PromptCard>
          {!showChoices && (
            <Flashcard
              t={t} resetKey={`${c.card_id}:${cardNonce}`} onReveal={onFlashcardReveal}
              front={<CharDisplay char={c.kanji} size={100} />}
              back={
                /* The kanji stays on the back, dimmed — the answer needs
                   something to be an answer ABOUT, and on the cards
                   where the radical IS the kanji, an unchanged-looking
                   card otherwise. */
                <div className="radical-reveal">
                  <div className="radical-reveal__kanji" lang="ja">{c.kanji}</div>
                  <RadicalAnswer radical={c.radical} t={t} />
                </div>
              }
              dictTerm={c.kanji} dictCategory="kanji" session={session}
              onReplaySound={() => speakJapanese(c.kana)}
            />
          )}
          {showChoices && (
            <>
              <CharDisplay char={c.kanji} size={100} />
              {answered && <RadicalAnswer radical={c.radical} t={t} />}
              <RevealActions
                t={t} revealed={answered} resetKey={`${c.card_id}:${cardNonce}`}
                dictTerm={c.kanji} dictCategory="kanji" session={session}
                onReplaySound={() => speakJapanese(c.kana)}
              />
            </>
          )}
        </PromptCard>
      )
    }
    if (renderer === RENDER.DRAW) {
      return (
        <PromptCard>
          <MeaningDisplay meaning={c.meaning} size={32} />
          {c.kana && <div className="quiz-subtitle">({c.kana})</div>}
          <RevealActions
            t={t} revealed={answered} resetKey={`${c.card_id}:${cardNonce}`}
            dictTerm={c.kanji} dictCategory="kanji" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        </PromptCard>
      )
    }
    return (
      <PromptCard>
        {!showChoices && (
          <Flashcard
            t={t} resetKey={`${c.card_id}:${cardNonce}`} onReveal={onFlashcardReveal}
            front={isF2B ? <CharDisplay char={c.kanji} size={100} /> : <MeaningDisplay meaning={c.meaning} size={44} />}
            back={
              <InlineReveal
                t={t} kana={c.kana} isLarge={isF2B}
                main={isF2B ? <MeaningDisplay meaning={c.meaning} size={28} /> : <CharDisplay char={c.kanji} size={72} />}
              />
            }
            dictTerm={c.kanji} dictCategory="kanji" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        )}
        {showChoices && (
          <>
            <InlineReveal
              t={t} kana={c.kana} revealed={answered}
              main={isF2B ? <CharDisplay char={c.kanji} size={100} /> : <MeaningDisplay meaning={c.meaning} size={44} />}
            />
            <RevealActions
              t={t} revealed={answered} resetKey={`${c.card_id}:${cardNonce}`}
              dictTerm={c.kanji} dictCategory="kanji" session={session}
              onReplaySound={() => speakJapanese(c.kana)}
            />
          </>
        )}
      </PromptCard>
    )
  }

  function renderVocabPrompt(c) {
    const isWordReading = STUDY_MODES[mode]?.base === 'word_reading'
    return (
      <PromptCard>
        {isWordReading && (
          /* word_reading — the written word is shown and the answer is
             how it is read. No meaning on either face: this drill is
             about reading, not knowing. */
          <Flashcard
            t={t} resetKey={`${c.card_id}:${cardNonce}`} onReveal={onFlashcardReveal}
            front={<CharDisplay char={c.kanji} size={72} />}
            back={
              /* Both halves of the answer, and both are needed. The
                 furigana says WHICH kanji takes which part of the
                 reading; the plain kana below is the reading as one
                 word, which is what was actually asked for. */
              <div>
                {c.furigana?.length
                  ? <FuriganaWord parts={c.furigana} size={64} answer />
                  : <CharDisplay char={c.kanji} size={56} />}
                <div className="flashcard-reading" lang="ja">{c.kana}</div>
              </div>
            }
            dictTerm={wordForm(c)} dictCategory="vocab" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        )}

        {!isWordReading && !showChoices && (
          <Flashcard
            t={t} resetKey={`${c.card_id}:${cardNonce}`} onReveal={onFlashcardReveal}
            front={isF2B ? wordDisplay(c, 72) : <CharDisplay char={formatGlossLine(c.meaning)} size={72} />}
            back={
              <InlineReveal
                t={t} kana={c.kanji ? c.kana : null} isLarge={isF2B} stacked={isF2B}
                main={isF2B
                  ? <MeaningDisplay meaning={c.meaning} size={28} color="var(--accent2)" />
                  : <CharDisplay char={wordForm(c)} size={72} />}
              />
            }
            dictTerm={wordForm(c)} dictCategory="vocab" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        )}

        {!isWordReading && showChoices && (
          <>
            <InlineReveal
              t={t} kana={c.kanji ? c.kana : null} revealed={answered}
              main={isF2B ? <CharDisplay char={wordForm(c)} size={72} /> : <CharDisplay char={formatGlossLine(c.meaning)} size={72} />}
            />
            <RevealActions
              t={t} revealed={answered} resetKey={`${c.card_id}:${cardNonce}`}
              dictTerm={wordForm(c)} dictCategory="vocab" session={session}
              onReplaySound={() => speakJapanese(c.kana)}
            />
          </>
        )}
      </PromptCard>
    )
  }

  function renderGrammarPrompt(c) {
    return (
      <PromptCard className="grammar-prompt">
        {/* Every mode here is the same card with a different front: a
            rule, a meaning, or a sentence. The flip is the reveal in
            all three, and switching the choices on replaces the flip
            rather than sitting beside it — same resolution Kanji/Vocab
            use for their own indice_1. */}
        {!choicesOn ? (
          <Flashcard
            t={t} resetKey={`${c.card_id}:${cardNonce}`} onReveal={onFlashcardReveal}
            front={
              isFill
                ? <div className="grammar-fill-sentence" lang="ja">{c.fill_sentence?.jp}</div>
                : isF2B
                  ? (
                    <>
                      <GrammarRule text={c.grammar} size={52} />
                      {c.structure && <div className="grammar-structure">{c.structure}</div>}
                    </>
                  )
                  : <MeaningDisplay meaning={c.meaning} size={34} />
            }
            back={
              isFill
                ? (
                  /* The sentence stays on the back, dimmed: the answer
                     is which rule is at work IN IT. */
                  <>
                    <div className="grammar-fill-sentence grammar-fill-sentence--echo" lang="ja">
                      {c.fill_sentence?.jp}
                    </div>
                    <GrammarAnswer card={c} size={40} />
                  </>
                )
                : isF2B
                  ? <MeaningDisplay meaning={c.meaning} size={30} color="var(--success)" />
                  : (
                    <>
                      <GrammarRule text={c.grammar} size={44} />
                      {c.structure && <div className="grammar-structure">{c.structure}</div>}
                    </>
                  )
            }
          />
        ) : (
          /* Choices on — the prompt does NOT swap: the answer is
             whichever MCQ row lights up below, not a second face here.
             fill_in is the exception, since its own prompt is the
             sentence and the rule named below is worth seeing spelled
             out next to it. */
          <>
            {isFill
              ? <div className="grammar-fill-sentence" lang="ja">{c.fill_sentence?.jp}</div>
              : isF2B
                ? (
                  <>
                    <GrammarRule text={c.grammar} size={52} />
                    {c.structure && <div className="grammar-structure">{c.structure}</div>}
                  </>
                )
                : <MeaningDisplay meaning={c.meaning} size={34} />}
            {isFill && answered && <GrammarAnswer card={c} size={36} divided />}
          </>
        )}
      </PromptCard>
    )
  }

  function renderStandardPrompt(c) {
    return (
      <PromptCard>
        <Flashcard
          t={t} resetKey={`${c.card_id}:${cardNonce}`} onReveal={onFlashcardReveal}
          front={
            <div className="study-front-text" style={{ '--front-size': (isF2B ? c.front : c.back)?.length === 1 ? '80px' : '32px' }}>
              {isF2B ? c.front : c.back}
            </div>
          }
          back={
            <div className="study-front-text" style={{ '--front-size': '28px' }}>
              {isF2B ? c.back : c.front}
            </div>
          }
          dictTerm={c.front} dictCategory="vocab" session={session}
        />
      </PromptCard>
    )
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
      <XpToast toast={xpToast} onDone={() => {
        setXpToast(null)
        pendingGatesRef.current.delete('toast')
        checkAdvance()
      }} />
      <div className="container quiz-area">
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}

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
              disabled={locked}
            />

            <CardTransition
              className={cardStageClassName}
              cardKey={`${nc.card_id}:${cardNonce}`}
              stamp={cardStamp}
              stage={nc.stage}
              onStampDone={() => {
                setCardStamp(null)
                pendingGatesRef.current.delete('stamp')
                checkAdvance()
              }}
            >
              {structureKey === 'kanji'    && renderKanjiPrompt(nc)}
              {structureKey === 'vocab'    && renderVocabPrompt(nc)}
              {structureKey === 'grammar'  && renderGrammarPrompt(nc)}
              {structureKey === 'standard' && renderStandardPrompt(nc)}
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

            <RatingBar active={showRating && !locked} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay
                kanji={nc.kanji}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={nc.card_id}
                meaning={formatGlossLine(nc.meaning)}
                onDone={() => {
                  setShowDrawing(false)
                  pendingGatesRef.current.delete('training')
                  checkAdvance()
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
