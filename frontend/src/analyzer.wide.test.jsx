import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the analyser's video Passage on three columns (plans 134, 238) ──
// The owner's pick C of the canvas "Tsuji analyser — the desk and
// Explain" at a laptop's full width: the lines on the left, each over
// its translation; the video edge to edge with no arrows beside it, the
// line as its subtitle and the player's bar as one sumi object, the
// line's words on a strip under it, in the middle; one panel on the
// right whose segment turns it between the word, the line's grammar and
// its construction -- the desk's rail stepped aside, all three inside
// the window, each scrolling itself.
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
// How far each word of the subtitle has been said, as written onto it.
const saidOf = () => $$('.anl-subs__line .tok').map(el => el.style.getPropertyValue('--said'))

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
  it('stands the lines, the sumi object and the panel side by side, inside the window', async () => {
    await openVideo()
    expect($('.anl-desk')).not.toBeNull()
    // The rail steps aside: the result has the window.
    expect(getComputedStyle($('.phone--desk')).paddingInlineStart).toBe('0px')
    const rail = box('.anl-desk__rail')
    const slab = box('.anl-slab')
    const right = box('.anl-desk__entry')
    expect(rail.right).toBeLessThanOrEqual(slab.left)
    expect(slab.right).toBeLessThanOrEqual(right.left)
    // The drawing's shares: 270 | 676 | 400.
    expect(slab.width / rail.width).toBeGreaterThan(2.2)
    expect(slab.width / right.width).toBeGreaterThan(1.5)
    // The lines alone on the left: the grammar is a face of the panel.
    expect($('.anl-desk__rail .anl-stop')).not.toBeNull()
    expect($('.anl-desk__points')).toBeNull()
    // The video edge to edge on the sumi's top, no arrows beside it; the
    // subtitle, then the bar, in one object.
    expect($('.anl-slab [data-testid="player"]')).not.toBeNull()
    expect($('.anl-slab__arrow')).toBeNull()
    const video = box('.anl-slab__video')
    expect(Math.abs(video.left - slab.left)).toBeLessThan(1)
    expect(Math.abs(video.right - slab.right)).toBeLessThan(1)
    expect(Math.abs(video.top - slab.top)).toBeLessThan(1)
    expect(box('.anl-subs').top).toBeGreaterThan(box('.anl-slab__screen').bottom - 1)
    expect(box('.anl-pbar').top).toBeGreaterThan(box('.anl-subs').bottom - 1)
    // The line's words on one strip under it, at the desk's foot; no card
    // beside them -- the panel is that card.
    const strip = box('.anl-desk__strip')
    expect(strip.top).toBeGreaterThan(slab.bottom - 1)
    expect(Math.abs(strip.left - slab.left)).toBeLessThan(1)
    expect(Math.abs(strip.bottom - box('.anl-desk').bottom)).toBeLessThan(2)
    expect($$('.anl-strip__chip .anl-words__word').map(w => w.textContent)).toEqual(['雨', '見る'])
    expect($('.anl-focus, .anl-desk__work, .anl-swap')).toBeNull()
    // The panel: its segment over the word's band.
    expect($$('.anl-faces .seg__opt').map(o => o.textContent)).toEqual(['Mot雨', 'Grammaire2', 'Construction'])
    expect($('.anl-faces .seg__opt--on').textContent).toBe('Mot雨')
    expect(box('.anl-faces').bottom).toBeLessThanOrEqual(box('.anl-desk__entry .dict-entry__top').top)
    // Nothing past the window: each column scrolls in itself.
    expect(document.scrollingElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
    expect(document.scrollingElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('gives the picture more of the window than the drawing before it', async () => {
    await openVideo()
    // Plan 134's picture was 69dvh wide, 621px at 900; edge to edge in
    // the wider column it is the column's whole width.
    expect(box('.anl-slab__video').width).toBeGreaterThan(0.69 * window.innerHeight + 40)
    expect(box('.anl-slab__video').height).toBeGreaterThan(0)
  })

  it('keeps the head and the bar whole when the list of lines is long', async () => {
    session = LONG
    await openVideo()
    const rail = box('.anl-desk__rail')
    const slab = box('.anl-slab')
    // The list scrolls in its panel; it does not stretch the rows beside it.
    expect(box('.anl-desk__head').height).toBeLessThan(80)
    const gap = parseFloat(getComputedStyle($('.anl-desk')).rowGap)
    expect(Math.abs(slab.top - (box('.anl-desk__head').bottom + gap))).toBeLessThan(2)
    expect(Math.abs(rail.bottom - box('.anl-desk').bottom)).toBeLessThan(2)
    // The sumi object whole: its subtitle and its bar inside it.
    expect(box('.anl-pbar').bottom).toBeLessThanOrEqual(slab.bottom + 1)
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
      // The rail scrolls smoothly, and under a full run's load it was
      // still 367px short after the 700ms: waited for until it lands,
      // then read again, so a stop passing the middle does not count.
      await vi.waitFor(() => expect(centred()).toBeLessThan(4), { timeout: 3000 })
      await settle()
      expect(centred()).toBeLessThan(4)
    }
    expect(document.scrollingElement.scrollTop).toBe(0)
  })

  // 字幕の流れ: the subtitle's words read out as they are said -- the
  // ones said whole, the one being said filling, the ones to come faded.
  // 雨を見ている, 36s to 40s, no times of its own: its eight beats (雨 2,
  // を 1, 見 2, て 1, いる 2) and its last held half a beat longer, 8.5
  // over four seconds. Each word's fill is written straight onto it,
  // every word in the same frame, so the one just said never reads faded
  // while the next one starts.
  it('lights the subtitle\'s words as they are said', async () => {
    await openVideo()
    expect($('.anl-subs__line[data-sung]')).toBeNull()
    player.last.onTimeUpdate(37.1)
    // Read on the poll itself, paused: no frame is waited for.
    expect($('.anl-subs__line[data-sung]')).not.toBeNull()
    expect(saidOf()).toEqual(['100%', '34%', '0%', '0%', '0%'])
    // The words to come are faded by the mask; the rule under each
    // word, the SRS's, is not.
    const toks = $$('.anl-subs__line .tok')
    expect(getComputedStyle(toks[2].querySelector('.tok__word')).maskImage).toMatch(/0\.4\)/)
    expect(getComputedStyle(toks[2]).borderBottomStyle).toBe('solid')
    // The next line is read out in its turn: 駅 two beats of 6.5 over
    // four seconds (待つ, read by its letters, is three, and held half
    // a beat more), 0.3s into its 1.23.
    player.last.onTimeUpdate(40.3)
    await expect.poll(() => $('.anl-subs__count').textContent).toContain('2 / 2')
    expect(saidOf()).toEqual(['24%', '0%', '0%'])
    // ...and past the last one's end, the line reads plain again.
    player.last.onTimeUpdate(44.5)
    expect($('.anl-subs__line[data-sung]')).toBeNull()
    expect($$('.anl-subs__line .tok[style]').length).toBe(0)
    // Still under a mask, an opaque one: a masked glyph is smoothed in
    // greyscale and a plain one in subpixel, so dropping the mask when
    // the line ends made every word twitch just after it was lit whole.
    const plain = getComputedStyle($('.anl-subs__line .tok__word')).maskImage
    expect(plain).toContain('gradient')
    expect(plain).not.toMatch(/0\.4\)/)
  })

  // The analyser's screen does not render on the poll: the bar and the
  // subtitle read the playhead themselves. The bar's clock is the
  // video's, 0 to its length, the figures YouTube's own bar prints.
  it('prints the video\'s own clock, to its length', async () => {
    await openVideo()
    const time = () => $('.anl-pbar .anl-player__time').textContent
    const knob = () => parseFloat($('.anl-pbar__knob').style.left)
    // Before the player knows the length, the last cue's end stands in.
    player.last.onTimeUpdate(37)
    await expect.poll(time).toBe('0:37 / 0:44')
    player.last.onDurationChange(247)
    await expect.poll(time).toBe('0:37 / 4:07')
    expect(knob()).toBeCloseTo((100 * 37) / 247, 3)
    // Past the Passage's last line the clock goes on with the video.
    player.last.onTimeUpdate(228)
    await expect.poll(time).toBe('3:48 / 4:07')
    // The poll renders the bar and the subtitle, not the screen (the
    // player, a child of it, is drawn again only when the screen is).
    const renders = player.renders
    for (const at of [228.25, 228.5, 228.75, 229]) player.last.onTimeUpdate(at)
    await expect.poll(time).toBe('3:49 / 4:07')
    expect(player.renders).toBe(renders)
    // The track seeks the video, not the window: its middle is the
    // video's (a whole pixel's worth off, the click's x being one).
    const track = $('.anl-pbar__track').getBoundingClientRect()
    $('.anl-pbar__track').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: track.left + track.width / 2, clientY: track.top + 1 }))
    const [seek] = spies.seekTo.mock.lastCall
    expect(Math.abs(seek - 247 / 2)).toBeLessThanOrEqual(247 / track.width)
  })

  // 追従 on time: while the video plays, the next line comes in focus at
  // its cue, on the clock carried from the last poll -- not on the poll
  // after it, up to a quarter second late -- and a poll a little behind
  // the clock does not send it back.
  it('moves the line on at the next line\'s cue, not on the next poll', async () => {
    await openVideo()
    player.last.onPlayingChange(true)
    player.last.onTimeUpdate(39.8)
    expect($('.anl-subs__count').textContent).toContain('1 / 2')
    await expect.poll(() => $('.anl-subs__count').textContent, { timeout: 1500 }).toContain('2 / 2')
    player.last.onTimeUpdate(39.9)
    await settle(60)
    expect($('.anl-subs__count').textContent).toContain('2 / 2')
  })

  it('reads the words out on the times the line carries', async () => {
    session = {
      ...SESSION,
      sentences: [{ ...SESSION.sentences[0], word_times: [[0, 37], [2, 38]] }, SESSION.sentences[1]],
    }
    await openVideo()
    player.last.onTimeUpdate(36.5)
    // Before its first word the line waits, every word to come.
    expect($('.anl-subs__line[data-sung]')).not.toBeNull()
    expect(saidOf()).toEqual(['0%', '0%', '0%', '0%', '0%'])
    // 見 from 38s: 見, て, いる share 38s to 40s by their beats (2, 1,
    // 2 and the last held half a beat more).
    player.last.onTimeUpdate(38.1)
    expect(saidOf()).toEqual(['100%', '100%', '14%', '0%', '0%'])
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
    faceNamed('Grammaire').click()
    await settle()
    expect($('.anl-face__points .anl-num').textContent).toBe('1')
    $('button[aria-label="Phrase suivante"]').click()
    await settle()
    expect($('.anl-subs__count').textContent).toContain('2 / 2')
    expect(spies.seekTo).toHaveBeenLastCalledWith(40)
    // A sentence with no construction has no grammar face: the panel
    // gives the word back.
    expect($$('.anl-faces .seg__opt').map(o => o.textContent)).toEqual(['Mot駅', 'Construction'])
    expect($('.anl-face__points')).toBeNull()
    expect($('.anl-desk__entry .dict-plate__word').textContent).toBe('駅')
  })
})

