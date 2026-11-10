import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 歌詞 on a phone (plan 314, the owner's picks V2 and C) ────────────
// The pull hanging from the picture's foot folds the video away, the
// player kept and playing out of sight, and the video's sumi grows to
// the dock with the Passage in it line under line: each line over its
// translation, the one in focus drawn as its subtitle, the others a
// press that plays the video from them. The same pull, now at the top
// of the lyrics, gives the stage back.

const tok = (surface, start, reading, pos) => ({
  surface, start, end: start + surface.length, reading, pos, vocab_match: null, grammar: [],
})
const line = (text, at, [a, b, c]) => ({
  text, cue_start: at, cue_end: at + 2, grammar: [], unknown_count: 1, available: true,
  tokens: [tok(a, 0, a, 'noun'), tok(b, a.length, b, 'particle'), tok(c, a.length + b.length, c, 'verb')],
})
const TRACK = [
  line('夜が来る', 1, ['夜', 'が', '来る']),
  line('君を呼ぶ', 3, ['君', 'を', '呼ぶ']),
  line('星が光る', 5, ['星', 'が', '光る']),
]
// A song's worth: far more lines than the stage holds.
const LONG = Array.from({ length: 30 }, (_, i) => line(`駅で待つ${i}`, 1 + 2 * i, ['駅', 'で', `待つ${i}`]))
const sessionOf = sentences => ({
  status: 'ready', source: 'youtube', sourceRef: 'x', videoId: 'dQw4w9WgXcQ',
  windowCapped: false, truncated: 0, sentences,
})
const ROW = { id: 7, sourceRef: 'x', source: 'youtube', createdAt: new Date().toISOString(), sentenceCount: 3, videoId: 'dQw4w9WgXcQ', firstLine: '夜が来る' }

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
  const spies = {
    play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(), currentTime: () => 0,
    title: () => '', channel: () => '',
  }
  return {
    __playerSpies: spies,
    VideoPlayer: forwardRef(function MockVideoPlayer(_p, ref) {
      useImperativeHandle(ref, () => spies)
      return <div className="video-player__frame" />
    }),
  }
})
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')
const { __playerSpies: spies } = await import('../components/video/VideoPlayer')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// The translations' answer, at once, or held until a test lets it go.
let release
function serve(sentences = TRACK, { held = false } = {}) {
  const lines = sentences === TRACK
    ? ['La nuit vient', 'Je t’appelle', 'Une étoile brille']
    : sentences.map((_, i) => `J’attends ${i}`)
  const answer = held ? new Promise(r => { release = () => r({ start: 0, lines }) }) : { start: 0, lines }
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    if (url === '/api/video/session/7') return sessionOf(sentences)
    if (url === '/api/video/session/7/translations') return answer
    return {}
  })
}

