import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 表示 and 保存 on a phone (plans 215, 263) ─────────────────────
// The head's trailing door was 歌, the song's deck (plan 215); since
// plan 263 (the owner's picks B and K3·a of the canvas "Analyser stage
// -- reading options") it is Affichage, the sheet of the line's three
// helps, and the song's deck is made from the dock's Garder: the line
// in hand and its words go in the song's deck, or another one, and the
// whole song can be ticked in, a line a row.

const card = raw_id => ({ raw_id, level: 'N5', entry: {}, stats: { status: 'new' } })
const tok = (surface, start, reading, pos, vocab_match = null) => ({
  surface, start, end: start + surface.length, reading, pos, vocab_match, grammar: [],
})
const TRACK = [
  { text: '夜が来る', cue_start: 1, cue_end: 3, grammar: [], unknown_count: 1, available: true,
    tokens: [tok('夜', 0, 'よる', 'noun', card('vocab_N5_夜_よる')), tok('が', 1, 'が', 'particle'), tok('来る', 2, 'くる', 'verb', card('vocab_N5_来る_くる'))] },
  { text: '君を呼ぶ', cue_start: 3, cue_end: 5, grammar: [], unknown_count: 0, available: true,
    tokens: [tok('君', 0, 'きみ', 'noun', card('vocab_N5_君_きみ')), tok('を', 1, 'を', 'particle'), tok('呼ぶ', 2, 'よぶ', 'verb')] },
]
const SESSION = {
  status: 'ready', source: 'upload', sourceRef: 'x.srt', videoId: 'dQw4w9WgXcQ',
  windowCapped: false, truncated: 0, sentences: TRACK,
}
const ROW = { id: 7, sourceRef: 'x.srt', source: 'upload', createdAt: new Date().toISOString(), sentenceCount: 2, videoId: 'dQw4w9WgXcQ', firstLine: '夜が来る' }

const apiJson = vi.fn()
const apiFetch = vi.fn()
vi.mock('../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
  apiFetch: (...a) => apiFetch(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
// The learner's shelf, as each test sets it; a deck made is deck 9.
const shelf = { decks: [] }
const ensureDeck = vi.fn(async (_kind, name) => ({ id: 9, name, type: 'mixed' }))
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({
    decks: shelf.decks,
    decksFor: kind => shelf.decks.filter(d => d.type === 'mixed' || d.type === (kind === 'cloze' ? 'standard' : kind)),
    mineApp: vi.fn(),
    mineCloze: vi.fn(),
    ensureDeck,
  }),
}))
// The player, as the handle the screen reads: it pauses, and it knows
// the video's title.
vi.mock('../components/video/VideoPlayer', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  const handle = { play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(), currentTime: () => 0, title: () => 'YOASOBI「夜に駆ける」' }
  return {
    __handle: handle,
    VideoPlayer: forwardRef(function MockVideoPlayer(_p, ref) {
      useImperativeHandle(ref, () => handle)
      return <div className="video-player__frame" />
    }),
  }
})
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')
const { __handle: player } = await import('../components/video/VideoPlayer')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    if (url === '/api/video/session/7') return SESSION
    if (url === '/api/phrase/analyze') return { sentences: TRACK.map(s => ({ ...s, cue_start: null, cue_end: null })), truncated: 0 }
    return {}
  })
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => ({
    ok: true, status: 200, json: async () => (url === '/api/video/sessions' ? [ROW] : []),
  }))
  player.pause.mockReset()
  ensureDeck.mockClear()
  shelf.decks = []
  try { window.localStorage.removeItem('tsuji.anlDisplay') } catch { /* none kept */ }
})

async function renderScreen() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/dictionary/analyzer']}>
        <div className="phone">
          <div className="phone__content">
            <AnalyzerScreen session={{}} />
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(60)
  return screen
}

async function openTrack(screen) {
  await vi.waitFor(() => expect(screen.container.querySelector('.anl-row__open')).not.toBeNull())
  screen.container.querySelector('.anl-row__open').click()
  // The poll answers, then the result draws: waited for, not timed.
  await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__head .anl-m__show')).not.toBeNull(), { timeout: 3000 })
}

