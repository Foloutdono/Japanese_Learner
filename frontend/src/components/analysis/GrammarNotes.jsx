import { pointKey } from './grammarSpans'

// ── The deep tier's line per rule (plan 095) ─────────────────────
// Once an explanation is bought, the model is told which grammar the
// local tier found and asked what each point does in THIS sentence
// (routes/phrase._deep_points); its line comes back on the point as
// `note`. Printed here as one row per noted point, under the chips
// that name the same points: the pattern, then the line. The chip
// already says what the rule is in general (its gloss); this says what
// it is doing here, which is the one thing a catalogue cannot.
//
// A row is a door to the point's sheet through `onOpen`, and lights
// the words the point is written on through `lit`/`onLight`, exactly
// as its chip does (GrammarChips). Nothing prints until a note exists:
// the local tier alone draws no empty list, and a sentence whose
// explanation predates the notes reads as it always did.
export function GrammarNotes({ grammar, t, lit = null, onLight, onOpen }) {
  const noted = grammar?.filter(g => typeof g.note === 'string' && g.note.trim())
  if (!noted?.length) return null
  return (
    <div className="bkd-notes">
      {noted.map(g => {
        const key = pointKey(g)
        const light = onLight ? {
          onMouseEnter: () => onLight(g),
          onMouseLeave: () => onLight(null),
          onFocus: () => onLight(g),
          onBlur: () => onLight(null),
        } : {}
        return (
          <div key={key} className={`bkd-note${lit && lit === key ? ' bkd-note--lit' : ''}`} {...light}>
            {onOpen
              ? (
                <button
                  type="button"
                  className="bkd-note__pattern bkd-note__door"
                  lang="ja"
                  onClick={e => { e.stopPropagation(); onOpen(g) }}
                  aria-label={`${t.openDictionary ?? 'Open dictionary entry'}: ${g.pattern}`}
                  title={t.openDictionary}
                >
                  {g.pattern}
                </button>
              )
              : <span className="bkd-note__pattern" lang="ja">{g.pattern}</span>}
            <span className="bkd-note__text">{g.note}</span>
          </div>
        )
      })}
    </div>
  )
}
