import { getAudioContext, getBuffer } from './context'
import { busFor, playBuffer } from './mixer'
import { isMuted } from './settings'

// ── The station's two chimes ───────────────────────────────
// 改札 answers a valid pass with a short rising blip; a train door
// answers with a softer falling pair before it opens. Rising means
// "accepted, go"; falling means "arrived, board" — which is why the
// two are mirror images of each other rather than the same sound
// twice.
//
// Both are synthesised rather than shipped as files, for now. A few
// oscillator nodes cost no bytes at all, which is the right trade for
// sounds that fire on every departure and every session start — but a
// real recording beats a synthesised one every time, so each looks for
// its file first and only falls back to generating it. Drop the file
// in and it is used automatically; nothing here changes. See
// public/sounds/README.md.
const GATE_CHIME = '/sounds/ui/gate-chime.mp3'
const DOOR_CHIME = '/sounds/ui/door-chime.mp3'
const CORRECT = '/sounds/ui/correct.mp3'
const WRONG = '/sounds/ui/wrong.mp3'
const CLICK = '/sounds/ui/click.mp3'
const TOGGLE = '/sounds/ui/toggle.mp3'
const FARE_TICK = '/sounds/ui/fare-tick.mp3'
const FLAP_CLATTER = '/sounds/ui/flap-clatter.mp3'
const STATION_MELODY = '/sounds/ui/station-melody.mp3'
const ARRIVAL = '/sounds/ui/arrival.mp3'
const DOOR_SLIDE = '/sounds/sfx/door-slide.mp3'
const EXPRESS_PASS = '/sounds/sfx/express-pass.mp3'

// getBuffer deliberately evicts failed fetches so a dropped request
// can retry — correct in general, wrong for an asset that is *known*
// absent, which would then 404 on every single departure. One miss per
// path is enough to stop asking for the rest of the session.
const assetMissing = new Set()

// Rising: B6 into E7. Short and bright — it fires on every departure,
// so it errs quiet.
const GATE_BLIPS = [
  { freq: 1975.5, at: 0,     dur: 0.055, peak: 0.5 },
  { freq: 2637.0, at: 0.075, dur: 0.075, peak: 0.5 },
]

// Falling: E6 down to B5, an octave under the gate's. A door chime is
// heard standing still rather than mid-stride, so it can afford to be
// softer and rounder — and a real one is not a bare sine. Each note
// carries a quiet octave beneath it and the pair overlaps rather than
// butting end to end, which is most of what made the first version
// sound like a test tone instead of a chime.
const DOOR_BLIPS = [
  { freq: 1318.5, at: 0,    dur: 0.34, peak: 0.30 },  // E6
  { freq: 659.3,  at: 0,    dur: 0.34, peak: 0.09 },  // E5, under it
  { freq: 987.8,  at: 0.19, dur: 0.62, peak: 0.30 },  // B5
  { freq: 493.9,  at: 0.19, dur: 0.62, peak: 0.09 },  // B4, under it
]

// ── The generic click ─────────────────────────────────────
// playClick() is the most-used sound in the app — 31 call sites, from
// the back button to the rating bar to the storehouse — and it has
// been silent for as long as it has existed, because
// /sounds/ui/click.mp3 was referenced and never added. Worse than
// silent, actually: getBuffer evicts failed fetches so a retry is
// possible, so every one of those 31 taps also fired a 404.
//
// Very short and very quiet. At this frequency the difference between
// "present" and "irritating" is about thirty milliseconds.
const CLICK_BLIPS = [
  { freq: 1567.98, at: 0, dur: 0.032, peak: 0.16 },  // G6
]

// A toggle is a state change, not a press, so it says so: two steps,
// drier and lower than the click.
const TOGGLE_BLIPS = [
  { freq: 987.77,  at: 0,     dur: 0.030, peak: 0.15 },  // B5
  { freq: 1318.51, at: 0.038, dur: 0.045, peak: 0.15 },  // E6
]

// ── Marking an answer ─────────────────────────────────────
// These replace sfx/success.mp3 and sfx/failure.mp3, which were a
// 68KB and a 42KB sample and — the actual complaint — loud enough that
// the XP tick landing a beat later could not be heard under them. A
// sound that masks the reward it is announcing is working against the
// thing it exists for.
//
// Both are short and sit deliberately below the fare tick, and both
// stay inside the station's vocabulary: a clean confirming pair for
// correct, a soft double thud for wrong. Neither buzzes. A buzzer is
// what a gate does when it *rejects* you, and getting a card wrong in
// a study app is not that — it is the next card.
const CORRECT_BLIPS = [
  { freq: 1046.5, at: 0,     dur: 0.09, peak: 0.17 },  // C6
  { freq: 1568.0, at: 0.055, dur: 0.16, peak: 0.15 },  // G6, a fifth up
]