beforeEach(() => {
  serve()
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => ({
    ok: true, status: 200, json: async () => (url === '/api/video/sessions' ? [ROW] : []),
  }))
  spies.play.mockReset()
  spies.pause.mockReset()
  spies.seekTo.mockReset()
  window.localStorage.removeItem('tsuji.anlDisplay')
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

const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

async function fold() {
  $('.anl-m__pull').click()
  await vi.waitFor(() => expect($('.anl-m__lyrics')).not.toBeNull())
  await settle(60)
}

describe('the video folded away on a phone, the lines as lyrics', () => {
  it('hangs a pull from the picture that folds it away, the player kept playing', async () => {
    await openVideo()
    const pull = $('.anl-m__pull')
    expect(pull.getAttribute('aria-label')).toBe('Masquer la vidéo')
    expect(pull.getAttribute('aria-expanded')).toBe('true')
    // The tab hangs under the picture, not over it.
    expect(pull.getBoundingClientRect().top).toBeGreaterThanOrEqual($('.anl-m__video').getBoundingClientRect().bottom)
    const frame = $('.video-player__frame')

    pull.focus()
    await fold()
    // One button, so the focus stays where the learner left it.
    expect($('.anl-m__pull')).toBe(pull)
    expect(document.activeElement).toBe(pull)
    expect(pull.getAttribute('aria-label')).toBe('Afficher la vidéo')
    expect(pull.getAttribute('aria-expanded')).toBe('false')
    // The player is the same one, out of sight: a new one could not
    // report the clock the lyrics follow.
    expect($('.video-player__frame')).toBe(frame)
    expect($('.anl-m__video').getBoundingClientRect().height).toBe(0)
    expect($('.anl-m__subs')).toBeNull()
  })

  it('gives the lyrics the screen between the head and the dock', async () => {
    await openVideo()
    await fold()
    // The stage is the screen's height, however many lines the Passage
    // has: the lyrics scroll inside it, the dock at its foot.
    const stage = $('.anl-m').getBoundingClientRect()
    expect(Math.abs(stage.height - window.innerHeight)).toBeLessThanOrEqual(1)
    const lyrics = $('.anl-m__lyrics').getBoundingClientRect()
    const dock = $('.anl-m__dock').getBoundingClientRect()
    expect(lyrics.top).toBeGreaterThanOrEqual($('.anl-m__pull').getBoundingClientRect().bottom - 1)
    expect(lyrics.bottom).toBeLessThanOrEqual(dock.top + 1)
    expect(Math.abs(dock.bottom - stage.bottom)).toBeLessThanOrEqual(1)
    expect(document.scrollingElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('reads every line over its translation, the line in focus as its subtitle', async () => {
    await openVideo()
    await fold()
    expect($('.anl-lyrics__now .anl-subs__line').getAttribute('aria-label')).toBe('夜が来る')
    await vi.waitFor(() => expect($('.anl-lyrics__now .anl-lyrics__tr').textContent).toBe('La nuit vient'))
    expect($$('.anl-lyrics__line .anl-lyrics__jp').map(el => el.textContent)).toEqual(['君を呼ぶ', '星が光る'])
    expect($$('.anl-lyrics__line .anl-lyrics__tr').map(el => el.textContent)).toEqual(['Je t’appelle', 'Une étoile brille'])
    // Each under its own line, never beside it.
    const [jp] = $$('.anl-lyrics__line .anl-lyrics__jp')
    const [tr] = $$('.anl-lyrics__line .anl-lyrics__tr')
    expect(tr.getBoundingClientRect().top).toBeGreaterThanOrEqual(jp.getBoundingClientRect().bottom - 1)
    // The pointer's way to a line: the keyboard walks them with ↑/↓.
    expect($$('.anl-lyrics__line').every(b => b.tabIndex === -1)).toBe(true)
  })

  it('plays the video from a line pressed, the lyrics going on with it', async () => {
    await openVideo()
    await fold()
    $$('.anl-lyrics__line')[1].click()
    await vi.waitFor(() => expect($('.anl-lyrics__now .anl-subs__line').getAttribute('aria-label')).toBe('星が光る'))
    expect(spies.seekTo).toHaveBeenCalledWith(5)
    expect(spies.play).toHaveBeenCalled()
    expect($$('.anl-lyrics__line .anl-lyrics__jp').map(el => el.textContent)).toEqual(['夜が来る', '君を呼ぶ'])
  })

  it('holds the line in focus a third of the way down a long song', async () => {
    serve(LONG)
    await openVideo()
    await fold()
    const page = document.scrollingElement.scrollTop
    $$('.anl-lyrics__line')[14].click()
    await vi.waitFor(() => expect($('.anl-lyrics__now .anl-subs__line').getAttribute('aria-label')).toBe('駅で待つ15'))
    const list = $('.anl-m__lyrics')
    await vi.waitFor(() => {
      const box = list.getBoundingClientRect()
      const now = $('.anl-lyrics__now').getBoundingClientRect()
      expect(Math.abs((now.top - box.top) - list.clientHeight / 3)).toBeLessThan(2)
    }, { timeout: 3000 })
    // The page itself never moved: only the list scrolled.
    expect(document.scrollingElement.scrollTop).toBe(page)
  })

  it('keeps the line held where it was when the translations land over it', async () => {
    serve(LONG, { held: true })
    await openVideo()
    await fold()
    $$('.anl-lyrics__line')[14].click()
    const list = $('.anl-m__lyrics')
    const held = () => {
      const now = $('.anl-lyrics__now').getBoundingClientRect()
      return Math.abs((now.top - list.getBoundingClientRect().top) - list.clientHeight / 3)
    }
    await vi.waitFor(() => expect(held()).toBeLessThan(2), { timeout: 3000 })
    expect($('.anl-lyrics__line .anl-lyrics__tr')).toBeNull()

    // Fifteen lines over it each gain a row: it is put back.
    release()
    await vi.waitFor(() => expect($$('.anl-lyrics__line .anl-lyrics__tr').length).toBeGreaterThan(14))
    await vi.waitFor(() => expect(held()).toBeLessThan(2), { timeout: 3000 })
  })

  it('prints no translation where the Affichage sheet has them hidden', async () => {
    window.localStorage.setItem('tsuji.anlDisplay', JSON.stringify({ furigana: 'unknown', romaji: false, translation: false }))
    await openVideo()
    await fold()
    await settle(100)
    expect($$('.anl-lyrics__line')).toHaveLength(2)
    expect($('.anl-lyrics__tr')).toBeNull()
  })

  it('gives the stage back from the same pull, the player still the same one', async () => {
    await openVideo()
    const frame = $('.video-player__frame')
    await fold()
    $('.anl-m__pull').click()
    await vi.waitFor(() => expect($('.anl-m__subs .anl-subs__line')).not.toBeNull())
    expect($('.anl-m__lyrics')).toBeNull()
    expect($('.video-player__frame')).toBe(frame)
    expect($('.anl-m__video').getBoundingClientRect().height).toBeGreaterThan(0)
    expect($('.anl-m__pull').getAttribute('aria-expanded')).toBe('true')
  })
})
