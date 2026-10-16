import { getAudioContext, whenUnlocked } from './context'
import { playBuffer, fadeOutAndStop, ramp } from './mixer'
import { isMuted } from './settings'
import { stopSpeaking } from './speech'
import { printHour } from '../../domain/printHour'
import AMBIANCE from './ambiance.json'

// ── Ambiance ──────────────────────────────────────────────
// The one looping sound in the app, and the only one whose lifetime
// is longer than a keypress — which makes it the only one where
// transitions, tab focus and navigation all actually matter.
//
// 湖の刻 (plan 219): what it plays is the lake on Today's print at
// the print's own hour — a lake at the foot of Fuji in autumn, its
// shore, the pine and the local line, at 曙 dawn, 帰帆 the day, 落雁
// dusk and 秋月 night (domain/printHour.js, one rule for the picture
// and the sound). Each hour is a two-minute loop drawn by
// scripts/ambiance (README there); behind Today and every station page.
//
// What it does:
//
//  1. **It stops when you leave the tab.** A background tab quietly
//     playing music is the single most annoying thing a web app can
//     do. On `visibilitychange` the track fades out and the whole
//     AudioContext is suspended, which also freezes the loop's
//     position — so coming back resumes mid-phrase instead of
//     restarting, and costs nothing while you're away.
//
//  2. **Navigating between screens that play it is seamless.** Every
//     screen's cleanup calls stopAmbiance() and the next screen's
//     effect calls startAmbiance(), so moving from Today to a station
//     page would stop it and start it again. Stops are deferred
//     briefly, and a start inside that window simply cancels the stop.
//
//  3. **The hour turns under it.** While it plays, the clock is read
//     every half minute, and a new hour crossfades in slowly.
//
//  4. **The seam is never heard.** Each file is the loop with a second
//     of itself on either side, and it plays between the two
//     (loopStart/loopEnd): the loop is built on a circle, so that
//     region joins itself exactly wherever the decoder put sample 0.
//     It starts at a random point of the loop, so the same bird is
//     not the first thing every screen opens on.
//
//  5. **One hour in memory.** A decoded loop is ~23 MB at the 24 kHz
//     it is decoded at (nothing in it is above 12 kHz; at 48 kHz it
//     would be twice that), so only the hour playing is kept, never
//     in the shared buffer cache.

const FADE_IN   = 1.2
const FADE_OUT  = 0.7
const HIDE_FADE = 0.25
const HOUR_FADE = 6
const CLOCK_MS  = 30_000
const DECODE_RATE = 24000

// How long a stop waits before it actually happens. Long enough to
// cover an unmount/mount pair during a route change, short enough
// that genuinely leaving for a screen with no ambiance still feels
// immediate.
const STOP_GRACE_MS = 260

let current = null        // { hour, handle }
let wanted = false        // a screen has asked for it
let loading = null        // the hour being fetched and decoded
let stopTimer = null
let clock = null
let hidden = false
let cancelDeferred = null // unsubscribe for a start waiting on a gesture
let held = null           // { url, promise }: the one decoded hour kept

export const ambianceUrl = hour => `/sounds/ambiant/${AMBIANCE.rev}/${hour}.mp3`

function decode(data) {
  const ctx = getAudioContext()
  const inContext = bytes => new Promise((ok, no) => ctx.decodeAudioData(bytes, ok, no))
  const Offline = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext)
  if (!Offline) return inContext(data)
  try {
    const off = new Offline(2, 1, DECODE_RATE)
    // decodeAudioData detaches what it is given: keep the bytes for
    // the context's own decoder, if this one refuses the rate.
    return new Promise((ok, no) => off.decodeAudioData(data.slice(0), ok, no)).catch(() => inContext(data))
  } catch {
    return inContext(data)
  }
}

function load(hour) {
  const url = ambianceUrl(hour)
  if (held?.url === url) return held.promise
  const promise = fetch(url)
    .then(r => { if (!r.ok) throw new Error(`ambiance ${r.status}`); return r.arrayBuffer() })
    .then(decode)
  // Replacing the hold lets the last hour's buffer go once its source
  // has faded out; a failure is not held, so the next start retries.
  held = { url, promise }
  promise.catch(() => { if (held?.url === url) held = null })
  return promise
}

function play(hour, fadeIn) {
  loading = hour
  load(hour).then(buffer => {
    // Stopped, or the hour turned again, while this was decoding.
    if (!buffer || !wanted || loading !== hour) return
    loading = null
    const outgoing = current
    const { loop, pad } = AMBIANCE
    const handle = playBuffer(buffer, 'ambiance', 'lake', {
      loop: true, loopStart: pad, loopEnd: pad + loop, offset: pad + Math.random() * loop, fadeIn,
    })
    if (outgoing) fadeOutAndStop(outgoing.handle, fadeIn === HOUR_FADE ? HOUR_FADE : FADE_OUT)
    if (!handle) { current = null; return }
    current = { hour, handle }
    // Started while the tab was in the background (a route change in
    // a hidden tab): keep it silent until we're looked at again.
    if (hidden || isMuted()) ramp(handle.gain.gain, 0, 0.01)
  }).catch(() => { if (loading === hour) loading = null })
}

function tick() {
  if (hidden || !wanted || loading || !current) return
  const hour = printHour(new Date())
  if (hour !== current.hour) play(hour, HOUR_FADE)
}

function reallyStop(fade = FADE_OUT) {
  stopTimer = null
  wanted = false
  loading = null
  if (clock) { clearInterval(clock); clock = null }
  if (current) fadeOutAndStop(current.handle, fade)
  current = null
}

/** Play the lake of the hour (plan 219). Every screen that wants it
 *  calls this on mount and stopAmbiance() on unmount. */
export function startAmbiance() {
  // A start cancels any pending stop — this is what makes navigation
  // between two screens that play it seamless.
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
  if (wanted && (current || loading)) return
  wanted = true

  const ctx = getAudioContext()
  // Nothing has been clicked yet, so there is no context to play into.
  // The ambiance is the one sound asked for by a screen mounting
  // rather than by a gesture, so it has to wait for one: hold the
  // request and pick it up the moment the page is first touched,
  // unless the app has stopped asking by then. Only ever one deferral
  // in flight — a mount/unmount/mount pair (StrictMode, or a quick
  // route change) would otherwise queue two starts and the unlock
  // would play the loop twice, over itself.
  if (!ctx) {
    if (cancelDeferred) cancelDeferred()
    cancelDeferred = whenUnlocked(() => {
      cancelDeferred = null
      if (wanted && !current && !loading) { wanted = false; startAmbiance() }
    })
    return
  }

  play(printHour(new Date()), FADE_IN)
  if (!clock) clock = setInterval(tick, CLOCK_MS)
}

export function stopAmbiance() {
  if (!current && !wanted) return
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
