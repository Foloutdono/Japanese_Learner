import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 歌 on the desk (plan 215) ────────────────────────────────
// The desk's head is the way back, the Passage's first line and keep;
// the song door stands between the line and keep, the two together at
// the head's end, the phone's pair (AnalyzerScreen.song.phone.test.jsx)
// at the desk's width.

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
        <AnalyzerScreen session={{}} />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(60)
  return screen
}

describe('the song door on the desk', () => {
  it('stands between the line and keep, and opens the sheet over the result', async () => {
    const screen = await renderScreen()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-card__open')).not.toBeNull())
    screen.container.querySelector('.anl-card__open').click()
    // The poll answers, then the result draws: waited for, not timed.
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-desk__head .anl-head__song')).not.toBeNull(), { timeout: 3000 })

    const head = screen.container.querySelector('.anl-desk__head')
    const title = head.querySelector('.anl-desk__title')
    const song = head.querySelector('.anl-head__song')
    const keep = head.querySelector('.anl-head__keep')
    expect(title.nextElementSibling).toBe(song)
    expect(song.nextElementSibling).toBe(keep)
    const t = title.getBoundingClientRect()
    const s = song.getBoundingClientRect()
    const k = keep.getBoundingClientRect()
    expect(t.right).toBeLessThanOrEqual(s.left)
    expect(s.right).toBeLessThan(k.left)
    expect(k.left - s.right).toBeLessThan(20)
    expect([Math.round(s.width), Math.round(s.height)]).toEqual([44, 44])

    song.click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] input.field')).not.toBeNull())
    expect(player.pause).toHaveBeenCalled()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog.querySelector('input.field').value).toBe('YOASOBI「夜に駆ける」')
    // The desk's sheet carries its own close.
    expect(dialog.querySelector('.desk-sheet__close')).not.toBeNull()
  })
})
