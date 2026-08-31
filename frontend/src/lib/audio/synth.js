import { busFor } from './mixer'

// ── Synthesis primitives ──────────────────────────────────
// Every interface and effect sound in the app is generated here
// rather than shipped as a file. Four building blocks cover all of
// them, because there are only four kinds of thing a station makes:
//
//   tones()      a pitched blip — a chime, a confirmation, a melody
//   noiseTicks() a piece of plastic hitting a stop — a flap, a latch
//   noiseSweep() air moving — a door running open, a card sliding
//   thump()      something arriving at the end of its travel
//
// They all schedule against the audio clock and all route through a
// mixer bus, so mute and the volume sliders reach them while they are
// still sounding. A bare oscillator wired to ctx.destination would
// play straight through both, which is the bug this file exists to
// not have.
//
// `at` is always relative to the moment the voice starts, so a recipe
// reads as a little score and can be moved around wholesale.

const ATTACK = 0.004   // seconds — below this a blip clicks at its own
                       // onset, which on a 2kHz tone is most of what
                       // you hear
const FLOOR = 0.0001   // exponentialRamp cannot reach zero

/**
 * Pitched notes.
 *
 * Each note is { freq, at, dur, peak } plus three options:
 *   type   waveform — 'sine' (default), 'triangle', 'square', 'sawtooth'
 *   to     glide the pitch to this frequency across the note
 *   attack override the 4ms onset — longer reads as a swell, not a hit
 */
export function tones(ctx, bus, notes) {
  const now = ctx.currentTime

  for (const n of notes) {
    const { freq, at = 0, dur, peak, type = 'sine', to, attack = ATTACK } = n
    const start = now + at
    const osc = ctx.createOscillator()
    const env = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(to, start + dur)

    env.gain.setValueAtTime(FLOOR, start)
    env.gain.exponentialRampToValueAtTime(peak, start + attack)
    env.gain.exponentialRampToValueAtTime(FLOOR, start + dur)

    osc.connect(env)
    env.connect(bus)
    osc.start(start)
    osc.stop(start + dur + 0.02)
    osc.onended = () => { env.disconnect(); osc.disconnect() }
  }
}

// One decaying-noise buffer per context, reused by every tick — the
// cost of building it is small but it is paid on a tap, and a tap is
// the one place in the app where a few milliseconds are visible.
const noiseCache = new WeakMap()

function tickNoise(ctx) {
  const cached = noiseCache.get(ctx)
  if (cached) return cached

  const frames = Math.floor(ctx.sampleRate * 0.03)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // The squared decay is what stops each tick reading as a bare click:
  // a mechanical stop has a tail, however short.
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2
  }
  noiseCache.set(ctx, buffer)
  return buffer
}

/**
 * Short bandpassed noise bursts — plastic, metal, a latch.
 *
 * Each tick is { at, freq, peak } plus:
 *   q    resonance — 1.5 is a knock, 12 is a ping with a pitch to it
 *   dur  how long the burst rings (default 0.03, the buffer's length)
 */
export function noiseTicks(ctx, bus, ticks) {
  const now = ctx.currentTime
  const buffer = tickNoise(ctx)

  for (const { at = 0, freq, peak, q = 1.6, dur = 0.03 } of ticks) {
    const start = now + at
    const src = ctx.createBufferSource()
    src.buffer = buffer

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.setValueAtTime(freq, start)
    band.Q.setValueAtTime(q, start)

    const env = ctx.createGain()
    env.gain.setValueAtTime(peak, start)
    env.gain.exponentialRampToValueAtTime(FLOOR, start + dur)

    src.connect(band); band.connect(env); env.connect(bus)
    src.start(start)
    src.onended = () => { env.disconnect(); band.disconnect(); src.disconnect() }
  }
}

/**
 * Broadband rush — air, a pneumatic slide, paper moving.
 *
 * { at, dur, peak } plus the filter's journey: `from` → `mid` at
 * `mid_at` (a fraction of dur) → `to`. `q` sets how hollow it is;
 * `hold` is the fraction of dur spent at full level before the fall.
 */
export function noiseSweep(ctx, bus, { at = 0, dur, peak, from, mid, to, midAt = 0.45, q = 0.8, hold = 0.55, attack = 0.1 }) {
  const now = ctx.currentTime
  const start = now + at

  const frames = Math.floor(ctx.sampleRate * dur)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buffer

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.setValueAtTime(q, start)
  band.frequency.setValueAtTime(from, start)
  if (mid) band.frequency.linearRampToValueAtTime(mid, start + dur * midAt)
  band.frequency.linearRampToValueAtTime(to, start + dur)

  const env = ctx.createGain()
  env.gain.setValueAtTime(FLOOR, start)
  env.gain.exponentialRampToValueAtTime(peak, start + Math.min(attack, dur * 0.4))
  env.gain.setValueAtTime(peak, start + dur * hold)
  env.gain.exponentialRampToValueAtTime(FLOOR, start + dur)

  src.connect(band); band.connect(env); env.connect(bus)
  src.start(start)
  src.onended = () => { env.disconnect(); band.disconnect(); src.disconnect() }
}

/** Something reaching the end of its travel: a low pitch dropping. */
export function thump(ctx, bus, { at = 0, from = 96, to = 58, dur = 0.15, peak = 0.16 }) {
  const now = ctx.currentTime
  const start = now + at

  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + dur)

  env.gain.setValueAtTime(FLOOR, start)
  env.gain.exponentialRampToValueAtTime(peak, start + 0.015)
  env.gain.exponentialRampToValueAtTime(FLOOR, start + dur)

  osc.connect(env); env.connect(bus)
  osc.start(start)
  osc.stop(start + dur + 0.02)
  osc.onended = () => { env.disconnect(); osc.disconnect() }
}

/** The bus a voice of this category plays on, or null before unlock. */
export function voiceBus(category) { return busFor(category) }
