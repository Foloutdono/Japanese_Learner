import { useState } from 'react'
import { useLang } from '../../LangContext'
import { CardTransition } from '../study/CardTransition'
import { FuriganaParts } from '../study/Readings'
import { STATUS_COLORS, wordColor } from './status'
import { TokenCard } from './TokenCard'
import { GrammarChips } from './GrammarChips'
import { GrammarPoints } from './GrammarPoints'
import { LevelBadge } from './LevelBadge'
import { SpeakButton } from './SpeakButton'
import { StatusBadge } from './StatusBadge'
import { DeckPicker } from './DeckPicker'
import { StageCard } from './StageCard'
import { rowsOf } from './rows'
import { grammarGloss } from './grammarGloss'
import { coversToken, pointKey } from './grammarSpans'

// Mirrors study/analysis.py's _CONTENT_POS + unknown_count predicate
// exactly, so "the single unknown Token" identified here for i+1
// emphasis is provably the same one the backend counted.
const CONTENT_POS = new Set(['noun', 'verb', 'adjective', 'adverb'])
function isUnknownToken(tok) {
  return CONTENT_POS.has(tok.pos)
    && tok.vocab_match
    && ['not_started', 'new'].includes(tok.vocab_match.stats?.status)
}

// The token's state on the line (canvas AnalyzerResult): a word the
// SRS says the learner has mastered, one being learned (or due back),
// one never started, one the app has no card for (a proper noun,
// JMdict-only vocabulary), and a particle or a mark — which carries
// no rule at all. The state is a 2px rule under the word in the
// state's own ink, never an ink change on the word itself.
const PARTICLE_POS = new Set(['particle', 'symbol', 'auxiliary', 'punctuation', 'conjunction', 'suffix', 'prefix', 'copula'])
const HAS_KANJI = /[一-龯々]/
function tokState(tok) {
  const status = tok.vocab_match?.stats?.status
  if (status === 'mastered') return 'mastered'
  if (status === 'learning' || status === 'due') return 'learning'
  if (status) return 'unknown'
  if (!tok.pos || PARTICLE_POS.has(tok.pos) || !CONTENT_POS.has(tok.pos)) return 'particle'
  return 'offdeck'
}

// The reading printed over a token on the line: only over a word
// with a kanji in it (the rest already spells its own sound).
function tokFurigana(tok) {
  if (!tok.reading || !HAS_KANJI.test(tok.surface ?? '')) return ''
  return tok.reading
}

// ── The light (plan 095) ─────────────────────────────────────
// Where a grammar point sits on the sentence: the words it is written
// on light up while its chip (or the row that opens it) is hovered or
// focused, and the last point pressed stays lit once its sheet has
// closed -- on a phone there is no hover, and "where was that" is the
// question the learner comes back from the sheet with. Two states,
// because a hover ends when the pointer moves and a pick does not:
// the hover wins while it lasts. Both are remembered against the
// analysis they were made on, so a new sentence arrives with nothing
// lit and no effect has to clear it -- not even a hover a keyboard
// shortcut left behind on a chip that unmounted under the pointer.
function useLight(analysis) {
  const [hover, setHover] = useState(null)
  const [pick, setPick] = useState(null)
  const here = held => (held && held.analysis === analysis ? held.point : null)
  const lit = here(hover) ?? here(pick)
  return {
    lit,
    litKey: pointKey(lit),
    onLight: point => setHover(point ? { analysis, point } : null),
    // Wraps a screen's onGrammarOpen: the press lights as it opens.
    open: onOpen => (onOpen ? point => { setPick({ analysis, point }); onOpen(point) } : undefined),
  }
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

// ── The rows (plan 084) ───────────────────────────────────────
// The word-by-word breakdown as the practice modes show it: the
// sentence as a ruby line, its translation, then one row per WORD --
// surface, reading, what it does here, its level -- and the note last.
// The grouping of morphemes into words is rows.js's rowsOf.

// The sentence as its tokens, the reading over each kanji, the SRS
// speaking through the 2px rule under a word (tokState's classes, the
// analyzer's own convention). A deck word is a door to its entry; a
// particle is text. Without an analysis the sentence prints plain,
// exactly as the card would have printed it -- never a blank.
//
// `lit` is the grammar point whose words are lit (useLight): a token
// one of its segments is written on wears the grammar line's tint.
export function SentenceLine({ analysis, text, t, onTokenClick, lit = null }) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  if (analysis?.available === false || !tokens.length) {
    return <span className="prose__jp" lang="ja">{text ?? analysis?.text ?? ''}</span>
  }
  return (
    <div className="bkd-line" lang="ja" role="group" aria-label={analysis.text ?? text}>
      {tokens.map((w, i) => {
        const cls = `bkd-tok bkd-tok--${tokState(w)}${lit && coversToken(lit, w) ? ' bkd-tok--lit' : ''}`
        const parts = w.furigana ?? [{ text: w.surface }]
        return w.vocab_match && onTokenClick ? (
          <button
            key={i}
            type="button"
            className={`${cls} bkd-tok--door`}
            onClick={() => onTokenClick(w)}
            aria-label={t.detailsForToken(w.surface)}
          >
            <FuriganaParts parts={parts} />
          </button>
        ) : (
          <span key={i} className={cls}><FuriganaParts parts={parts} /></span>
        )
      })}
    </div>
  )
}

