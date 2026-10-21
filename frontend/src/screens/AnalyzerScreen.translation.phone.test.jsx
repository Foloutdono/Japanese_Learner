import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 訳 on a phone (plan 235) ──────────────────────────────────
// Every line of a video carries its translation under it, asked a block
// of lines at a time (components/analysis/useLineTranslations.js), with
// the video's title and channel the player knows; the line holds the
// translation's place while it comes, so it does not move when it
// lands. Explain is asked with the same title and channel, the server
// adding the line's place and its neighbours.

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
  const handle = {
    play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(), currentTime: () => 0,
    title: () => 'YOASOBI「夜に駆ける」', channel: () => 'Ayase / YOASOBI',
  }
  return {
    VideoPlayer: forwardRef(function MockVideoPlayer(_p, ref) {
      useImperativeHandle(ref, () => handle)
      return <div className="video-player__frame" />
    }),
  }
})
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// The translations' answer, held until a test lets it go.
let release
function serve({ translations = { start: 0, lines: ['La nuit vient', 'Je t’appelle'] } } = {}) {
  apiJson.mockReset()
  const held = new Promise(r => { release = () => r(translations) })
  apiJson.mockImplementation(async (url, _session, opts) => {
    if (url === '/api/video/session/7') return SESSION
    if (url === '/api/video/session/7/translations') return held
    if (url === '/api/video/session/7/sentence/0/explain') {
      return { ...TRACK[0], explanation: 'La nuit arrive.', translation: 'Vient la nuit' }
    }
    if (url === '/api/phrase/analyze') return { sentences: TRACK.map(s => ({ ...s, cue_start: null })), truncated: 0, opts }
    return {}
  })
}

beforeEach(() => {
  serve()
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => ({
    ok: true, status: 200, json: async () => (url === '/api/video/sessions' ? [ROW] : []),
  }))
})

async function openVideo() {
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
  await vi.waitFor(() => expect(screen.container.querySelector('.anl-row__open')).not.toBeNull())
  screen.container.querySelector('.anl-row__open').click()
  await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__subs .anl-subs__line')).not.toBeNull(), { timeout: 3000 })
  await settle(60)
  return screen
}

const calls = url => apiJson.mock.calls.filter(([u]) => u === url)

describe('a video line\'s translation on a phone', () => {
  it('is asked for the block the line in focus falls in', async () => {
    await openVideo()
    const [[, , opts]] = calls('/api/video/session/7/translations')
    // The title and channel go when the player knows them, which on
    // the first block it may not yet: strings either way.
    expect(JSON.parse(opts.body)).toMatchObject({ lang: 'fr', index: 0 })
    expect(typeof JSON.parse(opts.body).title).toBe('string')
  })

  it('stands under the line, which holds its place while it comes', async () => {
    const screen = await openVideo()
    const line = () => screen.container.querySelector('.anl-m__subs .anl-subs__line')
    const slot = screen.container.querySelector('.anl-m__tr')
    expect(slot).not.toBeNull()
    expect(slot.textContent.trim()).toBe('')
    expect(slot.getAttribute('aria-hidden')).toBe('true')
    expect(slot.getBoundingClientRect().height).toBeGreaterThan(0)
    // Measured once the stage has finished laying itself out.
    await settle(400)
    const before = line().getBoundingClientRect().top
    const height = slot.getBoundingClientRect().height

    release()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__tr').textContent).toBe('La nuit vient'))
    expect(screen.container.querySelector('.anl-m__tr').getBoundingClientRect().height).toBeCloseTo(height, 1)
    expect(Math.abs(line().getBoundingClientRect().top - before)).toBeLessThan(1)
    expect(screen.container.querySelector('.anl-m__tr').compareDocumentPosition(line()) & Node.DOCUMENT_POSITION_PRECEDING)
      .toBeTruthy()
  })

  it('follows the line in focus, from the block already in hand', async () => {
    const screen = await openVideo()
    release()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__tr').textContent).toBe('La nuit vient'))
    screen.container.querySelector('.anl-m__dock button[aria-label="Phrase suivante"]').click()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__tr').textContent).toBe('Je t’appelle'))
    // One block, asked once.
    expect(calls('/api/video/session/7/translations')).toHaveLength(1)
  })

  it('leaves the line readable when the translations cannot come', async () => {
    serve()
    apiJson.mockImplementation(async url => {
      if (url === '/api/video/session/7') return SESSION
      if (url === '/api/video/session/7/translations') throw Object.assign(new Error('limit'), { status: 429 })
      return {}
    })
    const screen = await openVideo()
    await settle(100)
    expect(screen.container.querySelector('.anl-m__subs .anl-subs__line')).not.toBeNull()
    expect(screen.container.querySelector('.anl-m__tr').textContent.trim()).toBe('')
    expect(screen.container.querySelector('[role="alert"]')).toBeNull()
    // A refusal is an answer: the block is not asked again at every line.
    screen.container.querySelector('.anl-m__dock button[aria-label="Phrase suivante"]').click()
    await settle(100)
    expect(calls('/api/video/session/7/translations')).toHaveLength(1)
  })

  // A request the link dropped got no answer at all: the block is asked
  // again at the next line, rather than left untranslated for good.
  it('asks a block again when its request got no answer', async () => {
    let drops = 1
    apiJson.mockImplementation(async url => {
      if (url === '/api/video/session/7') return SESSION
      if (url === '/api/video/session/7/translations') {
        if (drops > 0) {
          drops -= 1
          throw new TypeError('Failed to fetch')
        }
        return { start: 0, lines: ['La nuit vient', 'Je t’appelle'] }
      }
      return {}
    })
    const screen = await openVideo()
    expect(calls('/api/video/session/7/translations')).toHaveLength(1)
    screen.container.querySelector('.anl-m__dock button[aria-label="Phrase suivante"]').click()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__tr').textContent).toBe('Je t’appelle'))
    expect(calls('/api/video/session/7/translations')).toHaveLength(2)
  })

  it('is what the explanation\'s sheet quotes, and Explain is told the video too', async () => {
    const screen = await openVideo()
    release()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__tr').textContent).toBe('La nuit vient'))
    screen.container.querySelector('.anl-m__explain').click()

    await vi.waitFor(() => expect(document.querySelector('.anl-explainsheet__tr')).not.toBeNull())
    expect(document.querySelector('.anl-explainsheet__tr').textContent).toBe('« La nuit vient »')
    const [[, , opts]] = calls('/api/video/session/7/sentence/0/explain')
    expect(JSON.parse(opts.body)).toEqual({
      lang: 'fr', title: 'YOASOBI「夜に駆ける」', channel: 'Ayase / YOASOBI',
    })
  })
})

