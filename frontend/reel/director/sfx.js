// ── 効果音 — the director's own sounds (plan 210) ─────────────────────
// What the film adds to the app's own voices: the camera's shutter, the
// air of a phone raised or a scene swapped, the pop of a caption. The
// app's palette is the first choice (lib/audio's chimes, played in the
// director's window and recorded like the stage's), so the film sounds
// like the app; the shutter and the whoosh are drawn here, on the same
// recorded context, because the app has none.

import { playClick, playVoice, hasVoice } from '../../src/lib/audio'
import { getAudioContext } from '../../src/lib/audio/context'

function noise(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const d = buf.getChannelData(0)
  let seed = 12345
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    d[i] = (seed / 0x7fffffff) * 2 - 1
  }
  return buf
}

function out(ctx, gain) {
  const g = ctx.createGain()
  g.gain.value = gain
  g.connect(ctx.destination)
  return g
}

export const sfx = {
  /** The app's own voice for an event, when the palette has it. */
  app(name) { if (hasVoice(name)) playVoice(name) },
  click() { playClick() },

  /** A phone camera's shutter: two mechanical clicks a breath apart. */
  shutter() {
    const ctx = getAudioContext()
    if (!ctx) return
    const t = ctx.currentTime
    for (const [at, level] of [[0, 0.5], [0.07, 0.32]]) {
      const src = ctx.createBufferSource()
      src.buffer = noise(ctx, 0.05)
      const band = ctx.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 3200
      band.Q.value = 0.9
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, t + at)
      env.gain.linearRampToValueAtTime(level, t + at + 0.002)
      env.gain.exponentialRampToValueAtTime(0.001, t + at + 0.045)
      src.connect(band).connect(env).connect(out(ctx, 0.9))
      src.start(t + at)
    }
  },

  /** Air moving past: a swept band of noise, `seconds` long. */
  whoosh(seconds = 0.45, level = 0.16) {
    const ctx = getAudioContext()
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noise(ctx, seconds + 0.05)
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 1.4
    band.frequency.setValueAtTime(380, t)
    band.frequency.exponentialRampToValueAtTime(2600, t + seconds * 0.55)
    band.frequency.exponentialRampToValueAtTime(900, t + seconds)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(level, t + seconds * 0.45)
    env.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
    src.connect(band).connect(env).connect(out(ctx, 1))
    src.start(t)
  },

  /** A soft pop under a caption's arrival. */
  pop() {
    const ctx = getAudioContext()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.06)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.09, t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    osc.connect(env).connect(out(ctx, 1))
    osc.start(t)
    osc.stop(t + 0.14)
  },

  /** A key under the thumb: a tiny tick. */
  key() {
    const ctx = getAudioContext()
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noise(ctx, 0.02)
    const band = ctx.createBiquadFilter()
    band.type = 'highpass'
    band.frequency.value = 2400
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.05, t + 0.002)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.018)
    src.connect(band).connect(env).connect(out(ctx, 1))
    src.start(t)
  },

  /** The puzzled beat: a little falling "huh?". */
  huh(i = 0) {
    const ctx = getAudioContext()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    const f = 640 - i * 70
    osc.frequency.setValueAtTime(f, t)
    osc.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.09)
    osc.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.22)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.07, t + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
    osc.connect(env).connect(out(ctx, 1))
    osc.start(t)
    osc.stop(t + 0.3)
  },
}
