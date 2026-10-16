// ── 録音 — the app's own sounds, into the reel's soundtrack (plan 210) ──
// The app synthesises its voices on a Web Audio graph (lib/audio) and
// plays them on whatever AudioContext the page constructs. The reel's
// pages run on a clock the renderer steps a frame at a time (reel.mjs),
// which a real AudioContext ignores: it plays on the sound card's clock,
// and a headless browser has no sound card.
//
// So the constructor is an OfflineAudioContext here, and it is written,
// not played: its currentTime is the film's clock (since the context was
// made), so everything the app schedules at "now plus a little" lands at
// that moment of the film; a source started with no time, which means
// "now", is started at the film's now. Nothing renders while the film
// runs. finish() renders each context once, whole, and hands back its
// sound stamped with when the context was made, for the director to mix
// into one track. (Rendering in step with the frames, through the
// context's suspend(), cannot work: its promise is never kept while the
// page's clock is paused between frames.)
//
// To the app the context is an ordinary running one: `state` is always
// 'running', and its own resume/suspend/close are no-ops.
//
// Used by both the director and the stage, each for its own window, in
// which it is the only kind of AudioContext there is.

const SR = 48000

const Offline = typeof window !== 'undefined' ? window.OfflineAudioContext : null

const records = []
let lengthSeconds = 120
let clock = () => performance.now() / 1000

/**
 * The film's now. Every recorded context, in every window, runs on the
 * film's own timeline from its first frame (a context made late is
 * silent before it was made), so a time means the same moment on any of
 * them and their sounds mix without an offset.
 */
function contextNow() {
  return Math.max(0, clock())
}

/** The reel's clock, in seconds, shared by every window that records. */
export const audioClock = {
  now: () => clock(),
  use(fn) { clock = fn },
  length(seconds) { lengthSeconds = seconds },
  finish,
  get contexts() { return records.length },
}

let installed = false

export function installAudio() {
  if (!Offline || installed) return
  installed = true

  class ReelAudioContext extends Offline {
    constructor() {
      super({ numberOfChannels: 2, length: Math.ceil(SR * lengthSeconds), sampleRate: SR })
      records.push({ ctx: this, bornAt: 0 })
    }
    get currentTime() { return contextNow() }
    get state() { return 'running' }
    get baseLatency() { return 0 }
    get outputLatency() { return 0 }
    resume() { return Promise.resolve() }
    suspend() { return Promise.resolve() }
    close() { return Promise.resolve() }
    // An offline context has no element or stream to draw from; what
    // asks for one gets a node that goes nowhere.
    createMediaElementSource() { return this.createGain() }
    createMediaStreamSource() { return this.createGain() }
  }
  window.AudioContext = ReelAudioContext
  window.webkitAudioContext = ReelAudioContext

  // "Now" is the film's now: a start or a stop with no time (or a time
  // already past) happens at this moment of the film, not at its start.
  for (const proto of [window.AudioScheduledSourceNode?.prototype, window.AudioBufferSourceNode?.prototype]) {
    if (!proto) continue
    for (const name of ['start', 'stop']) {
      const own = Object.getOwnPropertyDescriptor(proto, name)
      if (!own) continue
      const original = own.value
      proto[name] = function (when = 0, ...rest) {
        return original.call(this, Math.max(when || 0, contextNow()), ...rest)
      }
    }
  }
  // Nothing lets go of the graph. Every disconnect the app makes is a
  // cleanup: a voice's nodes are released once it has played (synth.js
  // lets go VOICE_LIFE_MS after it starts, a buffer when it ends). Here
  // nothing has played yet: the context renders when the film is over,
  // so a node released on a timer would have taken its voice out of the
  // film before it was ever heard. Kept, a node whose source has stopped
  // carries silence.
  window.AudioNode.prototype.disconnect = function disconnect() {}

  const param = window.AudioParam.prototype
  for (const name of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']) {
    const original = param[name]
    if (!original) continue
    const at = name.startsWith('cancel') ? 0 : 1
    param[name] = function (...args) {
      args[at] = Math.max(args[at] ?? 0, contextNow())
      return original.apply(this, args)
    }
  }
  const target = param.setTargetAtTime
  param.setTargetAtTime = function (value, start, constant) {
    return target.call(this, value, Math.max(start, contextNow()), constant)
  }
}

/**
 * Render every context, whole, and hand back each one's sound and when
 * it began on the film's clock. The page's clock must be running while
 * this is awaited (the renderer keeps stepping frames).
 */
export async function finish() {
  const out = []
  for (const rec of records) {
    const buffer = await rec.ctx.startRendering()
    out.push({
      bornAt: rec.bornAt,
      sampleRate: buffer.sampleRate,
      channels: [buffer.getChannelData(0), buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0)],
    })
  }
  return out
}
