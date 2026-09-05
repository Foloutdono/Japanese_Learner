// ── 音訓 — which readings a study card shows ─────────────────────
// A kanji's reading field is every reading it has, and for the common
// ones that is a lot: 下 carries fourteen. Printing all of them turns
// the reveal into a wall the learner scrolls past, and the wall is
// mostly repetition — of 下's twelve kun readings, five are okurigana
// forms of くだ and two more of さ, so a naive "first five" spends four
// of its slots on two stems (した・しも・もと・さ.げる・さ.がる) and never
// reaches くだ or お at all.
//
// So the card shows a FIXED FEW, chosen for spread: one reading per
// stem, in the data's own order. Five readings off five different
// stems say more about a kanji than five conjugations of one. The full
// list is never lost — the dictionary card prints it whole, which is
// why this lives at the call site and not in the reading data.
//
// Pure and here rather than in the component because it is a rule
// about Japanese, not about layout, and because the interesting cases
// (a variant marker, a kanji whose readings all share one stem) are
// worth testing without a DOM.

/**
 * The part of a reading that is the kanji's own, with okurigana and
 * variant markers stripped: 'さ.げる' → 'さ', '~くだ.す' → 'くだ',
 * 'した' → 'した'. Two readings share a stem when they are the same
 * word wearing different endings.
 */
export function readingStem(token) {
  if (typeof token !== 'string') return ''
  // '~' (and its fullwidth twin) marks a variant form, not a reading of
  // its own — '~くだ.す' is くだ.す after a prefix.
  const bare = token.replace(/^[~～]+/, '')
  const dot = bare.indexOf('.')
  return dot === -1 ? bare : bare.slice(0, dot)
}

/**
 * Up to `limit` readings, spread across as many distinct stems as the
 * list has. Returns the list untouched when it already fits, so the
 * dictionary (which passes no limit) and short kanji are unaffected.
 *
 * Order is always the source's own — this picks WHICH readings show,
 * never re-ranks them, because the data's order is the one place a
 * primary reading is marked (it comes first).
 */
export function pickVariedReadings(tokens, limit) {
  if (!Array.isArray(tokens)) return []
  if (!Number.isFinite(limit) || limit <= 0 || tokens.length <= limit) return tokens

  const taken = new Set()
  const seen = new Set()

  // One per stem, in order.
  tokens.forEach((token, i) => {
    if (taken.size >= limit) return
    const stem = readingStem(token)
    if (seen.has(stem)) return
    seen.add(stem)
    taken.add(i)
  })

  // Fewer stems than slots — a kanji whose readings are all one word in
  // different clothes. Fill the rest in order rather than leave the
  // card sparser than it needs to be.
  tokens.forEach((_, i) => {
    if (taken.size >= limit) return
    taken.add(i)
  })

  return tokens.filter((_, i) => taken.has(i))
}

/**
 * On'yomi readings are written in katakana, kun'yomi in hiragana — a
 * kanji's combined reading field mixes both, separated by '・' or ';',
 * e.g. "イチ・イツ・ひと~・ひと.つ". A token is classified by its first
 * actual kana character (skipping '.'/'~', which are okurigana/variant
 * markers, not kana). Here rather than in Readings.jsx because it is a
 * rule about Japanese, not about layout, and the dictionary plate needs
 * it without the component.
 */
export function isOnyomiToken(token) {
  const firstKana = [...(typeof token === 'string' ? token : '')].find(c => /[\u3040-\u30FF]/.test(c))
  if (!firstKana) return false
  return /[\u30A0-\u30FF]/.test(firstKana) // katakana range
}

/**
 * The dictionary plate's two: the first on'yomi and the first kun'yomi
 * when a kanji has both — one reading from each register says more
 * about a kanji than two from one — otherwise the first `limit` varied
 * readings. Order is the source's own, as everywhere in this module.
 * The rest of the list is not lost: the plate's "+N" opens every
 * reading with the words that use it.
 */
export function pickPlateReadings(tokens, limit = 2) {
  if (!Array.isArray(tokens)) return []
  if (tokens.length <= limit) return tokens
  const on = tokens.find(isOnyomiToken)
  const kun = tokens.find(t => !isOnyomiToken(t))
  if (limit >= 2 && on !== undefined && kun !== undefined) {
    return tokens.filter(t => t === on || t === kun).slice(0, limit)
  }
  return pickVariedReadings(tokens, limit)
}
