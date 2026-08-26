import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// The bug this pins, in one sentence: "still generating" arrives as HTTP
// 202, which is a SUCCESS status, so apiJson RESOLVES rather than
// throwing -- and the poll's `catch (e) { if (e.status === 202) ... }`
// was therefore dead code.
//
// The happy path ran on a 202 instead: setSentences(undefined) landed,
// setStage('ready') followed, and the next render threw
// "Cannot read properties of undefined (reading '0')" on
// sentences[activeIndex] -- a white screen.
//
// It never reproduced on a subtitle UPLOAD, because that worker finishes
// in milliseconds and the first poll is already 200. It reproduced every
// time on a YouTube URL, where the fetch takes seconds. That asymmetry is
// exactly why it survived the test suite and reached production.
const apiJson = vi.fn()
const apiUpload = vi.fn()

vi.mock('../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
  apiUpload: (...a) => apiUpload(...a),
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

// Spread the real module: other names (buildCloze, ...) are pulled out
// of it elsewhere in this import graph, and a bare factory breaks them.
// Same trap as lib/audio in ExamResult.generating.browser.test.jsx.
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))

// The player pulls in the YouTube IFrame API over the network.
vi.mock('../components/video/VideoPlayer', () => ({
  VideoPlayer: () => <div data-testid="player" />,
}))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: VideoScreen } = await import('./VideoScreen')

function renderScreen() {
  return render(
    <LangProvider>
      <MemoryRouter>
        <VideoScreen session={{}} />
      </MemoryRouter>
    </LangProvider>
  )
}

async function startFromUrl(screen) {
  const input = screen.container.querySelector('input[type="text"]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'https://youtu.be/AAAAAAAAAAA')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  const load = [...screen.container.querySelectorAll('button')]
    .find(b => b.className.includes('phrase-analyze-btn'))
  load.click()
}

const settle = async (ms = 60) => new Promise(r => setTimeout(r, ms))

beforeEach(() => {
  apiJson.mockReset()
  apiUpload.mockReset()
})

describe('VideoScreen polling', () => {
  it('does not crash while the session is still generating (HTTP 202)', async () => {
    // POST -> 202 with a session id, then a GET that resolves with the
    // 202 payload: no `sentences` key at all.
    apiJson
      .mockResolvedValueOnce({ sessionId: 1, status: 'generating' })
      .mockResolvedValue({ status: 'generating' })

    const screen = await renderScreen()
    await startFromUrl(screen)
    await settle(120)

    // Before the fix this threw during render and React unmounted the
    // tree, leaving an empty container.
    expect(screen.container.querySelector('main')).not.toBeNull()
    // And it must still be waiting, not claiming to be ready.
    expect(screen.container.querySelector('.video-transcript-label')).toBeNull()
  })

  it('renders the transcript once real sentences arrive', async () => {
    apiJson
      .mockResolvedValueOnce({ sessionId: 1, status: 'generating' })
      .mockResolvedValueOnce({ status: 'generating' })
      .mockResolvedValue({
        status: 'ready', source: 'upload', sourceRef: 'x.srt',
        windowCapped: false, truncated: 0,
        sentences: [{
          text: '猫が好き', cue_start: 0, cue_end: 2, tokens: [], grammar: [],
          unknown_count: 0, available: true,
        }],
      })

    const screen = await renderScreen()
    await startFromUrl(screen)
    await settle(2000)

    expect(screen.container.textContent).toContain('猫が好き')
  })

  it('shows the paste handoff when the fetch is blocked', async () => {
    apiJson
      .mockResolvedValueOnce({ sessionId: 1, status: 'generating' })
      .mockRejectedValue(Object.assign(new Error('blocked'), {
        status: 503,
        body: { error: 'Could not fetch captions for this video (RequestBlocked).', isYoutube: true },
      }))

    const screen = await renderScreen()
    await startFromUrl(screen)
    await settle(120)

    // The failure state must offer the ingest that actually works,
    // rather than dead-ending.
    const textarea = screen.container.querySelector('textarea')
    expect(textarea).not.toBeNull()

    // And the URL must still be carried, so the learner retypes nothing.
    // It lives in state rather than in a visible field here, so assert
    // the behaviour that matters: submitting the pasted transcript posts
    // the URL that was originally typed.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(textarea, '0:00 これはテストです。')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))

    apiJson.mockClear()
    apiJson.mockResolvedValue({ sessionId: 2, status: 'generating' })
    ;[...screen.container.querySelectorAll('button')]
      .find(b => b.className.includes('phrase-analyze-btn') && !b.disabled)
      .click()
    await settle(60)

    const body = JSON.parse(apiJson.mock.calls[0][2].body)
    expect(body.url).toContain('AAAAAAAAAAA')
    expect(body.transcript).toContain('これはテストです')
  })
})
