import { useLang } from '../../LangContext'
import { wordRowsOf } from './rows'
import { tokState, wordGloss } from './tokens'

// ── 語 — the sentence's words, on the desk (plan 134) ─────────────
// The list under the video in the owner's drawing: one row per word the
// sentence is built from -- the particles and the endings stay on the
// subtitle, where they are read -- each with its reading, its gloss and
// its level. A row puts its word in focus (the card beside the list and
// the entry in the right column follow it); the word in focus is the
// row drawn on the ground with its edge.
//
// The rows are the practice breakdown's (rows.js's wordRowsOf, plan
// 160): no word a construction is written on with no card of its own
// (〜てはいけません's いけません read "to go"), each word named as the
// dictionary names it -- 話す beside its reading はなす, where the list
// printed 話し beside はなす -- and glossed in the learner's language.
//
// `action` (plan 161): what the word in focus can be done with, drawn
// beside its row -- a typed or photographed passage has no card in
// focus beside the list, so the deck's one filled action rides the row.
// The row stays the one button; the action is its neighbour, on the
// same ground, and falls under it where the column is narrow.
export function WordsList({ analysis, current, onSelect, t, action = null }) {
  const lang = useLang()?.lang
  const rows = wordRowsOf(analysis)
  return (
    <div className="anl-words">
      {rows.map((row, i) => {
        const head = row.head
        const entry = head.vocab_match?.entry
        const name = entry ? (entry.kanji || entry.kana || row.surface) : row.surface
        const reading = entry?.kana && entry.kana !== name ? entry.kana : ''
        const meaning = wordGloss(head, lang)
        const level = head.vocab_match?.level ?? null
        const on = Boolean(current) && row.tokens.includes(current)
        const button = (
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
              <span className={`anl-words__word anl-words__word--${tokState(head)}`} lang="ja">{name}</span>
            </span>
            <span className="anl-words__reading" lang="ja">{reading}</span>
            <span className="anl-words__gloss">{meaning}</span>
            {level && <span className="anl-words__lvl">{level}</span>}
          </button>
        )
        return on && action
          ? (
            <div key={i} className="anl-words__item">
              {button}
              <span className="anl-words__act">{action}</span>
            </div>
          )
          : button
      })}
    </div>
  )
}
