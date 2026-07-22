import { useState } from 'react'
import { TopBar } from '../TopBar'
import RatingBar from '../RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, CharDisplay, MeaningDisplay,
} from '../QuizComponents'
import { Loading } from '../Loading'
import { XpToast } from '../XpToast'
import { CardStamp } from '../CardStamp'
import LevelSelector from '../LevelSelector'
import ModeSelector from '../ModeSelector'
import SelectionScreen from '../SelectionScreen'
import PromptCard from '../PromptCard'
import { speakJapanese } from '../sound'

// Reconstructs the current VocabScreen: a batched useCardSession
// queue (advance() is a synchronous local pop — no per-card loading
// spinner) plus the CardStamp overlay for stage_up promotions. No
// write mode here (unlike Kanji) and entries can be kana-only, hence
// wordForm's kanji-or-kana fallback, mirrored from the real screen.
// apiFetch/useCardSession/translation need a real backend, so the
// queue is a small canned deck.

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const MODES = [
  { key: 'kj-m-flashcard', label: 'Mot → sens (flashcard)' },
  { key: 'kj-m-qcm', label: 'Mot → sens (QCM)' },
  { key: 'm-kj-flashcard', label: 'Sens → mot (flashcard)' },
  { key: 'm-kj-qcm', label: 'Sens → mot (QCM)' },
]

// Mixes a kanji entry with a kana-only entry, like real JLPT decks.
const WORDS = [
  { kanji: '食べる', kana: 'たべる', meaning: 'to eat' },
  { kanji: null, kana: 'ありがとう', meaning: 'thank you' },
  { kanji: '学校', kana: 'がっこう', meaning: 'school' },
]

const PROGRESS = { total: 80, new: 30, learning: 28, mastered: 22, due_now: 9 }

function wordForm(entry) { return entry.kanji || entry.kana }

function buildDeck(mode) {
  const direction = mode.startsWith('kj-m') ? 'kj-m' : 'm-kj'
  const format = mode.endsWith('flashcard') ? 'flashcard' : 'qcm'
  return WORDS.map((w, i) => ({
    card_id: i, ...w, direction, format,
    choices: WORDS.map(c => ({ kanji: c.kanji, kana: c.kana, meaning: c.meaning })),
  }))
}

function VocabFlow({ initialMode, forceLevelUp, forceStamp }) {
  const started = !!(initialMode || forceLevelUp || forceStamp)
  const [level, setLevel] = useState(started ? 'N5' : null)
  const [mode, setMode] = useState(initialMode ?? (started ? 'kj-m-qcm' : null))
  const initialDeck = buildDeck(initialMode || mode || 'kj-m-qcm')
  const [queue, setQueue] = useState(initialDeck.slice(1))
  const [card, setCard] = useState(initialDeck[0])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [answered, setAnswered] = useState(!!forceLevelUp)
  const [selected, setSelected] = useState(forceLevelUp ? initialDeck[0]?.meaning : null)
  const [showRating, setShowRating] = useState(!!forceLevelUp)
  const [xpToast, setXpToast] = useState(
    forceLevelUp ? { amount: 50, id: 0, leveledUp: true, newLevel: 7, quality: 5 } : null
  )
  const [cardStamp, setCardStamp] = useState(
    forceStamp ? { id: 0, to: 'mastered' } : null
  )

  function startMode(m) {
    const d = buildDeck(m)
    setMode(m)
    setLoading(true) // only the first batch shows a spinner
    setTimeout(() => {
      setQueue(d.slice(1))
      setCard(d[0])
      setLoading(false)
    }, 400)
  }

  // Synchronous local pop — no network wait, matching useCardSession.
  function advance() {
    setAnswered(false); setSelected(null); setShowRating(false)
    setQueue(q => {
      if (q.length === 0) { setDone(true); setCard(null); return q }
      const [head, ...rest] = q
      setCard(head)
      return rest
    })
  }

  function postReview(quality) {
    if (xpToast?.leveledUp) return
    advance()

    setTimeout(() => {
      const leveledUp = quality === 5 // deterministic demo trigger, not the real threshold
      setXpToast({ amount: leveledUp ? 50 : quality * 4 + 2, id: Date.now(), leveledUp, newLevel: 7, quality })
      if (quality >= 4) setCardStamp({ id: Date.now(), to: quality === 5 ? 'mastered' : 'learning' })
    }, 300)
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice); setAnswered(true); setShowRating(true)
    speakJapanese(card.kana)
  }
  function onFlashcardReveal() {
    if (answered) return
    setAnswered(true); setShowRating(true)
    speakJapanese(card.kana)
  }

  if (!level) {
    return (
      <div className="screen">
        <TopBar onBack={() => console.log('[VocabFlow] back home')} title="Vocabulaire JLPT" />
        <SelectionScreen>
          <LevelSelector onSelect={setLevel} color="var(--accent2)" levels={LEVELS} title="Choisis ton niveau" />
        </SelectionScreen>
      </div>
    )
  }

  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setLevel(null)} title={`Vocabulaire ${level}`} />
        <SelectionScreen>
          <ModeSelector modes={MODES} onSelect={startMode} title="Choisis un mode" />
        </SelectionScreen>
      </div>
    )
  }

  const isKjToM = card?.direction === 'kj-m'
  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`Vocabulaire ${level} — ${modeLabel}`} autoHide />
      <XpToast toast={xpToast} onDone={() => setXpToast(null)} />
      <div className="container quiz-area">
        <DeckProgress stats={PROGRESS} />
        {loading && <Loading />}
        {done && <DoneMessage onBack={() => setMode(null)} />}
        {card && !loading && (
          <>
            <div className="vocab-card-boost quiz-card-stage">
              <PromptCard>
                {card.format === 'flashcard' && (
                  <Flashcard
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={<CharDisplay char={isKjToM ? wordForm(card) : card.meaning} size={72} />}
                    back={
                      <InlineReveal
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
                    kana={card.kanji ? card.kana : null}
                    revealed={answered}
                    main={isKjToM ? <CharDisplay char={wordForm(card)} size={72} /> : <CharDisplay char={card.meaning} size={72} />}
                  />
                )}
              </PromptCard>
              <CardStamp transition={cardStamp} onDone={() => setCardStamp(null)} />
            </div>

            {card.format === 'qcm' && (
              <MCQGrid
                choices={card.choices.map(c => isKjToM ? c.meaning : wordForm(c))}
                correct={isKjToM ? card.meaning : wordForm(card)}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            <RatingBar active={showRating && !xpToast?.leveledUp} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}

export default {
  title: 'Screens/VocabScreen',
}

// The full real journey, including a kana-only entry (no kanji) mixed
// into the deck like real JLPT decks have.
export const LiveFlow = { render: () => <VocabFlow /> }

export const QuizWordToMeaning = { render: () => <VocabFlow initialMode="kj-m-qcm" /> }
export const QuizMeaningToWord = { render: () => <VocabFlow initialMode="m-kj-flashcard" /> }
export const StageUpStamp = { render: () => <VocabFlow forceStamp /> }
export const LevelUpLock = { render: () => <VocabFlow forceLevelUp /> }