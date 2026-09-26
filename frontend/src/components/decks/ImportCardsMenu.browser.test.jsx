import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import ImportCardsMenu from './ImportCardsMenu'
import '../../index.css'

// The import dialog reads a paste against the deck's structure: the
// preview says what it will import and what it leaves out, and
// `onImport` gets the whole rows in the deck's own fields -- not the
// front/back pairs a grammar deck refused row by row.

vi.mock('../../lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

const GRAMMAR = {
  key: 'grammar', front_key: 'rule', back_key: 'meaning',
  fields: [
    { key: 'rule', kind: 'text', required: true },
    { key: 'meaning', kind: 'text', required: true },
    { key: 'structure', kind: 'text', required: false },
    { key: 'register', kind: 'choice', required: false, options: ['neutral', 'polite', 'casual', 'formal', 'written'] },
    { key: 'explanation', kind: 'long', required: false },
    { key: 'usage', kind: 'long', required: false },
    { key: 'careful', kind: 'long', required: false },
    { key: 'sentences', kind: 'pairs', required: false, parts: ['jp', 'tr'] },
    { key: 'compare', kind: 'pairs', required: false, parts: ['pattern', 'text'] },
  ],
}

function type(el, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('the import dialog', () => {
  it('imports the whole rows in the deck’s fields and counts the rest', async () => {
    const onImport = vi.fn(async () => {})
    await render(<LangProvider><ImportCardsMenu structure={GRAMMAR} onImport={onImport} onClose={() => {}} /></LangProvider>)
    await settle()
    const box = document.querySelector('.import-textarea')
    // A spreadsheet's copy: tabs, which the dialog switches to itself.
    type(box, 'Règle\tSens\tExemple\tTraduction\n〜せいで\tà cause de\t雨のせいで中止。\tÀ cause de la pluie.\n〜ために\t\t\t')
    await settle()
    expect(document.querySelector('.import-preview__note').textContent).toMatch(/Règle|Rule/)
    expect(document.querySelectorAll('.import-preview-row--skipped')).toHaveLength(1)
    document.querySelector('.import-footer__submit').click()
    await settle()
    expect(onImport).toHaveBeenCalledOnce()
    const [rows, skipped] = onImport.mock.calls[0]
    expect(skipped).toBe(1)
    expect(rows).toHaveLength(1)
    expect(rows[0].fields).toMatchObject({
      rule: '〜せいで', meaning: 'à cause de',
      sentences: [{ jp: '雨のせいで中止。', tr: 'À cause de la pluie.' }],
    })
  })

  it('fills the box with an example that previews as one card', async () => {
    await render(<LangProvider><ImportCardsMenu structure={GRAMMAR} onImport={vi.fn()} onClose={() => {}} /></LangProvider>)
    await settle()
    document.querySelector('.import-columns__example').click()
    await settle()
    expect(document.querySelector('.import-textarea').value).not.toBe('')
    expect(document.querySelectorAll('.import-preview-row')).toHaveLength(1)
    expect(document.querySelectorAll('.import-preview-row--skipped')).toHaveLength(0)
  })
})
