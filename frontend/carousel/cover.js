// ── 表紙 — the hook in colour, from the first frame (plan 309) ──────
// A thumbnail is the video's first look in a feed, and the scroll's hook
// is a pale washed card there, like every other one. Turned on
// (`challenge.cover`), the hook stands on the title slip's washi over the
// print unwashed, and the paper comes in only as the text does. Off (the
// look before plan 309), the hook draws its own lines, as it always has.
//
// The cover's words are the hook's own, written once in challenge.js
// (`hookWords`: { hook, title, chip }, in the plan's language) and handed
// to it here, so a hook reworded is reworded on the cover too.
import { tuned } from './tune.js'

/** Whether the hook is drawn as the cover: asked for, and over a print, never a photo. */
export const coverOn = plan => tuned(plan.tune, 'challenge.cover') > 0 && !plan.photo

/** Where the cover's plate stands on the frame, laid out from the hook's
 *  `words` (challenge.js, hookWords): under the masthead's row, its foot
 *  above Fuji's summit on every scenery. */
// eslint-disable-next-line no-unused-vars -- the plate is laid out from the hook's words, on its context
export function coverBox(ctx, plan, words) {
  return { x: 162, y: 500, w: 755, h: 440 }
}

/** The cover: the hook's `words` (challenge.js, hookWords: its line, the
 *  title and the chip) on the slip's washi, `into` seconds into the hook,
 *  `laid` the share of the wash the backdrop has laid (0 to 1). The
 *  masthead stays the hook's own, drawn before it. Nothing is drawn yet. */
// eslint-disable-next-line no-unused-vars -- what the cover is drawn from, once it is drawn
export function drawCover(ctx, plan, tl, into, P, T, { laid, words } = {}) {}