// ── 面 — the panel's three faces (plan 238) ──────────────────────
// The way between the word, the line's grammar and its construction is
// the panel's own segment: no swap on the column's edge, no way back to
// look for. A point opens its lesson in the grammar face, its ✕ giving
// the list back; Esc walks back one step at a time; the construction is
// bought the first time its face is turned to, the line at its head
// with its points numbered as on the subtitle.
const faceNamed = name => $$('.anl-faces .seg__opt').find(o => o.textContent.startsWith(name))
const EXPLANATION = 'Le cœur est 見ている : を fait de 雨 l’objet de 見る.'
function answering({ translations = null } = {}) {
  apiJson.mockImplementation(async url => {
    const u = String(url)
    if (u.includes('/translations')) return translations ?? { start: 0, lines: [] }
    if (u.includes('/explain')) return { ...session.sentences[0], explanation: EXPLANATION }
    return session
  })
}

describe('the panel\'s three faces (plan 238)', () => {
  it('turns to the line\'s grammar, opens a point in it, and its ✕ gives the list back', async () => {
    apiFetch.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/dictionary?')) {
        const params = new URLSearchParams(u.split('?')[1])
        if (params.get('id') === 'grammar_N5_teiru') {
          return ok({ results: [{ type: 'grammar', raw_id: 'grammar_N5_teiru', pattern: '〜ている', level: 'N5', meaning: 'ongoing', status: { status: 'new' } }], total: 1, has_more: false })
        }
        const q = params.get('q')
        return ok({ results: ENTRIES[q] ? [ENTRIES[q]] : [], total: ENTRIES[q] ? 1 : 0, has_more: false })
      }
      return ok([])
    })
    await openVideo()
    faceNamed('Grammaire').click()
    await settle()
    expect(faceNamed('Grammaire').getAttribute('aria-checked')).toBe('true')
    expect($$('.anl-face__points .bkd-point__pattern').map(p => p.textContent)).toEqual(['を', '〜ている'])
    $$('.anl-face__points .bkd-point')[1].click()
    await expect.poll(() => $('.anl-desk__entry .dict-plate__word')?.textContent).toBe('〜ている')
    // Still the grammar face, the point's lesson in it.
    expect(faceNamed('Grammaire').getAttribute('aria-checked')).toBe('true')
    expect($('.anl-face__points')).toBeNull()
    $('.anl-desk__entry button[aria-label="Fermer"]').click()
    await settle()
    expect($$('.anl-face__points .bkd-point').length).toBe(2)

    // The word's face holds the word all along.
    faceNamed('Mot').click()
    await settle()
    expect($('.anl-desk__entry .dict-plate__word').textContent).toBe('雨')
  })

  it('walks back one step per Esc: the point, the list, the word', async () => {
    await openVideo()
    faceNamed('Grammaire').click()
    await settle()
    $$('.anl-face__points .bkd-point')[0].click()
    await settle()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect($$('.anl-face__points .bkd-point').length).toBe(2)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(faceNamed('Mot').getAttribute('aria-checked')).toBe('true')
  })

  it('buys the construction the first time its face is turned to, the line at its head', async () => {
    answering()
    await openVideo()
    faceNamed('Construction').click()
    await expect.poll(() => $('.anl-explainpanel__body')?.textContent).toBe(EXPLANATION)
    expect(apiJson.mock.calls.filter(([u]) => String(u).includes('/explain')).length).toBe(1)
    // The line, each point framed under its number as on the subtitle.
    expect($('.anl-built').textContent).toContain('雨')
    expect($$('.anl-built__n').map(n => n.textContent)).toEqual(['1', '2'])
    expect($$('.anl-built__pt').map(p => p.textContent)).toEqual(['1を', '2ている'])
    // The word's face and back: no second call.
    faceNamed('Mot').click()
    await settle()
    expect($('.anl-explainpanel')).toBeNull()
    faceNamed('Construction').click()
    await settle()
    expect($('.anl-explainpanel__body').textContent).toBe(EXPLANATION)
    expect(apiJson.mock.calls.filter(([u]) => String(u).includes('/explain')).length).toBe(1)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(faceNamed('Mot').getAttribute('aria-checked')).toBe('true')
  })

  it('turns to the word when a word is pressed, on the strip or on the line', async () => {
    answering()
    // Asked for, and found missing, by an earlier test: the lookups are
    // cached for the session.
    const { clearLookupCache } = await import('./lib/dictionaryLookup')
    clearLookupCache()
    ENTRIES.見る = entry('見る', 'みる', 'to see')
    await openVideo()
    faceNamed('Grammaire').click()
    await settle()
    $$('.anl-strip__chip').at(-1).click()
    await expect.poll(() => $('.anl-desk__entry .dict-plate__word')?.textContent).toBe('見る')
    expect(faceNamed('Mot').getAttribute('aria-checked')).toBe('true')
    expect($('.anl-strip__chip--on').textContent).toContain('見る')
    expect($('.anl-subs .tok--on').textContent).toContain('見')
    delete ENTRIES.見る
  })
})

