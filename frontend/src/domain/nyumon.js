// ── 入門 — the introduction before the first card (plan 170) ─────
// Six short screens for a learner who answered « Pas encore » to the
// boarding's kana question and so has no picture yet of how Japanese
// works: the MAP of the language, not the knowledge -- nothing here is
// memorised, the flashcards do that. The owner's canvas "Tsuji — 入門,
// day one" drew them. Pure data and pure functions, like the rest of
// domain/: screens/RideIntro.jsx and components/intro/ draw them.
//
// One sentence carries the six screens. Every word in it is an N5 card
// of the deck (駅 gare, コーヒー café, 飲む boire), and the sentence
// itself stands in the curated N5 reading bank (backend
// content/reading_sentences.py), which backend/tests/test_nyumon.py
// holds to this file -- ADR 0017: a lesson is fed from the bank the
// real thing draws on, never a sentence written for the lesson alone.

export const INTRO_SENTENCE = '駅でコーヒーを飲みます。'
export const INTRO_ROMAJI = 'eki de kōhī o nomimasu'

/** The screens, in order: the track's stops and the desk strip's. */
export const INTRO_STEPS = ['scripts', 'sounds', 'table', 'katakana', 'sentence', 'route']

/** Which of the three scripts a character is written in, or null for
    punctuation. ー, the long-vowel mark, is katakana's own. */
export function scriptOf(ch) {
  const c = ch.codePointAt(0)
  if (c >= 0x3041 && c <= 0x309f) return 'hira'
  if (c >= 0x30a0 && c <= 0x30ff) return 'kata'
  if ((c >= 0x4e00 && c <= 0x9fff) || c === 0x3005) return 'kanji'
  return null
}

/** The sentence as cells, one per character, each knowing its script:
    screen 1 lights a script's cells, screen 6 every kana. */
export const INTRO_CELLS = [...INTRO_SENTENCE].map(ch => ({ ch, script: scriptOf(ch) }))

/** The two kanji's readings, printed over them on screen 6. */
export const INTRO_RUBY = { 駅: 'えき', 飲: 'の' }

/** Screen 2: the five vowels, each the name of its recorded clip. */
export const INTRO_VOWELS = [
  { kana: 'あ', romaji: 'a' },
  { kana: 'い', romaji: 'i' },
  { kana: 'う', romaji: 'u' },
  { kana: 'え', romaji: 'e' },
  { kana: 'お', romaji: 'o' },
]

/** Screen 3: the basic table (五十音), a row per consonant and a column
    per vowel; null where the row has no sign. A cell's romaji is also
    its clip's name (lib/audio playKana). */
export const GOJUON = [
  { c: '', cells: [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o']] },
  { c: 'k', cells: [['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']] },
  { c: 's', cells: [['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so']] },
  { c: 't', cells: [['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to']] },
  { c: 'n', cells: [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no']] },
  { c: 'h', cells: [['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho']] },
  { c: 'm', cells: [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo']] },
  { c: 'y', cells: [['や', 'ya'], null, ['ゆ', 'yu'], null, ['よ', 'yo']] },
  { c: 'r', cells: [['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro']] },
  { c: 'w', cells: [['わ', 'wa'], null, null, null, ['を', 'wo']] },
  { c: '', cells: [['ん', 'n'], null, null, null, null] },
]
export const GOJUON_VOWELS = ['a', 'i', 'u', 'e', 'o']

/** The sign screen 3 asks for: row k, column e. */
export const TABLE_TARGET = { row: 'k', col: 3, kana: 'け', romaji: 'ke' }

/** Every sign of the table, for preloading its clips. */
export const GOJUON_SIGNS = GOJUON.flatMap(row => row.cells.filter(Boolean))

/** Screen 4: the same sound in both hands. */
export const INTRO_PAIRS = [
  { hira: 'あ', kata: 'ア', romaji: 'a' },
  { hira: 'か', kata: 'カ', romaji: 'ka' },
  { hira: 'す', kata: 'ス', romaji: 'su' },
]

/** Screen 4: katakana words the learner already knows. `beats` is the
    sound spelled a mora at a time; `key` names the meaning in the
    locale (t.nyuWords). */
export const INTRO_WORDS = [
  { jp: 'ホテル', beats: ['ho', 'te', 'ru'], key: 'hotel' },
  { jp: 'コーヒー', beats: ['kō', 'hī'], key: 'coffee' },
  { jp: 'テレビ', beats: ['te', 're', 'bi'], key: 'tv' },
]

/** Screen 5: the sentence as its words, each with the tag it carries
    (a particle -- the screen never says the word) or, last, the verb.
    `mean` and `role` name locale strings (t.nyuMeans, t.nyuRoles). */
export const INTRO_PHRASE = [
  { jp: '駅', romaji: 'eki', mean: 'station', tag: 'で', role: 'where' },
  { jp: 'コーヒー', romaji: 'kōhī', mean: 'coffee', tag: 'を', role: 'what' },
  { jp: '飲みます', romaji: 'nomimasu', mean: 'drink', verb: true },
]

/** Screen 5's two tagged words in the order they stand: swapped, the
    café comes first and the meaning holds. */
export function phraseOrder(swapped) {
  const [station, coffee, verb] = INTRO_PHRASE
  return swapped ? [coffee, station, verb] : [station, coffee, verb]
}
