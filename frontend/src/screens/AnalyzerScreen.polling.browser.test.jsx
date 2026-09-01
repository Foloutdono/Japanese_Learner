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

// apiFetch returns a raw Response, and the merged screen calls it on
// mount for 運行履歴 (the old VideoScreen never did). Mocked as an
// actual resolved Response rather than a bare vi.fn(): one that returns
// undefined makes the history fetch throw on `.then` during the mount
// effect, which unmounts the tree and fails every case in this file for
// a reason that has nothing to do with polling.
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }))

vi.mock('../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
  apiUpload: (...a) => apiUpload(...a),
  apiFetch: (...a) => apiFetch(...a),
  ApiError: class ApiError extends Error {},
}))

// Spread the real module: other names (buildCloze, ...) are pulled out
// of it elsewhere in this import graph, and a bare factory breaks them.
// Same trap as lib/audio in ExamResult.generating.browser.test.jsx.
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))

// The player pulls in the YouTube IFrame API over the network. Mocked
// as a forwardRef exposing spies, so the transport-bar cases can assert
// WHAT the screen asked the player to do — the exported __playerSpies
// are reset in beforeEach with the api mocks.
vi.mock('../components/video/VideoPlayer', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  const spies = { play: vi.fn(), pause: vi.fn(), seekTo: vi.fn() }
  return {
    __playerSpies: spies,
    VideoPlayer: forwardRef(function MockVideoPlayer(props, ref) {
      useImperativeHandle(ref, () => spies)
      return <div data-testid="player" />
    }),
  }
})

// The screen now opens on the selection screen, and the platform choice
// goes through the boarding store so TrainDoor can play over the commit.
// The door lives in App, not in this tree, so an unmocked board() would
// park the commit forever; committing synchronously is exactly what the
// door itself does under prefers-reduced-motion.
vi.mock('../stores/boarding', () => ({ board: commit => commit() }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')
const { __playerSpies: playerSpies } = await import('../components/video/VideoPlayer')

// Renders AND boards: the workbench (rail, intakes) only mounts once a
// platform card on the selection screen is chosen, so every case walks
// through the gate first. The first card is 文字; cases that need 動画
// still switch via the rail afterwards (goToPlatform below).
async function renderScreen() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter>
        <AnalyzerScreen session={{}} />
      </MemoryRouter>
    </LangProvider>
  )
  await settle(30)
  screen.container.querySelector('.platform-card').click()
  await settle(30)
  return screen
}

// The three sources are three platforms at one station, and since the
// mockup round retired the tab rail, the ONLY road between them runs
// back through the selection-screen gate: the stub strip's Change
// control, then the platform card. Cards render in registry order.
// Awaited, not fire-and-forget: only the boarded platform's panel is
// in the DOM (which is what keeps focus out of a hidden one), so the
// subtitle input does not exist until React has re-rendered.
async function goToPlatform(screen, key) {
  screen.container.querySelector('.anl-stub__change').click()
  await settle(30)
  const idx = { text: 0, photo: 1, video: 2 }[key]
  screen.container.querySelectorAll('.platform-card')[idx].click()
  await settle(30)
}

// React installs its own `value` setter on the input prototype and
// listens for the change through it, so assigning `el.value` directly
// updates the DOM but never reaches state -- the component re-renders
// with its old value and the field appears to ignore you. Going through
// the prototype setter is what makes a controlled field see the input.
function typeInto(el, text) {
  const proto = Object.getPrototypeOf(el)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// Start the way the screen is actually driven now: pick a subtitle
// file. Loading captions from a URL was removed 2026-08-26 -- a server
// cannot fetch them from YouTube -- so there is no "Load" button left to
// click. See docs/adr/0003's amendment.
async function startFromFile(screen) {
  await goToPlatform(screen, 'video')
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
  playerSpies.play.mockReset()
  playerSpies.pause.mockReset()
  playerSpies.seekTo.mockReset()
})

