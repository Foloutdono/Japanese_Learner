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
export function kanaSets(t) {
  return [
    { label: t.hiraganaBase,         slug: 'hiragana_basic',  code: 'あ' },
    { label: t.hiraganaCombinations, slug: 'hiragana_combos', code: 'きゃ' },
    { label: t.katakanaBase,         slug: 'katakana_basic',  code: 'ア' },
    { label: t.katakanaCombinations, slug: 'katakana_combos', code: 'キャ' },
  ]
}

/** The human label for a stored kana set key; the key itself if unknown,
 *  so a set added on the backend degrades to something readable rather
 *  than to nothing. */
export function kanaSetLabel(t, slug) {
  return kanaSets(t).find(s => s.slug === slug)?.label ?? slug
}
