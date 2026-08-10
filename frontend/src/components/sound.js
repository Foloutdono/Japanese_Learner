import { useSyncExternalStore } from 'react'

const MUTE_KEY   = 'jp-app-muted'
const VOLUME_KEY = 'jp-app-volumes'

export const SOUND_CATEGORIES = ['kana', 'tts', 'sfx', 'ui', 'ambiance']

const DEFAULT_VOLUMES = {
  master:   1,
  kana:     1,
  tts:      1,
  sfx:      1,
  ui:       1,
  ambiance: 1,
}

const BASE_GAIN = {
  kana: 0.8,
  tts:  0.9,
  sfx: {
    success:    0.3,
    'level-up': 0.7,
  },
  ui: {
    click:  0.25,
    toggle: 0.10,
  },
  // Deliberately quiet relative to everything else — it's a bed under
  // the app, not a foreground sound competing with kana/TTS/SFX.
  ambiance: 0.40,
}

// ═══════════════════════════════════════════════════════════════
//  Web Audio Context
// ═══════════════════════════════════════════════════════════════
// Using AudioContext + decoded AudioBuffers instead of
// <audio> elements avoids grabbing the OS media session.
// On iOS/Android this means background music (Spotify, etc.)
// keeps playing when our short sounds fire.
// ───────────────────────────────────────────────────────────────
let _audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    _audioCtx = new AC()
  }
  // Browser autoplay policy may leave the context suspended
  // until the first user gesture — try to unlock on every play.
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {})
  }
  return _audioCtx
}

// ═══════════════════════════════════════════════════════════════
//  Decoded buffer cache
// ═══════════════════════════════════════════════════════════════
// Maps file path -> Promise<AudioBuffer>.
// MP3s are fetched once, decoded into raw PCM, and kept in memory.
// Every playback creates a fresh, cheap AudioBufferSourceNode.
// ───────────────────────────────────────────────────────────────
const _bufferCache = new Map()

async function fetchAndDecode(path) {
  const ctx = getAudioContext()
  if (!ctx) return null

  const response = await fetch(path)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  return ctx.decodeAudioData(arrayBuffer)
}

function getBuffer(path) {
  let pending = _bufferCache.get(path)
  if (!pending) {
    pending = fetchAndDecode(path).catch(() => null)
    _bufferCache.set(path, pending)
  }
  return pending
}

function playDecoded(path, category, soundName) {
  if (muted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const finalGain = gainFor(category, soundName)
  if (finalGain <= 0) return

  getBuffer(path).then(buffer => {
    if (!buffer || muted) return

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const gain = ctx.createGain()
    gain.gain.value = finalGain

    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(0)
  }).catch(() => {})
}

// ═══════════════════════════════════════════════════════════════
//  Mute / Volume state (unchanged API)
// ═══════════════════════════════════════════════════════════════
function clamp01(n) {
  return Math.min(1, Math.max(0, n))
}

function readMuted() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function readVolumes() {
  if (typeof window === 'undefined') return { ...DEFAULT_VOLUMES }
  try {
    const saved = JSON.parse(window.localStorage.getItem(VOLUME_KEY) ?? 'null')
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_VOLUMES }
    return { ...DEFAULT_VOLUMES, ...saved }
  } catch {
    return { ...DEFAULT_VOLUMES }
  }
}

let muted   = readMuted()
let volumes = readVolumes()
const muteListeners   = new Set()
const volumeListeners = new Set()

export function isMuted() {
  return muted
}

export function setMuted(value) {
  if (value === muted) return
  muted = value
  try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch {}
  updateAmbianceGain()
  muteListeners.forEach(fn => fn())
}

export function toggleMute() {
  setMuted(!muted)
}

function subscribeMute(fn) {
  muteListeners.add(fn)
  return () => muteListeners.delete(fn)
}

export function useMuted() {
  return useSyncExternalStore(subscribeMute, isMuted, () => false)
}

export function getVolumes() {
  return volumes
}

export function getVolume(category) {
  return category === 'master' ? volumes.master : (volumes[category] ?? 1)
}

export function setVolume(category, value) {
  const next = clamp01(value)
  if (volumes[category] === next) return
  volumes = { ...volumes, [category]: next }
  try { window.localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes)) } catch {}
  updateAmbianceGain()
  volumeListeners.forEach(fn => fn())
}

export function resetVolumes() {
  volumes = { ...DEFAULT_VOLUMES }
  try { window.localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes)) } catch {}
  updateAmbianceGain()
  volumeListeners.forEach(fn => fn())
}

function subscribeVolumes(fn) {
  volumeListeners.add(fn)
  return () => volumeListeners.delete(fn)
}

export function useVolumes() {
  return useSyncExternalStore(subscribeVolumes, getVolumes, () => DEFAULT_VOLUMES)
}

function gainFor(category, soundName) {
  const categoryGain = BASE_GAIN[category]
  const base = (categoryGain && typeof categoryGain === 'object')
    ? (categoryGain[soundName] ?? 1)
    : (categoryGain ?? 1)
  return clamp01(volumes.master * (volumes[category] ?? 1) * base)
}

// ═══════════════════════════════════════════════════════════════
//  Playback helpers
// ═══════════════════════════════════════════════════════════════
export function playKana(romaji) {
  if (!romaji || muted) return
  playDecoded(`/sounds/kanas/${romaji}.mp3`, 'kana', romaji)
}

export function playSfx(name) {
  if (!name || muted) return
  playDecoded(`/sounds/sfx/${name}.mp3`, 'sfx', name)
}

export function playUi(name) {
  if (!name || muted) return
  playDecoded(`/sounds/ui/${name}.mp3`, 'ui', name)
}

