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
// What a step leads to, once it is there: the poll's answer lands when
// it lands, and a fixed wait raced it.
async function until(find, ms = 3000) {
  const end = Date.now() + ms
  let found = find()
  while (!found && Date.now() < end) {
    await settle(30)
    found = find()
  }
  return found
}

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

function setField(el, text) {
  const proto = Object.getPrototypeOf(el)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
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

    const video = await until(() => screen.container.querySelector('video.video-player__media'))
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

describe('AnalyzerScreen — a podcast, heard (the owner’s picks B and C)', () => {
  const FEED_URL = 'https://feeds.example.jp/yukkuri.xml'
  const FEED = {
    title: 'ゆっくり日本語', image: 'https://cdn.example.jp/show.jpg',
    episodes: [{ title: '第48回 京都の秋', published: '2026-10-14', duration: 1184, audioUrl: 'https://cdn.example.jp/48.mp3', image: null }],
  }

  it('picks an episode at the Podcast door and shows its picture, its podcast and how it was heard', async () => {
    answer([
      ['/api/video/capabilities', CAPS],
      ['/api/video/podcasts', []],
      ['/api/video/podcast?', FEED],
      ['/api/video/session/11', ready({
        source: 'podcast', sourceRef: '第48回 京都の秋', mediaUrl: 'https://cdn.example.jp/48.mp3',
        mediaTitle: '第48回 京都の秋', feedTitle: 'ゆっくり日本語', mediaImage: 'https://cdn.example.jp/show.jpg',
      })],
    ])
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn((input, init) => (String(input).startsWith('https://cdn.example.jp/48.mp3')
      ? Promise.resolve(new Response(new Blob(['ID3'], { type: 'audio/mpeg' })))
      : realFetch(input, init))))
    recordingFor.mockResolvedValue({ blob: new Blob(['mp3'], { type: 'audio/mpeg' }), seconds: 9, offset: 0 })
    apiUpload.mockResolvedValue({ sessionId: 11, status: 'generating' })
    try {
      const screen = await renderScreen()
      await goToVideo(screen)
      const door = [...screen.container.querySelectorAll('.anl-doors .seg__opt')].at(-1)
      door.click()
      await settle(60)
      const field = screen.container.querySelector('.anl-pod').previousElementSibling.querySelector('input')
      setField(field, FEED_URL)
      await settle(30)
      screen.container.querySelector('.anl-pod .btn-primary').click()
      await settle(120)
      screen.container.querySelector('.anl-pod__ep').click()
      const frame = await until(() => screen.container.querySelector('.video-player__frame--cover'))

      const [path, , form] = apiUpload.mock.calls[0]
      expect(path).toBe('/api/video/recording')
      expect(sent(form)).toMatchObject({
        source: 'podcast', media_url: 'https://cdn.example.jp/48.mp3', media_title: '第48回 京都の秋',
        feed_url: FEED_URL, feed_title: 'ゆっくり日本語', media_image: 'https://cdn.example.jp/show.jpg',
      })
      expect(frame).not.toBeNull()
      expect(frame.querySelector('img.video-player__art').getAttribute('src')).toBe('https://cdn.example.jp/show.jpg')
      expect(frame.textContent).toContain('ゆっくり日本語')
      expect(frame.textContent.includes(en.heardBy) || frame.textContent.includes(fr.heardBy)).toBe(true)
      expect(frame.querySelector('video').hasAttribute('controls')).toBe(false)
      // Said in the frame, not again on a line of its own.
      const said = screen.container.textContent
      expect(said.includes(en.heardNotice) || said.includes(fr.heardNotice)).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('opens the Podcast door with a feed pasted where Japanese goes', async () => {
    answer([['/api/video/capabilities', CAPS], ['/api/video/podcasts', []]])
    const screen = await renderScreen()
    const line = screen.container.querySelector('textarea')
    setField(line, FEED_URL)
    await settle(80)
    const on = screen.container.querySelector('.anl-doors .seg__opt--on')
    expect(on?.textContent === en.doorPodcast || on?.textContent === fr.doorPodcast).toBe(true)
    expect(screen.container.querySelector('.anl-pod').previousElementSibling.querySelector('input').value).toBe(FEED_URL)
  })
})

describe('AnalyzerScreen — while a recording is heard (the owner’s pick B)', () => {
  it('draws its steps, and calls it off before the sound is sent', async () => {
    answer([['/api/video/capabilities', CAPS]])
    recordingFor.mockImplementation((file, { onProgress, signal }) => {
      onProgress({ stage: 'decode' })
      onProgress({ stage: 'encode', ratio: 0.42, seconds: 1184 })
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    const screen = await renderScreen()
    await goToVideo(screen)
    chooseFile(screen, new File(['x'], '京都の秋.mp3', { type: 'audio/mpeg' }))
    await settle(120)

    const card = screen.container.querySelector('.anl-hear')
    expect(card).not.toBeNull()
    expect(card.querySelector('.anl-hear__title').textContent).toBe('京都の秋.mp3')
    expect(card.querySelector('.anl-hear__meta').textContent).toMatch(/^19:44 · /)
    const steps = [...card.querySelectorAll('.anl-hear__step')].map(li => li.className.split('--').pop())
    expect(steps).toEqual(['done', 'now', 'next', 'next'])
    expect(card.textContent.includes(en.hearPercent(42)) || card.textContent.includes(fr.hearPercent(42))).toBe(true)

    card.querySelector('.anl-hear__cancel').click()
    await settle(60)
    expect(screen.container.querySelector('.anl-hear')).toBeNull()
    expect(apiUpload).not.toHaveBeenCalled()
    expect(screen.container.querySelector('.anl-notice-line--bad')).toBeNull()
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
    const video = await until(() => screen.container.querySelector('video.video-player__media'))
    expect(video?.getAttribute('src')).toBe('https://cdn.example.jp/news.mp4')
    expect(screen.container.querySelector('[data-testid="youtube"]')).toBeNull()
  })
})
