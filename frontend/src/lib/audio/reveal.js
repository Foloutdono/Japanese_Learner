import { useSyncExternalStore } from 'react'

// ── Speak on reveal ──────────────────────────────────────
// Whether a card says its answer by itself when it is revealed: the
// kana or the word on a kana or vocab card, the sentence on a grammar,
// reading or translation one. The switch beside the hints, or in a
// sentence run's head (components/study/SpeakToggle.jsx), persisted
// like mute.
//
// It silences only the automatic play: the card's own speaker button
// still says it on a tap, and mute still silences everything. Its own
// module rather than a line in settings.js, which the landing page
// bundles (npm run landing) and which this setting is no part of.

const KEY = 'jp-app-speak-on-reveal'

// On unless switched off: the cards spoke on reveal before there was a
// switch, so a learner who never touches it keeps what they had.
function read() {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(KEY) !== '0' } catch { return true }
}

let on = read()
const listeners = new Set()

export function isSpeakOnReveal() { return on }

export function setSpeakOnReveal(value) {
  if (value === on) return
  on = value
  // Unavailable in private mode and under some policies: the switch
  // still holds for this session, it just won't persist.
  try { window.localStorage.setItem(KEY, on ? '1' : '0') } catch { /* not persisted */ }
  listeners.forEach(fn => fn())
}

export function toggleSpeakOnReveal() { setSpeakOnReveal(!on) }

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export function useSpeakOnReveal() { return useSyncExternalStore(subscribe, isSpeakOnReveal, () => true) }
