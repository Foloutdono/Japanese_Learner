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
function isOnyomiToken(token) {
  const firstKana = [...token].find(c => /[\u3040-\u30FF]/.test(c))
  if (!firstKana) return false
  return /[\u30A0-\u30FF]/.test(firstKana) // katakana range
}

function splitReadingTokens(kana) {
  return (kana || '')
    .split(/[・;]/)
    .map(s => s.trim())
    .filter(Boolean)
}

// ── Per-kanji furigana alignment ────────────────────────────
// A term's reading comes in as one flat kana string covering the
// whole thing (e.g. "食べる" → "たべる"), but any kana already
// written in the term itself (okurigana like べる, or the お/い in
// お願い) is identical to the reading, so putting the *entire*
// reading above the *entire* term duplicates that part: べる shows
// up both as furigana above and as plain text below. Real furigana
// only sits over the kanji portion — this splits `text` into its
// kanji/kana runs and, using the kana runs as fixed anchors, works
// out which slice of `reading` belongs over each kanji run, so a
// mixed term gets furigana positioned per kanji run instead of one
// blanket label spanning kana that already speaks for itself.
// A term that's a single unbroken kanji run (one kanji, or a
// compound with no kana anywhere, e.g. 大学) has no kana anchor to
// split on — there's no reliable way to say where だい ends and がく
// begins without per-kanji data we don't have — so that case keeps
// the traditional single reading over the whole span.
function alignFurigana(text, reading) {
  if (!text) return []
  if (!reading || !/[\u4e00-\u9faf]/.test(text)) return [{ text }]

  const runs = text.match(/[\u4e00-\u9faf]+|[^\u4e00-\u9faf]+/g) || [text]
  if (runs.length === 1) return [{ text, reading }]

  let pattern = '^'
  const kanjiRunIdx = []
  runs.forEach((run, i) => {
    if (/[\u4e00-\u9faf]/.test(run)) {
      kanjiRunIdx.push(i)
      pattern += '(.+?)'
    } else {
      pattern += run.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
  })
  const match = reading.match(new RegExp(pattern + '$'))
  // Reading didn't line up with the term's kana anchors (rare, but
  // possible with irregular entries) — fall back to one block rather
  // than showing something wrong.
  if (!match) return [{ text, reading }]

  return runs.map((run, i) => {
    const kIdx = kanjiRunIdx.indexOf(i)
    return kIdx === -1 ? { text: run } : { text: run, reading: match[kIdx + 1] }
  })
}

// Renders `text` with `reading` as furigana, split per kanji run (see
// alignFurigana above) instead of one <ruby> spanning the whole term.
// Drop-in replacement for `<ruby>{text}<rt>{reading}</rt></ruby>`.
export function Furigana({ text, reading, className }) {
  return alignFurigana(text, reading).map((part, i) => part.reading
    ? <ruby key={i} className={className}>{part.text}<rt>{part.reading}</rt></ruby>
    : <span key={i} className={className}>{part.text}</span>
  )
}

export function ReadingGroup({ label, readings, size = 18, color = 'var(--text-primary)', center = false, isLarge = false }) {
  if (!readings.length) return null
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
        {readings.map((r, i) => (
          <span key={i} className="reading-group__item">
            {readings.length > 1 && (
              <span className="reading-group__item-index">{i + 1}.</span>
            )}
            <span className="reading-group__item-text">{r}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Renders a kana reading field elegantly: on'yomi/kun'yomi split for a
// kanji's mixed readings, or a plain (numbered if there's more than one)
// list for a single-register reading like vocab. Returns null if empty.
export function Readings({ kana, onLabel, kunLabel, size = 18, color, center = false, isLarge = false }) {
  const tokens = splitReadingTokens(kana)
  if (!tokens.length) return null

  const on  = tokens.filter(isOnyomiToken)
  const kun = tokens.filter(t => !isOnyomiToken(t))

  if (on.length && kun.length) {
    return (
      <div>
        <ReadingGroup label={onLabel}  readings={on}  size={size} color={color} center={center} isLarge={isLarge} />
        <ReadingGroup label={kunLabel} readings={kun} size={size} color={color} center={center} isLarge={isLarge} />
      </div>
    )
  }

  return <ReadingGroup readings={tokens} size={size} color={color} center={center} isLarge={isLarge} />
}