export function playAnnouncement(name) {
  if (!name || muted) return
  const ctx = getAudioContext()
  if (!ctx) return

  Promise.all([
    getBuffer('/sounds/announcements/jingle.mp3'),
    getBuffer(`/sounds/announcements/${name}.wav`),
  ]).then(([jingleBuffer, announcementBuffer]) => {
    if (muted) return

    // Both buffers are scheduled up front against ctx.currentTime, so
    // the announcement's start time is exact (sample-accurate) rather
    // than depending on a JS timer firing after the jingle "should"
    // be done — that's what let them overlap before.
    let when = ctx.currentTime

    if (jingleBuffer) {
      const jingleGain = gainFor('ui', 'jingle')
      if (jingleGain > 0) {
        const source = ctx.createBufferSource()
        source.buffer = jingleBuffer
        const gain = ctx.createGain()
        gain.gain.value = jingleGain
        source.connect(gain)
        gain.connect(ctx.destination)
        source.start(when)
      }
      when += jingleBuffer.duration
    }

    if (announcementBuffer) {
      const announcementGain = gainFor('ui', name)
      if (announcementGain > 0) {
        const source = ctx.createBufferSource()
        source.buffer = announcementBuffer
        const gain = ctx.createGain()
        gain.gain.value = announcementGain
        source.connect(gain)
        gain.connect(ctx.destination)
        source.start(when)
      }
    }
  }).catch(() => {})
}

export function playClick() {
  playUi('click')
}

export function playToggle() {
  playUi('toggle')
}

export function speakJapanese(text) {
  if (!text || muted) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.8
  utterance.volume = gainFor('tts', text)
  window.speechSynthesis.speak(utterance)
}

// ═══════════════════════════════════════════════════════════════
//  Ambiance music (looping background track)
// ═══════════════════════════════════════════════════════════════
// A single persistent AudioBufferSourceNode with loop: true, rather
// than the fire-and-forget "new source per play" pattern the rest of
// this file uses for one-shot sounds — ambiance needs to keep running
// across volume/mute changes instead of being torn down and restarted
// each time (which would jump the track back to 0 on every slider
// drag). One `_ambianceGain` node stays wired in for as long as it's
// playing; setMuted/setVolume/resetVolumes above just retune it.
//
// Playback is scoped to whichever screen calls startAmbiance() —
// currently only HomeScreen, via a mount-effect that also calls
// stopAmbiance() on unmount, so it plays there and nowhere else.
// isAmbianceEnabled/setAmbianceEnabled below is just the persisted
// on/off *preference* (surfaced in Settings) — flipping it doesn't
// start or stop anything by itself, since sound.js has no notion of
// which screen is currently mounted. A screen that wants ambiance
// reads the preference with useAmbianceEnabled() and reacts to it.
// ─────────────────────────────────────────────────────────────────
const AMBIANCE_KEY = 'jp-app-ambiance'
// Swap this to change the track, or extend into a per-track selector
// later — for now the app ships one loop, expected at this path.
const AMBIANCE_TRACK = 'home'

function readAmbianceEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(AMBIANCE_KEY) === '1'
  } catch {
    return false
  }
}

let ambianceEnabled = readAmbianceEnabled()
const ambianceListeners = new Set()

let _ambianceSource = null
let _ambianceGain = null

function updateAmbianceGain() {
  if (!_ambianceGain) return
  _ambianceGain.gain.value = muted ? 0 : gainFor('ambiance', AMBIANCE_TRACK)
}

// Starts playback if the preference is on and nothing's already
// playing — safe to call unconditionally from a screen's mount
// effect without checking isAmbianceEnabled() first.
export function startAmbiance() {
  if (!ambianceEnabled) return
  const ctx = getAudioContext()
  if (!ctx || _ambianceSource) return

  getBuffer(`/sounds/ambiant/${AMBIANCE_TRACK}.mp3`).then(buffer => {
    // The screen may have unmounted, or the preference flipped back
    // off, while this was loading.
    if (!buffer || !ambianceEnabled || _ambianceSource) return

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const gain = ctx.createGain()
    gain.gain.value = muted ? 0 : gainFor('ambiance', AMBIANCE_TRACK)

    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(0)

    _ambianceSource = source
    _ambianceGain = gain
  }).catch(() => {})
}

// Always safe to call, even if nothing's playing.
export function stopAmbiance() {
  if (_ambianceSource) {
    try { _ambianceSource.stop() } catch {}
    try { _ambianceSource.disconnect() } catch {}
  }
  if (_ambianceGain) {
    try { _ambianceGain.disconnect() } catch {}
  }
  _ambianceSource = null
  _ambianceGain = null
}

export function isAmbianceEnabled() {
  return ambianceEnabled
}

// Persists the preference only. Does not start/stop playback — the
// mounted screen's own effect (subscribed via useAmbianceEnabled)
// picks up the change and calls startAmbiance()/stopAmbiance() itself.
export function setAmbianceEnabled(value) {
  if (value === ambianceEnabled) return
  ambianceEnabled = value
  try { window.localStorage.setItem(AMBIANCE_KEY, ambianceEnabled ? '1' : '0') } catch {}
  ambianceListeners.forEach(fn => fn())
}

export function toggleAmbiance() {
  setAmbianceEnabled(!ambianceEnabled)
}

function subscribeAmbiance(fn) {
  ambianceListeners.add(fn)
  return () => ambianceListeners.delete(fn)
}

export function useAmbianceEnabled() {
  return useSyncExternalStore(subscribeAmbiance, isAmbianceEnabled, () => false)
}