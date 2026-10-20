// ── A recording's sound, for the recogniser (plan 265) ────────────
// A film, an episode, a voice memo: anything the learner holds that
// has no subtitles is heard into lines by the server's speech
// recogniser (backend/study/transcribe.py). What leaves the device is
// never the file. The browser decodes it, keeps the sound alone, mixes
// it to one channel at 16 kHz (what the recogniser listens at), cuts
// it to the window the learner asked for, and encodes that as a 32 kbps
// MP3: ten minutes is ~2.4 MB where the film was a gigabyte, and the
// picture never leaves the device at all.
//
// MP3 because it is the one compressed format every browser can write
// without a native encoder (lamejs is LAME in JavaScript, LGPL-3.0,
// loaded only when a recording is first made: THIRD_PARTY_NOTICES.md),
// and the server measures it from its own frames, which is what the
// day's minutes are counted in.
//
// Decoding is the browser's: decodeAudioData reads whatever its media
// stack reads (MP3, AAC/M4A, MP4 and WebM films, Ogg, WAV, FLAC; a
// Matroska file only where the browser plays one). It holds the whole
// file in memory while it does, so a feature film on a phone can be
// more than the tab is allowed: that fails as `media_unreadable`, and
// the learner is told to try the sound alone or a computer.

export const SAMPLE_RATE = 16000
export const KBPS = 32
// What a tab can be asked to hold while decoding.
export const MAX_MEDIA_BYTES = 1024 * 1024 * 1024
// Samples encoded between two yields to the page, so the progress
// line paints and the tab stays answerable (about four seconds of
// sound, a few milliseconds of work).
const CHUNK = 1152 * 56

function mediaError(code, cause) {
  const error = new Error(code)
  error.code = code
  if (cause) error.cause = cause
  return error
}

const pause = () => new Promise(resolve => setTimeout(resolve, 0))

/** One channel from several: their mean, sample by sample. */
export function mixDown(channels) {
  if (channels.length === 1) return channels[0]
  const out = new Float32Array(channels[0].length)
  for (const channel of channels) {
    for (let i = 0; i < out.length; i++) out[i] += channel[i]
  }
  for (let i = 0; i < out.length; i++) out[i] /= channels.length
  return out
}

/**
 * The window [start, end) of `samples`, in seconds, either bound
 * optional: { samples, offset }, offset being where the cut begins,
 * which is where the recording's lines start in the video.
 */
export function cropWindow(samples, rate, start, end) {
  const from = Math.max(0, Math.floor((start ?? 0) * rate))
  const to = end != null ? Math.min(samples.length, Math.ceil(end * rate)) : samples.length
  if (to <= from) throw mediaError('end_before_start')
  return { samples: samples.subarray(from, to), offset: from / rate }
}

/** Float samples in [-1, 1] as 16-bit PCM. */
export function toPcm16(samples) {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/** The file's sound as one channel at SAMPLE_RATE. */
export async function decodeSound(file, { onProgress } = {}) {
  if (file.size > MAX_MEDIA_BYTES) throw mediaError('media_too_large')
  const Ctx = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext
  if (!Ctx) throw mediaError('media_unreadable')
  onProgress?.({ stage: 'read' })
  let bytes
  try {
    bytes = await file.arrayBuffer()
  } catch (e) {
    throw mediaError('media_unreadable', e)
  }
  onProgress?.({ stage: 'decode' })
  // An offline context decodes into its own sample rate: asking for
  // 16 kHz here is the resampling, done by the browser's own code.
  const ctx = new Ctx(1, SAMPLE_RATE, SAMPLE_RATE)
  let audio
  try {
    audio = await ctx.decodeAudioData(bytes)
  } catch (e) {
    throw mediaError('media_unreadable', e)
  }
  const channels = []
  for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c))
  return mixDown(channels)
}

/** `samples` (mono, SAMPLE_RATE) as an MP3 Blob. */
export async function encodeMp3(samples, { onProgress } = {}) {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, KBPS)
  const parts = []
  for (let at = 0; at < samples.length; at += CHUNK) {
    const piece = encoder.encodeBuffer(toPcm16(samples.subarray(at, at + CHUNK)))
    if (piece.length) parts.push(new Uint8Array(piece))
    onProgress?.({ stage: 'encode', ratio: Math.min(1, (at + CHUNK) / samples.length) })
    await pause()
  }
  const tail = encoder.flush()
  if (tail.length) parts.push(new Uint8Array(tail))
  return new Blob(parts, { type: 'audio/mpeg' })
}

/**
 * A recording ready to send: { blob, seconds, offset } for the window
 * [start, end) of `file`'s sound. Refused before the encoding when it
 * is longer than a session takes (`maxSeconds`) or than what is left of
 * the learner's day (`minutesLeft`), each an error with the `code` the
 * server would have refused it with, so the screen words both alike.
 */
export async function recordingFor(file, { start = null, end = null, maxSeconds = null, minutesLeft = null, onProgress } = {}) {
  const sound = await decodeSound(file, { onProgress })
  const { samples, offset } = cropWindow(sound, SAMPLE_RATE, start, end)
  const seconds = samples.length / SAMPLE_RATE
  if (seconds < 0.5) throw mediaError('no_speech')
  if (maxSeconds != null && seconds > maxSeconds + 1) throw mediaError('media_too_long')
  if (minutesLeft != null && Math.ceil(seconds / 60) > minutesLeft) throw mediaError('transcribe_allowance_mine')
  const blob = await encodeMp3(samples, { onProgress })
  return { blob, seconds, offset }
}
