// ── How much of a moment is this? ─────────────────────────
// Every reward used to get the same treatment: a full kabuki mie with
// wooden clappers, a kumadori burst and a line of stage footlights,
// whether you had just crossed level 2 or level 30. Something that
// happens after nearly every card cannot also be a ceremony — the
// twentieth curtain call in an hour is an interruption, not a reward.
//
// So there are two:
//
//   'fare'   XP, no level. The overwhelming majority. A tick, the way
//            a gate deducts a fare — under a second, corner of the
//            screen, no interaction.
//   'level'  The level number changed. The 発車標 flap turns over.
//            Self-dismissing, and it never holds the next card.
//
// There was a third, 'rank'. The level bands each carried a title
// (見習い → 浪人 → 侍 → 師範 → 免許皆伝), and crossing one re-issued
// your 定期券 in a board that took the whole screen and waited to be
// dismissed by hand. The titles are gone: a placeholder ladder that
// said nothing the level number did not already say, and with them
// goes the only reward that ever stopped a session. Nothing holds the
// queue now — every tier plays over the next card.
export const TIERS = ['fare', 'level']

/**
 * @param {object} toast  { leveledUp }
 * @returns {'fare'|'level'}
 */
export function rewardTier(toast) {
  return toast?.leveledUp ? 'level' : 'fare'
}
