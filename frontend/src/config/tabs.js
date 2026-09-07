// ── 改札口 — the five gates, and every section behind them ────
// The mobile chrome (plan 068) has one navigation: a tab bar with five
// gates, each a page of the app in walking order. Everything a learner
// can go to is a SECTION behind one of those gates — a line on the
// Learn map, a platform on Practice, the dictionary and its analyzer,
// the halls behind the pass, or today's run. This file is both lists:
// the tabs, and the section registry the tabs group.
//
// The registry used to be config/navLinks.js, keyed by `scope` for a
// home grid and a burger menu. Both retired with the chrome; the
// section entries themselves survive unchanged in meaning — an icon,
// a title, a description, a path, a line colour — because everything
// that draws a place (a wall-map line, a plate, a roundel, the gate
// cutscene, a ledger row) still asks this list for it.
//
// Each section keeps its line colour from the --line-* family
// (index.css :root), so a section keeps the same identity wherever
// it is rendered. That family exists for exactly this and nothing
// else — see the --line-* block in index.css for the reasoning.
//
// Paths are the mobile routes (App.jsx): a section lives UNDER its
// tab's root, so the tab bar can tell which gate is lit from the
// pathname alone. The old top-level paths (/kana, /decks, /exam …)
// redirect there; they were live and are bookmarked. `clip` names
// the section's announcement in public/sounds/announcements — the
// clips predate the routes and keep their names.

export const TAB_IDS = ['learn', 'practice', 'today', 'dictionary', 'profile']

/**
 * The five gates, in bar order. `jp` is the icon — the tab bar is the
 * one place a kanji stands in for a pictogram — and `label` is the
 * word in the learner's language.
 */
export function getTabs(t) {
  return [
    { id: 'learn',      jp: '学習',   path: '/learn',      label: t.tabLearn },
    { id: 'practice',   jp: '実践',   path: '/practice',   label: t.tabPractice },
    { id: 'today',      jp: '本日',   path: '/today',      label: t.tabToday },
    { id: 'dictionary', jp: '辞書',   path: '/dictionary', label: t.tabDictionary },
    { id: 'profile',    jp: '定期券', path: '/profile',    label: t.tabProfile },
  ]
}

/** Which gate a pathname is behind, or null (the dev routes). */
export function tabFor(pathname) {
  const root = '/' + (pathname.split('/')[1] ?? '')
  const id = root.slice(1)
  return TAB_IDS.includes(id) ? id : null
}

