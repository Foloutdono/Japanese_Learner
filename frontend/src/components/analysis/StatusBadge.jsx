import { STATUS_COLORS } from './status'

// Merged from two copies that had already diverged: ReadingScreen.jsx's
// translated the label via t.status_*, PhraseAnalyzerScreen.jsx's used
// a hardcoded English STATUS_LABELS table instead — so a French learner
// saw "Mastered" on one screen and "Maîtrisé" on the other, for the
// same status. This is the fix: always translated, with the analyzer's
// `small` variant (used on kanji chips) kept.
export function StatusBadge({ status, small, t }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started
  const label = (t && t[`status_${status}`]) || status
  return (
    <span className={`status-pill${small ? ' status-pill--sm' : ''}`} style={{ '--pill-color': color }}>
      {label}
    </span>
  )
}
