import { STATUS_COLORS, wordColor } from './status'
import { StatusBadge } from './StatusBadge'

// One Token's card: surface + reading + part of speech, its meaning
// (only present once the deep tier has been bought — see
// docs/adr/0001-two-tier-sentence-analysis.md, absent is normal, not an
// error), and any kanji it contains.
//
// Merged from PhraseAnalyzerScreen.jsx's WordCard (list layout) and
// ReadingScreen.jsx's BreakdownWordCard (stepper layout). The two had
// one real behavioral difference, not just a naming drift: the
// stepper's card omits the status pills to stay compact in a one-card-
// at-a-time carousel. `compact` preserves that distinction rather than
// silently changing either screen's look.
export function TokenCard({ word, t, compact = false, extraClassName = '', onWordClick, onKanjiClick }) {
  return (
    <div className={`card phrase-word-card${extraClassName ? ' ' + extraClassName : ''}`}>
      <div className="phrase-word-card__top">
        <div
          onClick={() => word.vocab_match && onWordClick(word)}
          className={`phrase-word-card__surface-wrap${word.vocab_match ? ' phrase-word-card__surface-wrap--clickable' : ''}`}
          title={word.vocab_match ? (t.clickForDetails) : undefined}
        >
          <span className="phrase-word-card__surface" style={{ '--word-color': wordColor(word) }}>
            {word.surface}
          </span>
          {word.reading && (
            <span className="phrase-word-card__reading">({word.reading})</span>
          )}
          {word.pos && (
            <span className="phrase-word-card__pos">
              {word.pos}
            </span>
          )}
        </div>
        {!compact && word.vocab_match && <StatusBadge status={word.vocab_match.stats.status} t={t} />}
      </div>

      <div className="phrase-word-card__meaning">{word.meaning}</div>

      {word.kanji_matches?.length > 0 && (
        <div className="phrase-word-card__kanji-row">
          {word.kanji_matches.map(k => (
            <div
              key={k.raw_id}
              onClick={() => onKanjiClick(k)}
              className="phrase-kanji-chip"
            >
              <span className="phrase-kanji-chip__char" style={{ '--word-color': STATUS_COLORS[k.stats.status] }}>
                {k.kanji}
              </span>
              <span className="phrase-kanji-chip__level">{k.level}</span>
              {!compact && <StatusBadge status={k.stats.status} small t={t} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
