import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from '../../LangContext'
import { ReadingOfField } from './CardFormFields'
import '../../index.css'

// ── The rule's reading, on a written grammar card's form ─────────
// Optional, and the one way to correct what the card would otherwise
// print over the rule (the catalogue's reading, or the tokenizer's
// guess). A reading that does not spell the rule is not used, so the
// field previews the furigana it gives as it is typed, and says so
// when it gives none.

const FIELD = { key: 'rule_reading', kind: 'text', required: false, positional: false, reads: 'rule' }

function Form({ rule, initial = '' }) {
  const [value, setValue] = useState(initial)
  return <ReadingOfField field={FIELD} value={value} of={rule} onChange={setValue} />
}

beforeEach(() => { localStorage.setItem('lang', 'en') })
afterEach(() => { localStorage.removeItem('lang') })

describe('the rule’s reading', () => {
  it('previews the furigana it gives as it is typed', async () => {
    const screen = await render(<LangProvider><Form rule="〜の中で" /></LangProvider>)
    const input = screen.container.querySelector('input')
    expect(input.getAttribute('placeholder')).toBe('Its reading, in kana — e.g. 〜のなかで (optional)')
    // nothing typed, nothing said
    expect(screen.container.querySelector('.deckdetail-form__reading, .deckdetail-form__reading-off')).toBeNull()
    await userEvent.type(input, 'のなかで')
    const preview = screen.container.querySelector('.deckdetail-form__reading')
    expect([...preview.querySelectorAll('rt')].map(rt => rt.textContent)).toEqual(['なか'])
    expect(preview.textContent).toBe('〜の中なかで')
  })

  it('says so when the reading does not spell the rule', async () => {
    const screen = await render(<LangProvider><Form rule="〜の中で" initial="なか" /></LangProvider>)
    expect(screen.container.querySelector('.deckdetail-form__reading')).toBeNull()
    expect(screen.container.querySelector('.deckdetail-form__reading-off').textContent)
      .toBe('This doesn’t spell the rule: write each kanji in kana and the rest as it is.')
  })

  it('says nothing over a rule with no kanji to read', async () => {
    const screen = await render(<LangProvider><Form rule="〜てから" initial="てから" /></LangProvider>)
    expect(screen.container.querySelector('.deckdetail-form__reading, .deckdetail-form__reading-off')).toBeNull()
  })
})
