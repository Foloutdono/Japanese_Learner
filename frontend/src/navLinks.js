// ── Liste centralisée des sections de l'app ────────────────
export function getNavLinks(t) {
  return [
    { icon: 'あ',   title: t.kanaTitle,       desc: t.kanaDesc,       path: '/kana',       color: '#EF476F' },
    { icon: '単語', title: t.vocabTitle,      desc: t.vocabDesc,      path: '/vocab',      color: '#118AB2' },
    { icon: '漢字', title: t.kanjiTitle,      desc: t.kanjiDesc,      path: '/kanji',      color: '#6D28D9' },
    { icon: '辞書', title: t.dictionaryTitle, desc: t.dictionaryDesc, path: '/dictionary', color: '#F59E0B' },
    { icon: '文法', title: t.grammarTitle,    desc: t.grammarDesc,    path: '/grammar',    color: '#10B981' },
    { icon: '読書', title: t.readingTitle,    desc: t.readingDesc,    path: '/reading',    color: '#EC4899' },
    { icon: '解析', title: t.phraseAnalyzerTitle, desc: t.phraseAnalyzerDesc, path: '/phrase-analyzer', color: '#F97316' },
    { icon: '統計', title: t.statsTitle,      desc: t.statsDesc,      path: '/stats',      color: '#14B8A6' },
    { icon: '教材', title: t.decksTitle,      desc: t.decksDesc,      path: '/decks',      color: '#3B82F6' },
    { icon: '理解', title: t.readingComprehensionTitle, desc: t.readingComprehensionDesc, path: '/reading-comprehension', color: '#8B5CF6' },
  ]
}