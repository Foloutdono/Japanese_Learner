// ── AudioContext and buffer cache ─────────────────────────
// One context for the whole app, created lazily on first use and
// unlocked by the first real gesture (browsers refuse to start audio
// before one). Decoded buffers are cached by URL so a kana played
// fifty times is fetched and decoded once.

let ctx = null

export function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
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

if (typeof window !== 'undefined') {
  const unlock = () => getAudioContext()
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
export function preload(paths) {
  paths.forEach(p => { getBuffer(p).catch(() => {}) })
}
