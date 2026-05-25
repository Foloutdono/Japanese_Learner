import { apiFetch } from '../api'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RatingBar from '../components/RatingBar'
import { KanjiTopBar, TopBar } from '../components/TopBar'
import { MCQGrid, TypeInput, DoneMessage, Loading } from '../components/QuizComponents'
import { speakJapanese } from '../components/sound'
import DrawingCanvas from '../components/DrawingCanvas'
import { useLang } from '../LangContext'
import { useEffect } from 'react'

export default function KanjiScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

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
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)

  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

  const PHASES = [
    { id: 1, label: t.phase1, desc: t.phase1Desc },
    { id: 2, label: t.phase2, desc: t.phase2Desc },
    { id: 3, label: t.phase3, desc: t.phase3Desc },
  ]
  useEffect(() => {
    if (card && level && phase) fetchCard(level, phase)
  }, [lang])

  function fetchCard(lvl, ph) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)
    setShowDrawing(false)

    apiFetch(`/api/kanji/card?level=${lvl}&phase=${ph}&lang=${lang}`, session)
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
    const wrongAnswer = quality < 2 && card?.kanji
    if (wrongAnswer && drawingEnabled) {
      setShowRating(false)
      setShowDrawing(true)
      // still post the review in background
      apiFetch('/api/kanji/review', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.card_id, mode: card.phase_key, quality }),
      })
    } else {
      apiFetch('/api/kanji/review', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.card_id, mode: card.phase_key, quality }),
      }).then(() => fetchCard(level, phase))
    }
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
    speakJapanese(card.kana)
  }

  function onTypeSubmit() {
    if (submitted || !input.trim()) return
    setSubmitted(true)
    setShowRating(true)
    speakJapanese(card.kana)
  }

  // ── Level selection ──
  if (!level) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => navigate('/')} title="Kanji"/>
        <div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            {t?.selectKanjiLevel ?? 'Choisissez un niveau'}
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
        <TopBar onBack={() => setLevel(null)} title={`Kanji ${level}`}/>
        <div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            {t?.selectKanjiPhase ?? 'Choisissez une phase'}
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
      <KanjiTopBar onBack={() => setPhase(null)} onClick={() => setDrawingEnabled(d => !d)}
      title={`Kanji ${level} — Phase ${phase}`} drawingEnabled={drawingEnabled}/>

      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>

        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setPhase(null)} />}

        {card && !loading && (() => {
          const translatedCorrect = card.meaning
          const translatedChoices = (card.choices ?? []).map(c => c.meaning)

          return (
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
                        {card.stroke_count} {t.strokes}
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
                        {card.stroke_count} {t.strokes}
                      </div>
                    )}
                  </>
                )}

                {phase === 3 && (
                  <>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--accent3)' }}>
                      {translatedCorrect}
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
                  choices={translatedChoices}
                  correct={translatedCorrect}
                  selected={selected}
                  answered={answered}
                  onAnswer={onMCQAnswer}
                />
              )}

              {/* Type input (phase 3) */}
              {phase === 3 && (
                <TypeInput
                  value={input}
                  onChange={setInput}
                  onSubmit={onTypeSubmit}
                  submitted={submitted}
                  answer={card.kanji}
                  placeholder={t?.typeKanji ?? 'Tapez le kanji...'}
                  inputStyle={{ fontSize: 24, fontFamily: 'Yu Gothic, sans-serif' }}
                  wrongExtra={
                    <div style={{ fontSize: 64, fontFamily: 'Yu Gothic, sans-serif', marginTop: 12 }}>
                      {card.kanji}
                    </div>
                  }
                />
              )}

              <RatingBar active={showRating} onRate={postReview} />

              {showDrawing && (
                <DrawingCanvas
                  kanji={card.kanji}
                  meaning={translatedCorrect}
                  onDone={() => fetchCard(level, phase)}
                />
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}