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

export function speakJapanese(text) {
  if (!text || muted) return
  window.speechSynthesis.cancel() // stop any ongoing speech
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.8
  window.speechSynthesis.speak(utterance)
}