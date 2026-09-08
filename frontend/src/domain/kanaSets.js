// ── The four kana sets ────────────────────────────────────────
// The long vowels ride in the combinations deck rather than standing
// as a fifth and sixth stop of their own (backend/content/kana_data.py
// says why), so the samples name one of each: きゃ for the yōon, えい
// for the long vowels.
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
    { label: t.hiraganaBase,         slug: 'hiragana_basic',  sample: 'あ い う え お' },
    { label: t.hiraganaCombinations, slug: 'hiragana_combos', sample: 'きゃ きゅ えい' },
    { label: t.katakanaBase,         slug: 'katakana_basic',  sample: 'ア イ ウ エ オ' },
    { label: t.katakanaCombinations, slug: 'katakana_combos', sample: 'キャ キュ アー' },
  ]
}

/** The human label for a stored kana set key; the key itself if unknown,
 *  so a set added on the backend degrades to something readable rather
 *  than to nothing. */
export function kanaSetLabel(t, slug) {
  return kanaSets(t).find(s => s.slug === slug)?.label ?? slug
}
