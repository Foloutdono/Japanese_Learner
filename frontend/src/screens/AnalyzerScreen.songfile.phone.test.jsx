import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { encodeWav, RATE } from '../lib/songAudio'
import fr from '../locales/fr/index.js'
import '../index.css'

// ── 歌 — a song's audio on a phone (plan 315, the owner's pick S1) ────
// The entry line's ＋ (plan 315b, E3) opens the ways in, and the ♪'s
// row the song's sheet: the button that picks it, then the song as one
// row, the lyrics if the learner has them, Transcrire (L2). The browser
// writes the song as the server hears it and keeps the learner's own
// file on the device; the Passage the server makes plays from that
// file, as lyrics, under the song's name and clock (N1) -- no picture,
// so no pull to fold one. Reopened where the file was not kept, the
// dock asks for it once and plays.

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
  await vi.waitFor(() => expect($('button.anl-entry__add')).not.toBeNull())
  return screen
}

function choose(input, file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

async function openWays() {
  $('button.anl-entry__add').click()
  await vi.waitFor(() => expect($('[role="dialog"] .anl-ways')).not.toBeNull())
  await settle()
}

const way = name => [...document.querySelectorAll('.anl-way')].find(b => b.querySelector('b').textContent === name)

async function openSheet() {
  await openWays()
  way('Chanson').click()
  await vi.waitFor(() => expect($('[role="dialog"] #anl-panel-song')).not.toBeNull())
  await settle()
}

describe('the entry line’s ＋ (plan 315b, the owner’s pick E3)', () => {
  it('is the line’s one door: its sheet names every way in with what it takes', async () => {
    await mount()
    const entry = $('.anl-entry')
    expect(entry.querySelectorAll('button')).toHaveLength(1)
    const add = $('.anl-entry__add')
    expect(add.getAttribute('aria-label')).toBe('Ajouter une photo, une vidéo, une chanson ou des sous-titres')
    expect(add.getAttribute('aria-haspopup')).toBe('dialog')
    // The field has the line: its placeholder on one line of its own.
    const field = $('.anl-entry__field')
    expect(field.scrollHeight).toBeLessThanOrEqual(add.getBoundingClientRect().height + 8)

    await openWays()
    expect($('[role="dialog"]').getAttribute('aria-label')).toBe('Ajouter')
    const rows = [...document.querySelectorAll('.anl-way')].map(b => [b.querySelector('b').textContent, b.querySelector('b + span').textContent])
    expect(rows).toEqual([
      [fr.sourcePhoto, fr.sourcePhotoHint],
      [fr.sourceVideo, fr.sourceVideoHint],
      [fr.sourceSong, fr.sourceSongHint],
      [fr.entrySubtitles, fr.subtitleAccepted],
    ])
    for (const b of document.querySelectorAll('.anl-way')) expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('opens a platform’s sheet in its own place', async () => {
    await mount()
    await openWays()
    way('Vidéo').click()
    await vi.waitFor(() => expect($('[role="dialog"] #anl-panel-video')).not.toBeNull())
    expect($('.anl-ways')).toBeNull()
  })

  it('takes a subtitle file straight from its row', async () => {
    apiUpload.mockResolvedValueOnce({ sessionId: 11, status: 'generating', windowCapped: false })
    await mount()
    await openWays()
    const pick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    way('Fichier de sous-titres').click()
    expect(pick).toHaveBeenCalledTimes(1)
    pick.mockRestore()
    choose($('.anl-ways input[type="file"]'), new File(['1\n00:00:01,000 --> 00:00:03,000\n夜が来る\n'], 'x.srt', { type: 'text/plain' }))
    await vi.waitFor(() => expect(apiUpload).toHaveBeenCalled(), { timeout: 3000 })
    expect(apiUpload.mock.calls[0][0]).toBe('/api/video/session')
    await vi.waitFor(() => expect($('.anl-ways')).toBeNull())
  })
})

describe('the song’s sheet on a phone', () => {
  it('opens on the one button that picks a song, what it takes, and where its audio goes', async () => {
    await mount()
    await openSheet()
    const go = $('#anl-panel-song .anl-uta__go')
    expect(go.textContent).toBe('Transcrire')
    expect(go.disabled).toBe(true)
    expect($('#anl-panel-song .anl-uta__pick').textContent).toBe('Choisir une chanson')
    expect($('#anl-panel-song .anl-uta__hint').textContent).toBe('MP3, M4A, WAV… · jusqu’à 7 min')
    // The lyrics come once a song is picked (L2).
    expect($('#anl-panel-song textarea')).toBeNull()
    // Where the audio goes and where the song stays, said before it goes.
    expect([...document.querySelectorAll('#anl-panel-song .anl-uta__quiet span')].map(x => x.textContent)).toEqual([
      'L’audio est transcrit par Google, puis oublié.',
      'La chanson reste sur cet appareil.',
    ])
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('shows the song picked as one row, then the lyrics three lines tall', async () => {
    await mount()
    await openSheet()
    choose($('#anl-panel-song input[type="file"]'), tone())
    await vi.waitFor(() => expect($('.anl-uta__name b')?.textContent).toBe('ma-chanson.wav'))
    await vi.waitFor(() => expect($('.anl-uta__name span')?.textContent).toBe('0:01 · WAV'))
    expect($('.anl-uta__change').textContent).toBe('Changer')
    expect($('.anl-uta__pick')).toBeNull()
    expect($('.anl-uta__hint')).toBeNull()
    const field = $('#anl-panel-song textarea')
    expect(field.labels[0].textContent).toBe('Paroles' + 'facultatif')
    expect(field.getAttribute('placeholder')).toBe(fr.songLyricsHint)
    expect(field.getAttribute('lang')).toBe('ja')
    // Three lines tall, not the multi field's own start.
    const lines = field.clientHeight / parseFloat(getComputedStyle(field).lineHeight)
    expect(lines).toBeGreaterThan(2.9)
    expect(lines).toBeLessThan(4)
    // The row steps down to the page's ground in the sheet, as its field does.
    const ground = el => getComputedStyle(el).backgroundColor
    expect(ground($('.anl-uta__file'))).toBe(ground(document.body))
    expect($('#anl-panel-song .anl-uta__go').disabled).toBe(false)
    // The sheet holds the whole of it on the phone's screen.
    expect($('[role="dialog"]').getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
  })

  it('sends the song as the server hears it, keeps the file, and plays the lyrics from it', async () => {
    await mount()
    await openSheet()
    const file = tone()
    choose($('#anl-panel-song input[type="file"]'), file)
    await vi.waitFor(() => expect($('.anl-uta__name b')?.textContent).toBe('ma-chanson.wav'))
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
    // Where the picture would be, what plays: its name, then its clock
    // once the file's length is known (N1).
    expect($('.anl-m__player--song .anl-now__name').textContent).toBe('ma-chanson')
    // The clock runs to the Passage's end: here its last line, at 0:07,
    // outlasts the test's second and a half of tone.
    await vi.waitFor(() => expect($('.anl-now__clock')?.textContent).toBe('0:00 / 0:07'))
    const now = $('.anl-now').getBoundingClientRect()
    const track = $('.anl-ptrack').getBoundingClientRect()
    expect(now.bottom).toBeLessThanOrEqual(track.top)
    expect(track.top).toBeLessThanOrEqual($('.anl-m__lyrics').getBoundingClientRect().top)
    // The track stands in from the edges, as the lyrics do.
    expect(track.left).toBeGreaterThan($('.anl-m__player').getBoundingClientRect().left)

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
    // Its name stands; with nothing to play, no clock.
    expect($('.anl-now__name').textContent).toBe('ma-chanson')
    expect($('.anl-now__clock')).toBeNull()

    const file = tone('ma-chanson.mp3')
    choose($('.anl-refile input[type="file"]'), file)
    await vi.waitFor(() => expect($('audio')?.getAttribute('src')).toMatch(/^blob:/))
    expect($('.anl-refile')).toBeNull()
    expect($('.anl-pbar--stage .anl-player__btn--main')).not.toBeNull()
    expect(keepSong).toHaveBeenCalledWith(7, file)
  })
})
