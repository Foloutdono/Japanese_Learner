import { useLang } from '../../LangContext'
import { Dots } from '../ui/Loading'
import { FuriganaParts } from '../study/Readings'
import { STATUS_COLORS, wordColor } from './status'
import { TokenCard } from './TokenCard'
import { GrammarChips } from './GrammarChips'
import { GrammarPoints } from './GrammarPoints'
import { LevelBadge } from './LevelBadge'
import { SpeakButton } from './SpeakButton'
import { wordRowsOf } from './rows'
import { grammarGloss } from './grammarGloss'
import { coversToken, numberedPointsOf } from './grammarSpans'
import { isUnknownToken, lineState, tokState, wordGloss } from './tokens'
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

// ── The rows (plan 084; numbered since plan 159) ─────────────
// The word-by-word breakdown as the practice modes show it, laid out as
// the analyser's (plan 134, the owner's pick A of five drawn on the
// canvas "Tsuji Breakdown Panel"): the sentence as a ruby line with
// each rule framed on its words under its number, its translation, one
// row per WORD -- its dictionary form, reading, meaning, level -- then
// a numbered card per rule, and Explain at the foot. The grouping of
// morphemes into words is rows.js's.

// The sentence as its tokens, the reading over each kanji, the SRS
// speaking through the 2px rule under a word (lineState's classes, the
// analyzer's own convention). A deck word is a door to its entry; a
// particle is text. Without an analysis the sentence prints plain,
// exactly as the card would have printed it -- never a blank.
//
// `lit` is the grammar point whose words are lit (useLight): a token
// one of its segments is written on wears the grammar line's tint.
//
// `numbered` (plan 159): each point of numberedPointsOf is framed on
// the run of words it sits on, its number at the frame's head -- the
// number its card under the words carries -- as the analyser's
// subtitle frames them (SubtitleLine). A word two points cover is
// framed once, by the first; the frame then carries every number whose
// point begins in it.
export function SentenceLine({ analysis, text, t, onTokenClick, lit = null, numbered = false }) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  if (analysis?.available === false || !tokens.length) {
    return <span className="prose__jp" lang="ja">{text ?? analysis?.text ?? ''}</span>
  }
  const grammar = analysis?.grammar ?? []
  const word = (w, i) => {
    const cls = `bkd-tok bkd-tok--${lineState(w, grammar)}${lit && coversToken(lit, w) ? ' bkd-tok--lit' : ''}`
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
  }
  const points = numbered ? numberedPointsOf(analysis) : []
  const owner = tokens.map(w => points.findIndex(p => coversToken(p, w)))
  const firstOf = points.map(p => tokens.findIndex(w => coversToken(p, w)))
  const out = []
  let i = 0
  while (i < tokens.length) {
    const p = owner[i]
    // A mark never starts a line (the 禁則 a page keeps): 。 and 、
    // stand with what comes before them, so the line cannot wrap
    // between the two -- it had left a 。 alone on a line of its own.
    if (p === -1 && out.length && isMark(tokens[i])) {
      const prev = out.pop()
      out.push(<span key={`mk-${i}`} className="bkd-keep">{prev}{word(tokens[i], i)}</span>)
      i += 1
      continue
    }
    if (p === -1) {
      out.push(word(tokens[i], i))
      i += 1
      continue
    }
    let j = i
    while (j + 1 < tokens.length && owner[j + 1] === p) j += 1
    const numbers = firstOf
      .map((first, q) => (first >= i && first <= j ? q + 1 : null))
      .filter(Boolean)
    const run = []
    for (let k = i; k <= j; k += 1) run.push(word(tokens[k], k))
    out.push(
      <span key={`pt-${i}`} className="bkd-frame">
        {numbers.length > 0 && <span className="bkd-frame__n" aria-hidden="true">{numbers.join('·')}</span>}
        {run}
      </span>,
    )
    i = j + 1
  }
  return (
    <div
      className={`bkd-line${numbered ? ' bkd-line--numbered' : ''}`}
      lang="ja"
      role="group"
      aria-label={analysis.text ?? text}
    >
      {out}
    </div>
  )
}

const MARK_POS = new Set(['symbol', 'punctuation'])
const isMark = tok => MARK_POS.has(tok.pos)

