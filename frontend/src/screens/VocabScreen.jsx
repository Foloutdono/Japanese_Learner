import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import { MCQGrid, TypeInput, DoneMessage, Loading } from '../components/QuizComponents'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import { speakJapanese } from '../components/sound'

export default function VocabScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()

  const PHASES = [
    { key: 1, label: t.phase1, desc: t.phase1Desc },
    { key: 2, label: t.phase2, desc: t.phase2Desc },
    { key: 3, label: t.phase3, desc: t.phase3Desc },
  ]

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

    apiFetch(`/api/vocab/card?level=${lvl}&phase=${ph}&lang=${lang}`, session)
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
    apiFetch('/api/vocab/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode: card.phase_key, quality }),
    }).then(() => fetchCard(level, phase))
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
        <TopBar onBack={() => navigate('/')} title={`${t.vocabulary} JLPT`} />
        <SelectionScreen subtitle={t.selectLevel}>
          <LevelSelector onSelect={setLevel} color="var(--accent2)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Phase selection ──
  if (!phase) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setLevel(null)} title={`${t.vocabulary} ${level}`} />
        <SelectionScreen subtitle={t.selectPhase}>
          <ModeSelector
            modes={PHASES.map(p => ({ key: p.key, label: p.label, desc: p.desc }))}
            onSelect={ph => startSession(level, ph)}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Quiz ──
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => setPhase(null)} title={`${t.vocabulary} ${level} — ${t.phase1.replace('1', phase)}`} />
      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setPhase(null)} />}
        {card && !loading && (
          <>
            <PromptCard>
              {phase === 1 && (
                <>
                  <div style={{ fontSize: 52, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>{card.kanji}</div>
                  <div style={{ fontSize: 22, color: 'var(--text-secondary)', marginTop: 8 }}>{card.kana}</div>
                </>
              )}
              {phase === 2 && (
                <div style={{ fontSize: 52, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>
                  {card.kanji || card.kana}
                </div>
              )}
              {phase === 3 && (
                <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--accent2)' }}>{card.meaning}</div>
              )}
            </PromptCard>

            {phase !== 3 && (
              <MCQGrid choices={card.choices} correct={card.meaning}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}
            {phase === 3 && (
              <TypeInput value={input} onChange={setInput} onSubmit={onTypeSubmit}
                submitted={submitted} answer={card.kana} placeholder={t.typeKana} />
            )}
            <RatingBar active={showRating} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}