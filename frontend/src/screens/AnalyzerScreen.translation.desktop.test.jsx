import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 訳 on the desk (plan 235) ─────────────────────────────────
// On the desk a video's line is the subtitle on the sumi, and its
// translation stands under it there, a rung smaller than the line --
// the line is a heading on the slab, not display size as on the text
// desk -- holding its place while it comes, as on the phone.

const tok = (surface, start, reading, pos) => ({
  surface, start, end: start + surface.length, reading, pos, vocab_match: null, grammar: [],
})
const TRACK = [
  { text: '夜が来る', cue_start: 1, cue_end: 3, grammar: [], unknown_count: 1, available: true,
    tokens: [tok('夜', 0, 'よる', 'noun'), tok('が', 1, 'が', 'particle'), tok('来る', 2, 'くる', 'verb')] },
  { text: '君を呼ぶ', cue_start: 3, cue_end: 5, grammar: [], unknown_count: 0, available: true,
    tokens: [tok('君', 0, 'きみ', 'noun'), tok('を', 1, 'を', 'particle'), tok('呼ぶ', 2, 'よぶ', 'verb')] },
]
const SESSION = {
  status: 'ready', source: 'youtube', sourceRef: 'x', videoId: 'dQw4w9WgXcQ',
  windowCapped: false, truncated: 0, sentences: TRACK,
}
const ROW = { id: 7, sourceRef: 'x', source: 'youtube', createdAt: new Date().toISOString(), sentenceCount: 2, videoId: 'dQw4w9WgXcQ', firstLine: '夜が来る' }

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
vi.mock('../components/video/VideoPlayer', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  const handle = { play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(), currentTime: () => 0, title: () => '', channel: () => '' }
  return {
    VideoPlayer: forwardRef(function MockVideoPlayer(_p, ref) {
      useImperativeHandle(ref, () => handle)
      return <div className="video-player__frame" />
    }),
  }
})
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')

let release
beforeEach(() => {
  const held = new Promise(r => { release = () => r({ start: 0, lines: ['La nuit vient', null] }) })
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    if (url === '/api/video/session/7') return SESSION
    if (url === '/api/video/session/7/translations') return held
    return {}
  })
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => ({
    ok: true, status: 200, json: async () => (url === '/api/video/sessions' ? [ROW] : []),
  }))
})

describe('a video line\'s translation on the desk', () => {
  it('stands under the subtitle on the slab, a rung under the line', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/dictionary/analyzer']}>
          <AnalyzerScreen session={{}} />
        </MemoryRouter>
      </LangProvider>
    )
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-card__open')).not.toBeNull())
    screen.container.querySelector('.anl-card__open').click()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-slab .anl-subs__line')).not.toBeNull(), { timeout: 3000 })

    const slot = screen.container.querySelector('.anl-slab .anl-subs__tr')
    expect(slot).not.toBeNull()
    expect(slot.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(slot.getAttribute('aria-hidden')).toBe('true')
    const line = screen.container.querySelector('.anl-slab .anl-subs__line')
    // Measured once the slab has finished laying itself out.
    await new Promise(r => setTimeout(r, 400))
    const before = line.getBoundingClientRect().top
    const height = slot.getBoundingClientRect().height

    release()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-slab .anl-subs__tr').textContent).toBe('La nuit vient'))
    expect(screen.container.querySelector('.anl-slab .anl-subs__tr').getBoundingClientRect().height).toBeCloseTo(height, 1)
    expect(Math.abs(line.getBoundingClientRect().top - before)).toBeLessThan(1)
    const tr = parseFloat(getComputedStyle(screen.container.querySelector('.anl-slab .anl-subs__tr')).fontSize)
    const word = parseFloat(getComputedStyle(line.querySelector('.tok__word') ?? line.querySelector('.tok')).fontSize)
    expect(tr).toBeLessThan(word)
  })
})
