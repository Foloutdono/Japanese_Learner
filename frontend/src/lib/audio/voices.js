import { useSyncExternalStore } from 'react'
import { getAudioContext, getBuffer } from './context'
import { busFor, playBuffer } from './mixer'
import { isMuted, trimFor } from './settings'
import { tones, noiseTicks, noiseSweep, thump } from './synth'

// ── The voice palette ─────────────────────────────────────
// Every interface and effect sound in the app, and for each one a
// small set of alternative voices to choose between.
//
// Two things changed here at once, and they are the same change. The
// sounds used to be mp3 files — 350KB of them, several of which were
// the *same* 49KB file copied under four names, so four different
// interactions all said the identical thing. They are now generated
// from a handful of oscillator and noise nodes: no bytes, no decode,
// no 404 for a name with no file behind it, and — the part that
// matters — each interaction can actually have its own sound.
//
// Which one it has is a taste question, and taste questions do not
// belong hardcoded. So each event carries several voices and the
// choice is persisted; /dev/sounds is where you hear them side by
// side and pick. The first variant listed is the default.
//
// A dropped-in recording still wins. Each event names the file it
// would load if it existed, so replacing a synthesised voice with a
// real one stays a matter of adding the file — see
// public/sounds/README.md.

// The split-flap run, shared by several voices. Shrinking gaps: a
// drum slows as it settles, so the ticks bunch up rather than marking
// time.
const FLAP_TIMES = [0, 0.055, 0.10, 0.14, 0.173, 0.20, 0.222, 0.24]

function clatter(ctx, bus, count = FLAP_TIMES.length, scale = 1) {
  const ticks = FLAP_TIMES.slice(0, count)
  noiseTicks(ctx, bus, ticks.map((at, i) => ({
    at,
    // Each drum lands a little lower than the last as it loses energy.
    freq: (2600 - i * 130) * scale,
    peak: 0.34 * (1 - i / ticks.length) + 0.06,
    q: 1.6,
  })))
}

// ── The recipes ───────────────────────────────────────────
// Frequencies carry their note names in the comments because the
// relationships are the design, not the numbers: the gate rises and
// the door falls, and they are mirror images on purpose. Peaks are
// deliberately low — these fire on every tap, and the gap between
// "present" and "irritating" is about six decibels.