// Low, dull, and over quickly — felt more than heard.
const WRONG_BLIPS = [
  { freq: 196.0, at: 0,    dur: 0.12, peak: 0.20 },  // G3
  { freq: 146.8, at: 0.09, dur: 0.20, peak: 0.17 },  // D3
]

// 到着 — arriving. Played when a session finishes, which in this app
// is the end of a journey rather than a victory: a pair that steps
// down and settles instead of climbing. Deliberately unlike the
// departure melody, which rises.
const ARRIVAL_NOTES = [
  { freq: 783.99, at: 0,    dur: 0.26, peak: 0.26 },  // G5
  { freq: 587.33, at: 0.17, dur: 0.55, peak: 0.24 },  // D5
]

// 発車メロディ — the short melody a Japanese platform plays as a train
// is about to leave. This is a five-note figure in a pentatonic scale
// (D-E-G-A-B, the yo scale), rising then settling, and it plays when
// the pass is re-issued: four times in the whole progression, so it is
// the only sound here allowed to take a second and a half.
const MELODY_NOTES = [
  { freq: 587.3,  at: 0,    dur: 0.30, peak: 0.30 },  // D5
  { freq: 659.3,  at: 0.15, dur: 0.30, peak: 0.30 },  // E5
  { freq: 880.0,  at: 0.30, dur: 0.34, peak: 0.32 },  // A5
  { freq: 987.8,  at: 0.48, dur: 0.40, peak: 0.30 },  // B5
  { freq: 783.99, at: 0.70, dur: 0.75, peak: 0.26 },  // G5, the settle
]

/**
 * Routed through the mixer's `ui` bus like every other sound, so mute
 * and the interface volume slider reach it — a naked oscillator wired
 * to the destination would keep playing through both.
 */
function synthesise(ctx, blips) {
  const bus = busFor('ui')
  if (!bus) return

  const now = ctx.currentTime

  for (const { freq, at, dur, peak } of blips) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + at)

    // A 4ms attack and an exponential tail: stepping the gain
    // straight to full would put a click at both ends of a blip this
    // short, which on a 2kHz tone is most of what you would hear.
    env.gain.setValueAtTime(0.0001, now + at)
    env.gain.exponentialRampToValueAtTime(peak, now + at + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)

    osc.connect(env)
    env.connect(bus)
    osc.start(now + at)
    osc.stop(now + at + dur + 0.02)
    osc.onended = () => { env.disconnect(); osc.disconnect() }
  }
}

// ── The board turning over ────────────────────────────────
// A split-flap drum is not a tone at all, it is a piece of plastic
// hitting a stop — so this is filtered noise, not an oscillator: a run
// of very short bandpassed bursts, accelerating slightly and falling
// in level, the way a real board sounds when one drum spins down.
//
// A tone here would have been wrong twice over: it would not sound
// like the object on screen, and it would have collided with the two
// chimes, which are tones and mean something else.
function synthesiseClatter(ctx, count) {
  const bus = busFor('ui')
  if (!bus) return

  const now = ctx.currentTime
  // Shrinking gaps: the drum slows as it settles, so the ticks bunch
  // up rather than marking time. `count` trims the run — one tick is
  // a single drum turning, which is the XP board.
  const ALL = [0, 0.055, 0.10, 0.14, 0.173, 0.20, 0.222, 0.24]
  const ticks = ALL.slice(0, count ?? ALL.length)

  // One short noise buffer, reused by every tick.
  const frames = Math.floor(ctx.sampleRate * 0.03)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // Decaying white noise — the tail is what stops each tick reading
    // as a click.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2
  }

  ticks.forEach((at, i) => {
    const src = ctx.createBufferSource()
    src.buffer = buffer

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    // Each drum lands a little lower than the last as it loses energy.
    band.frequency.setValueAtTime(2600 - i * 130, now + at)
    band.Q.setValueAtTime(1.6, now + at)

    const env = ctx.createGain()
    const peak = 0.34 * (1 - i / ticks.length) + 0.06
    env.gain.setValueAtTime(peak, now + at)
    env.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.03)

    src.connect(band); band.connect(env); env.connect(bus)
    src.start(now + at)
    src.onended = () => { env.disconnect(); band.disconnect(); src.disconnect() }
  })
}

