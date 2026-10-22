// ── 音 — a cover clip's sounds (plan 231) ──────────────────────────
// A clip is scored with the app's own sounds, never new ones: its
// `sounds` name the app's events (src/lib/audio/recipes.js) and the
// moments they fall on, and each is rendered from the shipped recipe
// itself. The recipes reach a page outside the app as one script,
// public/landing/voices.js (scripts/voices-bundle.mjs, the landing
// page's demos and the loudness meter read the same), which sets
// `globalThis.TsujiVoices`; each voice plays its first variant, the
// app's default, at the app's own level (settings.js's voiceLevel).

/** The app's voices, loaded once: `base` is the frontend's root as the page sees it. */
let voicesLoading = null
export function loadVoices(base = '../') {
  if (globalThis.TsujiVoices) return Promise.resolve(globalThis.TsujiVoices)
  if (!voicesLoading) {
    voicesLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = `${base}public/landing/voices.js`
      s.onload = () => (globalThis.TsujiVoices ? resolve(globalThis.TsujiVoices) : reject(new Error('voices.js set nothing')))
      s.onerror = () => { voicesLoading = null; reject(new Error('voices.js did not load')) }
      document.head.append(s)
    })
  }
  return voicesLoading
}

export const RATE = 48000
// A voice's tail is never longer than this (the level-up's build and
// burst, the longest, ring out inside it).
const TAIL = 4
// The mix's loudest sample: a phone's speaker plays a clip at the
// feed's volume, so the score is brought up to -6dBFS whole, each sound
// kept at its level against the others.
const PEAK = 0.5

/** The score rendered: [left, right] Float32Arrays, `seconds` long at RATE.
 *  A sound is an app event (`key`) or a recorded clip (`src`); a clip
 *  marked `loop` plays again until the score ends, and one given a `fade`
 *  comes in and goes out over that many seconds rather than stopping
 *  mid-note. */
export async function clipAudio(sounds, seconds, voices = globalThis.TsujiVoices) {
  const { VOICE_EVENTS, voiceOut, voiceLevel } = voices
  const n = Math.round(seconds * RATE)
  const mix = [new Float32Array(n), new Float32Array(n)]
  const clips = new Map()
  for (const { at, key, src, gain = 1, loop = false, fade = 0 } of sounds) {
    if (at >= seconds) continue
    let out
    if (src) {
      // A recorded clip (the word echo's voice, plan 232), decoded once, at its own level.
      if (!clips.has(src)) clips.set(src, decoded(src))
      out = await clips.get(src)
    } else {
      const event = VOICE_EVENTS.find(e => e.key === key)
      if (!event) continue
      const variant = event.variants[0]
      const len = Math.max(1, Math.round(Math.min(TAIL, seconds - at) * RATE))
      const ctx = new OfflineAudioContext(2, len, RATE)
      const level = voiceLevel(event, variant)
      variant.play(ctx, voiceOut(ctx, ctx.destination, { ...level, gain: level.gain * gain }))
      out = await ctx.startRendering()
    }
    const from = Math.round(at * RATE)
    const ramp = Math.max(1, Math.round(fade * RATE))
    for (let ch = 0; ch < 2; ch++) {
      const data = out.getChannelData(Math.min(ch, out.numberOfChannels - 1))
      const dst = mix[ch]
      const len = loop ? n - from : data.length
      for (let i = 0; i < len && from + i < n; i++) {
        const env = fade ? Math.min(1, i / ramp, (n - from - i) / ramp) : 1
        dst[from + i] += data[i % data.length] * (src ? gain : 1) * env
      }
    }
  }
  let peak = 0
  for (const ch of mix) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ch[i]))
  if (peak > 0) {
    const k = PEAK / peak
    for (const ch of mix) for (let i = 0; i < n; i++) ch[i] *= k
  }
  // The last 50ms fade, so the clip never ends on a cut sound.
  const fade = Math.round(0.05 * RATE)
  for (const ch of mix) for (let i = 0; i < fade; i++) ch[n - 1 - i] *= i / fade
  return mix
}

/** One app sound alone, at the app's own level and unscaled: a long
 *  video's mix (plan 233) lays each where it falls and sets the whole
 *  itself. [left, right] Float32Arrays at RATE, the voice's tail long. */
export async function eventAudio(key, voices = globalThis.TsujiVoices) {
  const { VOICE_EVENTS, voiceOut, voiceLevel } = voices
  const event = VOICE_EVENTS.find(e => e.key === key)
  if (!event) return null
  const variant = event.variants[0]
  const ctx = new OfflineAudioContext(2, TAIL * RATE, RATE)
  variant.play(ctx, voiceOut(ctx, ctx.destination, voiceLevel(event, variant)))
  const out = await ctx.startRendering()
  return [out.getChannelData(0), out.getChannelData(Math.min(1, out.numberOfChannels - 1))]
}

/** A clip fetched and decoded at RATE (a mono clip plays on both sides). */
export async function decoded(src) {
  const bytes = await (await fetch(src)).arrayBuffer()
  return new OfflineAudioContext(1, 1, RATE).decodeAudioData(bytes)
}

/** The score as a 16-bit stereo WAV, for a tool that muxes it with the frames. */
export function wav([l, r]) {
  const n = l.length
  const buf = new ArrayBuffer(44 + n * 4)
  const v = new DataView(buf)
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, RATE, true)
  v.setUint32(28, RATE * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true)
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true)
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true)
  }
  return buf
}
