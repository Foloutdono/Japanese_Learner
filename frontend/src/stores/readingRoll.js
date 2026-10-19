import { useSyncExternalStore } from 'react'
import {
  DEFAULT_ROLL_MODE, DEFAULT_ROLL_SPEED, isRollMode, isRollSpeed, stepSpeed,
} from '../domain/readingRoll'

// ── How Comprehension shows its text: whole, or rolling (plan 258) ──
// A per-device convenience, kept in localStorage alone: it is a way of
// reading, not an account's setting, and nothing of it reaches the
// server. A missing or unreadable copy is the whole text, as before.

const KEY = 'jl.readingRoll'

function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return {
      mode: isRollMode(stored?.mode) ? stored.mode : DEFAULT_ROLL_MODE,
      speed: isRollSpeed(stored?.speed) ? stored.speed : DEFAULT_ROLL_SPEED,
    }
  } catch {
    // Private mode, blocked site data, a copy that is not JSON.
    return { mode: DEFAULT_ROLL_MODE, speed: DEFAULT_ROLL_SPEED }
  }
}

// Replaced, never mutated: useSyncExternalStore compares by identity.
let state = read()
const listeners = new Set()
const subscribe = l => { listeners.add(l); return () => listeners.delete(l) }
const getState = () => state

function set(next) {
  state = { ...state, ...next }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* see read() */ }
  listeners.forEach(l => l())
}

/** { mode: 'whole' | 'rolling', speed: characters a second } -- never null. */
export const useReadingRoll = () => useSyncExternalStore(subscribe, getState)

export const setRollMode = mode => { if (isRollMode(mode)) set({ mode }) }
export const setRollSpeed = speed => { if (isRollSpeed(speed)) set({ speed }) }
// From the speed now held, not the one a press was drawn with: two quick
// presses before a render are two steps.
export const nudgeRollSpeed = dir => set({ speed: stepSpeed(state.speed, dir) })
