import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── The ＋'s outcome belongs to the entry it added (plan 123) ───────
// The dictionary plate stays mounted while the entry under it changes
// -- the phone's lookup stack walks from a word to its kanji, the
// desk's dock from tile to tile -- and the ＋'s picker, pending flag and
// "In deck" belonged to the plate, not to the entry. So 犬 said "In
// deck" because 猫 had just been added, its ＋ offered "another deck",
// and a picker left open added whatever the plate now showed.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn(), playKana: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { DictionaryDetail } = await import('./components/dictionary/DictionaryDetail')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const card = (kanji, kana, meaning, id) => ({
  type: 'vocab', kanji, kana, meaning, level: 'N5', senses: [], examples: [], status: { status: 'new' },
  app_card: { source: 'vocab', level: 'N5', raw_id: id },
})
const NEKO = card('猫', 'ねこ', 'cat', 'vocab_N5_猫_ねこ')
const INU = card('犬', 'いぬ', 'dog', 'vocab_N5_犬_いぬ')

function makeMining() {
  return {
    targetFor: () => ({ id: 1, name: 'N5' }),
    decksFor: () => [{ id: 1, name: 'N5' }, { id: 2, name: 'Animals' }],
    ensureDeck: vi.fn(async () => ({ id: 3 })),
    mineApp: vi.fn(async () => 1),
  }
}
const Plate = ({ entry, mining }) => (
  <LangProvider><MemoryRouter><DictionaryDetail entry={entry} mining={mining} onClose={() => {}} /></MemoryRouter></LangProvider>
)
async function addToDeck() {
  $('.dict-plate__add-btn').click()
  await settle()
  ;[...document.querySelectorAll('.dict-add-menu__row')].find(r => r.getAttribute('role') === 'menuitem').click()
  await settle()
}

describe('the plate\'s ＋, walked to another entry', () => {
  it('says nothing about the next entry, and adds it to the remembered deck', async () => {
    const mining = makeMining()
    const screen = await render(<Plate entry={NEKO} mining={mining} />)
    await settle()
    await addToDeck()
    expect($('.analysis-mine-status--added')).not.toBeNull()

    await screen.rerender(<Plate entry={INU} mining={mining} />)
    await settle()
    expect($('.analysis-mine-status')).toBeNull()
    // 犬's first add goes to the remembered deck, not through the picker.
    await addToDeck()
    expect($('[aria-modal="true"]')).toBeNull()
    expect(mining.mineApp).toHaveBeenCalledTimes(2)
    expect(mining.mineApp.mock.calls[1][0]).toMatchObject({ deckId: 1, rawId: 'vocab_N5_犬_いぬ' })
  })

  it('closes a picker left open on the entry it was opened for', async () => {
    const mining = makeMining()
    const screen = await render(<Plate entry={NEKO} mining={mining} />)
    await settle()
    await addToDeck()
    // A second add chooses: the picker opens for 猫.
    await addToDeck()
    expect($('[aria-modal="true"]')).not.toBeNull()

    await screen.rerender(<Plate entry={INU} mining={mining} />)
    await settle()
    expect($('[aria-modal="true"]')).toBeNull()
    expect(mining.mineApp).toHaveBeenCalledTimes(1)
  })
})
