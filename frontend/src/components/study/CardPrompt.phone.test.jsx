import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import CardPrompt from './CardPrompt'
// Same stylesheet-import trick as PromptCard.browser.test.jsx: the
// rules this pins only exist once the real sheet is loaded.
import '../../index.css'

// ── The specimen fits its card ─────────────────────────────
//
// The word rung is 72px and .char-display sets one nowrap line at it,
// so the box's min-content width IS the whole word — and in a centred
// flex column that box simply grows past its parent. とうもろこし
// (six kana, ~440px at the rung) printed clean off BOTH edges of a
// 390px phone's card: the front of the card was a word with its head
// and tail cut off by the viewport, which for a vocab prompt is the
// one thing that must never happen — the prompt IS the question.
//
// The phone lane, not the browser lane: the card is --card-w (640px)
// on a desktop and the word fits there, so the bug only exists where
// the card is the screen.
vi.mock('../../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playClick: () => {},
}))

const FOOT = { left: '単語', right: 'Mot → sens' }

// The longest words the vocab deck actually carries, and one longer
// than anything in it, so the fit is pinned past the catalogue's own
// worst case rather than exactly at it.
const LONG = ['とうもろこし', 'エスカレーター', 'コンビニエンスストア']

function vocabCard(word) {
  return {
    card_id: `vocab-${word}`,
    source: 'builtin_vocab',
    mode: 'vocab.flashcard.f2b',
    direction: 'f2b',
    kanji: '',
    kana: word,
    meaning: 'corn',
  }
}

function Stage({ card }) {
  return (
    <main className="container stage">
      <div className="quiz-card-stage vocab-card-boost">
        <CardPrompt card={card} t={{ tapToReveal: 'Cliquez pour révéler' }} session={{}} foot={FOOT} />
      </div>
    </main>
  )
}

// Read after the entrance animation settles — a rect measured
// mid-animation is the real one times 0.98 (see PromptCard.browser.test).
async function settled(container) {
  await Promise.all(
    container.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))
  )
  await new Promise(resolve => requestAnimationFrame(() => resolve()))
}

describe('the study specimen at phone width', () => {
  it.each(LONG)('keeps %s inside the card', async word => {
    const screen = await render(<Stage card={vocabCard(word)} />)
    await settled(screen.container)

    const card = screen.container.querySelector('.prompt-card').getBoundingClientRect()
    const specimen = screen.container.querySelector('.char-display')
    const box = specimen.getBoundingClientRect()

    // The BOX is inside the card...
    expect(box.left).toBeGreaterThanOrEqual(card.left)
    expect(box.right).toBeLessThanOrEqual(card.right)
    // ...and so is the text drawn in it: a nowrap line that overflows
    // its own box keeps the box honest and paints outside it anyway,
    // so the ink is what has to be measured.
    expect(specimen.scrollWidth).toBeLessThanOrEqual(Math.ceil(box.width))
  })

  // The floor (--fs-caption) is what stops a pathological string from
  // shrinking to nothing, and it is the one input the fit cannot keep
  // inside the column on its own -- so the cut has to happen at the
  // card's edge rather than 200px past it. Nothing in any deck is this
  // long; this pins the last resort, not a real card.
  it('cuts a string past the floor at the card, not past the screen', async () => {
    const screen = await render(<Stage card={vocabCard('あ'.repeat(40))} />)
    await settled(screen.container)

    const card = screen.container.querySelector('.prompt-card').getBoundingClientRect()
    const box = screen.container.querySelector('.char-display').getBoundingClientRect()
    expect(box.left).toBeGreaterThanOrEqual(card.left)
    expect(box.right).toBeLessThanOrEqual(card.right)
  })

  it('leaves a word that already fits at the word rung', async () => {
    const screen = await render(<Stage card={vocabCard('ねこ')} />)
    await settled(screen.container)
    const specimen = screen.container.querySelector('.char-display')
    expect(getComputedStyle(specimen).fontSize).toBe('72px')
  })
})
