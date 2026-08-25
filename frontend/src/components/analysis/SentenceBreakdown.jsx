import { CardTransition } from '../study/CardTransition'
import { FuriganaParts } from '../study/Readings'
import { STATUS_COLORS, wordColor } from './status'
import { TokenCard } from './TokenCard'
import { GrammarChips } from './GrammarChips'
import { LevelBadge } from './LevelBadge'

// Real stroke-based chevron rather than `‹`/`›` text glyphs, whose
// optical centering varies by font/OS. `display: block` avoids the few
// px of inline descender space an <svg> gets by default, so it sits
// dead-center in the round nav button regardless.
function ChevronIcon({ direction = 'left' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {direction === 'left'
        ? <polyline points="15 5 8 12 15 19" />
        : <polyline points="9 5 16 12 9 19" />}
    </svg>
  )
}

// Mirrors study/analysis.py's _CONTENT_POS + unknown_count predicate
// exactly, so "the single unknown Token" identified here for i+1
// emphasis is provably the same one the backend counted.
const CONTENT_POS = new Set(['noun', 'verb', 'adjective', 'adverb'])
function isUnknownToken(tok) {
  return CONTENT_POS.has(tok.pos)
    && tok.vocab_match
    && ['not_started', 'new'].includes(tok.vocab_match.stats?.status)
}

export function Legend({ t }) {
  return (
    <div className="status-legend">
      {Object.keys(STATUS_COLORS).map(status => (
        <span key={status} className="status-legend__item">
          <span className="status-legend__dot" style={{ '--dot-color': STATUS_COLORS[status] }} />
          {(t && t[`status_${status}`]) || status}
        </span>
      ))}
    </div>
  )
}

// The sentence breakdown, in one of two layouts:
//
//   'list'    — every Token as a scrolling list of cards (the phrase
//               analyzer's shape): a colour-coded phrase line up top,
//               the explanation, a status legend, then one TokenCard
//               per Token.
//   'stepper' — one Token at a time in a carousel (reading practice's
//               shape): the same colour-coded phrase line doubles as a
//               jump-to-word index, prev/next arrows step through
//               Tokens, no legend (reading practice's own screen
//               explains status colour elsewhere).
//
// `index`/`setIndex` are only used by 'stepper' and are owned by the
// caller (see ReadingScreen.jsx) so they can be reset to 0 whenever a
// new phrase is shown.
export function SentenceBreakdown({
  analysis, t, layout = 'list', index = 0, setIndex, onTokenClick, onKanjiClick, mining,
}) {
  const tokens = analysis.tokens ?? analysis.words ?? []

  if (layout === 'stepper') {
    const current = tokens[Math.min(index, tokens.length - 1)]
    const canPrev = index > 0
    const canNext = index < tokens.length - 1

    return (
      <div className="rdg-breakdown">
        <div className="phrase-line rdg-breakdown-line">
          {tokens.map((w, i) => (
            <span
              key={i}
              onClick={() => setIndex(i)}
              className={`word-span rdg-breakdown-line__word${i === index ? ' rdg-breakdown-line__word--active' : ''}`}
              style={{ '--word-color': wordColor(w) }}
              title={t.jumpToWord ?? 'Jump to this word'}
              lang="ja"
            >
              <FuriganaParts parts={w.furigana ?? [{ text: w.surface }]} />
            </span>
          ))}
        </div>

        <LevelBadge
          level={analysis.level}
          unknownCount={analysis.unknown_count}
          offDeckCount={analysis.off_deck_count}
          t={t}
        />
        <GrammarChips grammar={analysis.grammar} t={t} mining={mining} />

        {analysis.explanation && (
          <div className="phrase-explanation rdg-breakdown-explanation">
            {analysis.explanation}
          </div>
        )}

        <div className="rdg-breakdown-card-row">
          <button
            onClick={() => setIndex(i => Math.max(0, i - 1))}
            disabled={!canPrev}
            className="rdg-breakdown-nav rdg-breakdown-nav--prev"
            aria-label={t.previousWord ?? 'Previous word'}
          >
            <ChevronIcon direction="left" />
          </button>

          <CardTransition cardKey={index} className="rdg-breakdown-card-stage">
            <TokenCard
              word={current}
              t={t}
              compact
              extraClassName="rdg-breakdown-card"
              onWordClick={onTokenClick}
              onKanjiClick={onKanjiClick}
              mining={mining}
              sentenceText={analysis.text}
            />
          </CardTransition>

          <button
            onClick={() => setIndex(i => Math.min(tokens.length - 1, i + 1))}
            disabled={!canNext}
            className="rdg-breakdown-nav rdg-breakdown-nav--next"
            aria-label={t.nextWord ?? 'Next word'}
          >
            <ChevronIcon direction="right" />
          </button>
        </div>

        <div className="rdg-breakdown-counter">
          {index + 1} / {tokens.length}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="card phrase-result-card">
        <div className="phrase-line">
          {tokens.map((w, i) => (
            <span
              key={i}
              onClick={() => onTokenClick(w)}
              className={`word-span${w.vocab_match ? ' word-span--clickable' : ''}`}
              style={{ '--word-color': wordColor(w) }}
              title={w.vocab_match ? (t.clickForDetails) : undefined}
              lang="ja"
            >
              <FuriganaParts parts={w.furigana ?? [{ text: w.surface }]} />
            </span>
          ))}
        </div>
        <LevelBadge
          level={analysis.level}
          unknownCount={analysis.unknown_count}
          offDeckCount={analysis.off_deck_count}
          t={t}
        />
        <GrammarChips grammar={analysis.grammar} t={t} mining={mining} />
        <div className="phrase-explanation">
          {analysis.explanation}
        </div>
      </div>

      <Legend t={t} />

      <div className="phrase-words-list">
        {tokens.map((w, i) => (
          <TokenCard
            key={i}
            word={w}
            t={t}
            onWordClick={onTokenClick}
            onKanjiClick={onKanjiClick}
            mining={mining}
            sentenceText={analysis.text}
            // i+1 (docs/adr/0001, CONTEXT.md): a Sentence with exactly
            // one unknown Token is the single highest-value thing to
            // study, so ITS mine control is emphasized -- that word is
            // the entire reason this Sentence is worth keeping.
            emphasize={analysis.unknown_count === 1 && isUnknownToken(w)}
          />
        ))}
      </div>
    </>
  )
}
