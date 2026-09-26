import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── The card's bar (plan 147, the owner's pick M2 + P2) ───────────────
// A band along the card's foot, inside its border, filled from new to
// mastered: vermilion while the card is learning, gold once mastered.
// It moves to where a rating leaves the card while the rating's press
// plays, and a run that rates nothing (the browse) draws none.

vi.mock('./lib/audio', async o => ({ ...(await o()), playSfx: vi.fn() }))

const { CardTransition } = await import('./components/study/CardTransition')
const { default: PromptCard } = await import('./components/study/PromptCard')

const settle = (ms = 500) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)

function Card({ stage, progress, stamp }) {
  return (
    <LangProvider>
      <CardTransition cardKey="k" stage={stage} progress={progress} stamp={stamp} onStampDone={() => {}}>
        <PromptCard foot={{ left: 'N5 単語', right: 'Sens' }}><span>駅</span></PromptCard>
      </CardTransition>
    </LangProvider>
  )
}

// A token as Chromium computes it, so a colour is compared with the
// palette and never a hand-copied constant.
function ink(token) {
  const el = document.createElement('div')
  el.style.backgroundColor = `var(${token})`
  document.body.appendChild(el)
  const v = getComputedStyle(el).backgroundColor
  el.remove()
  return v
}
const ratio = () => $('.card-band__fill').getBoundingClientRect().width / $('.card-band').getBoundingClientRect().width

describe('the band along the card\'s foot', () => {
  it('sits on the card\'s bottom edge, inside its border, filled to the card\'s progress', async () => {
    await render(<Card stage="learning" progress={0.375} />)
    await settle()
    const card = $('.prompt-card').getBoundingClientRect()
    const band = $('.card-band').getBoundingClientRect()
    expect(Math.abs(band.bottom - (card.bottom - 1))).toBeLessThan(1)
    expect(Math.abs(band.left - (card.left + 1))).toBeLessThan(1)
    expect(Math.abs(band.right - (card.right - 1))).toBeLessThan(1)
    expect(band.height).toBe(4)
    expect(ratio()).toBeCloseTo(0.375, 2)
    expect($('.card-band').getAttribute('aria-valuenow')).toBe('38')
    expect(getComputedStyle($('.card-band__fill')).backgroundColor).toBe(ink('--state-learning'))
  })

  it('is full and gold on a mastered card, and empty on a new one', async () => {
    const { rerender } = await render(<Card stage="mastered" progress={1} />)
    await settle()
    expect(getComputedStyle($('.card-band__fill')).backgroundColor).toBe(ink('--state-mastered'))
    expect(ratio()).toBeCloseTo(1, 2)
    await rerender(<Card stage="new" progress={0} />)
    await settle()
    expect(ratio()).toBe(0)
  })

  it('moves to where the rating leaves the card while its press plays', async () => {
    const stamp = { id: 1, to: 'mastered', demoted: false, cardKey: 'k', progress: 1 }
    await render(<Card stage="learning" progress={0.9} stamp={stamp} />)
    await settle()
    expect($('.card-band').classList.contains('card-band--mastered')).toBe(true)
    expect(ratio()).toBeCloseTo(1, 2)
  })

  it('draws nothing for a card still learning whose route sent no figure, or where the run passes none', async () => {
    const { rerender } = await render(<Card stage="learning" progress={null} />)
    await settle(100)
    expect($('.card-band')).toBeNull()
    await rerender(<Card stage="mastered" />)
    await settle(100)
    expect($('.card-band')).toBeNull()
  })
})
