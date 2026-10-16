// ── 再生 — an <audio> element, on the film's clock (plan 210) ─────────
// Dictation's clip player and the exam's listening player play real
// <audio> elements, which keep the sound card's time: on the stepped
// clock of a film their progress, their `ended` and their sound would
// all be wrong (and a headless browser has no sound card). So an audio
// element's playback is taken over here: play() decodes the clip into
// the recorded soundtrack (stage/audio.js) at the film's now, and the
// element reports its progress from the film's clock, with the events
// the players listen for (play, playing, timeupdate, pause, ended).
//
// Video elements are left alone.

import { audioClock } from './audio'

const state = new WeakMap()
let context = null

function mediaContext() {
  if (!context) context = new window.AudioContext()
  return context
}

function st(el) {
  let s = state.get(el)
  if (!s) {
    s = { playing: false, offset: 0, startedAt: 0, duration: NaN, ended: false, src: null, buffer: null, source: null, timer: null }
    state.set(el, s)
  }
  return s
}

const isAudio = el => el instanceof HTMLAudioElement

export function installMedia() {
  const proto = HTMLMediaElement.prototype
  const native = name => Object.getOwnPropertyDescriptor(proto, name)
  const nativePlay = proto.play
  const nativePause = proto.pause
  const nativeTime = native('currentTime')
  const nativePaused = native('paused')
  const nativeEnded = native('ended')
  const nativeDuration = native('duration')

  const now = () => audioClock.now()
  const timeOf = (el, s) => (s.playing ? Math.min(s.duration || Infinity, now() - s.startedAt) : s.offset)

  async function bufferFor(el, s) {
    const src = el.currentSrc || el.src
    if (s.src === src && s.buffer) return s.buffer
    const data = await (await fetch(src)).arrayBuffer()
    s.buffer = await mediaContext().decodeAudioData(data)
    s.src = src
    s.duration = s.buffer.duration
    el.dispatchEvent(new Event('durationchange'))
    return s.buffer
  }

  function stop(el, s, { ended = false } = {}) {
    s.offset = ended ? s.duration : timeOf(el, s)
    s.playing = false
    s.ended = ended
    clearInterval(s.timer)
    try { s.source?.stop() } catch { /* already stopped */ }
    s.source = null
  }

  proto.play = function play() {
    if (!isAudio(this)) return nativePlay.call(this)
    const el = this
    const s = st(el)
    if (s.playing) return Promise.resolve()
    if (s.ended) { s.offset = 0; s.ended = false }
    s.playing = true
    s.startedAt = now() - s.offset
    el.dispatchEvent(new Event('play'))
    return bufferFor(el, s).then(buffer => {
      if (!s.playing) return
      const ctx = mediaContext()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.value = el.muted ? 0 : el.volume
      source.connect(gain).connect(ctx.destination)
      // From where it stands (a resumed clip carries on, not over).
      s.startedAt = now() - s.offset
      source.start(0, s.offset)
      s.source = source
      el.dispatchEvent(new Event('playing'))
      s.timer = setInterval(() => {
        if (!s.playing) return
        el.dispatchEvent(new Event('timeupdate'))
        if (timeOf(el, s) >= s.duration - 0.01) {
          stop(el, s, { ended: true })
          el.dispatchEvent(new Event('timeupdate'))
          el.dispatchEvent(new Event('pause'))
          el.dispatchEvent(new Event('ended'))
        }
      }, 120)
    }, () => {
      s.playing = false
      el.dispatchEvent(new Event('error'))
      throw new DOMException('reel: the clip could not be decoded', 'NotSupportedError')
    })
  }

  proto.pause = function pause() {
    if (!isAudio(this)) return nativePause.call(this)
    const s = st(this)
    if (!s.playing) return
    stop(this, s)
    this.dispatchEvent(new Event('pause'))
  }

  Object.defineProperty(proto, 'currentTime', {
    configurable: true,
    get() { return isAudio(this) ? timeOf(this, st(this)) : nativeTime.get.call(this) },
    set(v) {
      if (!isAudio(this)) { nativeTime.set.call(this, v); return }
      const s = st(this)
      const playing = s.playing
      if (playing) stop(this, s)
      s.offset = Math.max(0, Number(v) || 0)
      s.ended = false
      if (playing) this.play()
    },
  })
  Object.defineProperty(proto, 'paused', {
    configurable: true,
    get() { return isAudio(this) ? !st(this).playing : nativePaused.get.call(this) },
  })
  Object.defineProperty(proto, 'ended', {
    configurable: true,
    get() { return isAudio(this) ? st(this).ended : nativeEnded.get.call(this) },
  })
  Object.defineProperty(proto, 'duration', {
    configurable: true,
    get() {
      if (!isAudio(this)) return nativeDuration.get.call(this)
      const d = st(this).duration
      return Number.isNaN(d) ? nativeDuration.get.call(this) : d
    },
  })
}
