import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  CharDisplay, MCQGrid, TypeInput, DoneMessage,
  DeckProgress, Flashcard,
} from '../components/QuizComponents'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
import { CardTransition } from '../components/CardTransition'
import PromptCard from '../components/PromptCard'
import SelectionScreen from '../components/SelectionScreen'
import ModeSelector from '../components/ModeSelector'
import { playKana } from '../components/sound'
import { kanaModePicker } from '../components/quizModes'
import { applyXpGain } from '../components/userProfileSummary'
import { useCardSession } from '../hooks/useCardSession'

const FETCH_TIMEOUT_MS = 8000

export default function KanaScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()

  // Map translated labels → API slugs
  const SETS = [
    { label: t.hiraganaBase,         slug: 'hiragana_basic'  },
    { label: t.hiraganaCombinations, slug: 'hiragana_combos' },
    { label: t.katakanaBase,         slug: 'katakana_basic'  },
    { label: t.katakanaCombinations, slug: 'katakana_combos' },
  ]

  const MODES = kanaModePicker(t)

  const [selectedSet, setSelectedSet] = useState(null) // { label, slug }
  const [mode, setMode]               = useState(null)
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  const [input, setInput]             = useState('')
  const [submitted, setSubmitted]     = useState(false)
  const [showRating, setShowRating]   = useState(false)
  const [progress, setProgress]       = useState(null)
  const [xpToast, setXpToast]         = useState(null)
  const [cardStamp, setCardStamp]     = useState(null)
  const [locked, setLocked]           = useState(false)

  // Gates that must all clear before the deck is allowed to move on
  // to the next card: the review request itself, plus whichever of
  // the XP toast / stage stamp actually end up showing. Kept in a
  // ref, not state — nothing needs to re-render off it, it's only
  // ever read at the moment a gate closes, to decide whether
  // advance() can finally run.
  const pendingGatesRef = useRef(new Set())
  // Guards against advancing twice for the same review. Gates can
  // reach empty more than once per review — e.g. the toast's own
  // gate is now released as soon as we know it's safe to move on
  // (see postReview), but the toast keeps animating and still calls
  // its onDone → checkAdvance() later, by which point the gate set is
  // already empty again. A ref (not state) so the guard is set the
  // instant advance() fires, with no render/closure lag to race.
  const advancedRef = useRef(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  // One session per deck+mode — batched and cached so answering never
  // waits on a fetch, and a backend cold start doesn't blank the
  // screen (see useCardSession for the full rationale). storageKey
  // stays a stable 'idle' placeholder until a set+mode is chosen; the
  // hook itself is always called (rules of hooks), it just has
  // nothing to fetch yet.
  const storageKey = selectedSet && mode
    ? `jp-session:kana:${selectedSet.slug}:${mode}`
    : 'idle'

  const fetchBatch = useCallback((count, excludeIds) => {
    if (!selectedSet || !mode) return Promise.resolve([])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    return apiFetch(
      `/api/kana/cards?set_name=${encodeURIComponent(selectedSet.slug)}&mode=${mode}&count=${count}&exclude=${excludeIds.join(',')}`,
      session,
      { signal: controller.signal },
    )
      .then(r => r.json())
      .then(data => data.cards ?? [])
      .finally(() => clearTimeout(timer))
  }, [selectedSet, mode, session])

  const { current: card, loading, done, advance } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
  })

  // Reset per-card UI state whenever the card in hand changes —
  // advance() is a synchronous local pop now, so there's no fetch
  // callback to hang this reset off of like there used to be.
  useEffect(() => {
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)
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

  function startSession(set) {
    setSelectedSet(set)
    setMode(null)
  }

  function startMode(m) {
    setMode(m)
    loadProgress(selectedSet.slug, m)
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
    loadProgress(selectedSet.slug, mode)

    // The exact outcome of this rating — xp, level-up, stage
    // promotion — was already computed when this card was fetched
    // (see review_preview on the card payload / preview_reviews_bulk
    // in srs.py), so there's nothing left to guess or wait on a
    // network round trip for. That round trip is what used to let the
    // XP toast finish and release its "safe to advance" gate well
    // before a slow or cold-starting backend had actually confirmed a
    // stage promotion — which is what was making the card stamp
    // silently never show.
    const preview = card.review_preview?.[quality]

    advancedRef.current = false
    const gates = pendingGatesRef.current

    if (preview) {
      gates.add('toast')
      // leveledUp/newLevel come from applyXpGain's own running total,
      // not preview.leveled_up/preview.new_level — the latter is
      // computed once per batch fetch and can't see XP already
      // earned from other cards answered earlier in this same batch
      // (see the comment on applyXpGain for why that matters here).
      const { leveledUp, newLevel } = applyXpGain({ amount: preview.xp_earned })
      setXpToast({ amount: preview.xp_earned, id: Date.now(), leveledUp, newLevel, quality })

      if (preview.stage_up) {
        gates.add('stamp')
        setCardStamp({ id: Date.now(), to: preview.stage_up, cardKey: card.card_id })
      }
    }

    // Fire-and-forget: this only has to persist the review now — the
    // response isn't read for anything the UI shows. A slow or dead
    // request can no longer desync the toast or the stamp from
    // what's actually about to happen.
    apiFetch('/api/kana/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality }),
    }).catch(() => {})

    checkAdvance()
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

  function onTypeSubmit() {
    if (submitted || !input.trim()) return
    setSubmitted(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  // ── Set selection ──
  if (!selectedSet) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title="Kana" />
        <SelectionScreen>
          <ModeSelector
            modes={SETS.map(s => ({ key: s.slug, label: s.label }))}
            onSelect={slug => startSession(SETS.find(s => s.slug === slug))}
            title={t.selectKanaSet ?? 'Choose your kana set'}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSelectedSet(null)} title={selectedSet.label} autoHide />
        <SelectionScreen>
          <ModeSelector modes={MODES} onSelect={startMode} title={t.selectMode} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Quiz ──
  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${selectedSet.label} — ${modeLabel}`} autoHide/>
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
              {mode === 'flashcard' && (
                <PromptCard>
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={<CharDisplay char={card.kana} />}
                    back={
                      <div>
                        <CharDisplay char={card.kana} />
                        <div className="flashcard-answer">{card.romaji}</div>
                      </div>
                    }
                  />
                </PromptCard>
              )}

              {(mode === 'qcm' || mode === 'write') && (
                <PromptCard>
                  <CharDisplay char={card.kana} />
                </PromptCard>
              )}
            </CardTransition>

            {mode === 'qcm' && (
              <MCQGrid choices={card.choices} correct={card.romaji}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}
            {mode === 'write' && (
              <TypeInput value={input} onChange={setInput} onSubmit={onTypeSubmit}
                submitted={submitted} answer={card.romaji} placeholder={t.typeRomaji} />
            )}
            <RatingBar active={showRating && !locked} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}