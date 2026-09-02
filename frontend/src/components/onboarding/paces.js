// ── 種別 — the pace ladder ───────────────────────────────────────
// How fast the learner wants to travel, in NEW ITEMS a day. The
// Japanese names deliberately echo the study-mode service ladder in
// config/stations.js — same signage language, different axis — but
// this is its own table, NOT serviceFor(): that one is keyed on study
// -mode keys and maps 特急 to 'ltd', and what is stored on the profile
// is the integer perDay (user_profiles.daily_new_target), never a
// tier id, so future paces are a row here and nothing else.
// `recommended` backs the copy that already claimed it — the badge on
// the pace card and the hint text must agree, and now they share one
// source of truth instead of the hint asserting it alone.
export const PACES = [
  { id: 'local',   jp: '各駅停車', perDay: 5 },
  { id: 'rapid',   jp: '快速',     perDay: 10, recommended: true },
  { id: 'express', jp: '特急',     perDay: 20 },
]

export const DEFAULT_PER_DAY = 10

export function paceFor(perDay) {
  return PACES.find(p => p.perDay === perDay) ?? null
}

// ── The departure board's service ladder (plan 063, phase B) ─────
// The five scheduled services the 行先 board prices, each with the
// stopping-pattern its row draws (six stops; 1 = calls, 0 = passes —
// the same diagram grammar the current pace step already draws by
// hand). `en` is the row's small-caps Latin caption — signage, like
// `jp`, not locale copy; the FR/EN string tables never translate a
// train type. PACES above stays until the old pace step retires with
// phase E — SettingsScreen and OnboardingFlow still render it.
export const SERVICES = [
  { id: 'local',   jp: '各駅停車', en: 'Local',         perDay: 5,  pattern: [1, 1, 1, 1, 1, 1] },
  { id: 'rapid',   jp: '快速',     en: 'Rapid',         perDay: 10, pattern: [1, 0, 1, 0, 1, 1], recommended: true },
  { id: 'special', jp: '新快速',   en: 'Special Rapid', perDay: 15, pattern: [1, 0, 0, 1, 0, 1] },
  { id: 'express', jp: '特急',     en: 'Ltd. Express',  perDay: 20, pattern: [1, 0, 0, 0, 0, 1] },
  { id: 'extra',   jp: '臨時',     en: 'Extra',         perDay: 25, pattern: [1, 0, 0, 0, 1, 1] },
]

// The honesty ceiling: no scheduled service runs faster, so the office
// neither sells a ticket above it nor suggests a recovery pace beyond
// it — past 臨時, the only honest offers are moving the date or the
// destination.
export const MAX_PACE = Math.max(...SERVICES.map(s => s.perDay))

// 貸切 — the charter. One concept for both off-ladder cases: the exact
// required pace of a by-date goal, and a custom pace dialled by hand.
// Its pattern is drawn dashed (ends only) wherever it appears.
export const CHARTER_PATTERN = [1, 0, 0, 0, 0, 1]

// The honest name for any pace: a scheduled service when the number is
// on the ladder, a charter when it isn't — the pass never calls 12/day
// a 快速.
export function serviceLabel(perDay) {
  return (
    SERVICES.find(s => s.perDay === perDay)
    ?? { id: 'charter', jp: '貸切', en: 'Charter', perDay, pattern: CHARTER_PATTERN }
  )
}
