import { STATUS_COLORS, wordColor } from './status'
import { StatusBadge } from './StatusBadge'
import { MineButton } from './MineButton'
import { MineControls } from './MineControls'
import { buildCloze } from './useMining'
import { SpeakButton } from './SpeakButton'
import { FuriganaParts } from '../study/Readings'

// Content-word POS classes -- matches study/analysis.py's _CONTENT_POS,
// so the "can't mine, not in the app deck" control shows up on exactly
// the words unknown_count/off_deck_count already treat as vocabulary,
// not on every particle and symbol.
const CONTENT_POS = new Set(['noun', 'verb', 'adjective', 'adverb'])

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
//
// `mining` (a useMining(session) instance, see plan 017) is optional --
// undefined for callers that don't offer it, in which case MineButton
// renders nothing. ReadingScreen.jsx deliberately never passes one.
// `sentenceText` is the Sentence's own full text -- needed (alongside
// mining) to build a cloze card; also absent for ReadingScreen.jsx.
// `emphasize` marks the single unknown Token of an i+1 Sentence (see
// SentenceBreakdown's isUnknownToken) -- that one word is the entire
// reason the Sentence is worth studying, so its mine control stands out.
// `stage` marks the analyser's grown card (the mockup round): its
// kanji chips hold the glyph and its grade ONLY — the status badge and
// the mine control that the list layout stuffs into each chip live in
// the WordDetail the chip opens instead.
export function TokenCard({
  word, t, compact = false, extraClassName = '', onWordClick, onKanjiClick, mining, sentenceText, emphasize = false,
  speakable = false, stage = false,
}) {
  const showVocabMine = word.vocab_match || CONTENT_POS.has(word.pos)

  // Written once, rendered from either branch below (a real <button>
  // when the Token has a vocab_match to open, a plain <div> when there
  // is nothing to open) so the two never drift apart. The stage card
  // leaves the POS out of the surface block (the mockup sets it on the
  // pos·state·action row under the meaning) and carries its reading as
  // real RUBY over each kanji — the same drawing as the sentence pane
  // above it — instead of the inline layouts' detached reading span.
  const surfaceContent = stage ? (
    <span className="phrase-word-card__surface" style={{ '--word-color': wordColor(word) }} lang="ja">
      <FuriganaParts parts={word.furigana ?? [{ text: word.surface }]} />
    </span>
  ) : (
    <>
      <span className="phrase-word-card__surface" style={{ '--word-color': wordColor(word) }}>
        {word.surface}
      </span>
      {word.reading && (
        // The parentheses are CSS (::before/::after on the base rule):
        // presentation for the inline layouts; screen readers needn't
        // announce punctuation.
        <span className="phrase-word-card__reading">{word.reading}</span>
      )}
      {word.pos && (
        <span className="phrase-word-card__pos">
          {word.pos}
        </span>
      )}
    </>
  )

  // What prints under the word: the deep tier's contextual gloss when
  // it has been bought, otherwise (on the stage) the dictionary's own
  // translation — the learner shouldn't need to buy an explanation to
  // know what 電車 means.
  const gloss = word.meaning ?? (stage ? word.vocab_match?.entry?.meaning : undefined)

  return (
    <div
      className={`card phrase-word-card${extraClassName ? ' ' + extraClassName : ''}${emphasize ? ' phrase-word-card--i-plus-one' : ''}`}
    >
      {emphasize && (
        <div className="phrase-word-card__i-plus-one-flag">{t.iPlusOne ?? 'One step beyond you'}</div>
      )}
      <div className="phrase-word-card__top">
        {word.vocab_match ? (
          <button
            type="button"
            onClick={() => onWordClick(word)}
            className="phrase-word-card__surface-wrap phrase-word-card__surface-wrap--clickable"
            aria-label={t.detailsForToken(word.surface)}
          >
            {surfaceContent}
          </button>
        ) : (
          <div className="phrase-word-card__surface-wrap">{surfaceContent}</div>
        )}
        {!compact && !stage && word.vocab_match && <StatusBadge status={word.vocab_match.stats.status} t={t} />}
        {speakable && (
          <SpeakButton text={word.surface} label={t.hearToken(word.surface)} size="sm" t={t} />
        )}
        {showVocabMine && !stage && (
          <MineControls
            mining={mining}
            t={t}
            word={word}
            sentenceText={sentenceText}
            buildCloze={buildCloze}
            onMineVocab={deckId => mining.mineApp({
              deckId, source: 'vocab', level: word.vocab_match.level,
              rawId: word.vocab_match.raw_id, kind: 'vocab',
            })}
          />
        )}
      </div>

      <div className="phrase-word-card__meaning">{gloss}</div>

      {/* The mockup's tok__row: pos · state · the ONE deck action, on
          a single line under the meaning. No OPTIONS disclosure here —
          the cloze variant lives with the full controls in WordDetail;
          a card this clean offers one obvious act. */}
      {stage && (
        <div className="anl-tokrow">
          {word.pos && <span className="phrase-word-card__pos">{word.pos}</span>}
          {word.vocab_match && <StatusBadge status={word.vocab_match.stats.status} t={t} />}
          {showVocabMine && (
            <MineButton
              mining={mining}
              kind="vocab"
              disabled={!word.vocab_match}
              disabledReason={t.cannotMineOffDeck}
              label={t.addToDeck}
              onMine={word.vocab_match ? deckId => mining.mineApp({
                deckId, source: 'vocab', level: word.vocab_match.level,
                rawId: word.vocab_match.raw_id, kind: 'vocab',
              }) : undefined}
              t={t}
            />
          )}
        </div>
      )}

      {word.kanji_matches?.length > 0 && (
        <div className="phrase-word-card__kanji-row">
          {word.kanji_matches.map(k => (
            stage ? (
              // The stage chip holds no inner control (badge and mine
              // live in the detail it opens), so the WHOLE chip is the
              // button — its full surface clicks, not just the glyph.
              // It pairs the glyph with its MEANING (the mockup's
              // 番 number); the grade waits in the detail sheet.
              <button
                key={k.raw_id}
                type="button"
                className="phrase-kanji-chip"
                onClick={() => onKanjiClick(k)}
                aria-label={t.detailsForKanji(k.kanji)}
              >
                <span className="phrase-kanji-chip__char" lang="ja">{k.kanji}</span>
                <span className="phrase-kanji-chip__level">{k.entry?.meaning ?? k.level}</span>
              </button>
            ) : (
              // The list chip is NOT the control. It holds a MineButton,
              // and a <button> inside a <button> is invalid HTML with
              // undefined focus behaviour -- so the character carries
              // the click and the chip is a plain container.
              <div key={k.raw_id} className="phrase-kanji-chip">
                <button
                  type="button"
                  onClick={() => onKanjiClick(k)}
                  className="phrase-kanji-chip__char"
                  style={{ '--word-color': STATUS_COLORS[k.stats.status] }}
                  aria-label={t.detailsForKanji(k.kanji)}
                  lang="ja"
                >
                  {k.kanji}
                </button>
                <span className="phrase-kanji-chip__level">{k.level}</span>
                {!compact && <StatusBadge status={k.stats.status} small t={t} />}
                <MineButton
                  mining={mining}
                  kind="kanji"
                  onMine={deckId => mining.mineApp({ deckId, source: 'kanji', level: k.level, rawId: k.raw_id, kind: 'kanji' })}
                  t={t}
                />
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
