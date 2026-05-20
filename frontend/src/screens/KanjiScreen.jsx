import { api } from '../api'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RatingBar from '../components/RatingBar'
import TopBar from '../components/TopBar'
import { MCQGrid, TypeInput, DoneMessage, Loading } from '../components/QuizComponents'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const PHASES = [
  { id: 1, label: 'Phase 1', desc: 'Kanji + Kana → Sens' },
  { id: 2, label: 'Phase 2', desc: 'Kanji → Sens' },
  { id: 3, label: 'Phase 3', desc: 'Sens → Kanji (écriture)' },
]

export default function KanjiScreen() {
  const navigate = useNavigate()

  const [level, setLevel]           = useState(null)
  const [phase, setPhase]           = useState(null)
  const [card, setCard]             = useState(null)
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)
  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [input, setInput]           = useState('')
  const [submitted, setSubmitted]   = useState(false)
  const [showRating, setShowRating] = useState(false)

  function fetchCard(lvl, ph) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)

    fetch(api(`/api/kanji/card?level=${lvl}&phase=${ph}`))
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
    fetch(api('/api/kanji/review'), {
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
        <TopBar onBack={() => navigate('/')} title="Kanji" />
        <div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            Choisissez un niveau
          </div>
          <div className="grid-5" style={{ maxWidth: 600, margin: '0 auto' }}>
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevel(l)}
                style={{
                  background: 'var(--accent3)', color: '#fff',
                  fontSize: 20, fontWeight: 'bold',
                  padding: '24px 0', width: '100%',
                }}>
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
        <TopBar onBack={() => setLevel(null)} title={`Kanji ${level}`} />
        <div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            Choisissez une phase
          </div>
          <div className="grid-3" style={{ maxWidth: 700, margin: '0 auto' }}>
            {PHASES.map(p => (
              <button key={p.id} onClick={() => startSession(level, p.id)}
                style={{
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                  padding: '28px 20px', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                <div style={{ fontSize: 16, fontWeight: 'bold' }}>{p.label}</div>
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
      <TopBar onBack={() => setPhase(null)} title={`Kanji ${level} — Phase ${phase}`} />

      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>

        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setPhase(null)} />}

        {card && !loading && (
          <>
            {/* Prompt card */}
            <div style={{
              background: 'var(--bg-card)', borderRadius: 12,
              padding: '40px 24px', marginBottom: 32,
            }}>
              {phase === 1 && (
                <>
                  <div style={{ fontSize: 80, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>
                    {card.kanji}
                  </div>
                  <div style={{ fontSize: 22, color: 'var(--text-secondary)', marginTop: 8 }}>
                    {card.kana}
                  </div>
                  {card.stroke_count && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {card.stroke_count} traits
                    </div>
                  )}
                </>
              )}

              {phase === 2 && (
                <>
                  <div style={{ fontSize: 80, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>
                    {card.kanji}
                  </div>
                  {card.stroke_count && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                      {card.stroke_count} traits
                    </div>
                  )}
                </>
              )}

              {phase === 3 && (
                <>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--accent3)' }}>
                    {card.meaning}
                  </div>
                  {card.kana && (
                    <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 8 }}>
                      ({card.kana})
                    </div>
                  )}
                </>
              )}
            </div>

            {/* MCQ (phase 1 & 2) */}
            {phase !== 3 && (
              <MCQGrid
                choices={card.choices}
                correct={card.meaning}
                selected={selected}
                answered={answered}
                onAnswer={onMCQAnswer}
              />
            )}

            {/* Type input (phase 3) — kanji specific: bigger font, show kanji on wrong */}
            {phase === 3 && (
              <TypeInput
                value={input}
                onChange={setInput}
                onSubmit={onTypeSubmit}
                submitted={submitted}
                answer={card.kanji}
                placeholder="Tapez le kanji..."
                inputStyle={{ fontSize: 24, fontFamily: 'Yu Gothic, sans-serif' }}
                wrongExtra={
                  <div style={{ fontSize: 64, fontFamily: 'Yu Gothic, sans-serif', marginTop: 12 }}>
                    {card.kanji}
                  </div>
                }
              />
            )}

            <RatingBar active={showRating} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}