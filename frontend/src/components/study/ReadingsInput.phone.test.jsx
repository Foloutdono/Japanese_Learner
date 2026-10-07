import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { useState } from 'react'
import { LangProvider } from '../../LangContext'
import ReadingsInput from './ReadingsInput'
import '../../index.css'

// ── 読み入力 — the readings drill as a box of chips ─────────────
// One box per kind of reading; a reading becomes a chip on a separator,
// the + or leaving the box, and Enter checks with whatever is still
// typed. Checked, the box is the kanji's own list: found readings ticked
// in their kana, missed ones dashed, wrong guesses struck. On a phone,
// where the comma is on the keyboard's second page and an input method
// may hold the text in a composition.
vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: () => {} }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

// 主: two on'yomi in katakana, three kun'yomi in hiragana.
const READINGS = {
  on: [{ reading: 'シュ', display: 'シュ' }, { reading: 'ス', display: 'ス' }],
  kun: [{ reading: 'ぬし', display: 'ぬし' }, { reading: 'おも', display: 'おも' }, { reading: 'あるじ', display: 'あるじ' }],
}

function Drill({ onSubmit = () => {}, shares }) {
  const [submitted, setSubmitted] = useState(false)
  return (
    <LangProvider>
      <main className="container stage">
        <ReadingsInput readings={READINGS} shares={shares} submitted={submitted} onSubmit={() => { setSubmitted(true); onSubmit() }} />
      </main>
    </LangProvider>
  )
}

const settle = (ms = 40) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const chips = kind => $$(`#readings-${kind}`).length
  ? [...$(`#readings-${kind}`).parentElement.querySelectorAll('.readings-input__chip')].map(c => c.textContent.replace('×', ''))
  : []
const box = i => $$('.readings-input__box')[i]
const checked = i => [...box(i).querySelectorAll('.readings-input__chip')].map(c => ({
  text: c.firstChild.textContent,
  as: c.className.match(/--(ok|missed|wrong)/)?.[1],
}))

// What an input method does to the field: the value as it composes,
// every input event flagged, then compositionend.
function compose(field, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  set.call(field, value)
  field.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
}

