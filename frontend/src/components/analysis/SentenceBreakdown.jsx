import { useState } from 'react'
import { CardTransition } from '../study/CardTransition'
import { FuriganaParts } from '../study/Readings'
import { STATUS_COLORS, wordColor } from './status'
import { TokenCard } from './TokenCard'
import { GrammarChips } from './GrammarChips'
import { LevelBadge } from './LevelBadge'
import { SpeakButton } from './SpeakButton'
import { StatusBadge } from './StatusBadge'
import { DeckPicker } from './DeckPicker'

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

// The class the analyser's smart-furigana rule keys on: a word the SRS
// says the learner has MASTERED is the one whose reading they have
// earned the right to lose. Everything else -- new, learning, due, or
// simply not in the deck -- keeps its ruby in 'unknown' mode, because
// "I've met it" is not "I can read it". Carries no styles of its own;
// only .anl-stage[data-furigana] selectors read it, so the reading
// screen sharing this component is unaffected.
function knownClass(tok) {
  return tok.vocab_match?.stats?.status === 'mastered' ? ' word-span--known' : ''
}

// The mockup's two underline states, and only those two. A word being
// learned (or due back) runs in the translucent ember, a word never
// started in the line's own grape at full strength; mastered words and
// unmatched tokens (particles, punctuation) carry no rule at all. The
// old mapping painted every status through --word-color, which put a
// GREY rule under every not-yet-started word — most of any real
// sentence — and made the line read as a diagnostic instead of a
// sentence.
function underlineClass(tok) {
  const status = tok.vocab_match?.stats?.status
  if (!status || status === 'mastered') return ''
  if (status === 'learning' || status === 'due') return ' anl-sentence__tk--learning'
  return ' anl-sentence__tk--new'
}

// ── The token table (the mockup's second view) ────────────
// Word | Reading | Meaning | State | ＋ — one row per Token, dense on
// purpose: the table exists for scanning a whole Sentence at once.
// The mine cell is the mockup's ＋/✓: one press adds the word to the
// remembered deck (the same act the card's own control performs),
// opening the picker only when there is no remembered target yet.
function TableMine({ word, mining, t }) {
  const [added, setAdded] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  if (!mining || !word.vocab_match) return <span />

  async function mine(deckId) {
    setShowPicker(false)
    try {
      await mining.mineApp({
        deckId, source: 'vocab', level: word.vocab_match.level,
        rawId: word.vocab_match.raw_id, kind: 'vocab',
      })
      setAdded(true)
    } catch { /* mining.lastOutcome carries the failure to the announcer */ }
  }

  return (
    <>
      <button
        type="button"
        className={`anl-trow__mine${added ? ' anl-trow__mine--done' : ''}`}
        title={t.addToDeck}
        aria-label={`${t.addToDeck} — ${word.surface}`}
        onClick={() => {
          const target = mining.targetFor('vocab')
          if (target) mine(target.id)
          else setShowPicker(true)
        }}
      >
        {added ? '✓' : '＋'}
      </button>
      {showPicker && (
        <DeckPicker
          decks={mining.decksFor('vocab')}
          currentId={mining.targetFor('vocab')?.id ?? null}
          t={t}
          onClose={() => setShowPicker(false)}
          onSelect={mine}
          onCreate={async name => { mine((await mining.ensureDeck('vocab', name)).id) }}
        />
      )}
    </>
  )
}

