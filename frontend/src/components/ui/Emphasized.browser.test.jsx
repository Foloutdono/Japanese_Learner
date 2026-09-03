import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { Emphasized } from './Emphasized'

// ── **…** — the marker must never reach the screen ──────────────
// The copy path now carries one piece of markup, and both ways it can
// fail are silent: a run that is not turned into <strong> prints its
// asterisks to the learner, and a table that stops being marked up
// prints flat without anything erroring. Neither shows up in a render
// error, so both are pinned here.

describe('Emphasized', () => {
  it('turns each **run** into a <strong> and eats the markers', async () => {
    const screen = await render(
      <p><Emphasized text="**10 a day, every day** — about 16 minutes — arriving **N3**." /></p>
    )
    const p = screen.container.querySelector('p')
    const strongs = [...p.querySelectorAll('strong')].map(s => s.textContent)
    expect(strongs).toEqual(['10 a day, every day', 'N3'])
    // The learner never sees the delimiter.
    expect(p.textContent).toBe('10 a day, every day — about 16 minutes — arriving N3.')
    expect(p.textContent).not.toContain('*')
  })

  it('leaves unmarked copy alone, and survives a non-string', async () => {
    const screen = await render(
      <p><Emphasized text="No destination on this pass." /></p>
    )
    const p = screen.container.querySelector('p')
    expect(p.querySelector('strong')).toBeNull()
    expect(p.textContent).toBe('No destination on this pass.')

    // JourneyPass builds its foot before it knows whether there is one.
    const empty = await render(<p id="e"><Emphasized text={null} /></p>)
    expect(empty.container.querySelector('#e').textContent).toBe('')
  })
})
