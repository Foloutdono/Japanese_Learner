// ── AudioContext and buffer cache ─────────────────────────
// One context for the whole app, created on the first real gesture —
// not on the first *call*. Browsers refuse to start audio before a
// gesture, and Chrome logs
//
//   The AudioContext was not allowed to start. It must be resumed
//   (or created) after a user gesture on the page.
//
// the moment one is *constructed* without user activation, not merely
// when resume() later fails. So a context built eagerly on page load
// buys nothing (it can't make a sound either way) and costs a console
// warning plus a dead suspended context — which is exactly what the
// app was doing twice per load: once from App.jsx's preload, once
// from the home screen starting its ambiance on mount.
//
// Waiting instead is safe because every caller already treats a null
// context as "stay silent" (see mixer.js/playback.js/ambiance.js) —
// the same silence the browser was going to enforce regardless. What
// genuinely needs to happen later, rather than not at all, goes
// through whenUnlocked() below.
//
// Decoded buffers are cached by URL so a kana played fifty times is
// fetched and decoded once.

let ctx = null
let unlocked = false
const waiting = new Set()

function hasActivation() {
  if (unlocked) return true
  // Covers a gesture made before this module was ever imported — a
  // click that triggers the very route that pulls audio in. Our own
  // listeners would have missed it; the browser remembers it.
  return navigator.userActivation?.hasBeenActive === true
}

export function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    if (!hasActivation()) return null
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  // Only auto-resume when someone is actually looking. Without this
  // guard, any sound attempted while the tab is hidden would undo the
  // suspend that hiding the tab just performed — see ambiance.js.
  if (ctx.state === 'suspended' && !document.hidden) {
    ctx.resume().catch(() => {})
  }
  return ctx
}

export function isRunning() {
  return !!ctx && ctx.state === 'running'
}

/**
 * Run `fn` once audio is actually allowed to play — synchronously if
 * a gesture has already happened. For the sounds nobody clicked for:
 * the ambiance is asked for by a screen mounting, so without this it
 * would simply never start on a fresh load. Returns an unsubscribe.
 */
export function whenUnlocked(fn) {
  if (hasActivation()) {
    fn()
    return () => {}
  }
  waiting.add(fn)
  return () => waiting.delete(fn)
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    if (unlocked) return
    unlocked = true
    getAudioContext()
    const pending = [...waiting]
    waiting.clear()
    // One bad listener must not swallow the rest of the queue.
    pending.forEach(fn => { try { fn() } catch { /* keep going */ } })
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

const bufferCache = new Map()

async function fetchAndDecode(path) {
  const context = getAudioContext()
  if (!context) return null
  const response = await fetch(path)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return context.decodeAudioData(await response.arrayBuffer())
}

export function getBuffer(path) {
  // No context means nothing to decode into. Answer empty *without*
  // caching: caching now would pin `null` to this path for the rest
  // of the session, and the next call — after the first click — will
  // have a real context to decode with.
  if (!getAudioContext()) return Promise.resolve(null)

  let pending = bufferCache.get(path)
  if (!pending) {
    pending = fetchAndDecode(path).catch(err => {
      // A failed decode must not be cached: the previous version
      // stored the rejected result as a permanent `null`, so one
      // dropped request meant that sound stayed silent for the rest
      // of the session. Evicting lets the next attempt retry.
      bufferCache.delete(path)
      throw err
    })
    bufferCache.set(path, pending)
  }
  return pending
}

// Warm the cache without playing anything — used for sounds whose
// first play must not be late (the review chime, the level-up).
// Deferred until unlock for the same reason as everything else: there
// is nowhere to decode into before then, and the gesture that unlocks
// us also runs this, so the buffers are still warm well before the
// screens that need them appear.
export function preload(paths) {
  whenUnlocked(() => { paths.forEach(p => { getBuffer(p).catch(() => {}) }) })
}
