import { tones, bar, noiseTicks, noiseSweep, thump } from './synth'

// ── The recipes ───────────────────────────────────────────
// Every interface and effect sound the app makes, as data: the
// events (the moments), and under each the voices that can answer
// it. voices.js owns the choice and the playing; this file owns only
// what each sound IS, and imports nothing but the primitives in
// synth.js, so the same recipes can be rendered outside the app --
// by the loudness meter (scripts/measure-voices.mjs) and by the
// listening panel built from them -- and what is measured or
// auditioned there is byte for byte what ships.

// ── Heard in a hand ───────────────────────────────────────
// A phone's speaker plays almost nothing under 400Hz: measured through
// a model of one (scripts/measure-voices.mjs), a G3 loses 20dB and the
// stamp's thump 22. Every sound built on a low note was therefore
// being designed for headphones and heard, on the device most learners
// hold, as a click or as nothing -- the wrong answer 20dB under the
// right one it was levelled against.
//
// The ear does not need the fundamental to hear a low note: given its
// overtones it fills the note in (the missing fundamental), which is
// how a phone plays a bass line at all. So a low note voiced for a
// hand keeps its fundamental for headphones and adds the 2nd to 4th
// harmonics for the speaker, each dying sooner than the note so the
// top does not outlast the weight.
function voiced(note, overtones = [0.6, 0.38, 0.2]) {
  const out = [note]
  overtones.forEach((level, i) => {
    const n = i + 2
    out.push({
      ...note,
      freq: note.freq * n,
      to: note.to ? note.to * n : undefined,
      peak: note.peak * level,
      dur: note.dur * (1 - 0.18 * (i + 1)),
      type: 'sine',
    })
  })
  return out
}

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
// An event is the moment; its variants are the voices that can answer
// it, the first being the one that ships. A variant is
//
//   play(ctx, out)  the score, on the primitives in synth.js
//   level           its gain against the event's default -- measured
//                   (scripts/measure-voices.mjs), so every voice of an
//                   event lands within half a decibel of the default.
//                   Without it a choice was not a fair one: the
//                   palette's wood block sat 17.6dB under the tick it
//                   was offered in place of, and the latch 24.8dB
//                   under the two step -- heard side by side, each
//                   lost for being quieter, not for being worse.
//   space           its send into the hall (synth.js), for the
//                   station's chimes; the chrome stays dry.
//
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
        level: 7.62,
        play: (c, b) => noiseTicks(c, b, [{ freq: 1850, peak: 0.30, q: 9, dur: 0.028 }]) },
      { key: 'key', label: 'Key tap', note: 'A tone with a breath of noise on the front of it.',
        level: 1.83,
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 3000, peak: 0.11, q: 2, dur: 0.012 }])
          tones(c, b, [{ freq: 2093.0, dur: 0.022, peak: 0.10 }])
        } },
      { key: 'pad', label: 'Soft pad', note: 'Rounder and lower. A press rather than a point.',
        level: 1.14,
        play: (c, b) => tones(c, b, [{ freq: 1046.5, dur: 0.055, peak: 0.13, type: 'triangle', attack: 0.008 }]) },
      { key: 'wood-tap', label: 'Wood tap', note: 'A marimba\'s top bar, barely touched: a click with a pitch and a body instead of a beep.',
        level: 0.78,
        play: (c, b) => bar(c, b, [{ freq: 1760.0, dur: 0.05, peak: 0.16, material: 'wood' }]) },
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
        level: 17.36,
        play: (c, b) => noiseTicks(c, b, [
          { at: 0, freq: 950, peak: 0.26, q: 8, dur: 0.022 },
          { at: 0.045, freq: 1500, peak: 0.22, q: 8, dur: 0.026 },
        ]) },
      { key: 'settle', label: 'Settle', note: 'E6 → B5, the two-step reversed. Reads as "off".',
        play: (c, b) => tones(c, b, [
          { freq: 1318.51, at: 0, dur: 0.030, peak: 0.14 },
          { freq: 987.77, at: 0.038, dur: 0.055, peak: 0.14 },
        ]) },
      { key: 'wood-pair', label: 'Wood pair', note: 'The two step on marimba bars. The same B5 → E6, rounder, and dry.',
        level: 0.81,
        play: (c, b) => bar(c, b, [
          { freq: 987.77, at: 0, dur: 0.07, peak: 0.15, material: 'wood' },
          { freq: 1318.51, at: 0.045, dur: 0.09, peak: 0.15, material: 'wood' },
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
        level: 1.95,
        play: (c, b) => noiseSweep(c, b, { dur: 0.14, peak: 0.085, from: 520, mid: 1500, to: 1900, q: 0.9, hold: 0.5, attack: 0.03 }) },
      { key: 'soft-open', label: 'Soft open', note: 'One rounded D6. The softest edge of the three.',
        level: 1.23,
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
        level: 1.07,
        play: (c, b) => {
          noiseSweep(c, b, { dur: 0.14, peak: 0.085, from: 1900, mid: 900, to: 480, q: 0.9, hold: 0.45, attack: 0.02 })
          thump(c, b, { at: 0.12, from: 150, to: 96, dur: 0.10, peak: 0.09 })
        } },
      { key: 'soft-close', label: 'Soft close', note: 'One rounded A5, sitting under the open.',
        level: 1.20,
        play: (c, b) => tones(c, b, [{ freq: 880.0, dur: 0.085, peak: 0.11, type: 'triangle', attack: 0.010 }]) },
    ],
  },
  {
    key: 'click-mode-selection', category: 'ui', family: 'interface',
    label: 'Option picked', jp: '選択', where: 'Mode, level, theme, tier and filter rows — the busiest sound in the app',
    variants: [
      { key: 'wood-pick', label: 'Wood pick', note: 'One E6 on a marimba bar with the pick\'s hair of noise on the front. The busiest sound, with a rounder edge to hear all day.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 2400, peak: 0.053, q: 3, dur: 0.008 }])
          bar(c, b, [{ freq: 1318.51, dur: 0.06, peak: 0.106, material: 'wood' }])
        } },
      { key: 'pick', label: 'Pick', note: 'E6 with a hair of noise under it. Crisp, over in 45ms.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 2400, peak: 0.09, q: 3, dur: 0.010 }])
          tones(c, b, [{ freq: 1318.51, dur: 0.042, peak: 0.13 }])
        } },
      { key: 'stamp', label: 'Ticket stamp', note: 'A knock with weight behind it — the gate marking a pass.',
        level: 0.81,
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 1150, peak: 0.26, q: 5, dur: 0.026 }])
          thump(c, b, { at: 0.004, from: 175, to: 115, dur: 0.09, peak: 0.11 })
        } },
      { key: 'two-tap', label: 'Two tap', note: 'C6 then E6, 30ms apart. Light enough to hear all day.',
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
      { key: 'bar-depart', label: 'Departure on bars', note: 'A5 → E6 struck on vibraphone bars: the departure, with a ring after it.',
        play: (c, b) => bar(c, b, [
          { freq: 880.0, at: 0, dur: 0.16, peak: 0.106, material: 'metal' },
          { freq: 1318.51, at: 0.060, dur: 0.26, peak: 0.099, material: 'metal' },
        ]) },
      { key: 'depart', label: 'Departure', note: 'A5 → E6, fuller than a pick. You are leaving.',
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.055, peak: 0.16 },
          { freq: 1318.51, at: 0.060, dur: 0.11, peak: 0.15 },
        ]) },
      { key: 'gate-lite', label: 'Small gate', note: 'The gate chime an octave down and at half the level.',
        level: 1.11,
        play: (c, b) => tones(c, b, [
          { freq: 987.77, at: 0, dur: 0.050, peak: 0.17 },
          { freq: 1318.51, at: 0.070, dur: 0.070, peak: 0.17 },
        ]) },
      { key: 'turnstile', label: 'Turnstile', note: 'The bar giving way, then the tone. Mechanical first.',
        level: 1.12,
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
        level: 1.08,
        play: (c, b) => tones(c, b, [
          { freq: 1046.5, at: 0, dur: 0.09, peak: 0.17 },
          { freq: 1568.0, at: 0.055, dur: 0.16, peak: 0.15 },
        ]) },
      { key: 'bell', label: 'Single bell', note: 'One C6 left to ring. The least eventful yes available.',
        level: 0.75,
        play: (c, b) => tones(c, b, [
          { freq: 1046.5, dur: 0.38, peak: 0.15 },
          { freq: 2093.0, dur: 0.22, peak: 0.045 },
        ]) },
      { key: 'vibraphone', label: 'Vibraphone', note: 'The shipped octave, G5 → G6, struck on metal bars: the same two notes with the ring a chime has, not a test tone\'s.',
        level: 0.90,
        play: (c, b) => bar(c, b, [
          { freq: 783.99, at: 0, dur: 0.30, peak: 0.13, material: 'metal' },
          { freq: 1568.0, at: 0.075, dur: 0.42, peak: 0.12, material: 'metal' },
        ]) },
      { key: 'marimba', label: 'Marimba fifth', note: 'C6 → G6 on wood. Warm and dry, and gone before the fare lands under it.',
        level: 0.81,
        play: (c, b) => bar(c, b, [
          { freq: 1046.5, at: 0, dur: 0.20, peak: 0.17, material: 'wood' },
          { freq: 1568.0, at: 0.065, dur: 0.26, peak: 0.16, material: 'wood' },
        ]) },
      { key: 'glass', label: 'Glass bar', note: 'One G6 on a glass bar, its overtones off the harmonic series. Bright without being loud.',
        level: 0.82,
        play: (c, b) => bar(c, b, [{ freq: 1568.0, dur: 0.45, peak: 0.13, material: 'glass' }]) },
    ],
  },
  {
    key: 'wrong', category: 'ui', family: 'study',
    label: 'Answer wrong', jp: '不正解', where: 'The rating bar. Not a buzzer — a wrong card is the next card',
    variants: [
      { key: 'low-double-voiced', label: 'Low double, voiced', note: 'G3 → D3 with the overtones a phone can play: the low double\'s weight in headphones, and 13dB more of it on a phone.',
        play: (c, b) => tones(c, b, [
          ...voiced({ freq: 196.0, at: 0, dur: 0.12, peak: 0.152 }, [0.7, 0.6, 0.4, 0.2]),
          ...voiced({ freq: 146.8, at: 0.09, dur: 0.20, peak: 0.129 }, [0.7, 0.6, 0.4, 0.2]),
        ]) },
      { key: 'low-double', label: 'Low double', note: 'G3 → D3 alone. Felt more than heard, and over quickly -- and on a phone, 20dB under the right answer.',
        play: (c, b) => tones(c, b, [
          { freq: 196.0, at: 0, dur: 0.12, peak: 0.20 },
          { freq: 146.8, at: 0.09, dur: 0.20, peak: 0.17 },
        ]) },
      { key: 'thud', label: 'Soft thud', note: 'No pitch at all. The gentlest thing in the palette.',
        level: 0.83,
        play: (c, b) => {
          thump(c, b, { from: 165, to: 88, dur: 0.22, peak: 0.20 })
          noiseTicks(c, b, [{ freq: 320, peak: 0.10, q: 1.2, dur: 0.05 }])
        } },
      { key: 'slump', label: 'Slump', note: 'One note sliding down a fourth. Reads as "not that one".',
        level: 1.10,
        play: (c, b) => tones(c, b, [{ freq: 261.63, to: 196.0, dur: 0.26, peak: 0.17, type: 'triangle', attack: 0.010 }]) },
      { key: 'wood-knock', label: 'Wood knock', note: 'G4 → D4 on the marimba\'s low bars, over in a blink. A wrong note on a wooden instrument, not an alarm — and heard on a phone.',
        level: 0.82,
        play: (c, b) => bar(c, b, [
          { freq: 392.0, at: 0, dur: 0.16, peak: 0.19, material: 'wood' },
          { freq: 293.66, at: 0.085, dur: 0.24, peak: 0.19, material: 'wood' },
        ]) },
    ],
  },
  {
    // Turning the card over was the generic click, the sound of a
    // settings row -- on the gesture a review is made of, dozens of
    // times a session. The card turn was chosen on the listening panel;
    // the click stays in the palette as the flip it used to be.
    key: 'card-flip', category: 'sfx', family: 'study',
    label: 'Card turned over', jp: '裏返し', where: 'A flashcard tapped to its answer, and back — the review\'s own gesture',
    variants: [
      { key: 'card-turn', label: 'Card turn', note: 'A stiff card flipped on a table: its edge lifting, a brush of air, and the face landing.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 3200, peak: 0.261, q: 2.5, dur: 0.010 }])
          noiseSweep(c, b, { at: 0.004, dur: 0.075, peak: 0.183, from: 1800, mid: 3200, to: 2200, q: 0.9, hold: 0.3, attack: 0.012 })
          noiseTicks(c, b, [{ at: 0.070, freq: 1400, peak: 0.679, q: 3, dur: 0.022 }])
        } },
      { key: 'click', label: 'Click', note: 'The generic G6 tick every button makes, which the flip played until the card turn.',
        play: (c, b) => tones(c, b, [{ freq: 1568.0, dur: 0.032, peak: 0.16 }]) },
      { key: 'karuta', label: 'Karuta', note: 'かるた: a thick card snapped over, one crisp slap and nothing after it.',
        level: 3.79,
        play: (c, b) => noiseTicks(c, b, [
          { freq: 2200, peak: 0.28, q: 2.2, dur: 0.018 },
          { at: 0.003, freq: 950, peak: 0.24, q: 2, dur: 0.028 },
        ]) },
      { key: 'soft-bar', label: 'Soft bar', note: 'One muted marimba D6: the answer arriving as a note rather than as a button.',
        level: 0.81,
        play: (c, b) => bar(c, b, [{ freq: 1174.66, dur: 0.07, peak: 0.13, material: 'wood' }]) },
    ],
  },
  {
    // The mock exam warned of its last five minutes, and its last one,
    // only to a screen reader and in a red corner nobody taking a test
    // is looking at. A hall announces it; the attention chime was chosen
    // on the listening panel. `loudness` is the level its voices are
    // written at, which the meter falls back to should silence ever be
    // listed first, since silence is no reference.
    key: 'exam-warning', category: 'ui', family: 'study', loudness: 0.060,
    label: 'Time running out', jp: '残り時間', where: 'The mock exam at five minutes left, and at one',
    variants: [
      { key: 'attention', label: 'Attention chime', note: 'The first two notes of the station\'s announcement chime, F5 → A5: "listen", and nothing after it.',
        space: 0.22,
        play: (c, b) => bar(c, b, [
          { freq: 698.46, at: 0, dur: 0.34, peak: 0.098, material: 'metal' },
          { freq: 880.0, at: 0.17, dur: 0.80, peak: 0.098, material: 'metal' },
        ]) },
      { key: 'silent', label: 'Silent', note: 'No sound: the timer turns red and a screen reader says it, as the exam was before.',
        play: () => {} },
      { key: 'hall-bell', label: 'Hall bell', note: 'Two soft strikes of one bar, B5, in the concourse. Noticed without startling anyone mid-question.',
        level: 0.53,
        space: 0.22,
        play: (c, b) => bar(c, b, [
          { freq: 987.77, at: 0, dur: 0.45, peak: 0.20, material: 'metal' },
          { freq: 987.77, at: 0.32, dur: 0.80, peak: 0.18, material: 'metal' },
        ]) },
    ],
  },
  {
    key: 'card-transition', category: 'sfx', family: 'study',
    label: 'Card turns', jp: '次の札', where: 'Between every card in a review session',
    variants: [
      { key: 'whisk', label: 'Whisk away', note: 'Falling rather than arching: the old card going, not the new one landing.',
        play: (c, b) => noiseSweep(c, b, { dur: 0.22, peak: 0.066, from: 2600, mid: 1400, to: 700, q: 0.6, hold: 0.3, attack: 0.02 }) },
      { key: 'paper-slip', label: 'Paper slip', note: 'A card leaving the top of the deck. Barely there, by design.',
        play: (c, b) => noiseSweep(c, b, { dur: 0.17, peak: 0.075, from: 900, mid: 2500, to: 1200, q: 0.7, hold: 0.35, attack: 0.02 }) },
      { key: 'flick', label: 'Flick', note: 'Two dry taps — a thumb releasing the corner.',
        level: 5.09,
        play: (c, b) => noiseTicks(c, b, [
          { at: 0, freq: 2700, peak: 0.13, q: 2.2, dur: 0.018 },
          { at: 0.042, freq: 1900, peak: 0.10, q: 2.2, dur: 0.022 },
        ]) },
      { key: 'flap', label: 'Single flap', note: 'One drum of the board turning. Shares its vocabulary with the XP tick.',
        level: 2.41,
        play: (c, b) => noiseTicks(c, b, [{ freq: 2600, peak: 0.20, q: 1.6, dur: 0.030 }]) },
    ],
  },

  // ── Station ─────────────────────────────────────────────
  {
    // The boarding's hour: the departure board's flaps turned by hand
    // (▲ and ▼ over the drums on a phone), and on the desk the train
    // dragged along the day's arc, the board in its bowl turning with
    // it. One per half hour the board moves, so a drag across the day
    // is a run of them -- which is what a board spinning sounds like.
    // Mechanical, never a tone, for the fare tick's reason: fired this
    // fast, a pitch would play a tune.
    key: 'board-flap', category: 'ui', family: 'station', meter: 'peak',
    label: 'Hour board', jp: '発車標', where: 'The boarding\'s hour: the flaps turned by hand, the train dragged along the day',
    variants: [
      { key: 'run', label: 'Short run', note: 'The minute drums turning over: three flaps bunching as the board settles, over in 70ms.',
        play: (c, b) => noiseTicks(c, b, [
          { at: 0, freq: 2500, peak: 0.30, q: 1.6, dur: 0.022 },
          { at: 0.030, freq: 2380, peak: 0.22, q: 1.6, dur: 0.022 },
          { at: 0.052, freq: 2260, peak: 0.16, q: 1.6, dur: 0.020 },
        ]) },
      { key: 'one-flap', label: 'One flap', note: 'A single drum of the board, the first of the level\'s clatter. The lightest, for a hand dragging the train across the day.',
        level: 0.67,
        play: (c, b) => clatter(c, b, 1) },
      { key: 'soft-flap', label: 'Soft flap', note: 'The flap and its catch behind the board\'s glass: duller, at 1.8kHz, for when the board is not the point.',
        level: 1.70,
        play: (c, b) => noiseTicks(c, b, [
          { at: 0, freq: 1800, peak: 0.22, q: 2.4, dur: 0.028 },
          { at: 0.026, freq: 1650, peak: 0.14, q: 2.4, dur: 0.024 },
        ]) },
    ],
  },
  {
    key: 'gate-chime', category: 'ui', family: 'station',
    label: 'Ticket gate', jp: '改札', where: 'A valid pass has been read. Rises: accepted, go',
    variants: [
      { key: 'three-step', label: 'Three step', note: 'B6, D♯7, F♯7. Brighter, and a little more ceremonial.',
        play: (c, b) => tones(c, b, [
          { freq: 1975.5, at: 0, dur: 0.045, peak: 0.452 },
          { freq: 2489.0, at: 0.055, dur: 0.045, peak: 0.452 },
          { freq: 2960.0, at: 0.110, dur: 0.080, peak: 0.476 },
        ]) },
      { key: 'rising-pair', label: 'Rising pair', note: 'B6 into E7. Short and bright — it fires on every departure.',
        play: (c, b) => tones(c, b, [
          { freq: 1975.5, at: 0, dur: 0.055, peak: 0.5 },
          { freq: 2637.0, at: 0.075, dur: 0.075, peak: 0.5 },
        ]) },
      { key: 'pip-pip', label: 'Two pips', note: 'The same note twice, flat and fast — what a real 改札 does.',
        level: 1.52,
        play: (c, b) => tones(c, b, [
          { freq: 2637.0, at: 0, dur: 0.045, peak: 0.42 },
          { freq: 2637.0, at: 0.075, dur: 0.045, peak: 0.42 },
        ]) },
      { key: 'rising-pair-hall', label: 'Rising pair, in the hall', note: 'The rising pair, B6 → E7, heard in a concourse: a short tail after the second note, no longer.',
        space: 0.16,
        play: (c, b) => tones(c, b, [
          { freq: 1975.5, at: 0, dur: 0.055, peak: 0.5 },
          { freq: 2637.0, at: 0.075, dur: 0.075, peak: 0.5 },
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
        level: 1.13,
        play: (c, b) => tones(c, b, [
          { freq: 1318.5, at: 0, dur: 0.26, peak: 0.26 },
          { freq: 1108.7, at: 0.15, dur: 0.30, peak: 0.26 },
          { freq: 987.8, at: 0.32, dur: 0.60, peak: 0.28 },
        ]) },
      { key: 'ding-dong', label: 'Ding-dong', note: 'ピンポーン: E6 falling a third to C6 on vibraphone bars, in the concourse. Still falls: arrived, board.',
        space: 0.22,
        play: (c, b) => bar(c, b, [
          { freq: 1318.5, at: 0, dur: 0.55, peak: 0.26, material: 'metal' },
          { freq: 1046.5, at: 0.30, dur: 0.95, peak: 0.26, material: 'metal' },
        ]) },
      { key: 'falling-bars', label: 'Falling pair, struck', note: 'The shipped E6 → B5 on metal bars in the hall, instead of sines in a dry room.',
        level: 1.06,
        space: 0.22,
        play: (c, b) => bar(c, b, [
          { freq: 1318.5, at: 0, dur: 0.50, peak: 0.26, material: 'metal' },
          { freq: 987.8, at: 0.19, dur: 0.95, peak: 0.26, material: 'metal' },
        ]) },
    ],
  },
  {
    key: 'door-slide', category: 'sfx', family: 'station',
    label: 'Doors running open', jp: '開扉', where: 'The stretch after the chime, when the leaves actually move',
    variants: [
      { key: 'soft-rush', label: 'Soft rush', note: 'The same travel with no stop at the end. Slower, unremarkable.',
        play: (c, b) => noiseSweep(c, b, { dur: 0.75, peak: 0.418, from: 300, mid: 900, to: 420, q: 1.1, hold: 0.6, attack: 0.16 }) },
      { key: 'pneumatic', label: 'Pneumatic', note: 'Rush opening as they gather speed, closing as they reach the stop.',
        play: (c, b) => {
          noiseSweep(c, b, { dur: 0.62, peak: 0.13, from: 380, mid: 1250, to: 520, q: 0.8, hold: 0.55, attack: 0.10 })
          thump(c, b, { at: 0.59, from: 96, to: 58, dur: 0.15, peak: 0.16 })
        } },
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
      { key: 'arpeggio-bars', label: 'Arpeggio, struck', note: 'A5, C♯6, E6 on vibraphone bars, rising an octave under the gate and ringing in the concourse.',
        space: 0.22,
        play: (c, b) => bar(c, b, [
          { freq: 880.0, at: 0, dur: 0.40, peak: 0.22, material: 'metal' },
          { freq: 1108.73, at: 0.09, dur: 0.45, peak: 0.22, material: 'metal' },
          { freq: 1318.51, at: 0.20, dur: 0.85, peak: 0.24, material: 'metal' },
        ]) },
      { key: 'arpeggio', label: 'Arpeggio', note: 'A5, C♯6, E6 — rising, an octave under the gate.',
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.16, peak: 0.26 },
          { freq: 1108.73, at: 0.09, dur: 0.18, peak: 0.26 },
          { freq: 1318.51, at: 0.20, dur: 0.42, peak: 0.28 },
        ]) },
      { key: 'two-bell', label: 'Open fifth', note: 'A5 and E6 struck together, then E6 alone. Wider, less busy.',
        level: 1.08,
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.30, peak: 0.22 },
          { freq: 1318.51, at: 0, dur: 0.30, peak: 0.18 },
          { freq: 1318.51, at: 0.24, dur: 0.50, peak: 0.24 },
        ]) },
      { key: 'wide', label: 'Wide rise', note: 'A5, E6, A6 — a full octave of travel, and the most triumphant of the three.',
        level: 1.09,
        play: (c, b) => tones(c, b, [
          { freq: 880.0, at: 0, dur: 0.15, peak: 0.24 },
          { freq: 1318.51, at: 0.10, dur: 0.17, peak: 0.24 },
          { freq: 1760.0, at: 0.22, dur: 0.45, peak: 0.26 },
        ]) },
      { key: 'announcement', label: 'Announcement chime', note: 'ピンポンパンポーン rising: the four notes a station plays before it speaks. F5, A5, C6, F6 on bars, in the hall.',
        space: 0.22,
        play: (c, b) => bar(c, b, [
          { freq: 698.46, at: 0, dur: 0.34, peak: 0.20, material: 'metal' },
          { freq: 880.0, at: 0.17, dur: 0.34, peak: 0.20, material: 'metal' },
          { freq: 1046.5, at: 0.34, dur: 0.34, peak: 0.20, material: 'metal' },
          { freq: 1396.91, at: 0.51, dur: 0.90, peak: 0.22, material: 'metal' },
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
        level: 1.33,
        play: (c, b) => tones(c, b, [
          { freq: 783.99, at: 0, dur: 0.85, peak: 0.20, type: 'triangle', attack: 0.09 },
          { freq: 587.33, at: 0.05, dur: 0.85, peak: 0.14, type: 'triangle', attack: 0.09 },
        ]) },
      { key: 'settle-bars', label: 'Settle, struck', note: 'The shipped G5 → D5 on vibraphone bars in the concourse: steps down, and rings there.',
        level: 0.93,
        space: 0.22,
        play: (c, b) => bar(c, b, [
          { freq: 783.99, at: 0, dur: 0.45, peak: 0.22, material: 'metal' },
          { freq: 587.33, at: 0.17, dur: 0.95, peak: 0.22, material: 'metal' },
        ]) },
      { key: 'announcement-end', label: 'End of announcement', note: 'ピンポンパンポーン falling: the four notes after a station has spoken, F6, C6, A5, F5 — the journey is over.',
        space: 0.22,
        play: (c, b) => bar(c, b, [
          { freq: 1396.91, at: 0, dur: 0.34, peak: 0.19, material: 'metal' },
          { freq: 1046.5, at: 0.17, dur: 0.34, peak: 0.19, material: 'metal' },
          { freq: 880.0, at: 0.34, dur: 0.34, peak: 0.19, material: 'metal' },
          { freq: 698.46, at: 0.51, dur: 0.95, peak: 0.21, material: 'metal' },
        ]) },
    ],
  },

  // ── Rewards ─────────────────────────────────────────────
  {
    key: 'fare-tick', category: 'ui', family: 'rewards', meter: 'peak',
    label: 'XP earned', jp: '運賃', where: 'The split-flap board showing a fare — every review',
    variants: [
      // Still mechanical rather than tonal — resonant filtered noise,
      // not an oscillator — so it does not collide with the chimes.
      // It stepped away from the level's clatter, which is the one
      // relationship this sound used to carry: a fare and a level are
      // two objects (a coin, and since plan 142 the pass's punch)
      // rather than one machine at two sizes. Deliberate, not an
      // oversight.
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
      { key: 'one-flap', label: 'One flap', note: 'A single drum of a departure board turning.',
        level: 1.31,
        play: (c, b) => clatter(c, b, 1) },
      { key: 'soft-tick', label: 'Soft tick', note: 'Duller and shorter, for when the board is not the point.',
        level: 4.43,
        play: (c, b) => noiseTicks(c, b, [{ freq: 1700, peak: 0.20, q: 3, dur: 0.035 }]) },
    ],
  },
  {
    // Plan 142: the level is clipped on the pass rather than turned
    // over on a board, so its voice is the gate's punch (改札鋏), not
    // the board's drums. Played on the cut itself -- XpToast starts it
    // from the bite's own animationstart -- so it lands on the frame
    // the notch opens, never on a timer guessing at the CSS.
    key: 'pass-clip', category: 'ui', family: 'rewards', meter: 'peak',
    label: 'Level up', jp: '改札鋏', where: 'The gate\'s punch clipping your pass as the level turns over',
    variants: [
      { key: 'punch-voiced', label: 'Punch, voiced', note: 'Steel jaws through card: the snip, a knock moved up into steel, and the jaws ringing, so a level-up reads on a phone as more than a click.',
        play: (c, b) => {
          noiseTicks(c, b, [
            { freq: 3600, peak: 0.77, q: 7, dur: 0.022 },
            { at: 0.006, freq: 1250, peak: 0.572, q: 4, dur: 0.035 },
          ])
          bar(c, b, [{ at: 0.004, freq: 1864.66, dur: 0.12, peak: 0.055, material: 'glass' }])
          thump(c, b, { at: 0.004, from: 190, to: 120, dur: 0.07, peak: 0.132 })
        } },
      { key: 'punch', label: 'Punch', note: 'A bright snip on a short, low knock. The knock is 12dB down on a phone.',
        play: (c, b) => {
          noiseTicks(c, b, [
            { freq: 3600, peak: 0.70, q: 7, dur: 0.022 },
            { at: 0.006, freq: 1250, peak: 0.38, q: 4, dur: 0.03 },
          ])
          thump(c, b, { at: 0.004, from: 190, to: 120, dur: 0.07, peak: 0.16 })
        } },
      { key: 'snip', label: 'Snip', note: 'The snip alone, no knock. Lighter; over before you look up.',
        level: 1.31,
        play: (c, b) => noiseTicks(c, b, [{ freq: 3200, peak: 0.70, q: 6, dur: 0.024 }]) },
      { key: 'press', label: 'Gate press', note: 'Lower and fuller: the ticket stamp\'s knock with more weight behind it.',
        level: 1.07,
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 1100, peak: 0.30, q: 4, dur: 0.03 }])
          thump(c, b, { at: 0.004, from: 150, to: 90, dur: 0.12, peak: 0.14 })
        } },
      { key: 'clip-clip', label: 'Clip-clip', note: 'Two snips, as the gate\'s clerks clicked the punch in the air between passengers. A level earns a flourish.',
        level: 1.68,
        play: (c, b) => {
          noiseTicks(c, b, [
            { freq: 3400, peak: 0.55, q: 7, dur: 0.020 },
            { at: 0.004, freq: 1300, peak: 0.30, q: 4, dur: 0.028 },
            { at: 0.105, freq: 3600, peak: 0.70, q: 7, dur: 0.022 },
            { at: 0.110, freq: 1250, peak: 0.45, q: 4, dur: 0.035 },
          ])
        } },
    ],
  },
  {
    key: 'card-stamp', category: 'ui', family: 'rewards', meter: 'peak',
    label: 'Card stamped', jp: '押印', where: 'A card climbing a stage — the seal pressed into its corner',
    variants: [
      { key: 'hanko', label: 'Hanko', note: '判子: the seal pressed, then lifted off the paper a beat later. A small ceremony, still short.',
        play: (c, b) => {
          noiseTicks(c, b, [
            { freq: 900, peak: 0.594, q: 4, dur: 0.035 },
            { at: 0.002, freq: 600, peak: 1.056, q: 2.5, dur: 0.05 },
            { at: 0.090, freq: 3200, peak: 0.158, q: 2, dur: 0.014 },
          ])
          thump(c, b, { at: 0.004, from: 220, to: 140, dur: 0.07, peak: 0.066 })
        } },
      { key: 'stamp', label: 'Ticket stamp', note: 'A knock with weight behind it — the gate marking a pass.',
        play: (c, b) => {
          noiseTicks(c, b, [{ freq: 1150, peak: 0.26, q: 5, dur: 0.026 }])
          thump(c, b, { at: 0.004, from: 175, to: 115, dur: 0.09, peak: 0.11 })
        } },
      { key: 'soft-press', label: 'Soft press', note: 'The thump alone, no knock. A rubber stamp on paper.',
        play: (c, b) => thump(c, b, { at: 0, from: 160, to: 100, dur: 0.11, peak: 0.10 }) },
      { key: 'stamp-voiced', label: 'Stamp, voiced', note: 'The ticket stamp\'s knock with the desk under the paper: a body at 700Hz a phone can play, where the thump alone was 22dB down.',
        level: 1.06,
        play: (c, b) => {
          noiseTicks(c, b, [
            { freq: 1150, peak: 0.30, q: 5, dur: 0.026 },
            { at: 0.003, freq: 700, peak: 0.95, q: 2.5, dur: 0.06 },
          ])
          thump(c, b, { at: 0.004, from: 175, to: 115, dur: 0.09, peak: 0.07 })
        } },
    ],
  },
]

export const VOICE_EVENTS = EVENTS
export const VOICE_FAMILIES = [
  { key: 'interface', label: 'Interface', jp: '操作' },
  { key: 'study',     label: 'Study',     jp: '学習' },
  { key: 'station',   label: 'Station',   jp: '駅' },
  { key: 'rewards',   label: 'Rewards',   jp: '報酬' },
]
