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
//
// Then A1 with A2.2 and A2.3: the right word written small over the
// struck one, no romaji line over a romaji well, each miss underlined in
// the Japanese, the match a bar along the well's foot, and each word
// missed named under the well.

const PARTS = [
  { text: 'ここで' }, { text: '少', reading: 'すこ' }, { text: 'し' },
  { text: '休', reading: 'やす' }, { text: 'みましょう。' },
]

// study/romaji.sentence_words' words for the sentence, and the
// breakdown's tokens (the local tier's shape: offsets and the card's
// gloss).
const WORDS = [
  { text: 'ここ', kana: 'ここ', romaji: 'koko' },
  { text: 'で', kana: 'で', romaji: 'de' },
  { text: '少し', kana: 'すこし', romaji: 'sukoshi' },
  { text: '休みましょう。', kana: 'やすみましょう。', romaji: 'yasumimashou.' },
]
const TOKENS = [
  { surface: 'ここ', start: 0, end: 2, pos: 'noun', vocab_match: { entry: { meaning: 'here' } } },
  { surface: 'で', start: 2, end: 3, pos: 'particle' },
  { surface: '少し', start: 3, end: 5, pos: 'adverb', vocab_match: { entry: { meaning: 'a little', meaning_fr: 'un peu' } } },
  { surface: '休み', start: 5, end: 7, pos: 'verb', vocab_match: { entry: { meaning: 'to rest' } } },
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
            words={WORDS}
            tokens={TOKENS}
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
    const misses = $(root, '.pcard-misses').getBoundingClientRect()
    // One group: the well under the sentence and the words missed under
    // the well, as much air above the sentence (under the tag) as below
    // the words missed.
    expect(well.top).toBeGreaterThan(lead.bottom)
    expect(misses.top).toBeGreaterThan(well.bottom)
    const above = lead.top - tag.bottom
    const below = body.bottom - misses.bottom
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
    expect($(root, '.pcard-lead__en').getAttribute('lang')).toBe('en')
  })

  it('breaks the sentence between phrases, never inside one', async () => {
    const root = (await draw()).container
    const jp = $(root, '.pcard-lead__jp')
    const units = [...jp.querySelectorAll('.pcard-unit')]
    const bare = el => { const c = el.cloneNode(true); c.querySelectorAll('rt').forEach(n => n.remove()); return c.textContent }
    // A phrase opens at each kanji after kana; the kana after it rides.
    expect(units.map(bare)).toEqual(['ここで', '少し', '休みましょう。'])
    const line = parseFloat(getComputedStyle(jp).lineHeight)
    // One line each: a second would be twice the leading.
    for (const unit of units) expect(unit.getBoundingClientRect().height).toBeLessThan(line * 1.5)
  })

  it('prints no romaji over a romaji well: the well is the romaji, corrected (A1.2)', async () => {
    const root = (await draw()).container
    expect($(root, '.pcard-lead__ro')).toBeNull()
  })

  it('writes the right word small over the struck one, so the line keeps its length (A1.1)', async () => {
    const root = (await draw()).container
    const well = $(root, '.pcard-well')
    const over = well.querySelector('ruby.pcard-over')
    expect(over.querySelector('s').textContent).toBe('tchisai')
    expect(over.querySelector('rt ins').textContent).toBe('sukoshi')
    // Over the struck word, not beside it: the correction's box sits
    // above the struck one's and inside its column.
    const struck = over.querySelector('s').getBoundingClientRect()
    const right = over.querySelector('rt').getBoundingClientRect()
    expect(right.top).toBeLessThan(struck.top)
    expect(right.top + right.height / 2).toBeLessThan(struck.top + struck.height / 2)
    expect(right.left).toBeGreaterThanOrEqual(struck.left - 1)
    expect(right.right).toBeLessThanOrEqual(struck.right + 1)
    // The fix takes no room of its own on the line: the pair is as wide
    // as the wider of the two, not the two side by side.
    const pair = over.getBoundingClientRect()
    expect(pair.width).toBeLessThanOrEqual(Math.max(struck.width, right.width) + 1)
    // Ink, never a fill.
    expect(getComputedStyle(well.querySelector('.pcard-miss ins')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('underlines the miss where it stands in the Japanese (A1.3)', async () => {
    const root = (await draw()).container
    const hits = [...root.querySelectorAll('.pcard-lead__jp .pcard-hit')]
    expect(hits.map(h => h.textContent)).toEqual(['少すこし'])
    expect(hits[0].classList.contains('pcard-hit--x')).toBe(true)
    expect(getComputedStyle(hits[0]).textDecorationLine).toBe('underline')
  })

  it('draws the match as its figure a rung down and a bar along the well\'s foot (A2.3)', async () => {
    const root = (await draw()).container
    const well = $(root, '.pcard-well')
    expect(well.querySelector('.pcard-well__fig b').textContent).toBe('79%')
    // No printed caption; a screen reader is told what the figure counts.
    expect(well.querySelector('.pcard-well__cap')).toBeNull()
    expect(well.querySelector('.pcard-well__fig .sr-only').textContent).toBe('79% retrouvé')
    const fig = well.querySelector('.pcard-well__fig').getBoundingClientRect()
    expect(fig.right).toBeLessThanOrEqual(well.getBoundingClientRect().right)
    const meter = well.querySelector('.pcard-well__meter')
    const box = well.getBoundingClientRect()
    const bar = meter.getBoundingClientRect()
    expect(bar.bottom).toBeCloseTo(box.bottom, 0)
    expect(bar.width).toBeCloseTo(box.width, 0)
    expect(meter.querySelector('i').getBoundingClientRect().width).toBeCloseTo(box.width * 0.79, 0)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
  })

  it('names each word missed under the well, its reading and its meaning (A2.2)', async () => {
    const root = (await draw()).container
    const missed = [...root.querySelectorAll('.pcard-misses .pcard-missed')]
    expect(missed).toHaveLength(1)
    expect(missed[0].querySelector('.pcard-missed__jp').textContent).toBe('少し')
    expect(missed[0].querySelector('.pcard-missed__kana').textContent).toBe('すこし')
    // In the learner's language: the card's French beside its English.
    expect(missed[0].querySelector('.pcard-missed__en').textContent).toBe('un peu')
    const well = $(root, '.pcard-well').getBoundingClientRect()
    expect(missed[0].getBoundingClientRect().top).toBeGreaterThan(well.bottom)
  })
})
