import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { TopBar } from '../components/ui/TopBar'
import RatingBar from '../components/study/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, CharDisplay, MeaningDisplay, RevealActions,
} from '../components/study/QuizComponents'
import { formatGlossLine, GlossList } from '../components/study/gloss'
import { Loading } from '../components/ui/Loading'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import ModeSelector from '../components/selection/ModeSelector'
import SelectionScreen from '../components/selection/SelectionScreen'
import PromptCard from '../components/study/PromptCard'
import { DrawingQuiz, DrawingOverlay } from '../components/study/DrawingCanvas'
import { speakJapanese, playUi } from '../lib/audio'
import { vocabKanjiModes, kanjiModes, grammarModePicker, usesWritingDrill } from '../domain/quizModes'
import { applyXpGain } from '../stores/profileSummary'
import { useCardSession } from '../hooks/useCardSession'
import { ChevronIcon, PencilIcon, LightbulbIcon } from '../components/ui/Icons'

const FETCH_TIMEOUT_MS = 8000

// A deck can hold cards from any of these sources at once, so its mode
// picker needs labels/descriptions for every key any of them might
// return from GET /api/decks/{id}/modes (see decks.py's SOURCES) —
// pulled from the exact same picker functions Kanji/Vocab/Grammar
// screens use (quizModes.js) rather than invented here, so a mode's
// text is never out of sync with what it actually looks like once
// you're inside it. 'flashcard' resolves to grammar's entry, since
// that's the one screen with a bespoke (non-shared-Flashcard)
// flashcard experience — custom cards reuse the same key/label for
// their own much simpler flashcard rendering (see renderCustomPrompt)
// without needing a mode of their own.
function allModeMeta(t) {
  const list = [...vocabKanjiModes(t), ...kanjiModes(t), ...grammarModePicker(t)]
  return Object.fromEntries(list.map(m => [m.key, m]))
}

// ── The merged recall modes ────────────────────────────────────
// A deck used to offer "MCQ → meaning", "MCQ → word", "Flashcard →
// meaning" and "Flashcard → word" as four separate entries, which is
// two questions asked twice: the *direction* is the question, and
// multiple-choice vs. bare recall is only how much help you get
// answering it. They're one entry per direction now, and the help
// level is a switch inside the session (see `assisted`) that a learner
// can flip on the card in front of them — the point at which they
// actually know whether they need the options.
//
// The session runs on the flashcard-flavoured key of the pair, for a
// concrete reason: custom hand-written cards are only eligible for
// flashcard-flavoured modes (see decks.py's _eligible — a front/back
// pair has no distractors), so keying a mixed deck's session on the
// qcm side would silently drop every card the learner wrote
// themselves. decks.py attaches the qcm counterpart's choices to
// app-sourced cards so the switch has something to show.
//
// One key means one SRS track, one set of stats and one review_preview
// — no progress is split or double-counted by flipping. That's sound
// rather than merely convenient: what an SRS review consumes is the
// learner's own 1-4 self-rating from RatingBar, which means the same
// thing whether or not four options were on screen when they recalled it.
const MERGED_MODES = {
  'flashcard-kj-m': 'qcm-kj-m',
  'flashcard-m-kj': 'qcm-m-kj',
  flashcard: 'mcq',
}

/** Collapse the raw mode list from the API into the merged entries. */
function mergeModes(keys, meta, t) {
  const present = new Set(keys)
  // A qcm-flavoured key is only absorbed when the flashcard partner
  // that would absorb it is actually in the list. Absorbing
  // unconditionally would make a deck offering (hypothetically) just
  // 'qcm-kj-m' show no entry for it at all — dropped rather than merged.
  const absorbed = new Set(
    Object.entries(MERGED_MODES)
      .filter(([flashcardKey]) => present.has(flashcardKey))
      .map(([, qcmKey]) => qcmKey),
  )
  return keys
    .filter(key => !absorbed.has(key))
    .map(key => {
      const partner = MERGED_MODES[key]
      const canMerge = partner && keys.includes(partner)
      return {
        key,
        label: canMerge ? (meta[key]?.mergedLabel ?? mergedLabelFor(key, t)) : (meta[key]?.label ?? key),
        desc: canMerge ? t.modeRecallDesc : (meta[key]?.desc ?? ''),
      }
    })
}

