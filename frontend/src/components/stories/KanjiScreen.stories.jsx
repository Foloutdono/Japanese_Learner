import { useState } from 'react'
import { TopBar } from '../TopBar'
import RatingBar from '../RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, MeaningDisplay, CharDisplay,
} from '../QuizComponents'
import { Loading } from '../Loading'
import { XpToast } from '../XpToast'
import { CardStamp } from '../CardStamp'
import LevelSelector from '../LevelSelector'
import ModeSelector from '../ModeSelector'
import SelectionScreen from '../SelectionScreen'
import PromptCard from '../PromptCard'
import { DrawingQuiz, DrawingOverlay } from '../DrawingCanvas'
import { speakJapanese } from '../sound'

// Reconstructs the current KanjiScreen: a batched useCardSession
// queue (advance() is a synchronous local pop — no per-card loading
// spinner), the CardStamp overlay for stage_up promotions, the
// writing-drill overlay (a low review on a m-kj card holds the queue
// until the drill is dismissed, then advance() fires from its onDone),
// and the XP-toast level-up lock. apiFetch/useCardSession/translation
// need a real backend, so the queue is a small canned deck.

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

const MODES = [
  { key: 'kj-m-flashcard', label: 'Kanji → sens (flashcard)' },
  { key: 'kj-m-qcm', label: 'Kanji → sens (QCM)' },
  { key: 'm-kj-flashcard', label: 'Sens → kanji (flashcard)' },
  { key: 'm-kj-qcm', label: 'Sens → kanji (QCM)' },
  { key: 'write', label: 'Écriture' },
]

const WORDS = [
  { kanji: '水', meaning: 'water', kana: 'すい・みず' },
  { kanji: '火', meaning: 'fire', kana: 'か・ひ' },
  { kanji: '木', meaning: 'tree', kana: 'もく・き' },
]

const PROGRESS = { total: 60, new: 20, learning: 25, mastered: 15, due_now: 4 }

function buildDeck(mode) {
  if (mode === 'write') return WORDS.map((w, i) => ({ card_id: i, ...w, format: 'write' }))
  const direction = mode.startsWith('kj-m') ? 'kj-m' : 'm-kj'
  const format = mode.endsWith('flashcard') ? 'flashcard' : 'qcm'
  return WORDS.map((w, i) => ({
    card_id: i, ...w, direction, format,
    choices: WORDS.map(c => ({ kanji: c.kanji, meaning: c.meaning })),
  }))
}

function KanjiFlow({ initialMode, forceLevelUp, forceTraining, forceStamp }) {
  const started = !!(initialMode || forceLevelUp || forceTraining || forceStamp)
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
  const [showDrawing, setShowDrawing] = useState(!!forceTraining)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
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
    setAnswered(false); setSelected(null); setShowRating(false); setShowDrawing(false)
    setQueue(q => {
      if (q.length === 0) { setDone(true); setCard(null); return q }
      const [head, ...rest] = q
      setCard(head)
      return rest
    })
  }

  function postReview(quality) {
    if (xpToast?.leveledUp) return
    const needTraining = quality <= 3 && card?.direction === 'm-kj' && drawingEnabled

    if (needTraining) { setShowRating(false); setShowDrawing(true) } // advance() fires from DrawingOverlay's onDone
    else { advance() }

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
        <TopBar onBack={() => console.log('[KanjiFlow] back home')} title="Kanji" autoHide />
        <SelectionScreen>
          <LevelSelector onSelect={setLevel} color="var(--accent3)" levels={LEVELS} />
        </SelectionScreen>
      </div>
    )
  }

  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setLevel(null)} title={`Kanji ${level}`} autoHide />
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
      <TopBar
        onBack={() => setMode(null)}
        title={`Kanji ${level} — ${modeLabel}`}
        autoHide
        actions={
          <button
            onClick={() => setDrawingEnabled(d => !d)}
            className={`btn-writing-toggle ${drawingEnabled ? 'btn-writing-toggle--on' : 'btn-writing-toggle--off'}`}
          >
            ✏️ {drawingEnabled ? 'ON' : 'OFF'}
          </button>
        }
      />
      <XpToast toast={xpToast} onDone={() => setXpToast(null)} />
      <div className="container quiz-area">
        <DeckProgress stats={PROGRESS} />
        {loading && <Loading />}
        {done && <DoneMessage onBack={() => setMode(null)} />}

        {card && !loading && (
          <>
            {mode !== 'write' && (
              <div className="quiz-card-stage">
                <PromptCard>
                  {card.format === 'flashcard' && (
                    <Flashcard
                      resetKey={card.card_id}
                      onReveal={onFlashcardReveal}
                      front={isKjToM ? <CharDisplay char={card.kanji} size={100} /> : <MeaningDisplay meaning={card.meaning} size={44} />}
                      back={
                        <InlineReveal
                          kana={card.kana}
                          isLarge={isKjToM}
                          main={isKjToM ? <MeaningDisplay meaning={card.meaning} size={28} /> : <CharDisplay char={card.kanji} size={72} />}
                        />
                      }
                    />
                  )}
                  {card.format === 'qcm' && (
                    <InlineReveal
                      kana={card.kana}
                      revealed={answered}
                      main={isKjToM ? <CharDisplay char={card.kanji} size={100} /> : <MeaningDisplay meaning={card.meaning} size={44} />}
                    />
                  )}
                </PromptCard>
                <CardStamp transition={cardStamp} onDone={() => setCardStamp(null)} />
              </div>
            )}

            {mode === 'write' && (
              <div className="quiz-card-stage">
                <PromptCard>
                  <MeaningDisplay meaning={card.meaning} size={32} />
                  {card.kana && <div className="quiz-subtitle">({card.kana})</div>}
                </PromptCard>
                <CardStamp transition={cardStamp} onDone={() => setCardStamp(null)} />
              </div>
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
                onValidate={() => { setAnswered(true); setShowRating(true); speakJapanese(card.kana) }}
              />
            )}
            {mode === 'write' && answered && (
              <div className="quiz-writing-result"><CharDisplay char={card.kanji} size={72} /></div>
            )}

            <RatingBar active={showRating && !xpToast?.leveledUp} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay kanji={card.kanji} meaning={card.meaning} onDone={advance} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default {
  title: 'Screens/KanjiScreen',
}

// The full real journey: level → mode → cards, with the writing-drill
// overlay, the stage-up stamp, and the XP-toast level-up lock all
// wired the same way they are in the real screen.
export const LiveFlow = { render: () => <KanjiFlow /> }

export const QuizKanjiToMeaning = { render: () => <KanjiFlow initialMode="kj-m-qcm" /> }
export const QuizMeaningToKanji = { render: () => <KanjiFlow initialMode="m-kj-flashcard" /> }
export const QuizWrite = { render: () => <KanjiFlow initialMode="write" /> }

// A low rating on a m-kj card triggers this before the queue advances.
export const WritingDrillLock = { render: () => <KanjiFlow forceTraining /> }
export const StageUpStamp = { render: () => <KanjiFlow forceStamp /> }
export const LevelUpLock = { render: () => <KanjiFlow forceLevelUp /> }