function sections(t) {
  return [
    // ── 学習 — the lines on the map ──
    { icon: 'あ',   title: t.kanaTitle,       desc: t.kanaDesc,       path: '/learn/kana',    clip: 'kana', color: 'var(--line-kana)',    tab: 'learn' },
    { icon: '単語', title: t.vocabTitle,      desc: t.vocabDesc,      path: '/learn/vocab',   clip: 'vocab', color: 'var(--line-vocab)',   tab: 'learn' },
    { icon: '漢字', title: t.kanjiTitle,      desc: t.kanjiDesc,      path: '/learn/kanji',   clip: 'kanji', color: 'var(--line-kanji)',   tab: 'learn' },
    { icon: '文法', title: t.grammarTitle,    desc: t.grammarDesc,    path: '/learn/grammar', clip: 'grammar', color: 'var(--line-grammar)', tab: 'learn' },
    { icon: '教材', title: t.decksTitle,      desc: t.decksDesc,      path: '/learn/decks',   clip: 'decks', color: 'var(--line-decks)',   tab: 'learn' },

    // ── 実践 — the four platforms ──
    { icon: '読書', title: t.readingTitle,    desc: t.readingDesc,    path: '/practice/reading',       clip: 'reading', color: 'var(--line-reading)', tab: 'practice' },
    { icon: '理解', title: t.readingComprehensionTitle, desc: t.readingComprehensionDesc, path: '/practice/comprehension', clip: 'reading-comprehension', color: 'var(--line-rikai)', tab: 'practice' },
    // Translation mode: given a phrase in the UI's foreign language,
    // type the Japanese translation; the deck's reference translation
    // plus an LLM analysis help you judge your own attempt.
    { icon: '翻訳', title: t.translationTitle || 'Translation', desc: t.translationDesc || 'Translate into Japanese', path: '/practice/translation', clip: 'translation', color: 'var(--line-honyaku)', tab: 'practice' },
    // Generated mock exams (vocab/grammar/reading/listening, built to
    // the official JLPT blueprint but never copied from a real past
    // paper) — see src/exam/.
    { icon: '模試', title: t.examTitle || 'Mock Exam', desc: t.examDesc || 'Practice exams built to the JLPT format', path: '/practice/exam', clip: 'exam', color: 'var(--line-exam)', tab: 'practice' },

    // ── 辞書 — the dictionary, and the analyzer behind its door ──
    { icon: '辞書', title: t.dictionaryTitle, desc: t.dictionaryDesc, path: '/dictionary',          clip: 'dictionary', color: 'var(--line-jisho)',   tab: 'dictionary' },
    // 解析 — one station, three platforms: typed text, a photo, a video's
    // subtitles. Was two board rows (/phrase-analyzer and /video) until
    // plan 027; they always produced the same thing — a Passage of
    // Sentences — and CONTEXT.md's own definition of Passage lists all
    // three sources as one act. See screens/AnalyzerScreen.jsx.
    { icon: '解析', title: t.analyzerTitle,   desc: t.analyzerDesc,   path: '/dictionary/analyzer', clip: 'analyzer', color: 'var(--line-kaiseki)', tab: 'dictionary' },

    // ── 定期券 — the halls behind the pass ──
    // 統計 — the numbers behind all of it, and the one section that
    // belongs to the learner rather than to the language: the profile
    // opens onto it from its ledger of records. Sakura-iro was the one
    // pigment nothing visible had claimed.
    { icon: '統計', title: t.statistics, desc: t.statsDesc, path: '/profile/stats', color: 'var(--accent8)', tab: 'profile' },

    // ── 本日 — the daily queue (see screens/TodayScreen) ──
    // --accent2 rather than a --line-* pigment: those eleven are all
    // claimed by lines and platforms, and gold is what the gate has
    // always been painted in.
    { icon: '本日', title: t.todayTitle, desc: t.todayDesc, path: '/today', color: 'var(--accent2)', tab: 'today' },
  ]
}

/** The sections behind one gate, in order. */
export function getSections(tabId, t) {
  return sections(t).filter(s => s.tab === tabId)
}

/** The halls behind the profile screen — today, the statistics alone. */
export function getProfileHalls(t) {
  return getSections('profile', t)
}

/**
 * Every section regardless of tab — for sectionFor() in
 * config/stations.js, the one consumer that needs to resolve a path
 * to its colour/title/icon whether or not that section is meant to be
 * BROWSED to.
 */
export function getAllSections(t) {
  return sections(t)
}

/**
 * A lane's line colour, keyed by what the lane IS rather than by a
 * route — 'kana'/'vocab'/'kanji'/'grammar' for a section lane,
 * 'personal' for anyone's own deck.
 *
 * The daily queue does not navigate to a section, so it cannot reach
 * these through sectionFor(); it needs the pigment for a lane row, a
 * filter chip and (since plan 060) the card being answered. It lives
 * HERE, beside the table it has to agree with.
 *
 * Values are `var(--line-*)` strings, not hex: they are written into
 * a CSS custom property, so they must stay late-bound and follow the
 * theme.
 */
export const LINE_COLOR = {
  kana:     'var(--line-kana)',
  vocab:    'var(--line-vocab)',
  kanji:    'var(--line-kanji)',
  grammar:  'var(--line-grammar)',
  personal: 'var(--line-decks)',
}
