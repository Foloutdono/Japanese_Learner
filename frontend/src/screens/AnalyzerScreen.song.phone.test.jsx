import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 歌 on a phone (plan 215) ─────────────────────────────────
// A Passage of more than one line -- a video's track, or lyrics pasted
// or photographed -- carries a second round door beside 保存 on the
// result's head: the song sheet, which makes the song's deck. Both stand
// at the head's trailing end, the way back alone at its start, and one
// line, which is not a deck, has keep alone, as it had.

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
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn(), ensureDeck: vi.fn() }),
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

describe('the song door on a phone', () => {
  // Plan 219 (the owner's pick D): the head is about the whole Passage,
  // and the deck it can become is the head's trailing door, named, while
  // keep went down to the dock with the line's other tools.
  it('stands named at the head\'s end on a video\'s track, and opens the sheet', async () => {
    const screen = await renderScreen()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-row__open')).not.toBeNull())
    screen.container.querySelector('.anl-row__open').click()
    // The poll answers, then the result draws: waited for, not timed.
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__head .anl-m__song')).not.toBeNull(), { timeout: 3000 })

    const head = screen.container.querySelector('.anl-m__head')
    const song = head.querySelector('.anl-m__song')
    expect(head.querySelector('.anl-head__keep')).toBeNull()
    expect(screen.container.querySelector('.anl-m__dock .anl-head__keep')).not.toBeNull()
    expect(song.getAttribute('aria-haspopup')).toBe('dialog')
    expect(song.textContent).toBe('Deck')
    const h = head.getBoundingClientRect()
    const s = song.getBoundingClientRect()
    expect(Math.round(s.right)).toBe(Math.round(h.right))
    expect(s.height).toBeGreaterThanOrEqual(44 - 0.01)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)

    song.click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] input')).not.toBeNull())
    // The video stops for the sheet, which proposes the video's title.
    expect(player.pause).toHaveBeenCalled()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog.querySelector('input').value).toBe('YOASOBI「夜に駆ける」')
    // The sheet lands on its first half, not on the field: no keyboard
    // opens over a name already proposed.
    expect(document.activeElement).toBe(dialog.querySelector('.chip'))
    expect([...dialog.querySelectorAll('.chip .chip__n')].map(n => n.textContent)).toEqual(['3', '2'])
  })

  it('opens on pasted lyrics too, proposing their first line', async () => {
    const screen = await renderScreen()
    const field = screen.container.querySelector('textarea')
    const proto = Object.getPrototypeOf(field)
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, '夜が来る\n君を呼ぶ')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    screen.container.querySelector('.anl-action').click()

    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__head .anl-m__song')).not.toBeNull(), { timeout: 3000 })
    screen.container.querySelector('.anl-m__song').click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] input')).not.toBeNull())
    expect(document.querySelector('[role="dialog"] input').value).toBe('夜が来る')
  })

  it('leaves one line its keep alone', async () => {
    apiJson.mockImplementation(async url => (url === '/api/phrase/analyze'
      ? { sentences: [{ ...TRACK[0], cue_start: null, cue_end: null }], truncated: 0 }
      : {}))
    const screen = await renderScreen()
    const field = screen.container.querySelector('textarea')
    const proto = Object.getPrototypeOf(field)
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, '夜が来る')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    screen.container.querySelector('.anl-action').click()

    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__dock .anl-head__keep')).not.toBeNull(), { timeout: 3000 })
    expect(screen.container.querySelector('.anl-m__song')).toBeNull()
  })
})
