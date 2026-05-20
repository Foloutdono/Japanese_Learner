import { api } from '../api'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import RatingBar from '../components/RatingBar'
import TopBar from '../components/TopBar'
import { CharDisplay, MCQGrid, TypeInput, ModeToggle, DoneMessage, Loading } from '../components/QuizComponents'

const SETS = [
  'Hiragana (de base)',
  'Hiragana (combinaisons)',
  'Katakana (de base)',
  'Katakana (combinaisons)',
]

export default function KanaScreen() {
  const navigate = useNavigate()

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

  function fetchCard(set, m) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)

    fetch(api(`/api/kana/card?set_name=${encodeURIComponent(set)}&mode=${m}`))
      .then(r => r.json())
      .then(data => {
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
    fetch(api('/api/kana/review'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.card_id, quality }),
    }).then(() => fetchCard(selectedSet, mode))
  }

  // MCQ answer
  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
  }

  // Type submit
  function onTypeSubmit() {
    if (submitted || !input.trim()) return
    setSubmitted(true)
    setShowRating(true)
  }

  // ── Set selection screen ──
  if (!selectedSet) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => navigate('/')} title="Kana" />
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>
            Choisissez une série
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
                placeholder="Tapez le romaji..."
              />
            )}

            <RatingBar active={showRating} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}