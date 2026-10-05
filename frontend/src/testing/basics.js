// 基礎 (plan 186g): the course as /api/basics and /api/basics/kazu answer
// it, for the station's tests.
const IDS = ['hajimemashite', 'kore-sore', 'kazu', 'masu', 'jikan', 'youbi', 'tsuki', 'iku', 'de-to', 'mashita',
  'arimasu', 'keiyoushi', 'sasou', 'suki']
const JP = ['はじめまして', 'これ・それ', '数', '〜ます', '時間', '曜日', '月と年', '行きます', 'で・と', '〜ました',
  'あります・います', '形容詞', '誘う', '好き']

export const BASICS = {
  riding: true,
  at: 3,
  done: false,
  units: IDS.map((id, i) => ({
    unit: i + 1,
    id,
    jp: JP[i],
    title: { en: `Unit ${i + 1}`, fr: `Leçon ${i + 1}` },
    kanji: [],
    points: i === 2 ? ['〜をください'] : [],
    total: 20,
    met: i < 2 ? 20 : i === 2 ? 6 : 0,
    learned: i < 2 ? 14 : i === 2 ? 2 : 0,
  })),
}

export const KAZU = {
  unit: 3,
  of: 14,
  id: 'kazu',
  jp: '数',
  title: { en: 'Numbers', fr: 'Les nombres' },
  total: 6,
  met: 2,
  learned: 1,
  grammar: [{ card_id: 'grammar_N5_〜をください', pattern: '〜をください', meaning: 'please give me', progress: 0.5, met: true }],
  vocab: [
    { card_id: 'vocab_N5_一_いち', kanji: '一', kana: 'いち', meaning: 'one', progress: 0.2, met: true },
    { card_id: 'vocab_N5_円_えん', kanji: '円', kana: 'えん', meaning: 'yen', progress: 0, met: false },
    { card_id: 'vocab_N5__いくら', kanji: '', kana: 'いくら', meaning: 'how much', progress: 0, met: false },
  ],
  kanji: [{ card_id: 'kanji_N5_一', kanji: '一', meaning: 'one', progress: 0, met: false }],
  sentences: [{ jp: 'りんごを一つください。', translation: null }],
}
