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

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

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
      <div className="screen">
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
      <div className="screen">
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
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${t.grammarTitle} ${level} — ${currentModeLabel}`} autoHide />
      <div className="container quiz-area">
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}

        {card && !loading && (
          <>
            {/* Grammar point card */}
            <PromptCard className="grammar-prompt">
              <div className="grammar-glyph">
                {card.grammar}
              </div>
              {mode === 'flashcard' && !flipped && (
                <div className="grammar-hint">{t.revealMeaning}</div>
              )}
              {mode === 'flashcard' && flipped && (
                <div className="grammar-meaning">{card.meaning}</div>
              )}
              {mode !== 'flashcard' && (
                <div className="grammar-reveal-hint">
                  {mode === 'mcq' ? t.revealMeaning : t.revealSentence}
                </div>
              )}
            </PromptCard>

            {/* Fill example sentence */}
            {mode === 'fill' && card.fill_example && (
              <div className="grammar-fill-example">
                <div className="grammar-fill-example__jp">
                  {answered ? card.fill_example.jp_full : card.fill_example.jp_blanked}
                </div>
                <div className="grammar-fill-example__en">{card.fill_example.en}</div>
                {answered && (
                  <div className="grammar-fill-example__romaji">
                    {card.fill_example.romaji}
                  </div>
                )}
              </div>
            )}

            {/* Flashcard reveal */}
            {mode === 'flashcard' && !flipped && (
              <button
                onClick={() => { setFlipped(true); setShowRating(true) }}
                className="reveal-btn"
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
                className="grammar-fill-reveal-btn"
              >
                {t.revealAnswer}
              </button>
            )}

            {/* Examples toggle */}
            {(flipped || answered) && card.examples?.length > 0 && (
              <div className="grammar-examples">
                <button
                  onClick={() => setShowEx(e => !e)}
                  className="grammar-examples-toggle"
                >
                  {showEx ? t.hideExamples : t.showExamples}
                </button>
                {showEx && (
                  <div className="grammar-examples__list">
                    {card.examples.slice(0, 3).map((ex, i) => (
                      <div key={i} className="grammar-example-card">
                        <div className="grammar-example-card__jp">{ex.jp}</div>
                        <div className="grammar-example-card__romaji">{ex.romaji}</div>
                        <div className="grammar-example-card__en">{ex.en}</div>
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