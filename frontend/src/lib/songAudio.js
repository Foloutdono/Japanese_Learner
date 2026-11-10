// ── 歌 — a song made small enough to be heard (plan 315) ─────────────
// The analyser's song is heard on the server by a model that takes
// audio (backend study/song_transcribe.py), at 16 kHz on one channel.
// So the browser decodes the learner's file -- whatever it can play:
// MP3, AAC/M4A, OGG, FLAC, WAV -- straight to that rate, folds it to one
// channel and writes it as a 16-bit PCM WAV: 32 kB a second, a
// four-minute song under 8 MB whatever the file was, and one format for
// the server to read. Cut at MAX_SECONDS, which the server holds too.
//
// This copy only travels to be heard and is not kept anywhere: the song
// plays from the learner's own file, untouched (lib/songStore.js keeps
// that on the device).

export const RATE = 16000
// study/song_transcribe.MAX_SECONDS (songAudio.test.js holds them equal).
export const MAX_SECONDS = 7 * 60
// What a song's file input offers: the MIME types are what a phone's
// picker matches on, the extensions what a desktop's does.
export const SONG_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm'
const SONG_FILE = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i
const EXTENSION = /\.([a-z0-9]{2,5})$/i

/** What a song is called, as near as the device knows: its file's name
 *  without the extension (ma-chanson.mp3 is "ma-chanson"). */
export function songName(fileName) {
  return (fileName || '').replace(EXTENSION, '')
}

/** The file's kind as its extension says it, in capitals (MP3), or ''. */
export function songKind(fileName) {
  return (fileName || '').match(EXTENSION)?.[1].toUpperCase() ?? ''
}

/** Whether a file dropped on the desk's page is a song: an audio type,
 *  or, where the system gave none, an audio file's name. */
export function isSongFile(file) {
  if (!file) return false
  const type = file.type || ''
  if (type.startsWith('audio/')) return true
  return !type && SONG_FILE.test(file.name || '')
}

/** The song as the server hears it: `{ wav, seconds, cut }` -- the WAV
 *  Blob, how long the song is, and whether it was cut at
 *  `maxSeconds`. Rejects when this browser cannot decode the file. */
export async function songForHearing(file, { maxSeconds = MAX_SECONDS } = {}) {
  const bytes = await file.arrayBuffer()
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  // decodeAudioData resamples to its context's rate, so a context of one
  // frame at 16 kHz is all the decoding needs.
  const decoder = new Offline(1, 1, RATE)
  const decoded = await new Promise((resolve, reject) => {
    // The callback form as well as the promise: older WebKit has only it.
    const pending = decoder.decodeAudioData(bytes, resolve, reject)
    if (pending?.then) pending.then(resolve, reject)
  })
  const frames = Math.min(decoded.length, Math.round(maxSeconds * RATE))
  return {
    wav: encodeWav(mixDown(decoded, frames), RATE),
    seconds: decoded.duration,
    cut: decoded.duration > maxSeconds,
  }
}

/** The first `frames` of every channel of `buffer` (an AudioBuffer, or
 *  anything with its numberOfChannels and getChannelData), averaged. */
export function mixDown(buffer, frames = buffer.length) {
  const out = new Float32Array(frames)
  const channels = buffer.numberOfChannels
  for (let c = 0; c < channels; c += 1) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < frames; i += 1) out[i] += data[i] / channels
  }
  return out
}

/** `samples` (-1..1) as a mono 16-bit PCM WAV Blob at `rate`. */
export function encodeWav(samples, rate = RATE) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (at, s) => { for (let i = 0; i < s.length; i += 1) view.setUint8(at + i, s.charCodeAt(i)) }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)        // the fmt chunk's size
  view.setUint16(20, 1, true)         // PCM
  view.setUint16(22, 1, true)         // one channel
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)  // bytes a second
  view.setUint16(32, 2, true)         // bytes a frame
  view.setUint16(34, 16, true)        // bits a sample
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}

/** How long `file` plays, in seconds, read from its metadata alone --
 *  no decoding -- or null when this browser cannot tell. */
export function fileSeconds(file, { timeoutMs = 8000 } = {}) {
  return new Promise(resolve => {
    let url = null
    let done = false
    const audio = document.createElement('audio')
    const finish = value => {
      if (done) return
      done = true
      clearTimeout(timer)
      audio.removeAttribute('src')
      if (url) URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : null)
    audio.onerror = () => finish(null)
    try {
      url = URL.createObjectURL(file)
      audio.src = url
    } catch {
      finish(null)
    }
  })
}
