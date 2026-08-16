import { getAudioContext } from './context'
import { SOUND_CATEGORIES, getVolume, isMuted, onSettingsChange, trimFor } from './settings'

// ── The mixing desk ───────────────────────────────────────
//
//   source → trim → category bus → master bus → destination
//
// The old implementation multiplied master × category × trim into a
// single number and baked it into each source at the moment it
// started. That has three consequences worth naming, because all
// three were live bugs:
//
//   • dragging a volume slider did nothing to anything already
//     playing — including the looping ambiance, the one sound where
//     it matters most;
//   • muting did not silence a sound in flight, only prevent the next
//     one;
//   • every change was a hard jump, and a gain node jumping is a
//     click in the speakers.
//
// Routing through two persistent gain nodes fixes all three: the
// sliders now move buses, live, on a short ramp.

const RAMP = 0.06   // seconds — long enough to avoid a click, short
                    // enough that a slider still feels instant

let master = null
const buses = {}

function ramp(param, value, seconds = RAMP) {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  // Read the current value first so the ramp starts from wherever an
  // earlier, still-running ramp had reached.
  param.cancelScheduledValues(now)
  param.setValueAtTime(param.value, now)
  param.linearRampToValueAtTime(value, now + seconds)
}

function build() {
  const ctx = getAudioContext()
  if (!ctx || master) return master

  master = ctx.createGain()
  master.gain.value = isMuted() ? 0 : getVolume('master')
  master.connect(ctx.destination)

  SOUND_CATEGORIES.forEach(cat => {
    const bus = ctx.createGain()
    bus.gain.value = getVolume(cat)
    bus.connect(master)
    buses[cat] = bus
  })

  return master
}

export function busFor(category) {
  build()
  return buses[category] ?? master
}

export function applySettings() {
  if (!master) return
  ramp(master.gain, isMuted() ? 0 : getVolume('master'))
  SOUND_CATEGORIES.forEach(cat => {
    if (buses[cat]) ramp(buses[cat].gain, getVolume(cat))
  })
}

onSettingsChange(applySettings)

// ── Playing one thing ─────────────────────────────────────
/**
 * Route a decoded buffer through its category bus and start it.
 * Returns the source so callers that need to stop it (the ambiance
 * loop) can, and disconnects itself on end so a long session doesn't
 * accumulate dead nodes hanging off the graph.
 */
export function playBuffer(buffer, category, soundName, { when = 0, loop = false, fadeIn = 0, offset = 0, gain = 1 } = {}) {
  const ctx = getAudioContext()
  if (!ctx || !buffer) return null

  const bus = busFor(category)
  if (!bus) return null

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = loop

  const trim = ctx.createGain()
  // `gain` is a per-play correction on top of the sound's own trim —
  // used by playKana to even out a recorded set whose levels span 25dB.
  const level = trimFor(category, soundName) * gain
  trim.gain.value = fadeIn > 0 ? 0 : level

  source.connect(trim)
  trim.connect(bus)

  const startAt = when || ctx.currentTime
  // `offset` skips into the buffer — used to drop leading silence so a
  // sample fires on the tap rather than a fifth of a second later.
  source.start(startAt, offset)
  if (fadeIn > 0) {
    trim.gain.setValueAtTime(0, startAt)
    trim.gain.linearRampToValueAtTime(level, startAt + fadeIn)
  }

  source.onended = () => {
    try { source.disconnect() } catch { /* already torn down */ }
    try { trim.disconnect() } catch { /* already torn down */ }
  }

  return { source, gain: trim, level }
}

/** Fade a node out over `seconds`, then stop and unhook it. */
export function fadeOutAndStop(handle, seconds = 0.4) {
  if (!handle) return
  const ctx = getAudioContext()
  const { source, gain } = handle
  if (!ctx) {
    try { source.stop() } catch { /* never started */ }
    return
  }
  const now = ctx.currentTime
  try {
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + seconds)
  } catch { /* param already detached */ }
  try { source.stop(now + seconds + 0.02) } catch { /* already stopped */ }
}

export { ramp }
