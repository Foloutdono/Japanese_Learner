// ── The app's section registry ─────────────────────────────
// One list, every section, each tagged with where it lives:
//
//   scope: 'home'     a card on the home grid, a row in the burger menu
//   scope: 'profile'  a hall on the profile screen — the places that are
//                     about *you* rather than about Japanese
//
// The split exists because the home grid was turning into a wall: it
// was carrying both "what do I want to study" and "what have I earned",
// and those are different questions asked at different moments. Home
// answers the first, the profile answers the second. Moving a section
// across is a one-word edit here — no screen hardcodes which sections
// it shows, they all ask for a scope.
//
// Each section gets a line colour from the --line-* family (index.css
// :root), so a section keeps the same identity wherever it's rendered
// — departure board row, station plate, card rail, burger row, profile
// hall, landing showcase.
//
// That family exists for exactly this and nothing else. These used to
// be picked from whatever was left over in the accent palette, which
// put three sections on the app's *state* colours: grammar was
// --success, decks were --warning, the analyser was --danger. Those
// mean correct / caution / wrong on the quiz screens a tap later. See
// the --line-* block in index.css for the rest of the reasoning.
function sections(t) {
  return [
    { icon: '家',   title: t.homeTitle,       desc: t.homeDesc,       path: '/', color: 'var(--accent8)', scope: 'home', showcase: false },
    { icon: 'あ',   title: t.kanaTitle,       desc: t.kanaDesc,       path: '/kana',       color: 'var(--line-kana)',    scope: 'home' },
    { icon: '単語', title: t.vocabTitle,      desc: t.vocabDesc,      path: '/vocab',      color: 'var(--line-vocab)',   scope: 'home' },
    { icon: '漢字', title: t.kanjiTitle,      desc: t.kanjiDesc,      path: '/kanji',      color: 'var(--line-kanji)',   scope: 'home' },
    { icon: '文法', title: t.grammarTitle,    desc: t.grammarDesc,    path: '/grammar',    color: 'var(--line-grammar)', scope: 'home' },
    { icon: '読書', title: t.readingTitle,    desc: t.readingDesc,    path: '/reading',    color: 'var(--line-reading)', scope: 'home' },
    { icon: '理解', title: t.readingComprehensionTitle, desc: t.readingComprehensionDesc, path: '/reading-comprehension', color: 'var(--line-rikai)', scope: 'home' },
    // Translation mode: given a phrase in the UI's foreign language,
    // type the Japanese translation; the deck's reference translation
    // plus an LLM analysis help you judge your own attempt.
    { icon: '翻訳', title: t.translationTitle || 'Translation', desc: t.translationDesc || 'Translate into Japanese', path: '/translation', color: 'var(--line-honyaku)', scope: 'home' },
    { icon: '解析', title: t.phraseAnalyzerTitle, desc: t.phraseAnalyzerDesc, path: '/phrase-analyzer', color: 'var(--line-kaiseki)', scope: 'home' },
    { icon: '辞書', title: t.dictionaryTitle, desc: t.dictionaryDesc, path: '/dictionary', color: 'var(--line-jisho)',   scope: 'home' },
    { icon: '教材', title: t.decksTitle,      desc: t.decksDesc,      path: '/decks',      color: 'var(--line-decks)',   scope: 'home' },
    // Past-paper mock exams (vocab/grammar/reading/listening, scored
    // against the official answer key) — see src/exam/.
    { icon: '模試', title: t.examTitle || 'Mock Exam', desc: t.examDesc || 'Past JLPT papers, digitized', path: '/exam', color: 'var(--line-exam)', scope: 'home' },

    // ── The halls ─────────────────────────────────────────
    // 達磨堂 — study goals as daruma dolls (see screens/DarumaScreen).
    // The one section that doesn't take a pigment from the shared
    // accent palette: it gets --daruma-aka, the doll's own lacquer red,
    // since that colour is the feature's entire identity.
    { icon: '達磨', title: t.darumaTitle, desc: t.darumaDesc, path: '/daruma', color: 'var(--daruma-aka)', scope: 'profile' },
    // 蔵 — mastery rank and the cosmetics earned along the way (see
    // screens/StorehouseScreen). Gold, because that is what the
    // storehouse is for.
    { icon: '蔵', title: t.storehouseTitle, desc: t.storehouseDesc, path: '/storehouse', color: 'var(--accent2)', scope: 'profile' },
    // 統計 — the numbers behind all of it. Sakura-iro was the one
    // pigment nothing visible had claimed (the '/' entry above owns it
    // on paper, but every consumer filters that entry out). `showcase:
    // false` keeps it off the landing page, where it has never been
    // advertised — a stats screen sells nobody on learning Japanese.
    { icon: '統計', title: t.statistics, desc: t.statsDesc, path: '/stats', color: 'var(--accent8)', scope: 'profile', showcase: false },
  ]
}

/** Home grid + burger menu. */
export function getNavLinks(t) {
  return sections(t).filter(s => s.scope === 'home')
}

/** The profile screen's halls, in the order they're shown there. */
export function getProfileHalls(t) {
  return sections(t).filter(s => s.scope === 'profile')
}

/** Everything worth advertising — the landing page's feature grid. */
export function getShowcase(t) {
  return sections(t).filter(s => s.showcase !== false)
}