// ── The doors running open ────────────────────────────────
// The chime says the doors are *about* to move; for three quarters of
// a second after it, they moved in silence. This is that stretch: a
// pneumatic slide, which is broadband rush rather than any pitch —
// filtered noise swept upward as the leaves gather speed and closed
// back down as they reach the stop, with a soft thump at the end.
function synthesiseSlide(ctx) {
  const bus = busFor('ui')
  if (!bus) return

  const now = ctx.currentTime
  const dur = 0.62

  // Long noise bed.
  const frames = Math.floor(ctx.sampleRate * dur)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buffer

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.setValueAtTime(0.8, now)
  // Opens up as they accelerate, closes as they settle.
  band.frequency.setValueAtTime(380, now)
  band.frequency.linearRampToValueAtTime(1250, now + dur * 0.45)
  band.frequency.linearRampToValueAtTime(520, now + dur)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, now)
  env.gain.exponentialRampToValueAtTime(0.13, now + 0.10)
  env.gain.setValueAtTime(0.13, now + dur * 0.55)
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  src.connect(band); band.connect(env); env.connect(bus)
  src.start(now)
  src.onended = () => { env.disconnect(); band.disconnect(); src.disconnect() }

  // The stop at the end of the travel.
  const thump = ctx.createOscillator()
  const tEnv = ctx.createGain()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(96, now + dur - 0.03)
  thump.frequency.exponentialRampToValueAtTime(58, now + dur + 0.07)
  tEnv.gain.setValueAtTime(0.0001, now + dur - 0.03)
  tEnv.gain.exponentialRampToValueAtTime(0.16, now + dur - 0.015)
  tEnv.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.12)
  thump.connect(tEnv); tEnv.connect(bus)
  thump.start(now + dur - 0.03)
  thump.stop(now + dur + 0.14)
  thump.onended = () => { tEnv.disconnect(); thump.disconnect() }
}

/** The leaves running open. Starts when they do, not with the chime. */
export function playDoorSlide() {
  if (isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (assetMissing.has(DOOR_SLIDE)) { synthesiseSlide(ctx); return }

  getBuffer(DOOR_SLIDE)
    .then(buffer => {
      if (isMuted()) return
      if (buffer) playBuffer(buffer, 'sfx', 'door-slide')
      else { assetMissing.add(DOOR_SLIDE); synthesiseSlide(ctx) }
    })
    .catch(() => { assetMissing.add(DOOR_SLIDE); synthesiseSlide(ctx) })
}

// ── 特急 — the limited express going through ──────────────
// Not a door and not a gate: nothing opens, something goes PAST. The
// shape is a doppler — a rising approach, a hard slam as the nose
// arrives, then a falling tail as the rake runs away — which is what
// separates it by ear from the two sounds that mean "you may proceed".
function synthesiseExpress(ctx) {
  const bus = busFor('sfx')
  if (!bus) return

  const now = ctx.currentTime
  const dur = 0.72

  const frames = Math.floor(ctx.sampleRate * dur)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buffer

  // The doppler itself: the band sweeps UP as it comes on and DOWN
  // as it leaves, crossing at the moment of passing. A single ramp
  // either way would read as a gust of wind instead of a train.
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.setValueAtTime(1.1, now)
  band.frequency.setValueAtTime(240, now)
  band.frequency.exponentialRampToValueAtTime(2100, now + dur * 0.34)
  band.frequency.exponentialRampToValueAtTime(300, now + dur)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, now)
  env.gain.exponentialRampToValueAtTime(0.19, now + dur * 0.30)
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  src.connect(band); band.connect(env); env.connect(bus)
  src.start(now)
  src.onended = () => { env.disconnect(); band.disconnect(); src.disconnect() }

  // The pressure wave off the nose — the thump you feel rather than
  // hear when an express takes a platform at line speed.
  const boom = ctx.createOscillator()
  const bEnv = ctx.createGain()
  boom.type = 'sine'
  boom.frequency.setValueAtTime(130, now + dur * 0.24)
  boom.frequency.exponentialRampToValueAtTime(52, now + dur * 0.52)
  bEnv.gain.setValueAtTime(0.0001, now + dur * 0.24)
  bEnv.gain.exponentialRampToValueAtTime(0.20, now + dur * 0.31)
  bEnv.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.62)
  boom.connect(bEnv); bEnv.connect(bus)
  boom.start(now + dur * 0.24)
  boom.stop(now + dur * 0.66)
  boom.onended = () => { bEnv.disconnect(); boom.disconnect() }
}

