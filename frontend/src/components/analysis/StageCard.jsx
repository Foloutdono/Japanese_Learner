import { FuriganaParts } from '../study/Readings'
import { MineButton } from './MineButton'

// Content-word POS classes -- matches study/analysis.py's _CONTENT_POS,
// so the "can't add, not in the app deck" control shows up on exactly
// the words unknown_count/off_deck_count already treat as vocabulary,
// not on every particle and symbol.
const CONTENT_POS = new Set(['noun', 'verb', 'adjective', 'adverb'])

// ── The token card (canvas AnalyzerResult, plan 073) ─────────
// The Token on the stage: its surface with the reading as ruby, the
// reading beside it, the part of speech as a caption pill; the gloss
// (the deep tier's contextual one once bought, the dictionary's own
// otherwise — the learner shouldn't need to buy an explanation to
// know what 電車 means); then the kanji it contains as squares that
// open their entries, and the one deck action.
//
// `emphasize` marks the single unknown Token of an i+1 Sentence (see
// SentenceBreakdown's isUnknownToken) -- that one word is the entire
// reason the Sentence is worth studying, so it says so.
export function StageCard({ word, t, onWordClick, onKanjiClick, mining, emphasize = false }) {
  const gloss = word.meaning ?? word.vocab_match?.entry?.meaning
  const showMine = word.vocab_match || CONTENT_POS.has(word.pos)
  const surface = <FuriganaParts parts={word.furigana ?? [{ text: word.surface }]} />

  return (
    <div className={`token-card${emphasize ? ' token-card--i1' : ''}`}>
      <div className="token-card__head">
        {word.vocab_match ? (
          <button
            type="button"
            className="token-card__surface token-card__surface--door"
            lang="ja"
            onClick={() => onWordClick(word)}
            aria-label={t.detailsForToken(word.surface)}
          >
            {surface}
          </button>
        ) : (
          <span className="token-card__surface" lang="ja">{surface}</span>
        )}
        {word.reading && <span className="token-card__reading" lang="ja">{word.reading}</span>}
        {word.pos && <span className="type-badge token-card__pos">{word.pos}</span>}
      </div>

      {gloss && <span className="token-card__gloss">{gloss}</span>}
      {emphasize && <span className="token-card__i1">{t.iPlusOne}</span>}

      <div className="token-card__foot">
        <span className="token-card__kanji">
          {(word.kanji_matches ?? []).map(k => (
            // The whole square is the control — its full surface
            // clicks, and the grade and the record wait in the entry
            // it opens.
            <button
              key={k.raw_id}
              type="button"
              className="token-card__k"
              lang="ja"
              onClick={() => onKanjiClick(k)}
              aria-label={t.detailsForKanji(k.kanji)}
              title={k.entry?.meaning ?? k.level}
            >
              {k.kanji}
            </button>
          ))}
        </span>
        {showMine && (
          <MineButton
            mining={mining}
            kind="vocab"
            disabled={!word.vocab_match}
            disabledReason={t.cannotMineOffDeck}
            label={t.addToDeck}
            className="btn-primary"
            onMine={word.vocab_match ? deckId => mining.mineApp({
              deckId, source: 'vocab', level: word.vocab_match.level,
              rawId: word.vocab_match.raw_id, kind: 'vocab',
            }) : undefined}
            t={t}
          />
        )}
      </div>
    </div>
  )
}
