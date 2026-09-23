import { useSyncExternalStore } from 'react'

// ── 机 — the revealed card's entry, docked beside the run (plan 114) ──
// On a phone the dictionary entry of a revealed card is one tap away,
// behind the 🔍 on the card, in a sheet. On the desk it is already
// open in the session panel beside the card: the card's reveal
// (components/study/QuizComponents.jsx, RevealActionsPanel) publishes
// what to look up, and the panel (components/study/SessionPanel.jsx)
// reads it. Never before the reveal — the entry is the answer.
//
// A publish returns a token, and a withdraw clears only its own: the
// next card's reveal can publish before the last card's panel has
// unmounted, and that late cleanup must not wipe the new entry.
let entry = null
let current = 0
const listeners = new Set()
function emit() { listeners.forEach(fn => fn()) }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }

/** Dock { term, kana, category, id, session }; returns the token to withdraw it with. */
export function publishEntry(next) {
  current += 1
  entry = { ...next, token: current }
  emit()
  return current
}

/** Take the entry down, if it is still the one this token published. */
export function withdrawEntry(token) {
  if (!entry || entry.token !== token) return
  entry = null
  emit()
}

export function peekEntry() {
  return entry
}

export function useDeskEntry() {
  return useSyncExternalStore(subscribe, peekEntry, peekEntry)
}
