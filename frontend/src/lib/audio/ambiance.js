import { getAudioContext, getBuffer } from './context'
import { playBuffer, fadeOutAndStop, ramp } from './mixer'
import { isMuted } from './settings'
import { stopSpeaking } from './speech'

// ── Ambiance ──────────────────────────────────────────────
// The one looping sound in the app, and the only one whose lifetime
// is longer than a keypress — which makes it the only one where
// transitions, tab focus and navigation all actually matter.
//
// Three behaviours it now has that it didn't:
//
//  1. **It stops when you leave the tab.** A background tab quietly
//     playing music is the single most annoying thing a web app can
//     do. On `visibilitychange` the track fades out and the whole
//     AudioContext is suspended, which also freezes the loop's
//     position — so coming back resumes mid-phrase instead of
//     restarting, and costs nothing while you're away.
//
//  2. **Navigating between screens that share a track is seamless.**
//     Every screen's cleanup calls stopAmbiance() and the next
//     screen's effect calls startAmbiance(), so moving from Home to
//     the Daruma Hall — both 'home' — used to stop the track and
//     start it again from zero. Stops are now deferred briefly, and a
//     start for the same track inside that window simply cancels the
//     stop. The music just keeps playing.
//
//  3. **Track changes crossfade** instead of cutting.

const FADE_IN   = 1.2
const FADE_OUT  = 0.7
const HIDE_FADE = 0.25

// How long a stop waits before it actually happens. Long enough to
// cover an unmount/mount pair during a route change, short enough
// that genuinely leaving for a screen with no ambiance still feels
// immediate.
const STOP_GRACE_MS = 260

let current = null        // { track, handle }
let requested = null      // the track the app last asked for
let stopTimer = null
let hidden = false

const trackUrl = track => `/sounds/ambiant/${track}.mp3`

function reallyStop(fade = FADE_OUT) {
  stopTimer = null
  if (current) fadeOutAndStop(current.handle, fade)
  current = null
  requested = null
}

export function startAmbiance(track) {
  if (!track) return

  // A start cancels any pending stop — this is what makes navigation
  // between two screens with the same track seamless.
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }

  if (requested === track && current) return
  requested = track

  const ctx = getAudioContext()
  if (!ctx) return

  const outgoing = current
  current = null

  getBuffer(trackUrl(track)).then(buffer => {
    // The user navigated again while this was decoding.
    if (!buffer || requested !== track) return
    if (outgoing) fadeOutAndStop(outgoing.handle, FADE_OUT)

    const handle = playBuffer(buffer, 'ambiance', track, { loop: true, fadeIn: FADE_IN })
    if (!handle) return
    current = { track, handle }
    // Started while the tab was in the background (a route change in
    // a hidden tab): keep it silent until we're looked at again.
    if (hidden || isMuted()) ramp(handle.gain.gain, 0, 0.01)
  }).catch(() => {})
}

export function stopAmbiance() {
  if (!current && !requested) return
  requested = null
  if (stopTimer) clearTimeout(stopTimer)
  stopTimer = setTimeout(() => reallyStop(), STOP_GRACE_MS)
}

// ── Tab visibility ────────────────────────────────────────
function onHide() {
  if (hidden) return
  hidden = true
  const ctx = getAudioContext()
  if (current) ramp(current.handle.gain.gain, 0, HIDE_FADE)
  stopSpeaking()
  // Suspend only after the fade has actually been heard — suspending
  // immediately freezes the audio clock mid-ramp and the track cuts
  // rather than fades.
  if (ctx) setTimeout(() => { if (hidden) ctx.suspend().catch(() => {}) }, HIDE_FADE * 1000 + 40)
}

function onShow() {
  if (!hidden) return
  hidden = false
  const ctx = getAudioContext()
  if (!ctx) return
  ctx.resume()
    .then(() => { if (current && !isMuted()) ramp(current.handle.gain.gain, current.handle.level, FADE_IN) })
    .catch(() => {})
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()))
  // Covers the cases visibilitychange misses on mobile Safari, where a
  // page can be frozen for bfcache without ever reporting hidden.
  window.addEventListener('pagehide', onHide)
  window.addEventListener('pageshow', onShow)
}
