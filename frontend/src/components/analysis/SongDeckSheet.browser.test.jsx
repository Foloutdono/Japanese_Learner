import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'

// ── 歌 — the song sheet makes the song's deck (plan 210) ──
// One mixed deck, through the endpoints the rest of the app already
// writes decks with: the deck made (or found) by name, the words as one
// batch of app cards, the lines in the import dialog's slices. What a
// second press for the same song writes is what the deck does not hold
// yet.

const apiJson = vi.fn()
vi.mock('../../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a) }))

const { SongDeckSheet } = await import('./SongDeckSheet')
const { default: en } = await import('../../locales/en/index.js')

const card = (raw_id, level = 'N5') => ({ raw_id, level, entry: {}, stats: { status: 'new' } })
const tok = (surface, start, reading, pos, vocab_match = null) => ({
  surface, start, end: start + surface.length, reading, pos, vocab_match, grammar: [],
})
const CALL = {
  text: '君の名前を呼ぶよ', available: true, grammar: [],
  tokens: [
    tok('君', 0, 'きみ', 'noun', card('vocab_N5_君_きみ')),
    tok('の', 1, 'の', 'particle'),
    tok('名前', 2, 'なまえ', 'noun', card('vocab_N5_名前_なまえ')),
    tok('を', 4, 'を', 'particle'),
    tok('呼ぶ', 5, 'よぶ', 'verb', card('vocab_N4_呼ぶ_よぶ', 'N4')),
    tok('よ', 7, 'よ', 'particle'),
  ],
}
const NIGHT = {
  text: '夜が来る', available: true, grammar: [],
  tokens: [
    tok('夜', 0, 'よる', 'noun', card('vocab_N5_夜_よる')),
    tok('が', 1, 'が', 'particle'),
    tok('来る', 2, 'くる', 'verb', card('vocab_N5_来る_くる')),
  ],
}
const SONG = [CALL, NIGHT, CALL]

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

function miningWith(ensureDeck) {
  return { ensureDeck: vi.fn(ensureDeck) }
}

// A server that holds the decks it is told to make, and the lines
// already written into the lyrics deck.
function server({ heldLines = [], batch = () => ({ inserted: 1, errors: [] }) } = {}) {
  apiJson.mockImplementation(async (url, _s, opts) => {
    if (url === '/api/decks/3/cards/app') return { added: 4 }
    // A word already in the deck is listed too, and is never a line.
    if (url === '/api/decks/3/cards') {
      return { cards: [{ origin: 'app', front: '夜が来る' }, ...heldLines.map((front, i) => ({ id: i, origin: 'custom', front }))] }
    }
    if (url === '/api/decks/3/cards/batch') return batch(JSON.parse(opts.body))
    throw new Error(`unexpected ${url}`)
  })
}
const DECK = name => ({ id: 3, name, type: 'mixed' })

async function renderSheet(mining, { title = '夜' } = {}) {
  return render(
    <LangProvider>
      <MemoryRouter>
        <SongDeckSheet session={{}} mining={mining} sentences={SONG} title={title} t={en} onClose={() => {}} />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiJson.mockReset()
  track.mockReset()
})

describe('the song sheet', () => {
  it('makes one mixed deck of the words and the lines, and turns into the door to it', async () => {
    server()
    const mining = miningWith(async (_kind, name) => DECK(name))
    const screen = await renderSheet(mining, { title: '夜に駆ける' })
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog.querySelector('input').value).toBe('夜に駆ける')
    // Two halves, each with what it would take: five words, two lines (a
    // chorus once).
    const chips = [...dialog.querySelectorAll('.chip')]
    expect(chips.map(c => c.querySelector('.chip__n').textContent)).toEqual(['5', '2'])
    expect(chips.every(c => c.getAttribute('aria-pressed') === 'true')).toBe(true)

    dialog.querySelector('.btn-primary').click()
    await settle(120)

    expect(mining.ensureDeck).toHaveBeenCalledTimes(1)
    expect(mining.ensureDeck).toHaveBeenCalledWith('mixed', '夜に駆ける', { remember: false })
    const app = apiJson.mock.calls.find(([url]) => url === '/api/decks/3/cards/app')
    expect(JSON.parse(app[2].body).cards.map(c => c.raw_id)).toEqual([
      'vocab_N5_君_きみ', 'vocab_N5_名前_なまえ', 'vocab_N4_呼ぶ_よぶ', 'vocab_N5_夜_よる', 'vocab_N5_来る_くる',
    ])
    const lines = apiJson.mock.calls.filter(([url]) => url === '/api/decks/3/cards/batch')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0][2].body).cards).toEqual([
      { front: '君の名前を呼ぶよ', back: 'きみのなまえをよぶよ', notes: '' },
      { front: '夜が来る', back: 'よるがくる', notes: '' },
    ])
    expect(track).toHaveBeenCalledWith('song_deck', { words: 5, lines: 2 })

    // Made: the form gives way to the door to the deck, 混 on its roundel
    // and the seven cards the song gave it.
    const doors = [...document.querySelectorAll('a.anl-song__deck')]
    expect(doors.map(a => a.getAttribute('href'))).toEqual(['/learn/decks/3'])
    expect(doors[0].querySelector('.picker-row__roundel').textContent).toBe('混')
    expect(doors[0].querySelector('.picker-row__count').textContent).toBe(en.cardsUnit(7))
    expect(document.querySelector('form.anl-song')).toBeNull()
    screen.unmount()
  })

  it('takes only the half that is pressed, and nothing without a name', async () => {
    server()
    const mining = miningWith(async (_kind, name) => DECK(name))
    const screen = await renderSheet(mining, { title: '' })
    const dialog = document.querySelector('[role="dialog"]')
    // No title from the player: the first line is proposed instead.
    const input = dialog.querySelector('input')
    expect(input.value).toBe('君の名前を呼ぶよ')
    dialog.querySelectorAll('.chip')[0].click()
    await settle()
    expect(dialog.querySelectorAll('.chip')[0].getAttribute('aria-pressed')).toBe('false')

    const proto = Object.getPrototypeOf(input)
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, '  ')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    expect(dialog.querySelector('.btn-primary').disabled).toBe(true)

    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, 'Yoru')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    dialog.querySelector('.btn-primary').click()
    await settle(120)
    expect(mining.ensureDeck).toHaveBeenCalledWith('mixed', 'Yoru', { remember: false })
    expect(apiJson.mock.calls.some(([url]) => url === '/api/decks/3/cards/app')).toBe(false)
    expect(track).toHaveBeenCalledWith('song_deck', { words: 0, lines: 2 })
    screen.unmount()
  })

  it('tops a deck made before up with the lines it does not hold', async () => {
    server({ heldLines: ['君の名前を呼ぶよ'] })
    const mining = miningWith(async (_kind, name) => DECK(name))
    const screen = await renderSheet(mining, { title: '夜' })
    document.querySelector('[role="dialog"] .btn-primary').click()
    await settle(120)
    const lines = apiJson.mock.calls.filter(([url]) => url === '/api/decks/3/cards/batch')
    expect(JSON.parse(lines[0][2].body).cards.map(c => c.front)).toEqual(['夜が来る'])
    screen.unmount()
  })

  it('says so when the plan\'s limit leaves part of the song out', async () => {
    server({ batch: () => ({ inserted: 0, errors: [{ index: 0, limit: 200 }] }) })
    const mining = miningWith(async (_kind, name) => DECK(name))
    const screen = await renderSheet(mining, { title: '夜' })
    document.querySelector('[role="dialog"] .btn-primary').click()
    await settle(120)
    expect(document.querySelector('.anl-song__error').textContent).toBe(en.songDeckLimit)
    // The deck was made all the same, and stays reachable.
    expect(document.querySelectorAll('a.anl-song__deck')).toHaveLength(1)
    screen.unmount()
  })

  it('keeps the form, and says so, when a deck cannot be made', async () => {
    server()
    const mining = miningWith(async () => { throw new Error('down') })
    const screen = await renderSheet(mining, { title: '夜' })
    document.querySelector('[role="dialog"] .btn-primary').click()
    await settle(120)
    expect(document.querySelector('.anl-song__error').textContent).toBe(en.songDeckFailed)
    expect(document.querySelector('form.anl-song')).not.toBeNull()
    expect(track).not.toHaveBeenCalled()
    screen.unmount()
  })
})
