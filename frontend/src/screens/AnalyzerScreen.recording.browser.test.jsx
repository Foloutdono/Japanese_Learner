import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import en from '../locales/en/index.js'
import fr from '../locales/fr/index.js'
import { encodePagePayload } from '../lib/captionGrab'

// ── Recordings and pages (plan 265) ───────────────────────────────
// Two new ways into the video platform, pinned end to end on the
// screen: a recording the learner holds is kept, encoded and sent to
// /api/video/recording, and the Passage it becomes plays the file
// itself beside its lines; a page grab (p1) arrives with its Japanese
// track and its media file, and the Passage plays that address. The
// encoding is lib/mediaAudio's (its own tests); here it is stood in for.
const apiJson = vi.fn()
const apiUpload = vi.fn()
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))
const recordingFor = vi.fn()

vi.mock('../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
  apiUpload: (...a) => apiUpload(...a),
  apiFetch: (...a) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/mediaAudio', () => ({ recordingFor: (...a) => recordingFor(...a) }))
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))
vi.mock('../components/video/VideoPlayer', async () => {
  const { forwardRef } = await import('react')
  return { VideoPlayer: forwardRef(function MockVideoPlayer() { return <div data-testid="youtube" /> }) }
})

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')

const settle = async (ms = 60) => new Promise(r => setTimeout(r, ms))

async function renderScreen() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/dictionary/analyzer']}>
        <AnalyzerScreen session={{}} />
      </MemoryRouter>
    </LangProvider>,
  )
  await settle(30)
  return screen
}

async function goToVideo(screen) {
  screen.container.querySelectorAll('.anl-sources .seg__opt')[2].click()
  await settle(30)
}

function chooseFile(screen, file) {
  const input = screen.container.querySelector('input[type="file"]')
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const CAPS = { linkFetch: false, transcribe: true, transcribeMaxSeconds: 1800, transcribeMinutesLeft: 60 }

function ready(extra) {
  return {
    status: 'ready', windowCapped: false, truncated: 0, videoId: null,
    sentences: [
      { text: '今日は暑いですね', cue_start: 0.5, cue_end: 3, grammar: [], unknown_count: 0, available: true, tokens: [{ surface: '今日は暑いですね', pos: 'noun' }] },
      { text: 'そうですね', cue_start: 6, cue_end: 9, grammar: [], unknown_count: 0, available: true, tokens: [{ surface: 'そうですね', pos: 'noun' }] },
    ],
    ...extra,
  }
}

function answer(routes) {
  apiJson.mockImplementation(async path => {
    for (const [prefix, body] of routes) if (path.startsWith(prefix)) return body
    return {}
  })
}

const sent = form => Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : v.name]))

beforeEach(async () => {
  await page.viewport(1280, 900)
  apiJson.mockReset()
  apiUpload.mockReset()
  recordingFor.mockReset()
  window.localStorage.setItem('jp-lang', 'en')
})

describe('AnalyzerScreen — a recording, heard', () => {
  it('sends the kept sound and plays the file itself beside its lines', async () => {
    answer([['/api/video/capabilities', CAPS], ['/api/video/session/9', ready({ source: 'media', sourceRef: 'clip.mp4', mediaUrl: null })]])
    recordingFor.mockResolvedValue({ blob: new Blob(['mp3'], { type: 'audio/mpeg' }), seconds: 9, offset: 0 })
    apiUpload.mockResolvedValue({ sessionId: 9, status: 'generating' })

    const screen = await renderScreen()
    await goToVideo(screen)
    const file = new File(['film'], 'clip.mp4', { type: 'video/mp4' })
    chooseFile(screen, file)
    await settle(200)

    expect(recordingFor).toHaveBeenCalledTimes(1)
    expect(recordingFor.mock.calls[0][0]).toBe(file)
    expect(recordingFor.mock.calls[0][1]).toMatchObject({ maxSeconds: 1800, minutesLeft: 60 })
    const [path, , form] = apiUpload.mock.calls[0]
    expect(path).toBe('/api/video/recording')
    expect(sent(form)).toMatchObject({ audio: 'audio.mp3', source: 'media', name: 'clip.mp4', start: '0' })

    const video = screen.container.querySelector('video.video-player__media')
    expect(video).not.toBeNull()
    expect(video.src.startsWith('blob:')).toBe(true)
    const said = screen.container.textContent
    expect(said.includes(en.heardNotice) || said.includes(fr.heardNotice)).toBe(true)
  })

  it('takes no recording where the server cannot hear one, and says so', async () => {
    answer([['/api/video/capabilities', { ...CAPS, transcribe: false }]])
    const screen = await renderScreen()
    await goToVideo(screen)
    chooseFile(screen, new File(['film'], 'clip.mp4', { type: 'video/mp4' }))
    await settle(100)
    expect(recordingFor).not.toHaveBeenCalled()
    expect(apiUpload).not.toHaveBeenCalled()
    const said = screen.container.textContent
    expect(said.includes(en.mediaNotHere) || said.includes(fr.mediaNotHere)).toBe(true)
  })
})

describe('AnalyzerScreen — a page grab', () => {
  it('arrives with the page’s track and plays the page’s media file', async () => {
    const vtt = 'WEBVTT\n\n00:00:00.500 --> 00:00:03.000\n今日は暑いですね\n'
    window.location.hash = `#grab=${await encodePagePayload('www.example.jp', { vtt, mediaUrl: 'https://cdn.example.jp/news.mp4', title: 'ニュース' })}`
    answer([['/api/video/capabilities', CAPS], ['/api/video/session/10', ready({
      source: 'upload', sourceRef: 'www.example.jp.ja.vtt', mediaUrl: 'https://cdn.example.jp/news.mp4', mediaTitle: 'ニュース',
    })]])
    apiUpload.mockResolvedValue({ sessionId: 10, status: 'generating' })

    const screen = await renderScreen()
    await settle(250)

    const [path, , form] = apiUpload.mock.calls[0]
    expect(path).toBe('/api/video/session')
    expect(sent(form)).toMatchObject({
      file: 'www.example.jp.ja.vtt', media_url: 'https://cdn.example.jp/news.mp4', media_title: 'ニュース',
    })
    expect(window.location.hash).toBe('')
    const video = screen.container.querySelector('video.video-player__media')
    expect(video?.getAttribute('src')).toBe('https://cdn.example.jp/news.mp4')
    expect(screen.container.querySelector('[data-testid="youtube"]')).toBeNull()
  })
})
