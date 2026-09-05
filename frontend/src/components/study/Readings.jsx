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
export function FuriganaParts({ parts, className }) {
  if (!parts?.length) return null
  return parts.map((part, i) => part.reading
    ? <ruby key={i} className={className}>{part.text}<rt>{part.reading}</rt></ruby>
    : <span key={i} className={className}>{part.text}</span>
  )
}

// The whole word, rendered at prompt size with its furigana on top.
// Two callers want exactly this box and were each building it inline:
// vocab's indice_3 hint, and word_reading's own reveal (where the
// reading is not a hint at all but the answer being shown).
// `answer` tints the ruby with the success colour so a revealed reading
// reads as the answer rather than as decoration over the prompt.
export function FuriganaWord({ parts, size = 72, answer = false }) {
  if (!parts?.length) return null
  return (
    <div
      className={`furigana-word${answer ? ' furigana-word--answer' : ''}`}
      style={{ '--furigana-size': `${size}px` }}
      lang="ja"
    >
      <FuriganaParts parts={parts} />
    </div>
  )
}

export function ReadingGroup({ label, readings, size = 18, color = 'var(--text-primary)', center = false, isLarge = false, limit, moreLabel }) {
  if (!readings.length) return null
  // The study card passes a limit; the dictionary passes none and gets
  // the lot. See domain/readingPick for why the few are chosen by stem
  // rather than sliced off the front.
  const shown = pickVariedReadings(readings, limit)
  const hidden = readings.length - shown.length
  const style = {
    '--reading-size': `${size}px`,
    '--reading-index-size': `${Math.max(size - 5, 10)}px`,
    '--reading-color': color,
    '--reading-font': isLarge ? 'var(--font-jp)' : 'inherit',
  }
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