async function pasteLyrics(screen, text) {
  const field = screen.container.querySelector('textarea')
  const proto = Object.getPrototypeOf(field)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, text)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  screen.container.querySelector('.anl-action').click()
  await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__dock .anl-head__keep')).not.toBeNull(), { timeout: 3000 })
}

async function openKeep(screen) {
  screen.container.querySelector('.anl-m__dock .anl-head__keep').click()
  await vi.waitFor(() => expect(document.querySelector('.anl-keepsheet .anl-keepsheet__deck')).not.toBeNull())
  return document.querySelector('.anl-keepsheet')
}

const buttonNamed = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const optionNamed = (root, text) => [...root.querySelectorAll('[role="radio"]')].find(b => b.textContent.trim() === text)

describe('the Affichage door on a phone', () => {
  it('stands named at the head\'s end, where 歌 stood, and opens the sheet', async () => {
    const screen = await renderScreen()
    await openTrack(screen)

    const head = screen.container.querySelector('.anl-m__head')
    const door = head.querySelector('.anl-m__show')
    expect(head.querySelector('.anl-m__song, .anl-head__keep')).toBeNull()
    expect(door.getAttribute('aria-haspopup')).toBe('dialog')
    expect(door.textContent).toBe('Affichage')
    const h = head.getBoundingClientRect()
    const d = door.getBoundingClientRect()
    expect(Math.round(d.right)).toBe(Math.round(h.right))
    expect(d.height).toBeGreaterThanOrEqual(44 - 0.01)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)

    door.click()
    await vi.waitFor(() => expect(document.querySelector('.anl-show')).not.toBeNull())
    const sheet = document.querySelector('.anl-show')
    expect([...sheet.querySelectorAll('[role="radiogroup"]')].map(g => g.getAttribute('aria-label')))
      .toEqual(['Furigana', 'Rōmaji', 'Traduction'])
    // The defaults: readings where the SRS says they are needed, no
    // rōmaji, the translation.
    expect([...sheet.querySelectorAll('[aria-checked="true"]')].map(o => o.textContent)).toEqual(['Inconnus', 'Masqués', 'Affichée'])
    for (const option of sheet.querySelectorAll('[role="radio"]')) {
      expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(44 - 0.01)
    }
  })

  it('writes the rōmaji under the words, and the readings over all or none', async () => {
    const screen = await renderScreen()
    await openTrack(screen)
    const subs = () => screen.container.querySelector('.anl-m__subs')
    expect(subs().querySelector('.tok__ro')).toBeNull()

    screen.container.querySelector('.anl-m__show').click()
    await vi.waitFor(() => expect(document.querySelector('.anl-show')).not.toBeNull())
    const sheet = document.querySelector('.anl-show')
    optionNamed(sheet.querySelectorAll('[role="radiogroup"]')[1], 'Affichés').click()
    await settle(30)
    // Each word by its reading, a particle by its sound, under its rule.
    expect([...subs().querySelectorAll('.tok__ro')].map(r => r.textContent)).toEqual(['yoru', 'ga', 'kuru'])
    expect(subs().hasAttribute('data-romaji')).toBe(true)

    optionNamed(sheet.querySelectorAll('[role="radiogroup"]')[0], 'Aucun').click()
    await settle(30)
    expect(subs().getAttribute('data-furigana')).toBe('none')
    // The rōmaji is painted, under the word's rule, not clipped away.
    const ro = subs().querySelector('.tok__ro').getBoundingClientRect()
    const word = subs().querySelector('.tok').getBoundingClientRect()
    expect(ro.height).toBeGreaterThan(0)
    expect(ro.top).toBeGreaterThanOrEqual(word.bottom - 1)

    // Remembered by this browser for the next Passage.
    expect(JSON.parse(window.localStorage.getItem('tsuji.anlDisplay'))).toEqual({ furigana: 'none', romaji: true, translation: true })
  })

  it('keeps both of two changes made in one frame', async () => {
    const screen = await renderScreen()
    await openTrack(screen)
    screen.container.querySelector('.anl-m__show').click()
    await vi.waitFor(() => expect(document.querySelector('.anl-show')).not.toBeNull())
    const groups = document.querySelectorAll('.anl-show [role="radiogroup"]')
    // No wait between them: the second must not undo the first.
    optionNamed(groups[1], 'Affichés').click()
    optionNamed(groups[0], 'Tous').click()
    await settle(30)
    const subs = screen.container.querySelector('.anl-m__subs')
    expect(subs.getAttribute('data-furigana')).toBe('all')
    expect(subs.hasAttribute('data-romaji')).toBe(true)
  })
})

