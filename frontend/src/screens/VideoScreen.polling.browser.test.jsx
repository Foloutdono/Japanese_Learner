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

// Start the way the screen is actually driven now: pick a subtitle
// file. Loading captions from a URL was removed 2026-08-26 -- a server
// cannot fetch them from YouTube -- so there is no "Load" button left to
// click. See docs/adr/0003's amendment.
async function startFromFile(screen) {
  const input = screen.container.querySelector('input[type="file"]')
  const dt = new DataTransfer()
  const srt = ['1', '00:00:01,000 --> 00:00:04,000', '猫', ''].join('\n')
  dt.items.add(new File([srt], 'x.srt', { type: 'text/plain' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
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
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson.mockResolvedValue({ status: 'generating' })

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(120)

    // Before the fix this threw during render and React unmounted the
    // tree, leaving an empty container.
    expect(screen.container.querySelector('main')).not.toBeNull()
    // And it must still be waiting, not claiming to be ready.
    expect(screen.container.querySelector('.video-transcript-label')).toBeNull()
  })

  it('renders the transcript once real sentences arrive', async () => {
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson
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
    await startFromFile(screen)
    await settle(2000)

    expect(screen.container.textContent).toContain('猫が好き')
  })

  it('surfaces a parse failure with the reason and a way back', async () => {
    // The ONLY way to fail now: a file or paste we could not parse.
    // Nothing is fetched, so nothing can be IP-blocked.
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson.mockRejectedValue(Object.assign(new Error('bad'), {
      status: 503,
      body: { error: 'No cue timestamps found in VTT content' },
    }))

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(120)

    expect(screen.container.textContent).toContain('No cue timestamps')
    // And a control to get back to the setup form rather than a dead end.
    expect(screen.container.querySelector('.phrase-analyze-btn')).not.toBeNull()
  })
})
