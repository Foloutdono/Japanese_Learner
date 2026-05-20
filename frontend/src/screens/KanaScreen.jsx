import { api } from '../api'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import RatingBar from '../components/RatingBar'

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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {SETS.map(s => (
              <button key={s} onClick={() => startSession(s)}
                className='button-mcq'>
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

      {/* Mode toggle */}
      <div className="container" style={{ padding: '32px 24px' }}>
        {['mcq', 'type'].map(m => (
          <button key={m} onClick={() => switchMode(m)}
            style={{
              background: mode === m ? 'var(--accent)' : 'var(--bg-card)',
              color: 'var(--text-primary)', fontSize: 13,
            }}>
            {m === 'mcq' ? 'QCM' : 'Écriture'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: 32, textAlign: 'center' }}>

        {loading && <div style={{ color: 'var(--text-secondary)' }}>Chargement...</div>}

        {done && (
          <div style={{ color: 'var(--success)', fontSize: 18 }}>
            ✅ Toutes les cartes sont à jour !
            <br /><br />
            <button onClick={() => setSelectedSet(null)}
              style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
              ← Retour
            </button>
          </div>
        )}

        {card && !loading && (
          <>
            {/* Kana display */}
            <div style={{
              fontSize: 96, fontFamily: 'Yu Gothic, sans-serif',
              color: '#fff', margin: '16px 0',
            }}>
              {card.kana}
            </div>

            {/* MCQ mode */}
            {mode === 'mcq' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                {card.choices.map(choice => {
                  const isCorrect = choice === card.romaji
                  const isSelected = choice === selected
                  let bg = 'var(--bg-card)'
                  if (answered && isCorrect) bg = 'var(--success)'
                  else if (answered && isSelected && !isCorrect) bg = 'var(--danger)'
                  return (
                    <button key={choice} onClick={() => onMCQAnswer(choice)}
                      style={{ background: bg, color: 'var(--text-primary)', fontSize: 18, minWidth: 100 }}>
                      {choice}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Type mode */}
            {mode === 'type' && (
              <div>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onTypeSubmit()}
                  placeholder="Tapez le romaji..."
                  disabled={submitted}
                  style={{
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    padding: '12px 20px', fontSize: 18, width: '100%', marginBottom: 12,
                    outline: 'none',
                  }}
                />
                {!submitted && (
                  <button onClick={onTypeSubmit}
                    style={{ background: 'var(--accent)', color: '#fff', width: '100%' }}>
                    Valider
                  </button>
                )}
                {submitted && (
                  <div style={{
                    fontSize: 18, fontWeight: 'bold', marginTop: 8,
                    color: input.trim().toLowerCase() === card.romaji ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {input.trim().toLowerCase() === card.romaji
                      ? '✅ Correct !'
                      : `❌ Réponse : ${card.romaji}`}
                  </div>
                )}
              </div>
            )}

            <RatingBar active={showRating} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}

function TopBar({ onBack, title }) {
  return (
    <div className="top-bar">
      <button className="btn-back" onClick={onBack}>← Menu</button>
      <span style={{ fontSize: 16, fontWeight: 'bold' }}>{title}</span>
    </div>
  )
}