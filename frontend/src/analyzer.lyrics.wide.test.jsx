import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 歌詞 on the desk (plan 314, the owner's pick D2) ─────────────────
// The bar's fold, pressed: the picture folds away, the player kept
// playing out of sight, and the lyrics take the route map's column as
// well as the picture's place -- each line its time, its Japanese and
// its translation, the one in focus drawn as its subtitle, the others a
// press that plays the video from them. The fold again gives the route
// map back. The phone's side is screens/AnalyzerScreen.lyrics.phone.

const apiJson = vi.fn()
const apiUpload = vi.fn()
const apiFetch = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiJson: (...a) => apiJson(...a),
  apiUpload: (...a) => apiUpload(...a),
  apiFetch: (...a) => apiFetch(...a),
  apiJsonWithTimeout: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./components/analysis/useMining', async o => ({
  ...(await o()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))
vi.mock('./components/video/VideoPlayer', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  const spies = { play: vi.fn(), pause: vi.fn(), seekTo: vi.fn() }
  return {
    __playerSpies: spies,
    VideoPlayer: forwardRef(function MockVideoPlayer(_p, ref) {
      useImperativeHandle(ref, () => spies)
      return <div className="video-player__frame" data-testid="player" />
    }),
  }
})
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const tok = (surface, kanji, kana, meaning, start) => ({
  surface, start, end: start + surface.length, pos: kanji ? 'noun' : 'particle', furigana: [{ text: surface }], kanji_matches: [],
  vocab_match: kanji ? { entry: { kanji, kana, meaning }, stats: { status: 'learning' }, level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}` } : null,
})
const SESSION = {
  status: 'ready', source: 'upload', sourceRef: 'x.srt', videoId: 'dQw4w9WgXcQ', windowCapped: false, truncated: 0,
  sentences: [
    {
      text: '雨を見ている', cue_start: 36, cue_end: 40, unknown_count: 0, available: true, level: 'N5', grammar: [],
      tokens: [tok('雨', '雨', 'あめ', 'rain', 0), tok('を', null, null, null, 1), tok('見', '見る', 'みる', 'to see', 2), tok('て', null, null, null, 3), tok('いる', null, null, null, 4)],
    },
    {
      text: '駅で待つ', cue_start: 40, cue_end: 44, unknown_count: 0, available: true, level: 'N5', grammar: [],
      tokens: [tok('駅', '駅', 'えき', 'station', 0), tok('で', null, null, null, 1), tok('待つ', '待つ', 'まつ', 'to wait', 2)],
    },
    {
      text: '傘を忘れた', cue_start: 64, cue_end: 68, unknown_count: 0, available: true, level: 'N5', grammar: [],
      tokens: [tok('傘', '傘', 'かさ', 'umbrella', 0), tok('を', null, null, null, 1), tok('忘れた', '忘れる', 'わすれる', 'to forget', 2)],
    },
  ],
}
const ENTRIES = {}
const ok = body => ({ ok: true, status: 200, json: async () => body })

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
const { __playerSpies: spies } = await import('./components/video/VideoPlayer')

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async url => (
    String(url).endsWith('/translations')
      ? { start: 0, lines: ['Je regarde la pluie', 'J’attends à la gare', 'J’ai oublié le parapluie'] }
      : SESSION
  ))
  apiUpload.mockReset()
  apiUpload.mockResolvedValue({ sessionId: 1, status: 'generating' })
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/dictionary?')) {
      const q = new URLSearchParams(u.split('?')[1]).get('q')
      return ok({ results: ENTRIES[q] ? [ENTRIES[q]] : [], total: ENTRIES[q] ? 1 : 0, has_more: false })
    }
    return ok([])
  })
  spies.play.mockReset()
  spies.pause.mockReset()
  spies.seekTo.mockReset()
})

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const box = s => $(s).getBoundingClientRect()

async function openVideo() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/dictionary/analyzer']}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <AnalyzerScreen session={{}} />
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(60)
  $$('.anl-sources .seg__opt')[2].click()
  await settle(60)
  const input = $('input[type="file"]')
  const dt = new DataTransfer()
  dt.items.add(new File(['1\n00:00:36,000 --> 00:00:40,000\n雨を見ている\n'], 'x.srt', { type: 'text/plain' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await settle(1500)
}

async function fold() {
  $('button[aria-label="Masquer la vidéo"]').click()
  await vi.waitFor(() => expect($('.anl-desk__lyrics')).not.toBeNull())
  await settle(60)
}

describe('the video folded away on the desk, the lines as lyrics', () => {
  it('gives the lyrics the route map\'s column as well as the picture\'s place', async () => {
    await openVideo()
    expect($('.anl-desk__rail')).not.toBeNull()
    const rail = box('.anl-desk__rail')
    await fold()

    expect($('.anl-desk--lyrics')).not.toBeNull()
    expect($('.anl-desk__rail')).toBeNull()
    // The sumi object starts where the route map did.
    expect(Math.abs(box('.anl-slab').left - rail.left)).toBeLessThanOrEqual(1)
    expect(box('.anl-slab__screen').height).toBe(0)
    expect($('[data-testid="player"]')).not.toBeNull()

    const fold2 = $('button[aria-label="Afficher la vidéo"]')
    expect(fold2.getAttribute('aria-expanded')).toBe('false')
    expect(fold2.classList.contains('anl-player__btn--on')).toBe(true)
    // Everything inside the window, the lyrics scrolling in their own box.
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    expect(box('.anl-desk__lyrics').bottom).toBeLessThanOrEqual(box('.anl-pbar').top + 1)
  })

  it('prints each line\'s time, its Japanese and its translation, the one in focus as its subtitle', async () => {
    await openVideo()
    await fold()
    expect($('.anl-lyrics__now .anl-subs__line').getAttribute('aria-label')).toBe('雨を見ている')
    expect($('.anl-lyrics__now .anl-lyrics__time').textContent).toBe('0:36')
    await vi.waitFor(() => expect($$('.anl-lyrics__line .anl-lyrics__tr').map(el => el.textContent))
      .toEqual(['J’attends à la gare', 'J’ai oublié le parapluie']))
    expect($$('.anl-lyrics__line .anl-lyrics__jp').map(el => el.textContent)).toEqual(['駅で待つ', '傘を忘れた'])
    expect($$('.anl-lyrics__line .anl-lyrics__time').map(el => el.textContent)).toEqual(['0:40', '1:04'])
    // The lines start where the line in focus does, under one another.
    const [a, b] = $$('.anl-lyrics__line .anl-lyrics__jp').map(el => el.getBoundingClientRect())
    expect(Math.abs(a.left - b.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(box('.anl-lyrics__now .anl-subs__line').left - a.left)).toBeLessThanOrEqual(8)
    expect(b.top).toBeGreaterThan(a.bottom)
  })

  it('plays the video from a line pressed, the lyrics going on with it', async () => {
    await openVideo()
    await fold()
    $$('.anl-lyrics__line')[1].click()
    await vi.waitFor(() => expect($('.anl-lyrics__now .anl-subs__line').getAttribute('aria-label')).toBe('傘を忘れた'))
    expect(spies.seekTo).toHaveBeenCalledWith(64)
    expect(spies.play).toHaveBeenCalled()
    // The bar's follow stays on: the lyrics move on with the song.
    expect($('button[aria-label="Suivre la vidéo"]').getAttribute('aria-pressed')).toBe('true')
  })

  it('walks the lyrics from the bar\'s skips and the keys without letting go of the song', async () => {
    await openVideo()
    await fold()
    const follow = () => $('button[aria-label="Suivre la vidéo"]').getAttribute('aria-pressed')
    $('.anl-pbar button[aria-label="Phrase suivante"]').click()
    await vi.waitFor(() => expect($('.anl-lyrics__now .anl-subs__line').getAttribute('aria-label')).toBe('駅で待つ'))
    expect(spies.seekTo).toHaveBeenLastCalledWith(40)
    expect(follow()).toBe('true')

    await userEvent.keyboard('{ArrowDown}')
    await vi.waitFor(() => expect($('.anl-lyrics__now .anl-subs__line').getAttribute('aria-label')).toBe('傘を忘れた'))
    expect(spies.seekTo).toHaveBeenLastCalledWith(64)
    expect(follow()).toBe('true')
    expect(spies.play).not.toHaveBeenCalled()
  })

  it('still lets go of the song from a skip with the picture up', async () => {
    await openVideo()
    $('.anl-pbar button[aria-label="Phrase suivante"]').click()
    await vi.waitFor(() => expect($('button[aria-label="Suivre la vidéo"]').getAttribute('aria-pressed')).toBe('false'))
  })

  it('gives the route map back with the picture', async () => {
    await openVideo()
    await fold()
    $('button[aria-label="Afficher la vidéo"]').click()
    await vi.waitFor(() => expect($('.anl-desk__rail')).not.toBeNull())
    expect($('.anl-desk__lyrics')).toBeNull()
    expect($('.anl-desk--lyrics')).toBeNull()
    expect($('.anl-slab--folded')).toBeNull()
    expect($('button[aria-label="Masquer la vidéo"]').classList.contains('anl-player__btn--on')).toBe(false)
  })
})
