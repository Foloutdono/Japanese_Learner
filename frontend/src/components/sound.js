import { useSyncExternalStore } from 'react'

const MUTE_KEY   = 'jp-app-muted'
const VOLUME_KEY = 'jp-app-volumes'

// ── Sound categories ────────────────────────────────────────
// One slider per category in Settings, plus a master mix on top of
// all of them. Add a new category here (and a default below) any
// time a new kind of sound is introduced — nothing else needs to
// change for it to get its own row in the mixer.
export const SOUND_CATEGORIES = ['kana', 'tts', 'sfx', 'ui']

const DEFAULT_VOLUMES = {
  master: 1,
  kana:   1, // playKana — kana pronunciation clips
  tts:    1, // speakJapanese — browser speech synthesis
  sfx:    1, // playSfx / playCorrectAnswer / playLevelUp — gamification cues
  ui:     1, // playUi / playClick — button taps, toggles, other interface sounds
}

// ── Developer-only balance knobs ────────────────────────────
// A kana mp3, the browser's TTS voice, and a dropped-in sfx file are
// almost never recorded/synthesized at the same perceived loudness.
// These multiply on top of whatever the user sets in the mixer, and
// are NOT exposed in the UI anywhere — tune them here, by ear, per
// sound. 1 = no change. sfx entries are keyed by the same `name`
// passed to playSfx (e.g. 'success', 'level-up'); anything without an
// entry falls back to 1.
const BASE_GAIN = {
  kana: 0.8,
  tts:  0.75, // the browser TTS voice tends to read louder than clips
  sfx: {
    success:    0.1,
    'level-up': 0.5,
  },
  ui: {
    click:  0.25, // a tap should be felt, not announced
    toggle: 0.10,
  },
}

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
    // Merge over defaults rather than trusting the stored shape as-is,
    // so a new category added later still gets its default until the
    // user actually touches its slider.
    return { ...DEFAULT_VOLUMES, ...saved }
  } catch {
    return { ...DEFAULT_VOLUMES }
  }
}

let muted   = readMuted()
let volumes = readVolumes()
const muteListeners   = new Set()
const volumeListeners = new Set()

// ── Global mute (unchanged API) ──────────────────────────────
export function isMuted() {
  return muted
}

export function setMuted(value) {
  if (value === muted) return
  muted = value
  try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch {}
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

// ── Volume mixer ──────────────────────────────────────────────
// `volumes` holds a 0–1 level per category plus `master`. Everything
// the user touches in Settings goes through setVolume(); everything
// that plays a sound reads its effective level through gainFor()
// below, which folds in master, the category slider, and whatever
// fixed per-sound balance is set in BASE_GAIN above.
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
  volumeListeners.forEach(fn => fn())
}

export function resetVolumes() {
  volumes = { ...DEFAULT_VOLUMES }
  try { window.localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes)) } catch {}
  volumeListeners.forEach(fn => fn())
}

function subscribeVolumes(fn) {
  volumeListeners.add(fn)
  return () => volumeListeners.delete(fn)
}

export function useVolumes() {
  return useSyncExternalStore(subscribeVolumes, getVolumes, () => DEFAULT_VOLUMES)
}

// Effective 0–1 output level for one played sound. kana/tts have a
// single BASE_GAIN number; sfx/ui are keyed per sound name instead,
// since a "success" chime and a "level-up" fanfare (or a button tap
// vs. a toggle flip) rarely sit at the same natural loudness.
function gainFor(category, soundName) {
  const categoryGain = BASE_GAIN[category]
  const base = (categoryGain && typeof categoryGain === 'object')
    ? (categoryGain[soundName] ?? 1)
    : (categoryGain ?? 1)
  return clamp01(volumes.master * (volumes[category] ?? 1) * base)
}

export function playKana(romaji) {
  if (!romaji || muted) return
  const audio = new Audio(`/sounds/${romaji}.mp3`)
  audio.volume = gainFor('kana', romaji)
  audio.play().catch(() => {})
}

// ── Gamification SFX ──────────────────────────────────────
// One generic primitive rather than a fixed set of named functions —
// anything reward-related (XP gain, level up, badge unlock, streak
// milestone, ...) hangs off this instead of each needing its own
// dedicated export like playKana above. To add a new one later: drop
// the file at public/sounds/sfx/{name}.mp3, call playSfx('{name}')
// from wherever it should fire, and optionally give it its own entry
// in BASE_GAIN.sfx above if it needs balancing against the others —
// no other changes needed here.
//
// Files expected so far (not included — drop your own in):
//   /sounds/sfx/success.mp3    — correct answer
//   /sounds/sfx/level-up.mp3   — a review that crosses a level threshold
//
// Cached per name (unlike playKana/speakJapanese, which are driven by
// whatever word was just shown and so can't be pre-created): XP gain
// in particular can fire on every single review, so re-fetching the
// same file over and over would be wasteful. currentTime is reset
// before each play so rapid repeats (e.g. two quick reviews) restart
// the sound instead of silently no-op'ing on an already-playing tag.
const _sfxCache = new Map()

export function playSfx(name) {
  if (!name || muted) return
  let audio = _sfxCache.get(name)
  if (!audio) {
    audio = new Audio(`/sounds/sfx/${name}.mp3`)
    _sfxCache.set(name, audio)
  } else {
    audio.currentTime = 0
  }
  audio.volume = gainFor('sfx', name)
  audio.play().catch(() => {})
}

// ── UI sounds ───────────────────────────────────────────────
// Same generic-primitive shape as playSfx above, for interface
// interactions rather than gamification moments: button taps, toggle
// flips, anything short and frequent enough that it needs its own
// (much quieter — see BASE_GAIN.ui) category so it never competes
// with kana/tts/sfx in the mix. Call playUi('name') from any button
// handler; add a matching /sounds/ui/{name}.mp3 and, if it needs its
// own balance, a BASE_GAIN.ui entry — nothing else to change.
//
// Files expected so far (not included — drop your own in):
//   /sounds/ui/click.mp3   — generic button press
//   /sounds/ui/toggle.mp3  — on/off switches (mute, theme, drawing...)
const _uiCache = new Map()

export function playUi(name) {
  if (!name || muted) return
  let audio = _uiCache.get(name)
  if (!audio) {
    audio = new Audio(`/sounds/ui/${name}.mp3`)
    _uiCache.set(name, audio)
  } else {
    audio.currentTime = 0
  }
  audio.volume = gainFor('ui', name)
  audio.play().catch(() => {})
}

export function playClick() {
  playUi('click')
}

export function playToggle() {
  playUi('toggle')
}

export function speakJapanese(text) {
  if (!text || muted) return
  window.speechSynthesis.cancel() // stop any ongoing speech
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.8
  utterance.volume = gainFor('tts', text)
  window.speechSynthesis.speak(utterance)
}