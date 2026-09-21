import { useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import RideRun from './RideRun'
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

export default function RidePreview() {
  const [run, setRun] = useState(1)
  const [ended, setEnded] = useState(false)
  const session = { access_token: 'dev-preview' }
  function replay() {
    playClick()
    setEnded(false)
    setRun(n => n + 1)
  }
  return (
    <BrowserRouter>
      {!ended && (
        <RideRun key={run} session={session} dryRun cards={CARDS} onDone={() => setEnded(true)} />
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
