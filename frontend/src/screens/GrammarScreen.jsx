import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import { MCQGrid, DoneMessage, Loading } from '../components/QuizComponents'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'

export default function GrammarScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()

  const MODES = [
    { key: 'flashcard', label: t.modeFlashcard, desc: t.revealMeaning },
    { key: 'mcq',       label: t.modeQCM,       desc: t.revealSentence.replace('ci-dessous', '').trim() },
    { key: 'fill',      label: t.modeFill,       desc: t.revealSentence },
  ]

  const [level, setLevel]           = useState(null)
  const [mode, setMode]             = useState(null)
  const [card, setCard]             = useState(null)
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)
  const [flipped, setFlipped]       = useState(false)
  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [showEx, setShowEx]         = useState(false)

  function fetchCard(lvl, m) {
    setLoading(true)
    setFlipped(false)
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowEx(false)

    apiFetch(`/api/grammar/card?level=${lvl}&mode=${m}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => {
        if (data.done) { setDone(true); setCard(null) }
        else { setCard(data); setDone(false) }
        setLoading(false)
      })
  }

  function startSession(lvl, m) {
    setLevel(lvl)
    setMode(m)
    setDone(false)
    fetchCard(lvl, m)
  }

  function postReview(quality) {
    apiFetch('/api/grammar/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality }),
    }).then(() => fetchCard(level, mode))
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
  }

  // ── Level selection ──
  if (!level) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => navigate('/')} title={t.grammarTitle} />
        <SelectionScreen subtitle={t.selectLevel}>
          <LevelSelector onSelect={setLevel} color="var(--accent)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setLevel(null)} title={`${t.grammarTitle} ${level}`} />
        <SelectionScreen subtitle={t.selectMode}>
          <ModeSelector modes={MODES} onSelect={m => startSession(level, m)} />
        </SelectionScreen>
      </div>
    )
  }

  const currentModeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  // ── Quiz ──
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => setMode(null)} title={`${t.grammarTitle} ${level} — ${currentModeLabel}`} />
      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}

        {card && !loading && (
          <>
            {/* Grammar point card */}
            <PromptCard style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 40, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: 'var(--accent)', marginBottom: 8 }}>
                {card.grammar}
              </div>
              {mode === 'flashcard' && !flipped && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>{t.revealMeaning}</div>
              )}
              {mode === 'flashcard' && flipped && (
                <div style={{ fontSize: 20, color: 'var(--success)', marginTop: 12 }}>{card.meaning}</div>
              )}
              {mode !== 'flashcard' && (
                <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
                  {mode === 'mcq' ? t.revealMeaning : t.revealSentence}
                </div>
              )}
            </PromptCard>

            {/* Fill example sentence */}
            {mode === 'fill' && card.fill_example && (
              <div style={{
                background: 'var(--bg-card)', borderRadius: 10,
                padding: '20px 24px', marginBottom: 20, textAlign: 'left',
              }}>
                <div style={{ fontSize: 20, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', marginBottom: 8 }}>
                  {answered ? card.fill_example.jp_full : card.fill_example.jp_blanked}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{card.fill_example.en}</div>
                {answered && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {card.fill_example.romaji}
                  </div>
                )}
              </div>
            )}

            {/* Flashcard reveal */}
            {mode === 'flashcard' && !flipped && (
              <button
                onClick={() => { setFlipped(true); setShowRating(true) }}
                style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', width: '100%', fontSize: 16, padding: '16px' }}
              >
                {t.revealMeaningBtn}
              </button>
            )}

            {/* MCQ */}
            {mode === 'mcq' && (
              <MCQGrid choices={card.choices} correct={card.meaning}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}

            {/* Fill reveal */}
            {mode === 'fill' && !answered && (
              <button
                onClick={() => { setAnswered(true); setShowRating(true) }}
                style={{ background: 'var(--accent)', color: '#fff', width: '100%', fontSize: 15, padding: '14px' }}
              >
                {t.revealAnswer}
              </button>
            )}

            {/* Examples toggle */}
            {(flipped || answered) && card.examples?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => setShowEx(e => !e)}
                  style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', fontSize: 13 }}
                >
                  {showEx ? t.hideExamples : t.showExamples}
                </button>
                {showEx && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {card.examples.slice(0, 3).map((ex, i) => (
                      <div key={i} style={{
                        background: 'var(--bg-card)', borderRadius: 8,
                        padding: '12px 16px', textAlign: 'left',
                      }}>
                        <div style={{ fontSize: 16, fontFamily: 'Yu Gothic, sans-serif', marginBottom: 4 }}>{ex.jp}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{ex.romaji}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{ex.en}</div>
                      </div>
                    ))}
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