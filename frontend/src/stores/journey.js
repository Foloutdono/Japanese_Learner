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
