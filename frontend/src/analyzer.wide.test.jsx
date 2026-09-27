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
// A song's worth of lines: the list of sentences far taller than the
// head and the sumi object beside it.
const LONG = {
  ...SESSION,
  sentences: [
    SESSION.sentences[0],
    ...Array.from({ length: 35 }, (_, i) => ({ ...SESSION.sentences[1], text: `駅で待つ${i}`, cue_start: 44 + 4 * i, cue_end: 48 + 4 * i })),
  ],
}
let session = SESSION
const entry = (kanji, kana, meaning) => ({ type: 'vocab', kanji, kana, meaning, level: 'N5', senses: [], examples: [], status: { status: 'learning' } })
const ENTRIES = { 雨: entry('雨', 'あめ', 'rain'), 駅: entry('駅', 'えき', 'station') }
const ok = body => ({ ok: true, status: 200, json: async () => body })

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
const { __playerSpies: spies, __playerProps: player } = await import('./components/video/VideoPlayer')

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

  it('keeps the rows to the head and the sumi object when the list of sentences is long', async () => {
    session = LONG
    await openVideo()
    const rail = box('.anl-desk__rail')
    const slab = box('.anl-slab')
    // The list scrolls in its panel; it does not stretch the rows beside it.
    expect(box('.anl-desk__head').height).toBeLessThan(80)
    const gap = parseFloat(getComputedStyle($('.anl-desk')).rowGap)
    expect(Math.abs(slab.top - (box('.anl-desk__head').bottom + gap))).toBeLessThan(2)
    expect(Math.abs(rail.bottom - slab.bottom)).toBeLessThan(2)
    // The sumi object whole: its subtitle and its bar inside it.
    expect(box('.anl-pbar').bottom).toBeLessThanOrEqual(slab.bottom + 1)
    // The grammar and the words have the rest of the window.
    expect(box('.anl-desk__points').height).toBeGreaterThan(150)
    expect(box('.anl-desk__work').height).toBeGreaterThan(150)
    expect(Math.abs(box('.anl-desk__points').top - box('.anl-desk__work').top)).toBeLessThan(2)
    const line = $('.anl-desk__rail .anl-line')
    expect(line.scrollHeight).toBeGreaterThan(line.clientHeight)
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
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

  // The stop comes BEFORE the next sentence starts, not on the poll that
  // finds it already playing: the line stays on the sentence just heard,
  // so Rejouer replays it and its words are the ones beside the card.
  it('stops at a sentence\'s end before the next one, and Play goes on past it', async () => {
    await openVideo()
    $('button[aria-label="Pause à la fin de chaque phrase"]').click()
    await settle(30)
    // A timer for the end, set a poll ahead of it.
    player.last.onTimeUpdate(39.5)
    player.last.onTimeUpdate(39.75)
    expect(spies.pause).not.toHaveBeenCalled()
    await settle(300)
    expect(spies.pause).toHaveBeenCalledTimes(1)
    expect($('.anl-subs__count').textContent).toContain('1 / 2')
    // Played on: no second stop at the same end, the line moves on.
    player.last.onTimeUpdate(39.8)
    player.last.onTimeUpdate(40.1)
    player.last.onTimeUpdate(40.35)
    await settle(60)
    expect(spies.pause).toHaveBeenCalledTimes(1)
    expect($('.anl-subs__count').textContent).toContain('2 / 2')
  })

  it('steps back inside a sentence whose end the clock crossed between two polls', async () => {
    await openVideo()
    $('button[aria-label="Pause à la fin de chaque phrase"]').click()
    await settle(30)
    player.last.onTimeUpdate(39.9)
    player.last.onTimeUpdate(40.2)
    await settle(60)
    expect(spies.pause).toHaveBeenCalled()
    expect(spies.seekTo).toHaveBeenLastCalledWith(39.95)
    expect($('.anl-subs__count').textContent).toContain('1 / 2')
  })

  // The current sentence in the middle of the rail, and still there when
  // the grammar's box under the rail comes or goes with the sentence.
  it('keeps the current sentence in the middle of the rail', async () => {
    // Every third line with a construction: the rail's height changes
    // as the clock moves from one to the next.
    session = {
      ...LONG,
      sentences: LONG.sentences.map((s, i) => (i % 3 ? s : { ...s, grammar: SESSION.sentences[0].grammar })),
    }
    await openVideo()
    const line = $('.anl-desk__rail .anl-line')
    const centred = () => {
      const stop = $('.anl-desk__rail .anl-stop[aria-current="true"]').getBoundingClientRect()
      const rail = line.getBoundingClientRect()
      return Math.abs((stop.top + stop.height / 2) - (rail.top + rail.height / 2))
    }
    // Line 20 (no grammar: the rail has the column), then 21 (grammar:
    // the rail gives half of it back).
    for (const [at, index] of [[121.5, 20], [125.5, 21], [129.5, 22]]) {
      player.last.onTimeUpdate(at)
      await settle(700)
      expect($('.anl-subs__count').textContent).toContain(`${index + 1} / 36`)
      expect(centred()).toBeLessThan(4)
    }
    expect(document.scrollingElement.scrollTop).toBe(0)
  })

  // 字幕の流れ: the subtitle's words read out as they are said -- the
  // ones said whole, the one being said filling, the ones to come faded.
  // 雨を見ている, 36s to 40s, no times of its own: its eight beats (雨 2,
  // を 1, 見 2, て 1, いる 2) spread half a second a beat.
  it('lights the subtitle\'s words as they are said', async () => {
    await openVideo()
    const toks = () => $$('.anl-subs__line .tok')
    expect($('.tok-line--sung')).toBeNull()
    player.last.onTimeUpdate(37.1)
    await expect.poll(() => $('.anl-subs__line.tok-line--sung')).not.toBeNull()
    expect(toks()[0].classList.contains('tok--said')).toBe(true)
    expect(toks()[1].classList.contains('tok--saying')).toBe(true)
    expect(toks()[1].style.getPropertyValue('--said')).toBe('20%')
    expect(toks()[2].className).not.toMatch(/tok--sa(id|ying)/)
    // The words to come are faded by the mask; the rule under each
    // word, the SRS's, is not.
    expect(getComputedStyle(toks()[2].querySelector('.tok__word')).maskImage).toContain('gradient')
    expect(getComputedStyle(toks()[2]).borderBottomStyle).toBe('solid')
    // The next line is read out in its turn...
    player.last.onTimeUpdate(40.5)
    await expect.poll(() => $('.anl-subs__line .tok--saying')?.textContent).toContain('駅')
    expect($('.anl-subs__count').textContent).toContain('2 / 2')
    // ...and past the last one's end, the line reads plain again.
    player.last.onTimeUpdate(44.5)
    await expect.poll(() => $('.tok-line--sung')).toBeNull()
    expect($$('.anl-subs__line .tok[style]').length).toBe(0)
  })

  it('reads the words out on the times the line carries', async () => {
    session = {
      ...SESSION,
      sentences: [{ ...SESSION.sentences[0], word_times: [[0, 37], [2, 38]] }, SESSION.sentences[1]],
    }
    await openVideo()
    player.last.onTimeUpdate(36.5)
    // Before its first word the line waits, every word to come.
    await expect.poll(() => $('.tok-line--sung')).not.toBeNull()
    expect($$('.anl-subs__line .tok--said, .anl-subs__line .tok--saying').length).toBe(0)
    player.last.onTimeUpdate(38.1)
    await expect.poll(() => $$('.anl-subs__line .tok')[2].classList.contains('tok--saying')).toBe(true)
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
