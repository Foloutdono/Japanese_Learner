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
  profile: [
    { anchor: 'profile.pass',     key: 'ProfilePass',     radius: 'identity' },
    { anchor: 'profile.stamps',   key: 'ProfileStamps',   radius: 'card' },
    { anchor: 'profile.records',  key: 'ProfileRecords',  radius: 'card' },
    { anchor: 'profile.ledger',   key: 'ProfileLedger',   radius: 'card' },
    { anchor: 'profile.settings', key: 'ProfileSettings', radius: 'flat' },
  ],
})

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
