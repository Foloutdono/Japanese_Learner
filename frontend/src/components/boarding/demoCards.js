// ── The rolling stock on the Welcome screen (plan 075) ───────────
// Two lanes of cards roll past like trains: each card is one thing the
// app does, in its line's pigment. The Japanese is content and lives
// here; the tag, the meaning and the foot are the interface's and are
// keys into the locale's brdDemo* tables. `kind` picks the face: a
// glyph, a sentence (a cloze run in the middle), a stroke drawing
// itself, sound bars breathing, or a paper's line with its caption.
export const FRONT_LANE = [
  { line: 'kanji', tag: 'kanji', kind: 'glyph', jp: '駅', meaning: 'station', foot: 'kanjiMeaning' },
  { line: 'vocab', tag: 'vocab', kind: 'glyph', jp: '食べる', meaning: 'toEat', foot: 'wordMeaning' },
  { line: 'grammar', tag: 'grammar', kind: 'sentence', jp: ['雨が降り', 'そう', 'です。'], meaning: 'fillIn', foot: 'ruleSentence' },
  { line: 'kanji', tag: 'kanji', kind: 'draw', meaning: 'craft', foot: 'meaningKanji' },
  { line: 'exam', tag: 'listening', kind: 'wave', meaning: 'listen', foot: 'soundMeaning' },
  { line: 'reading', tag: 'reading', kind: 'sentence', jp: ['駅で友達を待っています。'], meaning: 'readIt', foot: 'sentenceMeaning' },
]

export const BACK_LANE = [
  { line: 'vocab', tag: 'vocab', kind: 'glyph', jp: '切符', meaning: 'ticket', foot: 'wordMeaning' },
  { line: 'kanji', tag: 'kanji', kind: 'glyph', jp: '山', meaning: 'mountain', foot: 'kanjiReading' },
  { line: 'reading', tag: 'reading', kind: 'sentence', jp: ['明日は雨が降ると思う。'], meaning: 'readIt', foot: 'sentenceMeaning' },
  { line: 'grammar', tag: 'grammar', kind: 'sentence', jp: ['駅まで', '歩いて', '行きます。'], meaning: 'fillIn', foot: 'ruleSentence' },
  { line: 'kana', tag: 'kana', kind: 'glyph', jp: 'きっぷ', meaning: 'kippu', foot: 'kanaSound' },
  { line: 'exam', tag: 'exam', kind: 'paper', jp: '毎朝、駅まで＿＿歩きます。', cap: 'Part 3 · Q7', meaning: 'timer', foot: 'timedPaper' },
]
