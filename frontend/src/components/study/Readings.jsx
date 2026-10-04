// ── Kanji/vocab readings display ──────────────────────────
// On'yomi readings are written in katakana, kun'yomi in hiragana — a
// kanji's combined reading field mixes both, separated by '・' or ';',
// e.g. "イチ・イツ・ひと~・ひと.つ". We classify each token by its first
// actual kana character (skipping '.'/'~', which are okurigana/variant
// markers, not kana). Vocab readings don't have this on/kun distinction
// (a whole word has one register of readings, not two), so when a field
// doesn't contain both kinds, Readings just renders a plain list instead
// of forcing on'yomi/kun'yomi labels onto it.
//
// Split out of QuizComponents.jsx so DictionaryDetail.jsx (which needs
// it too) doesn't have to import QuizComponents — QuizComponents now
// imports DictionaryDetail for the Flashcard's dictionary lookup sheet,
// and that pair importing each other would be a circular dependency.
import { pickVariedReadings, isOnyomiToken } from '../../domain/readingPick'
import { formatPct, topReadings } from '../../domain/readingShare'
import { useLang } from '../../LangContext'

// Exported so DictionaryScreen's card-preview truncation (shortKana)
// splits on the exact same separators instead of drifting out of
// sync with what Readings actually recognizes — kanji readings use
// '・'/';', vocab readings (packed by vocab_data.py) use '/'.
// eslint-disable-next-line react-refresh/only-export-components -- splitReadingTokens is a plain string-splitting helper shared with DictionaryScreen's shortKana truncation; it must stay a co-located export, not a component.
export function splitReadingTokens(kana) {
  return (kana || '')
    .split(/[・;/]/)
    .map(s => s.trim())
    .filter(Boolean)
}

// ── Per-kanji furigana ───────────────────────────────────────
// The backend (study/furigana.py) already splits a term's flat
// reading into one slice per kanji — rendaku/gemination/on-kun-script
// aware, which the client-side anchor-only split this used to do here
// never could (a kana-free compound like 大学 has no kana anchor to
// split on at all, but the backend's per-kanji reading data still
// divides it だい|がく). This just renders whatever list of
// {text, reading?} parts it was handed; nothing here computes an
// alignment anymore.
// `hit` names one character whose part also carries `hitClassName`:
// the dictionary's word rows pick out the kanji they are examples of,
// so the reading each word demonstrates is the thing the eye lands on.
//
// Where the character has no part of its own -- the aligner kept one
// reading over the whole run, as it does for 今朝 read けさ, where no
// slice of the reading is 今's -- the character is picked out inside
// the run's base and its reading is not: the reading belongs to the
// word, and dressing it in the entry's ink would claim it for 今.
export function FuriganaParts({ parts, className, hit, hitClassName }) {
  if (!parts?.length) return null
  const marks = Boolean(hit && hitClassName)
  return parts.map((part, i) => {
    const own = marks && part.text === hit
    const cls = [className, own ? hitClassName : null].filter(Boolean).join(' ') || undefined
    const base = marks && !own && part.text.includes(hit)
      ? pickOut(part.text, hit, hitClassName)
      : part.text
    return part.reading
      ? <ruby key={i} className={cls}>{base}<rt>{part.reading}</rt></ruby>
      : <span key={i} className={cls}>{base}</span>
  })
}

// `text` with every `hit` in it wrapped in `className`.
function pickOut(text, hit, className) {
  return text.split(hit).flatMap((piece, i) => (
    i === 0 ? [piece] : [<span key={i} className={className}>{hit}</span>, piece]
  ))
}

// The whole word, rendered at prompt size with its furigana on top.
// Two callers want exactly this box and were each building it inline:
// vocab's indice_3 hint, and word_reading's own reveal (where the
// reading is not a hint at all but the answer being shown).
// `answer` tints the ruby with the success colour so a revealed reading
// reads as the answer rather than as decoration over the prompt.
export function FuriganaWord({ parts, size = 72, answer = false }) {
  if (!parts?.length) return null
  // How many characters share the line -- the same --len CharDisplay
  // sets, for the same reason: `size` is a CEILING, and a word too
  // long for the card divides the card's width by its count rather
  // than wrapping (こんにちは under its romaji broke after four
  // characters on a 390px phone, plan 098). Spread, not .length: a
  // surrogate pair is one character on screen.
  const len = parts.reduce((n, part) => n + [...(part.text ?? '')].length, 0) || 1
  // Two boxes, not one. The outer is the specimen's band -- exactly the
  // box .char-display occupies at the same rung -- and the inner is the
  // ruby line, centred on it and out of the flow, so the reading's
  // leading rides ABOVE the word instead of adding to the band. The
  // word is then in the same place whether its reading is on or off,
  // which is the whole point: the furigana hint is a line appearing
  // over the word, not a second thing pushing the word, the "tap to
  // reveal" under it and the card's own height down (see .furigana-word
  // in index.css for the numbers that motivated it).
  return (
    <div
      className={`furigana-word${answer ? ' furigana-word--answer' : ''}`}
      style={{ '--furigana-size': `${size}px`, '--len': len }}
      lang="ja"
    >
      <div className="furigana-word__line">
        <FuriganaParts parts={parts} />
      </div>
    </div>
  )
}

