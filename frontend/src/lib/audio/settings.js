import { useSyncExternalStore } from 'react'

// ── Audio settings ────────────────────────────────────────
// Mute and per-category volume, persisted to localStorage and
// published to both React (useMuted / useVolumes) and the mixer
// (which subscribes to apply them to live gain nodes).
//
// Deliberately knows nothing about the Web Audio graph — it is the
// model, mixer.js is the view. That split is what lets the settings
// screen move a slider before any AudioContext has ever been created.

const MUTE_KEY   = 'jp-app-muted'
const VOLUME_KEY = 'jp-app-volumes'

export const SOUND_CATEGORIES = ['kana', 'tts', 'sfx', 'ui', 'jingle', 'announcement', 'ambiance']

export const DEFAULT_VOLUMES = {
  master:       1,
  kana:         1,
  tts:          1,
  sfx:          1,
  ui:           1,
  jingle:       1,
  announcement: 1,
  ambiance:     1,
}

// Per-sound trim, applied on the source itself rather than on the
// category bus — this is mastering, not user preference: it's how
// loud each asset was recorded, and it must not move when someone
// drags the "effects" slider. A category key can be a single number
// or a per-sound map.
export const BASE_GAIN = {
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
  jingle:       0.3,
  announcement: 1,
  ambiance:     0.45,
}

export const clamp01 = n => Math.min(1, Math.max(0, n))

function readMuted() {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
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
// The mixer registers here so a slider reaches the gain nodes without
// settings.js having to import the audio graph.
const changeListeners = new Set()

export function onSettingsChange(fn) {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

export function isMuted() { return muted }

export function setMuted(value) {
  if (value === muted) return
  muted = value
  // Storage is unavailable in private mode and under some policies.
  // The setting still applies for this session; it just won't persist.
  try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* not persisted */ }
  changeListeners.forEach(fn => fn())
  muteListeners.forEach(fn => fn())
}

export function toggleMute() { setMuted(!muted) }

export function getVolumes() { return volumes }

export function getVolume(category) {
  return category === 'master' ? volumes.master : (volumes[category] ?? 1)
}

export function setVolume(category, value) {
  const next = clamp01(value)
  if (volumes[category] === next) return
  volumes = { ...volumes, [category]: next }
  try { window.localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes)) } catch { /* not persisted */ }
  changeListeners.forEach(fn => fn())
  volumeListeners.forEach(fn => fn())
}

// The per-sound trim for one asset — everything else (category
// volume, master, mute) now lives on the mixer's buses, so it applies
// to sounds already playing rather than only to the next one.
export function trimFor(category, soundName) {
  const categoryGain = BASE_GAIN[category]
  const base = (categoryGain && typeof categoryGain === 'object')
    ? (categoryGain[soundName] ?? 1)
    : (categoryGain ?? 1)
  return clamp01(base)
}

function subscribeMute(fn)    { muteListeners.add(fn);   return () => muteListeners.delete(fn) }
function subscribeVolumes(fn) { volumeListeners.add(fn); return () => volumeListeners.delete(fn) }

export function useMuted()   { return useSyncExternalStore(subscribeMute, isMuted, () => false) }
export function useVolumes() { return useSyncExternalStore(subscribeVolumes, getVolumes, () => DEFAULT_VOLUMES) }
