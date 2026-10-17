import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 at the desk's tightest (plan 238) ────────────────────────
// The owner's pick C at 1100×800, the narrowest window the desk is
// drawn for: the player's bar, too wide for its column on one row, puts
// its track and its clock on a row of their own over the buttons, and
// the panel's segment keeps its three names on one row -- the word the
// first one opens is printed under it anyway.
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
  const props = { last: null, renders: 0 }
  return {
    __playerSpies: spies,
    __playerProps: props,
    VideoPlayer: forwardRef(function MockVideoPlayer(p, ref) {
      useImperativeHandle(ref, () => spies)
      props.last = p
      props.renders += 1
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
      text: '雨を見ている', cue_start: 36, cue_end: 40, unknown_count: 0, available: true, level: 'N5',
      grammar: [{ kind: 'marker', raw_id: 'grammar_N5_wo', pattern: 'を', level: 'N5', meaning: 'object', start: 1, end: 2, segments: [[1, 2]] }, { kind: 'pattern', raw_id: 'grammar_N5_teiru', pattern: '〜ている', level: 'N5', start: 3, end: 6, segments: [[3, 6]] }],
      tokens: [tok('雨', '雨', 'あめ', 'rain', 0), tok('を', null, null, null, 1), tok('見', '見る', 'みる', 'to see', 2), tok('て', null, null, null, 3), tok('いる', null, null, null, 4)],
    },
    {
      text: '駅で待つ', cue_start: 40, cue_end: 44, unknown_count: 0, available: true, level: 'N5', grammar: [],
      tokens: [tok('駅', '駅', 'えき', 'station', 0), tok('で', null, null, null, 1), tok('待つ', '待つ', 'まつ', 'to wait', 2)],
    },
  ],
}
let session = SESSION
const entry = (kanji, kana, meaning) => ({ type: 'vocab', kanji, kana, meaning, level: 'N5', senses: [], examples: [], status: { status: 'learning' } })
const ENTRIES = { 雨: entry('雨', 'あめ', 'rain'), 駅: entry('駅', 'えき', 'station') }
const ok = body => ({ ok: true, status: 200, json: async () => body })

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
const { __playerSpies: spies } = await import('./components/video/VideoPlayer')

beforeEach(() => {
  apiJson.mockReset()
  session = SESSION
  apiJson.mockImplementation(async () => session)
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
  window.localStorage.removeItem('jp-video-sound')
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


const fits = s => $(s).scrollWidth <= $(s).clientWidth + 1

describe('a video at the desk\'s tightest', () => {
  it('folds the bar onto two rows and keeps the panel\'s three names whole', async () => {
    await openVideo()
    await settle(300)
    expect($('.anl-slab--tight')).not.toBeNull()
    expect(fits('.anl-pbar')).toBe(true)
    const track = box('.anl-pbar__track')
    const play = box('.anl-player__btn--main')
    expect(track.bottom).toBeLessThan(play.top)
    expect(track.width).toBeGreaterThan(box('.anl-pbar').width / 2)
    expect(fits('.anl-faces')).toBe(true)
    expect($$('.anl-faces .seg__opt-latin').map(o => o.textContent)).toEqual(['Mot', 'Grammaire', 'Construction'])
    expect(document.scrollingElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
  })
})
