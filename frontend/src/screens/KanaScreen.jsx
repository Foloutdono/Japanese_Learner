import { useState, useEffect, useCallback } from 'react'
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
import { CardStamp } from '../components/CardStamp'
import PromptCard from '../components/PromptCard'
import SelectionScreen from '../components/SelectionScreen'
import ModeSelector from '../components/ModeSelector'
import { playKana } from '../components/sound'
import { kanaModePicker } from '../components/quizModes'
import { applyXpGain } from '../components/userProfileSummary'
import { useCardSession } from '../hooks/useCardSession'
import { estimateReviewXp, recordReviewXp } from '../xpCurve'

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

  function postReview(quality) {
    // Lock: a level-up holds the screen open until its reward is
    // claimed (see XpToast.jsx), and RatingBar is hidden for the same
    // reason below — but the overlay is a fixed, full-screen layer, so
    // this is the actual guard, not just the visible one.
    if (xpToast?.leveledUp) return

    // The next card is already sitting in the queue — advancing is a
    // local pop, no network round trip to wait on.
    advance()
    loadProgress(selectedSet.slug, mode)

    // The review round trip can take a couple of seconds, which was
    // showing up as a visible lag before the XP toast appeared. Fire
    // it instantly instead, with a guessed amount (see xpCurve.js —
    // it self-calibrates from real amounts over time), and only step
    // in again if the real response says this review leveled the user
    // up: that celebration is worth waiting for, a routine review's
    // exact XP figure is not — see the .then() below.
    setXpToast({ amount: estimateReviewXp(quality), id: Date.now(), leveledUp: false, newLevel: null, quality })

    apiFetch('/api/kana/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality, prev_stage: card.stage }),
    }).then(r => r.json()).then(data => {
      if (typeof data.xp_earned === 'number') {
        recordReviewXp(quality, data.xp_earned)
        // Optimistic bump for TopBar's ring / mobile level bar / burger
        // profile row — moves them immediately instead of waiting on
        // useProfileSummary's next cached /api/profile refetch.
        applyXpGain({ amount: data.xp_earned, leveledUp: data.leveled_up, newLevel: data.new_level })
        if (data.leveled_up) {
          setXpToast({ amount: data.xp_earned, id: Date.now(), leveledUp: true, newLevel: data.new_level, quality })
        }
      }
      // Backend resolves the stage promotion itself (see
      // post_kana_review) — nothing to detect on this end.
      if (data.stage_up) setCardStamp({ id: Date.now(), to: data.stage_up })
    })
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
      <XpToast toast={xpToast} onDone={() => setXpToast(null)} />
      <div className="container quiz-area">
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}
        {card && !loading && (
          <>
            {mode === 'flashcard' && (
              <div className="quiz-card-stage">
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
                <CardStamp transition={cardStamp} onDone={() => setCardStamp(null)} />
              </div>
            )}

            {mode === 'qcm' && (
              <div className="quiz-card-stage">
                <PromptCard>
                  <CharDisplay char={card.kana} />
                </PromptCard>
                <CardStamp transition={cardStamp} onDone={() => setCardStamp(null)} />
              </div>
            )}

            {mode === 'write' && (
              <div className="quiz-card-stage">
                <PromptCard>
                  <CharDisplay char={card.kana} />
                </PromptCard>
                <CardStamp transition={cardStamp} onDone={() => setCardStamp(null)} />
              </div>
            )}

            {mode === 'qcm' && (
              <MCQGrid choices={card.choices} correct={card.romaji}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}
            {mode === 'write' && (
              <TypeInput value={input} onChange={setInput} onSubmit={onTypeSubmit}
                submitted={submitted} answer={card.romaji} placeholder={t.typeRomaji} />
            )}
            <RatingBar active={showRating && !xpToast?.leveledUp} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}