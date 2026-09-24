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

// ── A browser chord is the browser's (plan 123) ──────────────────
// The card turned on Ctrl/⌘+S (save) and Ctrl/⌘+D (bookmark), and
// swallowed both; ⌘+1 answered the question on the page being left for
// another tab. The run's keys now take no chord, as the rating bar's
// always did -- and the rating bar takes key 6 on a French PC keyboard,
// where it types '-'.
describe('a chord under a run', () => {
  const chord = (key, mod) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, [mod]: true })
    window.dispatchEvent(e)
    return e
  }

  it('neither turns the card nor picks a choice, and is left to the browser', async () => {
    const onAnswer = vi.fn()
    await render(<Run open={false} onRate={() => {}} onAnswer={onAnswer} />)
    await settle()
    const before = document.querySelector('.flashcard').textContent
    const save = chord('s', 'ctrlKey')
    const mark = chord('d', 'metaKey')
    chord('1', 'metaKey')
    chord('2', 'altKey')
    await settle()
    expect(save.defaultPrevented).toBe(false)
    expect(mark.defaultPrevented).toBe(false)
    expect(onAnswer).not.toHaveBeenCalled()
    expect(document.querySelector('.flashcard').textContent).toBe(before)
    press('s')
    await settle()
    expect(document.querySelector('.flashcard').textContent).not.toBe(before)
  })

  it('rates 6 on a French PC keyboard\'s key 6', async () => {
    const onRate = vi.fn()
    await render(<LangProvider><RatingBar scale="full" active onRate={onRate} /></LangProvider>)
    await settle()
    press('6')
    await settle()
    press('-')
    await settle()
    // The same grade as the digit it stands for.
    expect(onRate).toHaveBeenCalledTimes(2)
    expect(onRate.mock.calls[1][0]).toBe(onRate.mock.calls[0][0])
  })
})

// ── One Escape, one dialog (plan 123) ────────────────────────────
// The offer opens as a second sheet over the balance (its "see the
// pass") or over the run-out. Every sheet heard Escape on window in the
// same phase, so one Escape closed the offer AND the balance -- and over
// the run-out, whose way out is to leave, it left the run. The offer is
// opened `over`: it hears Escape first and keeps it.
describe('the offer over another sheet', () => {
  it('closes alone on Escape', async () => {
    const { PaywallSheet } = await import('../credits/PaywallSheet')
    const { openPaywall, usePaywall } = await import('../../stores/credits')
    const under = vi.fn()
    function Stack() {
      const offer = usePaywall()
      return (
        <LangProvider>
          <Sheet open onClose={under} jp="券" cap="balance">
            <button type="button" className="probe-see" onClick={() => openPaywall('balance')}>see the pass</button>
          </Sheet>
          <PaywallSheet />
          <span className="probe-offer">{offer ? 'open' : 'closed'}</span>
        </LangProvider>
      )
    }
    await render(<Stack />)
    await settle()
    document.querySelector('.probe-see').click()
    await settle()
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(2)
    // From where the focus is, as a real key is: the offer took it.
    expect(document.activeElement.closest('.sheet--sumi')).not.toBeNull()
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await settle()
    expect(document.querySelector('.probe-offer').textContent).toBe('closed')
    expect(under).not.toHaveBeenCalled()
  })
})
