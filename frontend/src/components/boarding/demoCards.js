// ── The rolling stock on the Welcome screen (plan 075) ───────────
// Two lanes of cards roll past like trains: each card is one thing the
// app does, in its line's pigment. The Japanese is content and lives
// here; the tag, the meaning and the foot are the interface's and are
// keys into the locale's brdDemo* tables. `kind` picks the face: a
// glyph, a sentence (a run lit in the middle), a stroke drawing
// itself, sound bars breathing, a paper's line with its caption, or a
// prompt in the learner's own language (a key into brdDemoPrompt).
//
// Every card is an exercise the app really serves, under the line it
// is served on (config/tabs.js) and in the words of its mode
// (backend study/modes.py): the flashcard both ways, the kanji drawn
// from its meaning, the readings typed, the rule named in a sentence
// left intact (grammar.fill_in), the word's reading (vocab.word_reading),
// a kana to its romaji, and the practice platforms -- 読書 reading, 書取
// dictation (hear it, write it), 翻訳 translation (the learner's language
// into Japanese), 解析 the analyzer, and the timed 模試 paper. There is
// no "listening" line: what the app does with sound is dictation.
export const FRONT_LANE = [
  { line: 'kanji', tag: 'kanji', kind: 'glyph', jp: '駅', meaning: 'station', foot: 'kanjiMeaning' },
  { line: 'vocab', tag: 'vocab', kind: 'glyph', jp: '食べる', meaning: 'toEat', foot: 'wordMeaning' },
  { line: 'grammar', tag: 'grammar', kind: 'sentence', jp: ['雨が降り', 'そう', 'です。'], meaning: 'whichRule', foot: 'sentenceRule' },
  { line: 'kanji', tag: 'kanji', kind: 'draw', meaning: 'craft', foot: 'meaningKanji' },
  { line: 'kakitori', tag: 'dictation', kind: 'wave', meaning: 'writeIt', foot: 'soundText' },
  { line: 'reading', tag: 'reading', kind: 'sentence', jp: ['駅で友達を待っています。'], meaning: 'readIt', foot: 'sentenceMeaning' },
]

export const BACK_LANE = [
  { line: 'vocab', tag: 'vocab', kind: 'glyph', jp: '切符', meaning: 'kippu', foot: 'wordReading' },
  { line: 'kana', tag: 'kana', kind: 'glyph', jp: 'き', meaning: 'ki', foot: 'kanaRomaji' },
  { line: 'honyaku', tag: 'translation', kind: 'prompt', prompt: 'waiting', meaning: 'sayIt', foot: 'meaningSentence' },
  { line: 'kanji', tag: 'kanji', kind: 'glyph', jp: '山', meaning: 'yama', foot: 'kanjiReadings' },
  { line: 'kaiseki', tag: 'analyzer', kind: 'sentence', jp: ['明日は', '雨が降ると', '思う。'], meaning: 'breakItDown', foot: 'sentenceGrammar' },
  { line: 'exam', tag: 'exam', kind: 'paper', jp: '毎朝、駅まで＿＿歩きます。', cap: 'Part 3 · Q7', meaning: 'timer', foot: 'timedPaper' },
]

// 机 (plan 154): the desk's one lane, the two lanes' cards taken in
// turn, so a single band still shows every line the app rides.
export const DESK_LANE = FRONT_LANE.flatMap((card, i) => [card, BACK_LANE[i]])
