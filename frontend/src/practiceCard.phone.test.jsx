import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider, useLang } from './LangContext'
import PromptCard from './components/study/PromptCard'
import { SentenceCheck } from './components/study/PracticeCard'
import './index.css'

// ── 見本 — the practice card on a phone (plan 184) ─────────────────────
// The owner's pick A of the canvas "Tsuji — the practice cards": the
// card a reading, dictation or the reading ride's answer is read against
// is a page with no foot strip, the point's tag at its top, and the
// sentence leading with the answer's well under it, the two standing
// together in the middle of what the tag leaves. On the stage the card
// grows to the docked instrument, as every footed card does.

const PARTS = [
  { text: 'ここで' }, { text: '少', reading: 'すこ' }, { text: 'し' },
  { text: '休', reading: 'やす' }, { text: 'みましょう。' },
]

function Card() {
  const { t } = useLang()
  return (
    <div className="screen">
      <main className="container stage" style={{ '--line-color': 'var(--line-reading)' }}>
        <PromptCard page prose>
          <SentenceCheck
            point="〜ましょう"
            parts={PARTS}
            text="ここで少し休みましょう。"
            romaji="koko de sukoshi yasumimashou."
            meaning="Let's rest here a little."
            meaningLang="en"
            answer="koko de tchisai yasumimashou"
            accuracy={79}
            t={t}
          />
        </PromptCard>
        <div className="rating-bar"><div className="rating-bar__buttons rating-bar__buttons--4" /></div>
      </main>
    </div>
  )
}

const draw = () => render(<LangProvider><Card /></LangProvider>)
const $ = (root, s) => root.querySelector(s)

describe('the practice card at 390×844', () => {
  it('has no foot strip, and grows to the docked instrument', async () => {
    const root = (await draw()).container
    const card = $(root, '.prompt-card--page')
    expect(card.classList.contains('prompt-card--footed')).toBe(true)
    expect($(root, '.prompt-card__foot')).toBeNull()
    const bar = $(root, '.rating-bar')
    expect(bar.getBoundingClientRect().top - card.getBoundingClientRect().bottom).toBeCloseTo(16, 0)
  })

  it('stands the tag at the top and the sentence with its well in the middle of what it leaves', async () => {
    const root = (await draw()).container
    const body = $(root, '.prompt-card__body--page').getBoundingClientRect()
    const tag = $(root, '.pcard-tag').getBoundingClientRect()
    expect(tag.top - body.top).toBeCloseTo(16, 0)
    expect(tag.left - body.left).toBeCloseTo(16, 0)
    const lead = $(root, '.pcard-lead').getBoundingClientRect()
    const well = $(root, '.pcard-well').getBoundingClientRect()
    // The two as one group: the well under the sentence, and as much
    // air above the sentence (under the tag) as below the well.
    expect(well.top).toBeGreaterThan(lead.bottom)
    const above = lead.top - tag.bottom
    const below = body.bottom - well.bottom
    expect(Math.abs(above - below)).toBeLessThan(24)
  })

  it('leads with the sentence a rung under the desk\'s, its reading over the kanji', async () => {
    const root = (await draw()).container
    const jp = $(root, '.pcard-lead__jp')
    // The title rung on a phone: fourteen characters to a line.
    const title = getComputedStyle(document.documentElement).getPropertyValue('--fs-title').trim()
    expect(title).toBe('1.25rem')
    expect(getComputedStyle(jp).fontSize).toBe('20px')
    expect([...jp.querySelectorAll('rt')].map(rt => rt.textContent)).toEqual(['すこ', 'やす'])
    expect($(root, '.pcard-lead__ro').textContent).toBe('koko de sukoshi yasumimashou.')
    expect($(root, '.pcard-lead__en').getAttribute('lang')).toBe('en')
  })

  it('marks the miss in the well, the figure at its end, inside the window', async () => {
    const root = (await draw()).container
    const well = $(root, '.pcard-well')
    expect(well.querySelector('.pcard-miss s').textContent).toBe('tchisai')
    expect(well.querySelector('.pcard-miss ins').textContent).toBe('sukoshi')
    // Ink, never a fill.
    expect(getComputedStyle(well.querySelector('.pcard-miss ins')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(well.querySelector('.pcard-well__fig b').textContent).toBe('79%')
    const fig = well.querySelector('.pcard-well__fig').getBoundingClientRect()
    expect(fig.right).toBeLessThanOrEqual(well.getBoundingClientRect().right)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
  })
})