// One row per word (rows.js's wordRowsOf): the particles, the copula
// and the words a construction is written on are its numbered card's,
// not rows of their own (plan 159; a row with no meaning and nothing to
// open was what 〜てはいけません's て and は drew). The word is named as
// the dictionary names it -- 話す and its reading はなす, where the
// sentence wrote 話し -- and means what it means in the learner's
// language (wordGloss): the model's contextual gloss where it was
// bought, else the card's own. The endings written on it (ます, た)
// ride it as quiet tags; the level is the card's, as a plain badge.
//
// The whole row is the door (plan 096): a row that opens something is
// a <button> laid out as the same grid, with the word, the reading,
// the gloss and the level as plain spans inside it. A row that opens
// nothing stays a <div>.
export function WordRows({ analysis, t, onTokenClick }) {
  // Guarded like GrammarPoints': the rows are drawn under a bare render
  // in the tests, with no provider above them.
  const lang = useLang()?.lang
  const rows = wordRowsOf(analysis)
  if (!rows.length) return null
  return (
    <div className="bkd-rows">
      {rows.map((row, i) => {
        const head = row.head
        const entry = head.vocab_match?.entry
        const name = entry ? (entry.kanji || entry.kana || row.surface) : row.surface
        // The card's reading beside the card's name; the sentence's own
        // where the card names none (a name the course has no card for).
        const reading = entry?.kana
          ? (entry.kana !== name ? entry.kana : '')
          : (row.reading !== row.surface ? row.reading : '')
        const meaning = wordGloss(head, lang)
        const level = head.vocab_match?.level ?? null
        // The ending as the sentence wrote it (ます, ませんでした), its
        // rule's gloss said to a screen reader in the row's name.
        const endings = row.endings.map(p => ({
          text: row.tokens.filter(tok => coversToken(p, tok)).map(tok => tok.surface).join(''),
          gloss: grammarGloss(p, lang),
        }))
        const opens = head.vocab_match && onTokenClick ? () => onTokenClick(head) : null
        const body = (
          <>
            <span
              className={`bkd-row__word bkd-tok bkd-tok--${tokState(head)}${opens ? ' bkd-tok--door' : ''}`}
              lang="ja"
            >
              {name}
            </span>
            {reading && <span className="bkd-row__reading" lang="ja">{reading}</span>}
            <span className="bkd-row__meaning">
              {meaning}
              {endings.map((e, k) => (
                <span key={k} className="bkd-row__ending" lang="ja">＋{e.text}</span>
              ))}
            </span>
            {level && <span className="type-badge bkd-row__lvl">{level}</span>}
          </>
        )
        if (!opens) return <div key={i} className="bkd-row">{body}</div>
        // The row's name is everything printed on it, not "Details for
        // 六" alone: an aria-label on a button REPLACES its contents,
        // so the reading and the gloss -- which were plain text beside
        // the old word button and read as such -- have to be said here
        // or they are lost to a screen reader entirely.
        const label = [
          t.detailsForToken(row.surface), reading, meaning,
          ...endings.map(e => [e.text, e.gloss].filter(Boolean).join(' : ')), level,
        ].filter(Boolean).join(' — ')
        return (
          <button key={i} type="button" className="bkd-row bkd-row--door" onClick={opens} aria-label={label}>
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
//   'rows'    — the practice modes' shape (plan 084, numbered as the
//               analyser's since plan 159): the ruby line with each
//               rule framed and numbered on its words, the sentence's
//               `translation`, one row per word, a numbered card per
//               rule (and, once bought, what each does here -- plan
//               095), and the `note` (else the deep tier's
//               explanation) last and quiet. `sentenceText` is what
//               prints when there is no analysis to draw from.
//
// `onGrammarOpen(point)` makes each grammar card a door to the point's
// dictionary entry; the screen decides what opens — a
// DictionaryLookupSheet on the point's raw_id.
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
        <SentenceLine analysis={analysis} text={sentenceText} t={t} onTokenClick={onTokenClick} lit={light.lit} numbered />
        {translation && <span className="bkd__en">{translation}</span>}
        {available && <WordRows analysis={analysis} t={t} onTokenClick={onTokenClick} />}
        {available && (
          <GrammarPoints analysis={analysis} t={t} lit={light.litKey} onLight={light.onLight} onOpen={openGrammar} />
        )}
        {/* The explanation where it was bought, under the cards it
            follows; else the button that buys it -- the one thing left
            to do, so on the desk it stands on the panel's floor rather
            than under the last card (.bkd__foot, plan 159). */}
        {noteText
          ? <span className="prose__ai">{noteText}</span>
          : onExplain && available && (
            <div className="bkd__explain bkd__foot">
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
