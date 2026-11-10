import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { encodeWav, RATE } from './lib/songAudio'
import './index.css'

// ── 歌 — a song's audio on the desk (plan 317) ────────────────────────
// The song is the desk's fourth platform, its intake in the column
// beside the passages, and the page takes a dropped song as it takes a
// dropped picture or subtitle file. Its Passage stands on the slab as
// lyrics from the start: no picture, and no fold on the bar. Reopened
// where the file was not kept, the slab's foot asks for it where the
// bar would be. The phone's side is screens/AnalyzerScreen.songfile.phone.

const tok = (surface, start, pos) => ({
  surface, start, end: start + surface.length, reading: surface, pos, vocab_match: null, grammar: [],
})
const line = (text, at, [a, b, c]) => ({
  text, cue_start: at, cue_end: at + 2, grammar: [], unknown_count: 1, available: true, level: 'N5',
  tokens: [tok(a, 0, 'noun'), tok(b, a.length, 'particle'), tok(c, a.length + b.length, 'verb')],
})
const LINES = [
  line('夜が来る', 1, ['夜', 'が', '来る']),
  line('君を呼ぶ', 3, ['君', 'を', '呼ぶ']),
  line('星が光る', 5, ['星', 'が', '光る']),
]
const songSession = sourceRef => ({
  status: 'ready', source: 'song', sourceRef, videoId: null,
  windowCapped: false, truncated: 0, sentences: LINES,
})
const ROW = {
  id: 7, sourceRef: 'ma-chanson.mp3', source: 'song', createdAt: new Date().toISOString(),
  sentenceCount: 3, videoId: null, firstLine: '夜が来る',
}

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
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
const kept = new Map()
const keepSong = vi.fn(async (id, file) => { kept.set(id, file) })
vi.mock('./lib/songStore', () => ({
  keepSong: (...a) => keepSong(...a),
  songFile: async id => kept.get(id) ?? null,
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')

const settle = (ms = 100) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

function tone(name = 'ma-chanson.wav') {
  const samples = Float32Array.from({ length: RATE }, (_, i) => 0.4 * Math.sin(i / 8))
  return new File([encodeWav(samples, RATE)], name, { type: 'audio/wav' })
}

function serve({ rows = [] } = {}) {
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    if (url === '/api/video/session/9') return songSession('ma-chanson.wav')
    if (url === '/api/video/session/7') return songSession('ma-chanson.mp3')
    if (String(url).endsWith('/translations')) return { start: 0, lines: ['La nuit vient', 'Je t’appelle', 'Une étoile brille'] }
    return {}
  })
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => ({
    ok: true, status: 200, json: async () => (url === '/api/video/sessions' ? rows : []),
  }))
}

let play
beforeEach(() => {
  serve()
  apiUpload.mockReset()
  apiUpload.mockResolvedValue({ sessionId: 9, status: 'generating', windowCapped: false })
  keepSong.mockClear()
  kept.clear()
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})
afterEach(() => { play.mockRestore() })

async function mount() {
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
  await vi.waitFor(() => expect($$('.anl-sources .seg__opt')).toHaveLength(4))
  await settle(60)
}

