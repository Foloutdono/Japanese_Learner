// ── 言葉 — the film's own words, in the app's two languages (plan 210) ──
// The defaults a script can leave out. The end card's lines are the
// landing page's approved copy (frontend/landing/strings.mjs), so the
// film and the page say the same thing.

export const STRINGS = {
  en: {
    name: 'Tsuji',
    tagline: 'Learn Japanese, from your first kana to JLPT N1.',
    cta: 'Free during early access',
    url: 'japanese-learner-seven.vercel.app',
    reading: 'Reading',
    stations: {
      analyzer: ['解析', 'Analyser'], reading: ['読書', 'Reading'], dictation: ['書取', 'Dictation'],
      translation: ['翻訳', 'Translation'], composition: ['作文', 'Composition'], comprehension: ['理解', 'Comprehension'],
      today: ['本日', 'Today'], review: ['復習', 'Review'], kana: ['かな', 'Kana'], vocab: ['単語', 'Vocabulary'],
      kanji: ['漢字', 'Kanji'], grammar: ['文法', 'Grammar'], exam: ['模試', 'Mock exam'], dictionary: ['辞書', 'Dictionary'],
      decks: ['教材', 'Decks'], pass: ['定期券', 'Your pass'], learn: ['路線図', 'Your lines'],
    },
  },
  fr: {
    name: 'Tsuji',
    tagline: 'Apprendre le japonais, du premier kana au JLPT N1.',
    cta: "Gratuit pendant l'accès anticipé",
    url: 'japanese-learner-seven.vercel.app',
    reading: 'Lecture',
    stations: {
      analyzer: ['解析', 'Analyseur'], reading: ['読書', 'Lecture'], dictation: ['書取', 'Dictée'],
      translation: ['翻訳', 'Traduction'], composition: ['作文', 'Composition'], comprehension: ['理解', 'Compréhension'],
      today: ['本日', "Aujourd'hui"], review: ['復習', 'Révisions'], kana: ['かな', 'Kana'], vocab: ['単語', 'Vocabulaire'],
      kanji: ['漢字', 'Kanji'], grammar: ['文法', 'Grammaire'], exam: ['模試', 'Examen blanc'], dictionary: ['辞書', 'Dictionnaire'],
      decks: ['教材', 'Decks'], pass: ['定期券', 'Ton pass'], learn: ['路線図', 'Tes lignes'],
    },
  },
}
