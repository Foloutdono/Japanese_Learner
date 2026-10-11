// ── The boards' dice (plan 191) ──────────────────────────────────
// mulberry32, as the canvas's boards seed it (kit.md §14): the same
// numbers on every replay, so a stamp's tilt, a pile's jitter or a
// firework's burst never differs between two plays of one ceremony.
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The boards' seed: the day of the data story, 2026-10-06. */
export const BOARD_SEED = 20261006