const EVENTS = [
  // ── Interface ───────────────────────────────────────────
  {
    key: 'click', category: 'ui', family: 'interface',
    label: 'Click', jp: '押下', where: 'The generic press — 31 call sites',
    variants: [
      { key: 'tick', label: 'Tick', note: 'A single G6, 32ms. The one that shipped.',
        play: (c, b) => tones(c, b, [{ freq: 1568.0, dur: 0.032, peak: 0.16 }]) },
      { key: 'wood', label: 'Wood block', note: '拍子木 — a dry knock, with no pitch to argue with.',
        play: (c, b) => noiseTicks(c, b, [{ freq: 1850, peak: 0.30, q: 9, dur: 0.028 }]) },
      { key: 'key', label: 'Key tap', note: 'A tone with a breath of noise on the front of it.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 3000, peak: 0.11, q: 2, dur: 0.012 }])
          tones(c, b, [{ freq: 2093.0, dur: 0.022, peak: 0.10 }])
        } },
      { key: 'pad', label: 'Soft pad', note: 'Rounder and lower. A press rather than a point.',
        play: (c, b) => tones(c, b, [{ freq: 1046.5, dur: 0.055, peak: 0.13, type: 'triangle', attack: 0.008 }]) },
    ],
  },
  {
    key: 'toggle', category: 'ui', family: 'interface',
    label: 'Toggle', jp: '切替', where: 'Settings switches, the theme flip, stat filters',
    variants: [
      { key: 'two-step', label: 'Two step', note: 'B5 → E6. A state change, not a press.',
        play: (c, b) => tones(c, b, [
          { freq: 987.77, at: 0, dur: 0.030, peak: 0.15 },
          { freq: 1318.51, at: 0.038, dur: 0.045, peak: 0.15 },
        ]) },
      { key: 'latch', label: 'Latch', note: 'Two mechanical clicks — a real switch throwing.',
        play: (c, b) => noiseTicks(c, b, [
          { at: 0, freq: 950, peak: 0.26, q: 8, dur: 0.022 },
          { at: 0.045, freq: 1500, peak: 0.22, q: 8, dur: 0.026 },
        ]) },
      { key: 'settle', label: 'Settle', note: 'E6 → B5, the two-step reversed. Reads as "off".',
        play: (c, b) => tones(c, b, [
          { freq: 1318.51, at: 0, dur: 0.030, peak: 0.14 },
          { freq: 987.77, at: 0.038, dur: 0.055, peak: 0.14 },
        ]) },
    ],
  },
  {
    key: 'click-menu', category: 'ui', family: 'interface',
    label: 'Menu opens', jp: '開', where: 'Burger menu, quick change, a dictionary entry',
    variants: [
      { key: 'open-step', label: 'Open step', note: 'A5 → D6. Rising, because something appeared.',
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.032, peak: 0.13 },
          { freq: 1174.66, at: 0.040, dur: 0.055, peak: 0.13 },
        ]) },
      { key: 'drawer', label: 'Drawer', note: 'A short rush opening up — a panel sliding out.',
        play: (c, b) => noiseSweep(c, b, { dur: 0.14, peak: 0.085, from: 520, mid: 1500, to: 1900, q: 0.9, hold: 0.5, attack: 0.03 }) },
      { key: 'soft-open', label: 'Soft open', note: 'One rounded D6. The quietest option here.',
        play: (c, b) => tones(c, b, [{ freq: 1174.66, dur: 0.075, peak: 0.11, type: 'triangle', attack: 0.010 }]) },
    ],
  },
  {
    key: 'click-close-menu', category: 'ui', family: 'interface',
    label: 'Menu closes', jp: '閉', where: 'The mirror of the one above',
    variants: [
      { key: 'close-step', label: 'Close step', note: 'D6 → A5. The open step, backwards.',
        play: (c, b) => tones(c, b, [
          { freq: 1174.66, at: 0, dur: 0.032, peak: 0.13 },
          { freq: 880.0, at: 0.040, dur: 0.060, peak: 0.13 },
        ]) },
      { key: 'drawer-close', label: 'Drawer shut', note: 'The rush closing down, onto a soft stop.',
        play: (c, b) => {
          noiseSweep(c, b, { dur: 0.14, peak: 0.085, from: 1900, mid: 900, to: 480, q: 0.9, hold: 0.45, attack: 0.02 })
          thump(c, b, { at: 0.12, from: 150, to: 96, dur: 0.10, peak: 0.09 })
        } },
      { key: 'soft-close', label: 'Soft close', note: 'One rounded A5, sitting under the open.',
        play: (c, b) => tones(c, b, [{ freq: 880.0, dur: 0.085, peak: 0.11, type: 'triangle', attack: 0.010 }]) },
    ],
  },
  {
    key: 'click-mode-selection', category: 'ui', family: 'interface',
    label: 'Option picked', jp: '選択', where: 'Mode, level, theme, tier and filter rows — the busiest sound in the app',
    variants: [
      { key: 'pick', label: 'Pick', note: 'E6 with a hair of noise under it. Crisp, over in 45ms.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 2400, peak: 0.09, q: 3, dur: 0.010 }])
          tones(c, b, [{ freq: 1318.51, dur: 0.042, peak: 0.13 }])
        } },
      { key: 'stamp', label: 'Ticket stamp', note: 'A knock with weight behind it — the gate marking a pass.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 1150, peak: 0.26, q: 5, dur: 0.026 }])
          thump(c, b, { at: 0.004, from: 175, to: 115, dur: 0.09, peak: 0.11 })
        } },
      { key: 'two-tap', label: 'Two tap', note: 'C6 then E6, 30ms apart. Quiet enough to hear all day.',
        play: (c, b) => tones(c, b, [
          { freq: 1046.5, at: 0, dur: 0.026, peak: 0.10 },
          { freq: 1318.51, at: 0.030, dur: 0.038, peak: 0.10 },
        ]) },
    ],
  },
  {
    key: 'click-screen-selection', category: 'ui', family: 'interface',
    label: 'Screen chosen', jp: '発車', where: 'Anything that navigates. A departure, so it is bigger',
    variants: [
      { key: 'depart', label: 'Departure', note: 'A5 → E6, fuller than a pick. You are leaving.',
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.055, peak: 0.16 },
          { freq: 1318.51, at: 0.060, dur: 0.11, peak: 0.15 },
        ]) },
      { key: 'gate-lite', label: 'Small gate', note: 'The gate chime an octave down and at half the level.',
        play: (c, b) => tones(c, b, [
          { freq: 987.77, at: 0, dur: 0.050, peak: 0.17 },
          { freq: 1318.51, at: 0.070, dur: 0.070, peak: 0.17 },
        ]) },
      { key: 'turnstile', label: 'Turnstile', note: 'The bar giving way, then the tone. Mechanical first.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 720, peak: 0.22, q: 6, dur: 0.030 }])
          tones(c, b, [{ freq: 1318.51, at: 0.055, dur: 0.10, peak: 0.14 }])
        } },
    ],
  },

  // ── Study ───────────────────────────────────────────────
  {
    key: 'correct', category: 'ui', family: 'study',
    label: 'Answer right', jp: '正解', where: 'The rating bar, and an exam that met its target',
    variants: [
      { key: 'octave', label: 'Octave', note: 'G5 → G6 with a third filled in. Warmer, a touch longer.',
        play: (c, b) => tones(c, b, [
          { freq: 783.99, at: 0, dur: 0.10, peak: 0.15 },
          { freq: 987.77, at: 0.03, dur: 0.10, peak: 0.06 },
          { freq: 1568.0, at: 0.075, dur: 0.22, peak: 0.14 },
        ]) },
      { key: 'fifth', label: 'Rising fifth', note: 'C6 → G6. Tighter and brighter than the octave.',
        play: (c, b) => tones(c, b, [
          { freq: 1046.5, at: 0, dur: 0.09, peak: 0.17 },
          { freq: 1568.0, at: 0.055, dur: 0.16, peak: 0.15 },
        ]) },
      { key: 'bell', label: 'Single bell', note: 'One C6 left to ring. The least eventful yes available.',
        play: (c, b) => tones(c, b, [
          { freq: 1046.5, dur: 0.38, peak: 0.15 },
          { freq: 2093.0, dur: 0.22, peak: 0.045 },
        ]) },
    ],
  },
  {
    key: 'wrong', category: 'ui', family: 'study',
    label: 'Answer wrong', jp: '不正解', where: 'The rating bar. Not a buzzer — a wrong card is the next card',
    variants: [
      { key: 'low-double', label: 'Low double', note: 'G3 → D3. Felt more than heard, and over quickly.',
        play: (c, b) => tones(c, b, [
          { freq: 196.0, at: 0, dur: 0.12, peak: 0.20 },
          { freq: 146.8, at: 0.09, dur: 0.20, peak: 0.17 },
        ]) },
      { key: 'thud', label: 'Soft thud', note: 'No pitch at all. The gentlest thing in the palette.',
        play: (c, b) => {
          thump(c, b, { from: 165, to: 88, dur: 0.22, peak: 0.20 })
          noiseTicks(c, b, [{ freq: 320, peak: 0.10, q: 1.2, dur: 0.05 }])
        } },
      { key: 'slump', label: 'Slump', note: 'One note sliding down a fourth. Reads as "not that one".',
        play: (c, b) => tones(c, b, [{ freq: 261.63, to: 196.0, dur: 0.26, peak: 0.17, type: 'triangle', attack: 0.010 }]) },
    ],
  },
  {
    key: 'card-transition', category: 'sfx', family: 'study',
    label: 'Card turns', jp: '次の札', where: 'Between every card in a review session',
    variants: [
      { key: 'paper-slip', label: 'Paper slip', note: 'A card leaving the top of the deck. Barely there, by design.',
        play: (c, b) => noiseSweep(c, b, { dur: 0.17, peak: 0.075, from: 900, mid: 2500, to: 1200, q: 0.7, hold: 0.35, attack: 0.02 }) },
      { key: 'flick', label: 'Flick', note: 'Two dry taps — a thumb releasing the corner.',
        play: (c, b) => noiseTicks(c, b, [
          { at: 0, freq: 2700, peak: 0.13, q: 2.2, dur: 0.018 },
          { at: 0.042, freq: 1900, peak: 0.10, q: 2.2, dur: 0.022 },
        ]) },
      { key: 'whisk', label: 'Whisk away', note: 'Falling rather than arching: the old card going, not the new one landing.',
        play: (c, b) => noiseSweep(c, b, { dur: 0.22, peak: 0.07, from: 2600, mid: 1400, to: 700, q: 0.6, hold: 0.3, attack: 0.02 }) },
      { key: 'flap', label: 'Single flap', note: 'One drum of the board turning. Shares its vocabulary with the XP tick.',
        play: (c, b) => noiseTicks(c, b, [{ freq: 2600, peak: 0.20, q: 1.6, dur: 0.030 }]) },
    ],
  },

  // ── Station ─────────────────────────────────────────────
  {
    key: 'gate-chime', category: 'ui', family: 'station',
    label: 'Ticket gate', jp: '改札', where: 'A valid pass has been read. Rises: accepted, go',
    variants: [
      { key: 'rising-pair', label: 'Rising pair', note: 'B6 into E7. Short and bright — it fires on every departure.',
        play: (c, b) => tones(c, b, [
          { freq: 1975.5, at: 0, dur: 0.055, peak: 0.5 },
          { freq: 2637.0, at: 0.075, dur: 0.075, peak: 0.5 },
        ]) },
      { key: 'pip-pip', label: 'Two pips', note: 'The same note twice, flat and fast — what a real 改札 does.',
        play: (c, b) => tones(c, b, [
          { freq: 2637.0, at: 0, dur: 0.045, peak: 0.42 },
          { freq: 2637.0, at: 0.075, dur: 0.045, peak: 0.42 },
        ]) },
      { key: 'three-step', label: 'Three step', note: 'B6, D♯7, F♯7. Brighter, and a little more ceremonial.',
        play: (c, b) => tones(c, b, [
          { freq: 1975.5, at: 0, dur: 0.045, peak: 0.38 },
          { freq: 2489.0, at: 0.055, dur: 0.045, peak: 0.38 },
          { freq: 2960.0, at: 0.110, dur: 0.080, peak: 0.40 },
        ]) },
    ],
  },
  {
    key: 'door-chime', category: 'ui', family: 'station',
    label: 'Doors about to open', jp: '扉', where: 'Falls, mirroring the gate: arrived, board',
    variants: [
      { key: 'falling-pair', label: 'Falling pair', note: 'E6 → B5, each with a quiet octave beneath, overlapping.',
        play: (c, b) => tones(c, b, [
          { freq: 1318.5, at: 0, dur: 0.34, peak: 0.30 },
          { freq: 659.3, at: 0, dur: 0.34, peak: 0.09 },
          { freq: 987.8, at: 0.19, dur: 0.62, peak: 0.30 },
          { freq: 493.9, at: 0.19, dur: 0.62, peak: 0.09 },
        ]) },
      { key: 'single-bell', label: 'Single bell', note: 'One E6 left to ring out. Calmer; fewer moving parts.',
        play: (c, b) => tones(c, b, [
          { freq: 1318.5, dur: 0.75, peak: 0.30 },
          { freq: 659.3, dur: 0.75, peak: 0.10 },
        ]) },
      { key: 'three-fall', label: 'Three fall', note: 'E6, C♯6, B5 — a longer descent, for a slower door.',
        play: (c, b) => tones(c, b, [
          { freq: 1318.5, at: 0, dur: 0.26, peak: 0.26 },
          { freq: 1108.7, at: 0.15, dur: 0.30, peak: 0.26 },
          { freq: 987.8, at: 0.32, dur: 0.60, peak: 0.28 },
        ]) },
    ],
  },
  {
    key: 'door-slide', category: 'sfx', family: 'station',
    label: 'Doors running open', jp: '開扉', where: 'The stretch after the chime, when the leaves actually move',
    variants: [
      { key: 'pneumatic', label: 'Pneumatic', note: 'Rush opening as they gather speed, closing as they reach the stop.',
        play: (c, b) => {
          noiseSweep(c, b, { dur: 0.62, peak: 0.13, from: 380, mid: 1250, to: 520, q: 0.8, hold: 0.55, attack: 0.10 })
          thump(c, b, { at: 0.59, from: 96, to: 58, dur: 0.15, peak: 0.16 })
        } },
      { key: 'soft-rush', label: 'Soft rush', note: 'The same travel with no stop at the end. Slower, unremarkable.',
        play: (c, b) => noiseSweep(c, b, { dur: 0.75, peak: 0.10, from: 300, mid: 900, to: 420, q: 1.1, hold: 0.6, attack: 0.16 }) },
      { key: 'rolling', label: 'On rollers', note: 'Rush, plus the leaves ticking over their guides, then the stop.',
        play: (c, b) => {
          noiseSweep(c, b, { dur: 0.62, peak: 0.10, from: 380, mid: 1250, to: 520, q: 0.8, hold: 0.55, attack: 0.10 })
          noiseTicks(c, b, [
            { at: 0.10, freq: 1800, peak: 0.07, q: 4, dur: 0.014 },
            { at: 0.24, freq: 1700, peak: 0.07, q: 4, dur: 0.014 },
            { at: 0.40, freq: 1600, peak: 0.06, q: 4, dur: 0.014 },
          ])
          thump(c, b, { at: 0.59, from: 96, to: 58, dur: 0.15, peak: 0.16 })
        } },
    ],
  },
  {
    key: 'platform-chime', category: 'ui', family: 'station',
    label: 'Platform sign lands', jp: '到着ホーム', where: 'The onboarding arrival cutscene',
    variants: [
      { key: 'arpeggio', label: 'Arpeggio', note: 'A5, C♯6, E6 — rising, an octave under the gate.',
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.16, peak: 0.26 },
          { freq: 1108.73, at: 0.09, dur: 0.18, peak: 0.26 },
          { freq: 1318.51, at: 0.20, dur: 0.42, peak: 0.28 },
        ]) },
      { key: 'two-bell', label: 'Open fifth', note: 'A5 and E6 struck together, then E6 alone. Wider, less busy.',
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.30, peak: 0.22 },
          { freq: 1318.51, at: 0, dur: 0.30, peak: 0.18 },
          { freq: 1318.51, at: 0.24, dur: 0.50, peak: 0.24 },
        ]) },
      { key: 'wide', label: 'Wide rise', note: 'A5, E6, A6 — a full octave of travel, and the most triumphant of the three.',
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.15, peak: 0.24 },
          { freq: 1318.51, at: 0.10, dur: 0.17, peak: 0.24 },
          { freq: 1760.0, at: 0.22, dur: 0.45, peak: 0.26 },
        ]) },
    ],
  },
  {
    key: 'arrival', category: 'ui', family: 'station',
    label: 'Session finished', jp: '到着', where: 'The end of a journey, not a victory — so it settles',
    variants: [
      { key: 'settle', label: 'Settle', note: 'G5 → D5. Steps down, and stays there.',
        play: (c, b) => tones(c, b, [
          { freq: 783.99, at: 0, dur: 0.26, peak: 0.26 },
          { freq: 587.33, at: 0.17, dur: 0.55, peak: 0.24 },
        ]) },
      { key: 'three-settle', label: 'Long settle', note: 'G5, D5, G4 — one step further down. Reads as "that is all".',
        play: (c, b) => tones(c, b, [
          { freq: 783.99, at: 0, dur: 0.22, peak: 0.24 },
          { freq: 587.33, at: 0.15, dur: 0.26, peak: 0.24 },
          { freq: 392.0, at: 0.32, dur: 0.70, peak: 0.22 },
        ]) },
      { key: 'warm', label: 'Warm pad', note: 'G5 over D5, swelling instead of striking. Nearly a sigh.',
        play: (c, b) => tones(c, b, [
          { freq: 783.99, at: 0, dur: 0.85, peak: 0.20, type: 'triangle', attack: 0.09 },
          { freq: 587.33, at: 0.05, dur: 0.85, peak: 0.14, type: 'triangle', attack: 0.09 },
        ]) },
    ],
  },
  {
    key: 'station-melody', category: 'ui', family: 'station',
    label: 'Departure melody', jp: '発車メロディ', where: 'The pass re-issued — four times in the whole progression',
    variants: [
      { key: 'yo-scale', label: 'Yo scale, rising', note: 'D-E-A-B-G. Climbs, then settles onto the fifth.',
        play: (c, b) => tones(c, b, [
          { freq: 587.3, at: 0, dur: 0.30, peak: 0.30 },
          { freq: 659.3, at: 0.15, dur: 0.30, peak: 0.30 },
          { freq: 880.0, at: 0.30, dur: 0.34, peak: 0.32 },
          { freq: 987.8, at: 0.48, dur: 0.40, peak: 0.30 },
          { freq: 783.99, at: 0.70, dur: 0.75, peak: 0.26 },
        ]) },
      { key: 'yo-falling', label: 'Yo scale, falling', note: 'The same five notes coming down. A last call rather than a fanfare.',
        play: (c, b) => tones(c, b, [
          { freq: 987.8, at: 0, dur: 0.28, peak: 0.28 },
          { freq: 880.0, at: 0.15, dur: 0.28, peak: 0.28 },
          { freq: 659.3, at: 0.30, dur: 0.32, peak: 0.30 },
          { freq: 587.3, at: 0.48, dur: 0.36, peak: 0.28 },
          { freq: 440.0, at: 0.68, dur: 0.80, peak: 0.26 },
        ]) },
      { key: 'two-bar', label: 'Two bars', note: 'Seven notes with a turn in the middle. The longest thing in the app.',
        play: (c, b) => tones(c, b, [
          { freq: 587.3, at: 0, dur: 0.26, peak: 0.28 },
          { freq: 659.3, at: 0.14, dur: 0.26, peak: 0.28 },
          { freq: 783.99, at: 0.28, dur: 0.28, peak: 0.30 },
          { freq: 987.8, at: 0.44, dur: 0.30, peak: 0.30 },
          { freq: 880.0, at: 0.62, dur: 0.26, peak: 0.28 },
          { freq: 783.99, at: 0.78, dur: 0.28, peak: 0.28 },
          { freq: 659.3, at: 0.96, dur: 0.80, peak: 0.26 },
        ]) },
    ],
  },

  // ── Rewards ─────────────────────────────────────────────
  {
    key: 'fare-tick', category: 'ui', family: 'rewards',
    label: 'XP earned', jp: '運賃', where: 'The split-flap board showing a fare — every review',
    variants: [
      // Still mechanical rather than tonal — resonant filtered noise,
      // not an oscillator — so it does not collide with the chimes.
      // It does step away from the level clatter, which is the one
      // relationship this sound used to carry: a fare and a level are
      // now two objects (a coin, a board) rather than one machine at
      // two sizes. That is a deliberate choice, not an oversight.
      // The peaks look wrong and are not. `peak` in noiseTicks is the
      // envelope BEFORE the bandpass, and a Q of 14 passes a narrow
      // enough sliver of the noise to cost about 21dB, where the
      // Q of 1.6 the flaps use costs almost nothing. Written at the
      // 0.16 that reads naturally, this measured 0.0145 at the bus —
      // a tenth of `correct`, which lands a beat earlier and would
      // have buried it. Measured back to 0.18, level with the
      // `one-flap` it replaces.
      { key: 'coin', label: 'Coin', note: 'Two high pings — something metal going into the fare box.',
        play: (c, b) => noiseTicks(c, b, [
          { at: 0, freq: 3200, peak: 1.95, q: 14, dur: 0.045 },
          { at: 0.028, freq: 4300, peak: 1.22, q: 14, dur: 0.035 },
        ]) },
      { key: 'one-flap', label: 'One flap', note: 'A single drum turning. The same machine as the level clatter, smaller.',
        play: (c, b) => clatter(c, b, 1) },
      { key: 'soft-tick', label: 'Soft tick', note: 'Duller and quieter, for when the board is not the point.',
        play: (c, b) => noiseTicks(c, b, [{ freq: 1700, peak: 0.20, q: 3, dur: 0.035 }]) },
    ],
  },
  {
    key: 'flap-clatter', category: 'ui', family: 'rewards',
    label: 'Level up', jp: '進級', where: 'The board turning your level over',
    variants: [
      { key: 'board-run', label: 'Full run', note: 'Eight drums, bunching up and losing energy as they settle.',
        play: (c, b) => clatter(c, b, 8) },
      { key: 'short-run', label: 'Short run', note: 'The first four only. Over before you look up.',
        play: (c, b) => clatter(c, b, 4) },
      { key: 'heavy-board', label: 'Heavy board', note: 'Bigger drums, lower, landing on a stop.',
        play: (c, b) => { clatter(c, b, 8, 0.72); thump(c, b, { at: 0.26, from: 120, to: 70, dur: 0.16, peak: 0.13 }) } },
    ],
  },
  {
    key: 'card-stamp', category: 'ui', family: 'rewards',
    label: 'Card stamped', jp: '押印', where: 'A card climbing a stage — the seal pressed into its corner',
    variants: [
      { key: 'stamp', label: 'Ticket stamp', note: 'A knock with weight behind it — the gate marking a pass.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 1150, peak: 0.26, q: 5, dur: 0.026 }])
          thump(c, b, { at: 0.004, from: 175, to: 115, dur: 0.09, peak: 0.11 })
        } },
      { key: 'soft-press', label: 'Soft press', note: 'The thump alone, no knock. A rubber stamp on paper.',
        play: (c, b) => thump(c, b, { at: 0, from: 160, to: 100, dur: 0.11, peak: 0.10 }) },
    ],
  },
]

