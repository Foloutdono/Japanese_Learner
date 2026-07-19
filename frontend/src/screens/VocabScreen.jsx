import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, CharDisplay, MeaningDisplay,
} from '../components/QuizComponents'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
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
  const [progress, setProgress]       = useState(null)
  const [xpToast, setXpToast]         = useState(null)
  
  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  // Re-translate when language changes without re-fetching
  useEffect(() => {
    if (card && card.lang !== lang) translateCard(card, lang)
  }, [lang])

  function fetchCard(lvl, m) {
    setLoading(true)
    setAnswered(false)
    setSelected(null)
    setShowRating(false)

    apiFetch(`/api/vocab/card?level=${lvl}&mode=${m}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => {
        if (data.done) { setDone(true); setCard(null) }
        else { setCard({ ...data, lang }); setDone(false) }
        setLoading(false)
      })
  }

  // Mirrors KanjiScreen's translateCard: words are looked up by
  // wordForm (kanji, falling back to kana for kana-only entries) since
  // that's also how the backend's vocab translation map is keyed.
  function translateCard(cardToTranslate, targetLang) {
    if (!cardToTranslate) return
    const words = [wordForm(cardToTranslate), ...(cardToTranslate.choices ?? []).map(wordForm)]
    const unique = [...new Set(words.filter(Boolean))]
    Promise.all(unique.map(word =>
      apiFetch(`/api/translation/vocab?word=${encodeURIComponent(word)}&lang=${targetLang}`, session)
        .then(r => r.json())
        .then(data => [word, data.translation || ''])
    )).then(entries => {
      const map = Object.fromEntries(entries)
      setCard(cur => ({
        ...cur,
        lang: targetLang,
        meaning: map[wordForm(cur)] ?? cur.meaning,
        choices: (cur.choices ?? []).map(c => ({ ...c, meaning: map[wordForm(c)] ?? c.meaning })),
      }))
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
    }).then(r => r.json()).then(data => {
      if (typeof data.xp_earned === 'number') {
        setXpToast({ amount: data.xp_earned, id: Date.now(), leveledUp: data.leveled_up, newLevel: data.new_level })
      }
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
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={`${t.vocabulary} JLPT`} />
        <SelectionScreen>
          <LevelSelector onSelect={setLevel} color="var(--accent2)" title={t.selectLevel} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setLevel(null)} title={`${t.vocabulary} ${level}`} />
        <SelectionScreen>
          <ModeSelector modes={MODES} onSelect={m => startSession(level, m)} title={t.selectMode} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Quiz ──
  const isKjToM = card?.direction === 'kj-m'
  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${t.vocabulary} ${level} — ${modeLabel}`} autoHide />
      <XpToast toast={xpToast} onDone={() => setXpToast(null)} />
      <div className="container quiz-area">
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}
        {card && !loading && (
          <>
            <div className="vocab-card-boost">
              <PromptCard>
                {card.format === 'flashcard' && (
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={
                      <CharDisplay char={isKjToM ? wordForm(card) : card.meaning} size={72} />
                    }
                    back={
                      <InlineReveal
                        t={t}
                        kana={card.kanji ? card.kana : null}
                        isLarge={isKjToM}
                        main={
                          isKjToM
                            ? <MeaningDisplay meaning={card.meaning} size={28} color="var(--accent2)" center={false} />
                            : <CharDisplay char={wordForm(card)} size={72} />
                        }
                      />
                    }
                  />
                )}

                {card.format === 'qcm' && (
                  <InlineReveal
                    t={t}
                    kana={card.kanji ? card.kana : null}
                    revealed={answered}
                    main={
                      isKjToM
                        ? <CharDisplay char={wordForm(card)} size={72} />
                        : <CharDisplay char={card.meaning} size={72} />
                    }
                  />
                )}
              </PromptCard>
            </div>

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