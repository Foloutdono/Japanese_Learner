import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  MCQGrid, DoneMessage, Loading, DeckProgress,
  InlineReveal, Flashcard,
} from '../components/QuizComponents'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import { speakJapanese } from '../components/sound'
import { vocabKanjiModes } from '../components/quizModes'

export default function VocabScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()

  const MODES = vocabKanjiModes(t, t.wordNoun ?? 'mot')

  const [level, setLevel]           = useState(null)
  const [mode, setMode]             = useState(null)
  const [card, setCard]             = useState(null)
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)
  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [progress, setProgress]     = useState(null)

  function fetchCard(lvl, m) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setShowRating(false)

    apiFetch(`/api/vocab/card?level=${lvl}&mode=${m}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => {
        if (data.done) { setDone(true); setCard(null) }
        else { setCard(data); setDone(false) }
        setLoading(false)
      })
  }

  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // level+mode. Fetched independently from the card so it never blocks
  // or slows down card navigation.
  function loadProgress(lvl, m) {
    apiFetch(`/api/vocab/stats?level=${encodeURIComponent(lvl)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startSession(lvl, m) {
    setLevel(lvl)
    setMode(m)
    setDone(false)
    fetchCard(lvl, m)
    loadProgress(lvl, m)
  }

  function postReview(quality) {
    apiFetch('/api/vocab/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode: card.mode, quality }),
    }).then(() => {
      // Fire both in parallel: the next card should appear as soon as
      // it's ready, without waiting on the (heavier) stats recompute.
      fetchCard(level, mode)
      loadProgress(level, mode)
    })
  }

  // The written form to quiz on — some vocab entries are kana-only (no
  // kanji), so fall back to kana for both the prompt and the choices.
  function wordForm(entry) {
    return entry.kanji || entry.kana
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
    speakJapanese(card.kana)
  }

  function onFlashcardReveal() {
    if (answered) return
    setAnswered(true)
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

  // ── Mode selection ──
  if (!mode) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setLevel(null)} title={`${t.vocabulary} ${level}`} />
        <SelectionScreen subtitle={t.selectMode ?? t.selectPhase}>
          <ModeSelector modes={MODES} onSelect={m => startSession(level, m)} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Quiz ──
  const isKjToM = card?.direction === 'kj-m'
  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => setMode(null)} title={`${t.vocabulary} ${level} — ${modeLabel}`} />
      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}
        {card && !loading && (
          <>
            <PromptCard>
              {card.format === 'flashcard' && (
                <Flashcard
                  t={t}
                  resetKey={card.card_id}
                  onReveal={onFlashcardReveal}
                  front={
                    <div style={{ fontSize: 40, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: '#fff' }}>
                      {isKjToM ? wordForm(card) : card.meaning}
                    </div>
                  }
                  back={
                    <InlineReveal
                      t={t}
                      kana={card.kana}
                      main={
                        isKjToM
                          ? <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--accent2)' }}>{card.meaning}</div>
                          : <div style={{ fontSize: 40, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: '#fff' }}>{wordForm(card)}</div>
                      }
                    />
                  }
                />
              )}

              {card.format === 'qcm' && (
                <InlineReveal
                  t={t}
                  kana={card.kana}
                  revealed={answered}
                  main={
                    isKjToM
                      ? <div style={{ fontSize: 40, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: '#fff' }}>{wordForm(card)}</div>
                      : <div style={{ fontSize: 40, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: '#fff' }}>{card.meaning}</div>
                  }
                />
              )}
            </PromptCard>

            {card.format === 'qcm' && (
              <MCQGrid
                choices={card.choices.map(c => isKjToM ? c.meaning : wordForm(c))}
                correct={isKjToM ? card.meaning : wordForm(card)}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            <RatingBar active={showRating} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}