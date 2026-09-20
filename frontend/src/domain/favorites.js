// ── お気に入り — what a favourite refers to ──────────────────
// A favourite is a REFERENCE to an entry, never a copy of it: the
// collection it is in and the key that collection files it under.
// routes/favorites.py stores exactly this pair and resolves it back
// into the catalogue's own row when the shelf is read, so the two
// sides have to derive the same key from the same row — this is the
// client's half of that contract (plan 092).
//
//   kanji     the character            駅
//   vocab     "{kanji}::{kana}"        電車::でんしゃ — the deck key the
//             frequency overrides already store, so a word is named
//             the same way everywhere; a kana-only word is "::かな"
//   grammar   the point's card id      grammar_N5_〜てから
//   kana      the kana                 あ / ア
//
// null for a row that cannot be kept: nothing the catalogue serves
// today, but a row with its identity missing is not a favourite.
export function favoriteRef(entry) {
  if (!entry) return null
  switch (entry.type) {
    case 'kanji':
      return entry.kanji ? { kind: 'kanji', key: entry.kanji } : null
    case 'vocab':
      return (entry.kanji || entry.kana)
        ? { kind: 'vocab', key: `${entry.kanji || ''}::${entry.kana || ''}` }
        : null
    case 'grammar':
      return entry.raw_id ? { kind: 'grammar', key: entry.raw_id } : null
    case 'hiragana':
    case 'katakana':
      return entry.kana ? { kind: entry.type, key: entry.kana } : null
    default:
      return null
  }
}

// One string per reference, for a Set. A kind never contains ':', so
// the first ':' is the seam whatever the key holds.
export function favoriteId(ref) {
  return ref ? `${ref.kind}:${ref.key}` : null
}
