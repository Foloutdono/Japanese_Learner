// ── The four kana sets ────────────────────────────────────────
// The long vowels ride in the combinations deck rather than standing
// as a fifth and sixth stop of their own (backend/content/kana_data.py
// says why), so the line has four stops and not six.
//
// `code` is the sign a set's stop is written on — the first glyph of
// the set, the same one the wall map labels it with.
//
// One definition, because three screens now need it: the kana section's
// own picker, and the two surfaces of the daily queue (the home
// concourse strip and the queue itself), which have to turn a stored
// deck key back into something a person would recognise.
//
// Without this the queue's lane header reads "HIRAGANA_BASIC" — the raw
// slug that only exists because card ids and card_modes rows need a
// stable machine name.
//
// The order is the order the app teaches them, and it is load-bearing:
// the kana line's stops are drawn in it, and `currentKanaSet` below
// reads it as a route.
const SETS = [
  { slug: 'hiragana_basic',  code: 'あ',   label: t => t.hiraganaBase },
  { slug: 'hiragana_combos', code: 'きゃ', label: t => t.hiraganaCombinations },
  { slug: 'katakana_basic',  code: 'ア',   label: t => t.katakanaBase },
  { slug: 'katakana_combos', code: 'キャ', label: t => t.katakanaCombinations },
]

export function kanaSets(t) {
  return SETS.map(({ slug, code, label }) => ({ label: label(t), slug, code }))
}

/** The human label for a stored kana set key; the key itself if unknown,
 *  so a set added on the backend degrades to something readable rather
 *  than to nothing. */
export function kanaSetLabel(t, slug) {
  return kanaSets(t).find(s => s.slug === slug)?.label ?? slug
}

/**
 * The stop of the kana line the learner stands at — the one the
 * station page rings and captions "You are here", with the sets behind
 * it drawn as passed (components/selection/RouteStops.jsx).
 *
 * `items` is /api/stats' `items.kana` block. Nothing else says where a
 * learner is on this line: the JLPT lines have a declared level to
 * mark (user_profiles.jlpt_level, which LevelSelector reads), and kana
 * has no equivalent — you are simply as far as you have got. So the
 * first set that is not finished is the one you are at, and finished
 * means what the figure printed on that very row means: every card of
 * it mastered, `learned` having caught up with `total`.
 *
 * Null while the figures are unknown, so a stats fetch that has not
 * landed yet draws no marker rather than a wrong one — a learner deep
 * in katakana must never watch the caption start on あ and jump.
 * Sets the payload does not carry are skipped for the same reason, and
 * a learner who has finished the line keeps the marker on its last
 * stop rather than losing it at the end.
 */
export function currentKanaSet(items) {
  const known = SETS.filter(s => Number(items?.[s.slug]?.total) > 0)
  if (!known.length) return null
  const at = known.find(s => (Number(items[s.slug].learned) || 0) < Number(items[s.slug].total))
  return (at ?? known[known.length - 1]).slug
}
