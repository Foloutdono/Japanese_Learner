// ── Liste centralisée des sections de l'app ────────────────
// Chaque section reçoit un pigment distinct de la palette partagée
// (index.css :root) plutôt qu'une couleur arbitraire, pour que les
// cartes de HomeScreen restent dans le même système de teintes que
// le reste de l'app.
export function getNavLinks(t) {
  return [
    { icon: '家',   title: t.homeTitle,       desc: t.homeDesc,       path: '/', color: 'var(--accent8)' },
    { icon: 'あ',   title: t.kanaTitle,       desc: t.kanaDesc,       path: '/kana',       color: 'var(--accent)'  },  // Shu-iro
    { icon: '単語', title: t.vocabTitle,      desc: t.vocabDesc,      path: '/vocab',      color: 'var(--accent4)' }, // Ai-iro
    { icon: '漢字', title: t.kanjiTitle,      desc: t.kanjiDesc,      path: '/kanji',      color: 'var(--accent3)' }, // Fuji-iro
    { icon: '文法', title: t.grammarTitle,    desc: t.grammarDesc,    path: '/grammar',    color: 'var(--success)' }, // Matcha
    { icon: '読書', title: t.readingTitle,    desc: t.readingDesc,    path: '/reading',    color: 'var(--accent6)' }, // Rokushou-iro
    { icon: '理解', title: t.readingComprehensionTitle, desc: t.readingComprehensionDesc, path: '/reading-comprehension', color: 'var(--accent7)' }, // Sabi-iro
    // Translation mode: given a phrase in the UI's foreign language,
    // type the Japanese translation; the deck's reference translation
    // plus an LLM analysis help you judge your own attempt. --accent9
    // was the one pigment in the shared palette no other card had
    // claimed yet.
    { icon: '翻訳', title: t.translationTitle || 'Translation', desc: t.translationDesc || 'Translate into Japanese', path: '/translation', color: 'var(--accent9)' }, // Kon-iro
    { icon: '解析', title: t.phraseAnalyzerTitle, desc: t.phraseAnalyzerDesc, path: '/phrase-analyzer', color: 'var(--danger)' }, // Enji-iro
    { icon: '辞書', title: t.dictionaryTitle, desc: t.dictionaryDesc, path: '/dictionary', color: 'var(--accent2)' }, // Yamabuki-iro
    { icon: '教材', title: t.decksTitle,      desc: t.decksDesc,      path: '/decks',      color: 'var(--warning)' }, // Kohaku
    // Past-paper mock exams (vocab/grammar/reading/listening, scored
    // against the official answer key) — see src/exam/. --accent5
    // (cha-iro) was the one pigment in the shared palette no other
    // card had claimed yet.
    { icon: '模試', title: t.examTitle || 'Mock Exam', desc: t.examDesc || 'Past JLPT papers, digitized', path: '/exam', color: 'var(--accent5)' }, // Cha-iro
  ]
}