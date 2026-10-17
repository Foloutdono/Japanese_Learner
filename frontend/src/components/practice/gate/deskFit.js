// ── The desk's painted platform in its frame (plan 243) ────────────────
// The scene is the owner's painting of the desk gate, one unit a px of
// it (scripts/practice-gate/desk.py, desk.json): 2127 × 940 units, the
// station as wide as a wide window. The frame is the screen beside the
// rail, and the board stands over its right side, so only the frame's
// left `stage` px are the painting's to show.

import DESK from './desk.json'

export const SCENE = DESK.scene
// Kept clear right of the open door, to the stage's edge.
export const AIR = 48
// What the frame may give up of the canopy's roof, over the lamps, when
// a frame wider than the scene crops its height.
export const ROOF = 60
// Kept clear between the stage's edge and a thing that leaves it whole.
export const CLEAR = 8

/** Where the scene stands in a frame `w` × `h` px whose left `stage` px
    are the painting's: its scale `u` (px to the unit) and its corner
    (x, y). It fills the frame, by its height while the frame is no wider
    than the scene and by its width past that, cropping the roof first.
    It starts at the painting's left edge (the station's sign, the
    bench), unless the open door would then pass under the board: the
    sign then leaves whole, never cut in two, and past that the door
    stands at the stage's edge.

    The clock is a button, and the board's edge never cuts it if the
    painting can help it: with the sign gone the scene moves on until the
    clock stands whole at the edge, and with the sign there the scene is
    drawn a little larger, what it gives up of the roof allowing, until
    the clock stands wholly under the board. */
export function fitDesk(w, h, stage) {
  if (!(w > 0 && h > 0)) return null
  const { door: D, clock: C, sign: S } = DESK
  const door = u => (D.x + D.w + AIR) * u
  const cut = (u, x) => (C.cx - C.r) * u + x < stage && (C.cx + C.r + CLEAR) * u + x > stage
  let u = Math.max(h / SCENE.h, w / SCENE.w)
  if (door(u) <= stage && cut(u, 0)) {
    const under = stage / (C.cx - C.r)
    if ((SCENE.h - ROOF) * under <= h) u = under
  }
  const over = SCENE.h * u - h
  const y = over > 0 ? -Math.min(over, ROOF * u) : 0
  let x = 0
  if (door(u) > stage) {
    x = Math.min(-(S.right + CLEAR) * u, stage - door(u))
    if (cut(u, x)) x = stage - (C.cx + C.r + CLEAR) * u
  }
  return { u, x: Math.min(0, Math.max(x, w - SCENE.w * u)), y }
}
