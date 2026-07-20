import { useState, useEffect } from 'react'
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
import PromptCard from '../components/PromptCard'
import SelectionScreen from '../components/SelectionScreen'
import ModeSelector from '../components/ModeSelector'
import { playKana } from '../components/sound'
import { kanaModePicker } from '../components/quizModes'
import { applyXpGain } from '../components/userProfileSummary'

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
  const [card, setCard]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  const [input, setInput]             = useState('')
  const [submitted, setSubmitted]     = useState(false)
  const [showRating, setShowRating]   = useState(false)
  const [progress, setProgress]       = useState(null)
  const [xpToast, setXpToast]         = useState(null)

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  function fetchCard(slug, m) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)

    apiFetch(`/api/kana/card?set_name=${encodeURIComponent(slug)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => {
        if (data.error || data.detail) { console.error('API error:', data); setLoading(false); return }
        if (data.done) { setDone(true); setCard(null) }
        else { setCard(data); setDone(false) }
        setLoading(false)
      })
  }

  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // set+mode. Fetched independently from the card so it never blocks or
  // slows down card navigation.
  function loadProgress(slug, m) {
    apiFetch(`/api/kana/stats?set_name=${encodeURIComponent(slug)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startSession(set) {
    setSelectedSet(set)
    setMode(null)
    setDone(false)
  }

  function startMode(m) {
    setMode(m)
    fetchCard(selectedSet.slug, m)
    loadProgress(selectedSet.slug, m)
  }

  function postReview(quality) {
    // Lock: a level-up holds the screen open until its reward is
    // claimed (see XpToast.jsx), and RatingBar is hidden for the same
    // reason below — but the overlay is a fixed, full-screen layer, so
    // this is the actual guard, not just the visible one. Without it,
    // a review fired while the previous card's level-up is still
    // waiting on screen would swap xpToast out from under it before
    // its curtain-close ever plays, and postReview would record a
    // review for `card` while its rating buttons should be inert.
    if (xpToast?.leveledUp) return

    // Kick off the next card immediately, in parallel with recording
    // this review — the two don't depend on each other, so waiting
    // for the review POST to finish before even starting the card
    // fetch was costing a whole extra round trip on every answer.
    fetchCard(selectedSet.slug, mode)
    loadProgress(selectedSet.slug, mode)

    apiFetch('/api/kana/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality }),
    }).then(r => r.json()).then(data => {
      if (typeof data.xp_earned === 'number') {
        setXpToast({ amount: data.xp_earned, id: Date.now(), leveledUp: data.leveled_up, newLevel: data.new_level, quality })
        // Optimistic bump for TopBar's ring / mobile level bar / burger
        // profile row — moves them immediately instead of waiting on
        // useProfileSummary's next cached /api/profile refetch.
        applyXpGain({ amount: data.xp_earned, leveledUp: data.leveled_up, newLevel: data.new_level })
      }
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

            {mode === 'qcm' && (
              <PromptCard>
                <CharDisplay char={card.kana} />
              </PromptCard>
            )}

            {mode === 'write' && (
              <PromptCard>
                <CharDisplay char={card.kana} />
              </PromptCard>
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