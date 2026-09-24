import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── Enter and Esc belong to the input method while it composes ─────
// (plan 123) Japanese is typed through an input method: the Enter that
// commits くち and the Esc that cancels a conversion reach the page as
// keydowns, flagged isComposing (Chrome, Firefox) or keyCode 229
// (Safari). Taken as the field's own Enter, one commit graded a
// readings answer with a single row filled, created a deck named after
// its first word, or boarded with half a name. Every field that submits
// on Enter now leaves a composing key to the input method.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))

const { TypeInput } = await import('./components/study/QuizComponents')
const { default: ReadingsInput } = await import('./components/study/ReadingsInput')
const { default: NameStep } = await import('./components/boarding/NameStep')
const { composing } = await import('./lib/keyGuards')

const settle = (ms = 40) => new Promise(r => setTimeout(r, ms))

function enter(el, how) {
  const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: how === 'composing' })
  if (how === 'safari') Object.defineProperty(e, 'keyCode', { get: () => 229 })
  el.dispatchEvent(e)
}

const wrap = ui => render(<LangProvider><MemoryRouter>{ui}</MemoryRouter></LangProvider>)

function Typed({ onSubmit }) {
  const [v, setV] = useState('くち')
  return <TypeInput value={v} onChange={setV} onSubmit={onSubmit} submitted={false} answer="くち" />
}

const FIELDS = {
  'a typed answer': async onSubmit => {
    await wrap(<Typed onSubmit={onSubmit} />)
    return document.querySelector('.quiz-input')
  },
  'a readings answer': async onSubmit => {
    await wrap(<ReadingsInput readings={{ on: [{ reading: 'コウ' }], kun: [{ reading: 'くち' }] }} submitted={false} onSubmit={onSubmit} />)
    return document.querySelector('.readings-input__field')
  },
  'the boarding name': async onSubmit => {
    await wrap(<NameStep value="あいこ" onChange={() => {}} onContinue={onSubmit} />)
    return document.querySelector('.brd-field input, input[autocomplete="nickname"]')
  },
}

describe('a field that submits on Enter', () => {
  for (const [name, mount] of Object.entries(FIELDS)) {
    it(`${name}: a composing Enter commits the word and submits nothing`, async () => {
      const onSubmit = vi.fn()
      const field = await mount(onSubmit)
      await settle()
      enter(field, 'composing')
      enter(field, 'safari')
      await settle()
      expect(onSubmit).not.toHaveBeenCalled()
      enter(field, 'plain')
      await settle()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  }
})

describe('composing()', () => {
  it('reads a DOM event and a React one alike', () => {
    expect(composing(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))).toBe(true)
    expect(composing({ nativeEvent: { isComposing: true } })).toBe(true)
    expect(composing({ nativeEvent: { isComposing: false, keyCode: 229 } })).toBe(true)
    expect(composing(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false)
  })
})
