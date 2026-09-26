// ── A learner's record, for the statistics' lane tests (plan 138) ──
// Modelled on the owner's screen the day plan 138 was drawn: a first
// week of reviews, kana all held, vocabulary at 81%, kanji at 93% with
// N4's drawing the leak, grammar at 33% over twelve reviews, and each
// line's most-missed cards. The days are this week's, up to today, so
// the retention line draws days (retentionSeries) whatever day the
// suite runs on; `longRecord` is the same learner eight weeks in.

const bucket = (reviews, correct) => ({ total: 100, new: 50, learning: 30, mastered: 20, due_now: 0, reviews, correct })

export const STATS = {
  kana: {
    hiragana_basic:  { 'kana.flashcard.f2b': bucket(120, 120) },
    hiragana_combos: { 'kana.flashcard.f2b': bucket(60, 60) },
    katakana_basic:  { 'kana.flashcard.f2b': bucket(67, 67) },
    katakana_combos: { 'kana.flashcard.f2b': bucket(30, 30) },
  },
  vocab: {
    N5: { 'vocab.flashcard.f2b': bucket(140, 120), 'vocab.flashcard.b2f': bucket(0, 0), 'vocab.word_reading': bucket(60, 45) },
    N4: { 'vocab.flashcard.f2b': bucket(42, 33), 'vocab.flashcard.b2f': bucket(0, 0), 'vocab.word_reading': bucket(18, 12) },
    N3: { 'vocab.flashcard.f2b': bucket(0, 0) },
  },
  kanji: {
    N5: { 'kanji.flashcard.f2b': bucket(102, 100), 'kanji.readings': bucket(72, 70), 'kanji.write_kanji': bucket(66, 64), 'kanji.radical': bucket(0, 0) },
    N4: { 'kanji.flashcard.f2b': bucket(74, 64), 'kanji.readings': bucket(48, 44), 'kanji.write_kanji': bucket(58, 49), 'kanji.radical': bucket(0, 0) },
  },
  grammar: { N5: { 'grammar.flashcard.f2b': bucket(12, 4) } },
  items: {},
}

export function iso(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Monday of this week up to today: one to seven days.
const sinceMonday = (new Date().getDay() + 6) % 7
const WEEK = [212, 164, 188, 131, 149, 125, 140]
const MISS = [22, 15, 17, 11, 12, 10, 13]

const weak = (category, key, mode, rawIds, accuracy, lapses) =>
  rawIds.map((raw_id, i) => ({
    card_id: `u:${raw_id}`, raw_id, category, key, mode,
    total_reviews: 10, correct_reviews: 5, accuracy: accuracy[i], lapses: lapses[i],
  }))

export const WEAKEST = [
  ...weak('vocab', 'N5', 'vocab.flashcard.f2b', ['vocab_N5__コート', 'vocab_N5_靴下_くつした'], [60, 60], [2, 2]),
  ...weak('kanji', 'N4', 'kanji.flashcard.f2b',
    ['kanji_N4_仕', 'kanji_N4_急', 'kanji_N4_堂', 'kanji_N4_貸', 'kanji_N4_族', 'kanji_N4_赤', 'kanji_N4_冬', 'kanji_N4_用'],
    [50, 40, 40, 40, 50, 50, 50, 60], [4, 3, 3, 3, 2, 2, 2, 2]),
  ...weak('grammar', 'N5', 'grammar.flashcard.f2b', ['grammar_N5_〜より〜のほうが', 'grammar_N5_〜ないで'], [33, 33], [2, 2]),
]

export const REPORT = {
  days: Array.from({ length: sinceMonday + 1 }, (_, i) => ({
    date: iso(sinceMonday - i), reviews: WEEK[i], good: WEEK[i] - MISS[i],
  })),
  strength: [{ days: 0, count: 112 }, { days: 3, count: 136 }, { days: 12, count: 228 }, { days: 45, count: 10 }],
  weakest: WEAKEST,
}

// Eight weeks of a review every other day: the line draws weeks.
export const LONG_REPORT = {
  ...REPORT,
  days: Array.from({ length: 28 }, (_, i) => ({ date: iso(55 - 2 * i), reviews: 40, good: 30 + (i % 7) })),
}
