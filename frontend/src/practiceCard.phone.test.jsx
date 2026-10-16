import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider, useLang } from './LangContext'
import PromptCard from './components/study/PromptCard'
import { SentenceCheck, MissedWords, PointTag } from './components/study/PracticeCard'
import './index.css'

// ── 見本 — the practice card on a phone (plan 185) ─────────────────────
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

// ── The words missed, as doors (plan 213) ──────────────────────────────
// わたしは魚が好きです, every word missed: the tiles stood two to a phone's
// row with the word on the left and its reading and meaning squeezed in a
// column beside it, so a long meaning ("apprécié, aimer (quelque chose)")
// fell into a tower of single words and a meaning without a reading sat
// at the word's shoulder. Each tile now stacks -- the word and its
// reading, the meaning under them -- and each is a door: a word to its
// entry, a particle to the point it is.
const MANY_WORDS = [
  { text: 'わたし', kana: 'わたし', start: 0, end: 3 },
  { text: 'は', kana: 'は', start: 3, end: 4 },
  { text: '魚', kana: 'さかな', start: 4, end: 5 },
  { text: 'が', kana: 'が', start: 5, end: 6 },
  { text: '好きです', kana: 'すきです', start: 6, end: 10 },
  { text: 'おきます', kana: 'おきます', start: 10, end: 14 },
]
const MANY_TOKENS = [
  { surface: 'わたし', start: 0, end: 3, pos: 'pronoun',
    vocab_match: { entry: { kanji: '私', kana: 'わたし', meaning: 'I, myself', meaning_fr: 'je, moi' } } },
  { surface: 'は', start: 3, end: 4, pos: 'particle', grammar: [
    { pattern: '〜は〜が', kind: 'pattern', raw_id: 'grammar_N5_〜は〜が', meaning: { en: 'as for … ', fr: 'quant à …' } },
    { pattern: 'は', kind: 'marker', raw_id: 'grammar_N5_は', meaning: { en: 'topic marker', fr: 'marque du thème' } },
  ] },
  { surface: '魚', start: 4, end: 5, pos: 'noun',
    vocab_match: { entry: { kanji: '魚', kana: 'さかな', meaning: 'fish', meaning_fr: 'poisson' } } },
  { surface: 'が', start: 5, end: 6, pos: 'particle' },
  { surface: '好き', start: 6, end: 8, pos: 'other', vocab_match: { entry: {
    kanji: '好き', kana: 'すき', meaning: 'liked', meaning_fr: 'apprécié, aimer (quelque chose)' } } },
  { surface: 'です', start: 8, end: 10, pos: 'auxiliary', grammar: [
    { pattern: 'です／だ', kind: 'marker', raw_id: 'grammar_N5_です／だ', meaning: { en: 'is', fr: 'être' } },
  ] },
  // A verb the lookups would not name (plan 213: おき is 起きる or 置く),
  // and its ending's point: the tile names nothing rather than the ending.
  { surface: 'おき', start: 10, end: 12, pos: 'verb', vocab_match: null },
  { surface: 'ます', start: 12, end: 14, pos: 'auxiliary', grammar: [
    { pattern: '〜ます／〜ません', kind: 'pattern', raw_id: 'grammar_N5_〜ます／〜ません', meaning: { en: 'polite', fr: 'poli' } },
  ] },
]

function Misses({ onOpen, onPoint, width }) {
  const { t } = useLang()
  return (
    <div className="screen">
      <main className="container stage" style={{ '--line-color': 'var(--line-reading)', width }}>
        <PromptCard page prose>
          <PointTag point="〜が好きです" label={t.pcardPoint} onOpen={onPoint} />
          <MissedWords words={MANY_WORDS} tokens={MANY_TOKENS} label={t.pcardMissed} onOpen={onOpen} />
        </PromptCard>
      </main>
    </div>
  )
}

const tiles = root => [...root.querySelectorAll('.pcard-misses .pcard-missed')]

describe('the words missed on a phone (plan 213)', () => {
  for (const width of [undefined, '320px']) {
    it(`stacks each tile, its meaning under the word across its width${width ? ` (${width})` : ''}`, async () => {
      const root = (await render(<LangProvider><Misses onOpen={() => {}} width={width} /></LangProvider>)).container
      for (const tile of tiles(root)) {
        const box = tile.getBoundingClientRect()
        // Nothing spills out of a tile, and no tile out of the page.
        expect(tile.scrollWidth).toBeLessThanOrEqual(tile.clientWidth)
        const en = tile.querySelector('.pcard-missed__en')
        if (!en) continue
        const word = tile.querySelector('.pcard-missed__word').getBoundingClientRect()
        const gloss = en.getBoundingClientRect()
        expect(gloss.top).toBeGreaterThanOrEqual(word.bottom - 1)
        expect(gloss.left).toBeCloseTo(word.left, 0)
        expect(gloss.right).toBeLessThanOrEqual(box.right)
      }
      // The long meaning holds two lines at most, not a column of words.
      const like = tiles(root)[4].querySelector('.pcard-missed__en')
      const lines = like.getBoundingClientRect().height / parseFloat(getComputedStyle(like).lineHeight)
      expect(lines).toBeLessThanOrEqual(2.05)
      // A row's tiles stand as tall as one another.
      const [a, b] = tiles(root).map(tile => tile.getBoundingClientRect())
      if (Math.abs(a.top - b.top) < 1) expect(a.height).toBeCloseTo(b.height, 0)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
    })
  }

  it('opens a word on its entry and a particle on its point, each a 44px door', async () => {
    const onOpen = vi.fn()
    const root = (await render(<LangProvider><Misses onOpen={onOpen} /></LangProvider>)).container
    const [watashi, wa, sakana, ga, suki, oki] = tiles(root)
    for (const door of [watashi, wa, sakana, suki]) {
      expect(door.tagName).toBe('BUTTON')
      expect(door.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    watashi.click()
    expect(onOpen).toHaveBeenLastCalledWith({ category: 'vocab', term: '私', kana: 'わたし' })
    expect(watashi.querySelector('.pcard-missed__en').textContent).toBe('je, moi')
    // は means nothing alone: its tile is the topic marker's, gloss and door.
    expect(wa.querySelector('.pcard-missed__en').textContent).toBe('marque du thème')
    wa.click()
    expect(onOpen).toHaveBeenLastCalledWith({ category: 'grammar', id: 'grammar_N5_は' })
    suki.click()
    expect(onOpen).toHaveBeenLastCalledWith({ category: 'vocab', term: '好き', kana: 'すき' })
    // A particle the breakdown names no point for has nothing to open.
    expect(ga.tagName).toBe('SPAN')
    // A word with no card is no door, and never borrows its ending's
    // point for a meaning.
    expect(oki.tagName).toBe('SPAN')
    expect(oki.querySelector('.pcard-missed__en')).toBeNull()
    expect(sakana.getAttribute('aria-label')).toContain('魚')
  })

  it('opens the point from its tag', async () => {
    const onPoint = vi.fn()
    const root = (await render(<LangProvider><Misses onOpen={() => {}} onPoint={onPoint} /></LangProvider>)).container
    const tag = root.querySelector('.pcard-tag')
    expect(tag.tagName).toBe('BUTTON')
    expect(tag.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    tag.click()
    expect(onPoint).toHaveBeenCalledTimes(1)
  })

  it('draws the tag and the tiles as no door without one to open', async () => {
    const root = (await render(<LangProvider><Misses /></LangProvider>)).container
    expect(root.querySelector('.pcard-tag').tagName).toBe('SPAN')
    expect(root.querySelector('button')).toBeNull()
  })
})