function choose(input, file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('the song on the desk', () => {
  it('is the fourth platform, its intake in the column, every label whole', async () => {
    await mount()
    const options = $$('.anl-sources .seg__opt')
    expect(options.map(o => o.textContent)).toEqual(['Texte', 'Photo', 'Vidéo', 'Chanson'])
    // The column is one width at every desk width, and a French label
    // is the longest: the four stand whole in it, none cut at its edge.
    const seg = $('.anl-sources')
    expect(seg.scrollWidth).toBeLessThanOrEqual(seg.clientWidth)
    for (const o of options) {
      expect(o.scrollWidth, o.textContent).toBeLessThanOrEqual(o.clientWidth)
      expect(o.getBoundingClientRect().right, o.textContent).toBeLessThanOrEqual(seg.getBoundingClientRect().right + 0.5)
    }
    options[3].click()
    await vi.waitFor(() => expect($('.desk-intake__side #anl-panel-song .anl-uta')).not.toBeNull())
    // The sheet the phone opens, in the column (plan 317b, L2): the one
    // button that picks a song, and the lyrics once one is picked.
    expect($('.anl-uta__pick').textContent).toBe('Choisir une chanson')
    expect($('.anl-uta__field')).toBeNull()
    choose($('#anl-panel-song input[type="file"]'), tone('ma-chanson.mp3'))
    await vi.waitFor(() => expect($('.anl-uta__field')).not.toBeNull())
    // On the page, the song's row steps up to the surface, as a field
    // there does.
    const ground = el => getComputedStyle(el).backgroundColor
    expect(ground($('.anl-uta__file'))).toBe(ground($('.anl-uta__field')))
    expect(ground($('.anl-uta__file'))).not.toBe(ground(document.body))
  })

  it('takes a song dropped on the page onto its platform, picked', async () => {
    await mount()
    const dt = new DataTransfer()
    dt.items.add(tone('dropped.wav'))
    $('.desk-intake').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect($('#anl-panel-song .anl-uta__name b')?.textContent).toBe('dropped.wav'))
    expect($('.anl-sources .seg__opt--on').textContent).toBe('Chanson')
    expect($('.anl-uta__go').disabled).toBe(false)
  })

  it('waits at the head of the shelf, a card that opens nothing, while it is transcribed', async () => {
    serve({ rows: [ROW] })
    const answer = apiJson.getMockImplementation()
    apiJson.mockImplementation(async url => (url === '/api/video/session/9' ? { status: 'generating' } : answer(url)))
    await mount()
    $$('.anl-sources .seg__opt')[3].click()
    await vi.waitFor(() => expect($('#anl-panel-song input[type="file"]')).not.toBeNull())
    choose($('#anl-panel-song input[type="file"]'), tone())
    await vi.waitFor(() => expect($('.anl-uta__go').disabled).toBe(false))
    $('.anl-uta__go').click()

    await vi.waitFor(() => expect($('.anl-card--wait')).not.toBeNull(), { timeout: 3000 })
    const cards = $$('.anl-shelf__grid > .anl-card')
    expect(cards[0].classList.contains('anl-card--wait')).toBe(true)
    expect(cards[0].querySelector('.anl-card__src').textContent).toBe('Chanson')
    expect(cards[0].querySelector('.anl-card__jp').textContent).toBe('ma-chanson.wav')
    expect(cards[0].querySelector('.anl-wait').textContent).toBe('Transcription')
    expect(cards[0].querySelector('button')).toBeNull()
    // The song already listed stands after it.
    expect(cards[1].classList.contains('anl-card--song')).toBe(true)
    expect($('.anl-uta__go').textContent).toBe('…')
  })

  it('plays a song as lyrics, with no picture and no fold on the bar', async () => {
    await mount()
    $$('.anl-sources .seg__opt')[3].click()
    await vi.waitFor(() => expect($('#anl-panel-song input[type="file"]')).not.toBeNull())
    const file = tone()
    choose($('#anl-panel-song input[type="file"]'), file)
    await vi.waitFor(() => expect($('.anl-uta__go').disabled).toBe(false))
    $('.anl-uta__go').click()
    await vi.waitFor(() => expect($('.anl-desk__lyrics')).not.toBeNull(), { timeout: 3000 })
    await settle()

    expect(apiUpload.mock.calls[0][0]).toBe('/api/video/song')
    expect(keepSong).toHaveBeenCalledWith(9, file)
    expect($('.anl-desk--lyrics')).not.toBeNull()
    expect($('.anl-slab--folded')).not.toBeNull()
    // Where the picture would be, the song's name (plan 317b, N1); the
    // bar prints its clock, so the name's line does not.
    const now = $('.anl-slab > .anl-now')
    expect(now.querySelector('.anl-now__name').textContent).toBe('ma-chanson')
    expect(now.querySelector('.anl-now__clock')).toBeNull()
    expect(now.getBoundingClientRect().bottom).toBeLessThanOrEqual($('.anl-desk__lyrics').getBoundingClientRect().top)
    expect($('.anl-slab__screen').getBoundingClientRect().height).toBe(0)
    expect($('.anl-desk__rail')).toBeNull()
    expect($('button[aria-label="Masquer la vidéo"]')).toBeNull()
    expect($('button[aria-label="Afficher la vidéo"]')).toBeNull()
    expect($('audio')?.getAttribute('src')).toMatch(/^blob:/)
    const main = $('.anl-slab .anl-pbar .anl-player__btn--main')
    expect(main).not.toBeNull()
    main.click()
    await vi.waitFor(() => expect(play).toHaveBeenCalled())
  })

  it('asks for the file at the slab’s foot where it was not kept', async () => {
    serve({ rows: [ROW] })
    await mount()
    await vi.waitFor(() => expect($('.anl-card--song .anl-card__open')).not.toBeNull())
    expect($('.anl-card--song .anl-card__src').textContent).toBe('Chanson')
    $('.anl-card--song .anl-card__open').click()
    await vi.waitFor(() => expect($('.anl-slab .anl-refile')).not.toBeNull(), { timeout: 3000 })
    await settle()

    expect($('.anl-slab .anl-pbar')).toBeNull()
    expect($('.anl-desk__lyrics .anl-subs__line')).not.toBeNull()
    expect($('.anl-refile__go').textContent).toBe('Choisir le fichier pour écouter')
    // The note in the panel's soft ink: the slab is sumi in both themes.
    const ink = getComputedStyle($('.anl-refile__note')).color
    expect(ink).not.toBe(getComputedStyle($('.anl-desk--lyrics')).color)
    // At the slab's foot, inside it.
    const slab = $('.anl-slab').getBoundingClientRect()
    const refile = $('.anl-refile').getBoundingClientRect()
    expect(refile.bottom).toBeLessThanOrEqual(slab.bottom + 1)
    expect(refile.left).toBeGreaterThanOrEqual(slab.left)

    const file = tone('ma-chanson.mp3')
    choose($('.anl-refile input[type="file"]'), file)
    await vi.waitFor(() => expect($('audio')?.getAttribute('src')).toMatch(/^blob:/))
    expect($('.anl-refile')).toBeNull()
    expect($('.anl-slab .anl-pbar .anl-player__btn--main')).not.toBeNull()
    expect(keepSong).toHaveBeenCalledWith(7, file)
  })
})
