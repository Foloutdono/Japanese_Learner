import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the analyser's video Passage on three columns (plan 134) ──
// The owner's drawing at a laptop's full width: the sentences over the
// grammar on the left, the video with the sentence as its subtitle and
// the player's bar as one sumi object in the middle, the card in focus
// on the right -- the desk's rail stepped aside, all three inside the
// window, each scrolling itself.
// And the bar's pieces: the sentence again, on a loop, a stop at each
// sentence's end, the speed, the video folded away; one plain track,
// no step per sentence. The phone's stage is deskfree.phone.

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
  const props = { last: null }
  return {
    __playerSpies: spies,
    __playerProps: props,
    VideoPlayer: forwardRef(function MockVideoPlayer(p, ref) {
      useImperativeHandle(ref, () => spies)
      props.last = p
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
const entry = (kanji, kana, meaning) => ({ type: 'vocab', kanji, kana, meaning, level: 'N5', senses: [], examples: [], status: { status: 'learning' } })
const ENTRIES = { 雨: entry('雨', 'あめ', 'rain'), 駅: entry('駅', 'えき', 'station') }
const ok = body => ({ ok: true, status: 200, json: async () => body })

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
const { __playerSpies: spies, __playerProps: player } = await import('./components/video/VideoPlayer')

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async () => SESSION)
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

describe('the analyser\'s video Passage on three columns (plan 134)', () => {
  it('stands the sentences, the sumi object and the card side by side, inside the window', async () => {
    await openVideo()
    expect($('.anl-desk')).not.toBeNull()
    // The rail steps aside: the result has the window.
    expect(getComputedStyle($('.phone--desk')).paddingInlineStart).toBe('0px')
    const rail = box('.anl-desk__rail')
    const slab = box('.anl-slab')
    const right = box('.anl-desk__entry')
    expect(rail.right).toBeLessThanOrEqual(slab.left)
    expect(slab.right).toBeLessThanOrEqual(right.left)
    // The drawing's shares: 410 | 830 | 541.
    expect(slab.width / rail.width).toBeGreaterThan(1.8)
    // The list of sentences over the grammar, the grammar's box level
    // with the words' row, top and foot.
    expect($('.anl-desk__rail .anl-stop')).not.toBeNull()
    expect(box('.anl-desk__points').top).toBeGreaterThan(rail.bottom - 1)
    expect(Math.abs(box('.anl-desk__points').top - box('.anl-desk__work').top)).toBeLessThan(2)
    expect(Math.abs(box('.anl-desk__points').bottom - box('.anl-desk__work').bottom)).toBeLessThan(2)
    // The video, the subtitle and the bar are one object, in that order.
    expect($('.anl-slab [data-testid="player"]')).not.toBeNull()
    expect(box('.anl-subs').top).toBeGreaterThan(box('.anl-slab__screen').bottom - 1)
    expect(box('.anl-pbar').top).toBeGreaterThan(box('.anl-subs').bottom - 1)
    // The words beside the card in focus, Explain under it.
    expect(box('.anl-desk__focus').left).toBeGreaterThan(box('.anl-desk__words').right - 1)
    expect(box('.anl-desk__explain').top).toBeGreaterThan(box('.anl-focus').bottom - 1)
    // Nothing past the window: each column scrolls in itself.
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    expect(document.scrollingElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('draws the bar on one row: one plain track, no step per sentence, no printed keys', async () => {
    await openVideo()
    expect($$('.anl-pbar .anl-pbar__track').length).toBe(1)
    expect($('.cue, .anl-stops, .anl-desk .desk-kbd, .anl-desk kbd, .anl-pbar .anl-player__dial')).toBeNull()
    const mid = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 }
    const row = mid($('.anl-player__btn--main'))
    for (const el of $$('.anl-pbar > button, .anl-pbar__track')) expect(Math.abs(mid(el) - row)).toBeLessThan(2)
    // The sound from the bar.
    $('button[aria-label="Couper le son de la vidéo"]').click()
    await settle(30)
    expect(player.last.muted).toBe(true)
  })

  it('replays the sentence, loops it, and stops at a sentence\'s end', async () => {
    await openVideo()
    $('button[aria-label="Rejouer la phrase"]').click()
    await settle(30)
    expect(spies.seekTo).toHaveBeenLastCalledWith(36)
    expect(spies.play).toHaveBeenCalled()

    // On a loop, the focused sentence's end sends the clock back.
    const loop = $('button[aria-label="Répéter la phrase en boucle"]')
    loop.click()
    await settle(30)
    expect(loop.getAttribute('aria-pressed')).toBe('true')
    spies.seekTo.mockReset()
    player.last.onTimeUpdate(39.8)
    player.last.onTimeUpdate(40.05)
    expect(spies.seekTo).toHaveBeenCalledWith(36)
    // A seek far down the track is not playback: no pull back.
    spies.seekTo.mockReset()
    player.last.onTimeUpdate(36.2)
    player.last.onTimeUpdate(43)
    expect(spies.seekTo).not.toHaveBeenCalled()
    loop.click()
    await settle(30)

    // At each sentence's end, a stop.
    $('button[aria-label="Pause à la fin de chaque phrase"]').click()
    await settle(30)
    player.last.onTimeUpdate(39.7)
    player.last.onTimeUpdate(40.1)
    expect(spies.pause).toHaveBeenCalled()
  })

  it('walks the speed and folds the video away without unmounting it', async () => {
    await openVideo()
    const rate = $('.anl-pbar__rate')
    expect(rate.textContent).toBe('1×')
    rate.click()
    await settle(30)
    expect(rate.textContent).toBe('0,75×')
    expect(player.last.rate).toBe(0.75)

    const fold = $('button[aria-label="Masquer la vidéo"]')
    fold.click()
    await settle(30)
    expect($('.anl-slab--folded')).not.toBeNull()
    expect($('[data-testid="player"]')).not.toBeNull()
    expect(box('.anl-slab__screen').height).toBe(0)
    expect(fold.getAttribute('aria-expanded')).toBe('false')
  })

  it('walks the sentences from the bar and follows the grammar from its number', async () => {
    await openVideo()
    expect($('.anl-subs__pt .anl-subs__n').textContent).toBe('1')
    expect($('.anl-desk__points .anl-num').textContent).toBe('1')
    $('button[aria-label="Phrase suivante"]').click()
    await settle()
    expect($('.anl-subs__count').textContent).toContain('2 / 2')
    expect(spies.seekTo).toHaveBeenLastCalledWith(40)
    // A sentence with no construction has no grammar panel.
    expect($('.anl-desk__points')).toBeNull()
  })
})