/** 特急 — the express going through without stopping. */
export function playExpressPass() {
  if (isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (assetMissing.has(EXPRESS_PASS)) { synthesiseExpress(ctx); return }

  getBuffer(EXPRESS_PASS)
    .then(buffer => {
      if (isMuted()) return
      if (buffer) playBuffer(buffer, 'sfx', 'express-pass')
      else { assetMissing.add(EXPRESS_PASS); synthesiseExpress(ctx) }
    })
    .catch(() => { assetMissing.add(EXPRESS_PASS); synthesiseExpress(ctx) })
}


function playChime(path, name, blips) {
  if (isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (assetMissing.has(path)) { synthesise(ctx, blips); return }

  getBuffer(path)
    .then(buffer => {
      if (isMuted()) return
      if (buffer) playBuffer(buffer, 'ui', name)
      else { assetMissing.add(path); synthesise(ctx, blips) }
    })
    .catch(() => { assetMissing.add(path); synthesise(ctx, blips) })
}

/** 改札 — a valid pass has been read. */
export function playGateChime() {
  playChime(GATE_CHIME, 'gate-chime', GATE_BLIPS)
}

/** The doors are about to open. */
export function playDoorChime() {
  playChime(DOOR_CHIME, 'door-chime', DOOR_BLIPS)
}

/**
 * The app's generic click and toggle.
 *
 * These deliberately shadow playback.js's versions of the same names —
 * index.js exports these instead — so all 31 call sites gain a working
 * sound without a single one of them being edited, and still upgrade
 * to a real recording the moment /sounds/ui/click.mp3 exists.
 */
export function playClick() {
  playChime(CLICK, 'click', CLICK_BLIPS)
}

export function playToggle() {
  playChime(TOGGLE, 'toggle', TOGGLE_BLIPS)
}

/**
 * XP earned, no level.
 *
 * This was a single sine blip, and it was the wrong sound for what is
 * on screen: the fare tick shows a split-flap board, and a board makes
 * a mechanical noise, not a tone. It is one drum turning now — the
 * same synthesis the level tier uses, with a single tick instead of a
 * run — so the two read as the same machine at different sizes rather
 * than as two unrelated sounds. It also stops competing with the gate
 * chime, which is a tone and means something else.
 */
export function playFareTick() {
  if (isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (assetMissing.has(FARE_TICK)) { synthesiseClatter(ctx, 1); return }

  getBuffer(FARE_TICK)
    .then(buffer => {
      if (isMuted()) return
      if (buffer) playBuffer(buffer, 'ui', 'fare-tick')
      else { assetMissing.add(FARE_TICK); synthesiseClatter(ctx, 1) }
    })
    .catch(() => { assetMissing.add(FARE_TICK); synthesiseClatter(ctx, 1) })
}

/** 進級 — the board turning your level over. */
export function playFlapClatter() {
  if (isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (assetMissing.has(FLAP_CLATTER)) { synthesiseClatter(ctx); return }

  getBuffer(FLAP_CLATTER)
    .then(buffer => {
      if (isMuted()) return
      if (buffer) playBuffer(buffer, 'ui', 'flap-clatter')
      else { assetMissing.add(FLAP_CLATTER); synthesiseClatter(ctx) }
    })
    .catch(() => { assetMissing.add(FLAP_CLATTER); synthesiseClatter(ctx) })
}

/** A card answered right. */
export function playCorrect() {
  playChime(CORRECT, 'correct', CORRECT_BLIPS)
}

/** A card answered wrong. Not a buzzer — see the note above. */
export function playWrong() {
  playChime(WRONG, 'wrong', WRONG_BLIPS)
}

/** 到着 — a session finished. */
export function playArrival() {
  playChime(ARRIVAL, 'arrival', ARRIVAL_NOTES)
}

/** 再発行 — the pass re-issued. The one that gets a melody. */
export function playStationMelody() {
  playChime(STATION_MELODY, 'station-melody', MELODY_NOTES)
}
