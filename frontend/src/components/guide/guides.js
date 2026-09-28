// ── 案内 — the stops, gate by gate (plan 100) ──────────────────────
// Each gate's guide is an ordered list of stops: the anchor is a
// `data-guide` attribute on the live DOM (never a replica of it), `key`
// names the sentence in the locale (guide<Key>), and `radius` picks
// which corner the spot wears -- the anchor's own. A stop whose anchor
// is not on the screen is skipped in silence: a gate with nothing due
// has no lane to point at, and the guide must not strand on a rect it
// cannot find.
//
// Ten a gate at most, and a stop earns its place only if the layout
// does not already say it (DESIGN.md, "Say less"). It was six until the
// owner asked for the tours to be completed (2026-09-26): the gates had
// grown -- the library, the mock exam, the entry's actions, the
// ranking, the statistics -- and nothing said what any of them was. A
// stop whose part a width does not draw is skipped there. `today` is
// the exception, by the owner's later word (2026-09-28): it is the
// first gate a learner sees, straight off the first ride, so it says
// the two things they need to start -- the gate and the way to the
// others -- and nothing more. The level, the status, the balance, the
// run's length and fare, the strip, the journey and the week ahead are
// found by using them, and the profile's guide names the level and the
// balance on the pass. The keys are config/tabs.js's TAB_IDS in its
// order (the chain, when on, walks them in it), and a node test says so.
export const GUIDES = Object.freeze({
  learn: [
    { anchor: 'learn.plate',  key: 'LearnPlate',  radius: 'plate' },
    { anchor: 'learn.stops',  key: 'LearnStops',  radius: 'flat' },
    { anchor: 'learn.shelf',  key: 'LearnShelf',  radius: 'plate' },
    { anchor: 'learn.library', key: 'LearnLibrary', radius: 'plate' },
  ],
  practice: [
    { anchor: 'practice.plate', key: 'PracticePlate', radius: 'plate' },
    { anchor: 'practice.dests', key: 'PracticeDests', radius: 'flat' },
    { anchor: 'practice.exam',  key: 'PracticeExam',  radius: 'plate' },
    { anchor: 'practice.pass',  key: 'PracticePass',  radius: 'pill' },
  ],
  today: [
    { anchor: 'today.gate',   key: 'TodayGate',   radius: 'card' },
    { anchor: 'tabbar',       key: 'TabBar',      radius: 'flat', place: 'above' },
  ],
  dictionary: [
    { anchor: 'dict.console',  key: 'DictConsole',  radius: 'card' },
    { anchor: 'dict.options',  key: 'DictOptions',  radius: 'pill' },
    { anchor: 'dict.chips',    key: 'DictChips',    radius: 'flat' },
    { anchor: 'dict.entry',    key: 'DictEntry',    radius: 'card' },
    { anchor: 'dict.actions',  key: 'DictActions',  radius: 'card' },
    { anchor: 'dict.analyzer', key: 'DictAnalyzer', radius: 'card' },
  ],
  // The phone's order is the screen's, top to bottom: the Settings door
  // stands straight under the pass since plan 143.
  profile: [
    { anchor: 'profile.pass',     key: 'ProfilePass',     radius: 'identity' },
    { anchor: 'profile.stats',    key: 'ProfileStats',    radius: 'flat' },
    { anchor: 'profile.settings', key: 'ProfileSettings', radius: 'flat' },
    { anchor: 'profile.stamps',   key: 'ProfileStamps',   radius: 'card' },
    { anchor: 'profile.records',  key: 'ProfileRecords',  radius: 'card' },
    { anchor: 'profile.ledger',   key: 'ProfileLedger',   radius: 'card' },
    { anchor: 'profile.board',    key: 'ProfileBoard',    radius: 'card' },
  ],
})

// 机 (plan 123): the order a gate's stops are walked in on the desk,
// where it differs from the phone's. Today's were written top to bottom
// for a phone -- the gate, then the tab bar at the foot. On the desk the
// gates are the rail, at the left: the way the page reads, the rail
// first, then the gate.
// The profile's Settings stop is the rail's station on the desk (plan
// 143), not a door under the pass, so there it closes the walk: the
// page first, then the way out -- Statistics, the rail's other station,
// just before it.
export const DESK_ORDER = Object.freeze({
  today: ['tabbar', 'today.gate'],
  profile: ['profile.pass', 'profile.stamps', 'profile.records', 'profile.ledger', 'profile.board', 'profile.stats', 'profile.settings'],
})

// 机 (plan 143): the corner a stop's spot wears on the desk, where it
// differs from the phone's. The profile's Settings door is the rail's
// station there, a lozenge at the panel's corner rather than a flush
// lattice cell, and Statistics beside it.
export const DESK_RADIUS = Object.freeze({
  'profile.settings': 'panel',
  'profile.stats': 'panel',
})

/** A gate's stops in the order the desk walks them, in the desk's corners. */
export function deskStops(gate) {
  const stops = GUIDES[gate] ?? []
  const order = DESK_ORDER[gate]
  const walked = order ? order.map(anchor => stops.find(s => s.anchor === anchor)).filter(Boolean) : stops
  if (!walked.some(s => DESK_RADIUS[s.anchor])) return walked
  return walked.map(s => (DESK_RADIUS[s.anchor] ? { ...s, radius: DESK_RADIUS[s.anchor] } : s))
}

// The owner's original ask, one flag away: when true, the last stop's
// Done on a gate walks to the next gate in TAB_IDS and opens its guide,
// so the five play as one walkthrough at the first opening. Off: each
// gate's guide plays the first time THAT gate is opened, when the thing
// it explains is under the learner's thumb.
export const GUIDE_CHAIN = false

/** The stops of `gate` whose anchors are on the screen right now. */
export function presentStops(gate) {
  if (typeof document === 'undefined') return []
  return (GUIDES[gate] ?? []).filter(stop => document.querySelector(`[data-guide="${stop.anchor}"]`))
}
