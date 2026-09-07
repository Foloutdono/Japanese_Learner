import { useSyncExternalStore } from 'react'
import { createRemoteStore } from './remote'

// ── 運行状況 — the journey's facts, shared ────────────────────
// /api/journey/status is what the pass's back judges the ghost train
// on (domain/goalMath's journeyModel). The HUD's station panel reads
// the same facts through the same model, so the word on the panel and
// the word on the pass can never disagree. Five minutes: the figures
// move by the day, and a reprint at the office calls refreshJourney().
const store = createRemoteStore('/api/journey/status', { ttlMs: 300_000 })

export function useJourneyStatus() {
  return store.use()
}

export function refreshJourney() {
  return store.refresh()
}

export function seedJourneyStatus(data) {
  store.seed(data)
}

// The per-level item volumes the track's stations stand at (see
// components/journey/stations.js). Static content, so an hour is a
// safe TTL; seeded by the tests.
const volumes = createRemoteStore('/api/onboarding/volumes', { ttlMs: 3_600_000 })

export function useVolumes() {
  return volumes.use()
}

export function seedVolumes(data) {
  volumes.seed(data)
}

// ── 運行状況の裏 — the status sheet (plan 074) ────────────────
// Module state for the same reason the balance sheet's is: it opens
// off the HUD's station panel, outside every screen, and mounts beside
// <Routes/> in App.jsx (components/journey/StatusSheet.jsx).
// The clock reading taken as the sheet opens, 0 while it is closed:
// the sheet's figures derive every date from it, so render never
// reads the clock, and they hold still while the sheet is read.
let statusOpenedAt = 0
const listeners = new Set()
function emit() { listeners.forEach(fn => fn()) }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }

export function openStatus() { statusOpenedAt = Date.now(); emit() }
export function closeStatus() { statusOpenedAt = 0; emit() }
export function useStatusOpenedAt() {
  return useSyncExternalStore(subscribe, () => statusOpenedAt, () => 0)
}
