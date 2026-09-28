// ── Synthesis primitives ──────────────────────────────────
// Every interface and effect sound in the app is generated here
// rather than shipped as a file. Five building blocks cover all of
// them, because there are only five kinds of thing a station makes:
//
//   tones()      a pitched blip — a chime, a confirmation, a melody
//   bar()        a struck bar — a vibraphone's metal, a marimba's wood
//   noiseTicks() a piece of plastic hitting a stop — a flap, a latch
//   noiseSweep() air moving — a door running open, a card sliding
//   thump()      something arriving at the end of its travel
//
// and one place they can sound in: voiceOut() below, the node every
// voice plays into, which sets its level and can send it into the
// hall — a concourse's tail, for the sounds that belong to one.
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

// ── Noise that is the same every time ─────────────────────
// Math.random() made every noise-based sound — the fare tick, the
// level clatter, the door slide, the card turn — a different loudness
// in every session. Repeatable within one page load, so it hides from
// any single measurement, and it drifted far enough between loads to
// make levelling meaningless: a trim tuned in one session was wrong
// in the next. Measured on the fare tick, the same trim produced
// anywhere from 0.025 to 0.067.
//
// Normalising each buffer's peak was not enough on its own. A tick at
// Q 14 passes a narrow slice of the spectrum, so what reaches the ear
// depends on how much energy this particular random sequence happens
// to hold at 3.2kHz — and that varies however the peak is scaled.
//
// So the noise is not random any more, only irregular: a fixed seed
// through a small PRNG. Identical every load, for every listener, on
// every machine. It sounds exactly like noise because it is noise;
// it is simply always the *same* noise, which is what makes a level
// something you can set once.
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOISE_SEED = 0x5EED   // any constant; this one is legible

