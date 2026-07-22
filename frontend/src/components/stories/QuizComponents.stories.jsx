import { useState } from 'react'
import {
  CharDisplay, MCQGrid, TypeInput, DoneMessage,
  DeckProgress, Readings, MeaningDisplay, InlineReveal, Flashcard,
  QuestionTypeBadge,
} from '../QuizComponents'

// Shared building blocks assembled differently by Kana/Kanji/Vocab
// screens. MCQGrid, TypeInput and Flashcard each attach their own
// window keydown listener while mounted (digit/AZERTY keys, Enter,
// Space/ZQSD) — worth knowing if two land on the same canvas.
export default {
  title: 'Quiz/QuizComponents',
}

export const CharDisplayKana = { render: () => <CharDisplay char="あ" size={48} /> }
export const CharDisplayKanji = { render: () => <CharDisplay char="日" size={110} /> }

// Reproduces KanaScreen's qcm mode exactly: selected/answered live in
// the parent, onAnswer just records the click, correct is the romaji.
function KanaMCQDemo() {
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const card = { kana: '水', romaji: 'mizu', choices: ['mizu', 'hi', 'ki', 'tsuchi'] }

  return (
    <div>
      <CharDisplay char={card.kana} />
      <MCQGrid
        choices={card.choices}
        correct={card.romaji}
        selected={selected}
        answered={answered}
        onAnswer={c => { setSelected(c); setAnswered(true) }}
      />
    </div>
  )
}
export const KanaMCQ = { render: () => <KanaMCQDemo /> }

// Reproduces KanjiScreen's qcm mode in the kj-m (kanji → meaning)
// direction, where choices are meaning strings pulled off card.choices.
function KanjiMCQDemo() {
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const card = {
    kanji: '水', meaning: 'water',
    choices: [{ meaning: 'water' }, { meaning: 'fire' }, { meaning: 'tree' }, { meaning: 'earth' }],
  }

  return (
    <div>
      <InlineReveal kana="スイ・みず" revealed={answered} main={<CharDisplay char={card.kanji} size={100} />} />
      <MCQGrid
        choices={card.choices.map(c => c.meaning)}
        correct={card.meaning}
        selected={selected}
        answered={answered}
        onAnswer={c => { setSelected(c); setAnswered(true) }}
      />
    </div>
  )
}
export const KanjiMCQ = { render: () => <KanjiMCQDemo /> }

// KanaScreen's write mode.
function TypeInputDemo() {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  return (
    <TypeInput
      value={value}
      onChange={setValue}
      onSubmit={() => setSubmitted(true)}
      submitted={submitted}
      answer="mizu"
      placeholder="Tapez la romanisation"
    />
  )
}
export const TypeInputStory = { render: () => <TypeInputDemo /> }

export const DoneMessageStory = {
  render: () => <DoneMessage onBack={() => console.log('[DoneMessage] onBack')} />,
}

// Real shape from /api/*/stats — the fields StatsScreen's StatCell
// and each screen's DeckProgress both read.
export const DeckProgressStory = {
  render: () => (
    <DeckProgress stats={{ total: 40, new: 12, learning: 18, mastered: 10, due_now: 6 }} />
  ),
}
export const DeckProgressEmpty = {
  render: () => (
    <DeckProgress stats={{ total: 0, new: 0, learning: 0, mastered: 0, due_now: 0 }} />
  ),
}

export const MeaningDisplayStory = { render: () => <MeaningDisplay meaning="water" /> }
export const MeaningDisplayMultiple = {
  render: () => <MeaningDisplay meaning="to eat, to have a meal, to consume" />,
}

export const ReadingsStory = {
  render: () => <Readings kana="スイ・シュ・みず" onLabel="On'yomi" kunLabel="Kun'yomi" />,
}

// KanjiScreen's flashcard, kj-m direction.
export const FlashcardKanji = {
  render: () => (
    <Flashcard
      resetKey="demo-1"
      front={<CharDisplay char="水" size={100} />}
      back={
        <InlineReveal
          kana="スイ・みず"
          isLarge
          main={<MeaningDisplay meaning="water" size={28} />}
        />
      }
      onReveal={() => console.log('[Flashcard] onReveal')}
    />
  ),
}

// Exported by ReadingScreen's segment-tagging data (comprehension /
// vocabulary / grammar / inference question types).
export const QuestionTypeBadges = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <QuestionTypeBadge type="comprehension" />
      <QuestionTypeBadge type="vocabulary" />
      <QuestionTypeBadge type="grammar" />
      <QuestionTypeBadge type="inference" />
    </div>
  ),
}