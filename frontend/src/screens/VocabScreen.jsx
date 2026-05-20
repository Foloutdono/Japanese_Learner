import { api } from '../api'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RatingBar from '../components/RatingBar'
import TopBar from '../components/TopBar'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const PHASES = [
  { id: 1, label: 'Phase 1', desc: 'Kanji + Kana → Sens' },
  { id: 2, label: 'Phase 2', desc: 'Kanji → Sens' },
  { id: 3, label: 'Phase 3', desc: 'Sens → Kana (écriture)' },
]

export default function VocabScreen() {
  const navigate = useNavigate()

  const [level, setLevel]         = useState(null)
  const [phase, setPhase]         = useState(null)
  const [card, setCard]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)

  // MCQ state (phase 1 & 2)
  const [answered, setAnswered]   = useState(false)
  const [selected, setSelected]   = useState(null)

  // Type state (phase 3)
  const [input, setInput]         = useState('')
  const [submitted, setSubmitted] = useState(false)

  const [showRating, setShowRating] = useState(false)

  function fetchCard(lvl, ph) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)

    fetch(api(`/api/vocab/card?level=${lvl}&phase=${ph}`))
      .then(r => r.json())
      .then(data => {
        if (data.done) { setDone(true); setCard(null) }
        else { setCard(data); setDone(false) }
        setLoading(false)
      })
  }

  function startSession(lvl, ph) {
    setLevel(lvl)
    setPhase(ph)
    setDone(false)
    fetchCard(lvl, ph)
  }

  function postReview(quality) {
    fetch(api('/api/vocab/review'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.card_id, quality }),
    }).then(() => fetchCard(level, phase))
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
  }

  function onTypeSubmit() {
    if (submitted || !input.trim()) return
    setSubmitted(true)
    setShowRating(true)
  }

  // ── Level selection ──
  if (!level) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => navigate('/')} title="Vocabulaire JLPT" />
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            Choisissez un niveau
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                style={{ background: 'var(--accent2)', color: '#111', fontSize: 18, padding: '20px 40px' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Phase selection ──
  if (!phase) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setLevel(null)} title={`Vocabulaire ${level}`} />
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            Choisissez une phase
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {PHASES.map(p => (
              <button key={p.id} onClick={() => startSession(level, p.id)}
                style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '20px 32px' }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>{p.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.desc}</div>
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
      <TopBar onBack={() => setPhase(null)} title={`Vocabulaire ${level} — Phase ${phase}`} />

      <div className="container" style={{ padding: '32px 24px' }}>

        {loading && <div style={{ color: 'var(--text-secondary)' }}>Chargement...</div>}

        {done && (
          <div style={{ color: 'var(--success)', fontSize: 18 }}>
            ✅ Toutes les cartes sont à jour !
            <br /><br />
            <button onClick={() => setPhase(null)}
              style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
              ← Retour
            </button>
          </div>
        )}

        {card && !loading && (
          <>
            {/* Prompt */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '32px 24px', marginBottom: 24 }}>

              {/* Phase 1: kanji + kana */}
              {phase === 1 && (
                <>
                  <div style={{ fontSize: 52, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>
                    {card.kanji}
                  </div>
                  <div style={{ fontSize: 22, color: 'var(--text-secondary)', marginTop: 8 }}>
                    {card.kana}
                  </div>
                </>
              )}

              {/* Phase 2: kanji only */}
              {phase === 2 && (
                <div style={{ fontSize: 52, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>
                  {card.kanji}
                </div>
              )}

              {/* Phase 3: meaning → type kana */}
              {phase === 3 && (
                <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--accent2)' }}>
                  {card.meaning}
                </div>
              )}
            </div>

            {/* MCQ (phase 1 & 2) */}
            {phase !== 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {card.choices.map(choice => {
                  const isCorrect  = choice === card.meaning
                  const isSelected = choice === selected
                  let bg = 'var(--bg-card)'
                  if (answered && isCorrect)              bg = 'var(--success)'
                  if (answered && isSelected && !isCorrect) bg = 'var(--danger)'
                  return (
                    <button key={choice} onClick={() => onMCQAnswer(choice)}
                      style={{ background: bg, color: 'var(--text-primary)', fontSize: 15, textAlign: 'left', padding: '14px 20px' }}>
                      {choice}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Type input (phase 3) */}
            {phase === 3 && (
              <div>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onTypeSubmit()}
                  placeholder="Tapez la lecture en kana..."
                  disabled={submitted}
                  autoFocus
                  style={{
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    padding: '12px 20px', fontSize: 18, width: '100%',
                    marginBottom: 12, outline: 'none',
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
                    fontSize: 16, fontWeight: 'bold', marginTop: 8,
                    color: input.trim() === card.kana ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {input.trim() === card.kana
                      ? '✅ Correct !'
                      : `❌ Réponse : ${card.kana}`}
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