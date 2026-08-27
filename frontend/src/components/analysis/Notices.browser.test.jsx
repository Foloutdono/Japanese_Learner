import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { Notices } from './Notices'

// Pins the two defects the wave-5 retrospective named: the live region
// has to exist before it has anything to say, and an 'info' notice must
// never pick up the 'bad' styling that used to be hard-coded onto it.

describe('Notices', () => {
  it('renders the live region with no notices and no announcement', async () => {
    const screen = await render(<Notices notices={[]} announcement={undefined} t={{}} />)
    const region = screen.container.querySelector('[role="status"]')
    expect(region).not.toBeNull()
  })

  it('marks the live region aria-live="polite"', async () => {
    const screen = await render(<Notices notices={[]} announcement="" t={{}} />)
    const region = screen.container.querySelector('[role="status"]')
    expect(region.getAttribute('aria-live')).toBe('polite')
  })

  it('does not put --bad on an info notice, and does put it on a bad one', async () => {
    const notices = [
      { id: 'a', tone: 'info', text: 'a fact' },
      { id: 'b', tone: 'bad', text: 'a failure' },
    ]
    const screen = await render(<Notices notices={notices} announcement="" t={{}} />)
    const lines = screen.container.querySelectorAll('.anl-notice-line')
    expect(lines.length).toBe(2)
    expect(lines[0].classList.contains('anl-notice-line--bad')).toBe(false)
    expect(lines[0].classList.contains('anl-notice-line--info')).toBe(true)
    expect(lines[1].classList.contains('anl-notice-line--bad')).toBe(true)
  })

  it('renders three notices, in the order given', async () => {
    const notices = [
      { id: '1', tone: 'info', text: 'first' },
      { id: '2', tone: 'info', text: 'second' },
      { id: '3', tone: 'bad', text: 'third' },
    ]
    const screen = await render(<Notices notices={notices} announcement="" t={{}} />)
    const lines = screen.container.querySelectorAll('.anl-notice-line')
    expect(lines.length).toBe(3)
    expect(lines[0].textContent).toBe('first')
    expect(lines[1].textContent).toBe('second')
    expect(lines[2].textContent).toBe('third')
  })

  it('updates the live region text without remounting it', async () => {
    const screen = await render(<Notices notices={[]} announcement="first" t={{}} />)
    const before = screen.container.querySelector('[role="status"]')
    expect(before.textContent).toBe('first')

    await screen.rerender(<Notices notices={[]} announcement="second" t={{}} />)
    const after = screen.container.querySelector('[role="status"]')
    expect(after).toBe(before)
    expect(after.textContent).toBe('second')
  })
})
