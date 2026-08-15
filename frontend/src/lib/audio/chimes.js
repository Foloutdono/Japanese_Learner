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
const CLICK = '/sounds/ui/click.mp3'
const TOGGLE = '/sounds/ui/toggle.mp3'
const FARE_TICK = '/sounds/ui/fare-tick.mp3'
const FLAP_CLATTER = '/sounds/ui/flap-clatter.mp3'
const STATION_MELODY = '/sounds/ui/station-melody.mp3'
const ARRIVAL = '/sounds/ui/arrival.mp3'

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

// Falling: E6 down to B5, an octave under the gate's and twice as
// long. A door chime is heard standing still rather than mid-stride,
// so it can afford to be softer and rounder.
const DOOR_BLIPS = [
  { freq: 1318.5, at: 0,    dur: 0.16, peak: 0.34 },
  { freq: 987.8,  at: 0.15, dur: 0.30, peak: 0.34 },
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

// A single soft blip for XP earned. Deliberately not the gate's
// chime, which already means "your pass was read", and deliberately
// not playUi('click') — that resolves to /sounds/ui/click.mp3, a file
// that does not exist, so the tick was silent. A reward you cannot
// hear is not a louder reward.
const FARE_BLIPS = [
  { freq: 1174.7, at: 0, dur: 0.11, peak: 0.24 },  // D6
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
function synthesiseClatter(ctx) {
  const bus = busFor('ui')
  if (!bus) return

  const now = ctx.currentTime
  // Shrinking gaps: the drum slows as it settles, so the ticks bunch
  // up rather than marking time.
  const ticks = [0, 0.055, 0.10, 0.14, 0.173, 0.20, 0.222, 0.24]

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

/** XP earned, no level. The quiet one. */
export function playFareTick() {
  playChime(FARE_TICK, 'fare-tick', FARE_BLIPS)
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

/** 到着 — a session finished. */
export function playArrival() {
  playChime(ARRIVAL, 'arrival', ARRIVAL_NOTES)
}

/** 再発行 — the pass re-issued. The one that gets a melody. */
export function playStationMelody() {
  playChime(STATION_MELODY, 'station-melody', MELODY_NOTES)
}
