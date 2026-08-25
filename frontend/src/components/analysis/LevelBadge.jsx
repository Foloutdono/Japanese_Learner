// The estimated JLPT level, the unknown-word count, and an i+1 marker
// (a Sentence with exactly ONE unknown Token -- comprehensible except
// for a single step, the highest-value thing to study). off_deck_count
// is shown SEPARATELY and never merged into unknownCount: a word in no
// app deck (a proper noun, JMdict-only vocabulary, slang) is something
// the app cannot teach, not something the learner failed to learn --
// see CONTEXT.md's "Off-deck" / "Unknown" entries.
export function LevelBadge({ level, unknownCount, offDeckCount, t }) {
  if (level == null && unknownCount == null) return null
  const isIPlusOne = unknownCount === 1

  return (
    <div className="analysis-level-badge">
      {level && (
        <span className="analysis-level-badge__level">
          {t.sentenceLevel ?? 'Estimated level'}: {level}
        </span>
      )}
      {typeof unknownCount === 'number' && (
        <span
          className={`analysis-level-badge__unknown${isIPlusOne ? ' analysis-level-badge__unknown--i-plus-one' : ''}`}
        >
          {isIPlusOne
            ? (t.iPlusOne ?? 'One step beyond you')
            : `${unknownCount} ${t.unknownWords ?? 'unknown words'}`}
        </span>
      )}
      {typeof offDeckCount === 'number' && offDeckCount > 0 && (
        <span className="analysis-level-badge__off-deck">
          {offDeckCount} {t.offDeckWords ?? 'not taught by the app'}
        </span>
      )}
    </div>
  )
}
