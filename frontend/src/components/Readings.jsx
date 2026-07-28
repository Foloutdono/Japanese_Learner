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