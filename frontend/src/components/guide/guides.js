// ── 案内 — the stops, gate by gate (plan 100) ──────────────────────
// Each gate's guide is an ordered list of stops: the anchor is a
// `data-guide` attribute on the live DOM (never a replica of it), `key`
// names the sentence in the locale (guide<Key>), and `radius` picks
// which corner the spot wears -- the anchor's own. A stop whose anchor
// is not on the screen is skipped in silence: a gate with nothing due
// has no lane to point at, and the guide must not strand on a rect it
// cannot find.
//
// Six a gate at most, and a stop earns its place only if the layout
// does not already say it (DESIGN.md, "Say less"). `today` is the first
// gate a learner sees, so it carries the HUD and the tab bar; the other
// four never repeat them. The keys are config/tabs.js's TAB_IDS in its
// order (the chain, when on, walks them in it), and a node test says so.
export const GUIDES = Object.freeze({
  learn: [
    { anchor: 'learn.plate',  key: 'LearnPlate',  radius: 'plate' },
    { anchor: 'learn.stops',  key: 'LearnStops',  radius: 'flat' },
    { anchor: 'learn.shelf',  key: 'LearnShelf',  radius: 'plate' },
  ],
  practice: [
    { anchor: 'practice.plate', key: 'PracticePlate', radius: 'plate' },
    { anchor: 'practice.dests', key: 'PracticeDests', radius: 'flat' },
    { anchor: 'practice.pass',  key: 'PracticePass',  radius: 'pill' },
  ],
  today: [
    { anchor: 'hud.level',    key: 'HudLevel',    radius: 'pill' },
    { anchor: 'hud.status',   key: 'HudStatus',   radius: 'pill' },
    { anchor: 'hud.pass',     key: 'HudPass',     radius: 'pill' },
    { anchor: 'today.strip',  key: 'TodayStrip',  radius: 'card' },
    { anchor: 'today.gate',   key: 'TodayGate',   radius: 'card' },
    { anchor: 'tabbar',       key: 'TabBar',      radius: 'flat', place: 'above' },
  ],
  dictionary: [
    { anchor: 'dict.console',  key: 'DictConsole',  radius: 'card' },
    { anchor: 'dict.chips',    key: 'DictChips',    radius: 'flat' },
    { anchor: 'dict.entry',    key: 'DictEntry',    radius: 'card' },
    { anchor: 'dict.analyzer', key: 'DictAnalyzer', radius: 'card' },
  ],
  // The phone's order is the screen's, top to bottom: the Settings door
  // stands straight under the pass since plan 143.
  profile: [
    { anchor: 'profile.pass',     key: 'ProfilePass',     radius: 'identity' },
    { anchor: 'profile.settings', key: 'ProfileSettings', radius: 'flat' },
    { anchor: 'profile.stamps',   key: 'ProfileStamps',   radius: 'card' },
    { anchor: 'profile.records',  key: 'ProfileRecords',  radius: 'card' },
    { anchor: 'profile.ledger',   key: 'ProfileLedger',   radius: 'card' },
  ],
})

// 机 (plan 123): the order a gate's stops are walked in on the desk,
// where it differs from the phone's. Today's six were written top to
// bottom for a phone -- the HUD, the strip, the gate, the tab bar -- and
// on the desk that walked the rail's foot three times, then the side's
// top right, the gate, and the rail's top left. Down the rail instead,
// then across the page: the gates, the level, the status, the pass, the
// gate, the strip beside it.
// The profile's Settings stop is the rail's station on the desk (plan
// 143), not a door under the pass, so there it closes the walk: the
// page first, then the way out.
export const DESK_ORDER = Object.freeze({
  today: ['tabbar', 'hud.level', 'hud.status', 'hud.pass', 'today.gate', 'today.strip'],
  profile: ['profile.pass', 'profile.stamps', 'profile.records', 'profile.ledger', 'profile.settings'],
})

// 机 (plan 127): the corner a stop's spot wears on the desk, where it
// differs from the phone's. The HUD's three are pills on the phone's
// strip; on the desk they are the three doors of the rail's pass, the
// face, the purse and the stub, and a pill drawn round a card's door
// reads as a stadium over the card.
export const DESK_RADIUS = Object.freeze({
  'hud.level': 'card',
  'hud.status': 'card',
  'hud.pass': 'card',
  // Plan 143: the profile's Settings door is the rail's station there,
  // a lozenge at the panel's corner rather than a flush lattice cell.
  'profile.settings': 'panel',
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
