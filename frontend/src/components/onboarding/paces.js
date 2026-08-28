// ── 種別 — the pace ladder ───────────────────────────────────────
// How fast the learner wants to travel, in NEW ITEMS a day. The
// Japanese names deliberately echo the study-mode service ladder in
// config/stations.js — same signage language, different axis — but
// this is its own table, NOT serviceFor(): that one is keyed on study
// -mode keys and maps 特急 to 'ltd', and what is stored on the profile
// is the integer perDay (user_profiles.daily_new_target), never a
// tier id, so future paces are a row here and nothing else.
export const PACES = [
  { id: 'local',   jp: '各駅停車', perDay: 5 },
  { id: 'rapid',   jp: '快速',     perDay: 10 },
  { id: 'express', jp: '特急',     perDay: 20 },
]

export const DEFAULT_PER_DAY = 10

export function paceFor(perDay) {
  return PACES.find(p => p.perDay === perDay) ?? null
}
