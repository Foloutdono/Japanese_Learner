import { apiFetch } from '../api'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import RatingBar from '../components/RatingBar'
import { TopBar } from '../components/TopBar'
import { CharDisplay, MCQGrid, TypeInput, ModeToggle, DoneMessage, Loading } from '../components/QuizComponents'
import { playKana } from '../components/sound'
import { useLang } from '../LangContext'

export default function KanaScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [selectedSet, setSelectedSet] = useState(null)
  const [mode, setMode]               = useState('mcq')
  const [card, setCard]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)

  // MCQ state
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)

  // Type state
  const [input, setInput]             = useState('')
  const [submitted, setSubmitted]     = useState(false)

  // Rating state
  const [showRating, setShowRating]   = useState(false)
  
  const SETS = [
    t.hiraganaBase,
    t.hiraganaCombinations,
    t.katakanaBase,
    t.katakanaCombinations,
  ]

  function fetchCard(set, m) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)

    apiFetch(`/api/kana/card?set_name=${encodeURIComponent(set)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => {
        if (data.error || data.detail) {
          console.error('API error:', data)
          setLoading(false)
          return
        }
        if (data.done) { setDone(true); setCard(null) }
        else { setCard(data); setDone(false) }
        setLoading(false)
      })
  }

  function startSession(set) {
    setSelectedSet(set)
    setDone(false)
    fetchCard(set, mode)
  }

  function switchMode(m) {
    setMode(m)
    if (selectedSet) fetchCard(selectedSet, m)
  }

  function postReview(quality) {
    apiFetch('/api/kana/review', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.card_id, mode, quality }),
    }).then(() => fetchCard(selectedSet, mode))
  }

  // MCQ answer
  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  // Type submit
  function onTypeSubmit() {
    if (submitted || !input.trim()) return
    setSubmitted(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  // ── Set selection screen ──
  if (!selectedSet) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => navigate('/')} title="Kana" />
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>
            {t?.selectKanaSet ?? ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', flexDirection: 'column' }}>
            {SETS.map(s => (
              <button key={s} onClick={() => startSession(s)}
                className='button-set-choice'>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Quiz screen ──
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => setSelectedSet(null)} title={selectedSet} />

      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
        <ModeToggle mode={mode} onChange={switchMode} />

        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setSelectedSet(null)} />}

        {card && !loading && (
          <>
            <CharDisplay char={card.kana} />

            {mode === 'mcq' && (
              <MCQGrid
                choices={card.choices}
                correct={card.romaji}
                selected={selected}
                answered={answered}
                onAnswer={onMCQAnswer}
              />
            )}

            {mode === 'type' && (
              <TypeInput
                value={input}
                onChange={setInput}
                onSubmit={onTypeSubmit}
                submitted={submitted}
                answer={card.romaji}
                placeholder={t?.typeRomaji ?? 'Tapez le romaji...'}
              />
            )}

            <RatingBar active={showRating} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}