function normalise(data, peak) {
  if (!peak) return
  const scale = 1 / peak
  for (let i = 0; i < data.length; i++) data[i] *= scale
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
  const rand = mulberry32(NOISE_SEED)
  let peak = 0
  for (let i = 0; i < frames; i++) {
    data[i] = (rand() * 2 - 1) * (1 - i / frames) ** 2
    if (Math.abs(data[i]) > peak) peak = Math.abs(data[i])
  }
  normalise(data, peak)
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
  // Seeded per sweep length so a 0.62s door and a 0.17s card turn get
  // different noise, but the same door sounds the same every time.
  const rand = mulberry32(NOISE_SEED + frames)
  let maxAbs = 0
  for (let i = 0; i < frames; i++) {
    data[i] = rand() * 2 - 1
    if (Math.abs(data[i]) > maxAbs) maxAbs = Math.abs(data[i])
  }
  normalise(data, maxAbs)

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


// ── A struck bar ──────────────────────────────────────────
// A sine is a tuning fork: pure, and at the levels a chime needs,
// thin — it is what makes a synthesised chime sound like a test tone.
// Every real chime in a station is a struck bar or tube, and what makes
// one read as metal or wood is which overtones ring over the note and
// how fast each dies. A vibraphone's bars are cut so the 4th and 10th
// partials sit on the harmonic series (two octaves, and a third over
// three); a marimba's are cut the same way but in wood, so everything
// above the note is gone in a few tens of milliseconds; a glockenspiel's
// bars are left uncut, so its partials are the free bar's own
// inharmonic 2.76 and 5.40 — the "glassy" in a glass chime.
//
// So a bar is tones() with its partials written out: each one a sine
// with its own level and its own, shorter, decay. `dur` is the note's
// ring; the partials take a fraction of it.
const MATERIALS = {
  //        ratio to the note, level, share of the ring
  metal: [[1, 1, 1], [4, 0.26, 0.42], [10, 0.07, 0.16]],
  wood:  [[1, 1, 1], [4, 0.34, 0.20], [9.2, 0.06, 0.07]],
  glass: [[1, 1, 1], [2.756, 0.30, 0.45], [5.404, 0.11, 0.22], [8.933, 0.04, 0.12]],
}
const PARTIAL_CEILING = 15000   // above this a partial is air, and on
                                // a phone it is not reproduced at all

/**
 * Struck bars. Each note is { freq, at, dur, peak, material } — the
 * material 'metal' (default), 'wood' or 'glass'.
 */
export function bar(ctx, bus, notes) {
  const partials = []
  for (const { freq, at = 0, dur, peak, material = 'metal', attack = 0.002 } of notes) {
    for (const [ratio, level, ring] of MATERIALS[material] ?? MATERIALS.metal) {
      const f = freq * ratio
      if (f > PARTIAL_CEILING) continue
      partials.push({ freq: f, at, dur: Math.max(0.02, dur * ring), peak: peak * level, attack })
    }
  }
  tones(ctx, bus, partials)
}

// ── The hall ──────────────────────────────────────────────
// A station chime is never heard dry. It is heard in a concourse —
// tile, glass and concrete, a long tail with the highs dying first —
// and a dry synthesised chime is exactly the sound of one NOT being
// in a place. The hall is that room: an impulse response built here,
// from the same seeded noise as everything else, so it is identical
// on every load and a level measured through it stays true.
//
// It is kept small on purpose. The app is not a station and the tail
// must never smear one tap into the next, so it is a short hall
// (RT60 1.3s) sent to at a low level, and only by voices that ask for
// it — the chimes, never the chrome.
const HALL_RT60 = 1.3      // seconds to fall 60dB
const HALL_PREDELAY = 0.014
const HALL_SECONDS = 1.5
const hallCache = new WeakMap()

function hallImpulse(ctx) {
  const cached = hallCache.get(ctx)
  if (cached) return cached

  const rate = ctx.sampleRate
  const frames = Math.floor(rate * HALL_SECONDS)
  const ir = ctx.createBuffer(2, frames, rate)
  const pre = Math.floor(rate * HALL_PREDELAY)
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    // A different seed per ear is what makes the tail wide.
    const rand = mulberry32(NOISE_SEED + 0x4A11 + ch)
    let lp = 0
    let energy = 0
    for (let i = pre; i < frames; i++) {
      const t = (i - pre) / rate
      // The highs die first: a one-pole lowpass that closes as the
      // tail falls, so the late tail is the warm hum of a big room.
      const k = 0.35 + 0.6 * Math.min(1, t / HALL_RT60)
      lp = lp * k + (rand() * 2 - 1) * (1 - k)
      // A 10ms swell, so the tail blooms rather than clicks on.
      const onset = Math.min(1, t / 0.010)
      data[i] = lp * onset * 10 ** (-3 * t / HALL_RT60)
      energy += data[i] * data[i]
    }
    // Unit energy per ear: the send level alone says how much room.
    const scale = energy > 0 ? 1 / Math.sqrt(energy) : 0
    for (let i = 0; i < frames; i++) data[i] *= scale
  }
  hallCache.set(ctx, ir)
  return ir
}

// One convolver per destination, kept: setting a convolver's buffer
// prepares the whole impulse, which is work that must not land on a tap.
const convolvers = new WeakMap()

function hallInto(ctx, dest) {
  let conv = convolvers.get(dest)
  if (!conv) {
    conv = ctx.createConvolver()
    conv.normalize = false
    conv.buffer = hallImpulse(ctx)
    conv.connect(dest)
    convolvers.set(dest, conv)
  }
  return conv
}

// Longer than any voice plus the hall's tail, several times over.
const VOICE_LIFE_MS = 3500

/**
 * The node a voice plays into.
 *
 * `gain` is the event's trim — the level the table in settings.js sets
 * — and `space` the voice's own send into the hall (0: dry). The app's
 * voices.js and the loudness meter both route through here, so a level
 * measured is a level played.
 *
 * Disconnected on a timer because a synthesised voice has no `ended`
 * to hang off: the primitives tear down their own oscillators and
 * sources, and this is the one node above them.
 */
export function voiceOut(ctx, dest, { gain = 1, space = 0 } = {}) {
  const trim = ctx.createGain()
  trim.gain.value = gain
  trim.connect(dest)
  let send = null
  if (space > 0) {
    send = ctx.createGain()
    send.gain.value = space
    trim.connect(send)
    send.connect(hallInto(ctx, dest))
  }
  setTimeout(() => {
    try { trim.disconnect() } catch { /* already gone */ }
    try { send?.disconnect() } catch { /* already gone */ }
  }, VOICE_LIFE_MS)
  return trim
}
