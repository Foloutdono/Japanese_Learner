import { describe, it, expect, vi, beforeEach } from 'vitest'
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

    const click = sel => { document.querySelector(sel).click() }
    const toggleDetails = () => click('.import-match-note__act .deckdetail-form__addline')
    beforeEach(() => { onMatch.mockClear() })

    it('asks once, counting only the rows that match for certain', async () => {
      await open()
      expect(onMatch).toHaveBeenCalledOnce()
      expect(document.querySelectorAll('.import-match-note')).toHaveLength(1)
      expect(document.querySelector('.import-match-note__msg').textContent).toMatch(/\b1\b/)
      expect(document.querySelectorAll('.import-preview-row__app')).toHaveLength(0)
    })

    it('writes every row when the question is ignored', async () => {
      const onImport = await open()
      click('.import-footer .import-footer__submit')
      await settle()
      const [own, , apps] = onImport.mock.calls[0]
      expect(apps).toEqual([])
      expect(own).toHaveLength(3)
    })

    it('links the exact cards on yes and writes the rest', async () => {
      const onImport = await open()
      click('.import-match-note__act .import-footer__submit')
      await settle()
      expect(document.querySelector('.import-match-note--done')).not.toBeNull()
      expect(document.querySelectorAll('.import-preview-row__app')).toHaveLength(1)
      click('.import-footer .import-footer__submit')
      await settle()
      const [own, skipped, apps] = onImport.mock.calls[0]
      expect(apps).toEqual([{ source: 'vocab', level: 'N5', raw_id: 'vocab_N5_水_みず' }])
      expect(own.map(r => r.fields.word)).toEqual(['塩', 'zzz'])
      expect(skipped).toBe(0)
    })

    it('keeps every row as written on no, and Change asks again', async () => {
      const onImport = await open()
      click('.import-match-note__act .import-footer__cancel')
      await settle()
      expect(document.querySelector('.import-match-note--done')).not.toBeNull()
      click('.import-footer .import-footer__submit')
      await settle()
      const [own, , apps] = onImport.mock.calls[0]
      expect(apps).toEqual([])
      expect(own).toHaveLength(3)
    })

    it('opens the details and takes a card offered as a guess once picked', async () => {
      const onImport = await open()
      toggleDetails()
      await settle()
      const groups = document.querySelectorAll('.import-match-note__list .seg')
      expect(groups).toHaveLength(2)
      groups[1].querySelector('[role="radio"]').click()
      await settle()
      click('.import-match-note__act .import-footer__submit')
      await settle()
      click('.import-footer .import-footer__submit')
      await settle()
      const [own, , apps] = onImport.mock.calls[0]
      expect(apps.map(a => a.raw_id)).toEqual(['vocab_N5_水_みず', 'vocab_N3_塩_しお'])
      expect(own.map(r => r.fields.word)).toEqual(['zzz'])
    })

    it('lets the learner switch one match back to their own before saying yes', async () => {
      const onImport = await open()
      toggleDetails()
      await settle()
      const own0 = [...document.querySelectorAll('.import-match-note__list .seg')[0].querySelectorAll('[role="radio"]')].at(-1)
      own0.click()
      await settle()
      click('.import-match-note__act .import-footer__submit')
      await settle()
      click('.import-footer .import-footer__submit')
      await settle()
      const [own, , apps] = onImport.mock.calls[0]
      expect(apps).toEqual([])
      expect(own).toHaveLength(3)
    })

    it('imports as written, with no question, when the ask fails', async () => {
      const onImport = await open({ onMatch: vi.fn(async () => { throw new Error('offline') }) })
      expect(document.querySelectorAll('.import-match-note')).toHaveLength(0)
      click('.import-footer__submit')
      await settle()
      const [own, , apps] = onImport.mock.calls[0]
      expect(own).toHaveLength(3)
      expect(apps).toEqual([])
    })
  })
})
