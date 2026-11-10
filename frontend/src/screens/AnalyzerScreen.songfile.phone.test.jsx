import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { encodeWav, RATE } from '../lib/songAudio'
import '../index.css'

// ── 歌 — a song's audio on a phone (plan 315, the owner's pick S1) ────
// The ♪ on the entry line opens the song's sheet: the file, the lyrics
// if the learner has them, Transcrire. The browser writes the song as
// the server hears it and keeps the learner's own file on the device;
// the Passage the server makes plays from that file, as lyrics -- no
// picture, so no pull to fold one. Reopened where the file was not
// kept, the dock asks for it once and plays.

const tok = (surface, start, pos) => ({
  surface, start, end: start + surface.length, reading: surface, pos, vocab_match: null, grammar: [],
})
const line = (text, at, [a, b, c]) => ({
  text, cue_start: at, cue_end: at + 2, grammar: [], unknown_count: 1, available: true,
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
const apiFetch = vi.fn()
const apiUpload = vi.fn()
vi.mock('../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
  apiFetch: (...a) => apiFetch(...a),
  apiUpload: (...a) => apiUpload(...a),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn(), ensureDeck: vi.fn() }),
}))
// The device's keeping, held in the test's hand: what it has kept, and
// what it is asked to keep.
const kept = new Map()
const keepSong = vi.fn(async (id, file) => { kept.set(id, file) })
vi.mock('../lib/songStore', () => ({
  keepSong: (...a) => keepSong(...a),
  songFile: async id => kept.get(id) ?? null,
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)

// A real song, as far as a browser can tell: a second and a half of a
// tone, written as a WAV the device can decode.
const SECONDS = 1.5
function tone(name = 'ma-chanson.wav') {
  const samples = Float32Array.from({ length: RATE * SECONDS }, (_, i) => 0.4 * Math.sin(i / 8))
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
  window.localStorage.removeItem('tsuji.anlDisplay')
})
afterEach(() => { play.mockRestore() })

async function mount() {
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
  await vi.waitFor(() => expect($('button.anl-entry__tool[aria-label="Chanson"]')).not.toBeNull())
  return screen
}

function choose(input, file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

async function openSheet() {
  $('button.anl-entry__tool[aria-label="Chanson"]').click()
  await vi.waitFor(() => expect($('[role="dialog"] #anl-panel-song')).not.toBeNull())
  await settle()
}

describe('the song’s sheet on a phone', () => {
  it('opens from the ♪ on the entry line: a file, the lyrics if any, Transcrire', async () => {
    await mount()
    const tools = [...document.querySelectorAll('.anl-entry__tool')].map(b => b.getAttribute('aria-label'))
    // Between the video and the subtitle file, as drawn.
    expect(tools.indexOf('Chanson')).toBe(tools.indexOf('Vidéo') + 1)

    await openSheet()
    const go = $('#anl-panel-song .anl-uta__go')
    expect(go.textContent).toBe('Transcrire')
    expect(go.disabled).toBe(true)
    expect($('#anl-panel-song .anl-uta__pick').textContent).toContain('Choisir une chanson')
    expect($('#anl-panel-song .anl-uta__hint').textContent).toBe('MP3, M4A, WAV… · jusqu’à 7 min')
    // Where the audio goes, said before it goes.
    expect($('#anl-panel-song .anl-uta__quiet').textContent).toContain('envoyé à Google')
    const field = $('#anl-panel-song textarea')
    expect(field.labels[0].textContent).toContain('Paroles')
    expect(field.getAttribute('lang')).toBe('ja')
    // The sheet's own ground, a step down to the page's, as its field.
    const ground = el => getComputedStyle(el).backgroundColor
    expect(ground($('#anl-panel-song .anl-uta__drop'))).toBe(ground(document.body))
    // Nothing leaves the phone's width.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('sends the song as the server hears it, keeps the file, and plays the lyrics from it', async () => {
    await mount()
    await openSheet()
    const file = tone()
    choose($('#anl-panel-song input[type="file"]'), file)
    await vi.waitFor(() => expect($('.anl-uta__file')?.textContent).toBe('ma-chanson.wav'))
    await vi.waitFor(() => expect($('.anl-uta__length')?.textContent).toBe('0:01'))
    expect($('.anl-uta__pick').textContent).toBe('Changer')
    await userEvent.fill($('#anl-panel-song textarea'), '  夜が来る\n君を呼ぶ\n')
    $('#anl-panel-song .anl-uta__go').click()

    await vi.waitFor(() => expect(apiUpload).toHaveBeenCalledTimes(1), { timeout: 3000 })
    const [path, , form] = apiUpload.mock.calls[0]
    expect(path).toBe('/api/video/song')
    expect(form.get('name')).toBe('ma-chanson.wav')
    expect(form.get('lyrics')).toBe('夜が来る\n君を呼ぶ')
    const audio = form.get('audio')
    expect(audio.type).toBe('audio/wav')
    // One channel at 16 kHz, 16 bits: 44 bytes of header and 2 a sample.
    expect(audio.size).toBe(44 + 2 * RATE * SECONDS)
    // The learner's own file is what the device keeps, never the copy.
    expect(keepSong).toHaveBeenCalledWith(9, file)

    await vi.waitFor(() => expect($('.anl-m__lyrics')).not.toBeNull(), { timeout: 3000 })
    await settle()
    // A song has no picture: the lyrics from the start, nothing to fold.
    expect($('.anl-m--lyrics')).not.toBeNull()
    expect($('.anl-m__pull')).toBeNull()
    expect($('.video-player__frame')).toBeNull()
    expect($('audio')?.getAttribute('src')).toMatch(/^blob:/)
    expect($('.anl-refile')).toBeNull()

    // The dock's play plays the song's own file.
    const main = $('.anl-pbar--stage .anl-player__btn--main')
    expect(main.getAttribute('aria-label')).toBe('Lecture')
    main.click()
    await vi.waitFor(() => expect(play).toHaveBeenCalled())
  })

  it('waits at the head of the shelf while the song is transcribed', async () => {
    serve({ rows: [ROW] })
    // The server says "generating" until the test lets the song be ready.
    let heard = false
    const answer = apiJson.getMockImplementation()
    apiJson.mockImplementation(async url => (
      url === '/api/video/session/9' && !heard ? { status: 'generating' } : answer(url)
    ))
    await mount()
    await openSheet()
    choose($('#anl-panel-song input[type="file"]'), tone())
    await vi.waitFor(() => expect($('.anl-uta__go').disabled).toBe(false))
    $('.anl-uta__go').click()

    await vi.waitFor(() => expect($('.anl-row--wait')).not.toBeNull(), { timeout: 3000 })
    const rows = [...document.querySelectorAll('.anl-shelf__rows > .anl-row')]
    expect(rows).toHaveLength(2)
    const [wait] = rows
    expect(wait.classList.contains('anl-row--wait')).toBe(true)
    expect(wait.querySelector('.anl-row__jp').textContent).toBe('ma-chanson.wav')
    expect(wait.querySelector('.anl-row__lead').getAttribute('aria-label')).toBe('Chanson')
    expect(wait.querySelector('.anl-wait').textContent).toBe('Transcription')
    expect(wait.querySelectorAll('.loading__dot')).toHaveLength(3)
    // It opens nothing, and has nothing to delete.
    expect(wait.querySelector('button')).toBeNull()
    expect(document.body.textContent).toContain('Transcription de la chanson — cela peut prendre une minute.')

    heard = true
    await vi.waitFor(() => expect($('.anl-m__lyrics')).not.toBeNull(), { timeout: 4000 })
    expect($('.anl-row--wait')).toBeNull()
  })

  it('says a file this browser cannot decode before anything is sent', async () => {
    await mount()
    await openSheet()
    choose($('#anl-panel-song input[type="file"]'), new File(['pas du son'], 'faux.mp3', { type: 'audio/mpeg' }))
    await vi.waitFor(() => expect($('.anl-uta__go').disabled).toBe(false))
    $('.anl-uta__go').click()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Ce fichier audio ne peut pas être lu sur cet appareil.'), { timeout: 3000 })
    expect(apiUpload).not.toHaveBeenCalled()
    expect(keepSong).not.toHaveBeenCalled()
  })
})

describe('a song reopened from the shelf', () => {
  async function reopen() {
    serve({ rows: [ROW] })
    await mount()
    await vi.waitFor(() => expect($('.anl-row__open')).not.toBeNull())
    // Filed as a song, by its own mark.
    expect($('.anl-row__lead[aria-label="Chanson"]')).not.toBeNull()
    $('.anl-row__open').click()
    await vi.waitFor(() => expect($('.anl-m__lyrics')).not.toBeNull(), { timeout: 3000 })
    await settle()
  }

  it('plays at once where this device kept its file', async () => {
    kept.set(7, tone('ma-chanson.mp3'))
    await reopen()
    await vi.waitFor(() => expect($('audio')?.getAttribute('src')).toMatch(/^blob:/))
    expect($('.anl-refile')).toBeNull()
    expect($('.anl-pbar--stage .anl-player__btn--main')).not.toBeNull()
  })

  it('asks for the file where it was not kept, then keeps it and plays', async () => {
    await reopen()
    await vi.waitFor(() => expect($('.anl-refile')).not.toBeNull())
    // The lyrics stand; where the transport would be, the one way back
    // to the sound and why it is asked for.
    expect($('.anl-m__dock .anl-refile__go').textContent).toBe('Choisir le fichier pour écouter')
    expect($('.anl-refile__note').textContent).toBe('ma-chanson.mp3 est restée sur l’appareil où elle a été ajoutée.')
    expect($('.anl-pbar--stage')).toBeNull()
    expect($('audio')).toBeNull()
    expect($('.anl-m__lyrics .anl-subs__line')).not.toBeNull()

    const file = tone('ma-chanson.mp3')
    choose($('.anl-refile input[type="file"]'), file)
    await vi.waitFor(() => expect($('audio')?.getAttribute('src')).toMatch(/^blob:/))
    expect($('.anl-refile')).toBeNull()
    expect($('.anl-pbar--stage .anl-player__btn--main')).not.toBeNull()
    expect(keepSong).toHaveBeenCalledWith(7, file)
  })
})
