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

  // The app's own cards a row may mean (importMatches.js): an exact one
  // starts on the app's card, a guess on the learner's own, and the choice
  // splits the import in two.
  describe('with the app’s cards to match', () => {
    const VOCAB = {
      key: 'vocab', front_key: 'word', back_key: 'meaning',
      fields: [
        { key: 'word', kind: 'text', required: true },
        { key: 'meaning', kind: 'text', required: true },
        { key: 'reading', kind: 'text', required: false },
      ],
    }
    const WATER = { source: 'vocab', level: 'N5', raw_id: 'vocab_N5_水_みず', front: '水', kana: 'みず', meaning: 'water', exact: true }
    const SALT = { source: 'vocab', level: 'N3', raw_id: 'vocab_N3_塩_しお', front: '塩', kana: 'しお', meaning: 'salt', exact: false }
    const onMatch = vi.fn(async () => [[WATER], [SALT], []])

    async function open(props = {}) {
      const onImport = vi.fn(async () => {})
      await render(<LangProvider><ImportCardsMenu structure={VOCAB} onImport={onImport} onMatch={onMatch} onClose={() => {}} {...props} /></LangProvider>)
      await settle()
      type(document.querySelector('.import-textarea'), '水,water\n塩,salt\nzzz,none')
      await settle(700)
      return onImport
    }

    it('offers the card each row may mean and starts only an exact one on it', async () => {
      await open()
      expect(onMatch).toHaveBeenCalledOnce()
      const groups = document.querySelectorAll('.import-match .seg')
      expect(groups).toHaveLength(2)
      const checked = [...groups].map(g => g.querySelector('[aria-checked="true"]').textContent)
      expect(checked[0]).toContain('水')
      expect(checked[1]).not.toContain('塩')
      expect(document.querySelector('.import-match__line').textContent).toContain('water')
    })

    it('sends the app’s cards to be linked and the other rows to be written', async () => {
      const onImport = await open()
      document.querySelector('.import-footer__submit').click()
      await settle()
      const [own, skipped, apps] = onImport.mock.calls[0]
      expect(apps).toEqual([{ source: 'vocab', level: 'N5', raw_id: 'vocab_N5_水_みず' }])
      expect(own.map(r => r.fields.word)).toEqual(['塩', 'zzz'])
      expect(skipped).toBe(0)
    })

    it('writes every row when the learner keeps their own', async () => {
      const onImport = await open()
      document.querySelector('.import-match__bar button').click()
      await settle()
      document.querySelector('.import-footer__submit').click()
      await settle()
      const [own, , apps] = onImport.mock.calls[0]
      expect(apps).toEqual([])
      expect(own).toHaveLength(3)
    })

    it('takes a card offered as a guess once the learner picks it', async () => {
      const onImport = await open()
      document.querySelectorAll('.import-match .seg')[1].querySelector('[role="radio"]').click()
      await settle()
      document.querySelector('.import-footer__submit').click()
      await settle()
      const [own, , apps] = onImport.mock.calls[0]
      expect(apps.map(a => a.raw_id)).toEqual(['vocab_N5_水_みず', 'vocab_N3_塩_しお'])
      expect(own.map(r => r.fields.word)).toEqual(['zzz'])
    })

    it('imports as written when the ask fails', async () => {
      const onImport = await open({ onMatch: vi.fn(async () => { throw new Error('offline') }) })
      expect(document.querySelectorAll('.import-match')).toHaveLength(0)
      document.querySelector('.import-footer__submit').click()
      await settle()
      const [own, , apps] = onImport.mock.calls[0]
      expect(own).toHaveLength(3)
      expect(apps).toEqual([])
    })
  })
})