describe('a typed Passage on a phone', () => {
  async function typeAndAnalyze() {
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
    const field = screen.container.querySelector('textarea')
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, '夜が来る\n君を呼ぶ')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    screen.container.querySelector('.anl-action').click()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__subs .anl-subs__line')).not.toBeNull(), { timeout: 3000 })
    await settle(60)
    return screen
  }

  // Saved as history row 5, it is translated and explained by that row.
  function serveTyped({ id = 5 } = {}) {
    apiJson.mockReset()
    apiJson.mockImplementation(async url => {
      if (url === '/api/phrase/analyze') return { sentences: TRACK.map(s => ({ ...s, cue_start: null })), truncated: 0, id }
      if (url === '/api/phrase/history/5/translations') return { start: 0, lines: ['La nuit vient', 'Je t’appelle'] }
      if (url === '/api/phrase/history/5/sentence/0/explain') {
        return { ...TRACK[0], cue_start: null, explanation: 'La nuit arrive.' }
      }
      return {}
    })
  }

  it('asks to be held to the line width, and translates each sentence by its history row', async () => {
    serveTyped()
    const screen = await typeAndAnalyze()
    const [[, , analyze]] = calls('/api/phrase/analyze')
    expect(JSON.parse(analyze.body)).toMatchObject({ lines: true })
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__tr').textContent).toBe('La nuit vient'))
    const [[, , opts]] = calls('/api/phrase/history/5/translations')
    expect(JSON.parse(opts.body)).toMatchObject({ lang: 'fr', index: 0 })
    screen.container.querySelector('.anl-m__dock button[aria-label="Phrase suivante"]').click()
    await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__tr').textContent).toBe('Je t’appelle'))
  })

  it('explains a sentence by its history row, which knows its neighbours', async () => {
    serveTyped()
    const screen = await typeAndAnalyze()
    screen.container.querySelector('.anl-m__explain').click()
    await vi.waitFor(() => expect(document.querySelector('.anl-explainpanel__body')?.textContent).toBe('La nuit arrive.'))
    const [[, , opts]] = calls('/api/phrase/history/5/sentence/0/explain')
    expect(JSON.parse(opts.body)).toEqual({ lang: 'fr' })
    expect(calls('/api/phrase/analyze')).toHaveLength(1)
  })

  it('asks for no translations when it was saved nowhere: its own is the one Explain buys', async () => {
    serveTyped({ id: null })
    const screen = await typeAndAnalyze()
    await settle(100)
    expect(apiJson.mock.calls.some(([u]) => u.endsWith('/translations'))).toBe(false)
    expect(screen.container.querySelector('.anl-m__tr')).toBeNull()
  })
})
