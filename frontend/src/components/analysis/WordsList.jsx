import { useLang } from '../../LangContext'
import { rowName, wordRowsOf, wordTileRows } from './rows'
import { tokState, wordGloss } from './tokens'
import { ChevronIcon } from '../ui/Icons'

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
        const { name, reading } = rowName(row)
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

// ── 畳 — the words folded to one line (plan 235, the owner's pick C) ──
// The canvas "Tsuji analyser — text desk stage": on the desk, a typed
// Passage of several sentences gives its words list's height back to
// the sumi, so the sentence, its translation and Explain stand whole on
// the stage. The list folds to one line under it -- its name, how many
// words, the words themselves on chips, each with its state's rule and
// the one in focus edged in ink -- and the line is the one button that
// opens the list, as the phone's dock opens its own.
export function WordsFold({ analysis, current, onOpen, open = false, t }) {
  const rows = wordRowsOf(analysis)
  if (!rows.length) return null
  return (
    <button
      type="button"
      className="anl-fold"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`${t.wordsInSentence} (${rows.length})`}
    >
      <span className="anl-fold__cap" aria-hidden="true">
        {t.wordsFoldCap}
        <span className="anl-fold__n">{rows.length}</span>
      </span>
      <span className="anl-fold__words" aria-hidden="true">
        {rows.map((row, i) => {
          const on = Boolean(current) && row.tokens.includes(current)
          return (
            <span key={i} className={`anl-fold__chip${on ? ' anl-fold__chip--on' : ''}`}>
              <span className={`anl-words__word anl-words__word--${tokState(row.head)}`} lang="ja">{rowName(row).name}</span>
            </span>
          )
        })}
      </span>
      <ChevronIcon direction="up" size={18} />
    </button>
  )
}

// ── 札 — the sentence's words on a phone (plan 220, the owner's W2) ──
// The dock's Words sheet: a card per word, two to a row -- its level in
// the corner, its reading over it, the word large, its gloss under it,
// and its state as the bar along the card's foot (the subtitle's rule,
// laid flat). A card opens the word's dictionary entry (`onSelect`).
// Only the words written in Japanese (rows.js's wordTileRows).
export function WordTiles({ analysis, onSelect, t }) {
  const lang = useLang()?.lang
  const rows = wordTileRows(analysis)
  return (
    <div className="anl-tiles">
      {rows.map((row, i) => {
        const head = row.head
        const { name, reading } = rowName(row)
        const meaning = wordGloss(head, lang)
        const level = head.vocab_match?.level ?? null
        return (
          <button
            key={i}
            type="button"
            className="anl-tile"
            onClick={() => onSelect(row)}
            aria-label={[t.jumpToTokenNamed(row.surface), reading, meaning, level].filter(Boolean).join(' — ')}
          >
            {level && <span className="anl-tile__lvl" aria-hidden="true">{level}</span>}
            <span className="anl-tile__reading" lang="ja" aria-hidden="true">{reading}</span>
            <span className="anl-tile__word" lang="ja" aria-hidden="true">{name}</span>
            {meaning && <span className="anl-tile__gloss" aria-hidden="true">{meaning}</span>}
            <span className={`anl-tile__state anl-tile__state--${tokState(head)}`} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
