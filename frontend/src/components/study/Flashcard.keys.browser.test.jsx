import { useEffect, useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { Flashcard } from './QuizComponents'

// ── Space reveals the NEXT card too ───────────────────────────────
// A run resets its `answered` in an effect keyed on the card, so the
// render that brings the next card in still carries the last card's
// `true`, and the next card's Flashcard mounts in that render. Its
// Space listener used to be bound there and never again, holding an
// onReveal that saw `answered` true: Space turned the card, the run
// bailed, and the rating bar never came — a desk learner revealing by
// key was stuck on the second card of every run. A click was not,
// being bound every render.

vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

const CARDS = [['山', 'mountain'], ['川', 'river']]

// The run's own shape (KanjiRun, VocabRun, KanaRun, GrammarRun,
// StudyRun): the guard in onReveal, the id-keyed reset, and a rating
// that hides the bar and moves the deck on in one go.
function Run() {
  const [i, setI] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [showRating, setShowRating] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the runs' id-keyed reset, reproduced as they write it.
  useEffect(() => { setAnswered(false); setShowRating(false) }, [i])
  function onReveal() {
    if (answered) return
    setAnswered(true)
    setShowRating(true)
  }
  const [front, back] = CARDS[i]
  return (
    <LangProvider>
      <Flashcard
        t={{}}
        resetKey={front}
        onReveal={onReveal}
        front={<span className="probe-front">{front}</span>}
        back={<span className="probe-back">{back}</span>}
      />
      <button className="probe-rate" disabled={!showRating} onClick={() => { setShowRating(false); setI(n => n + 1) }}>
        rate
      </button>
    </LangProvider>
  )
}

describe('the flashcard reveal key', () => {
  it('raises the rating bar on the card after a rating', async () => {
    await render(<Run />)
    await settle()
    press(' ')
    await settle()
    const rate = document.querySelector('.probe-rate')
    expect(rate.disabled).toBe(false)

    rate.click()
    await settle()
    expect(document.querySelector('.flashcard').textContent).toContain('川')
    expect(rate.disabled).toBe(true)

    press(' ')
    await settle()
    expect(document.querySelector('.flashcard').textContent).toContain('river')
    expect(rate.disabled).toBe(false)
  })
})
