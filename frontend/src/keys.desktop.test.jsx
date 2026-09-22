import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import RatingBar from './components/study/RatingBar'
import { MCQGrid, Flashcard } from './components/study/QuizComponents'
import './index.css'

// ── 鍵 — the keys, printed on the desk (plan 112) ───────────────
// A run answers to the keyboard at every width; on a phone nothing of
// it is drawn, and on the desk the keys are printed where they act:
// each rating tile carries its digit (reversed, as the handler reads
// them: 1 is the best, at the right), each choice's index is the digit
// that answers it, and the card says which key turns it. The phone's
// half — none of it drawn — is RatingBar.browser.test (414px) and the
// phone lane's "draws no desk".

vi.mock('./lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playCorrect: () => {},
  playWrong: () => {},
  playClick: () => {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

describe('the rating bar on the desk', () => {
  it('prints each tile\'s key, the best one at the right', async () => {
    await render(<LangProvider><RatingBar scale="full" active onRate={() => {}} /></LangProvider>)
    await settle()
    const tiles = [...document.querySelectorAll('.rating-bar__btn')]
    const keys = tiles.map(b => b.querySelector('.desk-kbd')?.textContent)
    expect(keys).toEqual(['6', '5', '4', '3', '2', '1'])
    // In the tile's corner, out of the flow: the word and the seal do
    // not move to make room for it.
    const tile = tiles[0].getBoundingClientRect()
    const cap = tiles[0].querySelector('.desk-kbd').getBoundingClientRect()
    expect(getComputedStyle(tiles[0].querySelector('.desk-kbd')).position).toBe('absolute')
    expect(cap.left - tile.left).toBeLessThan(tile.width / 3)
    expect(cap.top - tile.top).toBeLessThan(tile.height / 3)
    // Hidden from a screen reader: the button already names its key.
    expect(tiles[0].querySelector('.desk-kbd').getAttribute('aria-hidden')).toBe('true')
    expect(tiles[5].getAttribute('aria-keyshortcuts')).toBe('1')
  })

  it('rates with the key it prints', async () => {
    const onRate = vi.fn()
    await render(<LangProvider><RatingBar scale="full" active onRate={onRate} /></LangProvider>)
    await settle()
    const best = [...document.querySelectorAll('.rating-bar__btn')].at(-1)
    press(best.querySelector('.desk-kbd').textContent)
    expect(onRate).toHaveBeenCalledWith(5)
  })
})

describe('the choices on the desk', () => {
  it('number each row with the digit that answers it', async () => {
    const onAnswer = vi.fn()
    await render(
      <LangProvider>
        <MCQGrid choices={['a', 'b', 'c', 'd']} correct="c" selected={null} answered={false} onAnswer={onAnswer} />
      </LangProvider>
    )
    await settle()
    const rows = [...document.querySelectorAll('.mcq-row')]
    expect(rows.map(r => r.querySelector('.mcq-row__index').textContent)).toEqual(['1', '2', '3', '4'])
    expect(rows.map(r => r.getAttribute('aria-keyshortcuts'))).toEqual(['1', '2', '3', '4'])
    press('3')
    expect(onAnswer).toHaveBeenCalledWith('c')
  })
})

describe('the flashcard on the desk', () => {
  it('names the key that turns it', async () => {
    await render(
      <LangProvider>
        <Flashcard
          t={{ tapToReveal: 'Touche pour révéler', keySpace: 'Espace', revealByKey: 'pour révéler' }}
          resetKey="k1"
          front={<span>あ</span>}
          back={<span>a</span>}
        />
      </LangProvider>
    )
    await settle()
    const hint = document.querySelector('.flashcard__hint')
    expect(hint.querySelector('kbd.desk-kbd').textContent).toBe('Espace')
    expect(hint.textContent).toBe('Espace pour révéler')
  })
})
