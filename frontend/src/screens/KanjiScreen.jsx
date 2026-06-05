import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { KanjiTopBar, TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import { MCQGrid, TypeInput, DoneMessage, Loading } from '../components/QuizComponents'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import DrawingCanvas from '../components/DrawingCanvas'
import { speakJapanese } from '../components/sound'

export default function KanjiScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()

  const PHASES = [
    { key: 1, label: t.phase1, desc: t.phase1Desc },
    { key: 2, label: t.phase2, desc: t.phase2Desc },
    { key: 3, label: t.phase3, desc: t.phase3Desc },
    { key: 4, label: t.phase4 ?? 'Write', desc: t.phase4Desc ?? 'See the meaning, write the kanji' },
  ]

  const [level, setLevel]             = useState(null)
  const [phase, setPhase]             = useState(null)
  const [card, setCard]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  const [input, setInput]             = useState('')
  const [submitted, setSubmitted]     = useState(false)
  const [showRating, setShowRating]   = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)

  // Re-translate when language changes without re-fetching
  useEffect(() => {
    if (card && card.lang !== lang) translateCard(card, lang)
  }, [lang])

  function fetchCard(lvl, ph) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)
    setShowDrawing(false)

    console.log(`Fetching card for level ${lvl} phase ${ph} and language ${lang}`)

    apiFetch(`/api/kanji/card?level=${lvl}&phase=${ph}&lang=${lang}`, session)
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

  function startSession(lvl, ph) {
    setLevel(lvl)
    setPhase(ph)
    setDone(false)
    fetchCard(lvl, ph)
  }

  function postReview(quality) {
    const needTraining = quality <= 3 && card?.kanji
    apiFetch('/api/kanji/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode: card.phase_key, quality }),
    }).then(() => {
      if (needTraining && drawingEnabled) {
        setShowRating(false)
        setShowDrawing(true)
      } else {
        fetchCard(level, phase)
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
        <TopBar onBack={() => navigate('/')} title={t.kanjiTitle} />
        <SelectionScreen subtitle={t.selectLevel}>
          <LevelSelector onSelect={setLevel} color="var(--accent3)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Phase selection ──
  if (!phase) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <TopBar onBack={() => setLevel(null)} title={`${t.kanjiTitle} ${level}`} />
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
  const translatedCorrect = card?.meaning ?? ''
  const translatedChoices = (card?.choices ?? []).map(c => c.meaning)

  return (
    <div style={{ minHeight: '100vh' }}>
      <KanjiTopBar
        onBack={() => setPhase(null)}
        onClick={() => setDrawingEnabled(d => !d)}
        title={`${t.kanjiTitle} ${level} — ${PHASES.find(p => p.key === phase)?.label}`}
        drawingEnabled={drawingEnabled}
      />
      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setPhase(null)} />}

        {card && !loading && (
          <>
            <PromptCard>
              {phase === 1 && (
                <>
                  <div style={{ fontSize: 80, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>{card.kanji}</div>
                  <div style={{ fontSize: 22, color: 'var(--text-secondary)', marginTop: 8 }}>{card.kana}</div>
                  {card.stroke_count && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {card.stroke_count} {t.strokes}
                    </div>
                  )}
                </>
              )}
              {phase === 2 && (
                <>
                  <div style={{ fontSize: 80, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>{card.kanji}</div>
                  {card.stroke_count && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                      {card.stroke_count} {t.strokes}
                    </div>
                  )}
                </>
              )}
              {phase === 3 && (
                <>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--accent3)' }}>{translatedCorrect}</div>
                  {card.kana && (
                    <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 8 }}>({card.kana})</div>
                  )}
                </>
              )}
              {phase === 4 && (
                <>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--accent3)' }}>{translatedCorrect}</div>
                  {card.kana && (
                    <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 8 }}>({card.kana})</div>
                  )}
                </>
              )}
            </PromptCard>

            {(phase === 1 || phase === 2) && (
              <MCQGrid choices={translatedChoices} correct={translatedCorrect}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}
            {phase === 3 && (
              <TypeInput value={input} onChange={setInput} onSubmit={onTypeSubmit}
                submitted={submitted} answer={card.kanji} placeholder={t.typeKanji}
                inputStyle={{ fontSize: 24, fontFamily: 'Yu Gothic, sans-serif' }}
                wrongExtra={
                  <div style={{ fontSize: 64, fontFamily: 'Yu Gothic, sans-serif', marginTop: 12 }}>
                    {card.kanji}
                  </div>
                }
              />
            )}
            {phase === 4 && card.kanji && (
              <DrawingCanvas
                kanji={card.kanji}
                meaning={translatedCorrect}
                onDone={() => {
                  setAnswered(true)
                  setShowRating(true)
                  speakJapanese(card.kana)
                }}
              />
            )}
            {phase === 4 && answered && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 72, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>
                  {card.kanji}
                </div>
                <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {card.kana}
                </div>
              </div>
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
        )}
      </div>
    </div>
  )
}