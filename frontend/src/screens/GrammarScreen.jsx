import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import { MCQGrid, DoneMessage, DeckProgress } from '../components/QuizComponents'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
import { CardTransition } from '../components/CardTransition'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import { grammarModePicker } from '../components/quizModes'
import { applyXpGain } from '../components/userProfileSummary'
import { useCardSession } from '../hooks/useCardSession'

const FETCH_TIMEOUT_MS = 8000

export default function GrammarScreen({ session }) {
  const navigate = useNavigate()
  const { t }    = useLang()

  const MODES = grammarModePicker(t)

  const [level, setLevel]           = useState(null)
  const [mode, setMode]             = useState(null)
  const [flipped, setFlipped]       = useState(false)
  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [showEx, setShowEx]         = useState(false)
  const [progress, setProgress]     = useState(null)
  const [xpToast, setXpToast]       = useState(null)
  const [cardStamp, setCardStamp]   = useState(null)
  const [locked, setLocked]         = useState(false)

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

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  // One session per level+mode — batched and cached so answering never
  // waits on a fetch, and a backend cold start doesn't blank the
  // screen (see useCardSession for the full rationale, and
  // /api/grammar/cards for the batch endpoint this replaced the old
  // one-card-per-fetch /api/grammar/card flow with).
  const storageKey = level && mode
    ? `jp-session:grammar:${level}:${mode}`
    : 'idle'

  const fetchBatch = useCallback((count, excludeIds) => {
    if (!level || !mode) return Promise.resolve([])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    return apiFetch(
      `/api/grammar/cards?level=${encodeURIComponent(level)}&mode=${mode}&count=${count}&exclude=${excludeIds.join(',')}`,
      session,
      { signal: controller.signal },
    )
      .then(r => r.json())
      .then(data => data.cards ?? [])
      .finally(() => clearTimeout(timer))
  }, [level, mode, session])

  const { current: card, loading, done, advance } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
  })

  // Reset per-card UI state whenever the card in hand changes —
  // advance() is a synchronous local pop now, so there's no fetch
  // callback to hang this reset off of like there used to be.
  useEffect(() => {
    setFlipped(false)
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowEx(false)
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
    setFlipped(true)
    setShowRating(true)
  }

  function onFillReveal() {
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
        <SelectionScreen>
          <LevelSelector onSelect={setLevel} color="var(--accent)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setLevel(null)} title={`${t.grammarTitle} ${level}`} autoHide />
        <SelectionScreen>
          <ModeSelector modes={MODES} onSelect={m => startSession(level, m)} title={t.selectMode} />
        </SelectionScreen>
      </div>
    )
  }

  const currentModeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  // ── Quiz ──
  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${t.grammarTitle} ${level} — ${currentModeLabel}`} autoHide />
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
            <CardTransition cardKey={card.card_id} stamp={cardStamp} stage={card.stage} onStampDone={() => {
              setCardStamp(null)
              pendingGatesRef.current.delete('stamp')
              checkAdvance()
            }}>
              {/* Grammar point card */}
              <PromptCard className="grammar-prompt">
                <div className="grammar-glyph">
                  {card.grammar}
                </div>
                {mode === 'flashcard' && !flipped && (
                  <div className="grammar-hint">{t.revealMeaning}</div>
                )}
                {mode === 'flashcard' && flipped && (
                  <div className="grammar-meaning">{card.meaning}</div>
                )}
                {mode !== 'flashcard' && (
                  <div className="grammar-reveal-hint">
                    {mode === 'mcq' ? t.revealMeaning : t.revealSentence}
                  </div>
                )}
              </PromptCard>
            </CardTransition>

            {/* Fill example sentence */}
            {mode === 'fill' && card.fill_example && (
              <div className="grammar-fill-example">
                <div className="grammar-fill-example__jp">
                  {answered ? card.fill_example.jp_full : card.fill_example.jp_blanked}
                </div>
                <div className="grammar-fill-example__en">{card.fill_example.en}</div>
                {answered && (
                  <div className="grammar-fill-example__romaji">
                    {card.fill_example.romaji}
                  </div>
                )}
              </div>
            )}

            {/* Flashcard reveal */}
            {mode === 'flashcard' && !flipped && (
              <button onClick={onFlashcardReveal} className="reveal-btn">
                {t.revealMeaningBtn}
              </button>
            )}

            {/* MCQ */}
            {mode === 'mcq' && (
              <MCQGrid choices={card.choices} correct={card.meaning}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}

            {/* Fill reveal */}
            {mode === 'fill' && !answered && (
              <button onClick={onFillReveal} className="grammar-fill-reveal-btn">
                {t.revealAnswer}
              </button>
            )}

            {/* Examples toggle */}
            {(flipped || answered) && card.examples?.length > 0 && (
              <div className="grammar-examples">
                <button
                  onClick={() => setShowEx(e => !e)}
                  className="grammar-examples-toggle"
                >
                  {showEx ? t.hideExamples : t.showExamples}
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

            <RatingBar active={showRating && !locked} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}