// ── 訳 — the lines read as a bilingual transcript (plan 238) ─────────
describe('the lines on the left, each over its translation', () => {
  it('prints each line\'s translation under it, and finds a line by its French', async () => {
    answering({ translations: { start: 0, lines: ['Je regarde la pluie', 'J’attends à la gare'] } })
    await openVideo()
    await expect.poll(() => $$('.anl-desk__rail .anl-stop__tr').map(t => t.textContent))
      .toEqual(['Je regarde la pluie', 'J’attends à la gare'])
    expect($('.anl-desk__rail .anl-stop__tr').getAttribute('lang')).toBe('fr')
    // Under the Japanese, inside the stop, the time beside both.
    const stop = $$('.anl-desk__rail .anl-stop')[1]
    expect(stop.querySelector('.anl-stop__tr').getBoundingClientRect().top)
      .toBeGreaterThan(stop.querySelector('.anl-stop__text').getBoundingClientRect().bottom - 1)
    expect(stop.getAttribute('aria-label')).toContain('J’attends à la gare')
    expect(stop.querySelector('.anl-stop__meta .anl-stop__time').textContent).toBe('0:40')
    // The search reads the translation too.
    const search = $('.anl-railhead__search')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'gare')
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    expect($$('.anl-desk__rail .anl-stop__text').map(t => t.textContent)).toEqual(['駅で待つ'])
  })
})
