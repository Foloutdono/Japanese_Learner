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
