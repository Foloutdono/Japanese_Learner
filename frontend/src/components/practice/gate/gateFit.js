// ── The painted gate in a frame of any shape (plan 223) ──────────────
// The scene is 390 × 724 units, drawn for the phone's gate between the
// HUD and the tab bar. A frame is rarely that shape: a tall phone has
// more height, a browser with its bars has less, a tablet more width.

export const SCENE = { w: 390, h: 724 }
// What any frame keeps: from the contact wire, where the pantograph's
// head runs, to under the gate button.
export const KEEP = { top: 186, bottom: 696 }
// How far a tall frame may crop into the two pillars, each side.
export const PILLAR = 24

/** Where the scene stands in a frame `w` × `h` px: its scale `u` (px to
    the unit) and its corner (x, y). It fills the frame's width, or its
    height where the frame is taller than the scene (cropping the
    pillars, never more: past that the canopy's colour runs on above
    it). What it cannot fit it gives up from the sky first, down to the
    wire, then from the platform under the button. A frame too short
    for the wire-to-button band shows that band whole, and the pillars
    run on beside it. */
export function fitScene(w, h) {
  if (!(w > 0 && h > 0)) return null
  const u = Math.min(Math.max(w / SCENE.w, h / SCENE.h), w / (SCENE.w - 2 * PILLAR), h / (KEEP.bottom - KEEP.top))
  const x = (w - SCENE.w * u) / 2
  const over = SCENE.h * u - h
  const y = over > 0 ? -Math.min(over, KEEP.top * u) : -over
  return { u, x, y }
}
