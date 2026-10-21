import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'

// ── 歌 — a song's lyrics into a deck, from the shelf (plan 264) ──
// The sheet opens a video session (the analyser's), waits for it, asks
// the sort which lines are the song, shows the two piles -- the sung
// ticked, the rest not -- and makes a lyrics deck of what stays ticked.

const apiJson = vi.fn()
const apiUpload = vi.fn()
vi.mock('../../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
  apiUpload: (...a) => apiUpload(...a),
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
const track = vi.fn()
vi.mock('../../lib/track', () => ({ track: (...a) => track(...a) }))

const { LyricsImportSheet } = await import('./LyricsImportSheet')
const { default: en } = await import('../../locales/en/index.js')

const card = (raw_id, level = 'N5') => ({ raw_id, level, entry: {}, stats: { status: 'new' } })
const tok = (surface, start, reading, pos, vocab_match = null) => ({
  surface, start, end: start + surface.length, reading, pos, vocab_match, grammar: [],
})
const HELLO = {
  text: '皆さん今日は', available: true, grammar: [],
  tokens: [tok('皆さん', 0, 'みなさん', 'noun', card('vocab_N5_皆さん_みなさん')), tok('今日は', 3, 'こんにちは', 'interjection')],
}
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
const MUSIC = { text: '[音楽]', available: true, grammar: [], tokens: [] }
const ENGLISH = { text: 'I love you', available: true, foreign: true, grammar: [], tokens: [] }
const SENTENCES = [MUSIC, HELLO, CALL, ENGLISH, CALL]
const KINDS = ['sound', 'spoken', 'sung', 'sung', 'sung']

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

function server({ linkFetch = true, sort = { sorted: true, reason: null, kinds: KINDS } } = {}) {
  apiUpload.mockResolvedValue({ sessionId: 11, status: 'generating' })
  let polls = 0
  apiJson.mockImplementation(async (url, _s, opts) => {
    if (url === '/api/video/capabilities') return { linkFetch }
    if (url === '/api/video/session') return { sessionId: 11, status: 'generating' }
    if (url === '/api/video/session/11') {
      polls += 1
      return polls === 1 ? { status: 'generating' } : { status: 'ready', sentences: SENTENCES }
    }
    if (url === '/api/video/session/11/lyrics') return sort
    if (url === '/api/decks') return { id: 5, name: JSON.parse(opts.body).name, type: 'lyrics' }
    if (url === '/api/decks/5/cards/app') return { added: 3 }
    if (url === '/api/decks/5/cards') return { cards: [] }
    if (url === '/api/decks/5/cards/batch') return { inserted: 1, errors: [] }
    throw new Error(`unexpected ${url}`)
  })
}

async function renderSheet(onMade = vi.fn()) {
  const screen = await render(
    <LangProvider>
      <MemoryRouter>
        <LyricsImportSheet session={{}} t={en} onClose={() => {}} onMade={onMade} />
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen
}

function dialog() {
  return document.querySelector('[role="dialog"]')
}

function setValue(input, value) {
  const proto = Object.getPrototypeOf(input)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function choose(file) {
  const input = dialog().querySelector('input[type="file"]')
  const list = new DataTransfer()
  list.items.add(file)
  input.files = list.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
}

async function untilReview() {
  for (let i = 0; i < 60 && !dialog().querySelector('.lyr-pile'); i += 1) await settle(50)
}

beforeEach(() => {
  apiJson.mockReset()
  apiUpload.mockReset()
  track.mockReset()
})

describe('the lyrics import', () => {
  it('reads a file, shows the two piles and makes a lyrics deck of the sung lines', async () => {
    server()
    const onMade = vi.fn()
    const screen = await renderSheet(onMade)
    expect(dialog().querySelector('.btn-primary').disabled).toBe(true)
    // The head (option A): the song's icon in a roundel, the title in words.
    expect(dialog().querySelector('.sheet__head .lyr-sheet__badge svg')).not.toBeNull()
    expect(dialog().querySelector('.sheet__cap').textContent).toBe(en.lyricsImportTitle)
    expect(dialog().querySelector('.sheet__head').textContent).not.toContain('歌')
    await choose(new File(['[00:01.00]君の名前を呼ぶよ\n'], 'YOASOBI - Yoru.lrc', { type: 'text/plain' }))
    dialog().querySelector('.btn-primary').click()
    await untilReview()

    // The file went up as it is, to the analyser's own session.
    expect(apiUpload.mock.calls[0][0]).toBe('/api/video/session')
    expect(apiUpload.mock.calls[0][2].get('file').name).toBe('YOASOBI - Yoru.lrc')

    // Two piles of the Japanese lines, once each: the chorus ×2 sung and
    // ticked; [音楽] and the greeting not the song, and not ticked. The
    // English line has no Japanese to give a deck, and is not shown.
    const piles = [...dialog().querySelectorAll('.lyr-pile')]
    expect(piles.map(p => p.querySelector('legend').textContent)).toEqual([`${en.lyricsSung} · 1`, `${en.lyricsNotSung} · 2`])
    const rows = [...dialog().querySelectorAll('.lyr-line')]
    expect(rows.map(r => r.querySelector('.lyr-line__text').textContent)).toEqual(['君の名前を呼ぶよ', '[音楽]', '皆さん今日は'])
    expect(rows.map(r => r.querySelector('input').checked)).toEqual([true, false, false])
    expect(rows[0].querySelector('.lyr-line__times').textContent).toBe('×2')
    expect(rows.slice(1).map(r => r.querySelector('.lyr-line__kind').textContent))
      .toEqual([en.lyricsKindSound, en.lyricsKindSpoken])
    // The file's name, its extension off, is the deck's proposed name.
    expect(dialog().querySelector('.anl-song__name input').value).toBe('YOASOBI - Yoru')

    dialog().querySelector('.btn-primary').click()
    await settle(150)
    const made = apiJson.mock.calls.find(([url]) => url === '/api/decks')
    expect(JSON.parse(made[2].body)).toEqual({ name: 'YOASOBI - Yoru', type: 'lyrics' })
    const app = apiJson.mock.calls.find(([url]) => url === '/api/decks/5/cards/app')
    expect(JSON.parse(app[2].body).cards.map(c => c.raw_id)).toEqual([
      'vocab_N5_君_きみ', 'vocab_N5_名前_なまえ', 'vocab_N4_呼ぶ_よぶ',
    ])
    const batch = apiJson.mock.calls.find(([url]) => url === '/api/decks/5/cards/batch')
    expect(JSON.parse(batch[2].body).cards).toEqual([
      { front: '君の名前を呼ぶよ', back: 'きみのなまえをよぶよ', notes: '' },
    ])
    expect(track).toHaveBeenCalledWith('song_deck', { words: 3, lines: 1 })
    expect(onMade).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }))
    const door = document.querySelector('a.anl-song__deck')
    expect(door.getAttribute('href')).toBe('/learn/decks/5')
    expect(door.querySelector('.picker-row__roundel').textContent).toBe('歌')
    screen.unmount()
  })

  it('takes a line the learner ticks from the other pile', async () => {
    server()
    const screen = await renderSheet()
    dialog().querySelectorAll('.seg__opt')[2].click()
    await settle()
    setValue(dialog().querySelector('textarea'), '皆さん今日は\n君の名前を呼ぶよ')
    await settle()
    dialog().querySelector('.btn-primary').click()
    await untilReview()
    // A paste goes up as a text file, a line a line.
    const sent = apiUpload.mock.calls[0][2].get('file')
    expect(sent.name).toBe('lyrics.txt')
    expect(await sent.text()).toBe('皆さん今日は\n君の名前を呼ぶよ')
    // No file name: the first sung line is proposed, never the [音楽].
    expect(dialog().querySelector('.anl-song__name input').value).toBe('君の名前を呼ぶよ')

    // Ticked, a line keeps its place in its pile.
    dialog().querySelectorAll('.lyr-line input')[2].click()
    await settle()
    expect(dialog().querySelectorAll('.lyr-line')[2].classList.contains('lyr-line--on')).toBe(true)
    dialog().querySelector('.btn-primary').click()
    await settle(150)
    const batch = apiJson.mock.calls.find(([url]) => url === '/api/decks/5/cards/batch')
    expect(JSON.parse(batch[2].body).cards.map(c => c.front)).toEqual(['皆さん今日は', '君の名前を呼ぶよ'])
    screen.unmount()
  })

  it('says when this server cannot fetch a link', async () => {
    server({ linkFetch: false })
    const screen = await renderSheet()
    dialog().querySelectorAll('.seg__opt')[1].click()
    await settle()
    expect(dialog().querySelector('input[type="url"]').disabled).toBe(true)
    expect(dialog().textContent).toContain(en.lyricsLinkOff)
    screen.unmount()
  })

  it('fetches a link through the analyser', async () => {
    server()
    const screen = await renderSheet()
    dialog().querySelectorAll('.seg__opt')[1].click()
    await settle()
    setValue(dialog().querySelector('input[type="url"]'), 'https://youtu.be/dQw4w9WgXcQ')
    await settle()
    dialog().querySelector('.btn-primary').click()
    await untilReview()
    const opened = apiJson.mock.calls.find(([url]) => url === '/api/video/session')
    expect(JSON.parse(opened[2].body)).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ' })
    expect(apiUpload).not.toHaveBeenCalled()
    screen.unmount()
  })

  it('keeps every line and says so when the sort had no model behind it', async () => {
    server({ sort: { sorted: false, reason: 'over_limit', kinds: ['sung', 'sung', 'sung', 'sung', 'sung'] } })
    const screen = await renderSheet()
    await choose(new File(['x'], 'song.srt', { type: 'text/plain' }))
    dialog().querySelector('.btn-primary').click()
    await untilReview()
    expect(dialog().textContent).toContain(en.lyricsSortSpent)
    expect([...dialog().querySelectorAll('.lyr-line input')].every(i => i.checked)).toBe(true)
    expect(dialog().querySelectorAll('.lyr-pile')).toHaveLength(1)
    screen.unmount()
  })

  it('words a refused file in the learner language and stays on the source', async () => {
    server()
    apiUpload.mockRejectedValue(Object.assign(new Error('x'), { code: 'not_utf8', status: 400 }))
    const screen = await renderSheet()
    await choose(new File(['x'], 'song.srt', { type: 'text/plain' }))
    dialog().querySelector('.btn-primary').click()
    await settle(120)
    expect(dialog().querySelector('[role="alert"]').textContent).toBe(en.subtitleNotUtf8)
    expect(dialog().querySelector('.seg')).not.toBeNull()
    screen.unmount()
  })
})
