// ── Stage footlights ──────────────────────────────────────
// A warm line igniting along the bottom edge of the screen with a few
// embers drifting out of it.
//
// This used to live in XpToast, which is where it was written for.
// XpToast is now the station's own 発車標 flap (see LevelUp.jsx) and
// has no stage in it at all — but the daruma hall's 満願 ceremony is
// still genuinely theatrical and still wants this, so it moved here
// rather than being deleted along with the rest of the kabuki.

// ── Footlight embers ───────────────────────────────────────
// Horizontal position, launch delay, sideways drift, sway, size,
// lifetime, and an optional `flare` flag (a softer, bigger radial
// spark rather than a tight dot — the bigger sparks a real tsuke
// board throws off among the fine ones) for each spark along the
// footlight strip — hand-placed for the same reason every other set
// of numbers in this file is (KUMADORI_ANGLES above, the tsuke beat
// timings in index.css…): a mie is precise, not a particle system, so
// none of this is Math.random() — it's the same thirteen embers every
// time. The routine toast only lights a spread subset of them
// (EMBER_LAYOUT_LIGHT), so a level-up reads as the whole footlight
// strip catching, not just a bigger version of the same handful.
const EMBER_LAYOUT = [
  { x: 3,  delay: 0,   drift: -10, sway: 5, size: 4, dur: 2800 },
  { x: 12, delay: 260, drift: 6,   sway: 7, size: 5, dur: 3200, flare: true },
  { x: 21, delay: 80,  drift: -5,  sway: 4, size: 4, dur: 2600 },
  { x: 30, delay: 420, drift: 9,   sway: 8, size: 6, dur: 3400 },
  { x: 39, delay: 150, drift: -8,  sway: 5, size: 4, dur: 2900 },
  { x: 48, delay: 340, drift: 5,   sway: 6, size: 5, dur: 3100, flare: true },
  { x: 57, delay: 40,  drift: -6,  sway: 4, size: 4, dur: 2700 },
  { x: 66, delay: 480, drift: 8,   sway: 7, size: 6, dur: 3500 },
  { x: 75, delay: 200, drift: -4,  sway: 5, size: 4, dur: 3000 },
  { x: 83, delay: 360, drift: 7,   sway: 6, size: 5, dur: 3300, flare: true },
  { x: 90, delay: 110, drift: -6,  sway: 4, size: 4, dur: 2750 },
  { x: 96, delay: 300, drift: 5,   sway: 5, size: 5, dur: 3050 },
  { x: 50, delay: 20,  drift: 0,   sway: 3, size: 7, dur: 3700, flare: true },
]
const EMBER_LAYOUT_LIGHT = [EMBER_LAYOUT[0], EMBER_LAYOUT[2], EMBER_LAYOUT[4], EMBER_LAYOUT[6], EMBER_LAYOUT[8], EMBER_LAYOUT[11]]

// ── Stage footlights ──────────────────────────────────────
// A kabuki stage is lit from its own floor as much as from above;
// this is that — a warm line igniting along the very bottom edge of
// the screen, with a handful of embers drifting up out of it, so a
// reward reads as something the whole stage responds to rather than
// a badge popping up in one corner. `big` widens it into the fuller
// footlight row (and the taller ember climb — see --ember-rise on
// .stage-footlights--big in index.css) for the level-up curtain call;
// `colorVar` tints it to match the same per-quality accent the
// kumadori burst and glow-pulse use, falling back to the gold trim
// (--accent2) everything else in this file already falls back to.
// Purely decorative throughout — aria-hidden, pointer-events: none.
// Exported so the daruma 満願 ceremony (DarumaRitual.jsx) lights the
// same stage rather than growing a second, subtly-different celebration
// language of its own.
export function StageFootlights({ big, leaving, colorVar }) {
  const embers = big ? EMBER_LAYOUT : EMBER_LAYOUT_LIGHT
  return (
    <div
      className={`stage-footlights${big ? ' stage-footlights--big' : ''}${leaving ? ' stage-footlights--leaving' : ''}`}
      aria-hidden="true"
      style={colorVar ? { '--footlight-color': `var(${colorVar})` } : undefined}
    >
      <div className="stage-footlights__glow" />
      {embers.map((e, i) => (
        <span
          key={i}
          className={`ember${e.flare ? ' ember--flare' : ''}`}
          style={{
            '--ember-x': `${e.x}%`,
            '--ember-delay': `${e.delay}ms`,
            '--ember-drift': `${e.drift}px`,
            '--ember-sway': `${e.sway ?? 5}px`,
            '--ember-size': `${e.size}px`,
            '--ember-dur': `${e.dur}ms`,
          }}
        />
      ))}
    </div>
  )
}