// One row per word. The reading is the run's own kana and is left out
// when it would only repeat the word (は, ともだち); the gloss is the
// model's contextual one where it was bought or came with the text,
// else the deck's own -- a learner should not need a model to know
// what 電車 means. The level is the deck's, as a plain badge.
//
// `lit`/`onLight` (plan 095): the row that opens a marker, and the
// marker chip beside a word row, light the particle in the line above
// while hovered or focused, exactly as a chip does -- see useLight.
export function WordRows({ analysis, t, onTokenClick, onGrammarOpen, lit = null, onLight }) {
  // Guarded like GrammarChips': the rows are drawn under a bare render
  // in the tests, with no provider above them.
  const lang = useLang()?.lang
  const light = point => (onLight ? {
    onMouseEnter: () => onLight(point),
    onMouseLeave: () => onLight(null),
    onFocus: () => onLight(point),
    onBlur: () => onLight(null),
  } : {})
  const rows = rowsOf(analysis?.tokens ?? analysis?.words ?? [])
  if (!rows.length) return null
  return (
    <div className="bkd-rows">
      {rows.map((row, i) => {
        const head = row.head
        const state = tokState(head)
        const reading = row.reading !== row.surface ? row.reading : ''
        const markers = (onGrammarOpen ? row.markers : null) ?? []
        // A row with no deck entry behind it used to be the one row
        // that went nowhere -- 「へ」 is not a word anyone mines, so
        // pressing it did nothing while the rule it IS sat in a chip
        // below, unattached to the particle demonstrating it. When the
        // row is a marker and nothing else, the marker is what the row
        // opens, in the same place and with the same affordance a word
        // opens its entry. A particle never folds into the word before
        // it (rows.js), so a marker is a row of its own and no chip
        // rides beside a word any more.
        const door = !head.vocab_match && markers.length === 1 ? markers[0] : null
        // The meaning: the model's contextual gloss where it was
        // bought, else the deck's own, else -- for the row that is a
        // marker and nothing else -- the marker's gloss (plan 095).
        // 「は」 used to be the one row with an empty meaning cell,
        // and "marks the sentence topic" is precisely what a learner
        // looking at that row wants to read there.
        const meaning = head.meaning ?? head.vocab_match?.entry?.meaning ?? (door ? grammarGloss(door, lang) : '')
        return (
          <div key={i} className="bkd-row">
            {head.vocab_match && onTokenClick ? (
              <button
                type="button"
                className={`bkd-row__word bkd-tok bkd-tok--${state} bkd-tok--door`}
                lang="ja"
                onClick={() => onTokenClick(head)}
                aria-label={t.detailsForToken(row.surface)}
              >
                {row.surface}
              </button>
            ) : door ? (
              <button
                type="button"
                className={`bkd-row__word bkd-tok bkd-tok--${state} bkd-tok--door${lit && pointKey(lit) === pointKey(door) ? ' bkd-tok--lit' : ''}`}
                lang="ja"
                onClick={() => onGrammarOpen(door)}
                aria-label={t.detailsForToken(row.surface)}
                {...light(door)}
              >
                {row.surface}
              </button>
            ) : (
              <span className={`bkd-row__word bkd-tok bkd-tok--${state}`} lang="ja">{row.surface}</span>
            )}
            {reading && <span className="bkd-row__reading" lang="ja">{reading}</span>}
            <span className="bkd-row__meaning">{meaning}</span>
            {(head.vocab_match?.level || door?.level) && (
              <span className="type-badge bkd-row__lvl">{head.vocab_match?.level ?? door.level}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// The sentence breakdown, in one of three layouts:
//
//   'list'    — every Token as a scrolling list of cards (the phrase
//               analyzer's original shape): a colour-coded phrase line
//               up top, the explanation, a status legend, then one
//               TokenCard per Token. No screen draws it today; the
//               analyzer moved to 'stage' (plan 073) and the practice
//               modes to 'rows' (plan 084), which retired the
//               one-card-at-a-time 'stepper' the practice modes used
//               to share.
//   'stage'   — the analyser's control-room shape (the mockup round):
//               the sentence as its own surface panel where status is
//               an UNDERLINE rather than an ink colour, the grammar
//               the sentence is built with as quiet chips under it
//               (plan 095), then the caller's `controls` (the
//               view/furigana dials), then the same carousel with the
//               card grown to the stage. Lives here beside its
//               siblings so the three shapes share TokenCard,
//               FuriganaParts and the badges instead of a fourth
//               near-copy drifting off on its own.
//   'rows'    — the practice modes' shape (plan 084): the ruby line,
//               the sentence's `translation`, one row per word, the
//               grammar spotted (and, once bought, what each rule does
//               here -- GrammarNotes, plan 095), and the `note` (else
//               the deep tier's explanation) last and quiet.
//               `sentenceText` is what prints when there is no
//               analysis to draw from.
//
// `index`/`setIndex` are used by 'stage' and are owned by the caller
// (AnalyzerScreen) so they can be reset to 0 whenever a new sentence
// is focused. `controls`, `tokenView` and `onJumpToToken` are only
// read by 'stage': tokenView chooses between the carousel and the
// mockup's token table, and onJumpToToken is what a table row's
// surface does (focus that token AND switch back to the carousel —
// the mockup's own behaviour).
//
// `onGrammarOpen(point)` makes each grammar chip a door to the point's
// dictionary entry (GrammarChips' onOpen); the screen decides what
// opens — a DictionaryLookupSheet on the point's raw_id.
//
// `onExplain` (plan 095, owner-directed) makes the explanation an
// option in the rows: the practice modes fetch the local tier only,
// and the button buys the deep tier -- the contextual glosses, the
// line per rule and the note on the whole sentence -- the way the
// analyzer's Explain does. `explaining` and `explainError` are the
// call's state, the caller's to hold.
export function SentenceBreakdown({
  analysis, t, layout = 'list', index = 0, setIndex, onTokenClick, onKanjiClick, mining,
  speakable = false, controls = null, tokenView = 'stepper', onJumpToToken,
  translation, note, sentenceText, onGrammarOpen, onExplain, explaining = false, explainError = null,
}) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  // The light is this component's in the rows and on the stage (the
  // line and the chips are both drawn here); PassageBreakdown, which
  // composes the same pieces itself, holds its own.
  const light = useLight(analysis)
  const openGrammar = light.open(onGrammarOpen)

  if (layout === 'rows') {
    const available = analysis?.available !== false && tokens.length > 0
    const noteText = note ?? analysis?.explanation ?? ''
    return (
      <div className="bkd">
        <SentenceLine analysis={analysis} text={sentenceText} t={t} onTokenClick={onTokenClick} lit={light.lit} />
        {translation && <span className="bkd__en">{translation}</span>}
        {available && (
          <WordRows
            analysis={analysis} t={t} onTokenClick={onTokenClick} onGrammarOpen={openGrammar}
            lit={light.lit} onLight={light.onLight}
          />
        )}
        {available && (
          <GrammarPoints analysis={analysis} t={t} lit={light.litKey} onLight={light.onLight} onOpen={openGrammar} />
        )}
        {noteText
          ? <span className="prose__ai">{noteText}</span>
          : onExplain && available && (
            <div className="bkd__explain">
              {explainError && <span className="hint bkd__explain-hint">{explainError}</span>}
              <button type="button" className="btn-secondary" onClick={onExplain} disabled={explaining}>
                {explaining ? t.explaining : t.explainSentence}
              </button>
            </div>
          )}
      </div>
    )
  }

  if (layout === 'stage') {
    // Same both-ways clamp as the stepper below, same reason: a
    // Sentence can legitimately have no tokens, and that must render
    // as "nothing to step through", not a white screen.
    const current = tokens.length ? tokens[Math.min(index, tokens.length - 1)] : null

    return (
      <div className="anl-stagebd">
        {/* ── The line (canvas .tok-line) ──
            The sentence as tokens: the reading over each word that
            needs one, the SRS speaking through a 2px rule under it
            (see tokState), the one on the stage tinted. The furigana
            dial (the caller's `controls`) hides the readings by state
            through data-furigana on the stage. */}
        <div className="tok-line" role="group" aria-label={analysis.text}>
          {tokens.map((w, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`tok tok--${tokState(w)}${i === index ? ' tok--on' : ''}${light.lit && coversToken(light.lit, w) ? ' tok--lit' : ''}`}
              aria-label={t.jumpToTokenNamed(w.surface)}
              aria-pressed={i === index}
              lang="ja"
            >
              <span className="tok__furi" lang="ja">{tokFurigana(w)}</span>
              <span className="tok__word">{w.surface}</span>
            </button>
          ))}
        </div>
        <div className="anl-legend" aria-hidden="true">
          <span className="anl-legend__item"><i className="anl-legend__ink anl-legend__ink--mastered" />{t.status_mastered}</span>
          <span className="anl-legend__item"><i className="anl-legend__ink anl-legend__ink--learning" />{t.status_learning}</span>
          <span className="anl-legend__item"><i className="anl-legend__ink anl-legend__ink--unknown" />{t.status_new}</span>
          <span className="anl-legend__item"><i className="anl-legend__ink anl-legend__ink--offdeck" />{t.offDeckKey}</span>
        </div>

        {/* ── The grammar the sentence is built with (plan 095) ──
            The constructions the local tier found, each with its
            gloss, its parts and (once bought) its line, every one a
            door to its lesson. The stage used to be the one breakdown
            that showed none of it. The markers (は, を) are not here --
            they are the rule of one word, and the card below says so
            about that word. */}
        <GrammarPoints analysis={analysis} t={t} lit={light.litKey} onLight={light.onLight} onOpen={openGrammar} />

        {controls}

        {tokenView === 'table' ? (
          <TokenTable
            tokens={tokens}
            t={t}
            mining={mining}
            onJumpToToken={onJumpToToken ?? setIndex}
          />
        ) : (
          <CardTransition cardKey={index} className="anl-stagebd__card">
            {current && (
              <StageCard
                word={current}
                t={t}
                onWordClick={onTokenClick}
                onKanjiClick={onKanjiClick}
                onGrammarOpen={openGrammar}
                lit={light.litKey}
                onLight={light.onLight}
                mining={mining}
                emphasize={analysis.unknown_count === 1 && isUnknownToken(current)}
              />
            )}
          </CardTransition>
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
              className={`word-span word-span--clickable`}
              style={{ '--word-color': wordColor(w) }}
              aria-label={t.detailsForToken(w.surface)}
              lang="ja"
            >
              <FuriganaParts parts={w.furigana ?? [{ text: w.surface }]} />
            </button>
          ) : (
            <span key={i} className={`word-span`} style={{ '--word-color': wordColor(w) }} lang="ja">
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
        <GrammarChips grammar={analysis.grammar} t={t} mining={mining} onOpen={onGrammarOpen} />
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
