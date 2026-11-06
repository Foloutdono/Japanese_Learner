// ── 余白 — a rim of paper round the words (plan 309) ─────────────────
// The scroll's text is written once on a strip of its own (challenge.js,
// stripOf). Turned on (`challenge.halo`), a rim of the page's paper is
// grown round every glyph on that strip, so the print under it never runs
// into a stroke, however little paper lies over the picture. It is drawn
// once a text, and costs no frame anything.

/** Grows the rim on the strip `c`, `k` its width (0, the look before
 *  plan 309: none), on the one canvas `canvasOf` makes for it, made after
 *  the strip. Nothing is grown yet. */
export function haloStrip(c, canvasOf, k) {
  // Off, or no strip to grow it on: the strip is left as it is.
  if (!c || !(k > 0)) return
}
