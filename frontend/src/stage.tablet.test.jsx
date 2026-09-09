import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// Stylesheet contracts at 768px — a tablet held upright, and the last
// width `@media (width <= 768px)` answers for. The band between
// --card-w (640) and this ceiling is the one the phone lane cannot
// see: below it the card fills the stage, so a control that spans the
// stage and one that tracks the card are the same object. Here they
// are not, and the difference is what these tests hold.
import './index.css'

const rect = el => el.getBoundingClientRect()

describe('the stage in the tablet band', () => {
  it('the card centres on its own column rather than filling the stage', async () => {
    const screen = await render(
      <main className="container stage">
        <div className="prompt-card"><div className="prompt-card__body">駅</div></div>
      </main>
    )
    const stage = rect(screen.container.querySelector('.stage'))
    const card = rect(screen.container.querySelector('.prompt-card'))
    expect(card.width).toBe(640)                      // --card-w
    expect(card.left - stage.left).toBeGreaterThan(16) // past the page's gutter
    // Centred: the same air on both sides.
    expect(Math.round(card.left - stage.left)).toBe(Math.round(stage.right - card.right))
  })

  it('the docked foot keeps its ground edge to edge and its control on the card', async () => {
    const screen = await render(
      <main className="container stage">
        <div className="quiz-card-stage">
          <div className="prompt-card"><div className="prompt-card__body">駅</div></div>
        </div>
        <div className="stage__foot browse-nav">
          <button type="button" className="btn-secondary">Previous</button>
          <button type="button" className="btn-primary">Next</button>
        </div>
      </main>
    )
    const stage = rect(screen.container.querySelector('.stage'))
    const card = rect(screen.container.querySelector('.prompt-card'))
    const foot = rect(screen.container.querySelector('.stage__foot'))
    // The ground still runs the whole width: the foot bleeds out past
    // the stage's gutter on both sides, as it does on a phone.
    expect(foot.left).toBeLessThan(stage.left + 1)
    expect(foot.right).toBeGreaterThan(stage.right - 1)
    // The buttons on it belong to the card's column, not the screen's.
    // They used to span the ground: 43px outside the card on each side.
    const prev = rect(screen.container.querySelector('.browse-nav .btn-secondary'))
    const next = rect(screen.container.querySelector('.browse-nav .btn-primary'))
    expect(prev.left).toBe(card.left)
    expect(next.right).toBe(card.right)
  })

  it('the field foot is on the same column as the browse pair', async () => {
    const screen = await render(
      <main className="container stage">
        <div className="prompt-card"><div className="prompt-card__body">駅</div></div>
        <form className="stage__foot">
          <input className="field" aria-label="answer" />
          <button type="submit" className="btn-primary">Submit</button>
        </form>
      </main>
    )
    const card = rect(screen.container.querySelector('.prompt-card'))
    const field = rect(screen.container.querySelector('.field'))
    const submit = rect(screen.container.querySelector('.btn-primary'))
    expect(field.left).toBe(card.left)
    expect(field.right).toBe(card.right)
    expect(submit.left).toBe(card.left)
    expect(submit.right).toBe(card.right)
  })
})
