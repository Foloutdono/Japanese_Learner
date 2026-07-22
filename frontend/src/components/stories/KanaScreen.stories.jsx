import { useState } from 'react'
import { TopBar } from '../TopBar'
import RatingBar from '../RatingBar'
import {
  CharDisplay, MCQGrid, TypeInput, DoneMessage,
  DeckProgress, Flashcard,
} from '../QuizComponents'
import { Loading } from '../Loading'
import { XpToast } from '../XpToast'
import { CardStamp } from '../CardStamp'
import PromptCard from '../PromptCard'
import SelectionScreen from '../SelectionScreen'
import ModeSelector from '../ModeSelector'
import { playKana } from '../sound'

// Reconstructs the current KanaScreen: a batched useCardSession
// queue (advance() is now a synchronous local pop, so answering never
// shows a loading spinner — only the very first batch does) plus the
// CardStamp overlay for stage_up promotions, layered alongside the
// XP-toast/RatingBar level-up lock. apiFetch/useCardSession need a
// real backend, so the queue here is a small canned deck refilled
// with setTimeout standing in for the initial batch fetch.

const SETS = [
  { label: 'Hiragana de base', slug: 'hiragana_basic' },
  { label: 'Hiragana combinés', slug: 'hiragana_combos' },
  { label: 'Katakana de base', slug: 'katakana_basic' },
  { label: 'Katakana combinés', slug: 'katakana_combos' },
]

const MODES = [
  { key: 'flashcard', label: 'Flashcard', desc: 'Révélez la romanisation' },
  { key: 'qcm', label: 'QCM', desc: 'Choisissez la bonne romanisation' },
  { key: 'write', label: 'Écriture', desc: 'Tapez la romanisation' },
]

const DECK = [
  { card_id: 1, kana: 'あ', romaji: 'a', choices: ['a', 'i', 'u', 'ka'] },
  { card_id: 2, kana: 'き', romaji: 'ki', choices: ['ki', 'shi', 'chi', 'ni'] },
  { card_id: 3, kana: 'ん', romaji: 'n', choices: ['n', 'ru', 'tsu', 'ne'] },
]

const PROGRESS = { total: 40, new: 12, learning: 18, mastered: 10, due_now: 6 }

function KanaFlow({ initialMode, forceLevelUp, forceStamp, forceDone }) {
  const started = !!(initialMode || forceLevelUp || forceStamp || forceDone)
  const [selectedSet, setSelectedSet] = useState(started ? SETS[0] : null)
  const [mode, setMode] = useState(initialMode ?? (started ? 'qcm' : null))
  const [queue, setQueue] = useState(forceDone ? [] : DECK.slice(1))
  const [card, setCard] = useState(forceDone ? null : DECK[0])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(!!forceDone)
  const [answered, setAnswered] = useState(!!forceLevelUp)
  const [selected, setSelected] = useState(forceLevelUp ? DECK[0].romaji : null)
  const [showRating, setShowRating] = useState(!!forceLevelUp)
  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [xpToast, setXpToast] = useState(
    forceLevelUp ? { amount: 50, id: 0, leveledUp: true, newLevel: 7, quality: 5 } : null
  )
  const [cardStamp, setCardStamp] = useState(
    forceStamp ? { id: 0, to: 'mastered' } : null
  )

  function startMode(m) {
    setMode(m)
    setLoading(true) // only the first batch shows a spinner
    setTimeout(() => {
      setQueue(DECK.slice(1))
      setCard(DECK[0])
      setLoading(false)
    }, 400)
  }

  // Synchronous local pop — no network wait, matching useCardSession.
  function advance() {
    setAnswered(false); setSelected(null); setShowRating(false); setInput(''); setSubmitted(false)
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
    playKana(card.romaji)
  }
  function onFlashcardReveal() {
    if (answered) return
    setAnswered(true); setShowRating(true)
    playKana(card.romaji)
  }
  function onTypeSubmit() {
    if (submitted || !input.trim()) return
    setSubmitted(true); setShowRating(true)
    playKana(card.romaji)
  }

  if (!selectedSet) {
    return (
      <div className="screen">
        <TopBar onBack={() => console.log('[KanaFlow] back home')} title="Kana" />
        <SelectionScreen>
          <ModeSelector
            modes={SETS.map(s => ({ key: s.slug, label: s.label }))}
            onSelect={slug => setSelectedSet(SETS.find(s => s.slug === slug))}
            title="Choisis ton set de kana"
          />
        </SelectionScreen>
      </div>
    )
  }

  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSelectedSet(null)} title={selectedSet.label} autoHide />
        <SelectionScreen>
          <ModeSelector modes={MODES} onSelect={startMode} title="Choisis un mode" />
        </SelectionScreen>
      </div>
    )
  }

  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${selectedSet.label} — ${modeLabel}`} autoHide />
      <XpToast toast={xpToast} onDone={() => setXpToast(null)} />
      <div className="container quiz-area">
        <DeckProgress stats={PROGRESS} />
        {loading && <Loading />}
        {done && <DoneMessage onBack={() => setMode(null)} />}
        {card && !loading && (
          <>
            {mode === 'flashcard' && (
              <div className="quiz-card-stage">
                <PromptCard>
                  <Flashcard
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={<CharDisplay char={card.kana} />}
                    back={
                      <div>
                        <CharDisplay char={card.kana} />
                        <div className="flashcard-answer">{card.romaji}</div>
                      </div>
                    }
                  />
                </PromptCard>
                <CardStamp transition={cardStamp} onDone={() => setCardStamp(null)} />
              </div>
            )}
            {(mode === 'qcm' || mode === 'write') && (
              <div className="quiz-card-stage">
                <PromptCard><CharDisplay char={card.kana} /></PromptCard>
                <CardStamp transition={cardStamp} onDone={() => setCardStamp(null)} />
              </div>
            )}
            {mode === 'qcm' && (
              <MCQGrid choices={card.choices} correct={card.romaji}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}
            {mode === 'write' && (
              <TypeInput value={input} onChange={setInput} onSubmit={onTypeSubmit}
                submitted={submitted} answer={card.romaji} placeholder="Tapez la romanisation" />
            )}
            <RatingBar active={showRating && !xpToast?.leveledUp} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}

export default {
  title: 'Screens/KanaScreen',
}

// The full real journey: pick a set, pick a mode (one spinner for the
// first batch, then instant local advances), rate cards, watch the
// stage-up stamp and the XP-toast level-up lock both fire, then hit
// the done screen once the 3-card demo deck is exhausted.
export const LiveFlow = { render: () => <KanaFlow /> }

export const QuizFlashcard = { render: () => <KanaFlow initialMode="flashcard" /> }
export const QuizQCM = { render: () => <KanaFlow initialMode="qcm" /> }
export const QuizWrite = { render: () => <KanaFlow initialMode="write" /> }
export const StageUpStamp = { render: () => <KanaFlow forceStamp /> }
export const LevelUpLock = { render: () => <KanaFlow forceLevelUp /> }
export const DeckDone = { render: () => <KanaFlow forceDone /> }