describe('Garder on a phone: the line into a deck', () => {
  it('rises as a sheet the width of the screen', async () => {
    const screen = await renderScreen()
    await openTrack(screen)
    const sheet = await openKeep(screen)
    const box = sheet.getBoundingClientRect()
    // Edge to edge, as every sheet is (it once took the desk rail's 28px
    // pin's size, sharing its class name).
    expect(box.left).toBe(0)
    expect(box.width).toBeGreaterThan(window.innerWidth * 0.9)
    expect(box.height).toBeGreaterThan(200)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1)
  })

  it('proposes the song\'s own deck, named after the video, and fills it', async () => {
    const screen = await renderScreen()
    await openTrack(screen)
    const sheet = await openKeep(screen)
    // The video stops for the sheet.
    expect(player.pause).toHaveBeenCalled()

    const deck = sheet.querySelector('.anl-keepsheet__deck')
    expect(deck.querySelector('b').textContent).toBe('YOASOBI「夜に駆ける」')
    expect(deck.querySelector('small').textContent).toBe('Nouveau deck · cette chanson')
    expect(sheet.querySelector('.anl-keepsheet__line').textContent).toBe('夜が来るよるがくる')
    expect([...sheet.querySelectorAll('.anl-keepsheet__chip b')].map(b => b.textContent)).toEqual(['夜', '来る'])
    const go = sheet.querySelector('.anl-keepsheet__go')
    expect(go.textContent).toBe('Garder · 3 cartes')

    go.click()
    await vi.waitFor(() => expect(document.querySelector('.anl-keepsheet a.anl-song__deck')).not.toBeNull())
    expect(ensureDeck).toHaveBeenCalledWith('mixed', 'YOASOBI「夜に駆ける」', { remember: false })
    const posted = url => apiJson.mock.calls.filter(([u]) => u === url).map(([, , opts]) => JSON.parse(opts.body))
    expect(posted('/api/decks/9/cards/app')).toEqual([{ cards: [
      { source: 'vocab', level: 'N5', raw_id: 'vocab_N5_夜_よる' },
      { source: 'vocab', level: 'N5', raw_id: 'vocab_N5_来る_くる' },
    ] }])
    expect(posted('/api/decks/9/cards/batch')).toEqual([{ cards: [{ front: '夜が来る', back: 'よるがくる', notes: '' }] }])
    // The line in hand is pinned as the old button pinned it.
    expect(posted('/api/phrase/keep').map(b => b.sentence)).toEqual(['夜が来る'])
    expect(document.querySelector('.anl-keepsheet a.anl-song__deck').getAttribute('href')).toBe('/learn/decks/9')
  })

  it('takes more lines of the song, a line a row', async () => {
    const screen = await renderScreen()
    await openTrack(screen)
    const sheet = await openKeep(screen)

    const more = sheet.querySelector('.anl-keepsheet__more')
    expect(more.textContent).toBe('Choisir d’autres lignes · 2')
    more.click()
    await vi.waitFor(() => expect(sheet.querySelector('.anl-keepsheet__list')).not.toBeNull())
    const rows = [...sheet.querySelectorAll('.anl-keepsheet__row')]
    expect(rows.map(r => r.querySelector('.anl-keepsheet__text').textContent)).toEqual(['夜が来る', '君を呼ぶ'])
    // The line in hand is on the rail, ticked.
    expect(rows[0].classList.contains('anl-keepsheet__row--here')).toBe(true)
    expect(rows[0].querySelector('input').checked).toBe(true)
    rows[1].querySelector('input').click()
    await settle(20)
    buttonNamed(sheet, 'Valider · 2 lignes').click()
    await vi.waitFor(() => expect(sheet.querySelector('.anl-keepsheet__deck')).not.toBeNull())

    expect(sheet.querySelector('.anl-keepsheet__tick span').textContent).toBe('Les lignes · 2')
    expect([...sheet.querySelectorAll('.anl-keepsheet__chip b')].map(b => b.textContent)).toEqual(['夜', '来る', '君'])
    expect(sheet.querySelector('.anl-keepsheet__go').textContent).toBe('Garder · 5 cartes')
  })

  it('goes in another deck, taking only what that deck can hold', async () => {
    shelf.decks = [
      { id: 4, name: 'Mots de chansons', type: 'vocab', card_count: 12, role: 'owner' },
      { id: 5, name: 'Paroles', type: 'standard', card_count: 3, role: 'owner' },
      { id: 6, name: 'Suivi', type: 'mixed', card_count: 40, role: 'follower' },
    ]
    const screen = await renderScreen()
    await openTrack(screen)
    const sheet = await openKeep(screen)

    sheet.querySelector('.anl-keepsheet__deck').click()
    await vi.waitFor(() => expect(sheet.querySelector('.anl-keepsheet__decks')).not.toBeNull())
    // The song's deck first; a deck followed from the library is not
    // the learner's to fill.
    expect([...sheet.querySelectorAll('.anl-keepsheet__opt b')].map(b => b.textContent))
      .toEqual(['YOASOBI「夜に駆ける」', 'Mots de chansons', 'Paroles'])
    sheet.querySelectorAll('.anl-keepsheet__opt input')[1].click()
    await settle(20)
    buttonNamed(sheet, 'Garder dans Mots de chansons').click()
    await vi.waitFor(() => expect(sheet.querySelector('.anl-keepsheet__deck')).not.toBeNull())

    expect(sheet.querySelector('.anl-keepsheet__deck b').textContent).toBe('Mots de chansons')
    // A vocab deck takes the words, not the line.
    expect(sheet.querySelector('.anl-keepsheet__note').textContent).toBe('Ce deck ne prend que des mots.')
    expect(sheet.querySelector('.anl-keepsheet__tick input').disabled).toBe(true)
    sheet.querySelector('.anl-keepsheet__go').click()
    await vi.waitFor(() => expect(document.querySelector('.anl-keepsheet a.anl-song__deck')).not.toBeNull())
    expect(ensureDeck).not.toHaveBeenCalled()
    expect(apiJson.mock.calls.some(([u]) => u === '/api/decks/4/cards/app')).toBe(true)
    expect(apiJson.mock.calls.some(([u]) => u === '/api/decks/4/cards/batch')).toBe(false)
  })

  it('names the deck after the first line of pasted lyrics', async () => {
    const screen = await renderScreen()
    await pasteLyrics(screen, '夜が来る\n君を呼ぶ')
    const sheet = await openKeep(screen)
    expect(sheet.querySelector('.anl-keepsheet__deck b').textContent).toBe('夜が来る')
  })

  it('leaves one line no lines to pick, and its deck no song', async () => {
    apiJson.mockImplementation(async url => (url === '/api/phrase/analyze'
      ? { sentences: [{ ...TRACK[0], cue_start: null, cue_end: null }], truncated: 0 }
      : {}))
    const screen = await renderScreen()
    await pasteLyrics(screen, '夜が来る')
    const sheet = await openKeep(screen)
    expect(sheet.querySelector('.anl-keepsheet__more')).toBeNull()
    expect(sheet.querySelector('.anl-keepsheet__deck small').textContent).toBe('Nouveau deck')
  })
})
