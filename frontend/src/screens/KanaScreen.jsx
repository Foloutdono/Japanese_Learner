import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  CharDisplay, MCQGrid, TypeInput, ModeToggle, DoneMessage, Loading,
  DeckProgress, Flashcard,
} from '../components/QuizComponents'
import PromptCard from '../components/PromptCard'
import { playKana } from '../components/sound'
import { kanaModes } from '../components/quizModes'

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

  const MODES = kanaModes(t)

  const [selectedSet, setSelectedSet] = useState(null) // { label, slug }
  const [mode, setMode]               = useState('qcm')
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
    setDone(false)
    fetchCard(set.slug, mode)
    loadProgress(set.slug, mode)
  }

  function switchMode(m) {
    setMode(m)
    if (selectedSet) {
      fetchCard(selectedSet.slug, m)
      loadProgress(selectedSet.slug, m)
    }
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
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => navigate('/')} title="Kana" />
        <div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto' }}>
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

  // ── Quiz ──
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => setSelectedSet(null)} title={selectedSet.label} />
      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
        <ModeToggle mode={mode} onChange={switchMode} modes={MODES} />
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setSelectedSet(null)} />}
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
                      <div style={{ fontSize: 32, fontWeight: 'bold', color: 'var(--accent)', marginTop: 12 }}>
                        {card.romaji}
                      </div>
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