describe('the readings box on a phone', () => {
  it('makes a chip of each reading at a comma, a 、 or a space, and keeps what follows typed', async () => {
    await render(<Drill />)
    await settle()
    await userEvent.click($('#readings-on'))
    await userEvent.keyboard('shu,su ')
    await userEvent.keyboard('ju')
    expect(chips('on')).toEqual(['shu', 'su'])
    expect($('#readings-on').value).toBe('ju')
    await userEvent.click($('#readings-kun'))
    await userEvent.keyboard('ぬし、おも')
    expect(chips('kun')).toEqual(['ぬし'])
    // Leaving the box adds what was typed in it.
    expect(chips('on')).toEqual(['shu', 'su', 'ju'])
  })

  it('leaves the text to the input method while it is composing', async () => {
    await render(<Drill />)
    await settle()
    const field = $('#readings-on')
    field.focus()
    // A 、 inside an open composition is the IME's, not a separator yet.
    compose(field, 'しゅ、')
    await settle()
    expect(chips('on')).toEqual([])
    expect(field.value).toBe('しゅ、')
    // Committed, it is.
    field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'しゅ、' }))
    await settle()
    expect(chips('on')).toEqual(['しゅ'])
    expect(field.value).toBe('')
  })

  it('adds with the + that appears once something is typed, and keeps the keyboard in the box', async () => {
    await render(<Drill />)
    await settle()
    await userEvent.click($('#readings-on'))
    expect($('.readings-input__add')).toBeNull()
    await userEvent.keyboard('shu')
    const add = $('.readings-input__add')
    expect(add).not.toBeNull()
    // A thumb's reach, whatever the glyph's box.
    const r = add.getBoundingClientRect()
    expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(32)
    await userEvent.click(add)
    await settle()
    expect(chips('on')).toEqual(['shu'])
    expect(document.activeElement).toBe($('#readings-on'))
    expect($('.readings-input__add')).toBeNull()
  })

  it('takes the last chip back on Backspace, and drops one when it is pressed', async () => {
    await render(<Drill />)
    await settle()
    await userEvent.click($('#readings-on'))
    await userEvent.keyboard('shu,ju,')
    await userEvent.keyboard('{Backspace}')
    expect(chips('on')).toEqual(['shu'])
    expect($('#readings-on').value).toBe('ju')
    await userEvent.keyboard('{Backspace}{Backspace}')
    expect($('#readings-on').value).toBe('')
    expect(chips('on')).toEqual(['shu'])
    await userEvent.click($('.readings-input__chip'))
    expect(chips('on')).toEqual([])
  })

  it('checks on Enter, taking the reading still being typed', async () => {
    const onSubmit = vi.fn()
    await render(<Drill onSubmit={onSubmit} />)
    await settle()
    await userEvent.click($('#readings-on'))
    await userEvent.keyboard('shu{Enter}')
    await settle()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(checked(0)).toEqual([{ text: 'シュ', as: 'ok' }, { text: 'ス', as: 'missed' }])
  })

  it('lays out the kanji\'s own list when checked: found in any script, missed, and wrong', async () => {
    await render(<Drill />)
    await settle()
    await userEvent.click($('#readings-on'))
    // Romaji for シュ, hiragana for ス, and a wrong guess.
    await userEvent.keyboard('shu,す,ju')
    await userEvent.click($('#readings-kun'))
    await userEvent.keyboard('ヌシ')
    await userEvent.click($('.readings-input__submit'))
    await settle()
    expect(checked(0)).toEqual([
      { text: 'シュ', as: 'ok' }, { text: 'ス', as: 'ok' }, { text: 'ju', as: 'wrong' },
    ])
    expect(checked(1)).toEqual([
      { text: 'ぬし', as: 'ok' }, { text: 'おも', as: 'missed' }, { text: 'あるじ', as: 'missed' },
    ])
    expect($('.readings-input input')).toBeNull()
    expect($('.readings-input__submit')).toBeNull()
  })

  it('prints each reading\'s share of the course\'s words once checked, and none before', async () => {
    // Ten words: シュ in six, ス in one, ぬし in three, おも and あるじ in none.
    const shares = { total: 10, whole: 0, readings: { 'シュ': 6, 'ス': 1, 'ぬし': 3 } }
    await render(<Drill shares={shares} />)
    await settle()
    expect($$('.readings-input__pct')).toHaveLength(0)
    await userEvent.click($('#readings-on'))
    await userEvent.keyboard('shu{Enter}')
    await settle()
    const pcts = box => [...box.querySelectorAll('.readings-input__chip')].map(c => c.querySelector('.readings-input__pct')?.textContent.replace(',', '.'))
    expect(pcts(box(0))).toEqual(['60.0%', '10.0%'])
    expect(pcts(box(1))).toEqual(['30.0%', '0.0%', '0.0%'])
    expect(box(0).querySelector('.readings-input__pct--core')).not.toBeNull()
  })

  it('prints no share for a card the course has no word for', async () => {
    await render(<Drill shares={{ total: 0, whole: 0, readings: {} }} />)
    await settle()
    await userEvent.click($('#readings-on'))
    await userEvent.keyboard('shu{Enter}')
    await settle()
    expect($$('.readings-input__pct')).toHaveLength(0)
  })

  it('fits the phone: the boxes and Valider share one axis, and the chips wrap', async () => {
    await render(<Drill />)
    await settle()
    await userEvent.click($('#readings-on'))
    await userEvent.keyboard('shu,su,ju,jou,shou,sou,')
    const group = $('.readings-input__group').getBoundingClientRect()
    const submit = $('.readings-input__submit').getBoundingClientRect()
    expect(submit.left).toBeCloseTo(group.left, 0)
    expect(submit.width).toBeCloseTo(group.width, 0)
    const rows = new Set($$('.readings-input__chip').map(c => Math.round(c.getBoundingClientRect().top)))
    expect(rows.size).toBeGreaterThan(1)
    for (const c of $$('.readings-input__chip')) expect(c.getBoundingClientRect().right).toBeLessThanOrEqual(box(0).getBoundingClientRect().right)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})
