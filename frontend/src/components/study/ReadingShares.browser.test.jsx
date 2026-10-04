import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'
import { ReadingShares } from './Readings'

// ── 割合 on the study card (plan 175) ─────────────────────────────
// The card's few readings with the course's share of each. The two
// layouts must tell the same story by length: a bar is a share, so two
// readings with the same share have bars of the same length, whatever
// the width of the kana above them.

const KANA = 'セイ・ショウ・い.きる・い.かす・う.まれる・き・なま'
const SHARES = {
  total: 55, whole: 3,
  readings: { 'セイ': 27, 'ショウ': 8, 'い.きる': 4, 'い.かす': 1, 'う.まれる': 1, 'き': 2, 'なま': 4 },
}
const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $$ = s => [...document.querySelectorAll(s)]

async function show(layout) {
  await render(
    <LangProvider>
      <div style={{ width: 300 }}>
        <ReadingShares kana={KANA} shares={SHARES} layout={layout} onLabel="On" kunLabel="Kun" isLarge />
      </div>
    </LangProvider>,
  )
  await settle()
}

describe('the study card\'s top readings', () => {
  it('prints the four most used, with their share, and counts the rest', async () => {
    await show('grouped')
    expect($$('.reading-share__text').map(el => el.textContent)).toEqual(['セイ', 'ショウ', 'い.きる', 'なま'])
    expect($$('.reading-share__pct').map(el => el.textContent)).toEqual(['49,1%', '14,5%', '7,3%', '7,3%'])
    expect(document.querySelector('.reading-group__more').textContent).toBe('+3')
  })

  it('draws every bar on a track of one length, in both layouts', async () => {
    for (const layout of ['grouped', 'ranked']) {
      document.body.innerHTML = ''
      await show(layout)
      const widths = $$('.reading-share__bar').map(el => Math.round(el.getBoundingClientRect().width))
      expect(widths).toHaveLength(4)
      expect(new Set(widths).size, `${layout}: ${widths}`).toBe(1)
    }
  })

  it('fills each track to its share, so two equal shares are two equal bars', async () => {
    await show('grouped')
    const fills = $$('.reading-share__bar').map(bar => {
      const track = bar.getBoundingClientRect().width
      return bar.firstElementChild.getBoundingClientRect().width / track
    })
    expect(fills[0]).toBeCloseTo(0.491, 2)
    expect(fills[1]).toBeCloseTo(0.145, 2)
    expect(fills[2]).toBeCloseTo(fills[3], 3)
  })
})