// ── Lookup ────────────────────────────────────────────────
export const VOICE_EVENTS = EVENTS
export const VOICE_FAMILIES = [
  { key: 'interface', label: 'Interface', jp: '操作' },
  { key: 'study',     label: 'Study',     jp: '学習' },
  { key: 'station',   label: 'Station',   jp: '駅' },
  { key: 'rewards',   label: 'Rewards',   jp: '報酬' },
]

const byKey = new Map(EVENTS.map(e => [e.key, e]))

export function voiceEvent(key) { return byKey.get(key) ?? null }
export function hasVoice(key) { return byKey.has(key) }

// Replacing a voice with a recording is a matter of adding the file
// AND naming it in `file:` on the event above. The naming step is not
// ceremony: probing for a file that is not there does not 404, it
// **succeeds**. Both dev (Vite) and production (vercel.json) rewrite
// every unmatched path to index.html, so an absent sound came back
// 200 with a page of HTML in it, which then failed to decode and fell
// through to the synthesiser — correct, but one wasted round trip per
// event, forever, for a file nobody had added.
//
// So: no event declares a file today, and nothing is probed. Add the
// mp3, add the `file` key, and that event loads it instead.

// ── The choice ────────────────────────────────────────────
// Persisted per browser. An unknown or removed variant key falls back
// to the event's first variant, so pruning a voice from the palette
// cannot leave anyone with a silent app.
const STORE_KEY = 'jp-app-voices'

