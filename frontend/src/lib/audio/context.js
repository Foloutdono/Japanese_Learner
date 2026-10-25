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
    playThroughSilentSwitch()
    ctx = new AC()
  }
  // Only auto-resume when someone is actually looking. Without this
  // guard, any sound attempted while the tab is hidden would undo the
  // suspend that hiding the tab just performed — see ambiance.js.
  wake()
  return ctx
}

// Asleep is two states, not one. `suspended` is ours (ambiance.js
// suspends a hidden tab) or a browser's that never let the context
// start. `interrupted` is Safari's own: a phone call, Siri, another
// app's audio or a locked screen puts the context there, and it stays
// there after the page is looked at again. Only `suspended` used to be
// woken, so on an iPhone one locked screen silenced the app until it
// was reloaded.
function asleep() {
  return ctx?.state === 'suspended' || ctx?.state === 'interrupted'
}

function wake() {
  if (asleep() && !document.hidden) ctx.resume().catch(() => {})
}

// ── Through the silent switch ─────────────────────────────
// iOS gives a page's Web Audio the session a game's sounds get: with
// the ringer switch on silent all of it is muted, with no error and
// nothing to detect, and a learner who keeps the phone on silent (many
// do) heard nothing at all. 'playback' is the session a video gets,
// which plays through the switch, as a word asked for out loud should.
// Its cost was chosen knowingly (2026-10-25): another app's music
// pauses while the app plays, the lake included, as it would for a
// video, and the app is muted from Réglages › Son instead. Safari 17
// and later; elsewhere there is nothing to set.
function playThroughSilentSwitch() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback'
  } catch { /* an older shape of the API: nothing to set */ }
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

// ── The gesture ───────────────────────────────────────────
// Only some events give a page the right to play (HTML's "activation
// triggering input events"): a key, a mouse button going down, and a
// finger only once it LIFTS. A finger's pointerdown is not one of
// them. It was the only event listened for, once, so on a phone the
// context was made and asked to resume a moment before the browser
// would allow either, the listener was gone by the time the finger
// lifted, and iOS's speech was primed (speech.js) outside the gesture
// that speech needs. touchend and click are the lifts listened for:
// the two every phone browser honours, touchend the one iOS audio has
// been unlocked on since iOS 9. A pen's tap is its click.
//
// And it keeps listening. A context the browser puts to sleep after it
// has played (Safari's `interrupted`, above; a resume() refused
// outside a gesture when the tab comes back) is woken by the next tap,
// inside that tap, which is the one place every browser lets it. The
// cost is a state check per tap. Capture, so a handler that stops
// propagation cannot keep the tap from us, and so the context is
// already waking when the tap's own handler asks for a sound.
function isGesture(e) {
  if (e.type === 'pointerdown') return e.pointerType === 'mouse'
  if (e.type === 'keydown') return e.key !== 'Escape'
  return true
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    unlocked = true
    getAudioContext()
    const pending = [...waiting]
    waiting.clear()
    // One bad listener must not swallow the rest of the queue.
    pending.forEach(fn => { try { fn() } catch { /* keep going */ } })
  }
  const onGesture = e => {
    if (!isGesture(e)) return
    if (!unlocked) unlock()
    else wake()
  }
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, onGesture, { capture: true, passive: true })
  }
}

const bufferCache = new Map()

async function fetchAndDecode(path) {
  const context = getAudioContext()
  if (!context) return null
  const response = await fetch(path)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return context.decodeAudioData(await response.arrayBuffer())
}

// How many decoded clips are kept: every kana (127) and the words and
// lines heard last. It used to be all of them, for the whole session,
// and a server clip is a new entry per word: a few hundred cards on a
// phone that speaks through the server held tens of megabytes of
// decoded audio nobody would replay, on the devices with the least of
// it. One past the limit drops the clip least recently asked for, which
// is fetched again (from the worker's cache) if it ever is.
const KEEP = 200

export function getBuffer(path) {
  // No context means nothing to decode into. Answer empty *without*
  // caching: caching now would pin `null` to this path for the rest
  // of the session, and the next call — after the first click — will
  // have a real context to decode with.
  if (!getAudioContext()) return Promise.resolve(null)

  let pending = bufferCache.get(path)
  if (pending) {
    // To the back of the line: asked for again, it is kept the longest.
    bufferCache.delete(path)
  } else {
    pending = fetchAndDecode(path).catch(err => {
      // A failed decode must not be cached: the previous version
      // stored the rejected result as a permanent `null`, so one
      // dropped request meant that sound stayed silent for the rest
      // of the session. Evicting lets the next attempt retry -- this
      // attempt only, never a newer one already in its place.
      if (bufferCache.get(path) === pending) bufferCache.delete(path)
      throw err
    })
  }
  bufferCache.set(path, pending)
  if (bufferCache.size > KEEP) bufferCache.delete(bufferCache.keys().next().value)
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
