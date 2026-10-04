import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'
import { InlineReveal } from './QuizComponents'
import { ReadingShares } from './Readings'

// ── 割合 on the study card (plan 177) ─────────────────────────────
// The card prints the four readings the course uses most, each with the
// share of the course's words that use it and nothing else under it (no
// bar), the two registers kept, and counts the rest as "+N". A kanji the
// course never uses keeps the numbered list it had.

const KANA = 'セイ・ショウ・い.きる・い.かす・う.まれる・き・なま'
const SHARES = {
  total: 55, whole: 3,
  readings: { 'セイ': 27, 'ショウ': 8, 'い.きる': 4, 'い.かす': 1, 'う.まれる': 1, 'き': 2, 'なま': 4 },
}
const T = { onyomi: '音読み', kunyomi: '訓読み', readingsMore: n => `${n} de plus` }
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const $$ = s => [...document.querySelectorAll(s)]
const text = el => el.textContent

describe('the study card\'s top readings', () => {
  async function show(shares) {
    await render(
      <LangProvider>
        <div style={{ width: 300 }}>
          <InlineReveal t={T} kana={KANA} shares={shares} isLarge main={<span>Vie</span>} />
        </div>
      </LangProvider>,
    )
    await settle()
  }

  it('prints the four most used, each with its share, in their registers', async () => {
    await show(SHARES)
    const groups = $$('.reading-shares .reading-group')
    expect(groups.map(g => text(g.querySelector('.reading-group__label')))).toEqual(['音読み', '訓読み'])
    expect(groups.map(g => $$('.reading-share__text').filter(el => g.contains(el)).map(text)))
      .toEqual([['セイ', 'ショウ'], ['い.きる', 'なま']])
    expect($$('.reading-share__pct').map(text)).toEqual(['49,1%', '14,5%', '7,3%', '7,3%'])
    expect(text(document.querySelector('.reading-group__more'))).toBe('+3')
    expect(document.querySelector('.reading-group__more').title).toBe('3 de plus')
  })

  it('draws the share alone: no bar, and no numbering', async () => {
    await show(SHARES)
    expect(document.querySelector('.reading-share__bar')).toBeNull()
    expect(document.querySelector('.reading-group__item-index')).toBeNull()
    expect($$('.reading-share').every(el => el.children.length === 2)).toBe(true)
  })

  it('sets two equal shares on the same footing', async () => {
    await show(SHARES)
    const [a, b] = $$('.reading-share').slice(2).map(el => el.querySelector('.reading-share__pct'))
    expect(text(a)).toBe(text(b))
    expect(getComputedStyle(a).color).toBe(getComputedStyle(b).color)
  })

  it('keeps the numbered list for a kanji the course never uses, or a card with no counts', async () => {
    for (const shares of [{ total: 0, whole: 0, readings: {} }, undefined]) {
      document.body.innerHTML = ''
      await show(shares)
      expect(document.querySelector('.reading-shares')).toBeNull()
      expect($$('.reading-group__item-index').length).toBeGreaterThan(0)
    }
  })
})

describe('ReadingShares on its own', () => {
  it('renders nothing where no reading has a word', async () => {
    const { container } = await render(
      <LangProvider><ReadingShares kana={KANA} shares={{ total: 4, whole: 4, readings: {} }} onLabel="On" kunLabel="Kun" /></LangProvider>,
    )
    expect(container.querySelector('.reading-shares')).toBeNull()
  })
})