function read() {
  if (typeof window === 'undefined') return {}
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? 'null')
    return (saved && typeof saved === 'object') ? saved : {}
  } catch { return {} }
}

let chosen = read()
const listeners = new Set()

export function getVoiceKey(eventKey) {
  const event = byKey.get(eventKey)
  if (!event) return null
  const picked = chosen[eventKey]
  return event.variants.some(v => v.key === picked) ? picked : event.variants[0].key
}

export function getVoice(eventKey) {
  const event = byKey.get(eventKey)
  if (!event) return null
  const key = getVoiceKey(eventKey)
  return event.variants.find(v => v.key === key) ?? event.variants[0]
}

export function setVoiceKey(eventKey, variantKey) {
  const event = byKey.get(eventKey)
  if (!event || !event.variants.some(v => v.key === variantKey)) return
  chosen = { ...chosen, [eventKey]: variantKey }
  // Storage is unavailable in private mode and under some policies —
  // the choice still applies for this session, it just won't persist.
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(chosen)) } catch { /* not persisted */ }
  listeners.forEach(fn => fn())
}

export function resetVoices() {
  chosen = {}
  try { window.localStorage.removeItem(STORE_KEY) } catch { /* nothing to clear */ }
  listeners.forEach(fn => fn())
}

/** Every choice made, for pasting back into this file as the default. */
export function chosenVoices() {
  return Object.fromEntries(EVENTS.map(e => [e.key, getVoiceKey(e.key)]))
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
const snapshot = () => chosen
const SERVER_SNAPSHOT = {}
const server = () => SERVER_SNAPSHOT

export function useVoiceKeys() { return useSyncExternalStore(subscribe, snapshot, server) }

// ── Playing one ───────────────────────────────────────────
// A recording wins over the synthesised voice where an event declares
// one. getBuffer evicts failed fetches so a dropped request can retry,
// which for a file that turns out to be unusable would mean one
// request per tap — hence the miss set: one attempt per path per
// session, then straight to the synthesiser.
const assetMissing = new Set()

/** Play one specific variant, ignoring the stored choice. For the palette. */
/**
 * The per-sound trim, as a node the recipe plays into.
 *
 * The recipes set the *shape* of a sound -- which notes, how long,
 * how they sit against each other -- and this sets how loud that
 * shape lands. Keeping the two apart is what makes levelling possible
 * at all: retuning the mix is one table of numbers rather than an
 * edit to fifty-seven recipes, and a variant swapped in from the
 * palette inherits its event's level instead of arriving at whatever
 * loudness its author happened to type.
 *
 * BASE_GAIN already described itself as "mastering, not user
 * preference" and already had entries for click and toggle -- but it
 * was only ever applied by playBuffer, on the file path, so for a
 * synthesised sound it did nothing at all. Those two entries were
 * dead code. They are live now.
 *
 * Disconnected on a timer because a synthesised voice has no `ended`
 * to hang off: the primitives tear down their own oscillators and
 * sources, and this is the one node above them. 3s clears the longest
 * sound in the palette (the melody, at 1.76s) several times over.
 */
function trimNode(ctx, event) {
  const bus = busFor(event.category)
  if (!bus) return null
  const trim = ctx.createGain()
  trim.gain.value = trimFor(event.category, event.key)
  trim.connect(bus)
  setTimeout(() => { try { trim.disconnect() } catch { /* already gone */ } }, 3000)
  return trim
}

export function playVariant(eventKey, variantKey) {
  const event = byKey.get(eventKey)
  if (!event || isMuted()) return
  const variant = event.variants.find(v => v.key === variantKey)
  if (!variant) return
  const ctx = getAudioContext()
  if (!ctx) return
  const out = trimNode(ctx, event)
  if (out) variant.play(ctx, out)
}

/** Play whichever voice is currently selected for this event. */
export function playVoice(eventKey) {
  const event = byKey.get(eventKey)
  if (!event || isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const synth = () => {
    if (isMuted()) return
    const out = trimNode(ctx, event)
    if (out) getVoice(eventKey).play(ctx, out)
  }

  const path = event.file
  if (!path || assetMissing.has(path)) { synth(); return }

  getBuffer(path)
    .then(buffer => {
      if (isMuted()) return
      if (buffer) playBuffer(buffer, event.category, event.key)
      else { assetMissing.add(path); synth() }
    })
    .catch(() => { assetMissing.add(path); synth() })
}
