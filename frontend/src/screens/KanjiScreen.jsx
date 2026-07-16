import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { KanjiTopBar, TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  MCQGrid, DoneMessage, Loading, DeckProgress,
  InlineReveal, Flashcard, MeaningDisplay,
} from '../components/QuizComponents'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import {DrawingQuiz, DrawingOverlay} from '../components/DrawingCanvas'
import { speakJapanese } from '../components/sound'
import { kanjiModes } from '../components/quizModes'

export default function KanjiScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()
  const [searchParams] = useSearchParams()

  const MODES = kanjiModes(t)

  const [level, setLevel]             = useState(null)
  const [mode, setMode]               = useState(null)
  const [card, setCard]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  const [showRating, setShowRating]   = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  const [progress, setProgress]       = useState(null)

  // Re-translate when language changes without re-fetching
  useEffect(() => {
    if (card && card.lang !== lang) translateCard(card, lang)
  }, [lang])

  // Deep-link support: if level/mode are given in the URL (e.g. from the
  // Stats screen's "due now" button), jump straight into that session
  // instead of making the user pick again.
  useEffect(() => {
    const lvl = searchParams.get('level')
    const m   = searchParams.get('mode')
    if (lvl && m) {
      startSession(lvl, m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function fetchCard(lvl, m) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowDrawing(false)

    apiFetch(`/api/kanji/card?level=${lvl}&mode=${m}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => {
        if (data.done) { setDone(true); setCard(null) }
        else { setCard({ ...data, lang }); setDone(false) }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching card:', err)
        setLoading(false)
      })
  }

  function translateCard(cardToTranslate, targetLang) {
    if (!cardToTranslate) return
    const words = [cardToTranslate.kanji, ...(cardToTranslate.choices ?? []).map(c => c.kanji)]
    const unique = [...new Set(words.filter(Boolean))]
    Promise.all(unique.map(word =>
      apiFetch(`/api/translation/kanji?word=${encodeURIComponent(word)}&lang=${targetLang}`, session)
        .then(r => r.json())
        .then(data => [word, data.translation || ''])
    )).then(entries => {
      const map = Object.fromEntries(entries)
      setCard(cur => ({
        ...cur,
        lang: targetLang,
        meaning: map[cur.kanji] ?? cur.meaning,
        choices: (cur.choices ?? []).map(c => ({ ...c, meaning: map[c.kanji] ?? c.meaning })),
      }))
    })
  }

  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // level+mode. Fetched independently from the card so it never blocks
  // or slows down card navigation.
  function loadProgress(lvl, m) {
    apiFetch(`/api/kanji/stats?level=${encodeURIComponent(lvl)}&mode=${m}`, session)
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
    // Struggling to recall the kanji from its meaning is exactly when a
    // quick writing drill helps most — recognition-direction modes and
    // the writing mode itself don't need this extra step.
    const needTraining = quality <= 3 && card?.direction === 'm-kj' && drawingEnabled

    apiFetch('/api/kanji/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode: card.mode, quality }),
    }).then(() => {
      // Fire in parallel with whatever comes next: the review already
      // happened, so the counts can refresh without blocking the UI.
      loadProgress(level, mode)
      if (needTraining) {
        setShowRating(false)
        setShowDrawing(true)
      } else {
        fetchCard(level, mode)
      }
    })
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
        <TopBar onBack={() => navigate('/')} title={t.kanjiTitle} />
        <SelectionScreen subtitle={t.selectLevel}>
          <LevelSelector onSelect={setLevel} color="var(--accent3)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setLevel(null)} title={`${t.kanjiTitle} ${level}`} />
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
      <KanjiTopBar
        onBack={() => setMode(null)}
        onClick={() => setDrawingEnabled(d => !d)}
        title={`${t.kanjiTitle} ${level} — ${modeLabel}`}
        drawingEnabled={drawingEnabled}
      />
      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}

        {card && !loading && (
          <>
            {mode !== 'write' && (
              <PromptCard>
                {card.format === 'flashcard' && (
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={
                      isKjToM
                        ? <div style={{ fontSize: 100, fontFamily: 'Yu Gothic, sans-serif', color: '#fff', lineHeight: 1.1, overflow: 'hidden' }}>{card.kanji}</div>
                        : <MeaningDisplay meaning={card.meaning} size={44} />
                    }
                    back={
                      <InlineReveal
                        t={t}
                        kana={card.kana}
                        main={
                          isKjToM
                            ? <MeaningDisplay meaning={card.meaning} size={28} />
                            : <div style={{ fontSize: 72, fontFamily: 'Yu Gothic, sans-serif', color: '#fff', lineHeight: 1.1, overflow: 'hidden' }}>{card.kanji}</div>
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
                        ? <div style={{ fontSize: 100, fontFamily: 'Yu Gothic, sans-serif', color: '#fff', lineHeight: 1.1, overflow: 'hidden' }}>{card.kanji}</div>
                        : <MeaningDisplay meaning={card.meaning} size={44} />
                    }
                  />
                )}
              </PromptCard>
            )}

            {mode === 'write' && (
              <PromptCard>
                <MeaningDisplay meaning={card.meaning} size={32} />
                {card.kana && (
                  <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 8 }}>({card.kana})</div>
                )}
              </PromptCard>
            )}

            {card.format === 'qcm' && (
              <MCQGrid
                choices={card.choices.map(c => isKjToM ? c.meaning : c.kanji)}
                correct={isKjToM ? card.meaning : card.kanji}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {mode === 'write' && card.kanji && (
              <DrawingQuiz
                kanji={card.kanji}
                meaning={card.meaning}
                kana={card.kana}
                onValidate={() => {
                  setAnswered(true)
                  setShowRating(true)
                  speakJapanese(card.kana)
                }}
              />
            )}
            {mode === 'write' && answered && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 72, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>
                  {card.kanji}
                </div>
              </div>
            )}

            <RatingBar active={showRating} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay
                kanji={card.kanji}
                meaning={card.meaning}
                onDone={() => fetchCard(level, mode)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}