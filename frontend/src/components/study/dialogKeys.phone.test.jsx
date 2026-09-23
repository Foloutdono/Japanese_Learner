import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import RatingBar from './RatingBar'
import { Flashcard, MCQGrid } from './QuizComponents'
import { Sheet } from '../chrome/Sheet'
import '../../index.css'

// ── A key pressed in a dialog belongs to the dialog ───────────────
// A run answers to window-level keys. With a sheet open over it — the
// pass's balance, a dictionary entry, the way-out question — "1" used
// to rate the card behind the sheet and Space to turn it. Only reached
// with a keyboard, which on a phone means a tablet's or a paired one.

vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn() }))

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

function Run({ open, onRate, onAnswer }) {
  return (
    <LangProvider>
      <Flashcard t={{}} resetKey="a" front={<span className="probe-front">山</span>} back={<span className="probe-back">mountain</span>} />
      <MCQGrid choices={['a', 'b', 'c', 'd']} onAnswer={onAnswer} answered={false} renderChoice={c => c} />
      <RatingBar scale="full" active onRate={onRate} />
      <Sheet open={open} onClose={() => {}} jp="券" cap="pass"><p>balance</p></Sheet>
    </LangProvider>
  )
}

describe('the run keys under a dialog', () => {
  it('rate, pick and turn nothing while a sheet is open', async () => {
    const onRate = vi.fn()
    const onAnswer = vi.fn()
    const screen = await render(<Run open onRate={onRate} onAnswer={onAnswer} />)
    await settle()
    const before = document.querySelector('.flashcard').textContent
    press('1')
    press(' ')
    await settle()
    expect(onRate).not.toHaveBeenCalled()
    expect(onAnswer).not.toHaveBeenCalled()
    expect(document.querySelector('.flashcard').textContent).toBe(before)

    await screen.rerender(<Run open={false} onRate={onRate} onAnswer={onAnswer} />)
    await settle()
    press('1')
    press(' ')
    await settle()
    expect(onRate).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.flashcard').textContent).not.toBe(before)
  })
})