// The direction, named without the format that used to be glued to the
// front of it ("MCQ (word → meaning)" becomes "Word → meaning").
function mergedLabelFor(key, t) {
  if (key === 'flashcard-kj-m') return t.modeRecallKjM
  if (key === 'flashcard-m-kj') return t.modeRecallMKj
  return t.modeRecallGrammar
}

// The written form to quiz/display on — mirrors VocabScreen's own
// wordForm: some vocab entries are kana-only (no kanji), and this
// also doubles as "the kanji itself" for kanji entries/choices, which
// always have a `kanji` field.
function wordForm(entry) {
  return entry?.kanji || entry?.kana || ''
}

export default function StudyScreen({ session }) {
  const { t, lang } = useLang()
  const navigate     = useNavigate()
  const { deck_id }  = useParams()
  const { state }    = useLocation()
  const deck         = state?.deck

  const MODE_META = allModeMeta(t)

  // A deck's available modes come from what's actually inside it
  // (custom cards + whatever kanji/vocab/grammar cards were browsed
  // in — see decks.py's get_deck_modes), not a fixed deck.type, so a
  // mixed deck genuinely offers every mode any of its cards support.
  // `composition` also drives the write-practice toggle below.
  const [availableModes, setAvailableModes] = useState([])
  const [composition, setComposition]       = useState(null)
  const [modesLoaded, setModesLoaded]       = useState(false)
  const [mode, setMode]                     = useState(null)

  useEffect(() => {
    if (!deck_id) return
    apiFetch(`/api/decks/${deck_id}/modes`, session)
      .then(r => r.json())
      .then(data => {
        const keys = data.modes?.length ? data.modes : []
        setAvailableModes(mergeModes(keys, MODE_META, t))
        setComposition(data.composition ?? null)
      })
      .catch(() => setAvailableModes([]))
      .finally(() => setModesLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id, session])

  const [answered, setAnswered]       = useState(false)
  // The help level inside a merged mode: true = show the four choices,
  // false = recall it cold and self-grade. Session-wide rather than
  // per-card so it stays where the learner put it, but switchable at
  // any moment — including mid-card, before answering.
  const [assisted, setAssisted]       = useState(false)
  // Grammar's own flip state — unlike Kanji/Vocab, its flashcard mode
  // doesn't use the shared <Flashcard> component (see renderGrammarPrompt).
  const [flipped, setFlipped]         = useState(false)
  const [selected, setSelected]       = useState(null)
  const [showRating, setShowRating]   = useState(false)
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

  // v2: bumped after the mode-key rework (real 'qcm-kj-m'/'flashcard-
  // kj-m'/etc. keys instead of the earlier invented 'kk-s'/'k-k'/'s-k'
  // ones) and the per-source rendering rewrite — a cached batch from
  // before either change has a shape this screen no longer expects,
  // and useCardSession has no way to know that on its own; bumping the
  // key is what makes it fetch fresh instead of resuming stale data.
  const storageKey = mode ? `jp-session:deck:v2:${deck_id}:${mode}` : 'idle'

  const fetchBatch = useCallback((count, excludeIds) => {
    if (!mode) return Promise.resolve([])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const allExcluded = Array.from(new Set([...excludeIds, ...recentlyReviewedRef.current.keys()]))
    return apiFetch(
      `/api/decks/${deck_id}/study?mode=${mode}&lang=${lang}&count=${count}&exclude=${allExcluded.join(',')}`,
      session,
      { signal: controller.signal },
    )
      .then(r => r.json())
      .then(data => data.cards ?? [])
      .finally(() => clearTimeout(timer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck_id, mode, lang, session])

  const { current: card, loading, done, advance } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
  })

  useEffect(() => {
    setAnswered(false)
    setFlipped(false)
    setSelected(null)
    setShowRating(false)
    setShowEx(false)
    setShowDrawing(false)
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
    // Start unassisted: the merged mode's whole point is that you try
    // to recall first and reach for the choices when you actually need
    // them, not the other way round.
    setAssisted(false)
    loadProgress(m)
  }

  // Is the running mode one of the merged pairs (and so eligible for
  // the assist switch at all)? 'write'/'fill' are not.
  const isMerged = mode != null && mode in MERGED_MODES

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
      // struggling to recall a kanji from its meaning, and only for an
      // actual kanji-sourced card — vocab/grammar/custom cards never
      // carry direction 'm-kj' from a kanji source, so this naturally
      // never fires for them.
      const needTraining =
        quality <= 3 && card.source === 'builtin_kanji' && card.direction === 'm-kj' && drawingEnabled

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
    if (card?.kana) speakJapanese(card.kana)
  }

  function onFlashcardReveal() {
    setAnswered(true)
    setShowRating(true)
    if (card?.kana) speakJapanese(card.kana)
  }

  function onGrammarFlashcardReveal() {
    setFlipped(true)
    setShowRating(true)
  }

  function onFillReveal() {
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

  const currentModeLabel = isMerged ? mergedLabelFor(mode, t) : (MODE_META[mode]?.label ?? mode)
  const isKjToM = card?.direction === 'kj-m'

  // Whether THIS card can offer the assisted view: it needs the
  // distractors decks.py attaches to app-sourced cards. A custom
  // hand-written card never has them (nothing to build them from), so
  // in a mixed deck the switch simply doesn't apply to those cards and
  // the control says so rather than sitting there dead.
  const cardCanAssist = isMerged && Array.isArray(card?.choices) && card.choices.length > 0
  // What the card should actually render as, right now.
  const shownFormat = cardCanAssist && assisted ? 'qcm' : card?.format

  // ── Per-source prompt renderers (rendered inside CardTransition) ──
  // Deliberately NOT collapsed into one generic front/back layout —
  // Kanji, Vocab, Grammar and custom cards each have their own actual
  // UI in this app (shared <Flashcard> for Kanji/Vocab vs. Grammar's
  // own hand-built flip card; different MCQ choice shapes; Kanji's
  // 'write' mode uses <DrawingQuiz> instead of any of the above) — so
  // each one is reproduced here exactly as its own screen renders it,
  // just reading from `card` instead of a level/tier-scoped fetch.

  function renderCustomPrompt(c) {
    return (
      <PromptCard>
        <Flashcard
          t={t}
          resetKey={`${c.card_id}:${cardNonce}`}
          onReveal={onFlashcardReveal}
          front={
            <div className="study-front-text" style={{ '--front-size': c.front?.length === 1 ? '80px' : '32px' }}>
              {c.front}
            </div>
          }
          back={
            <div>
              <div className="study-front-text" style={{ '--front-size': '28px' }}>{c.back}</div>
              {c.kana && <div className="quiz-subtitle">{c.kana}</div>}
            </div>
          }
          // Custom cards previously left these undefined — every other
          // source (kanji/vocab) always passes session at minimum, and
          // Flashcard renders RevealActions with these unconditionally.
          // Grammar's flashcard mode never actually exercises
          // RevealActions at all (it's a bespoke flip, not <Flashcard>),
          // so kanji/vocab were the only paths that had ever called it
          // with real values — custom was the one path calling it with
          // session/dictTerm/dictCategory all undefined.
          dictTerm={c.front}
          dictCategory="vocab"
          session={session}
          onReplaySound={c.kana ? () => speakJapanese(c.kana) : undefined}
        />
        {c.hint && !answered && <div className="study-hint-text"><LightbulbIcon size={14} /> {c.hint}</div>}
      </PromptCard>
    )
  }

  function renderKanjiPrompt(c) {
    if (mode === 'write') {
      return (
        <PromptCard>
          <MeaningDisplay meaning={c.meaning} size={32} />
          {c.kana && <div className="quiz-subtitle">({c.kana})</div>}
          <RevealActions t={t} revealed={answered} resetKey={`${c.card_id}:${cardNonce}`}
            dictTerm={c.kanji} dictCategory="kanji" session={session}
            onReplaySound={() => speakJapanese(c.kana)} />
        </PromptCard>
      )
    }
    return (
      <PromptCard>
        {shownFormat === 'flashcard' && (
          <Flashcard
            t={t} resetKey={`${c.card_id}:${cardNonce}`} onReveal={onFlashcardReveal}
            front={isKjToM ? <CharDisplay char={c.kanji} size={100} /> : <MeaningDisplay meaning={c.meaning} size={44} />}
            back={
              <InlineReveal
                t={t} kana={c.kana} isLarge={isKjToM}
                main={isKjToM ? <MeaningDisplay meaning={c.meaning} size={28} /> : <CharDisplay char={c.kanji} size={72} />}
              />
            }
            dictTerm={c.kanji} dictCategory="kanji" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        )}
        {shownFormat === 'qcm' && (
          <>
            <InlineReveal
              t={t} kana={c.kana} revealed={answered}
              main={isKjToM ? <CharDisplay char={c.kanji} size={100} /> : <MeaningDisplay meaning={c.meaning} size={44} />}
            />
            <RevealActions t={t} revealed={answered} resetKey={`${c.card_id}:${cardNonce}`}
              dictTerm={c.kanji} dictCategory="kanji" session={session}
              onReplaySound={() => speakJapanese(c.kana)} />
          </>
        )}
      </PromptCard>
    )
  }

  function renderVocabPrompt(c) {
    return (
      <PromptCard>
        {shownFormat === 'flashcard' && (
          <Flashcard
            t={t} resetKey={`${c.card_id}:${cardNonce}`} onReveal={onFlashcardReveal}
            front={<CharDisplay char={isKjToM ? wordForm(c) : formatGlossLine(c.meaning)} size={72} />}
            back={
              <InlineReveal
                t={t} kana={c.kanji ? c.kana : null} isLarge={isKjToM}
                main={isKjToM
                  ? <MeaningDisplay meaning={c.meaning} size={28} color="var(--accent2)" center={false} />
                  : <CharDisplay char={wordForm(c)} size={72} />}
              />
            }
            dictTerm={wordForm(c)} dictCategory="vocab" session={session}
            onReplaySound={() => speakJapanese(c.kana)}
          />
        )}
        {shownFormat === 'qcm' && (
          <>
            <InlineReveal
              t={t} kana={c.kanji ? c.kana : null} revealed={answered}
              main={isKjToM ? <CharDisplay char={wordForm(c)} size={72} /> : <CharDisplay char={formatGlossLine(c.meaning)} size={72} />}
            />
            <RevealActions t={t} revealed={answered} resetKey={`${c.card_id}:${cardNonce}`}
              dictTerm={wordForm(c)} dictCategory="vocab" session={session}
              onReplaySound={() => speakJapanese(c.kana)} />
          </>
        )}
      </PromptCard>
    )
  }

  function renderGrammarPrompt(c) {
    // grammarAssisted: the merged grammar mode ('flashcard') showing its
    // choices. Grammar's flip is bespoke (not the shared <Flashcard>),
    // so it reads the switch directly rather than through shownFormat.
    const grammarAssisted = mode === 'flashcard' && cardCanAssist && assisted
    const isFlip = mode === 'flashcard' && !grammarAssisted
    return (
      <PromptCard className="grammar-prompt">
        <div className="grammar-glyph">{c.grammar}</div>
        {isFlip && !flipped && <div className="grammar-hint">{t.revealMeaning}</div>}
        {isFlip && flipped && <div className="grammar-meaning"><GlossList meaning={c.meaning} /></div>}
        {!isFlip && (
          <div className="grammar-reveal-hint">{mode === 'fill' ? t.revealSentence : t.revealMeaning}</div>
        )}
      </PromptCard>
    )
  }

  // ── Quiz screen ──
  return (
    <div className="screen">
      <TopBar
        onBack={() => setMode(null)}
        title={`${deck?.name ?? ''} — ${currentModeLabel}`}
        autoHide
        // Two conditions, not one: the deck has to contain kanji AND
        // the mode has to be one where the drill can fire at all.
        // Only the first was checked, so the toggle sat in the top
        // bar of every recognition mode doing nothing.
        actions={composition?.kanji > 0 && usesWritingDrill(mode) && (
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
        {done    && <DoneMessage onBack={() => setMode(null)} />}

        {card && !loading && (
          <>
            {/* The help switch, on the card rather than back on the
                mode picker: you only find out whether you needed the
                options once you're looking at the prompt. Flipping it
                mid-card is the point, so it stays live until the card
                is rated (`locked`). A custom hand-written card has no
                distractors to show, so on those it explains its own
                absence instead of appearing dead. */}
            {isMerged && (
              <div className="study-assist">
                {cardCanAssist ? (
                  <button
                    type="button"
                    className={`study-assist__toggle${assisted ? ' study-assist__toggle--on' : ''}`}
                    onClick={() => { playUi('click-mode-selection'); setAssisted(a => !a) }}
                    disabled={locked}
                    aria-pressed={assisted}
                  >
                    <LightbulbIcon size={14} />
                    {assisted ? t.assistOn : t.assistOff}
                  </button>
                ) : (
                  <span className="study-assist__na">{t.assistUnavailable}</span>
                )}
              </div>
            )}

            <CardTransition
              cardKey={`${card.card_id}:${cardNonce}`}
              stamp={cardStamp}
              stage={card.stage}
              onStampDone={() => {
                setCardStamp(null)
                pendingGatesRef.current.delete('stamp')
                checkAdvance()
              }}
            >
              {card.source === 'custom'          && renderCustomPrompt(card)}
              {card.source === 'builtin_kanji'   && renderKanjiPrompt(card)}
              {card.source === 'builtin_vocab'   && renderVocabPrompt(card)}
              {card.source === 'builtin_grammar' && renderGrammarPrompt(card)}
            </CardTransition>

            {/* Grammar's fill-in example sentence — 'fill' mode only */}
            {card.source === 'builtin_grammar' && mode === 'fill' && card.fill_example && (
              <div className="grammar-fill-example">
                <div className="grammar-fill-example__jp">
                  {answered ? card.fill_example.jp_full : card.fill_example.jp_blanked}
                </div>
                <div className="grammar-fill-example__en">{card.fill_example.en}</div>
                {answered && (
                  <div className="grammar-fill-example__romaji">{card.fill_example.romaji}</div>
                )}
              </div>
            )}

            {/* Grammar flashcard reveal — hidden while the merged mode
                is showing its choices instead. */}
            {card.source === 'builtin_grammar' && mode === 'flashcard'
              && !(cardCanAssist && assisted) && !flipped && (
              <button onClick={onGrammarFlashcardReveal} className="reveal-btn">
                {t.revealMeaningBtn}
              </button>
            )}

            {/* Grammar MCQ — choices are plain meaning strings, unlike
                Kanji/Vocab's {kanji,meaning} choice objects below.
                Reached either as the standalone 'mcq' mode or as the
                assisted half of the merged 'flashcard' one. */}
            {card.source === 'builtin_grammar'
              && (mode === 'mcq' || (mode === 'flashcard' && cardCanAssist && assisted)) && (
              <MCQGrid choices={card.choices} correct={card.meaning}
                formatChoice={formatGlossLine}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}

            {/* Grammar fill reveal */}
            {card.source === 'builtin_grammar' && mode === 'fill' && !answered && (
              <button onClick={onFillReveal} className="grammar-fill-reveal-btn">
                {t.revealAnswer}
              </button>
            )}

            {/* Grammar examples toggle */}
            {card.source === 'builtin_grammar' && (flipped || answered) && card.examples?.length > 0 && (
              <div className="grammar-examples">
                <button onClick={() => setShowEx(e => !e)} className="grammar-examples-toggle">
                  <ChevronIcon direction={showEx ? 'up' : 'down'} size={14} /> {showEx ? t.hideExamples : t.showExamples}
                </button>
                {showEx && (
                  <div className="grammar-examples__list">
                    {card.examples.slice(0, 3).map((ex, i) => (
                      <div key={i} className="grammar-example-card">
                        <div className="grammar-example-card__jp">{ex.jp}</div>
                        <div className="grammar-example-card__romaji">{ex.romaji}</div>
                        <div className="grammar-example-card__en">{ex.en}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Kanji/Vocab MCQ — choices are {kanji,(kana,)meaning}
                objects, flattened to whichever side isn't the prompt. */}
            {(card.source === 'builtin_kanji' || card.source === 'builtin_vocab') && shownFormat === 'qcm' && (
              <MCQGrid
                choices={card.choices.map(c => isKjToM ? c.meaning : wordForm(c))}
                correct={isKjToM ? card.meaning : wordForm(card)}
                formatChoice={isKjToM ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {/* Kanji write mode */}
            {card.source === 'builtin_kanji' && mode === 'write' && card.kanji && (
              <DrawingQuiz
                kanji={card.kanji}
                meaning={formatGlossLine(card.meaning)}
                onValidate={() => {
                  setAnswered(true)
                  setShowRating(true)
                  speakJapanese(card.kana)
                }}
              />
            )}

            <RatingBar active={showRating && !locked} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay
                kanji={card.kanji}
                meaning={formatGlossLine(card.meaning)}
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