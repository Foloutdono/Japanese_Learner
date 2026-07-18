import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  CharDisplay, MCQGrid, TypeInput, DoneMessage, Loading,
  DeckProgress, Flashcard,
} from '../components/QuizComponents'
import PromptCard from '../components/PromptCard'
import SelectionScreen from '../components/SelectionScreen'
import ModeSelector from '../components/ModeSelector'
import { playKana } from '../components/sound'
import { kanaModePicker } from '../components/quizModes'

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
    apiFetch('/api/kana/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality }),
    }).then(() => {
      // Fire both in parallel: the next card should appear as soon as
      // it's ready, without waiting on the (heavier) stats recompute.
      fetchCard(selectedSet.slug, mode)
      loadProgress(selectedSet.slug, mode)
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
        <div className="container set-select">
          <div className="set-select__list">
            {SETS.map(s => (
              <button key={s.slug} onClick={() => startSession(s)} className="button-set-choice">
                {s.label}
              </button>
            ))}
          </div>
        </div>
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
            <RatingBar active={showRating} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}