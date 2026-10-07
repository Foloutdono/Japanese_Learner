import { LINE_COLOR } from '../../../config/tabs'

// ── The kit's constants and dealers (plan 191) ───────────────────────
// What the ceremony's pieces share that is not a component: the boards'
// tilts for the week's stamps, the verdict inks, a line's rail pigment,
// and the specks a seal throws off.

// The boards' tilts (degrees) for 水 → 火, so every screen agrees on how
// each stamp of the week landed.
export const WEEK_TILTS = Object.freeze([-5, 3, -2, 6, -4, 2, -7])

/** The verdict inks, wrong / correct / perfect, by a face's `verdict`. */
export const VERDICT_INK = Object.freeze(['var(--rating-wrong)', 'var(--rating-correct)', 'var(--rating-perfect)'])

/** A line's rail pigment, by a face's `line`. */
export function lineInk(line) {
  return LINE_COLOR[line] ?? 'var(--surface-line)'
}

/** A ring of `n` specks around a circle of radius `r` centred on (cx, cy), from a seeded die. */
export function makeSpecks(random, { cx, cy, r, n = 13, reach = 18 }) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + random() * 0.4
    const at = r * (0.92 + random() * 0.12)
    const far = reach * (0.6 + random() * 0.8)
    return {
      x: Math.round(cx + Math.cos(a) * at - 2),
      y: Math.round(cy + Math.sin(a) * at - 2),
      dx: Math.round(Math.cos(a) * far),
      dy: Math.round(Math.sin(a) * far),
      d: Math.round(random() * 60),
      s: random() > 0.7 ? 3 : 4,
    }
  })
}
