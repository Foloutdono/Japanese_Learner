import { rowsOf } from './rows'
import { tokState } from './tokens'

// ── 語 — the sentence's words, on the desk (plan 134) ─────────────
// The list under the video in the owner's drawing: one row per word the
// sentence is built from -- the particles and the endings stay on the
// subtitle, where they are read -- each with its reading, its gloss and
// its level. A row puts its word in focus (the card beside the list and
// the entry in the right column follow it); the word in focus is the
// row drawn on the ground with its edge.
export function WordsList({ analysis, current, onSelect, t }) {
  const rows = rowsOf(analysis?.tokens ?? analysis?.words ?? [])
    .filter(row => tokState(row.head) !== 'particle')
  return (
    <div className="anl-words">
      {rows.map((row, i) => {
        const head = row.head
        const entry = head.vocab_match?.entry
        const reading = entry?.kana && entry.kana !== row.surface ? entry.kana : ''
        const meaning = head.meaning ?? entry?.meaning ?? ''
        const level = head.vocab_match?.level ?? null
        const on = Boolean(current) && row.tokens.includes(current)
        return (
          <button
            key={i}
            type="button"
            className={`anl-words__row${on ? ' anl-words__row--on' : ''}`}
            onClick={() => onSelect(row)}
            aria-current={on || undefined}
            aria-label={[t.jumpToTokenNamed(row.surface), reading, meaning, level].filter(Boolean).join(' — ')}
          >
            {/* The column's width is the cell's; the rule under the word
                is the word's own width, as on the subtitle. */}
            <span className="anl-words__cell">
              <span className={`anl-words__word anl-words__word--${tokState(head)}`} lang="ja">{row.surface}</span>
            </span>
            <span className="anl-words__reading" lang="ja">{reading}</span>
            <span className="anl-words__gloss">{meaning}</span>
            {level && <span className="anl-words__lvl">{level}</span>}
          </button>
        )
      })}
    </div>
  )
}
