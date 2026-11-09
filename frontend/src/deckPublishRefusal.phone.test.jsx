import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import fr from './locales/fr/index.js'
import './index.css'

// The library's refusal on a phone (plan 310, the owner's pick B with
// C's line): a refused publish keeps the More sheet open and says there
// which field it was, never the word; a refused name brings its field,
// since no other screen renames a deck; a refused card is named by its
// front and opened in its editor, which says it again; and a card saved
// on a deck others read says it in the form.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./lib/track', () => ({ track: vi.fn(), countUse: vi.fn() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))

const WORDS = [['駅', 'gare'], ['切符', 'billet'], ['改札', 'portillon']]
const CARDS = WORDS.map(([front, back], i) => ({
  id: 100 + i, origin: 'custom', front, back, state: 'new', fields: { front, back },
}))
const STRUCTURES = [{ key: 'standard', fields: [{ key: 'front', required: true }, { key: 'back', required: true }] }]
const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body })
const refused = detail => json({ detail: { code: 'content_refused', message: 'content_refused', ...detail } }, 422)

let deck
let answers
const calls = []
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async (path, _session, opts = {}) => {
    calls.push([opts.method ?? 'GET', path, opts.body])
    const key = `${opts.method ?? 'GET'} ${path}`
    if (answers[key]) return answers[key].length > 1 ? answers[key].shift() : answers[key][0]
    if (path === '/api/decks/structures') return json({ structures: STRUCTURES })
    if (path === '/api/decks/1') return json(deck)
    if (path === '/api/decks/1/cards') return json({ cards: CARDS })
    return json({})
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue(json({}))

const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const button = text => $$('button').find(b => b.textContent.trim().endsWith(text))
const type = (input, value) => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/decks/1']}>
        <div className="phone">
          <div className="phone__content">
            <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

async function publish() {
  button(fr.deckMore).click()
  await settle(150)
  $$('.more-row').find(b => b.textContent.includes(fr.libraryPublish)).click()
  await settle(150)
}

beforeEach(() => {
  deck = { id: 1, name: 'Voyage au Japon', type: 'standard', role: 'owner', visibility: 'private', card_count: 3 }
  answers = {}
  calls.length = 0
})

describe('a refused publish, on a phone', () => {
  it('keeps the sheet open and names a refused card by its front, then opens it saying so', async () => {
    answers['POST /api/decks/1/publish'] = [refused({ field: 'card', card_id: 102 })]
    await mount()
    await publish()
    expect($('.sheet__q--danger').textContent).toBe(fr.libraryRefusedCard('改札'))
    expect($('.sheet__q--danger').getAttribute('role')).toBe('alert')
    // Still in the sheet, under the row that was tapped.
    expect($$('.more-row').some(b => b.textContent.includes(fr.libraryPublish))).toBe(true)

    button(fr.libraryOpenCard).click()
    await settle(200)
    expect($('.sheet__q--danger')).toBeNull()
    const form = $('.deckdetail-form')
    expect(form).not.toBeNull()
    expect(form.querySelector('.deckdetail-form__refused').textContent).toBe(fr.cardRefused)
    expect([...form.querySelectorAll('input')].map(i => i.value).slice(0, 2)).toEqual(['改札', 'portillon'])
  })

  it('gives a refused name its field, and renames before publishing again', async () => {
    answers['POST /api/decks/1/publish'] = [refused({ field: 'name' }), json({ ...deck, visibility: 'public' })]
    answers['PATCH /api/decks/1'] = [json({ ...deck, name: 'Voyage en train' })]
    await mount()
    await publish()
    expect($('.sheet__q--danger').textContent).toBe(fr.libraryRefusedName)
    const field = $$('input').find(i => i.placeholder === fr.deckNamePlaceholder)
    expect(field.value).toBe('Voyage au Japon')

    type(field, '  ')
    await settle(30)
    expect(button(fr.libraryRename).disabled).toBe(true)
    type(field, 'Voyage en train')
    await settle(30)
    button(fr.libraryRename).click()
    await settle(250)

    const sent = calls.filter(([m]) => m !== 'GET')
    expect(sent.map(([m, p]) => `${m} ${p}`)).toEqual([
      'POST /api/decks/1/publish', 'PATCH /api/decks/1', 'POST /api/decks/1/publish',
    ])
    expect(JSON.parse(sent[1][2])).toEqual({ name: 'Voyage en train' })
    // Published: the sheet is closed and nothing is refused.
    expect($('.sheet__q--danger')).toBeNull()
    expect($('.more-list')).toBeNull()
  })

  it('says a refused description, and nothing more', async () => {
    answers['POST /api/decks/1/publish'] = [refused({ field: 'description' })]
    await mount()
    await publish()
    expect($('.sheet__q--danger').textContent).toBe(fr.libraryRefusedDescription)
    expect(button(fr.libraryOpenCard)).toBeUndefined()
    expect(button(fr.libraryRename)).toBeUndefined()
  })

  it('forgets the refusal once the sheet is closed', async () => {
    answers['POST /api/decks/1/publish'] = [refused({ field: 'description' })]
    await mount()
    await publish()
    // The scrim over the page, which is how a phone closes a sheet.
    $('.scrim').click()
    await settle(200)
    expect($('.more-list')).toBeNull()
    button(fr.deckMore).click()
    await settle(150)
    expect($('.sheet__q--danger')).toBeNull()
  })

  it('closes on a publish that passes, saying nothing', async () => {
    answers['POST /api/decks/1/publish'] = [json({ ...deck, visibility: 'public' })]
    await mount()
    await publish()
    expect($('.sheet__q--danger')).toBeNull()
    expect($('.more-list')).toBeNull()
  })
})

describe('a card saved on a deck others read, on a phone', () => {
  it('says the refusal in the form, and lets it go once the card passes', async () => {
    deck = { ...deck, visibility: 'public' }
    answers['PUT /api/decks/1/cards/101'] = [refused({ field: 'card', card_id: 101 }),
      json({ id: 101, front: '切符', back: 'ticket', fields: { front: '切符', back: 'ticket' } })]
    await mount()
    $$('.card-list .card-row__body')[1].click()
    await settle(150)
    expect($('.deckdetail-form__refused')).toBeNull()
    $('.deckdetail-form .btn-primary').click()
    await settle(150)
    expect($('.deckdetail-form__refused').textContent).toBe(fr.cardRefused)

    $('.deckdetail-form .btn-primary').click()
    await settle(150)
    expect($('.deckdetail-form__refused')).toBeNull()
  })

  it('does not carry a new card\'s refusal to the next new card', async () => {
    deck = { ...deck, visibility: 'public' }
    answers['POST /api/decks/1/cards'] = [refused({ field: 'card' })]
    await mount()
    button(fr.addCard.replace(/^\+\s*/, ''))?.click()
    await settle(150)
    const inputs = $$('.deckdetail-form input')
    type(inputs[0], '会議')
    type(inputs[1], 'réunion')
    await settle(30)
    $('.deckdetail-form .btn-primary').click()
    await settle(150)
    expect($('.deckdetail-form__refused').textContent).toBe(fr.cardRefused)
    // Cancelled, and a new card begun: a blank form says nothing.
    button(fr.cancel).click()
    await settle(100)
    button(fr.addCard.replace(/^\+\s*/, ''))?.click()
    await settle(150)
    expect($('.deckdetail-form')).not.toBeNull()
    expect($('.deckdetail-form__refused')).toBeNull()
  })
})
