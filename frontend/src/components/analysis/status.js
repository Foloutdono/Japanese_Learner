// Shared between every sentence-breakdown surface (phrase analyzer,
// reading practice, and — once they land — photo/video input). Moved
// here verbatim from PhraseAnalyzerScreen.jsx/ReadingScreen.jsx, where
// both screens defined byte-identical copies independently.
export const STATUS_COLORS = {
  mastered:     'var(--success)',
  learning:     'var(--accent2)',
  new:          'var(--warning)',
  not_started:  'var(--text-secondary)',
  due:          'var(--accent)',
}

// Best-effort color for a word in a phrase line: prefer its vocab
// status; if the word itself isn't in the deck but some of its kanji
// are, show an "accent3" hint color so partial knowledge is still
// visible at a glance.
export function wordColor(word) {
  if (word.vocab_match) return STATUS_COLORS[word.vocab_match.stats.status] || STATUS_COLORS.not_started
  if (word.kanji_matches?.length > 0) return 'var(--accent3)'
  return 'var(--text-secondary)'
}
