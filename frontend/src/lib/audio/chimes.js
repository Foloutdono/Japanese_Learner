import { getAudioContext, getBuffer } from './context'
import { busFor, playBuffer } from './mixer'
import { isMuted } from './settings'

// ── 改札 — the gate chime ──────────────────────────────────
// The two-tone blip a Japanese ticket gate answers a valid pass with.
//
// It is synthesised rather than shipped as a file, for now. Two short
// sine blips are a handful of oscillator nodes and no bytes at all,
// which is the right trade for a sound that fires on every departure
// — but a real recording will always beat a synthesised one, so this
// looks for `/sounds/ui/gate-chime.mp3` first and only falls back to
// generating it. Drop that file in and it is used automatically; no
// code here changes. See public/sounds/README.md.
const GATE_CHIME = '/sounds/ui/gate-chime.mp3'

// getBuffer deliberately evicts failed fetches so a dropped request
// can retry — correct in general, wrong for an asset that is *known*
// absent, which would then 404 on every single departure. One miss is
// enough to stop asking for the rest of the session.
let assetMissing = false

/**
 * Two blips, the second a fourth above the first: a rising pair reads
 * as "accepted" without any cultural knowledge, and stays pleasant on
 * the fortieth repeat in a way a single flat beep does not.
 *
 * Routed through the mixer's `ui` bus like every other sound, so mute
 * and the interface volume slider reach it — a naked oscillator wired
 * to the destination would keep playing through both.
 */
function synthesise(ctx) {
  const bus = busFor('ui')
  if (!bus) return

  const now = ctx.currentTime
  const blips = [
    { freq: 1975.5, at: 0,     dur: 0.055 },  // B6
    { freq: 2637.0, at: 0.075, dur: 0.075 },  // E7
  ]

  for (const { freq, at, dur } of blips) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + at)

    // A 4ms attack and an exponential tail: stepping the gain
    // straight to full would put a click at both ends of a blip this
    // short, which on a 2kHz tone is most of what you would hear.
    env.gain.setValueAtTime(0.0001, now + at)
    env.gain.exponentialRampToValueAtTime(0.5, now + at + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)

    osc.connect(env)
    env.connect(bus)
    osc.start(now + at)
    osc.stop(now + at + dur + 0.02)
    osc.onended = () => { env.disconnect(); osc.disconnect() }
  }
}

export function playGateChime() {
  if (isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (assetMissing) { synthesise(ctx); return }

  getBuffer(GATE_CHIME)
    .then(buffer => {
      if (isMuted()) return
      if (buffer) playBuffer(buffer, 'ui', 'gate-chime')
      else { assetMissing = true; synthesise(ctx) }
    })
    .catch(() => { assetMissing = true; synthesise(ctx) })
}
