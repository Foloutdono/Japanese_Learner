// ── The steps of the boarding and the first ride ──────────────────────
// What their boarding_step / ride_step events name, and what an uncaught
// error on their routes names as its `step` (lib/clientErrors.js). Every
// name here is in VALUES.client_error.step (lib/track.js, mirrored by
// backend/core/events.py), and flowSteps.test.js holds them to it: a
// step outside the list would record its errors with no step.

// みどりの窓口 — the boarding (screens/BoardingFlow.jsx).
export const BOARDING_STEPS = ['kana', 'reveal', 'level', 'test', 'card']

// 試乗 — the cards ride (screens/RideRun.jsx): known, known-back,
// unknown, unknown-back, done; on a phone known-dict between the known
// card's turn and its grade.
export const CARD_STEPS = ['known', 'known-dict', 'known-back', 'unknown', 'unknown-back', 'done']

export function stepFor(index, answered, lookFirst = false) {
  if (index >= 2) return 'done'
  if (index === 0 && answered && lookFirst) return 'known-dict'
  return `${index === 0 ? 'known' : 'unknown'}${answered ? '-back' : ''}`
}

// The reading ride (screens/RideReading.jsx): read, type, measure, pass;
// on the desk graded between measure and pass.
export const READING_STEPS = ['read', 'type', 'measure', 'graded', 'pass']

// 入門 (screens/RideIntro.jsx) names its steps intro-<step>, over
// domain/nyumon's INTRO_STEPS.
export const introStep = step => `intro-${step}`
