import { levelTitle } from './levelTitle'

// ── How much of a moment is this? ─────────────────────────
// Every reward used to get the same treatment: a full kabuki mie with
// wooden clappers, a kumadori burst and a line of stage footlights,
// whether you had just crossed level 2 or level 30. Something that
// happens after nearly every card cannot also be a ceremony — the
// twentieth curtain call in an hour is an interruption, not a reward.
//
// So there are three, and the boundaries are not arbitrary multiples.
// They come from the ranks the app already keeps (domain/levelTitle):
//
//   'fare'      XP, no level. The overwhelming majority. A tick, the
//               way a gate deducts a fare — under a second, corner of
//               the screen, no interaction.
//   'level'     The level number changed. The 発車標 flap turns over.
//               Still self-dismissing, still uninterrupted.
//   'rank'      The *title* changed — 見習い to 浪人 to 侍 to 師範 to
//               免許皆伝. Four times in the entire progression, so this
//               is the one that can afford to stop everything and wait
//               to be dismissed by hand.
//
// The rank boundaries being real thresholds rather than "every 5" is
// the point: the ceremony fires when something is genuinely different
// about your pass, not when a counter happens to be round.
export const TIERS = ['fare', 'level', 'rank']

/**
 * @param {object} toast  { leveledUp, newLevel }
 * @returns {'fare'|'level'|'rank'}
 */
export function rewardTier(toast) {
  if (!toast?.leveledUp) return 'fare'

  const level = toast.newLevel
  if (typeof level !== 'number') return 'level'

  // A level-up is +1, so the band it left is the one below it. If the
  // title differs, the pass is being re-issued rather than reprinted.
  const [, jpNow] = levelTitle(level)
  const [, jpBefore] = levelTitle(Math.max(0, level - 1))
  return jpNow === jpBefore ? 'level' : 'rank'
}

/** The rank a level belongs to, as { jp, latin }. */
export function rankFor(level) {
  const [, jp, latin] = levelTitle(level)
  return { jp, latin }
}
