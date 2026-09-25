import { useLang } from '../../LangContext'
import { Dots } from '../ui/Loading'
import { FuriganaParts } from '../study/Readings'
import { STATUS_COLORS, wordColor } from './status'
import { TokenCard } from './TokenCard'
import { GrammarChips } from './GrammarChips'
import { GrammarPoints } from './GrammarPoints'
import { LevelBadge } from './LevelBadge'
import { SpeakButton } from './SpeakButton'
import { rowsOf } from './rows'
import { grammarGloss } from './grammarGloss'
import { coversToken, pointKey } from './grammarSpans'
import { isUnknownToken, tokState } from './tokens'
import { useLight } from './useLight'

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
//
// The whole row is the door (plan 096): a row that opens something is
// a <button> laid out as the same grid, with the word, the reading,
// the gloss and the level as plain spans inside it. A row that opens
// nothing stays a <div>.
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
        const level = head.vocab_match?.level ?? door?.level ?? null
        // The DOOR IS THE ROW, not the word in it (plan 096). The word
        // was a 30x24px target on a 65px-tall row, with the reading,
        // the gloss and the level beside it all dead to the touch --
        // three quarters of what a learner is looking at when they
        // reach for it. The word keeps the affordance it always had
        // (the rule under it, the pigment on hover) and is now drawn
        // by the row's own state; the row carries the press.
        const opens = head.vocab_match && onTokenClick
          ? () => onTokenClick(head)
          : door
            ? () => onGrammarOpen(door)
            : null
        // A marker's row lights the particle in the line above while
        // it is hovered or focused -- on the row now, so the whole
        // row lights it (see useLight).
        const doorLit = door && lit && pointKey(lit) === pointKey(door)
        const body = (
          <>
            <span
              className={`bkd-row__word bkd-tok bkd-tok--${state}${opens ? ' bkd-tok--door' : ''}${doorLit ? ' bkd-tok--lit' : ''}`}
              lang="ja"
            >
              {row.surface}
            </span>
            {reading && <span className="bkd-row__reading" lang="ja">{reading}</span>}
            <span className="bkd-row__meaning">{meaning}</span>
            {level && <span className="type-badge bkd-row__lvl">{level}</span>}
          </>
        )
        if (!opens) return <div key={i} className="bkd-row">{body}</div>
        // The row's name is everything printed on it, not "Details for
        // 六" alone: an aria-label on a button REPLACES its contents,
        // so the reading and the gloss -- which were plain text beside
        // the old word button and read as such -- have to be said here
        // or they are lost to a screen reader entirely.
        const label = [t.detailsForToken(row.surface), reading, meaning, level]
          .filter(Boolean).join(' — ')
        return (
          <button
            key={i}
            type="button"
            className="bkd-row bkd-row--door"
            onClick={opens}
            aria-label={label}
            {...(door ? light(door) : {})}
          >
            {body}
          </button>
        )
      })}
    </div>
  )
}

// The sentence breakdown, in one of two layouts:
//
//   'list'    — every Token as a scrolling list of cards (the phrase
//               analyzer's original shape): a colour-coded phrase line
//               up top, the explanation, a status legend, then one
//               TokenCard per Token. No screen draws it today; the
//               analyzer moved to a stage of its own (plan 073, drawn
//               since plan 134 by SubtitleLine, WordsList and
//               FocusCard) and the practice modes to 'rows' (plan
//               084), which retired the one-card-at-a-time 'stepper'
//               the practice modes used to share.
//   'rows'    — the practice modes' shape (plan 084): the ruby line,
//               the sentence's `translation`, one row per word, the
//               grammar spotted (and, once bought, what each rule does
//               here -- GrammarNotes, plan 095), and the `note` (else
//               the deep tier's explanation) last and quiet.
//               `sentenceText` is what prints when there is no
//               analysis to draw from.
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
  analysis, t, layout = 'list', onTokenClick, onKanjiClick, mining, speakable = false,
  translation, note, sentenceText, onGrammarOpen, onExplain, explaining = false, explainError = null,
}) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  // The light is this component's in the rows (the line and the chips
  // are both drawn here); PassageBreakdown, which composes the same
  // pieces itself, holds its own.
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
              {/* Full width on a phone, shrink-wrapped from the tablet
                  rung up (plan 096, see .bkd__explain): a 128px box
                  left-aligned under a full-bleed column of rows read
                  as a footnote rather than as the one thing left to
                  do. The wait is the app's own three dots beside the
                  label, so the press is answered in the control that
                  was pressed instead of only in its wording. */}
              <button
                type="button"
                className="btn-secondary bkd__explain-btn"
                onClick={onExplain}
                disabled={explaining}
                aria-busy={explaining || undefined}
              >
                {explaining ? t.explaining : t.explainSentence}
                {explaining && <Dots />}
              </button>
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