// The custom properties a reading block is sized and inked by: the one
// place they are written (ReadingGroup and ReadingShares both set them).
function readingVars(size, color, isLarge) {
  return {
    '--reading-size': `${size}px`,
    '--reading-index-size': `${Math.max(size - 5, 10)}px`,
    '--reading-color': color,
    '--reading-font': isLarge ? 'var(--font-jp)' : 'inherit',
  }
}

export function ReadingGroup({ label, readings, size = 18, color = 'var(--text-primary)', center = false, isLarge = false, limit, moreLabel }) {
  if (!readings.length) return null
  // The study card passes a limit; the dictionary passes none and gets
  // the lot. See domain/readingPick for why the few are chosen by stem
  // rather than sliced off the front.
  const shown = pickVariedReadings(readings, limit)
  const hidden = readings.length - shown.length
  const style = readingVars(size, color, isLarge)
  return (
    <div className="reading-group" style={style}>
      {label && (
        <div className={`reading-group__label${center ? ' reading-group__label--center' : ''}`}>
          {label}
        </div>
      )}
      <div className={`reading-group__list${center ? ' reading-group__list--center' : ''}`}>
        {shown.map((r, i) => (
          <span key={i} className="reading-group__item">
            {shown.length > 1 && (
              <span className="reading-group__item-index">{i + 1}.</span>
            )}
            <span className="reading-group__item-text">{r}</span>
          </span>
        ))}
        {/* Never truncate in silence: the count says the list is
            partial and where the rest of it lives. */}
        {hidden > 0 && (
          <span className="reading-group__more" title={moreLabel?.(hidden)}>+{hidden}</span>
        )}
      </div>
    </div>
  )
}

// Renders a kana reading field elegantly: on'yomi/kun'yomi split for a
// kanji's mixed readings, or a plain (numbered if there's more than one)
// list for a single-register reading like vocab. Returns null if empty.
export function Readings({ kana, onLabel, kunLabel, size = 18, color, center = false, isLarge = false, limit, moreLabel }) {
  const tokens = splitReadingTokens(kana)
  if (!tokens.length) return null

  const on  = tokens.filter(isOnyomiToken)
  const kun = tokens.filter(t => !isOnyomiToken(t))

  if (on.length && kun.length) {
    return (
      <div>
        <ReadingGroup label={onLabel}  readings={on}  size={size} color={color} center={center} isLarge={isLarge} limit={limit} moreLabel={moreLabel} />
        <ReadingGroup label={kunLabel} readings={kun} size={size} color={color} center={center} isLarge={isLarge} limit={limit} moreLabel={moreLabel} />
      </div>
    )
  }

  return <ReadingGroup readings={tokens} size={size} color={color} center={center} isLarge={isLarge} limit={limit} moreLabel={moreLabel} />
}

// ── 割合 on the study card (plan 175) ─────────────────────────────
// The few readings the course uses most, each with the share of the
// course's words that use it, in place of the numbered list: the ranking
// and the number say the same thing. `layout` is the card's two ways of
// setting it: 'grouped' keeps the two registers and puts the share under
// each reading; 'ranked' is one column, most used first. Returns null
// where the kanji has no word in the course, so the caller keeps the
// list it had.
export function ReadingShares({ kana, shares, onLabel, kunLabel, size = 25, isLarge = false, layout = 'grouped', moreLabel }) {
  const { lang } = useLang()
  const tokens = splitReadingTokens(kana)
  const { top, more } = topReadings(tokens, shares)
  if (!top.length) return null
  const style = readingVars(size, undefined, isLarge)
  const moreMark = more > 0 && (
    <span className="reading-group__more" title={moreLabel?.(more)}>+{more}</span>
  )
  const pct = r => <>{formatPct(r.pct, lang)}<small>%</small></>
  if (layout === 'ranked') {
    return (
      <div className="reading-shares reading-shares--ranked" style={style}>
        {top.map(r => (
          <div key={r.reading} className={`reading-share-row reading-share--${r.tier}`}>
            <span className="reading-share-row__kind" aria-hidden="true">{isOnyomiToken(r.reading) ? '音' : '訓'}</span>
            <span className="reading-share__text">{r.reading}</span>
            <span className="reading-share__bar" aria-hidden="true"><i style={{ width: `${Math.max(r.pct, 2)}%` }} /></span>
            <span className="reading-share__pct">{pct(r)}</span>
          </div>
        ))}
        {moreMark}
      </div>
    )
  }
  const groups = [
    [onLabel, top.filter(r => isOnyomiToken(r.reading))],
    [kunLabel, top.filter(r => !isOnyomiToken(r.reading))],
  ].filter(([, list]) => list.length > 0)
  return (
    <div className="reading-shares reading-shares--grouped" style={style}>
      {groups.map(([label, list]) => (
        <div key={label} className="reading-group">
          <div className="reading-group__label reading-group__label--center">{label}</div>
          <div className="reading-group__list reading-group__list--center">
            {list.map(r => (
              <span key={r.reading} className={`reading-share reading-share--${r.tier}`}>
                <span className="reading-share__text">{r.reading}</span>
                <span className="reading-share__pct">{pct(r)}</span>
                <span className="reading-share__bar" aria-hidden="true"><i style={{ width: `${Math.max(r.pct, 3)}%` }} /></span>
              </span>
            ))}
          </div>
        </div>
      ))}
      {moreMark}
    </div>
  )
}

