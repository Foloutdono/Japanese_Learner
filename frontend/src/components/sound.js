import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'jp-app-muted'

function readInitial() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let muted = readInitial()
const listeners = new Set()

export function isMuted() {
  return muted
}

export function setMuted(value) {
  if (value === muted) return
  muted = value
  try { window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0') } catch {}
  listeners.forEach(fn => fn())
}

export function toggleMute() {
  setMuted(!muted)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// React hook: any component can call useMuted() to re-render when the
// mute state changes, no prop drilling needed.
export function useMuted() {
  return useSyncExternalStore(subscribe, isMuted, () => false)
}

export function playKana(romaji) {
  if (!romaji || muted) return
  const audio = new Audio(`/sounds/${romaji}.mp3`)
  audio.play().catch(() => {})
}

// ── Gamification SFX ──────────────────────────────────────
// One generic primitive rather than a fixed set of named functions —
// anything reward-related (XP gain, level up, badge unlock, streak
// milestone, ...) hangs off this instead of each needing its own
// dedicated export like playKana above. To add a new one later: drop
// the file at public/sounds/sfx/{name}.mp3 and call playSfx('{name}')
// from wherever it should fire — no changes needed here.
//
// Files expected so far (not included — drop your own in):
//   /sounds/sfx/xp-gain.mp3    — every review that earns XP
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
  audio.play().catch(() => {})
}

export function playXpGain() {
  playSfx('xp-gain')
}

export function playLevelUp() {
  playSfx('level-up')
}

export function speakJapanese(text) {
  if (!text || muted) return
  window.speechSynthesis.cancel() // stop any ongoing speech
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.8
  window.speechSynthesis.speak(utterance)
}