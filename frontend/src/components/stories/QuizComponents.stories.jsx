import { useState } from 'react'
import {
  CharDisplay, MCQButton, MCQGrid, TypeInput, ModeToggle, DoneMessage,
  DeckProgress, Readings, MeaningDisplay, InlineReveal, Flashcard,
  QuestionTypeBadge,
} from '../QuizComponents'

// ── QuizComponents ────────────────────────────────────────
// The shared building blocks every quiz screen (Kana/Kanji/Vocab/
// Grammar/reading comprehension) assembles differently. Most of these
// call useLang() internally for their own copy — same global
// LangContext decorator assumption as every other story file here.
//
// MCQGrid, TypeInput and Flashcard each attach their own window
// keydown listener while active/mounted (digit keys 1-4 or AZERTY for
// MCQGrid, Enter for TypeInput, Space/ZQSD for Flashcard — see each
// component's own comments) — worth knowing if two of these stories
// end up mounted on the same canvas and a shortcut seems to fire the
// wrong one.
//
// Debug note, not a story: QuizComponents also exports its own
// `Loading`, byte-for-byte the same component as the standalone
// Loading.jsx (see Loading.stories.jsx) — screens currently import
// the standalone one, so this export looks unused/stale. Worth a
// second look if the two ever drift apart.
export default {
  title: 'Quiz/QuizComponents',
}

export const CharDisplaySmall = { render: () => <CharDisplay char="あ" size={48} /> }
export const CharDisplayLarge = { render: () => <CharDisplay char="日" size={110} /> }

// MCQGrid owns none of its own state — this wrapper reproduces what
// KanaScreen/KanjiScreen/VocabScreen actually do: selected/answered
// live in the parent, onAnswer just records the click.
function MCQDemo() {
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const choices = ['mizu', 'hi', 'ki', 'tsuchi']

  return (
    <div>
      <MCQGrid
        choices={choices}
        correct="mizu"
        selected={selected}
        answered={answered}
        onAnswer={c => { setSelected(c); setAnswered(true) }}
      />
      {answered && (
        <button style={{ marginTop: 12 }} onClick={() => { setSelected(null); setAnswered(false) }}>
          Reset
        </button>
      )}
    </div>
  )
}
export const MCQGridDemo = { render: () => <MCQDemo /> }

export const MCQButtonStates = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 360 }}>
      <MCQButton choice="mizu" correct="mizu" selected={null} answered={false} index={0} onClick={() => {}} />
      <MCQButton choice="mizu" correct="mizu" selected="mizu" answered index={1} onClick={() => {}} />
      <MCQButton choice="hi" correct="mizu" selected="hi" answered index={2} onClick={() => {}} />
    </div>
  ),
}

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

function ModeToggleDemo() {
  const [mode, setMode] = useState('qcm')
  return <ModeToggle mode={mode} onChange={setMode} />
}
export const ModeToggleStory = { render: () => <ModeToggleDemo /> }

export const DoneMessageStory = {
  render: () => <DoneMessage onBack={() => console.log('[DoneMessage] onBack')} />,
}

export const DeckProgressStory = {
  render: () => <DeckProgress stats={{ total: 40, new: 12, learning: 18, mastered: 10 }} />,
}
export const DeckProgressEmpty = {
  // total: 0 (or no stats yet) → renders null, same as a set/mode
  // that has no cards at all.
  render: () => <DeckProgress stats={{ total: 0, new: 0, learning: 0, mastered: 0 }} />,
}

export const MeaningDisplaySingle = { render: () => <MeaningDisplay meaning="water" /> }
export const MeaningDisplayMultiple = {
  render: () => <MeaningDisplay meaning="to eat, to have a meal, to consume" />,
}

export const ReadingsMixed = {
  render: () => <Readings kana="スイ・シュ・みず" onLabel="On'yomi" kunLabel="Kun'yomi" />,
}
export const ReadingsSingleRegister = {
  render: () => <Readings kana="みず" />,
}

function InlineRevealDemo() {
  const [revealed, setRevealed] = useState(false)
  return (
    <div>
      <InlineReveal
        main={<CharDisplay char="水" size={72} />}
        kana="スイ・みず"
        revealed={revealed}
      />
      <button style={{ marginTop: 12 }} onClick={() => setRevealed(r => !r)}>
        Toggle revealed
      </button>
    </div>
  )
}
export const InlineRevealStory = { render: () => <InlineRevealDemo /> }

export const FlashcardDemo = {
  render: () => (
    <Flashcard
      resetKey="demo-1"
      front={<CharDisplay char="水" />}
      back={
        <div>
          <CharDisplay char="水" />
          <div style={{ opacity: 0.7, marginTop: 8 }}>mizu — water</div>
        </div>
      }
      onReveal={() => console.log('[Flashcard] onReveal')}
    />
  ),
}

export const QuestionTypeBadges = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <QuestionTypeBadge type="comprehension" />
      <QuestionTypeBadge type="vocabulary" />
      <QuestionTypeBadge type="grammar" />
      <QuestionTypeBadge type="inference" />
      <QuestionTypeBadge type="unknown_type" />
    </div>
  ),
}