describe('AnalyzerScreen polling', () => {
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
    // And it must still be waiting, not claiming to be ready. Asserted
    // on the stage rather than on the old .video-transcript-label:
    // plan 028 deleted that class, so the assertion had quietly become
    // "null is null" and would have passed against a broken screen.
    expect(screen.container.querySelector('.anl-stage')).toBeNull()
  })

  it('draws the line and opens a stop once real sentences arrive', async () => {
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson
      .mockResolvedValueOnce({ status: 'generating' })
      .mockResolvedValue({
        status: 'ready', source: 'upload', sourceRef: 'x.srt',
        windowCapped: false, truncated: 0,
        // Two Sentences, each with the tokens a real local-tier analysis
        // returns. The old fixture passed `tokens: []` because the flat
        // transcript printed `s.text` directly; the breakdown rebuilds
        // the Sentence FROM its tokens, so an empty list now renders an
        // empty stage -- realistic input is the fix, not a looser
        // assertion.
        sentences: [
          {
            text: '猫が好き', cue_start: 0, cue_end: 2, grammar: [],
            unknown_count: 1, available: true,
            tokens: [{ surface: '猫が好き', pos: 'noun' }],
          },
          {
            text: '犬も好き', cue_start: 2, cue_end: 4, grammar: [],
            unknown_count: 0, available: true,
            tokens: [{ surface: '犬も好き', pos: 'noun' }],
          },
        ],
      })

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(2000)

    // The line carries every Sentence...
    expect(screen.container.querySelectorAll('.anl-stop').length).toBe(2)
    // ...i+1 is marked on the map, not buried in a card...
    expect(screen.container.querySelectorAll('.anl-stop__iplus').length).toBe(1)
    // ...one stop is open, and it is the first...
    expect(screen.container.querySelector('.anl-stop[aria-current="true"]').textContent)
      .toContain('猫が好き')
    // ...and the stage shows exactly ONE breakdown. (The status legend
    // that used to be asserted here belongs to the 'list' layout; the
    // stage steps through Tokens one at a time now, so there is none.)
    expect(screen.container.querySelectorAll('.rdg-breakdown').length).toBe(1)
  })

  // The frozen-bar bug this pins: the transport is scaled to the
  // Passage's cue WINDOW (a window opening at 0:36 on a track that
  // starts at 0:00), so pressing play from before it left the readout
  // clamped at 0:00 for thirty-six silent seconds — a player that
  // looks dead while doing exactly what it was told. Play means "play
  // the passage": from before its window, the bar seeks to the window
  // start first, THEN plays.
  it('play from before the passage window seeks to the window start first', async () => {
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson.mockResolvedValue({
      status: 'ready', source: 'upload', sourceRef: 'x.srt',
      videoId: 'dQw4w9WgXcQ', windowCapped: false, truncated: 0,
      sentences: [
        { text: '猫が好き', cue_start: 36, cue_end: 40, grammar: [], unknown_count: 0, available: true, tokens: [{ surface: '猫が好き', pos: 'noun' }] },
        { text: '犬も好き', cue_start: 40, cue_end: 44, grammar: [], unknown_count: 0, available: true, tokens: [{ surface: '犬も好き', pos: 'noun' }] },
      ],
    })

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(2000)

    const playBtn = screen.container.querySelector('.anl-player__btn')
    expect(playBtn).not.toBeNull()
    playBtn.click()
    await settle(60)

    expect(playerSpies.seekTo).toHaveBeenCalledWith(36)
    expect(playerSpies.play).toHaveBeenCalled()
    // Seek FIRST, then play — the other order would start at 0:00 and
    // jump, which is the visible glitch this exists to prevent.
    expect(playerSpies.seekTo.mock.invocationCallOrder[0])
      .toBeLessThan(playerSpies.play.mock.invocationCallOrder[0])
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
    // And the dock is still there to try again with, rather than a dead
    // end. Since plan 029 the intake is always mounted, so the check is
    // that the failure did not replace it.
    expect(screen.container.querySelector('.anl-drop')).not.toBeNull()
  })

  // A Sentence CAN come back with no tokens -- an unavailable analysis,
  // a line of pure punctuation. The stepper reads tokens[index], and
  // with an empty list that is tokens[-1] === undefined, which TokenCard
  // dereferences and takes the whole screen down with. Same failure
  // class as the 202 crash above: an out-of-range index read.
  it('survives a Sentence with no tokens at all', async () => {
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson.mockResolvedValue({
      status: 'ready', source: 'upload', sourceRef: 'x.srt',
      windowCapped: false, truncated: 0,
      sentences: [{ text: '、、、', tokens: [], grammar: [], unknown_count: 0, available: true }],
    })

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(2000)

    expect(screen.container.querySelector('main')).not.toBeNull()
    expect(screen.container.querySelector('.anl-stage')).not.toBeNull()
  })

  // Switching MODES clears the analyser (owner-directed, 2026-09-01 —
  // this reverses the merge-era rule this case used to pin): a Passage
  // typed on 文字 does not follow the learner to 写真, and coming back
  // does not resurrect it. The same-platform round trip that DOES keep
  // the Passage is pinned in AnalyzerScreen.responsive.browser.test.jsx.
  it('clears a finished Passage when the learner switches platform', async () => {
    apiJson.mockResolvedValue({
      sentences: [{
        text: '猫が好き', grammar: [], unknown_count: 0, available: true,
        tokens: [{ surface: '猫が好き', pos: 'noun' }],
      }],
      truncated: 0,
    })

    const screen = await renderScreen()

    typeInto(screen.container.querySelector('textarea'), '猫が好き')
    screen.container.querySelector('.anl-action').click()
    await settle(120)
    expect(screen.container.textContent).toContain('猫が好き')

    await goToPlatform(screen, 'photo')
    expect(screen.container.querySelector('.anl-results')).toBeNull()
    await goToPlatform(screen, 'text')

    expect(screen.container.querySelector('.anl-results')).toBeNull()
    expect(screen.container.textContent).not.toContain('猫が好き')
  })

  // Plan 035: the deep tier used to be swapped in WHOLESALE, and
  // _analyze_sentence builds from text alone -- so buying the deep tier
  // for a subtitle line deleted that line's cue_start/cue_end and broke
  // playback sync for it permanently. useAnalyzerSession now MERGES the
  // explained result onto the Sentence it already had.
  it('keeps a Sentence cue when it is explained', async () => {
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson.mockImplementation(async url => {
      if (url.includes('/explain')) {
        return { explanation: 'An introduction.', words: [] }
      }
      return {
        status: 'ready', source: 'upload', sourceRef: 'x.srt',
        windowCapped: false, truncated: 0,
        sentences: [
          {
            text: '猫が好き', cue_start: 0, cue_end: 2, grammar: [],
            unknown_count: 1, available: true,
            tokens: [{ surface: '猫が好き', pos: 'noun' }],
          },
          {
            text: '犬も好き', cue_start: 2, cue_end: 4, grammar: [],
            unknown_count: 0, available: true,
            tokens: [{ surface: '犬も好き', pos: 'noun' }],
          },
        ],
      }
    })

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(2000)

    expect(screen.container.querySelectorAll('.anl-stop__time').length).toBe(2)

    screen.container.querySelector('.anl-explain__btn').click()
    await settle(500)

    expect(screen.container.querySelectorAll('.anl-stop__time').length).toBe(2)
  })

  it('reports a failed explanation', async () => {
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson.mockImplementation(async url => {
      if (url.includes('/explain')) {
        return Promise.reject(Object.assign(new Error('boom'), { status: 500 }))
      }
      return {
        status: 'ready', source: 'upload', sourceRef: 'x.srt',
        windowCapped: false, truncated: 0,
        sentences: [{
          text: '猫が好き', cue_start: 0, cue_end: 2, grammar: [],
          unknown_count: 0, available: true,
          tokens: [{ surface: '猫が好き', pos: 'noun' }],
        }],
      }
    })

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(2000)

    const button = screen.container.querySelector('.anl-explain__btn')
    button.click()
    await settle(500)

    expect(screen.container.querySelector('.anl-explain__hint--bad')).not.toBeNull()
    expect(button.disabled).toBe(false)
  })

  it('says so when the provider is down', async () => {
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson.mockImplementation(async url => {
      if (url.includes('/explain')) {
        return Promise.reject(Object.assign(new Error('The AI service is temporarily unavailable.'), { status: 503 }))
      }
      return {
        status: 'ready', source: 'upload', sourceRef: 'x.srt',
        windowCapped: false, truncated: 0,
        sentences: [{
          text: '猫が好き', cue_start: 0, cue_end: 2, grammar: [],
          unknown_count: 0, available: true,
          tokens: [{ surface: '猫が好き', pos: 'noun' }],
        }],
      }
    })

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(2000)

    screen.container.querySelector('.anl-explain__btn').click()
    await settle(500)

    expect(screen.container.textContent).toContain('The AI service is temporarily unavailable.')
  })

  it('offers to explain again once explained', async () => {
    apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
    apiJson.mockImplementation(async url => {
      if (url.includes('/explain')) {
        return { explanation: 'An introduction.', words: [] }
      }
      return {
        status: 'ready', source: 'upload', sourceRef: 'x.srt',
        windowCapped: false, truncated: 0,
        sentences: [{
          text: '猫が好き', cue_start: 0, cue_end: 2, grammar: [],
          unknown_count: 0, available: true,
          tokens: [{ surface: '猫が好き', pos: 'noun' }],
        }],
      }
    })

    const screen = await renderScreen()
    await startFromFile(screen)
    await settle(2000)

    const button = screen.container.querySelector('.anl-explain__btn')
    button.click()
    await settle(1500)

    // Locale-agnostic: this environment's LangProvider defaults to
    // French, not English. The control stays present after an
    // explanation exists (it used to vanish, gated on
    // `!focused.explanation`), and its hint switches to "explained".
    expect(screen.container.querySelector('.anl-explain')).not.toBeNull()
    expect(screen.container.querySelector('.anl-explain__btn')).not.toBeNull()
    expect(screen.container.querySelector('.anl-explain__hint--bad')).toBeNull()
  })
})