function TokenTable({ tokens, t, mining, onJumpToToken }) {
  return (
    <div className="anl-toktable">
      <div className="anl-toktable__scroll">
        <div className="anl-trow anl-trow--head" aria-hidden="true">
          <span>{t.tableWord}</span>
          <span>{t.reading}</span>
          <span>{t.meaning}</span>
          <span>{t.tableState}</span>
          <span />
        </div>
        {tokens.map((w, i) => (
          <div key={i} className="anl-trow">
            <button
              type="button"
              className="anl-trow__surface"
              lang="ja"
              onClick={() => onJumpToToken(i)}
              aria-label={t.jumpToTokenNamed(w.surface)}
            >
              {w.surface}
            </button>
            <span className="anl-trow__reading" lang="ja">{w.reading}</span>
            <span className="anl-trow__meaning">{w.meaning}</span>
            <span className="anl-trow__state">
              {w.vocab_match && <StatusBadge status={w.vocab_match.stats.status} small t={t} />}
            </span>
            <TableMine word={w} mining={mining} t={t} />
          </div>
        ))}
      </div>
    </div>
  )
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

// The sentence breakdown, in one of three layouts:
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
//   'stage'   — the analyser's control-room shape (the mockup round):
//               the sentence as its own surface panel where status is
//               an UNDERLINE rather than an ink colour, then the
//               caller's `controls` (the view/furigana dials), then
//               the same carousel with the card grown to the stage.
//               Lives here beside its siblings so the three shapes
//               share TokenCard, FuriganaParts and the badges instead
//               of a fourth near-copy drifting off on its own.
//
// `index`/`setIndex` are used by 'stepper'/'stage' and are owned by
// the caller (see ReadingScreen.jsx) so they can be reset to 0
// whenever a new phrase is shown. `controls`, `tokenView` and
// `onJumpToToken` are only read by 'stage': tokenView chooses between
// the carousel and the mockup's token table, and onJumpToToken is what
// a table row's surface does (focus that token AND switch back to the
// stepper — the mockup's own behaviour).
export function SentenceBreakdown({
  analysis, t, layout = 'list', index = 0, setIndex, onTokenClick, onKanjiClick, mining,
  speakable = false, controls = null, tokenView = 'stepper', onJumpToToken,
}) {
  const tokens = analysis.tokens ?? analysis.words ?? []

  if (layout === 'stage') {
    // Same both-ways clamp as the stepper below, same reason: a
    // Sentence can legitimately have no tokens, and that must render
    // as "nothing to step through", not a white screen.
    const current = tokens.length ? tokens[Math.min(index, tokens.length - 1)] : null
    const canPrev = index > 0
    const canNext = index < tokens.length - 1

    return (
      <div className="rdg-breakdown anl-stagebd">
        {/* ── The sentence pane ──
            The mockup's rule, taken literally: the pane holds the
            SENTENCE and nothing else — no badge row, no speaker, no
            grammar chips, no explanation (that text lives with the
            Explain control). Ink stays primary and the SRS speaks
            through a 2px underline on exactly the words still being
            learned — see underlineClass above. */}
        <div className="anl-sentence">
          <p className="phrase-line rdg-breakdown-line anl-sentence__jp">
            {tokens.map((w, i) => (
              // Deliberately NOT word-span/rdg-breakdown-line__word:
              // those bases colour the ink by status and chip the
              // hover in sumi, which is the stepper's diagnostic
              // look. The sentence pane reads as a SENTENCE — its
              // own classes, fully styled in the anl block.
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={
                  `anl-sentence__tk${i === index ? ' anl-sentence__tk--focus' : ''}`
                  + underlineClass(w) + knownClass(w)
                }
                aria-label={t.jumpToTokenNamed(w.surface)}
                aria-pressed={i === index}
                lang="ja"
              >
                <FuriganaParts parts={w.furigana ?? [{ text: w.surface }]} />
              </button>
            ))}
          </p>
        </div>

        {controls}

        {tokenView === 'table' ? (
          <TokenTable
            tokens={tokens}
            t={t}
            mining={mining}
            onJumpToToken={onJumpToToken ?? setIndex}
          />
        ) : (
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
            {current && <TokenCard
              word={current}
              t={t}
              extraClassName="rdg-breakdown-card"
              onWordClick={onTokenClick}
              onKanjiClick={onKanjiClick}
              mining={mining}
              sentenceText={analysis.text}
              // The pane above already offers the sentence aloud; a
              // second speaker inside the card was one control too
              // many on the mockup's clean card.
              speakable={false}
              // Mockup chips: a glyph and its grade, nothing stuffed
              // inside. The kanji's own badges and mine control live
              // in the WordDetail the chip opens.
              stage
              emphasize={analysis.unknown_count === 1 && isUnknownToken(current)}
            />}
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
        )}

        {/* Where you are along the Tokens, as the mockup draws it:
            dots, not a fraction. Redundant with the arrows and the
            jump-to-word line (both fully accessible), so the dots
            themselves stay out of the tab order. */}
        {tokenView !== 'table' && tokens.length > 1 && (
          <div className="anl-stagebd__dots" aria-hidden="true">
            {tokens.map((_, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                className={`anl-stagebd__dot${i === index ? ' anl-stagebd__dot--on' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (layout === 'stepper') {
    // Clamped BOTH ways. With no tokens at all, `tokens.length - 1` is
    // -1 and Math.min hands back tokens[-1] === undefined, which TokenCard
    // then dereferences and takes the whole screen down with it. A
    // Sentence can legitimately have no tokens (an unavailable analysis,
    // a line of pure punctuation), and that must render as "nothing to
    // step through", not as a white screen. Same failure class as the
    // 202 crash in plans/README.md: a stale/out-of-range index read.
    const current = tokens.length ? tokens[Math.min(index, tokens.length - 1)] : null
    const canPrev = index > 0
    const canNext = index < tokens.length - 1

    return (
      <div className="rdg-breakdown">
        <div className="phrase-line rdg-breakdown-line">
          {tokens.map((w, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`word-span rdg-breakdown-line__word${i === index ? ' rdg-breakdown-line__word--active' : ''}${knownClass(w)}`}
              style={{ '--word-color': wordColor(w) }}
              // The line doubles as a jump-to-Token index, so each entry
              // says WHICH Token it goes to rather than repeating one
              // generic tooltip N times.
              aria-label={t.jumpToTokenNamed(w.surface)}
              // The pressed one is the Token on the stage. aria-pressed,
              // not aria-current: these are toggles into a single
              // selection, not steps along a route -- the route is
              // PassageLine, one level up.
              aria-pressed={i === index}
              lang="ja"
            >
              <FuriganaParts parts={w.furigana ?? [{ text: w.surface }]} />
            </button>
          ))}
        </div>

        <div className="rdg-breakdown-badges">
          <LevelBadge
            level={analysis.level}
            unknownCount={analysis.unknown_count}
            offDeckCount={analysis.off_deck_count}
            t={t}
          />
          {speakable && (
            <SpeakButton text={analysis.text} label={t.hearSentence} size="md" t={t} />
          )}
        </div>
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
            {current && <TokenCard
              word={current}
              t={t}
              compact
              extraClassName="rdg-breakdown-card"
              onWordClick={onTokenClick}
              onKanjiClick={onKanjiClick}
              mining={mining}
              sentenceText={analysis.text}
              speakable={speakable}
            />}
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

        {tokens.length > 0 && (
          <div className="rdg-breakdown-counter">
            {index + 1} / {tokens.length}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="card phrase-result-card">
        <div className="phrase-line">
          {tokens.map((w, i) => (w.vocab_match ? (
            <button
              key={i}
              type="button"
              onClick={() => onTokenClick(w)}
              className={`word-span word-span--clickable${knownClass(w)}`}
              style={{ '--word-color': wordColor(w) }}
              aria-label={t.detailsForToken(w.surface)}
              lang="ja"
            >
              <FuriganaParts parts={w.furigana ?? [{ text: w.surface }]} />
            </button>
          ) : (
            <span key={i} className={`word-span${knownClass(w)}`} style={{ '--word-color': wordColor(w) }} lang="ja">
              <FuriganaParts parts={w.furigana ?? [{ text: w.surface }]} />
            </span>
          )))}
        </div>
        <div className="rdg-breakdown-badges">
          <LevelBadge
            level={analysis.level}
            unknownCount={analysis.unknown_count}
            offDeckCount={analysis.off_deck_count}
            t={t}
          />
          {speakable && (
            <SpeakButton text={analysis.text} label={t.hearSentence} size="md" t={t} />
          )}
        </div>
        <GrammarChips grammar={analysis.grammar} t={t} mining={mining} />
        <div className="phrase-explanation">
          {analysis.explanation}
        </div>
      </div>

      {/* The same slot the 'stage' layout fills — without it the view
          dial that SWITCHED here would vanish with the switch, a
          control that removes itself on use. */}
      {controls}

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
