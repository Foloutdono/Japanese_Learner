import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { PassageBreakdown } from './PassageBreakdown'

// ── 一文ずつ (plan 084) ────────────────────────────────────────
// The comprehension result's breakdown: every sentence over its
// translation, one open at a time on its rows. What is worth pinning
// is the one-at-a-time rule, the first sentence open to begin with,
// the chevron as a real control, a word's door not closing the
// sentence it is in, and a sentence with nothing to open being no
// control at all.

const T = {
  openSentence: 'Open this sentence',
  closeSentence: 'Close this sentence',
  detailsForToken: s => `Details for ${s}`,
  detailsForKanji: k => `Details for the kanji ${k}`,
}

function token(surface, pos, extra = {}) {
  return { surface, reading: surface, pos, furigana: [{ text: surface }], vocab_match: null, kanji_matches: [], ...extra }
}

function analysed(text, words) {
  return {
    text, available: true, level: 'N5', grammar: [], unknown_count: 0, off_deck_count: 0,
    tokens: words.map(([surface, pos, deck]) => token(surface, pos, deck ? {
      vocab_match: { level: 'N5', raw_id: `vocab_N5_${surface}`, entry: { meaning: deck }, stats: { status: 'not_started' } },
    } : {})),
  }
}

const SENTENCES = [
  { jp: '駅で会いました。', translation: 'I met at the station.', note: 'で marks the place.',
    analysis: analysed('駅で会いました。', [['駅', 'noun', 'station'], ['で', 'particle'], ['会いました', 'verb', 'to meet'], ['。', 'symbol']]) },
  { jp: '電車は新しいです。', translation: 'The train is new.', note: '',
    analysis: analysed('電車は新しいです。', [['電車', 'noun', 'train'], ['は', 'particle'], ['新しい', 'adjective', 'new'], ['です', 'auxiliary'], ['。', 'symbol']]) },
  // A backend that has not shipped the analysis: two lines, nothing to open.
  { jp: '駅は大きいです。', translation: 'The station is big.', note: '', analysis: null },
]

function Host({ sentences = SENTENCES, onTokenClick = () => {} }) {
  const [openIndex, setOpenIndex] = useState(0)
  return <PassageBreakdown sentences={sentences} t={T} openIndex={openIndex} setOpenIndex={setOpenIndex} onTokenClick={onTokenClick} />
}

const settle = (ms = 30) => new Promise(r => setTimeout(r, ms))
const items = () => document.querySelectorAll('.bkd-passage__item')
const opened = () => document.querySelectorAll('.bkd-passage__item--open')

describe('PassageBreakdown', () => {
  it('opens the first sentence on its rows, the others closed over their translations', async () => {
    await render(<Host />)
    expect(items()).toHaveLength(3)
    expect(opened()).toHaveLength(1)

    const first = items()[0]
    expect(first.classList.contains('bkd-passage__item--open')).toBe(true)
    // The ruby line replaces the plain sentence rather than repeating it.
    expect(first.querySelector('.bkd-line')).toBeTruthy()
    expect(first.querySelector('.bkd-passage__text .prose__jp')).toBeNull()
    expect(first.querySelectorAll('.bkd-row')).toHaveLength(3)
    expect(first.querySelector('.bkd__en').textContent).toBe('I met at the station.')
    expect(first.querySelector('.prose__ai').textContent).toBe('で marks the place.')
    expect(first.querySelector('.bkd-passage__chev').getAttribute('aria-expanded')).toBe('true')
    expect(first.querySelector('.bkd-passage__chev').getAttribute('aria-label')).toBe('Close this sentence')

    const second = items()[1]
    expect(second.querySelector('.prose__jp').textContent).toBe('電車は新しいです。')
    expect(second.querySelector('.bkd__en').textContent).toBe('The train is new.')
    expect(second.querySelector('.bkd-rows')).toBeNull()
    expect(second.querySelector('.bkd-passage__chev').getAttribute('aria-expanded')).toBe('false')
  })

  it('opens one sentence at a time: the second closes the first', async () => {
    await render(<Host />)
    items()[1].querySelector('.bkd-passage__head').click()
    await settle()
    expect(opened()).toHaveLength(1)
    expect(items()[1].classList.contains('bkd-passage__item--open')).toBe(true)
    expect(items()[0].querySelector('.bkd-rows')).toBeNull()
    expect(items()[0].querySelector('.prose__jp').textContent).toBe('駅で会いました。')
    // 新しい + です is one word to a learner (rows.js folds the polite
    // ending onto the adjective), so three rows, not four.
    expect([...items()[1].querySelectorAll('.bkd-row__word')].map(el => el.textContent))
      .toEqual(['電車', 'は', '新しいです'])
    // A sentence with nothing worth noting prints no note line.
    expect(items()[1].querySelector('.prose__ai')).toBeNull()
  })

  it('closes the open sentence on its own head, and the chevron is the same act', async () => {
    await render(<Host />)
    items()[0].querySelector('.bkd-passage__head').click()
    await settle()
    expect(opened()).toHaveLength(0)
    expect(items()[0].querySelector('.prose__jp').textContent).toBe('駅で会いました。')

    // The chevron is a real <button>: Enter and Space fire its click,
    // which bubbles to the head. Its aria-controls names the body.
    const chev = items()[0].querySelector('.bkd-passage__chev')
    expect(chev.tagName).toBe('BUTTON')
    expect(chev.getAttribute('aria-label')).toBe('Open this sentence')
    chev.click()
    await settle()
    expect(items()[0].classList.contains('bkd-passage__item--open')).toBe(true)
    const body = document.getElementById(chev.getAttribute('aria-controls'))
    expect(body).toBeTruthy()
    expect(body.querySelector('.bkd-rows')).toBeTruthy()
  })

  it("a word's door opens the word and does not close the sentence", async () => {
    const onTokenClick = vi.fn()
    await render(<Host onTokenClick={onTokenClick} />)
    const door = items()[0].querySelector('.bkd-line .bkd-tok--door')
    expect(door.tagName).toBe('BUTTON')
    door.click()
    await settle()
    expect(onTokenClick).toHaveBeenCalledTimes(1)
    expect(onTokenClick.mock.calls[0][0].surface).toBe('駅')
    expect(items()[0].classList.contains('bkd-passage__item--open')).toBe(true)

    items()[0].querySelector('.bkd-row .bkd-tok--door').click()
    await settle()
    expect(onTokenClick).toHaveBeenCalledTimes(2)
    expect(items()[0].classList.contains('bkd-passage__item--open')).toBe(true)
  })

  it('a sentence with nothing to open is its two lines and no control', async () => {
    await render(<Host />)
    const third = items()[2]
    expect(third.querySelector('.bkd-passage__chev')).toBeNull()
    expect(third.querySelector('.prose__jp').textContent).toBe('駅は大きいです。')
    expect(third.querySelector('.bkd__en').textContent).toBe('The station is big.')
    third.querySelector('.bkd-passage__head').click()
    await settle()
    expect(third.classList.contains('bkd-passage__item--open')).toBe(false)
    // And the first stayed as it was.
    expect(opened()).toHaveLength(1)
  })

  it('never nests a button inside a button', async () => {
    const screen = await render(<Host />)
    expect(screen.container.querySelectorAll('button button')).toHaveLength(0)
  })
})
