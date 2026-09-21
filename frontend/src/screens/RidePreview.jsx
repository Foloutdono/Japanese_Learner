import { useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import RideRun from './RideRun'
import RideReading from './RideReading'
import { playClick } from '../lib/audio'

// ── /dev/ride — the test ride on repeat (plan 098) ────────────────
// The OnboardingPreview of the ride: the REAL screen, the real stage,
// with the cards handed in as literals and nothing posted (dryRun).
// Registered beside /dev/onboarding in App.jsx's dev branch, outside
// the auth gate and dropped from production the same way. The ride
// reads the profile summary for the kana answer and the pace; the
// store answers nothing here, so the card wears no romaji and the done
// screen prints the default pace.
const CARDS = [
  {
    card_id: 'vocab_N3__こんにちは', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
    kanji: '', kana: 'こんにちは', meaning: 'hello', level: 'N3', romaji: 'konnichiwa',
    hints: {},
  },
  {
    card_id: 'vocab_N5_駅_えき', source: 'vocab', mode: 'vocab.flashcard.f2b', direction: 'f2b',
    kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', romaji: 'eki',
    hints: { indice_3: [{ text: '駅', reading: 'えき' }] },
  },
]

const SENTENCE = {
  phrase: '駅で友だちに会います。', romaji: 'eki de tomodachi ni aimasu.',
  translation: 'I meet a friend at the station.', translation_lang: 'en',
  display_seconds: 9.6, grammar: 'で',
}

export default function RidePreview() {
  const [run, setRun] = useState(1)
  const [phase, setPhase] = useState('cards') // cards | reading | ended
  const session = { access_token: 'dev-preview' }
  const ended = phase === 'ended'
  function replay() {
    playClick()
    setPhase('cards')
    setRun(n => n + 1)
  }
  return (
    <BrowserRouter>
      {phase === 'cards' && (
        <RideRun key={run} session={session} dryRun cards={CARDS} onNext={() => setPhase('reading')} onDone={() => setPhase('ended')} />
      )}
      {phase === 'reading' && (
        <RideReading key={run} session={session} dryRun sentence={SENTENCE} onDone={() => setPhase('ended')} />
      )}
      {ended && (
        <div className="onb-preview-done">
          <span lang="ja">試乗終了</span>
          <p>Run #{run} complete — nothing was written.</p>
        </div>
      )}
      <div className="onb-preview-bar">
        <span className="onb-preview-bar__tag">DEV</span>
        <span className="onb-preview-bar__run">run {run}</span>
        <button type="button" onClick={replay}>↺ Replay</button>
      </div>
    </BrowserRouter>
  )
}
