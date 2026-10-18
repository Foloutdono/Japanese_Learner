// ── The kit's constants (plan 191) ──────────────────────────────────
// What the ceremony's pieces share that is not a component: the boards'
// tilts for the week's stamps and the verdict inks.

// The boards' tilts (degrees) for 水 → 火, so every screen agrees on how
// each stamp of the week landed.
export const WEEK_TILTS = Object.freeze([-5, 3, -2, 6, -4, 2, -7])

/** The verdict inks, wrong / correct / perfect, by a face's `verdict`. */
export const VERDICT_INK = Object.freeze(['var(--rating-wrong)', 'var(--rating-correct)', 'var(--rating-perfect)'])
